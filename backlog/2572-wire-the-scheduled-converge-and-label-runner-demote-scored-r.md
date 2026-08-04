---
bornAs: xpfousp
kind: epic
status: active
blockedBy: []
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/review-policy.mjs
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/auto-land-seam.mjs
  - we:scripts/lib/disposition-land-seam.mjs
  - we:scripts/pr-land.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/review-set-label.mjs
  - we:scripts/review-core-cli.mjs
  - we:scripts/fetch-parked.mjs
  - we:scripts/workflows/
  - we:scripts/conveyor/
  - we:scripts/__tests__/
  - we:scripts/lib/__tests__/
dateOpened: "2026-07-19"
dateStarted: "2026-08-04"
tags: []
---

# Wire the scheduled converge-and-label runner + demote scored review:pending to advisory care routing

The safety-coupled behavior half of #2563/#2567. (1) A separate scheduled agent-runner — the **converge daemon** — runs the convergence workflow (review-parked-prs, #2437/#2410) over care-annotated PRs, dialing panel rigor by care level (#2567), then applies review:accepted / ready-to-merge only: converge+label, never land. (2) Route the park by **care band** rather than demoting every scored signal (ruled 2026-08-04, below): `none`/`low` stop parking, `elevated`/`high` keep `review:pending`, now machine-clearable; gate-self/statute stay `review:human`. Part 2 trails part 1 behind the enforce flip — they do NOT ship together. Edits the review trust chain → review:human.

The drain daemon can't spawn agents (#2391 lease), which is why the converge daemon is a separate process; the
resident drain daemon stays the sole `main`-writer.

## Ruling — part 2 is a care-band routing table, not a blanket demotion (operator, 2026-08-04)

**The call.** Where a scored PR waits is decided per care band, not per scored signal:

| Band | Park | Cleared by |
|---|---|---|
| `none` / `low` | none — lands immediately | n/a |
| `elevated` / `high` | `review:pending` | the converge daemon (post-flip); a human until then |
| gate-self / statute (`humanRequired`) | `review:human` | a human, always |

**Why not the two alternatives.** *Demote everything to a non-blocking `care:*` annotation* (the card's original
part 2) reopens the zero-review hole for every scored band and needs a whole new label class plus a
`hasUnclearedReviewLabel` rewrite; it is also the only option still exposed to the post-flip race below.
*Dissolve part 2 entirely* (converge daemon simply clears `review:pending`, nothing else changes) is safe and
costs no code, but leaves a size-only PR — care weight 2, band `low` — queued behind a panel for no reason,
under-delivering on #2563. The band table takes the safety of the second and the latency win of the first.

