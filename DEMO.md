# Demo recording runbook

One original model, shown through separate checkpoints. Use harmless inputs and
record only measured outcomes as enforcement. A job blocked at one checkpoint
does not execute later checkpoints; use separate clips, not staged continuation.

## Current evidence

| Checkpoint | Observed state as of October 6, 2026 |
| --- | --- |
| Published Action | `v3.0.0` = A, `a53b99fc9738713d0a1d0dba397606f0f0352a98`; `v3.0.1` and `v3` = B, `47713a3d521b26f4fa13e43fb64b0687c7603980`. Both remain branch-reachable. |
| Checkout and read-only cache defaults | Fixture implemented; actual fork rejection and default-cache warning not yet captured. |
| Default event WEP | Current docs describe evaluate/scheduled enforcement; repository API listing returned only the explicit release actor policy. No default-event denial observed. |
| Explicit release actor WEP | [Policy 6432](https://github.com/Steve-Glass/pr-note/settings/actions/rules/6432) read back active, release-only, sole User `84886334`. Allowed runs observed; no otherwise-eligible second-actor denial. |
| Release cache isolation | [Run 37483252644](https://github.com/Steve-Glass/pr-note/actions/runs/37483252644): real read/write denial warnings with `cache: npm` and `cache-mode: none`; installation succeeded; publishing skipped. |
| Consumer locking | Hosted enforcement mismatch remains open in [Steve-Glass/pr-note-consumer#2](https://github.com/Steve-Glass/pr-note-consumer/issues/2). Further native lock replay is paused. |

Full-version tags are non-retagged by the release helper and operating convention.
Both published releases report `immutable: false`; this is not platform-enforced
release immutability. Do not move tags or recreate releases to repeat a clip.

## Minimal screen sequence

Keep the important lines visible; avoid scrolling through setup scripts while
explaining a control.

| Beat | Screen / lines to highlight |
| --- | --- |
| 1. Original model | `demo/before/lint.yml`: `pull_request_target`, explicit head `ref`, then the execution command. `demo/before/release.yml`: `cache: npm` and publishing authority. |
| 2. Same configuration, secure defaults | `.github/workflows/lint-defaults.yml`: the **same trigger/ref**, then real checkout rejection. Separately show the independent cache job and its default-mode warning. |
| 3. Default event WEP | Default policy's scope, **actual enforcement state**, `pull_request_target` restriction, and Policy insights if present. Brief optional inset: migration `lint.yml`. |
| 4. Explicit actor WEP | Policy 6432: **active**, sole User **Steve-Glass / 84886334**, workflow include **`.github/workflows/release.yml`**, empty excludes. |
| 5. Release cache mode | `.github/workflows/release.yml`: **`cache-mode: none`**; keep `contents: write` and setup-node's original Node 24 / `cache: npm` visible. Then setup/post warnings from the measured run. |
| 6. Consumer CLI lock | Consumer's official CLI-generated lock and requested-versus-executed SHA evidence. Show the open mismatch instead of claiming success. |
| 7. Independent external firewall | Consumer's separate network restriction and its own result, not a claimed consequence of locking. |

## 1. Original attack model

**Initial state:** display-only `demo/before` files; simple thank-you Action.
**Action:** show the two original snapshots, not executable copies of the model.
**Point:** executing fork-controlled code in a trusted context can affect later
workflows through shared state. Checkout alone is not execution; the following
build/test command completes that risk. These files illustrate a model, not an exploit.
**Evidence:** published [A](https://github.com/Steve-Glass/pr-note/releases/tag/v3.0.0)
and [B](https://github.com/Steve-Glass/pr-note/releases/tag/v3.0.1) are both benign.
**Reset:** leave both versions and their history intact.

## 2. Same lint configuration, implicit secure defaults

**Initial state:** the effective policy permits the fixture's trigger; a real,
harmless fork PR is prepared off camera only with separate approval.
**Action:** compare the trigger and checkout in `demo/before/lint.yml` with
`lint-defaults.yml`: both retain `pull_request_target`, `permissions: {}`,
`actions/checkout@v6`, the explicit PR-head SHA, and `persist-credentials: false`.
The fixture stops after checkout; it deliberately removes the original
execution command, not the recognizable trigger/ref configuration.
**Point:** the first after-state is protection on that same context, **not**
migration to `pull_request`.
**Expected evidence:** actual `Refusing to check out fork pull request code...`
annotation, then the independent cache job's actual read-only warning and
exact-key cache listing. Current checkout source contains the fork safety check;
source inspection is not a hosted rejection.

The independent job creates only trusted disposable text. It has no `needs`
dependency on checkout and deliberately leaves `cache-mode` unspecified.
It never executes fork code, enables unsafe checkout, or grants cache writes.
A successful cache job can contain a failed-save warning; success is not proof
of a saved entry. An empty listing without the relevant warning is insufficient.

**Observed:** fork/default-cache checkpoint not rehearsed.
**Reset:** a separately approved harmless event gets a new run/attempt key.
Never substitute a same-repository PR or dispatch for the real fork outcome.
If WEP blocks the whole run, neither job supplies evidence; do not weaken policy
or pretend these jobs executed.

## 3. Default event WEP; optional migration inset

**Initial state:** inspect the effective policy and current documentation; do not
assume a recording date implies an enforced block.
**Action:** show the platform-default event policy and its actual state, or show
the documented rollout with an explicit "not observed here" label if absent.

The [authoritative scope](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target#default-policy-for-pull_request_target),
checked October 6, is **public repositories without an applicable existing Actions
event policy**. It excludes private/internal repositories and does not replace
an applicable event policy. The docs currently describe **evaluate** mode and
**November 2, 2026** enforcement for affected repositories using that default
`pull_request_target` policy before general availability. Do not summarize this
as "all public repositories are blocked today."

**Point:** an enforced event restriction stops the workflow before runner jobs.
Evaluation/insights about a would-be block are not an actual denial.
**Observed:** the current repository API lists only the release actor policy.
That actor allowlist is not an event policy and is not evidence of the default
event block. No default-event denial has been captured.
**Reset:** no policy transition is needed for this clip. Leave effective
platform, parent and repository protections unchanged.

**Optional migration inset:** `lint.yml` is explicitly labeled a migration
example because this lint needs no secrets or elevated authority. Show ordinary
checkout under `pull_request` with `contents: read`. Do not call it a universal
isolation boundary: untrusted code still executes, especially risky on persistent
self-hosted runners. This example uses ephemeral GitHub-hosted runners.
PR-scoped caching is not the shared-default-branch cache of the preceding fixture.
Do not spend this clip on contributor-approval settings or an approve/run flow.

## 4. Distinct explicit release actor policy

**Initial state:** active repository policy 6432, release workflow only.
**Action:** crop the policy screen to the sole User and workflow target; show
allowed/denied run evidence only when available.
**Point:** "Only this account may trigger this release workflow." This explicit
actor rule is separate from the platform's default event restriction and from
the behavior of code after an allowed actor starts a run.
**Observed:** exact active target/actor readback and allowed Steve-Glass runs,
including the non-publishing cache rehearsal. Denial by a second otherwise
dispatch-eligible identity remains a gap; an outsider's basic access denial
would not prove this policy.
**Reset:** leave the policy active. Do not grant access or change policy for a
recording without separate approval. Final manual dispatch remains a fixed
`printf` with `permissions: {}` and cannot publish.

## 5. Release cache isolation: one configuration change

**Initial state:** retain the original setup-node configuration. Highlight the
workflow-level setting:

```yaml
permissions:
  contents: write
cache-mode: none
```

Keep this unchanged publishing-job step visible alongside it:

```yaml
- uses: actions/setup-node@v6
  with:
    node-version: 24
    cache: npm
```

**Action:** highlight only `cache-mode: none` as the release-cache change from
`demo/before/release.yml`. Leave `cache: npm` visible; there is no
`package-manager-cache: false` in this release path. Other pre-existing release
guards are not part of this cache comparison. The mode is a workflow key, not
an input or `permissions` entry. `read` would still allow restores.
**Point:** retain publishing authority while independently removing cache access.

**Measured evidence:** [run 37483252644](https://github.com/Steve-Glass/pr-note/actions/runs/37483252644),
`workflow_dispatch` on `steve-glass-universe-producer-demo`,
commit `d143b954dbd6f77619655b73ee48748a5a20479f`. The temporary `policy-check`
job had `contents: read`, `cache-mode: none`, checkout with
`persist-credentials: false`, setup-node Node 24 / `cache: npm`, and bounded
`npm ci --ignore-scripts --no-audit --no-fund`. No publishing steps ran.

- Setup: `Failed to restore: ... (403) Forbidden: cache read denied: token has no readable scopes`.
- Post: `Failed to save: Unable to reserve cache with key ... More details: cache write denied: token has no writable scopes`.
- Installation and the job succeeded; `publish` was skipped. The cache inventory
  was empty before/after, including the exact attempted key.

The run resolved checkout v6 to `d23441a48e516b6c34aea4fa41551a30e30af803`
and setup-node v6 to `249970729cb0ef3589644e2896645e5dc5ba9c38`.
That distributed setup-node bundle uses best-effort cache error handling and
reports these service-denial warnings. It does **not** contain the newer
toolkit source's mode-based skip path. Record the actual action revision/output;
do not promise that a later action version will emit identical warnings.

This demonstrates actual denied cache requests and continued installation.
It is not a seeded existing-entry/positive-restore-control experiment. Earlier
A/B release runs had npm caching disabled and are not evidence for this exact
combination. No `continue-on-error`, forced cache call, or error masking was added.
**Reset:** the temporary dispatch steps and read permission were removed in the
follow-up commit before publishing main. The rehearsal commit/run stay in
history; do not rerun a release or move tags for validation.

## 6. Consumer CLI locking

**Initial state:** existing published A/B; `v3` currently points to B.
**Action:** use the consumer's CLI/lock artifacts as the intended control,
then distinguish CLI validation from the SHA actually used by a hosted runner.
**Point:** a dependency lock is intended to bind resolution to a reviewed commit;
the label in a workflow alone does not establish enforcement.
**Observed:** the native hosted mismatch is open in
[Steve-Glass/pr-note-consumer#2](https://github.com/Steve-Glass/pr-note-consumer/issues/2).
Do not say "the consumer stays on A" as an achieved outcome while that issue is
unresolved. Further CLI replay, comments and lock changes are paused.
**Reset:** none in this producer update; preserve the existing lock and tags.

## 7. Independent external firewall

**Initial state:** the consumer's separate network-control configuration.
**Action:** show that control and its own measured result after the CLI segment.
**Point:** dependency resolution and network containment are independent controls.
A cache warning or a CLI-valid lock does not prove external traffic was blocked.
**Observed:** defer to the consumer's evidence; no firewall probe is run by this
producer update. Never send credentials or simulate a successful denial.
**Reset:** no consumer/network changes are authorized here.

## Off-camera reference

Read-only checks and local validation:

```sh
node demo/preflight.mjs
npm test && npm run check:bundle
gh api --paginate 'repos/Steve-Glass/pr-note/actions/policies?has_parents=true&per_page=100'
gh api repos/Steve-Glass/pr-note/actions/policies/6432
gh run view 37483252644 --repo Steve-Glass/pr-note --log
gh api --paginate 'repos/Steve-Glass/pr-note/actions/caches?per_page=100'
```

For future approved defaults evidence, use
`universe-tru1556m-default-RUN_ID-ATTEMPT`; for the measured release-cache
rehearsal the exact key is
`node-cache-Linux-x64-npm-36d14074ed885f81a5d6d0c9794d4e8a529c803cec476b8f833e8ef8686f93c9`.
Retained cache/policy identifiers are technical references, not presentation branding.

The existing `all_external_contributors` approval setting is secondary background
only. It does not gate `pull_request_target`. Leave it configured; no settings
screen or approve/run walkthrough is needed in the core recording.

`demo/settings.mjs` still supports scoped previews/apply/readback/restore for the
explicit policy and approval setting, with receipts outside Git. Use it only
with separate approval. Preserve prior state, do not overwrite concurrent changes,
and do not change inherited/platform policies. Its active/disabled operations
are not evaluation. The API has no documented atomic compare-and-swap; use one
operator and reconcile uncertain writes rather than retry blindly.
