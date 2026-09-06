---
kind: story
size: 3
status: open
dateOpened: "2026-09-06"
tags: []
relatedReport: reports/2026-09-06-open-story-staleness-audit.md
---

# Coverage deleted by the WE-is-contract-only migration was never ported to FUI, and the resolved cards that promised it were never revisited

A class the 2026-09-06 resolved-card sweep surfaced that is worse than a stale path: work that WAS delivered, then deleted by a later refactor, leaving a resolved card whose acceptance clause has no artifact anywhere. Two confirmed. #1010 promised a plugged browser e2e for webvalidation; it landed in we:plugs/__tests__/e2e/ and was deleted with the whole we:plugs/ tree by #1047, and the plugged seam was never ported - the surviving frontierui:plugs/webvalidation/__tests__/ file is an UNPLUGGED vitest test from #1857, the opposite seam. #1161 promised CEM-derivation hardening plus derivation unit/golden tests; both landed and were deleted by #1730 per #1282/#1771, and a repo-wide grep for productionDelivery, deliverModule and PackageManifest across all three repos returns zero. The deletions were deliberate architecture; the lost coverage was not decided on. Decide per case: port the seam to FUI, or record on the card that the clause is intentionally retired. Also breaks #312, which cites the same dangling path.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Done when

1. For **#1010**: either a plugged browser e2e exercising `<validity-merge-field>` /
   `<async-validator-field>` through `frontierui:plugs/bootstrap.ts` exists in FUI, **or** #1010 carries a dated line
   recording that the plugged seam is intentionally retired and why.
2. For **#1161**: either the CEM-derivation hardening + its derivation unit/golden tests exist under
   FUI, **or** #1161 carries the same dated retirement line.
3. Neither card is left `resolved` with a `graduatedTo` naming a deleted path — each points at a live
   artifact or is explicitly `none` with the retirement note.
4. #312, which cites the same dangling `productionDelivery` path, is re-pointed or re-scoped.

## Why this class matters more than a stale path

A relocated path is a bookkeeping error — the capability still exists. This class is different: the
capability is **gone** and the card still says it shipped. Nothing in the tree disagrees, because the
only record that it ever existed is a resolved card pointing at a deleted file.

Both deletions were correct architecture (`#1282`/`#1771` — WE holds contract only). What was never
decided is whether the *coverage* those cards promised should have moved with the code. The resolve
gate #3502 is building will catch a future instance at land time; this card settles the two already on
the board.

## Evidence (2026-09-06)

| Card | Delivered by | Deleted by | Live artifact today |
|---|---|---|---|
| #1010 | WE `5513a7d3` (+102-line Playwright spec) | #1047 (`e702bebe`, 215 files / 32,741 deletions) | none for the *plugged* seam |
| #1161 | WE `629230ce` (`ProductionDeliveryOptions.manifest`, `DERIVED_MANIFEST_FIELDS`) | #1730 (`f0ee0584`) | none — grep returns zero in all three repos |