**Reconciliation with [#blast-radius-advisory-care-not-a-gate](../docs/agent/platform-decisions.md#blast-radius-advisory-care-not-a-gate)
(#2563) — load-bearing.** That rule forbids gating on a computed risk score, so an `elevated`/`high` park needs
an answer. It is this: #2563's own wording is "**`gate` means route-to-a-human, never hard-block-with-no-reviewer**",
and #2851 ([#human-required-is-judgment-only](../docs/agent/platform-decisions.md#human-required-is-judgment-only))
already holds that mechanical convergent review need not stay human. Once the converge daemon is wired there IS a
reviewer, so the high-band park is a **machine park with a bounded clear time**, not the human park #2563 struck
down. If that reconciliation is ever rejected, the blanket demotion is the honest reading of #2563 and the
zero-review hole has to be closed some other way — this ruling stands or falls on it.

**The post-flip race the band table also closes.** The drain daemon is resident and continuous; the converge
daemon runs on a tick. Under a blanket demotion a scored PR can be landed by the drain before the converge
daemon's next tick ever sees it — `hasUnclearedReviewLabel`
([`we:scripts/lib/review-escalation.mjs:564-569`](scripts/lib/review-escalation.mjs)) blocks only
`review:pending`/`human`/`changes`, and a PR carrying no review label merges untouched
([`we:scripts/merge-ai-prs.mjs:426`](scripts/merge-ai-prs.mjs)). Keeping the park on the hazardous bands makes
that race unreachable rather than merely narrow.

## Ordering correction — part 2 does NOT ship with part 1

The card said the two parts "MUST ship together" because demoting the park without a wired runner lets the drain
auto-land scored PRs with zero review. The hazard is real; the remedy was wrong.

Per [#enforce-flip-triple-gated](../docs/agent/platform-decisions.md#enforce-flip-triple-gated) (#2838) the runner
**must start in shadow** — default-closed, and the flip's readiness predicate needs a clean shadow track record it
can only earn by running for a while. "Part 1 shipped" therefore means "a runner that writes nothing"
(`--enforce` exits 2, [`we:scripts/review-runner.mjs:197-200`](scripts/review-runner.mjs); `mutations: 0` at
`:257`). Ship part 2 alongside it and you get exactly the zero-review window the coupling was meant to prevent.

Real order: **schedule the runner → soak in shadow → #2864 + #2893 land → flip to `enforce` → then part 2.**
Part 1 (the scheduling substrate) is the only half that is buildable now, and part 2 is carved to its own slice
so the dependency is machine-readable rather than prose — the same lesson this card already learned below.

## Still open — the scheduling substrate (part 1's remaining fork)

There is no ratified call on **where** the converge daemon is scheduled, and no wiring exists today: grep finds no
`.github/workflows/*` reference, no `we:package.json` script, and no `we:scripts/conveyor/` caller — it is
hand-run only. Candidates: local `launchd` spawning headless `claude` (matches
[#agent-runner-cli-backend](../docs/agent/platform-decisions.md#agent-runner-cli-backend)'s
subscription-funded CLI backend, but only runs while the Mac is awake); a Claude cloud routine; or a phase in the
conveyor tick, which already spawns agents under a singleton lock. Take this fork next — the band table above
shapes what the daemon has to do.

## The enforce flip is BLOCKED by #2864 — now in the DAG, not just in prose

**#2864 said "it **must** land before the enforce flip (#2572 part 2)" in its body, while this card carried
`blockedBy: []`.** Nothing machine-readable stopped the flip from being picked up first, and on 2026-08-03 it was
nearly recommended as ready on exactly that basis — `status: open`, `size: 8`, no blockers.

The prerequisite is real and only bites in enforce mode: the jury ledger carries **no commit SHA**, so a verdict
written at head A folds to *clear* at head B. Enforced, that auto-clears a PR for a diff no juror saw, and the
`reviewed-sha` marker cannot catch it — it is stamped at WRITE time, so it certifies the unreviewed tree. Shadow
mode is safe from this only because its "no ledger → keep parked" path fails closed.

This is the class #2874 exists for, arriving from the other direction: an outward prerequisite stated in the
blocked item's prose, never lifted into the blocker's edges. Fixed here by writing the edge.

**Amended 2026-08-04 — the edge moved down to the part-2 slice, it did not disappear.** #2864 gates the *enforce
flip*, and the ordering correction above establishes that only part 2 sits behind the flip; part 1 (the scheduling
substrate) is buildable today. Leaving `blockedBy: ["2864"]` on the epic would have falsely blocked the half that
is ready, so the edge now lives on the carved part-2 slice — alongside #2893, the flip's impl follow-on, which the
prose had likewise never lifted into an edge. The epic's own `blockedBy` is empty because nothing blocks part 1.

## Also corrected here

- **`kind: story` → `kind: epic`.** This card has a child (#2864), and a *sized* story with children
  double-counts in the burndown — `we:scripts/backlog-guard.mjs` blocks any edit until it is resolved.
- **`size: 8` dropped.** An epic is sized only while unsliced; this one has a slice.

## Naming decision — the "converge daemon" (operator, 2026-08-03)

Rename `we:scripts/review-runner.mjs` / `we:scripts/lib/review-runner-core.mjs` and every "shadow runner"
reference to the **converge daemon**, riding THIS story rather than a separate cycle.

"Shadow" names its *mode*, not its job — the observe-only phase this story ends, so the name is wrong the day it
lands. "Review daemon" was rejected as the obvious pair for the drain daemon because it hides the part that
matters: this process REVIEWS via a fresh multi-lens panel, then an editor subagent FIXES each finding and
**pushes the revision to the PR branch**, and only then DECIDES the label. Nobody expects a "review daemon" to
rewrite their branch. `converge` is already this codebase's word for that loop.

The pair then reads by what each one writes:
- **drain daemon** — writes to `main`; lands what is cleared.
- **converge daemon** — writes to PR branches; reviews, fixes, decides. Never touches `main`.

It rides this story because both files are POLICY tier of the trust chain
([`we:scripts/lib/gate-config.mjs`](scripts/lib/gate-config.mjs)) — a rename needs a human clear, and this story
already requires exactly one.
