---
type: idea
workItem: task
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: "scripts/check-standards-rules.mjs — extracted pure backlog rules + scripts/__tests__/check-standards.test.mjs harness"
tags: [tooling, check-standards, testing, harness, validation, coverage]
crossRef: { url: /backlog/, label: Backlog }
---

# Give `we:check-standards.mjs` a unit-test harness so validator rules get real fixtures

Surfaced closing out [#247](/backlog/247-graduated-to-value-resolution/) (graduatedTo value
resolution). That item asked for "a couple of fixture cases in whatever exercises `check-standards`" —
but **there is no such harness**: `we:scripts/check-standards.mjs` is a top-to-bottom script with no
exported, individually-testable rules, and **no rule has a unit test**. The only validation today is the
**live run** over the real registries (`npm run check:standards`), so a new rule can only be proven by
hand-running it (#247 fell back to a throwaway negative-path script + a manual dry-run over the real
backlog). The one unit-tested sibling is the *autofix engine*
(`we:scripts/autofix/__tests__/engine.test.mjs`), not the validator itself.

This is fine for a validator that's *only* ever run live, but it makes each new rule's correctness
(false-positive safety especially) a manual, un-regressed check. As the validator grows
(graduatedTo resolution, cross-ref resolution, agile-sizing invariants, the `--json` descriptor
contract for #095/#196/#197), a harness pays off.

## What to do

- **Make the rules testable.** Either (a) refactor the rule bodies into small pure functions that take
  loaded registries + an item and return `{errors, warnings}` (exported from a module the script
  composes), or (b) add a thin entry point that runs the whole validator against a **fixture data dir**
  (synthetic `src/_data/*.json` + `backlog/*.md`) and asserts the emitted errors/warnings — whichever
  keeps the single-source live behavior intact.
- **Seed fixtures for the high-value rules**, starting with the cases #247 had to prove by hand:
  a compact `graduatedTo: intnet:droplist` (unknown kind → error), `intent:droplsit` (unresolved slug →
  error), `intent:motion` / `none` / a free-form prose value (all clean), plus an unresolved
  `relatedProject`/`crossRef` and a non-Fibonacci `size`.
- **Assert false-positive safety** explicitly — the dry-run #247 ran ("every existing real value stays
  clean") should become a standing test so a future rule tightening can't silently start erroring on
  legitimate free-form data.

## Notes

- Distinct from [#067](/backlog/067-jsx-adapter-demo-testing/) (JSX *adapter demo* testing) and the
  autofix engine tests — this is the **validator's own** rule coverage.
- Not blocking: the live run remains the production gate; this is hardening so rule changes are
  regression-safe instead of manually re-verified each time.
