---
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# two operation invocations on one physical line are scanned as one call

`OPERATION_CALL` in `we:scripts/lib/skill-operation-wiring.mjs` captures its argv tail greedily to the next backtick or newline, so a line chaining two calls parses as ONE. Filed as the **prevention owed** by PR #1526's round-5 correctness finding.

```
node we:scripts/operations/run.mjs scaffold --title=x && node we:scripts/operations/run.mjs resolve --ref=5
```

`extractOperationCalls` returns a single entry `{op: 'scaffold', flags: ['title', 'ref']}`, and the gate then emits a **false ERROR** — *"operation call passes a flag `scaffold` does not declare: --ref"* — against a perfectly well-formed pair. Meanwhile `resolve`'s own invocation is never judged at all, so a real defect in it would go unreported.

## It fails in BOTH directions, which is why it is worth a card

- **False positive** (the common case): the second call's flags are attributed to the first operation, which does not declare them → a spurious error against correct prose.
- **False negative** (the quiet case): if the second call's flag name happens to coincide with a field the first operation *does* declare, nothing is reported — and the second call's real defect is invisible.

This is the seventh defect in this gate and the fourth of the "text near an invocation is not argv" family. It is **dormant**: grepped `skills-src/` and `docs/` for the chained shape, zero occurrences, independently confirmed by the round-5 juror. None of the 46 wiring tests covers two invocations on one line.

## Why it was filed rather than patched

Round 5 was the fifth review round on PR #1526. Six defects had already been found and fixed there, two of them by the same continuation-absorber that had to be withdrawn rather than patched a third time. Patching a seventh at the loop cap would have treated the count as a to-do list rather than as evidence about the design — so the finding is recorded here, with the tally, and the fix is a deliberate next step instead of a reflex.

## The fix the juror named

Bound `OPERATION_CALL`'s tail capture with a lookahead that stops before the next `node we:scripts/operations/run.mjs`, rather than running to the next backtick or newline. That keeps the one-physical-line discipline (the absorber is gone and must stay gone) while making the line yield *two* calls instead of one.

Worth deciding at the same time whether this whole family — seven defects, all "what counts as argv on a markdown line" — argues for parsing fenced code blocks as commands rather than regexing prose. That is a bigger change than this card and should not be smuggled into it.

## Done when

1. **Executable** — a line chaining two `we:scripts/operations/run.mjs` invocations yields TWO calls, each judged against its own operation's inputs. Red today (one call, flags merged), green after.
2. **Executable** — the false ERROR case above produces no finding, and a genuinely unknown flag on the SECOND call does produce one. Both directions pinned, so neither "merge them" nor "ignore the second" can pass.
3. The existing six defect-class tests still pass unchanged — this must not reintroduce the withdrawn continuation absorber.
