# Demo recording runbook

Record separate clips using harmless inputs; do not perform an actual attack.
Repository code illustrates the setup. Claim hosted control behavior only
when real run logs or annotations demonstrate it.

Full-version tags are non-retagged by the demo's release helper and operating
convention, not by platform-enforced release immutability. Published `v3.0.0`
points to reviewed A, `a53b99fc9738713d0a1d0dba397606f0f0352a98`, and its
release API reports `immutable: false`. Only `v3` is intentionally movable.

## Current checkpoints

| Checkpoint | Status and evidence |
| --- | --- |
| Local Action A, bundle, workflow invariants and helper guards | Verified locally; see `npm test` and `npm run check:bundle`. No real comment posted. |
| Official checkout fork safety implementation | Source verified at v6 commit `d23441a48e516b6c34aea4fa41551a30e30af803`: `input-helper.ts` calls `assertSafePrCheckout` in `unsafe-pr-checkout-helper.ts`. Native rejection not rehearsed. |
| Official cache save inputs | Verified `actions/cache/save@v5`, commit `caa296126883cff596d87d8935842f9db880ef25`, inputs `path`/`key`, Node 24. Hosted default warning not rehearsed. |
| Policy/approval configuration | GET discovery verified; local preview implemented. POST/PUT and Policy insights not rehearsed; separate approval required. |
| Checkout/default-cache recording | Blocked pending authorized main publication, permitted effective trigger, and a harmless real fork. |
| Actor-policy denial | Blocked: only Steve-Glass is currently an eligible collaborator. No test access has been granted. |
| A release and consumer handoff | Implemented, not published. Need separate approval to advance main/create tags and release. |
| B release | Blocked until consumer locks and successfully runs published A AND user approves B. |
| Release cache isolation | Configuration implemented; no claim of an observed cache-read denial. |

Recheck official action tags before recording. Never use an unsafe-checkout
opt-out. No platform defaults or annotations have been verified by a hosted run
at this handoff; do not substitute unit tests, a same-repo PR, or dispatch.

## Off-camera checklist and mutation preview

Use Node 24, local authenticated `gh`, and a private receipt directory outside
the checkout. Substitute an explicit absolute path for `STATE`:

```sh
export STATE=/absolute/path/outside/checkout/pr-note-demo
node demo/preflight.mjs
npm ci && npm test && npm run check:bundle
node demo/settings.mjs policy preview "$STATE/policy.json"
node demo/settings.mjs approval preview "$STATE/approval.json"
node demo/release.mjs --preview
```

Previews issue GETs only, save exact prior state locally, and print mutations.
Inspect **all** inherited/current policy details and Rules/Actions settings.
The default public `pull_request_target` policy has a date-dependent rollout:
on discovery, the API returned zero policies; this does not establish how the
next run will be treated. If a parent/platform policy blocks the fixture, stop
and report that blocker. Do not weaken it or create an event allowlist.

The concrete setup preview is:

| Resource | Approved mutation would do |
| --- | --- |
| Producer code on `main` | Fast-forward reviewed A commit to main; its `release: v3.0.0` subject triggers release publishing. Session-branch push alone does not publish. |
| A publication | POST `git/refs` for full-version tag `refs/tags/v3.0.0` at A; `gh release create v3.0.0 --verify-tag`; POST `git/refs` for `refs/tags/v3` at A. |
| Release policy | POST `/repos/Steve-Glass/pr-note/actions/policies` with the exact body in `demo/policies/release-only-steve.json`; no other policies changed. |
| Fork approval | PUT `/repos/Steve-Glass/pr-note/actions/permissions/fork-pr-contributor-approval` with `{"approval_policy":"all_external_contributors"}`; prior value observed: `first_time_contributors`. |
| Harmless rehearsals | Separately approve real fork/PR/comment creation and release dispatches. No grants, events, or forks are produced by setup/tests. |

All API calls use `X-GitHub-Api-Version: 2026-03-10`. API schema and admin reads
are available; an actual write may still fail due to permissions/feature access.
Surface its exact error and stop, without claiming configuration succeeded.

**Only after approval of each displayed mutation:**

```sh
node demo/settings.mjs policy apply "$STATE/policy.json"
node demo/settings.mjs approval apply "$STATE/approval.json"
# After explicit main/release approval, from the clean reviewed A checkout:
git push origin HEAD:refs/heads/main
# A release workflow runs automatically; wait for its actual result.
gh run list --repo Steve-Glass/pr-note --workflow release.yml --limit 5
```

