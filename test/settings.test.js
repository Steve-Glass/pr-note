import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { settings, ownPolicy } from '../demo/settings.mjs';

const desired = JSON.parse(readFileSync(new URL('../demo/policies/release-only-steve.json', import.meta.url)));
const copy = value => structuredClone(value);
const savedPolicy = (enforcement = 'active') => ({
  ...copy(desired), enforcement, id: 31, source_type: 'Repository',
  source: 'Steve-Glass/pr-note', updated_at: '2026-10-04T00:00:00Z',
});

function fixture(t, policies = []) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pr-note-settings-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const remote = { policies: copy(policies), approval: { approval_policy: 'first_time_contributors' }, writes: [] };
  const request = async (endpoint, options = {}) => {
    if (options.method && options.method !== 'GET') {
      remote.writes.push({ endpoint, ...options });
      if (remote.fail) throw new Error('HTTP 403: unavailable');
      if (endpoint.includes('fork-pr-contributor-approval')) remote.approval = copy(options.body);
      else if (options.method === 'POST') {
        const created = { ...copy(options.body), id: 31, source_type: 'Repository', source: 'Steve-Glass/pr-note' };
        remote.policies.push(created);
        return copy(created);
      } else if (options.method === 'DELETE') {
        remote.policies = remote.policies.filter(p => !endpoint.endsWith(`/${p.id}`));
      } else {
        const item = remote.policies.find(p => endpoint.endsWith(`/${p.id}`));
        Object.assign(item, copy(options.body));
        return copy(item);
      }
      return null;
    }
    if (endpoint === 'users/Steve-Glass') return { login: 'Steve-Glass', type: 'User', id: 84886334 };
    if (endpoint === 'repos/Steve-Glass/pr-note') return { full_name: 'Steve-Glass/pr-note', permissions: { admin: true } };
    if (endpoint.includes('fork-pr-contributor-approval')) return copy(remote.approval);
    if (endpoint.includes('?has_parents')) {
      assert.equal(options.paginate, true);
      return [{ total_count: remote.policies.length, policies: copy(remote.policies.slice(0, 1)) },
        { total_count: remote.policies.length, policies: copy(remote.policies.slice(1)) }];
    }
    return copy(remote.policies.find(p => endpoint.endsWith(`/${p.id}`)));
  };
  const file = path.join(dir, 'state.json');
  return { remote, request, file, run: (kind, op) => settings(kind, op, file, request) };
}

test('policy preview is read-only; apply/readback/restore are scoped and idempotent', async t => {
  const parent = { ...savedPolicy(), id: 50, name: 'unrelated parent', source_type: 'Organization', source: 'example' };
  const f = fixture(t, [parent]);
  const preview = await f.run('policy', 'preview');
  assert.equal(f.remote.writes.length, 0);
  assert.deepEqual(preview.mutation.body, desired);
  assert.equal(preview.inheritedAndCurrent.length, 1);
  await f.run('policy', 'preview');
  const result = await f.run('policy', 'apply');
  assert.equal(result.policyId, 31);
  await f.run('policy', 'apply');
  assert.equal(f.remote.writes.length, 1);
  await f.run('policy', 'restore-preview');
  assert.equal(f.remote.writes.length, 1);
  await f.run('policy', 'restore');
  await f.run('policy', 'restore');
  assert.equal(f.remote.writes.length, 2);
  assert.equal(f.remote.writes[1].method, 'DELETE');
  assert.deepEqual(f.remote.policies, [parent]);
  assert.equal(JSON.parse(readFileSync(f.file)).status, 'restored');
});

test('restores existing disabled demo policy rather than deleting it', async t => {
  const f = fixture(t, [savedPolicy('disabled')]);
  await f.run('policy', 'preview');
  await f.run('policy', 'apply');
  assert.equal(f.remote.policies[0].enforcement, 'active');
  await f.run('policy', 'restore');
  assert.equal(f.remote.policies[0].enforcement, 'disabled');
  assert.deepEqual(f.remote.writes.map(w => w.method), ['PUT', 'PUT']);
});

test('explicit disabled rehearsal is distinct from evaluation and restores active', async t => {
  const f = fixture(t, [savedPolicy()]);
  assert.equal((await f.run('policy', 'preview-disabled')).mutation.body.enforcement, 'disabled');
  assert.equal(f.remote.writes.length, 0);
  await f.run('policy', 'apply');
  assert.equal(f.remote.policies[0].enforcement, 'disabled');
  await f.run('policy', 'restore');
  assert.equal(f.remote.policies[0].enforcement, 'active');
});

test('identical existing configuration creates no duplicate or remote writes', async t => {
  const f = fixture(t, [savedPolicy()]);
  assert.equal((await f.run('policy', 'preview')).mutation, null);
  await f.run('policy', 'apply');
  await f.run('policy', 'restore');
  assert.equal(f.remote.writes.length, 0);
});

test('refuses ambiguous, inherited, and different-rule policies', () => {
  assert.throws(() => ownPolicy([savedPolicy(), savedPolicy()]), /Ambiguous/);
  assert.throws(() => ownPolicy([{ ...savedPolicy(), source_type: 'Enterprise' }]), /inherited/);
  assert.throws(() => ownPolicy([{ ...savedPolicy(), rules: [] }]), /different rules/);
});

test('concurrent policy changes are not overwritten', async t => {
  const f = fixture(t, [savedPolicy('disabled')]);
  await f.run('policy', 'preview');
  f.remote.policies[0].updated_at = '2026-10-05T00:00:00Z';
  await assert.rejects(f.run('policy', 'apply'), /Remote state changed/);
  assert.equal(f.remote.writes.length, 0);
});

test('concurrent changes prevent restore', async t => {
  const f = fixture(t);
  await f.run('policy', 'preview');
  await f.run('policy', 'apply');
  f.remote.policies[0].enforcement = 'disabled';
  await assert.rejects(f.run('policy', 'restore'), /Remote state changed/);
  assert.equal(f.remote.writes.length, 1);
});

test('remote failure retains recovery state and prevents blind retry', async t => {
  const f = fixture(t);
  await f.run('policy', 'preview');
  f.remote.fail = true;
  await assert.rejects(f.run('policy', 'apply'), /HTTP 403/);
  assert.equal(JSON.parse(readFileSync(f.file)).status, 'mutation-pending');
  await assert.rejects(f.run('policy', 'apply'), /Incomplete/);
  assert.equal(f.remote.writes.length, 1);
});

test('fork approval setting has independent preview/apply/readback/restore', async t => {
  const f = fixture(t);
  await f.run('approval', 'preview');
  assert.equal(f.remote.writes.length, 0);
  await f.run('approval', 'apply');
  await f.run('approval', 'apply');
  assert.equal(f.remote.approval.approval_policy, 'all_external_contributors');
  await f.run('approval', 'restore-preview');
  await f.run('approval', 'restore');
  assert.equal(f.remote.approval.approval_policy, 'first_time_contributors');
  assert.equal(f.remote.writes.length, 2);
});

test('does not assume evaluation support or allow apply without preview', async t => {
  const f = fixture(t);
  await assert.rejects(f.run('policy', 'evaluate'), /Usage/);
  await assert.rejects(f.run('policy', 'apply'), /Preview first/);
  assert.equal(f.remote.writes.length, 0);
});
