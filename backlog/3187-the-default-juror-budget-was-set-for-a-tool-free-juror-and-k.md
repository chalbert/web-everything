---
bornAs: xvkjndx
kind: story
size: 2
status: resolved
dateOpened: "2026-08-18"
dateResolved: "2026-08-27"
preparedDate: "2026-08-18"
scope:
  - we:scripts/lib/judge-spawn.mjs
  - we:scripts/lib/judge-panel.mjs
  - we:scripts/lib/__tests__/judge-spawn.test.mjs
tags: [jury, converge, judge-spawn, budget, silent-failure]
---

# The default juror budget was set for a tool-free juror and kills every tool-bearing one

`DEFAULT_BUDGET_USD = 0.5` landed with #3028 for a **tool-free** juror and was never revisited when
tool-bearing jurors arrived (#3072). A tool-bearing seat exceeds it mid-run and is killed, surfacing
as `is_error` with `stop_reason: "tool_use"` — which reads like a crash, not a budget. Every caller
that declares no budget inherits it, which today means the converge panel: the two declared
operations set `JUDGE_BUDGET_USD = 1.5` explicitly, while `we:scripts/lib/judge-panel.mjs` defaults
to `DEFAULT_BUDGET_USD`. Raise the default, and make the kill say so.

## The measurement

Four real tool-bearing juror runs on 2026-08-18, all through the declared `review-pr` operation at
its own `JUDGE_BUDGET_USD = 1.5`:

| PR | spend | wall | verdict |
|---|---|---|---|
| #1467 | $0.6152 | 167.3s | accept |
| #1466 | $0.6597 | 210.3s | accept |
| #1465 | $0.6997 | 245.7s | accept |
| #1463 | $0.9042 | 312.5s | changes |

**Every one exceeds 0.5.** At the inherited default all four would have been killed mid-run — and
between them they produced ten findings, nine of which were real defects that a green test suite and
`check:standards` both missed.

Separately observed earlier the same day on the converge path: a seat killed having spent **$0.596**,
then re-run identically at `budget: 3.0` and succeeding at **$0.69**. Same seat, same input; the only
variable was the ceiling.

## Why it reads as a crash

The kill surfaces as `is_error` with `stop_reason: "tool_use"`. Nothing in that names a budget. On the
converge run that first exposed this, 6 of 8 juror seats failed this way and the run escalated
`needs-human` on `mandatory-lens-absent` — an escalation that looked like a panel failure and was
actually a spending limit. That is the expensive half of this bug: it does not report itself, so the
time goes into diagnosing the wrong thing.

## The fork this does not pick

**(a) Raise `DEFAULT_BUDGET_USD`** to something a tool-bearing juror can finish in. The measurements
suggest ≥1.5, which is what both declared operations chose independently. Smallest, and makes the
default match the only juror shape now in use.
**(b) Keep the default low but make the kill legible** — detect the budget stop and fail with a
message naming the ceiling and the spend. Does not unblock the converge path on its own.
**(c) Both.**

Recommend **(c)**: (a) unblocks, (b) stops the next budget-shaped problem costing a diagnosis. The
number in (a) belongs on this card before build — `1.5` matches the declared operations but is not
itself measured as sufficient for the widest lens.

## Not in scope

The AGGREGATE budget question `we:scripts/lib/judge-panel.mjs` already documents (`budget` is PER
SPAWN, so five jurors cost five times it). That is a separate design question about panel-wide
ceilings.

## Done when

1. **Executable** — this fails before and passes after, covering both halves: that the inherited
   default admits a tool-bearing juror at the spends measured above, and that a budget-terminated
   spawn reports the ceiling rather than a bare `tool_use` stop:

   ```
   npx vitest run scripts/lib/__tests__/judge-spawn.test.mjs
   ```
2. A caller that declares no budget can complete a tool-bearing juror at those spends.
3. `review-pr` and `review-prep` still set their own budget explicitly — this item does not remove
   their override, it makes the inherited default non-fatal.

## De-risked during prep

- The four spends are from real runs this session, read off each run's own telemetry line, not
  estimated.
- `DEFAULT_BUDGET_USD = 0.5` in `we:scripts/lib/judge-spawn.mjs`, both `JUDGE_BUDGET_USD = 1.5`
  declarations, and `we:scripts/lib/judge-panel.mjs`'s `budget = DEFAULT_BUDGET_USD` default were all
  read directly — confirming the converge panel is the path that inherits it.
- Confirmed NOT already filed: #3194 asserts "Filed separately against #3072", and neither #3072 nor
  #3151 mentions a budget anywhere. That false claim is corrected by the same change that adds this
  card.
