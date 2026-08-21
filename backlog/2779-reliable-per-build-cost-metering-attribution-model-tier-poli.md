---
bornAs: xyo1vaf
kind: story
size: 8
priority: low
parent: "2531"
status: open
scope: ["plateau:src/build-runner/"]
dateOpened: "2026-07-28"
tags: []
---

# Reliable per-build cost metering, attribution, model-tier policy and audit log

The foundation slice of the SaaS cost-governance epic: replace the unreliable, non-persisted costUsd counter (plateau:src/build-runner/events.ts, discarded at plateau:src/build-runner/build-action.ts) with a durable per-build cost record attributed to tenant + item + run. Folds model-tier cost policy (per-plan model + ceiling, wired to the runner --model hook / plateau:src/build-runner/profiles.ts) and the durable queryable audit/billing log, both of which read metering. Blocks the per-tenant budget-gate slice.

## Design

All three folded concerns hang off **one already-parsed value that is currently thrown away**, so the build is
mostly a plumbing job on named existing seams — not new architecture.

**1. The value exists; nothing keeps it — and the missing branch is in `startBuild`, not `runBuildFlow`.**
`parseStreamJsonLine` (plateau:src/build-runner/events.ts) already emits
`{ type: 'result', ok, costUsd: number | null, text? }` — `costUsd` is a declared field on the `RunnerEvent`
union. Nothing ever reads `e.costUsd`, in this repo, anywhere.

Be precise about *which* function must change, because the two candidates in
plateau:src/build-runner/build-action.ts look interchangeable and are not:

- `runBuildFlow` has an `if (e.type === 'result')` branch, but it reads `e.ok`/`e.text` only for **pass/fail
  control flow**, and it is **store-blind by design** — `BuildFlowDeps` is documented as the callbacks the flow
  uses "without knowing about the store". Threading `BuildRunStore` into it to persist cost would undo that
  separation. Do not.
- `startBuild` builds the `flowDeps.onEvent` closure, and **that** closure is the only store writer: it
  branches on `init` / `text` / `tool` / `quota-stall` and has **no `result` case at all**. `runBuildFlow`
  already forwards every event to it unconditionally (`deps.onEvent?.(e)`), `costUsd` included. So the fix is
  one new `else if (e.type === 'result')` arm in `startBuild`'s closure calling `store.update(record.id, …)`.

That is the whole of the "unreliable, non-persisted counter" the digest names.

