---
kind: story
size: 5
status: resolved
blockedBy: ["725", "950"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: "we:scripts/check-standards-rules.mjs"
tags: []
---

> **blockedBy `950` added 2026-06-18 (batch pre-flight).** The flag only flips green once **all 6**
> domains ship an unplugged test — including `webguards`, whose FUI home is being created right now by
> active **#950** (port webguards guard runtime into FUI). Its unplugged test can't be placed until that
> port lands, so the flag-flip can't complete. Unblocks when #950 resolves.

# Backfill remaining unplugged-mode plug tests and flip PLUG_UNPLUGGED_TEST_ENFORCED to error

The #636 dual-mode gate warns on any plug domain missing an unplugged-mode (non-invasive) test. #649 backfilled 3, leaving 6 warning: webcontexts, webdirectives, webexpressions, webstates, webguards, webvalidation. Flipping `PLUG_UNPLUGGED_TEST_ENFORCED` (we:scripts/check-standards-rules.mjs) to true turns the warns into errors — fully automating the #606 "no plug may require plugged mode" invariant — but only goes green once ALL domains ship one. This item backfills the remaining 6 (modelled on #649's tests) then flips the flag. Note: webguards/webvalidation's home is FUI (#725), so coordinate their test placement with that port and #449's deletion of WE's `plugs/`.

## Progress — resolved in batch-2026-06-18

When this item was written (2026-06-15) **6** domains warned. By now the WE gate (which walks WE's own
`we:plugs/`, per `we:scripts/check-standards.mjs` §8b) was already green on **4** of them (webcontexts,
webdirectives, webexpressions, webstates backfilled since; webbehaviors covered by a shared test) — so the
real remaining set had converged to exactly **webguards + webvalidation** (= the #951 hand-off scope, now
subsumed here).

- **Authored both unplugged-mode tests** (modelled on `we:plugs/webstates/__tests__/unit/webstates.unplugged.test.ts`):
  `we:plugs/webguards/__tests__/unit/webguards.unplugged.test.ts` (standalone `CustomGuardRegistry` +
  `createDefaultGuardRegistry` resolve/evaluateRegion, native-first permissive default, two scoped
  registries independent) and `we:plugs/webvalidation/__tests__/unit/webvalidation.unplugged.test.ts`
  (both the validity-merge #215 and validator-resolution #224 registries: default-key resolution + scoped
  independence). Both are non-invasive — neither plug installs a global patch. 8 tests green.
- **Flipped `PLUG_UNPLUGGED_TEST_ENFORCED` → true** in `we:scripts/check-standards-rules.mjs` — the warn
  now promotes to error, automating the #606 "no plug may require plugged mode" invariant. WE
  check:standards green (0 errors); 162 check-standards-rules unit tests green (the flag-adaptive bucket
  assertion still passes).
- **FUI canonical carry-forward → noted on #449** (the terminal plugs dedup, deferred). Per #606 the
  canonical home is FUI; these new tests live in WE's `plugs/` (the tree the gate currently walks) and
  #449 — which owns WE→FUI plug-test relocation — will carry them across when it deletes `we:plugs/`. Not
  duplicated into FUI now to avoid adding to the #170 churn #449 must reconcile.
