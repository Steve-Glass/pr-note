# pr-note

Test note

A small JavaScript Action that posts **Thanks for the pull request!** in response
to a human's new comment on a pull request. This repository is the producer
for a harmless GitHub Actions controls demo, not an actual supply-chain attack
or a security certification.

## Action contract

| Interface | Meaning |
| --- | --- |
| `token` input | Required; permission to comment on the consumer PR (`pull-requests: write`). |
| `body` input | Optional; defaults to `Thanks for the pull request!`. |
| `demo-revision` output | `A` in `v3.0.0`, `B` in `v3.0.1`, with the same interface and comment behavior. |
| Log marker | `pr-note demo-revision: A` or `pr-note demo-revision: B`. |

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

The consumer owns CLI dependency locking and its independent external firewall
check. This snippet shows only the Action contract, not the consumer's complete
controls. The hosted lock-enforcement mismatch is tracked in
[Steve-Glass/pr-note-consumer#2](https://github.com/Steve-Glass/pr-note-consumer/issues/2);
do not treat CLI validation alone as proof that a hosted run used the locked SHA.
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
| `.github/workflows/lint-defaults.yml` | Primary **after**: the same `pull_request_target` trigger and explicit fork-head checkout, with implicit checkout/cache protections. No fork-code execution. |
| `.github/workflows/lint.yml` | Optional **migration example**: this lint needs no secrets or elevated authority, so it uses `pull_request`, ordinary checkout, and `contents: read`. |
| `.github/workflows/release.yml` | Serialized publishing on designated `main` pushes with `contents: write`; original `cache: npm` retained, `cache-mode: none` added. |
| `demo/before/lint.yml` | **Display only:** the risky checkout-then-execute attack model. Never copy into workflow discovery. |
| `demo/before/release.yml` | **Display only:** cache-enabled original release structure. Not evidence of an exploit. |
| `demo/policies/release-only-steve.json` | Desired repository actor policy; not automatically discovered configuration. |

## Demo flow

1. **Original attack model.** The display-only snapshots illustrate fork code
   executing in a trusted workflow and a later release consuming shared cache.
   They are not an exploit or a claim that checkout alone executes code.
2. **Secure defaults on the same lint configuration.** Keep
   `pull_request_target` and `ref: ${{ github.event.pull_request.head.sha }}` in
   view. Current checkout refuses the fork-head checkout in that context.
   The harmless fixture deliberately omits the original execution step.
   An independent job attempts to save trusted text under the default
   read-only cache scope; it has no `needs` dependency and no `cache-mode`
   override. This is not a downstream step continuing after failed checkout.
3. **Default workflow execution protection (WEP).** The platform's event policy
   can stop `pull_request_target` before either job starts. This is distinct
   from the explicit release actor policy below. See the date/scope caveat below.
   Briefly show `lint.yml` only as optional migration guidance for this lint.
4. **Explicit release actor policy.** Only Steve-Glass may trigger
   `.github/workflows/release.yml`. This is an account allowlist for one workflow,
   not the default event policy and not a claim about what allowed code does.
   Show Actions policies and Policy insights for enforcement and denial evidence;
   no in-workflow policy-check job is needed.
5. **Release cache isolation.** Keep `actions/setup-node@v6`, `node-version: 24`,
   and `cache: npm` from the original. The only release-cache configuration
   change is workflow-level `cache-mode: none`; keep `contents: write`.
6. **Consumer controls.** Show CLI locking, then the independent external
   firewall check. Report their outcomes separately, including the open hosted
   lock mismatch; neither control proves the other.

The defaults fixture never runs `npm ci`, tests, or local actions against the
checkout result. Its independent cache job uses only trusted inline text on an
ephemeral hosted runner. The existing `universe-tru1556m-default-<run_id>-<attempt>`
key is a technical identifier retained for evidence lookup. A successful job is
not proof of a saved cache: inspect the warning and exact-key listing.

`pull_request` is suitable for this migration because the lint does not need
secrets or elevated authority. It is **not a universal isolation boundary**:
untrusted code still runs, and persistent self-hosted runners can retain changes
or expose resources beyond the workflow token. This example uses ephemeral
GitHub-hosted runners. PR-scoped caching also differs from the shared-default-
branch cache used by the `pull_request_target` fixture.

### Default event policy: scope and timing

The [current documentation](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target#default-policy-for-pull_request_target),
checked on **October 6, 2026**, describes a default policy for **public**
repositories without an applicable existing Actions **event** policy. It does
not cover private/internal repositories or replace an applicable event policy.
It currently runs in **evaluate** mode, with enforcement scheduled for
**November 2, 2026** for affected repositories that were using that default
`pull_request_target` policy before general availability. This is not a claim
that every public repository is blocked today.

Inspect the effective policies and Policy insights before recording. Today's
repository API listing returned only the explicit release **actor** policy,
not a default event policy or an observed `pull_request_target` denial. An actor
policy is not an applicable event policy. Do not change policies to stage a
denial or call evaluation an enforced block. When a run is blocked before jobs
start, it cannot also provide checkout/cache-step evidence.

### Measured release-cache behavior

[The non-publishing rehearsal](https://github.com/Steve-Glass/pr-note/actions/runs/37483252644)
on October 6 used Node 24, `cache: npm`, and `cache-mode: none`.
Setup-node emitted an HTTP 403 **`cache read denied: token has no readable scopes`**
warning; its post step emitted **`cache write denied: token has no writable scopes`**.
Dependency installation continued successfully, and the publishing job was skipped.
The cache inventory was empty before and after, including the exact attempted key.

This was an actual service-denial response, not an inferred miss or a synthetic
warning. It did not seed a known cache entry or perform a positive restore
control. The temporary rehearsal steps, no-op policy-check job, and manual
trigger have been removed. The historical run remains evidence for this
combination. No failure suppression was added.
The earlier A/B release runs disabled npm caching and do not validate this new
combination. See [DEMO.md](DEMO.md) for precise evidence and recording highlights.

## Release boundary

Only a `push` to `main` whose commit subject is exactly `release: v3.0.0`
(A) or `release: v3.0.1` (B) can publish. Ordinary documentation pushes skip
publishing. There is no manual trigger or no-op policy-check job. Actions policies
enforce actor restrictions before jobs start; Policy insights provides denial
evidence. The helper independently rejects non-push and local application.

`node demo/release.mjs --preview` prints exact tag/release mutations for a clean,
committed candidate. `release.yml` alone calls `--apply`: create the full-version
tag, create release, then advance `v3` after target validation. Reruns resume a
partial same-SHA release or do nothing when complete; conflicting full-version tags,
drafts, unexpected alias values and stale-main attempts fail. Errors are not
hidden. GitHub tag/ruleset restrictions still apply.

Published `v3.0.0` is reviewed A (`a53b99fc9738713d0a1d0dba397606f0f0352a98`);
`v3.0.1` and `v3` point to benign B (`47713a3d521b26f4fa13e43fb64b0687c7603980`).
B changed only the marker, package version, lockfile root version, and generated
bundle. Both commits remain branch-reachable; do not force-push away that history.

Full-version tags are non-retagged by the helper and operating convention.
Both releases report `immutable: false`; platform-enforced release immutability
is not enabled or demonstrated. Only `v3` is intentionally movable, and any new
alias change, release, or replay needs separate approval. Documentation/workflow
maintenance must not retag A/B or use a `release:` commit subject.

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

The explicit repository policy is active as
[policy 6432](https://github.com/Steve-Glass/pr-note/settings/actions/rules/6432);
its exact target and sole allowed actor were read back on October 6.
Real fork checkout/default-cache evidence and denial by an otherwise
eligible second actor remain unrehearsed. Do not grant access, create
forks, or change policies without approval. A missing prerequisite is a gap,
not simulated success. The helper does not request Enterprise-only evaluation;
its explicit active/disabled transitions are separate from the platform's
default-policy rollout. Disabled is not evaluation.

The existing `all_external_contributors` fork-run approval setting is
**secondary background**, not a core recording beat. Leave it unchanged.
It is an approval gate, not a permanent ban, and does not gate
`pull_request_target`. The setup/restore helper remains available for separately
approved administration; no approval-flow walkthrough is part of this demo.

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
