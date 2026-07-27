# Lever C landing design — the merge-queue problem behind "event-driven land" (2026-07-27)

**Status:** the *architecture* is converged (5-round high-care design-jury red-team); the *landing-transaction
correctness spec* is **escalated** — it holds open, human-decidable tradeoffs, so the jury correctly refused to
`accept` and the round cap escalated it. Decision home: **#2692** (`we:backlog/2692-lever-c-concurrency-can-event-driven-land-be-sole-writer-saf.md`).
Parent design record: `we:reports/2026-07-26-conveyor-per-item-latency.md` (Lever C, §5). Program #2606 / epic #2612.

## TL;DR

The original "Lever C = event-driven land" quietly assumed a **second writer** (a fast-drain that *does* the
merge), which dragged in fencing tokens / lease delegation / authorization / audit. Five red-team rounds proved
that whole path is both **unnecessary** and **unbuildable-safely on GitHub**. The converged answer is:

> **One logical writer. No second writer, no fence.** Wake it, batch it, supervise it — guarded by GitHub-native
> mechanisms. But making that *correct* is essentially **building a merge queue with sign-off integrity**, which is
> a real, deep problem with genuine tradeoffs — so **defer it**, and if/when built, rule the open tradeoffs below
> first. It is not a quick lever.

## 1. The question

