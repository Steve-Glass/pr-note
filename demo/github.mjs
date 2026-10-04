import { execFileSync } from 'node:child_process';

export const REPO = 'Steve-Glass/pr-note';
export const API_VERSION = '2026-03-10';

export function gh(args, input) {
  try {
    return execFileSync('gh', args, {
      input: input === undefined ? undefined : JSON.stringify(input),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new Error(`gh ${args.join(' ')} failed:\n${error.stderr?.toString() || error.message}`);
  }
}

export function api(endpoint, { method = 'GET', body, paginate = false } = {}) {
  const args = ['api', '--method', method, '-H', 'Accept: application/vnd.github+json',
    '-H', `X-GitHub-Api-Version: ${API_VERSION}`, endpoint];
  if (paginate) args.push('--paginate', '--slurp');
  if (body !== undefined) args.push('--input', '-');
  const output = gh(args, body);
  return output ? JSON.parse(output) : null;
}

export function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function verifyOrigin() {
  const origin = git('remote', 'get-url', 'origin');
  if (!['https://github.com/Steve-Glass/pr-note.git', 'https://github.com/Steve-Glass/pr-note',
    'git@github.com:Steve-Glass/pr-note.git'].includes(origin)) {
    throw new Error(`Unexpected origin: ${origin}`);
  }
}
