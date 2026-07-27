---
bornAs: xwysuk4
kind: decision
parent: "2612"
status: open
relatedReport: reports/2026-07-27-lever-c-landing-merge-queue-design.md
dateOpened: "2026-07-26"
preparedDate: "2026-07-27"
tags: []
---

# Lever C concurrency: can event-driven land be sole-writer-safe, and is it worth it?

**The call, in one line:** *keep the polling drain*; ship the cheap event-driven **wake** now; **defer** the full
event-driven **merge-queue build** until Lever 0 (#2680) proves the serial land actually binds throughput. Event-driven
land *is* sole-writer-safe — but only as "wake the one writer," never "add a second lander" (that path is closed on the
merits, below). Full worked design + a ten-round red-team: **`we:reports/2026-07-27-lever-c-landing-merge-queue-design.md`**.

This prep separated two things the original framing fused: (1) an **event driving the *wake*** of the single existing
writer — sole-writer-safe, cheap, ship it — from (2) an **event driving a correct *land*** under branch protection —
which is essentially **building a merge queue with sign-off integrity** (the T1/T4 forks below), a real deep problem to
defer. That split is the whole decision.

## The crux — is event-driven land sole-writer-safe? (converged; do NOT revisit)

The hard invariant is **sole-writer-to-`main`**: exactly one logical process ever merges to `main`, so no two landers
race the base. The answer turns entirely on what "event-driven" *means*:

- **"Wake the one writer" (webhook / short-poll fires, the resident daemon does the merge)** — **sole-writer-safe by
  construction.** Still exactly one writer; the event only changes *when* it wakes, not *how many* processes write. The
  daemon's landing sweep (`we:scripts/merge-ai-prs.mjs`) is unchanged; only its trigger moves from the 60 s poll
  (`we:scripts/readiness/conveyor-instrument.mjs:70`, `DEFAULTS.intervalSec=60`) to an event.
- **"A second, event-triggered lander does the merge" (the original fencing / borrow-the-lease framing)** —
  **CLOSED, on two independent fatal grounds** (five red-team rounds, report §2):
  1. **Unbuildable-safely on GitHub.** A fencing token only prevents split-brain if the *written resource* validates
     it. `main` has **no token-fenced write**: the merge-API `sha` guards the **PR head**, not base `main`. So a token
     guards nothing and two writers can both land.
  2. **Dominated by supervision.** Heartbeats can't prove death (a GC-paused / partitioned / mid-push primary is alive
     but silent); keeping one writer alive + supervised sidesteps split-brain entirely.

This is a **forced-invariant ruling, not a live fork** (one branch is broken): the second-writer branch is excluded, so
sole-writer safety is *preserved* by keeping one writer and merely changing its trigger. **Do not reopen the
second-writer / fencing path.** Everything below assumes the single supervised writer.

## The validation gate — build the merge-queue correctness layer now? (verdict: not-yet)