Should Lever C (event-driven land, #2683) be built — and if so, how, holding **sole-writer-to-`main`**,
**non-author sign-off**, and **gate-self**? The trigger was: a ready PR waits up to 60 s for the resident drain
daemon's poll (`plateau:tools/drain-daemon`, `DEFAULTS.intervalSec=60`).

## 2. The converged architecture (settled — stable since round 3)

Three regimes around **one** writer (they can co-occur under bursty load); **Lever 0 (#2680)** + an activity
signal says which actually costs:

- **P1 — wake latency** (idle daemon polls 60 s). Fix: **wake the daemon**, never a second writer.
  - **A2** — shorten the poll to ~5–10 s (one constant; ~90 % of the win; ~720 `gh` calls/h ≪ 5 000/h). Cheap stopgap.
  - **A5** — GitHub **webhook** (the daemon's `#2605` push/SSE seam): the only true-push option (~0 latency); cost =
    a hosted endpoint + backstop poll. Merit-correct. *(A2-vs-A5 is a prioritization call, not merit.)*
  - *(A3 nudge/wake-file dropped: it only removes the daemon's sweep wait but inherits `we:scripts/conveyor/pr-watch.mjs`'s
    own green-detection poll, so not ~0.)*
- **P2 — merge throughput** (saturated serial writer). Fix: **batch the writer's merges** (B1 couple-order-aware
  merge-train), only if Lever 0 shows saturation; else cut per-merge cost via **Levers E/D** (shard/select).
- **P3 — availability** (daemon crashed/wedged/deploying). Fix: **process-level HA** — supervisor auto-restart +
  a progress-liveness probe keyed on a **positive activity signal** (not landing-cadence-only, which can't tell
  *wedged* from *slow-CI* under heavy-tailed queue latency).

**What is CLOSED (do not revisit):** a **fencing-failover standby / any second writer.** Reasons, both fatal:
1. **Unbuildable-safely on GitHub.** A fencing token only prevents split-brain if the *written resource* validates
   it. GitHub `main` has **no token-fenced write**; the merge-API `sha` guards the **PR head**, not base `main`.
   So a token guards nothing and two writers can both land.
2. **Dominated by supervision.** Heartbeats can't prove death (a GC-paused/partitioned/mid-push primary is alive
   but silent) nor catch a wedge — and keeping one writer alive sidesteps split-brain entirely.

## 3. The safety foundation (GitHub-native, mostly already in the drain)

- **(a) Double-land safety:** GitHub's **PR state machine** — a merged PR can't be re-merged (405). Per-PR
  idempotency keyed on the PR's **`merged` state** (not the SHA — squash/rebase changes it) makes any
  restart/overlap merge a no-op.
- **(b) Tested-tree == landed-tree:** branch-protection **"require branches up to date before merging"** = the
  **existing** drain `BEHIND → rebase-drop → re-run `test`** path (`we:scripts/merge-ai-prs.mjs`). A stale-base
  plan is caught and re-tested, never landed blind.
- **(c) Whole-transaction idempotency:** a "land" is merge **+ branch-delete + backlog-splice + merged-comment +
  downstream triggers**. Only the merge is covered by (a)/(b), so the *whole transaction* must be resumable.

## 4. OPEN tradeoffs to rule (the escalation packet — these are the decision)

Round 5 (the cap) surfaced these as genuine, **human-decidable** design tradeoffs — not editor-foldable, because
each has a real cost on both sides and two touch protected invariants. **These are what #2692 must rule.**

- **T1 — sign-off integrity vs rebase churn.** "require up-to-date" (b) + GitHub's "dismiss stale approvals on new
  commits" means every base-advance rebase **drops the non-author sign-off**. Options: (i) dismiss-stale ON →
  sign-off always certifies the landed tree, but a busy `main` forces repeated re-sign-off (livelock; who
  re-signs?); (ii) dismiss-stale OFF → no churn, but the sign-off no longer certifies the *rebased* tree —
  **weakens the non-author-sign-off invariant**; (iii) pin the merge to the exact signed-off HEAD SHA and re-review
  on any post-sign-off push. Merit call required.
- **T2 — require-up-to-date (safety) vs O(n²) re-CI (throughput).** Enabling (b) under a single serial writer makes
  every land mark the other k−1 ready PRs BEHIND → ~k² CI runs, the classic merge-queue livelock. So adopting the
  *safety* foundation *manufactures* the P2 saturation that gates B1 — they are coupled, not independent. Decision:
  batch (B1) may not be "deferred until saturation" but a **prerequisite** of (b), or (b) needs a batching queue.
- **T3 — transaction-tail concurrency, not just resumability.** The merge is overlap-safe (405); the tail
  (backlog-splice, branch-delete, **downstream dispatch**) is **not** — two briefly-overlapping daemons (an
  over-eager probe kill that then unwedges) can double-dispatch a delivery agent or race/corrupt a backlog file.
  "Resumable" (sequential re-run) is weaker than "concurrency-safe." Decision: how much tail atomicity to build
  (per-step end-state guards + a single-flight lock on the tail), and note **`downstream dispatch` has no natural
  idempotent end-state** — it needs an explicit dispatch-ledger.
- **T4 — resume trigger.** A merged-but-uncleaned PR is **closed**, so it drops out of the open-ready-PR scan —
  nothing re-selects it to finish the tail. Needs a durable **transaction-in-progress record** or a
  reconcile-over-recently-merged-PRs pass. (Build-spec-ish, but currently unspecified.)

## 5. Convergence history (the evidence trail — why we believe §2)

| Round | Verdict | What it changed |
|---|---|---|
| 1 | changes | Killed "C-lands is strictly dominated" — **missed the availability axis** (fencing = failover). |
| 2 | changes | Failover is **unbuildable-safely** (no GitHub token-fence; heartbeat ≠ death) → **supervise**, don't fail over. |
| 3 | changes | Delivered the keystone: the restart overlap needs a **write-time guard**, not "guarantee one process." |
| 4 | changes | Corrected the keystone: GitHub has **no base-`main` CAS**; real guards = PR-merged idempotency + require-up-to-date + the existing BEHIND path. |
| 5 (cap) | changes → **escalate** | The correctness spec has genuine tradeoffs (T1–T4); two were re-opened by the v5 fold. `deriveNegotiationOutcome({changes,5,5}) = escalate`. |

The **architecture** (§2) held steady from round 3; only the **transaction-correctness spec** kept revealing real
holes — which is the signal it is a merge-queue-grade problem, not a quick lever.

## 6. Recommendation

- **Defer building C.** It is a real merge queue with sign-off integrity, not a poll tweak.
- **The cheap, safe, immediate win is A2** (shorten the poll to ~5–10 s) — one constant, no second writer, no
  transaction question. Ship that whenever idle wake latency is shown to cost (Lever 0), independent of the rest.
- **If/when C is built:** rule **T1–T4** first (esp. T1 sign-off-vs-rebase and T2 require-up-to-date-vs-batching —
  both are real merit forks), and build it as a proper merge queue (batch + a tail with single-flight + a
  dispatch-ledger), gated on Lever 0 showing the serial land actually binds throughput.
- **Never** reopen the second-writer/fencing path — it is closed on the merits (§2).

## 7. Process note

This design was driven by hand through 5 red-team rounds (the `/jury` convergence loop emulated as discipline,
since the controller isn't wired into the harness yet — see `we:#xvwmwkx`). The cap-escalate is the correct
outcome: a high-care jury does not `accept` a genuinely-hard problem by folding; it isolates the human-decidable
tradeoffs (T1–T4) and hands them up. That is what this record captures.