Do not rerun the main push to manufacture evidence. A policy denial means no
jobs ran; it is not evidence of checkout/cache protections.

The settings helper refuses duplicate/foreign name matches, identity mismatch,
changed rules/targets, concurrent state changes, and uncertain write retries.
It saves the prior state, returned policy ID, and readback outside Git. Restore
only that transaction:

```sh
node demo/settings.mjs approval restore-preview "$STATE/approval.json"
node demo/settings.mjs policy restore-preview "$STATE/policy.json"
# Review these previews and obtain reset approval before applying:
node demo/settings.mjs approval restore "$STATE/approval.json"
node demo/settings.mjs policy restore "$STATE/policy.json"
```

A newly created demo policy is deleted on restore; a pre-existing matching policy
is restored to its original fields/enforcement. Unrelated/inherited policies
are never changed. For an approved active/disabled rehearsal of an existing
demo policy, use `policy preview-disabled "$STATE/disabled.json"`, then `apply`,
then `restore-preview`/`restore` with that same separate receipt. This is **not**
evaluation. Do not reuse a stale outer receipt after another transaction has
updated the policy: inspect and reconcile it rather than bypassing the guard.
No `evaluate` path is implemented because this account's entitlement is unproven.

These APIs do not document atomic compare-and-swap. The helper compares complete
snapshots immediately before mutation and reads back afterward, but cannot
eliminate a simultaneous administrator write during the request. Use one setup
operator and no concurrent policy/tag editors. If a request fails after submission,
the `mutation-pending` receipt is intentionally not retried; reconcile its saved
response/ID against GET results first.

### Settings-only fork approval highlight

The supported API above exists. UI equivalent (and fallback if that API is
unavailable): open `Steve-Glass/pr-note` > **Settings > Actions > General** >
**Approval for running fork pull request workflows from contributors**. Record
the original selection, select **Require approval for all external contributors**,
and **Save**, only after approval. Reopen to verify; restore the original
selection to reset. Do not change adjacent token, fork-secret, or Actions-allow
settings. Record the setting only: **no recorded fork creation, awaiting-approval
screen, or approve-and-run flow**. This gate does not apply to `pull_request_target`.

## Clip 1: establish the model and benign A

**Initial state:** reviewed A code and display-only `demo/before` snapshots;
published A only after authorization.
**Action / screen:** show the simple Action, its default note, and the original
lint/release files outside `.github/workflows`. Show A's consumer output if ready.
**Narration:** "I'm using a harmless thank-you Action. These original files
illustrate a trust-boundary mistake; I am not performing an attack."
**Expected:** `demo-revision: A` with the unchanged thank-you comment.
**Observed evidence:** local behavior verified; actual release and consumer run
links pending. **Reset:** retain A's branch and full-version tag; never overwrite A.

## Clip 2: two independent secure defaults

**Initial state:** `lint-defaults.yml` on main; effective policy allows the
trigger; a harmless real fork contribution prepared **off camera** with approval.
It need only change a text file; never add or execute a payload.
**Action / screen:** show the real fork run's checkout failure annotation and
the independent cache-save warning, even if the overall run failed.
**Narration:** "Checkout refuses the fork's code in this trusted context. A
separate job also cannot save to the shared cache under the default policy."
**Expected:** actual `Refusing to check out fork pull request code...` error;
actual read-only cache warning and zero entries for the exact unique key.
**Observed evidence:** not rehearsed; retain run URL, annotation, warning text,
job conclusions and cache listing. No fork identity/namespace has been selected.
**Reset:** use a new run/attempt key for another approved harmless event; close
only the demo PR after approved cleanup. Never grant cache writes.

Read-only capture, substituting the actual run ID and attempt:

```sh
gh run view RUN_ID --repo Steve-Glass/pr-note --log
gh api --paginate \
  'repos/Steve-Glass/pr-note/actions/caches?key=universe-tru1556m-default-RUN_ID-ATTEMPT&per_page=100'
```

A successful cache job is not proof of a save. Zero entries without the relevant
warning is also insufficient. If execution policy denies the run, **neither**
job proves its protection; resolve the prerequisite without weakening protections.

## Clip 3: improved lint and the separate approval setting

