import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';

const read = file => parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));

test('defaults fixture has independent jobs and never executes checked-out PR code', () => {
  const w = read('.github/workflows/lint-defaults.yml');
  const original = read('demo/before/lint.yml');
  assert.deepEqual(w.on, { pull_request_target: { branches: ['main'] } });
  assert.deepEqual(w.on, original.on);
  assert.deepEqual(w.permissions, {});
  assert.deepEqual(w.permissions, original.permissions);
  assert.equal(w['cache-mode'], undefined);
  assert.deepEqual(Object.keys(w.jobs), ['checkout-protection', 'cache-default']);
  const checkout = w.jobs['checkout-protection'];
  assert.equal(checkout['runs-on'], 'ubuntu-latest');
  assert.equal(checkout.steps.length, 1);
  assert.deepEqual(checkout.steps[0], { uses: 'actions/checkout@v6',
    with: { ref: '${{ github.event.pull_request.head.sha }}', 'persist-credentials': false } });
  assert.deepEqual(checkout.steps[0], original.jobs.lint.steps[0]);
  const cache = w.jobs['cache-default'];
  assert.equal(cache.needs, undefined);
  assert.equal(cache['cache-mode'], undefined);
  assert.equal(cache['runs-on'], 'ubuntu-latest');
  assert.equal(cache.steps.length, 2);
  assert.doesNotMatch(cache.steps[0].run, /\$\{\{|\bnpm\b|\bgit\b/);
  assert.equal(cache.steps[1].uses, 'actions/cache/save@v5');
  assert.match(cache.steps[1].with.key, /^universe-tru1556m-default-/);
});

test('optional migration lint uses pull_request, read-only contents, and ordinary checkout', () => {
  const w = read('.github/workflows/lint.yml');
  assert.equal(w.name, 'Lint (migration example)');
  assert.deepEqual(w.on, { pull_request: { branches: ['main'] } });
  assert.deepEqual(w.permissions, { contents: 'read' });
  assert.deepEqual(w.jobs.test.steps[0].with, { 'persist-credentials': false });
  assert.ok(w.jobs.test.steps.some(step => step.run === 'npm ci && npm test'));
});

test('release keeps original npm cache configuration with cache-mode none as the only cache change', () => {
  const w = read('.github/workflows/release.yml');
  assert.equal(w['cache-mode'], 'none');
  assert.deepEqual(w.permissions, { contents: 'write' });
  assert.equal(w.concurrency.group, 'release');
  assert.equal(w.concurrency['cancel-in-progress'], false);
  assert.deepEqual(w.on, { push: { branches: ['main'] }, workflow_dispatch: null });
  const publish = w.jobs.publish;
  assert.match(publish.if, /github.event_name == 'push'/);
  assert.match(publish.if, /github.ref == 'refs\/heads\/main'/);
  assert.match(publish.if, /startsWith\(github.event.head_commit.message, 'release: v'\)/);
  const setup = publish.steps.find(step => step.uses === 'actions/setup-node@v6');
  const originalSetup = read('demo/before/release.yml').jobs.release.steps
    .find(step => step.uses === 'actions/setup-node@v6');
  assert.deepEqual(setup.with, { 'node-version': 24, cache: 'npm' });
  assert.deepEqual(setup, originalSetup);
  assert.equal(publish['cache-mode'], undefined);
  assert.equal(publish['continue-on-error'], undefined);
  assert.ok(publish.steps.every(step => step['continue-on-error'] === undefined));
  const check = w.jobs['policy-check'];
  assert.deepEqual(check, {
    if: "github.event_name == 'workflow_dispatch'",
    permissions: {},
    'runs-on': 'ubuntu-latest',
    steps: [{
      name: 'Harmless actor-policy check (never publishes)',
      run: "printf 'Release actor policy allowed this harmless check; no publication.\\n'",
    }],
  });
});

test('before snapshots remain outside executable workflow discovery', () => {
  assert.deepEqual(readdirSync(new URL('../.github/workflows/', import.meta.url)).sort(),
    ['lint-defaults.yml', 'lint.yml', 'release.yml']);
  assert.equal(read('demo/before/lint.yml').on.pull_request_target.branches[0], 'main');
  assert.equal(read('demo/before/release.yml').jobs.release.steps[1].with.cache, 'npm');
});

test('Action metadata matches shared contract and policy targets only the release User', () => {
  const action = read('action.yml');
  assert.equal(action.inputs.token.required, true);
  assert.equal(action.inputs.body.default, 'Thanks for the pull request!');
  assert.deepEqual(Object.keys(action.outputs), ['demo-revision']);
  assert.deepEqual(action.runs, { using: 'node24', main: 'dist/index.js' });
  const p = read('demo/policies/release-only-steve.json');
  assert.equal(p.enforcement, 'active');
  assert.deepEqual(p.conditions, { workflow_path: { include: ['.github/workflows/release.yml'], exclude: [] } });
  assert.deepEqual(p.rules, [{ type: 'restrict_actions_actors', parameters: {
    allowed_actors: [{ id: 84886334, type: 'User' }],
  } }]);
});
