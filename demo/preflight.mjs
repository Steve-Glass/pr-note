import { api, REPO, verifyOrigin } from './github.mjs';

verifyOrigin();
let failed = false;
for (const [label, endpoint, paginate] of [
  ['Authenticated actor', 'user'],
  ['Resolved release actor', 'users/Steve-Glass'],
  ['Repository and permissions', `repos/${REPO}`],
  ['Execution policies INCLUDING parents', `repos/${REPO}/actions/policies?has_parents=true&per_page=100`, true],
  ['Rulesets INCLUDING parents', `repos/${REPO}/rulesets?includes_parents=true&per_page=100`, true],
  ['Actions allowed', `repos/${REPO}/actions/permissions`],
  ['Default token permissions', `repos/${REPO}/actions/permissions/workflow`],
  ['Fork approval setting', `repos/${REPO}/actions/permissions/fork-pr-contributor-approval`],
  ['Existing tags', `repos/${REPO}/git/matching-refs/tags/`],
  ['Existing releases', `repos/${REPO}/releases?per_page=100`, true],
  ['Eligible collaborators', `repos/${REPO}/collaborators?per_page=100`, true],
]) {
  try {
    const value = api(endpoint, { paginate });
    const compact = label === 'Repository and permissions' ?
      { full_name: value.full_name, visibility: value.visibility, default_branch: value.default_branch, permissions: value.permissions } :
      label === 'Authenticated actor' || label === 'Resolved release actor' ?
        { login: value.login, id: value.id, type: value.type } :
        label === 'Eligible collaborators' ? value.flat().map(({ login, role_name }) => ({ login, role_name })) : value;
    console.log(`${label}:\n${JSON.stringify(compact, null, 2)}`);
  } catch (error) {
    failed = true;
    console.error(`${label}: BLOCKED\n${error.message}`);
  }
}
console.log('Read-only discovery, NOT hosted enforcement evidence. Inspect policy details/insights before rehearsing.');
process.exitCode = failed ? 1 : 0;