**Initial state:** ordinary `lint.yml` and an approved harmless PR rehearsal.
**Action / screen:** compare `demo/before/lint.yml` to `.github/workflows/lint.yml`;
show a real successful lint run. Then show only the approval setting above.
**Narration:** "I use ordinary pull-request CI with read-only contents. External
fork workflows have an additional approval gate; that is a separate setting."
**Expected:** ordinary checkout and successful install/tests; no claim of the
shared-default-cache warning on this PR-scoped run.
**Observed evidence:** not rehearsed; save lint URL and settings readback.
**Reset:** close the approved demo PR; restore the setting only if approved.

## Clip 4: release actor allowlist

**Initial state:** active Steve-Glass-only policy targeting `release.yml`; a
second **otherwise dispatch-eligible** identity arranged with explicit approval.
**Action / screen:** show policy path and sole User, then real denied/allowed
manual checks and Policy insights where available.
**Narration:** "This policy allows only me to trigger this release workflow.
It doesn't determine what code does after an allowed trigger."
**Expected:** the allowed account's fixed harmless check runs; the eligible second actor is
denied by this policy, with no publishing in either dispatch.
**Observed evidence:** blocked by missing second identity; basic access denial
from an outsider is not policy evidence. Do not grant access automatically.
**Reset:** restore only the demo policy from the reviewed receipt if approved.

After stimulus approval, each identity uses its own authenticated session:

```sh
gh workflow run release.yml --repo Steve-Glass/pr-note --ref main
```

Record actor eligibility as well as the actual policy denial, not merely a failed
dispatch response. A successful denied-actor baseline under an explicitly approved
disabled demo policy can establish eligibility; disabled is not evaluation.
Do not weaken any parent policy for that baseline.

## Clip 5: release cache isolation

**Initial state:** release workflow on main with `contents: write`,
`cache-mode: none`, no explicit/automatic npm caching.
**Action / screen:** compare `demo/before/release.yml` with release.yml; show the
successful authorized release's setup/publish logs.
**Narration:** "Publishing still needs write permission. I separately remove all
cache access, including restores, from this release workflow."
**Expected:** publishing succeeds without service cache restores/saves.
**Observed evidence:** configuration implemented; hosted publishing not rehearsed.
Do not call absence of a cache step a measured service denial.
**Reset:** no extra cache data exists from this path; do not delete version tags.

If an actual cache-read denial clip is wanted, obtain separate approval for an
isolated probe workflow, a known benign entry and a successful positive restore
control in the same branch scope, followed by restore under `cache-mode: none`.
Keep that scaffolding outside the main release view. It is not implemented or
claimed as measured here; a cold-cache miss is not proof of isolation.

## Clip 6: reviewed A handoff; stop before B

**Initial state:** successful authorized A release and consumer onboarding.
**Action / screen:** record published version `v3.0.0`, mutable `v3`, reachable A branch,
producer run, and consumer's native lock plus successful A run.
**Narration:** "Both tags resolve to A. The consumer locks this exact commit
and has successfully executed it."
**Expected:** one full A SHA across tag resolutions and consumer lock; marker A.
**Observed evidence:** not yet available; coordinator must receive the real SHA,
tag/ref readbacks, producer run URL and consumer run URL before B.
**Reset:** preserve A history and tags. Never substitute a made-up SHA or lockfile.

```sh
gh api repos/Steve-Glass/pr-note/git/ref/tags/v3.0.0
gh api repos/Steve-Glass/pr-note/git/ref/tags/v3
gh run list --repo Steve-Glass/pr-note --workflow release.yml --limit 5
```

## Clip 7: benign B moves the alias; consumer stays on A

**Initial state:** consumer confirms locked/successful A AND user approves B.
**Action / screen:** on an A-descendant producer branch, change only
`DEMO_REVISION = 'A'` to `'B'`; run `npm version 3.0.1 --no-git-tag-version`,
`npm run build`, `npm test`, and `npm run check:bundle`. Review the diff, commit
with subject `release: v3.0.1`, preview via `node demo/release.mjs --preview`,
then publish to main only within that approval. Record `v3` resolving to B
while the consumer still executes A, then its separate firewall probe.
**Narration:** "I moved the alias to a second benign version. The lock keeps
the consumer on A; its separate firewall check demonstrates containment without
sending credentials."
**Expected:** full-version tag `v3.0.0` remains A; `v3.0.1` and `v3` resolve to B;
consumer's locked run still logs A.
**Observed evidence:** blocked until the two explicit gates above; do not publish B now.
**Reset:** keep both versions branch-reachable. Never retag full-version tags;
any deliberate alias reset needs its own reviewed approval and readback.