**Not a `## Fork N`** (this prep's classification correction, forced by the fresh-context screen + skeptic): "build C"
bundled a **cheap sole-writer-safe wake** with a **merge-queue-grade correctness build**, and the near-term choice
between them is a *data-gated go/no-go on a candidate*, not a merit either/or. So it takes the **validation-gate shape**.

- **Digest.** "Full Lever C" = event-driven land made *correct* under branch protection: `require-branches-up-to-date`
  + a resumable, concurrency-safe landing transaction + (necessarily) batching. That is a merge queue with sign-off
  integrity — the T1/T4 forks below are its genuine open tradeoffs.
- **Verdict: NOT-YET — defer the correctness build; ship the wake now.**
  - **Ship now (independent, sole-writer-safe, ~90 % of the latency win):** shorten the daemon poll 60 s → ~5–10 s
    (one constant; ~720 `gh` calls/h ≪ the 5 000/h budget; no second writer, no transaction question). This is
    "A2" in the report. A true-push **webhook** ("A5", ~0 latency) is a later *prioritization* call over A2, not a
    merit fork and not gated behind the correctness build — it too only wakes the one writer.
  - **Defer (the correctness build):** the T1/T4 forks + batching. Build it as a proper merge queue *if and when* the
    gate opens.
- **Concrete un-gate trigger.** Lever 0 (#2680) instrumentation shows the **serial writer binds throughput** — i.e.
  sustained `k > 1` ready PRs queued behind the writer with land-service < arrival (`we:scripts/readiness/conveyor-instrument.mjs`
  `pollGap` / queue-depth telemetry), *not* merely occasional idle wake latency (which A2 already covers). Until that
  telemetry exists and shows saturation, there is nothing the correctness build buys that the wake does not.
- **Prior-art delta.** Merge queues with exactly this sign-off + up-to-date + speculative-batch shape are shipped and
  well-understood: **GitHub Merge Queue**, **Bors** (Rust/Servo), **Zuul** (OpenStack, speculative gating), **Mergify**.
  The delta vs them is *not* novel mechanism — it is that we have **no evidence the serial writer is our bottleneck
  yet**, so building one now is premature optimization of unproven need.
- **Skeptic:** SURVIVES-WITH-AMENDMENT. Attack (classification): "the wake is part of C, so deferring C wrongly
  withholds the latency win." Fix folded — **unbundled**: the wake ships now on its own; only the correctness build is
  deferred. Attack (merit): "A2 short-poll reintroduces a race" — refuted: it is still one daemon polling faster, zero
  new writers, zero new sole-writer surface.
- **Screen:** flagged(prio) → fixed. Fresh context correctly saw "build C now vs later" as *sequencing*, not merit;
  that is exactly why it is a **validation gate with a data trigger**, not a `## Fork N`. Infra-ops axis: this is a
  legitimate internal tooling-ops decision (the repo does make infra calls); it is correctly filed, not a WE-standard
  question.

## Fork 1 — sign-off integrity under `require-branches-up-to-date` (T1)

*Only bites once the gate opens.* **Fork exists** because two coherent branches genuinely cannot coexist: GitHub's
"dismiss stale approvals on new commits" is a single repo knob, and a base-advance rebase either drops the non-author
sign-off or it does not — you cannot have the sign-off both survive every rebase *and* certify the exact landed tree
under a naive rebase transport. The **excluded/broken branch is dismiss-stale-OFF**: it keeps the approval but the
approval no longer certifies the *rebased* tree, silently **weakening the non-author-sign-off invariant** — a
correctness regression, not a tradeoff.

- **(a)** dismiss-stale ON → the sign-off always certifies the landed tree, but a busy `main` forces repeated
  re-sign-off (who re-signs? → livelock).
- **(b)** dismiss-stale OFF → no churn, but the sign-off certifies a *stale* tree (**invariant weakened** — excluded).
- **(c)** **land the signed tree via a speculative *merge-commit* that preserves the signed-off SHA as a parent**
  (merge-queue style), instead of rebasing the PR branch. The signed commit is never rewritten, so dismiss-stale never
  fires; the merge commit's first-parent history certifies the exact combined landed tree; `require-up-to-date` is
  satisfied by the speculative merge, not by a branch rebase. Where a merge-commit is impossible and a rebase is forced,
  fall back to **pin the merge to the signed-off HEAD SHA + re-review on any post-sign-off push**.

**Recommended default: (c) — speculative merge-commit preserving the signed SHA (pin-to-SHA + re-review as the
rebase-forced fallback).** Reasoning: it is the *only* option that holds the non-author-sign-off invariant **without**
re-sign-off livelock — it dodges the dismiss-stale knob entirely rather than picking a bad value of it. It is exactly how
GitHub Merge Queue / Bors / Zuul preserve gate integrity across a moving base. The current drain's `BEHIND → rebase`
path (`we:scripts/merge-ai-prs.mjs:437,460`) is what *manufactures* T1; a merge-commit transport dissolves it.

```
# (c) speculative merge-commit — the signed SHA S is preserved as a parent, never rewritten
signed = gh_pr_head_sha(pr)              # S: the exact tree the non-author signed off
base   = gh_ref_sha("main")              # B: current base (may have advanced since sign-off)
# build the speculative merge locally, re-run `test` on the COMBINED tree:
merge_commit = git_merge_tree(base, signed)     # parents: [B, S]  -> S is an ancestor, sign-off intact
run_required_check(merge_commit)                 # green on the tree that will actually land
gh_merge(pr, method="merge", expected_head_sha=signed)   # 409 if S moved after sign-off -> re-review
# dismiss-stale never fires: S was never force-updated; the merge commit certifies parents [B,S].
```

- **Skeptic:** SURVIVES-WITH-AMENDMENT. Attack (merit): "pin-to-SHA reduces to dismiss-stale-ON — a busy base advances,
  the pinned SHA goes BEHIND, `require-up-to-date` forces a rebase → new SHA → re-review, the same churn." True for a
  *rebase* transport — which is why the default was **amended to the merge-commit transport** (S stays a parent, never
  rebased, so up-to-date is met without rewriting the signed tree). Attack (config-dimension): "(a)/(b) are just two
  values of the dismiss-stale knob." Conceded — (a)/(b) *are* a config dimension; the real strategy is (c), which is why
  it is the default and the fork is genuine (an app-level transport choice, not a knob value).
- **Screen:** clear. Real merit difference survives free-build/instant-maintain: the three options give *different
  end-state guarantees on what the sign-off certifies* (a correctness property), not a cost tradeoff. Correctly filed as
  an internal merge-process governance call.

## Fork 2 — the transaction-tail safety model (T3 + T4)

*Only bites once the gate opens.* **Fork exists** because two coherent safety models genuinely cannot both be the
correctness layer: either a **lease-based single-flight lock** is trusted to guarantee no overlap, or **per-step
end-state guards** are. Under **supervision (not fencing)** the report itself concedes a heartbeat can't prove death —
so a GC-paused / partitioned **zombie writer can wake past a lease and write**. A lease-lock as the *correctness* layer
therefore **reinherits the exact split-brain the second-writer path was closed for** — that branch is **broken**. The
merge itself is overlap-safe (GitHub 405 on a merged PR); the **tail** (backlog-splice, branch-delete, downstream
dispatch) is not.

- **(a)** single-flight **lease lock** as the correctness layer, tail steps run inside it — *broken* (a zombie past the
  lease double-writes; excluded).
- **(b)** **per-step CAS / idempotent end-state guards** as the correctness layer, single-flight demoted to a cheap
  contention-reducer.

**Recommended default: (b) — per-step CAS / idempotent guards are the correctness layer; single-flight is only an
optimization.** Each tail step gets a guard that holds *even against a zombie writer*: git **ref-CAS** on the
backlog-splice push (non-fast-forward rejected), **delete-if-exists** on the branch, and — because **downstream dispatch
has no natural idempotent end-state** — an explicit **dispatch-ledger** (append-once keyed on `{pr, item}`, checked
before dispatch). Resume (T4): a merged-but-uncleaned PR is *closed* and drops out of the open-PR scan, so recovery
needs a durable in-progress record + a reconcile-over-recently-merged pass.

**Statute reconciliation (MEMORY rule 105 — "Claim Ignores Git State; ownership = `status:active`, not the working
tree").** A brand-new parallel "transaction-in-progress record" would invent a *second* source of truth for in-flight
land state, which can disagree with backlog `status`. So: **reuse backlog `status` as the transaction-in-progress source
of truth** wherever a step maps to a status transition, and add **only** the dispatch-ledger as genuinely-new state
(dispatch has no `status` home). This composes with rule 105 rather than duplicating it. Also name the tail's
`main`-write splice as the **sanctioned sole-writer exception** to the write-time shared-gate hook (rule 43), so it isn't
falsely blocked.

- **Skeptic:** SURVIVES-WITH-AMENDMENT. Attack: "single-flight lock is enough / the dispatch-ledger is
  over-engineering." Refuted + folded — a lease-lock does **not** survive a zombie writer, so the **guards** (not the
  lock) must be the correctness layer (default amended to make that explicit); and the dispatch-ledger is the *minimal*
  mechanism for the one tail step with no idempotent end-state, not gold-plating. Statute overlap with rule 105 found
  and reconciled in-item (reuse `status`, ledger only for dispatch).
- **Screen:** flagged(impl) → fixed. Fresh context rightly noted the *sizing* of tail atomicity is build-spec (belongs
  in the #2683 build slice). Kept here is only the **safety-model choice** (CAS-guards vs lease-lock) — a real
  correctness call, not sizing — and the build-spec sizing is delegated to #2683.

## Dissolved (this prep) — T2 is not an independent fork

The report's **T2** ("require-up-to-date vs O(n²) re-CI → is batching a *prerequisite* of the safety foundation?") was
tagged a merit fork. The skeptic **refuted the "absolute prerequisite" framing**: the *current* drain already runs
`require-up-to-date` (the `BEHIND → rebase → re-CI` path, `we:scripts/merge-ai-prs.mjs`) with **no** batching, at shallow
queue depth. The O(n²) re-CI is transient waste at depth `k`, a **livelock only under sustained saturation** (`k > 1`
held) — which is the *same* signal the validation gate already keys on. So T2 is **saturation-conditional, not
absolute**, and it **collapses into the validation-gate trigger**: *when the gate opens, batching (a couple-order-aware
merge-train, "B1") co-ships with `require-up-to-date`* — it is a build-order rider on the same Lever-0 telemetry, not a
separate human ruling. Recorded here so no live choice sits outside a fork; nothing further to rule.

## What ratifying unblocks

- **Immediately (verdict = ship-now half):** the **A2 poll-shorten** (60 s → ~5–10 s) becomes a green-lit one-constant
  change against `we:scripts/readiness/conveyor-instrument.mjs` / the drain daemon — the ~90 % latency win, no build.
- **Conditionally (gate opens on Lever 0):** slice **#2683** (build Lever C) is unblocked to build *as a proper merge
  queue* with Fork 1 (c) sign-off transport + Fork 2 (b) tail safety model already ruled — i.e. it arrives at
  Definition of Ready with its two hardest correctness calls settled, not re-litigated at build time.
- **Permanently:** the sole-writer-safety ruling (second-writer/fencing closed) is codifiable, so no future latency
  lever reopens split-brain.

### Review jury (provisional — pre-registered #2638)

_Care band: **elevated** (system-machinery, touches the sole-writer safety invariant + the drain landing tail; not
statute-self, so not `high`). Predicted touch-set of the work this decision authorizes:_
`we:scripts/merge-ai-prs.mjs`, `we:scripts/readiness/conveyor-instrument.mjs`, `we:backlog/2683-*` (the build slice).
_Each buildable child carved off (the A2 stopgap; the #2683 merge-queue build) takes its own slice of that set as its
`scope:`._

- **correctness / safety (mandatory):** does the built transport preserve **sole-writer-to-`main`** and the
  non-author-sign-off invariant under a base advance and a zombie-writer overlap?
- **infra-ops robustness:** do the tail steps hold against a supervised (not fenced) writer — CAS guards, not a lease
  lock, as the correctness layer?
- **throughput:** is `require-up-to-date` shipped with batching when Lever 0 shows saturation (no O(n²) livelock)?

## Undefer plan (this deferral has a tripwire, it is NOT open-ended)

This is a **validation gate**, not a merit fork — so the "defer" is only legitimate with a concrete, tracked
plan to un-defer. Lever 0 (#2680, **resolved**) already *instruments* the trigger signal; but instrumenting is
not watching. The plan is made real by a tracked monitor that watches the signal and fires the build:

- **Un-gate CONDITION (measurable):** **k > 1 ready PRs queued behind the sole serial writer, sustained across
  the measured window** — not a one-off spike — as reported by the Lever-0 instrument
  (`we:scripts/readiness/conveyor-instrument.mjs`, #2680): its `land-serialization` phase + ready-PRs-behind-writer
  depth. Below k>1, or a single-tick burst, the polling drain stays and the build stays deferred.
- **Un-gate ACTION (what fires):** build the deferred merge-queue layer = **Fork 1 default (c)** speculative
  merge-commit preserving the signed SHA + **Fork 2 default (b)** per-step CAS / idempotent guards, plus the
  batching rider (co-ships with require-up-to-date when the gate opens). The two hardest calls are already ruled
  here, so the build slice #2683 arrives at Definition of Ready, not re-litigation.
- **The MECHANISM that fires it:** the tracked tripwire item **#x955xwn** ("Un-gate tripwire: fire the #2692
  event-driven merge-queue build when Lever-0 shows sustained landing-queue saturation", `blockedBy: #2680`,
  which is resolved → ready to build once this call is ratified). It reads #2680's saturation metric and, on a
  sustained k>1-behind-writer trip, surfaces/queues #2683 to the conveyor automatically. The deferral thus
  un-defers *itself* on measured saturation, rather than depending on someone remembering to look.

## Lineage

Outer escalation: `we:reports/2026-07-26-conveyor-per-item-latency.md` §5. Deep design + 10-round evidence:
`we:reports/2026-07-27-lever-c-landing-merge-queue-design.md`. Slice #2683 is the build; this decision gates it.
The tracked tripwire that un-defers it is **#x955xwn** (reads #2680's saturation metric, fires #2683 on sustained
k>1-behind-writer). Program #2606 / epic #2612. The convergence loop's own mechanization is #xvwmwkx.
