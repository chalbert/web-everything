---
kind: task
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# Tighten G7 audit heuristic to suppress ordinal/lineage false positives

The G7 cite-the-case audit (we:scripts/audit-backlog-health.mjs, citesCodifiedCase) over-reports a tolerated residue: bare `#N` that are really ordinals (e.g. "acceptance 2", "Fix 2", an intra-card feature-list "6/9/10", "step/gap N") or deliverable-lineage cites ("CustomStorageStrategy from project 011") where citing the case, not the rule, is correct. After the #1502 sweep these recur every run as noise. Add a heuristic to citesCodifiedCase: skip a backlog-number token immediately preceded by an ordinal word (acceptance|fix|step|phase|gap|criterion|feature|idea|fork|option|Q|DC) and same-card list ordinals; leave the irreducible lineage cites documented. Low-risk audit-only change. (This card's own examples drop the leading `#` so it does not re-trip the flag it describes.)

## Progress (resolved 2026-06-22, batch-2026-06-22-1556-1557-1559)

Added `isOrdinalOrListRef(body, match)` + a `G7_ORDINAL_WORD` regex to `citesCodifiedCase` in
`we:scripts/audit-backlog-health.mjs`. A `#N` is now skipped (not a cite-the-rule nudge) when it is:
1. a **leading-zero legacy/lineage cite** (`#011` — `norm` collides it onto a small decision; this is the
   "`CustomStorageStrategy` from #011" case, where citing the *case* is correct);
2. **ordinal-word-prefixed** (`Fix #2`, `feature #6`, `step/phase/gap/criterion/idea/fork/option/Q/DC`);
3. part of a **`/`-joined list run** (`#9/#10`, `#12/#13/#15`).
A standalone reference to the decision itself is still flagged.

**Verified:** G7 **5 → 2**. Cleared #1153 (`Fixes #2/#3` — ordinal + list), #1451 (`#011` lineage cite).
Correctly **kept**: #1577→#475 and #142→#107 (standalone big-number cites — proves no over-suppression).
Remaining residue is exactly the body's documented class: #142's standalone intra-card ordinals
(`#6`/`#12`/`#2`, written without a suppressible shape) and #1577's genuine nudge. G7 is a soft CANDIDATE
pool, not a hard gate; no per-rule test harness exists for the audit (same as #1558) so verified by count +
`check:standards` green.
