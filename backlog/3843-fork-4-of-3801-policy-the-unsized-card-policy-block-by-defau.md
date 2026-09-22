---
bornAs: xlq2jh7
kind: story
size: 2
parent: "3717"
status: resolved
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs", "we:scripts/lib/dispatch-size-policy.json", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
graduatedTo: none
tags: []
---

# Fork 4 of #3801, policy: the unsized-card policy (block by default, or a settable default-size) and the fixSizeSource chain as one checked-in setting, with every fallback recorded

Ruled in #3801 Fork 4 (b): unsizedCardPolicy is block by default, or default-size with defaultSize (13 is the old 900-line behaviour); fixSizeSource defaults to the ordered chain card-size, measured-diff, assumed, and every value stays settable (policy only with default-size). Today estimatedLocForSize silently reads an absent size as the 13 band (we:scripts/lib/dispatch-contracts.mjs:737-742). This slice adds the setting, its validation and the record of where a fallback number came from; admission and the fix path are sibling slices.

**Home:** the prototype branch `lane/mechanical-dispatcher` (`we:scripts/lib/dispatch-contracts.mjs` exists only there, checked on `5ab89f87b`). The setting file is new; `we:scripts/lib/dispatch-size-policy.json` is the predicted name, beside `we:scripts/lib/poc-branches.json`. Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**The ruled setting (#3801 Fork 4):**

```yaml
unsizedCardPolicy: block     # default. Or: default-size
defaultSize: 13              # read only when unsizedCardPolicy is default-size; a point from SIZE_TO_ESTIMATED_LOC
fixSizeSource: [card-size, measured-diff, assumed]   # default; any one value or another order is valid; policy only with default-size
```

**Constraint carried from the ruling, enforced here:** a `defaultSize` below `13` makes unsized cards eligible for delegation on an unmeasured number, and must not be enabled before #3784's rule-3 and rule-6 fixes land. So the loader refuses a `defaultSize` below `13` with a reason that names #3784; #3784 removes that refusal.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs` passes with new cases that fail before: (a) the checked-in setting loads as `block`, `13` and the three-step chain; (b) `fixSizeSource: [policy]` with `unsizedCardPolicy: block` is refused as invalid; (c) `defaultSize: 2` is refused with a reason naming #3784; (d) under `default-size` an unsized route records `sized: false` and the setting's name and value as the source of its size, and a sized route records the card as the source.
2. **Executable** — on the branch, `test -f we:scripts/lib/dispatch-size-policy.json` succeeds and the file parses as JSON (it does not exist today).

> **Verified done, 2026-09-22.** Already built and committed straight to `lane/mechanical-dispatcher` at
> `375d95fb5` ("#3843 dispatch-contracts: the checked-in unsized-card size policy (#3801 Fork 4 (b))"), ahead
> of this card being picked up. Re-verified: `we:scripts/lib/dispatch-size-policy.json` exists and parses;
> `we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs` carries the `fixSizeSource: [policy]` refusal
> and the `defaultSize: 2` refusal naming #3784 (`:155-164`), and passes. Resolved here as
> `graduatedTo: none` — the code is not yet on `main`; it reaches `main` through #3443, per this card's own
> `Home:` section.
