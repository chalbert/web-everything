---
bornAs: xwysuk4
kind: decision
parent: "2612"
status: open
relatedReport: reports/2026-07-27-lever-c-landing-merge-queue-design.md
dateOpened: "2026-07-26"
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

## Lineage

Outer escalation: `we:reports/2026-07-26-conveyor-per-item-latency.md` §5. Deep design + 10-round evidence:
`we:reports/2026-07-27-lever-c-landing-merge-queue-design.md`. Slice #2683 is the build; this decision gates it.
Program #2606 / epic #2612. The convergence loop's own mechanization is #xvwmwkx.
