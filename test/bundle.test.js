import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_REVISION } from '../src/action.js';

test('bundled runtime posts the default note using a local mock API only', async t => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pr-note-bundle-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ method: req.method, url: req.url, body: JSON.parse(body) });
    res.writeHead(201, { 'content-type': 'application/json' });
    res.end('{"id":1}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  writeFileSync(path.join(dir, 'event.json'), JSON.stringify({
    action: 'created', issue: { number: 7, pull_request: {} },
    comment: { user: { type: 'User', login: 'human' } },
  }));
  writeFileSync(path.join(dir, 'output'), '');
  const { stdout } = await promisify(execFile)(process.execPath,
    [fileURLToPath(new URL('../dist/index.js', import.meta.url))], {
      timeout: 15000,
      env: {
        PATH: process.env.PATH,
        GITHUB_EVENT_NAME: 'issue_comment', GITHUB_REPOSITORY: 'example/consumer',
        GITHUB_EVENT_PATH: path.join(dir, 'event.json'), GITHUB_OUTPUT: path.join(dir, 'output'),
        GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
        INPUT_TOKEN: 'local-test-token', INPUT_BODY: '',
      },
    });
  assert.deepEqual(requests, [{ method: 'POST', url: '/repos/example/consumer/issues/7/comments',
    body: { body: 'Thanks for the pull request!' } }]);
  assert.match(stdout, new RegExp(`pr-note demo-revision: ${DEMO_REVISION}`));
  assert.match(readFileSync(path.join(dir, 'output'), 'utf8'), new RegExp(`demo-revision<<[^\\n]+\\n${DEMO_REVISION}\\n`));
});
