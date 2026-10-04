import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmdirSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, REPO, verifyOrigin } from './github.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const policy = JSON.parse(readFileSync(new URL('./policies/release-only-steve.json', import.meta.url)));
const policiesPath = `repos/${REPO}/actions/policies`;
const approvalPath = `repos/${REPO}/actions/permissions/fork-pr-contributor-approval`;
const approval = { approval_policy: 'all_external_contributors' };
const writable = value => ({
  name: value.name, enforcement: value.enforcement,
  conditions: value.conditions, rules: value.rules,
});
const same = isDeepStrictEqual;

export function ownPolicy(policies) {
  const matches = policies.filter(item => item.name === policy.name);
  if (matches.length > 1) throw new Error('Ambiguous demo policy name; refusing to modify.');
  const match = matches[0] || null;
  if (match && (match.source_type !== 'Repository' || match.source !== REPO)) {
    throw new Error('Demo name belongs to an inherited/unknown policy; refusing to modify.');
  }
  if (match && !same({ ...writable(match), enforcement: 'active' }, policy)) {
    throw new Error('Existing name has different rules/target; ownership is ambiguous.');
  }
  return match;
}

async function snapshot(kind, request) {
  if (kind === 'approval') return request(approvalPath);
  const pages = await request(`${policiesPath}?has_parents=true&per_page=100`, { paginate: true });
  const items = pages.flatMap(page => {
    if (!Array.isArray(page.policies)) throw new Error('Unexpected policies response.');
    return page.policies;
  });
  const details = [];
  for (const item of items) details.push(await request(`${policiesPath}/${item.id}`));
  return details.sort((a, b) => a.id - b.id);
}

function assertUnchanged(actual, expected) {
  if (!same(actual, expected)) throw new Error('Remote state changed since preview/readback; refusing to overwrite. Inspect and re-plan.');
}

function mutation(kind, before, desired) {
  if (kind === 'approval') {
    return same(before, desired) ? null : { method: 'PUT', endpoint: approvalPath, body: desired };
  }
  const current = ownPolicy(before);
  if (desired === null) {
    return current ? { method: 'DELETE', endpoint: `${policiesPath}/${current.id}` } : null;
  }
  if (current && same(writable(current), writable(desired))) return null;
  return {
    method: current ? 'PUT' : 'POST',
    endpoint: current ? `${policiesPath}/${current.id}` : policiesPath,
    body: writable(desired),
  };
}

export async function settings(kind, operation, filename, request = api) {
  if (!['policy', 'approval'].includes(kind) ||
      !['preview', 'preview-disabled', 'apply', 'restore-preview', 'restore'].includes(operation) ||
      (operation === 'preview-disabled' && kind !== 'policy')) {
    throw new Error('Usage: node demo/settings.mjs policy|approval preview|apply|restore-preview|restore ABSOLUTE_STATE_FILE (policy also supports preview-disabled)');
  }
  if (!filename || !path.isAbsolute(filename)) throw new Error('Use an absolute state file outside the checkout.');
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const parent = realpathSync(path.dirname(filename));
  const relative = path.relative(realpathSync(root), parent);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('State must be outside the checkout, not tracked or in .demo-state.');
  }
  filename = path.join(parent, path.basename(filename));
  if (existsSync(filename) && realpathSync(filename) !== filename) throw new Error('State file must not be a symlink.');
  const lock = `${filename}.lock`;
  mkdirSync(lock, { mode: 0o700 }); // Fail closed if another helper owns this state.
  const save = value => {
    writeFileSync(`${filename}.tmp`, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    renameSync(`${filename}.tmp`, filename);
  };
  try {
    const user = await request('users/Steve-Glass');
    if (user.login !== 'Steve-Glass' || user.type !== 'User' ||
        user.id !== policy.rules[0].parameters.allowed_actors[0].id) {
      throw new Error('Resolved Steve-Glass identity does not match the reviewed policy.');
    }
    const repo = await request(`repos/${REPO}`);
    if (repo.full_name !== REPO || !repo.permissions?.admin) throw new Error('Repository admin access required.');
    const current = await snapshot(kind, request);
    let state = existsSync(filename) ? JSON.parse(readFileSync(filename)) : null;
    if (state && (state.repo !== REPO || state.kind !== kind || state.version !== 1)) {
      throw new Error('Wrong state file.');
    }
    if (operation === 'preview' || operation === 'preview-disabled') {
      const desired = kind === 'policy' ?
        { ...policy, enforcement: operation === 'preview-disabled' ? 'disabled' : 'active' } : approval;
      if (operation === 'preview-disabled' && !ownPolicy(current)) throw new Error('No demo-owned policy to disable.');
      if (state) {
        if (state.status !== 'prepared') throw new Error('Existing transaction; apply/restore it before using a new state file.');
        assertUnchanged(desired, state.desired);
        assertUnchanged(current, state.before);
      } else {
        state = { version: 1, repo: REPO, kind, before: current,
          desired, status: 'prepared' };
        state.change = mutation(kind, current, state.desired);
        save(state);
      }
      return { status: 'preview only', inheritedAndCurrent: current, mutation: state.change };
    }
    if (!state) throw new Error('Preview first; no saved prior state.');
    if (operation === 'apply') {
      if (state.status === 'applied') {
        assertUnchanged(current, state.after);
        return { status: 'already applied; no changes', readback: current };
      }
      if (state.status !== 'prepared') throw new Error('Incomplete/finished transaction; inspect saved receipt before retrying.');
      assertUnchanged(current, state.before);
    } else {
      if (state.status === 'restored') {
        assertUnchanged(current, state.restored);
        return { status: 'already restored; no changes', readback: current };
      }
      if (state.status !== 'applied') throw new Error('No completed apply to restore.');
      assertUnchanged(current, state.after);
      state.change = mutation(kind, current, kind === 'policy' ? ownPolicy(state.before) : state.before);
      if (operation === 'restore-preview') return { status: 'restore preview only', mutation: state.change };
    }
    // Re-read immediately before writing; the API does not document atomic CAS.
    assertUnchanged(await snapshot(kind, request), current);
    const change = state.change;
    state.status = 'mutation-pending';
    state.operation = operation;
    save(state);
    if (change) {
      state.response = await request(change.endpoint, change);
      save(state); // Includes the returned policy ID, even if readback later fails.
    }
    const after = await snapshot(kind, request);
    const target = operation === 'apply' ? state.desired :
      kind === 'policy' ? ownPolicy(state.before) : state.before;
    if (kind === 'policy') {
      const found = ownPolicy(after);
      if (!same(found && writable(found), target && writable(target))) {
        throw new Error('Policy readback mismatch; inspect saved receipt. No automatic retry.');
      }
      const unrelated = list => list.filter(item => item.name !== policy.name);
      assertUnchanged(unrelated(after), unrelated(current));
      state.policyId = found?.id ?? state.response?.id ?? state.policyId;
    } else {
      assertUnchanged(after, target);
    }
    state.status = operation === 'apply' ? 'applied' : 'restored';
    state[operation === 'apply' ? 'after' : 'restored'] = after;
    save(state);
    return { status: state.status, policyId: state.policyId, readback: after };
  } finally {
    rmdirSync(lock);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    verifyOrigin();
    console.log(JSON.stringify(await settings(...process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
