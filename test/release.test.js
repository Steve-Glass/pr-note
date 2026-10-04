import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRelease } from '../demo/release.mjs';

const a = 'a'.repeat(40);
const b = 'b'.repeat(40);
const tag = (name, sha) => ({ ref: `refs/tags/${name}`, object: { type: 'commit', sha } });
const fixture = overrides => ({ version: '3.0.0', revision: 'A', sha: a, main: a, tags: [],
  releases: [], message: 'release: v3.0.0', apply: true, ...overrides });

test('initial A plan creates immutable tag, release, then alias', () => {
  const plan = planRelease(fixture());
  assert.equal(plan.mutations.length, 3);
  assert.equal(plan.mutations[0].body.ref, 'refs/tags/v3.0.0');
  assert.equal(plan.mutations[1].release, 'v3.0.0');
  assert.equal(plan.mutations[2].body.ref, 'refs/tags/v3');
});
test('completed release rerun is a no-op', () => {
  const plan = planRelease(fixture({ tags: [tag('v3.0.0', a), tag('v3', a)],
    releases: [{ tag_name: 'v3.0.0', draft: false, prerelease: false }] }));
  assert.deepEqual(plan.mutations, []);
});
test('partial release rerun resumes missing release and alias only', () => {
  assert.equal(planRelease(fixture({ tags: [tag('v3.0.0', a)] })).mutations.length, 2);
});
test('refuses immutable conflicts, stale main, and alias rewinds', () => {
  assert.throws(() => planRelease(fixture({ tags: [tag('v3.0.0', b)] })), /Conflicting immutable/);
  assert.throws(() => planRelease(fixture({ main: b })), /not current main/);
  assert.throws(() => planRelease(fixture({ tags: [tag('v3', b)] })), /refusing alias/);
});
test('ordinary documentation commits cannot release', () => {
  assert.throws(() => planRelease(fixture({ message: 'docs: clarify demo' })), /subject must/);
  assert.throws(() => planRelease(fixture({ message: 'release: v3.0.0 extra' })), /subject must/);
});
test('preview identifies a main push prerequisite without changing anything', () => {
  assert.equal(planRelease(fixture({ main: b, apply: false })).requiresMainPush, true);
});
test('B can advance only the expected A alias', () => {
  const input = fixture({ version: '3.0.1', revision: 'B', message: 'release: v3.0.1', sha: b, main: b });
  assert.throws(() => planRelease(input), /handoff/);
  const plan = planRelease({ ...input, tags: [tag('v3.0.0', a), tag('v3', a)] });
  assert.deepEqual(plan.mutations[2].body, { sha: b, force: true });
});
test('refuses unsupported markers and noncanonical existing releases', () => {
  assert.throws(() => planRelease(fixture({ revision: 'B' })), /version\/marker/);
  assert.throws(() => planRelease(fixture({ tags: [tag('v3.0.0', a)],
    releases: [{ tag_name: 'v3.0.0', draft: true }] })), /published immutable/);
});