**2. The record is in-memory and per-process.** `BuildRunStore` (plateau:src/build-runner/build-action.ts) is a
bare `Map<string, BuildRun>` on the long-lived dev server, and `BuildRunDTO` carries no cost field at all. Both
the durable record and the queryable audit/billing log (req 6 of the #2531 epic) land here: extend
`BuildRunDTO`/`BuildRun` with the metered fields, and give the store a durable backing so a restart does not
erase billing evidence.

**3. Model-tier policy already has its hook — do not invent a second one.** `RunnerTask.model` exists
(plateau:src/build-runner/runner.ts), is validated (`model must not start with "-"`), and reaches the child
through exactly ONE argv site (`args.push('--model', task.model)`); `BuildFlowOpts.model` is the matching
pass-through. `profileFor(kind)` in plateau:src/build-runner/profiles.ts is the existing per-kind
static-policy home and is deliberately pure + browser-safe so the mapping is unit-tested — the per-plan model
+ ceiling map belongs beside it, resolved to a `RunnerTask.model`, never as a second spawn path.

**But `plan` does not exist either, and that is the same honesty problem as `tenant`.** Nothing in
`BuildFlowOpts`, `startBuild`, or the `POST /api/backlog/build` handler carries a plan identifier — there is
no value to key a per-plan lookup off. So what this slice can honestly land is a **pure, exported, unit-tested
policy map plus the resolver that reads it**, wired to the existing `model` pass-through and defaulting when
no plan is supplied. Sourcing a real plan id is the build-control / budget-gate slice's job, exactly like
`tenantId`. Say this in the code comment too — a policy map that no request path can reach is dead weight if
its status is not written down.

**Be honest about attribution: there is no tenant boundary in this app yet.** `tenant` appears only under
plateau:packages/saas/src/web-docs/seed.ts and plateau:packages/saas/src/web-docs/served-site.ts, plus one
mock-server test — the build
runner has no tenant concept, and the parent epic (#2531) says so explicitly ("no tenant boundaries, no
billing"). So the attribution key this slice can actually build and prove today is `{ runId, num, itemId, repo }`
(every one already a `BuildRun` field). Carry a nullable `tenantId` on the record so the budget-gate slice has
somewhere to write, and do NOT fabricate a tenant model here — that is the build-control slice's job.

**Cost is still not a gate.** plateau:src/build-runner/build-action.ts says so in three places ("Cost is NOT a
gate … there are deliberately no cost/quota caps here", and the liveness backstop is explicitly "a hang guard,
not a spend limit"). This slice makes cost *observable and durable*; enforcement is the per-tenant budget-gate
slice this one blocks. A build that would exceed anything must still not be refused by this item's code.

## Done when

- **Tier 1** — a new test under plateau:src/build-runner/ (run with `npm test` / `npx vitest run
  src/build-runner/` from the plateau-app checkout) drives **`startBuild`** with a stubbed `run` that emits
  `{ type: 'result', ok: true, costUsd: 0.42 }` through `flowDeps.onEvent`, and asserts the store record ends
  with `0.42`. It fails on today's code, where `startBuild`'s `onEvent` closure has no `result` arm at all.
  (Assert against `startBuild`, **not** `runBuildFlow` — see Design §1.)
- **Tier 1** — the same suite pins that `costUsd: null` (already a fixture shape in
  plateau:src/build-runner/build-action.test.ts) records an explicitly *unknown* cost, never `0`. A silent zero
  is the failure mode "unreliable counter" names, so it must be an assertion, not a convention.
- **Tier 1** — the audit log is **queryable across runs**, not just point-readable: a test writes three
  completed runs, restarts the store from its durable backing, and asserts a list/filter call returns all
  three with their costs — including runs the caller does not know the `runId` of. Without this bullet a
  per-`runId` file (or a single "last run" slot) passes every other criterion while silently defeating req 6
  of the parent epic (`we:backlog/2531-saas-cost-build-control-governance-for-the-autonomous-builde.md`).
- **Tier 2** — the metered cost is readable without judgment: `toDTO`
  (plateau:src/build-runner/build-action.ts) carries the cost + attribution fields, so `GET
  /api/backlog/build/:runId` (plateau:vite.config.mts, the `isBuild` block) returns them; and the record still
  resolves after the dev server restarts, which a bare `Map` cannot do today.
- **Tier 2** — per-plan model policy is a pure exported map + resolver in
  plateau:src/build-runner/profiles.ts beside `profileFor`, unit-tested, and it reaches the child ONLY through
  the existing hook: `grep -n "'--model'" plateau:src/build-runner/runner.ts` still returns exactly one argv
  site after the change. Its comment states that no plan id is sourced yet (see Design §3) so the gap is
  recorded, not implied away.
- **Tier 3** — no cost ceiling refuses or stops a build in this slice. Read the `runBuildFlow` body and the
  `POST /api/backlog/build` handler in plateau:vite.config.mts: neither gains a spend-based early return.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: verify by mutation or reversion BEFORE building) — Design §1 blames the cost loss on plateau:src/build-runner/build-action.ts's runBuildFlow 'result' branch and Tier 1 tells implementers to test that runBuildFlow persists cost into 'the run's durable record' — but runBuildFlow is deliberately store-blind (its own BuildFlowDeps doc comment: 'without knowing about the store'); the actual missing branch is in startBuild's onEvent closure, a separate function in the same file that currently handles init/text/tool/quota-stall but has no case for 'result' at all.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The only caller of BuildRunStore.create/update is startBuild in plateau:src/build-runner/build-action.ts (verified — the other `store.create` hits, in plateau:src/backlog-view/webcases-review-write.ts, plateau:src/backlog-view/write-action.ts and plateau:src/explorer-runs/executor.ts, are unrelated store classes; paths corrected against the tree by the driver); plateau:vite.config.mts forwards toDTO(run) verbatim so new fields ride along with no change needed there; the frontend's own local BuildRunDTO type in plateau:src/backlog-view/queue-view.ts is structurally typed against the wire JSON, so additive fields don't break it.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Tier 2's only test for 'the durable queryable audit/billing log' is that one record survives a dev-server restart via point lookup by a known runId; nothing in Tier 1–3 would redden if the chosen durable backing supported no listing/filtering across runs at all, or even retained only the latest run — which would silently defeat the audit/billing purpose (per the parent epic we:backlog/2531-saas-cost-build-control-governance-for-the-autonomous-builde.md req 6) while still passing every named bullet.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Tier 1 explicitly pins costUsd: null as an assertion (not a convention) distinct from 0, directly targeting the 'silent zero' failure mode the digest names — this is exactly the legibility strategy the taxonomy calls for.

**Corrections applied by this review:**

- Tier 1's acceptance test names the wrong function: it says driving `runBuildFlow` should make 'the run's durable record' end with the stubbed costUsd, but `runBuildFlow` never touches `BuildRunStore` (by design) — the branch that actually needs a `result` case is `startBuild`'s `onEvent` closure in plateau:src/build-runner/build-action.ts (currently handling only init/text/tool/quota-stall), not `runBuildFlow`'s own local `if (e.type === 'result')` branch (which only sets `sawErrorResult`/`resultText` for pass/fail control flow and already receives the full event, costUsd included, via the unconditional `deps.onEvent?.(e)` call).

The plumbing story (costUsd is parsed but discarded, tenant is honestly absent, --model has exactly one argv site, BuildRunStore is a bare non-durable Map) checks out verbatim against the live repo, but the Done-when under-specifies two of the three folded concerns (audit-log queryability, model-tier "plan" wiring) and Tier 1 names the wrong function as owning the durable record.

_Recorded through the declared `review-prep` operation._

**Driver disposition (2026-08-21).** All three findings accepted and applied: Design §1 now names `startBuild`'s
`onEvent` closure (verified against the tree — the closure branches on `init`/`text`/`tool`/`quota-stall` only,
and `BuildFlowDeps` is documented "without knowing about the store"); a new tier-1 bullet pins cross-run
list/filter after a restart, closing the decorative-guard gap; and Design §3 now states that no `plan` id exists
in `BuildFlowOpts` / `startBuild` / the POST handler, so the slice lands the pure policy map + resolver and
defers plan sourcing, the same treatment `tenant` already gets. The review's own cited paths for the unrelated
`store.create` sites were corrected to their real locations.
