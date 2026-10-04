# pr-note

A small JavaScript Action that posts **Thanks for the pull request!** in response
to a human's new comment on a pull request. This is the producer for GitHub
Universe **TRU1556M**, a **pre-recorded, Steve-narrated, entirely harmless** controls
demo. It is not an actual supply-chain attack or a security certification.

## Action contract

| Interface | Meaning |
| --- | --- |
| `token` input | Required; permission to comment on the consumer PR (`pull-requests: write`). |
| `body` input | Optional; defaults to `Thanks for the pull request!`. |
| `demo-revision` output | `A` initially; later `B`, with the same interface and comment behavior. |
| Log marker | `pr-note demo-revision: A` (later `B`). |

The Action handles only `issue_comment` with action `created`, on a PR, by a
non-bot. Other events and bot comments are explicitly skipped. Malformed PR
events and API errors fail explicitly without dumping credentials or request
details. It never checks out or executes PR code. Each qualifying human comment
posts one note; rerunning a completed Action can post another.

Consumer usage in `Steve-Glass/pr-note-consumer`:

```yaml
name: PR note
on:
  issue_comment:
    types: [created]
permissions:
  pull-requests: write
jobs:
  note:
    if: github.event.issue.pull_request && github.event.comment.user.type != 'Bot'
    runs-on: ubuntu-latest
    steps:
      - uses: Steve-Glass/pr-note@v3
        id: note
        with:
          token: ${{ github.token }}
      - run: printf 'Observed revision %s\n' "$REVISION"
        env:
          REVISION: ${{ steps.note.outputs.demo-revision }}
```

The consumer owns native dependency locking and its independent firewall probe.
This snippet shows only the Action contract, not the consumer's complete controls.
Use a real authenticated human for comment stimuli: a workflow's `GITHUB_TOKEN`
generally does not start another workflow.

## Local setup

Use Node.js 24 and npm (see `.nvmrc`). No remote writes occur during these commands:

```sh
npm ci
npm test
npm run build
npm run check:bundle
```

`src/action.js` implements the behavior; `src/index.js` wires maintained
`@actions/core` and `@actions/github` libraries. `@vercel/ncc` produces the
committed Node 24 runtime under `dist/`, including dependency license notices.
The lockfile fixes dependency versions. `check:bundle` rebuilds in memory and
compares every bundle file byte-for-byte; tests exercise the bundled HTTP client
against a local loopback mock, never GitHub or real credentials.

## Workflow map

| Path | Purpose |
| --- | --- |
| `.github/workflows/lint-defaults.yml` | Harmless `pull_request_target` defaults fixture: protected fork-head checkout, plus an **independent** cache-save probe. |
| `.github/workflows/lint.yml` | Improved `pull_request` CI, ordinary checkout, `contents: read`, installation/tests and bundle check. |
| `.github/workflows/release.yml` | Serialized publishing on designated `main` pushes; `contents: write`, `cache-mode: none`; harmless manual actor-policy check. |
| `demo/before/lint.yml` | **Display only:** the risky checkout-then-execute attack model. Never copy into workflow discovery. |
| `demo/before/release.yml` | **Display only:** cache-enabled original release structure. Not evidence of an exploit. |
| `demo/policies/release-only-steve.json` | Desired repository actor policy; not automatically discovered configuration. |

The defaults checkout job stops after checkout: no `npm ci`, tests, local actions,
or other execution of its result. Greg's earlier attack illustration included
execution commands; this controls-only fixture deliberately does not.
Its cache job uses trusted inline text, an ephemeral hosted runner, and a unique
`universe-tru1556m-default-<run_id>-<attempt>` key. It deliberately leaves
`cache-mode` unspecified. A job may succeed while its save emits a read-only
warning; inspect both the actual warning and the cache listing.

Improved `pull_request` CI uses a PR-scoped cache, not the shared-default-branch
cache scope that produces that read-only warning. Fork-run approvals are an
additional **separate approval gate**, not a permanent ban and not a gate on
`pull_request_target`.

Release keeps legitimate publishing authority while denying cache access.
`cache-mode: none` is a workflow key, not a permission or Action input.
No explicit npm cache is configured, and setup-node automatic caching is disabled
with `package-manager-cache: false`. Removing cache steps alone is not evidence
that the service enforced isolation.

