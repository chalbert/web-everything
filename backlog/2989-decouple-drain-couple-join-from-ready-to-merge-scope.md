---
bornAs: xc7p3q9
kind: task
status: active
dateOpened: "2026-08-02"
dateStarted: "2026-08-02"
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs", "we:scripts/readiness/lane-manifest.mjs", "we:scripts/readiness/__tests__/lane-manifest.test.mjs"]
tags: [conveyor, drain, merge-ordering, review-integrity]
---

# Decouple the drain's couple-join from the `ready-to-merge` label / candidate scope

The drain's COUPLE-JOIN gate — the plan-time rule that a manifest-less impl PR
(frontierui / plateau-app) lands only WITH its WE carrier — must decide off the
carrier's HEALTH read from the label / `--only` / `--repos`-BLIND full open-PR
context, NOT off the carrier's presence in the NARROWED candidate list. Today's
`joinImplToCouples` + `planLabelDrain` couple gate reads the narrowed `list`, so
a healthy open carrier that was merely filtered out of the candidate set defers
its impl FOREVER — while a genuinely held / unnameable / degraded / truncated
carrier can slip a stowaway impl onto main alone.

This is the couple-join twin of [2880 / #2880](/backlog/2880-decouple-drain-ordering-from-ready-to-merge-label/),
which decoupled merge-ORDERING from the same label scope.

**Blocks #2832** (and the `ready-to-merge` strip work tracked by PR #984). The
strip (a held WE carrier stops advertising itself as landable) is only safe once
the couple-join reads carrier health from the blind context, exactly as
2880 / PR #999 made the *ordering* strip safe. Same relationship 2880 /
PR #999 has to PR #984. (The reciprocal `blockedBy: [2989]` is recorded on
item 2832 so the conveyor cannot dispatch 2832's strip before this fix lands.)

## The problem

An attempt inside PR #984 (head `324117d9`) had the held-case core right — carrier
decision resolved at PLAN time, production mutate-after-join order — but, built
inside a label-hygiene PR, it produced three wiring-level failure classes. This
item rebuilds the core off `main` as its own PR and fixes all three.

## The 4 fixes (as the reviewer scoped them)

**Fix 1 — distinguish "carrier NOT LANDING" from "carrier NOT IN SCOPE".** The
`324117d9` gate was `!list.some(x => x.num === c.coupleCarrier.num && … &&
x.decision === 'merge')`. But `--only` narrows the candidate list via
`matchesOnlyTarget` BEFORE `verdicts` is built, so for an impl-half target `list`
is that ONE PR — the gate can't find the carrier in the narrowed `list` and
defers a perfectly HEALTHY, green, open carrier's impl forever.
[`we:conveyor/pr-watch.mjs`](conveyor/pr-watch.mjs) fires exactly `--only=<pr>
--only-repo=<implSlug> --label=ready-to-merge`, so this is a permanent no-op for
impl halves while the carrier is open, breaking the #2683 fast-drain contract.
CORRECT DESIGN: the gate decides "defer the impl" from the carrier's HEALTH read
out of the label / only / repo-blind context (which lists ALL open PRs) — defer
iff the carrier is genuinely OPEN AND HELD. A carrier merely filtered out of the
candidate set but present-and-healthy in the blind context must NOT defer; absent
from the blind context entirely (landed/closed) also must NOT defer.

**Fix 2 — fail closed on an UNNAMEABLE carrier (against `NaN`, not `null`), and
consume the degraded / truncated flags.** The old `if (couple.item == null)
v.coupleHeld = true` NEVER fired: a missing manifest `item` runs through
[`we:scripts/readiness/lane-manifest.mjs#asItemId`](scripts/readiness/lane-manifest.mjs)
→ `NaN`, and `NaN == null` is false (`JSON.stringify` prints `NaN` as `null`, so
it merely LOOKS correct). Detect an invalid item id for REAL — via
[`we:scripts/readiness/lane-manifest.mjs#isItemId`](scripts/readiness/lane-manifest.mjs)
(false for `NaN`) — and fail CLOSED. ALSO put the flags to work: `openPrContext.truncated`
(the `--limit 500` cap, previously computed and DISCARDED) and a per-PR degraded
read (a swallowed `gh` error → incomplete manifest) must make the gate fail
CLOSED — if the carrier set can't be proven complete / healthy, defer, don't
orphan-land.

**Fix 3 — idle accounting: a pass blocked ONLY on human-held work counts as
idle.** A held couple leaves its impl in `deferred` every pass, and `idlePass`
required `deferred.length === 0`, so `--max-idle` never tripped and a
`--watch --until-batches-idle` drain with one human-held couple ran to its
wall-clock cap holding the lease. Idle accounting now treats a pass whose
deferrals are all "blocked solely on a review-held carrier" as idle. (A
degraded / truncated fail-closed defer does NOT count — it may clear on a
re-fetch, so the watch keeps polling.)

**Fix 4 — tests drive the REAL narrowing path.** Every round-5 regression came
from the wiring, not the logic. The tests exercise the real sequence
`narrowPrsByRepo → buildDrainVerdicts (classifyPr + attach) → buildCarrierHealth /
buildExtraCoupleCarriers → joinImplToCouples → planLabelDrain` via functions
SHARED with `runCli` — never hand-built verdicts with `item: null` or a pre-set
`decision: 'skip'` (the vacuous shape that let the round-4/5 regressions hide).

## Loci

- [`we:scripts/merge-ai-prs.mjs#joinImplToCouples`](scripts/merge-ai-prs.mjs) —
  indexes carriers candidate-first then from the blind context; stamps
  `coupleDefer` from carrier health, not from `list`.
- [`we:scripts/merge-ai-prs.mjs#carrierDeferDecision`](scripts/merge-ai-prs.mjs) —
  the pure fail-closed table (truncated → absent → degraded → unnameable → held).
- [`we:scripts/merge-ai-prs.mjs#buildCarrierHealth`](scripts/merge-ai-prs.mjs) —
  the carrier-health index (`held` / `nameable` / `degraded`) from the blind context.
- [`we:scripts/merge-ai-prs.mjs#planLabelDrain`](scripts/merge-ai-prs.mjs) — the
  couple gate reads the precomputed `coupleDefer`; flags `heldCoupleOnly`.
- [`we:scripts/merge-ai-prs.mjs#buildDrainVerdicts`](scripts/merge-ai-prs.mjs) /
  [`we:scripts/merge-ai-prs.mjs#narrowPrsByRepo`](scripts/merge-ai-prs.mjs) — the
  shared narrow → classify → attach path (Fix 4).
- [`we:scripts/merge-ai-prs.mjs#deferralsAllHeldCouple`](scripts/merge-ai-prs.mjs) —
  the idle predicate (Fix 3), wired into the `--watch` `idlePass`.
- [`we:scripts/readiness/lane-manifest.mjs#isItemId`](scripts/readiness/lane-manifest.mjs) —
  the real nameable-item predicate (Fix 2).

## Acceptance

- **AC1 (Fix 1)** — `--only <impl half>` with a HEALTHY open labelled carrier in
  a COMPLETE context → impl LANDS (ready), not deferred. Discriminating: the impl
  joined the couple and cleared on `coupleDeferReason === 'healthy'`.
- **AC1-mirror (B3)** — a FULL sweep with an EMPTY / INCOMPLETE context
  (`RECONCILE` false) → the impl DEFERS (`incomplete-context`). *(The original
  mirror asserted "empty context → impl ready" — that WAS the B3 fail-open.)*
- **AC2** — `--only <impl half>` with a HELD carrier → impl DEFERS.
- **AC3 (Fix 1/2)** — `--repos=<implSlug>` / `--this-repo` scope where WE is not
  a candidate → fail CLOSED past a held carrier (the blind context is
  constellation-wide, so the held carrier is still seen).
- **AC4 (B4)** — an UNNAMEABLE carrier via the REAL `NaN → JSON "item":null →
  re-read 0` round-trip → fail CLOSED (`unnameable`).
- **AC5 (Fix 2)** — a TRUNCATED `openPrContext` → fail CLOSED (`truncated`).
- **AC5b (B1)** — the REAL degraded read `{manifest:null, degraded:true}`
  (`readPrManifest` threw) → fail CLOSED (`degraded`); the carrier is NOT dropped.
- **AC6 (Fix 3 / B5)** — a pass whose only deferral is a human-held couple counts
  as idle on BOTH exit paths (`idlePass` AND `decideBatchesIdleExit`); a degraded
  / truncated fail-closed defer does not.
- **AC7** — no regression: a full sweep with all couples healthy produces the
  same ready / deferred partition as the merge base (impl joined, `healthy`).

## Delivery & the review-fix round

This item is `active` (claimed / in-flight) while its own PR (`bornAs: 2989`)
is under review — so `check:readiness --select` drops it (no double-dispatch, S3)
while the reciprocal `blockedBy` on item 2832 stays a LIVE block until this fix
actually lands (S4). It graduates to `resolved` on land. The core design (carrier
HEALTH from the blind context, not presence-in-the-narrowed-list) landed, then a
human `/review` bounced it `review:changes` because the fail-closed gate FAILED
OPEN on three independent paths. This round hardens it:

- **Completeness is a property of the CONTEXT, not a row (B1/B2/B3).**
  `collectOpenPrContext` returns `contextComplete` (false on any thrown per-repo
  listing, any degraded per-PR read, a truncated page, or a never-collected
  `RECONCILE`-false context). `carrierDeferDecision` treats an ABSENT carrier as
  landed ONLY when the context is provably complete — else it fails closed
  (`incomplete-context`). `buildCarrierHealth` emits a `degraded`/`unreadable`
  marker for a thrown manifest read instead of dropping it.
- **`nameable` is fail-closed (B4).** `isItemId` rejects the whole coercion
  corpus (`null/''/0/[]/false/NaN/…`); `buildCarrierHealth` derives `nameable`
  from the SAME expression that computes `item`.
- **The held-couple idle allowance is one shared helper (B5)** consulted by
  `idlePass`, `decideBatchesIdleExit`, and the confirm sweep — so the production
  `--watch --until-batches-idle` launcher (no `--max-idle`) exits on a
  held-couple-only pass.
- **The two `held` notions agree (B6)** — `buildCarrierHealth` threads the same
  `escalationRelief` waiver `classifyPr` uses.
- **The defer is two-sided (B7)** — a couple that cannot fully land defers BOTH
  halves (a carrier never lands WE-first past a held/undeferrable impl).
- Plus the shared pass composition (`prepareDrainVerdicts` / `planDrainPass`),
  single-sourced carriers (B9), and the S1–S4 citation/state fixes.

Prevention items filed under tag `review-integrity` (see the PR comment for ids).

## Round 2 (R1–R15) — bind the tests to the real wiring, then fix the live holes

The round-1 `contextComplete` design was AFFIRMED, but the fixes kept passing
over live holes because the tests did not bind to `runCli`'s real wiring. Round 2
does the STRUCTURAL refactor FIRST, then lands the behavioral fixes in now-tested
code, then mutation-verifies.

- **R4 (structural).** `contextComplete` is now computed in ONE exported pure
  place — [`we:scripts/merge-ai-prs.mjs#reduceOpenPrContext`](scripts/merge-ai-prs.mjs)
  — which `runCli`'s collector AND the test suite both call (the round-1 hole was
  a hand-computed formula in the test helper). The collector itself is the
  exported, injectable [`we:scripts/merge-ai-prs.mjs#collectOpenPrContext`](scripts/merge-ai-prs.mjs)
  (was an un-exported closure). The couple JOIN + plan runs through the single
  seam [`we:scripts/merge-ai-prs.mjs#planDrainPass`](scripts/merge-ai-prs.mjs),
  which `runCli` now CALLS (it had zero production callers). `idlePass` /
  `confirmedEmpty` are the exported
  [`we:scripts/merge-ai-prs.mjs#isPassIdle`](scripts/merge-ai-prs.mjs) /
  [`we:scripts/merge-ai-prs.mjs#isConfirmSweepSettled`](scripts/merge-ai-prs.mjs).
