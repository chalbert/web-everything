---
bornAs: x9fa1uo
kind: story
size: 3
parent: "3383"
status: open
scaffoldedBy: "design-3784-supervision"
dateScaffolded: "2026-09-22"
blockedBy: ["3888"]
scope: ["we:scripts/conveyor/log-delegation-trial.mjs", "we:scripts/conveyor/__tests__/log-delegation-trial.test.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs"]
relatedTo: ["3690", "3784", "3673"]
dateOpened: "2026-09-22"
tags: [dispatch, delegation, supervision, graduation]
---

# Rule 5 of #3690: a root-cause note in its own field, then a post-miss bar of minCleanStreak + k

Rule 5 of we:docs/agent/platform-decisions.md#delegation-trial-record-graduation says that after a confirmed miss, post-miss trials count toward restoration only once a root-cause note is on record **in its own field**, not in a later row's `findings`, and that the post-miss bar is strictly higher than the cold-start bar (`minCleanStreak + k`). The code re-promotes on the same streak with no note required: `selectSupervisionLevel` (we:scripts/lib/provider-routing.mjs:674) compares one `minCleanStreak` in every case, and the miss veto at `:741` only resets the counter. Add the field, and make the bar after a miss `minCleanStreak + k`.

**Home:** the prototype branch `lane/mechanical-dispatcher`. Both files also exist on `main`; the change is made to the branch copy, which the router reads there. Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**Order:** SECOND of the three rule children carved by #3784's design settlement, `blockedBy` the rule-4 card — the post-miss accounting reads the `informative` field rule 4 adds, and both fields go onto the same validated row shape in we:scripts/conveyor/log-delegation-trial.mjs, so doing them in one order avoids two passes over the same schema.

**This card DOES change `DEFAULT_BACKDOWN_THRESHOLDS`, and that is the reason it is not folded into #3784.** #3784's own Done-when requires that object to be unchanged by its diff; rule 5 requires adding `k` to it. Adding `k` here is a structural addition, not a recalibration: the value of `k`, like `minCleanStreak`, is a config default set only by an ordinary batched finding against real data (rule 3), never by this card.

**Not in this slice:** the value of `k` or of `minCleanStreak`; the promotion record and the enforcement flip (#3784); rule 7's floor (its own card).

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/log-delegation-trial.test.mjs` passes with new cases that fail before: (a) `--root-cause=TEXT` is accepted and written to its own `rootCause` field on the row; (b) a `rootCause` that is not a non-empty string or null is refused by name; (c) `findings` and `rootCause` are written as two distinct fields, neither derived from the other.
2. **Executable** — `npx vitest run we:scripts/lib/__tests__/provider-routing.test.mjs` passes with new cases that fail before, all for one triple: (a) after a confirmed miss with NO `rootCause` on record, no number of later clean trials reaches `spot-check` — the reason names the missing note; (b) with a `rootCause` on record, `minCleanStreak` clean trials still return `full` and `minCleanStreak + k` return `spot-check`; (c) a `rootCause` written into a later row's `findings` instead of the field does not clear the miss.
3. **Executable** — `grep -n "minCleanStreak" we:scripts/lib/__tests__/provider-routing.test.mjs` shows a case asserting the cold-start path is untouched: a triple with no miss on record still graduates at exactly `minCleanStreak`.
4. **Observable** — `DEFAULT_BACKDOWN_THRESHOLDS` (we:scripts/lib/provider-routing.mjs:144) gains a `k` field and its existing fields keep their current values (`minCleanStreak: 5`, `requireInformativeTrial: true`).
5. **Observable** — the audit trail `selectSupervisionLevel` returns states which bar was applied (cold-start or post-miss) and why, so a reader can tell the two apart without recomputing the streak.
