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

Should Lever C (event-driven land, #2683) be built — and if so, how? A **ten-round** high-care design-jury red-team
(5 outer rounds on the conveyor design + 5 merit rounds on C specifically) **converged the architecture** but
**escalated the landing-transaction correctness spec** as genuine, human-decidable tradeoffs. Full worked design +
evidence trail: **`we:reports/2026-07-27-lever-c-landing-merge-queue-design.md`**. The short of it: making
event-driven land correct is essentially **building a merge queue with sign-off integrity** — a real, deep
problem, not a quick lever — so **defer**, and rule the tradeoffs below before any build.

## Converged — do NOT revisit (closed on the merits)

- **One logical writer. No second writer, no fence.** The fencing-failover / borrow-the-lease path (the original
  framing) is **closed**: it is *unbuildable-safely on GitHub* (the merge-API `sha` guards the PR head, not base
  `main`; there is no token-fenced main-write) **and** dominated by simply supervising one live writer.
- **The shape:** wake the one writer (poll→webhook), batch its merges (a gated merge-train, only if Lever 0 shows
  saturation), supervise it (auto-restart + an activity-signal progress probe). Safety from GitHub-native
  mechanisms: PR-merged-state idempotency, "require branches up to date" (= the existing drain `BEHIND`→rebase→re-CI
  path, `we:scripts/merge-ai-prs.mjs`), and a resumable landing transaction.
- **The cheap immediate win, independent of all the below:** shorten the daemon poll to ~5–10 s (one constant, no
  second writer, no transaction question) whenever Lever 0 (#2680) shows idle wake latency costs.

## Open tradeoffs to rule (this is the decision — see the report §4)

- **T1 — sign-off integrity vs rebase churn.** "require up-to-date" + GitHub "dismiss stale approvals on new
  commits" means every base-advance rebase drops the non-author sign-off. dismiss-stale ON → repeated re-sign-off
  (who re-signs?); OFF → the sign-off no longer certifies the *rebased* tree (**weakens the sign-off invariant**);
  or pin the merge to the signed-off HEAD SHA + re-review on any later push. **Merit fork.**
- **T2 — require-up-to-date (safety) vs O(n²) re-CI (throughput).** Adopting the safety foundation *manufactures*
  the merge-queue saturation that gates the batch lever — so batching may be a **prerequisite** of the safety
  foundation, not a deferred option. **Merit fork.**
- **T3 — transaction-tail concurrency.** The merge is overlap-safe (405); the tail (backlog-splice, branch-delete,
  **downstream dispatch**) is not. Decide how much tail atomicity to build (single-flight lock + per-step
  end-state guards); `downstream dispatch` has no natural idempotent end-state → needs a **dispatch-ledger**.
- **T4 — resume trigger.** A merged-but-uncleaned PR is *closed* → invisible to the open-PR scan; needs a durable
  transaction-in-progress record or a reconcile-over-recently-merged pass.

## Forks (to prepare / rule)

- **Fork 1 — build C at all?** Default **defer** — gate on Lever 0 (#2680) proving the serial land binds
  throughput; ship the poll-shorten stopgap meanwhile.
- **Fork 2 — if built, rule T1–T4** and build it as a proper merge queue (batch + single-flight tail +
  dispatch-ledger). *(The second-writer/fencing option is closed — do not reopen.)*

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
