---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Advisory-fix reconcile branch re-dispatches forever once the finding is fixed (count compare, not recency)

we:scripts/conveyor/reconcile-core.mjs owes an advisory fix while advisoryFixes < advisoryNotes, comparing COUNTS of advisory-fix markers (we:scripts/conveyor/advisory-fix-mark.mjs#countAdvisoryFixComments) against advisory notes (we:scripts/conveyor/advisory-round-count.mjs#countAdvisoryComments). A PR with several historical advisory notes and one later fix marker stays 'fix owed' after the finding is fixed. Live case chalbert/web-everything#2549: 5 advisory notes 01:40Z-02:48Z on 2026-09-24, one fix marker at 14:16Z that fixed the finding, then no-op fixer re-dispatches at 14:29Z and 14:31Z that correctly posted no marker, so the count never advances and ADVISORY_FIX_ROUND_CAP never trips: an unbounded loop. Fix: owe an advisory fix only when the LATEST advisory note is newer (by createdAt / thread order) than the LATEST advisory-fix marker; otherwise owe a fresh review (re-run advise). Keep the cap on the marker count. Test: many old notes + one newer marker -> review owed, not fix; newer note after marker -> fix owed. Prove live on #2549: before = fix owed, after = review owed.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