## Release boundary

Only a `push` to `main` whose commit subject is exactly `release: v3.0.0`
(A) or `release: v3.0.1` (B) can publish. Ordinary documentation pushes skip
publishing. Manual `workflow_dispatch` runs only a fixed `printf` job with
`permissions: {}` and cannot publish. The helper independently rejects dispatch
and local application.

`node demo/release.mjs --preview` prints exact tag/release mutations for a clean,
committed candidate. `release.yml` alone calls `--apply`: create the full-version
tag, create release, then advance `v3` after target validation. Reruns resume a
partial same-SHA release or do nothing when complete; conflicting full-version tags,
drafts, unexpected alias values and stale-main attempts fail. Errors are not
hidden. GitHub tag/ruleset restrictions still apply.

Published version `v3.0.0` points to reviewed A,
`a53b99fc9738713d0a1d0dba397606f0f0352a98`. Full-version tags are non-retagged
by this demo's release helper and operating convention. GitHub reports release
`v3.0.0` as `immutable: false`; platform-enforced release immutability is not
enabled or demonstrated. Only `v3` is intentionally movable.

Keep A on the published implementation branch and as an ancestor of B on `main`.
Do not force-push away that history. **B must wait until the consumer confirms it
has locked and successfully run A, AND the user approves the recording mutation.**
B may change only its marker, package version, lockfile root version, and generated
bundle. No behavior, interface, dependencies, or credentials change.

## Setup controls and prerequisites

Run `node demo/preflight.mjs` with authenticated local `gh`; it checks origin,
identity, API access, policies including parents, rulesets, approval setting,
releases/tags, and collaborators. Do not install an admin credential in Actions.

`node demo/settings.mjs` provides preview/apply/readback/restore for exactly two
independent resources: the named release actor policy and the fork approval
setting. Store receipts at an absolute path **outside the checkout**. See
[DEMO.md](DEMO.md) for commands and restore boundaries.

The actor policy is an active repository allowlist containing only the resolved
Steve-Glass User ID `84886334`, targeting **only**
`.github/workflows/release.yml`. It is not a lint event policy or Maintain-role
policy. It controls who triggers release, not what allowed code does. Cache
isolation is independent. A repository allow cannot override a parent deny.
Do not alter unrelated, platform, organization, or enterprise policies.

Read-only discovery on 2026-10-04 found public repositories, Steve-Glass admin
access, Actions enabled, no producer policies returned (including parents), no
rulesets or version tags/releases, and fork approval set to
`first_time_contributors`. Only Steve-Glass was listed as a collaborator.
These are time-bound observations, **not evidence of hosted default enforcement**.

Required before recording: successful supported policy writes/readback, actual
hosted workflow runs, a harmless real fork for the checkout rejection, and a
second otherwise dispatch-eligible identity for policy denial. Do not grant
collaborator access without explicit approval. Missing feature access is a
blocker, never simulated success. Evaluation is Enterprise-only per current
docs; this personal repo helper does not request it. Explicit approved
active/disabled transitions are available; disabled is not evaluation.

## Sources

- [Actions policies](https://docs.github.com/en/actions/concepts/about-actions-policies)
- [Workflow execution protections](https://docs.github.com/en/enterprise-cloud@latest/actions/how-tos/administer/control-workflow-execution)
- [Policies REST API](https://docs.github.com/en/rest/actions/policies)
- [Actions permissions REST API](https://docs.github.com/en/rest/actions/permissions)
- [Repository Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
- [Securely using pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)
- [Read-only cache defaults](https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/)
- [cache-mode](https://github.blog/changelog/2026-09-10-control-github-actions-cache-access-with-cache-mode/)
- Official inputs: [checkout v6](https://github.com/actions/checkout/blob/v6/action.yml),
  [cache/save v5](https://github.com/actions/cache/blob/v5/save/action.yml),
  [setup-node v6](https://github.com/actions/setup-node/blob/v6/action.yml)

These references define the native features. Read them under authorized access;
do not copy inaccessible preview documentation into this repository.
