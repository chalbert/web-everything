---
bornAs: xibwr2w
kind: decision
parent: "3740"
status: open
blockedBy: ["3760"]
dateOpened: "2026-09-20"
tags: []
---

# track hardening: when the worker Owed block stops being soft (numeric rule, named owner, review date)

The worker Owed block starts soft: a missing block warns and is counted. This decision fixes the numeric rule that makes it hard (N clean intakes in a row with a warning rate under X percent), names the owner who flips it, and sets a review date so the soft phase cannot last forever by default. Safety checks and id-less handoff lines are hard from day one and are not part of this decision. Design-first, uncleared.

Decision under epic #3740 (design point 6). Filed uncleared and not yet prepared: it needs the `/prepare` pass and a ratification before anything is built. It is blocked on the worker adapter because the rule is about a number that adapter produces.

## Design

**Settled.**

- Only the worker Owed block starts soft. The safety checks (line contract, secret pre-flight, uncleared for non-operator provenance) and id-less handoff lines are hard from day one and are not part of this decision.
- The soft phase is measured by the warning counter that the worker adapter exposes: intakes seen, intakes with a warning.
- The soft phase must not be open-ended by default: whatever rule is chosen has a date on it.

**Open (the forks to decide).**

1. **The rule.** Options: (a) a count and a rate: N clean intakes in a row and a warning rate under X percent over the window; (b) a date only: hard on a fixed day whatever the rate; (c) both, whichever comes first. The rate rule alone can stall forever if few jobs run, and the date alone ignores whether writers have learned the block. Recommended default: **(c)**, with the date as the backstop. The numbers N and X are guesses until the first measured rate exists (the backfill run gives the first real one); working guess N = 20, X = 5 percent, to be replaced by the measured baseline at ratification.
2. **The owner** who flips it to hard. The epic requires a named owner. Recommended default: **the operator**, since the flip changes what every worker must write; a role, not a session, so it survives the session that filed this.
3. **The date.** A review date that starts when the worker adapter lands, so it cannot be written before the soft phase exists. Recommended default: **fourteen days after that adapter's landing**, stamped onto this card when the adapter resolves.

## Done when

1. **Executable** — once ratified, the rule is a number in code and a test, not prose: `node --test we:scripts/operations/__tests__/track-source-owed.test.mjs` includes a case where a fixture counter that meets the ratified rule makes a missing Owed block fail instead of warn, and a fixture counter that does not meet it still warns.
