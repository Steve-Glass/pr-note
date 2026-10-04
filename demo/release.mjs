import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, gh, git, REPO, verifyOrigin } from './github.mjs';

export function planRelease({ version, revision, sha, main, tags, releases, message, apply }) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Release target must be a full commit SHA.');
  if (!({ '3.0.0': 'A', '3.0.1': 'B' }[version] === revision)) throw new Error('Unexpected demo version/marker.');
  const tag = `v${version}`;
  if (message.split('\n')[0] !== `release: ${tag}`) throw new Error(`Release commit subject must be exactly: release: ${tag}`);
  if (apply && main !== sha) throw new Error('Target is not current main; refusing stale release/alias rewind.');
  const immutable = tags.find(item => item.ref === `refs/tags/${tag}`);
  const alias = tags.find(item => item.ref === 'refs/tags/v3');
  for (const ref of [immutable, alias].filter(Boolean)) {
    if (ref.object.type !== 'commit') throw new Error(`Expected demo lightweight tag: ${ref.ref}`);
  }
  if (immutable && immutable.object.sha !== sha) throw new Error(`Conflicting immutable tag ${tag}; never overwrite.`);
  const existingRelease = releases.find(item => item.tag_name === tag);
  if (existingRelease && (!immutable || existingRelease.draft || existingRelease.prerelease)) {
    throw new Error('Existing release is not the expected published immutable release.');
  }
  if (alias && alias.object.sha !== sha) {
    const a = tags.find(item => item.ref === 'refs/tags/v3.0.0');
    if (revision !== 'B' || !a || a.object.type !== 'commit' || alias.object.sha !== a.object.sha) {
      throw new Error('v3 is not at the expected predecessor; refusing alias overwrite.');
    }
  }
  if (revision === 'B' && !alias) throw new Error('B requires an established A handoff; v3 is absent.');
  const mutations = [];
  if (!immutable) mutations.push({ method: 'POST', endpoint: `repos/${REPO}/git/refs`, body: { ref: `refs/tags/${tag}`, sha } });
  if (!existingRelease) mutations.push({ release: tag, target: sha });
  if (!alias || alias.object.sha !== sha) mutations.push({
    method: alias ? 'PATCH' : 'POST',
    endpoint: `repos/${REPO}/git/refs${alias ? '/tags/v3' : ''}`,
    body: alias ? { sha, force: true } : { ref: 'refs/tags/v3', sha },
  });
  return { tag, sha, main, requiresMainPush: main !== sha, mutations };
}

async function main() {
  verifyOrigin();
  const apply = process.argv.includes('--apply');
  if (process.argv.length > 3 || (process.argv[2] && !['--apply', '--preview'].includes(process.argv[2]))) {
    throw new Error('Usage: node demo/release.mjs [--preview|--apply]');
  }
  if (git('status', '--porcelain')) throw new Error('Commit and review the clean release candidate before previewing.');
  const sha = git('rev-parse', 'HEAD');
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const { DEMO_REVISION: revision } = await import('../src/action.js');
  if (apply && (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_EVENT_NAME !== 'push' ||
      process.env.GITHUB_REF !== 'refs/heads/main' || process.env.GITHUB_SHA !== sha ||
      process.env.GITHUB_REPOSITORY !== REPO ||
      process.env.GITHUB_WORKFLOW_REF !== `${REPO}/.github/workflows/release.yml@refs/heads/main`)) {
    throw new Error('Publishing is only permitted in release.yml on a main push, never workflow_dispatch/local setup.');
  }
  const remoteMain = api(`repos/${REPO}/git/ref/heads/main`).object.sha;
  const tags = api(`repos/${REPO}/git/matching-refs/tags/`);
  const releases = api(`repos/${REPO}/releases?per_page=100`, { paginate: true }).flat();
  const plan = planRelease({ version, revision, sha, main: remoteMain, tags, releases,
    message: git('log', '-1', '--format=%B'), apply });
  if (revision === 'B') {
    const a = tags.find(item => item.ref === 'refs/tags/v3.0.0');
    if (!a) throw new Error('A immutable tag is missing.');
    git('merge-base', '--is-ancestor', a.object.sha, sha);
    const before = git('show', `${a.object.sha}:src/action.js`);
    const after = git('show', `${sha}:src/action.js`);
    if (after !== before.replace("DEMO_REVISION = 'A'", "DEMO_REVISION = 'B'")) {
      throw new Error('B must preserve Action behavior; only its marker changes.');
    }
    const allowed = new Set(['src/action.js', 'package.json', 'package-lock.json', 'dist/index.js']);
    const changed = git('diff', '--name-only', a.object.sha, sha).split('\n');
    if (changed.some(name => !allowed.has(name))) throw new Error('B may change only marker/version and their generated artifacts.');
    for (const name of ['package.json', 'package-lock.json']) {
      const original = JSON.parse(git('show', `${a.object.sha}:${name}`));
      const next = JSON.parse(git('show', `${sha}:${name}`));
      next.version = original.version;
      if (name === 'package-lock.json') next.packages[''].version = original.packages[''].version;
      if (JSON.stringify(original) !== JSON.stringify(next)) throw new Error(`B changes more than version in ${name}.`);
    }
  }
  console.log(JSON.stringify(plan, null, 2));
  if (!apply) return;
  for (const change of plan.mutations) {
    if (api(`repos/${REPO}/git/ref/heads/main`).object.sha !== sha) throw new Error('Main advanced during release; stop and inspect.');
    if (change.release) {
      gh(['release', 'create', change.release, '--repo', REPO, '--verify-tag', '--target', sha,
        '--title', `${change.release} (benign revision ${revision})`,
        '--notes', `Harmless PR note. demo-revision: ${revision}.`]);
    } else {
      if (change.endpoint.endsWith('/tags/v3') || change.body?.ref === 'refs/tags/v3') {
        const target = api(`repos/${REPO}/git/ref/tags/${plan.tag}`);
        if (target.object.type !== 'commit' || target.object.sha !== sha) {
          throw new Error('Immutable target changed before alias update.');
        }
      }
      if (change.endpoint.endsWith('/tags/v3')) {
        const current = api(`repos/${REPO}/git/ref/tags/v3`);
        if (current.object.sha !== tags.find(item => item.ref === 'refs/tags/v3').object.sha) {
          throw new Error('v3 changed during release; refusing overwrite.');
        }
      }
      api(change.endpoint, change);
    }
  }
  for (const tag of [plan.tag, 'v3']) {
    const ref = api(`repos/${REPO}/git/ref/tags/${tag}`);
    if (ref.object.type !== 'commit' || ref.object.sha !== sha) throw new Error(`Readback failed for ${tag}.`);
  }
  console.log(`Published ${plan.tag}; v3 -> ${sha}; demo-revision: ${revision}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
