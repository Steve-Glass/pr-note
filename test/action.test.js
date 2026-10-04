import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, DEFAULT_BODY, DEMO_REVISION } from '../src/action.js';

function fixture({ body = '', error } = {}) {
  const calls = { posts: [], logs: [], failures: [], outputs: [], secrets: [] };
  const context = {
    eventName: 'issue_comment',
    repo: { owner: 'example', repo: 'consumer' },
    payload: {
      action: 'created',
      issue: { number: 12, pull_request: { url: 'https://api.github.com/repos/example/consumer/pulls/12' } },
      comment: { user: { login: 'human', type: 'User' } },
    },
  };
  const core = {
    getInput: name => name === 'token' ? 'test-token-not-a-secret' : body,
    setSecret: value => calls.secrets.push(value),
    setOutput: (...args) => calls.outputs.push(args),
    info: message => calls.logs.push(message),
    setFailed: message => calls.failures.push(message),
  };
  return {
    calls, context, core,
    getOctokit: token => {
      assert.equal(token, 'test-token-not-a-secret');
      return { rest: { issues: { createComment: async parameters => {
        if (error) throw error;
        calls.posts.push(parameters);
      } } } };
    },
  };
}

test('posts supplied body to the event PR, masks token, and exposes marker', async () => {
  const f = fixture({ body: 'A harmless note.' });
  await run(f);
  assert.deepEqual(f.calls.posts, [{ owner: 'example', repo: 'consumer', issue_number: 12, body: 'A harmless note.' }]);
  assert.deepEqual(f.calls.outputs, [['demo-revision', DEMO_REVISION]]);
  assert.ok(f.calls.logs.includes(`pr-note demo-revision: ${DEMO_REVISION}`));
  assert.deepEqual(f.calls.secrets, ['test-token-not-a-secret']);
  assert.deepEqual(f.calls.failures, []);
});

test('uses default body', async () => {
  const f = fixture();
  await run(f);
  assert.equal(f.calls.posts[0].body, DEFAULT_BODY);
});

for (const [name, change] of [
  ['bot user', f => { f.context.payload.comment.user.type = 'Bot'; }],
  ['bot login', f => { f.context.payload.comment.user.login = 'app[bot]'; }],
  ['bot sender', f => { f.context.payload.sender = { type: 'Bot' }; }],
  ['ordinary issue', f => { delete f.context.payload.issue.pull_request; }],
  ['different event', f => { f.context.eventName = 'push'; }],
  ['edited comment', f => { f.context.payload.action = 'edited'; }],
]) {
  test(`skips ${name} without reading credentials or calling API`, async () => {
    const f = fixture();
    change(f);
    f.core.getInput = () => assert.fail('Must not read inputs for skipped event');
    await run(f);
    assert.equal(f.calls.posts.length, 0);
    assert.equal(f.calls.failures.length, 0);
    assert.ok(f.calls.logs.some(log => log.startsWith('Skipping')));
  });
}

test('rejects malformed PR event explicitly', async () => {
  const f = fixture();
  f.context.payload.issue.number = '12';
  await run(f);
  assert.equal(f.calls.posts.length, 0);
  assert.deepEqual(f.calls.failures, ['Malformed pull request comment event.']);
});

test('API failure reports status without credentials, headers, or body', async () => {
  const f = fixture({ error: Object.assign(new Error('token private-header private-body'), { status: 403 }) });
  await run(f);
  assert.match(f.calls.failures[0], /HTTP 403/);
  assert.doesNotMatch(f.calls.failures[0], /private-|test-token/);
});

test('missing token fails without exposing input details', async () => {
  const f = fixture();
  f.core.getInput = () => { throw new Error('Input required and not supplied: token'); };
  await run(f);
  assert.equal(f.calls.posts.length, 0);
  assert.match(f.calls.failures[0], /Unable to post/);
});