- **R3.** A 404 from the contents endpoint is DEFINITIVE absence (`degraded:false`),
  not a degrade — the retired tree file 404s on every ref, which made
  `contextComplete` false on EVERY pass with a manifest-less impl open (the R2
  livelock root). Taxonomy in
  [`we:scripts/merge-ai-prs.mjs#isContentsNotFound`](scripts/merge-ai-prs.mjs) +
  [`we:scripts/merge-ai-prs.mjs#readRemoteManifestViaApi`](scripts/merge-ai-prs.mjs).
- **R1.** A PLAN-WIDE fail-closed invariant inside `planLabelDrain`: when
  `contextComplete === false`, no manifest-less verdict from a non-WE repo may
  enter `plan.ready` — catches the un-joined orphan the per-carrier gate misses.
- **R2.** No verdict `waitOn`s its own item (the self-referential livelock); plus
  the `--assume-complete-context` operator escape hatch (a loud one-line waiver).
- **R5.** The couple gate runs AFTER the escalation/park pass; carrier `held` is
  read from the carrier's FINAL decision (`candidateHeldByKey`), not a
  pre-escalation label snapshot.
- **R6.** `decideBatchesIdleExit` SUBTRACTS the held couple's members from
  `considered` (never a wholesale waiver) so an in-flight non-held candidate keeps
  the watch polling.
- **R7.** A couple-level invariant: before a carrier enters `ready`, every
  `manifestRefs` entry other than its own head must be absent from the blind
  context or joined-and-ready (covers `--only=<carrierPR>`, where B7's
  impl→carrier propagation never fires).
- **R8.** RESOLVE-ON-LAND on the label lander's terminal land event — found here,
  but SPLIT OUT of this item (round-3 review, B5): the first cut resolved off the
  WE carrier ALONE and ungated, which flips the card while a failed impl half's PR
  is still open. #2899 carries it instead, gated on couple completeness and sharing
  lane-drain's `resolveLandedItem`. This item keeps only the couple-join decoupling.
- **R9–R15.** `carrierDeferDecision` returns `humanTerminal` (a held carrier with
  read noise still idles); `--repos` entries normalize to `owner/name`; single
  `prsByRepo` producer (no double-narrow); unused test imports removed;
  `joinImplToCouples` JSDoc documents the options bag; this item's `scope:`
  now lists the lane-manifest test; `2993`'s trigger restated file-scoped.
