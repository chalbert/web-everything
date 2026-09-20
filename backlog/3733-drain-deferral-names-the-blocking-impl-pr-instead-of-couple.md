---
bornAs: x4e6oux
kind: story
size: 3
parent: "2445"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs-couple-join-and-drain-verdicts.test.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Drain deferral names the blocking impl PR instead of `couple-carrier:unknown`

The drain defers a WE carrier PR whose impl half is still open, but prints `couple-carrier:unknown`. The blocking impl PR is never named, so plain “waiting on an un-reviewed impl PR” looks like a mystery.

## Evidence

Observed live in drain history, 2026-09-08 to 2026-09-20:

- PR web-everything#2072 (item #3140, the `active→resolved` flip) was deferred on EVERY drain pass for 12 days, about one pass every 80 s. The last recorded history row (`history.jsonl`, 2026-09-20T12:00Z) was `deferredDetail: [{num:2072,item:3140,waitOn:["couple-carrier:unknown"]}]`.
- Its real blocker was chalbert/plateau-app#153, the impl half of the couple (manifest ref `lane/3140d-verify-gate-declared-rules`). It was OPEN, CLEAN, checks green, labelled `review:pending`, and never reviewed. Its only drain park comment was from 2026-09-08: “held — review:pending … size (905 ≥ 400 changed lines)”.
- The token never named #153. Both PRs have since landed on 2026-09-20: #153 at 12:18Z and #2072 at 12:25Z, after the operator reviewed #153. The stall is cleared; this card is only about the misleading label.
- `considered-never-merged` alerts went quiet while the stall continued because a PR in `deferredPrs` counts as “explained”. A named reason would have made the stall readable at a glance.

## Root cause

- `we:scripts/merge-ai-prs.mjs:1664` builds `coupleWait` with `couple-carrier:${c.coupleCarrier?.num ?? c.coupleCarrier?.item ?? 'unknown'}`.
- `joinImplToCouples` stamps `coupleCarrier` only on manifest-less IMPL verdicts at `we:scripts/merge-ai-prs.mjs:963`. The guard at line 949 skips carriers.
- #2072 is the CARRIER: it has the manifest. The carrier-side rule at `we:scripts/merge-ai-prs.mjs:991-997` calls `coupleImplOpen(...)` at line 994. It sets `coupleDefer = true` at line 995 and `coupleDeferReason = 'impl-open'` at line 996 unless the reason is already `held`. It never sets `coupleCarrier`, so the token falls through to `unknown`.

## Fix direction

- In the carrier-side `impl-open` rule, record the open impl ref(s) and their PR identities (repo + number). Resolve them from the blind open-PR context that already supplies `openHeadRefs` at `we:scripts/merge-ai-prs.mjs:1485-1487`. Make the wait token name each blocking impl PR, for example `couple-carrier:plateau-app#153`. Keep a stable, greppable shape.
- Carry the impl PR's review state into the plan's per-PR `deferred` entry, built at `we:scripts/merge-ai-prs.mjs:1680`, which feeds `deferredDetail`. A reader should see “waiting on plateau-app#153, review:pending since <date>”. Use a date only if the drain already has one cheaply. The blind listing at `we:scripts/merge-ai-prs.mjs:3367` fetches labels but no label timestamp, so the label alone is acceptable; do not invent a date.
- Keep the change tiny. Change only what the deferral says; preserve which PRs defer or land.

## Gate-self

This edits the drain sweep (`we:scripts/merge-ai-prs.mjs`), a gate-self file. The eventual PR will be parked `review:human` and cannot be self-cleared. This is a real card, not prototype (#3383) work; the drain is not the prototype.

## Definition of done

- [ ] A test in `we:scripts/__tests__/merge-ai-prs-couple-join-and-drain-verdicts.test.mjs` reproduces #2072's shape: a WE carrier with a manifest listing an open impl ref in another repo; the impl PR is open with `review:pending`; the carrier has `ready-to-merge` + `review:accepted`. Assert that the carrier's deferral token names the impl PR and its deferral detail carries the impl review label. Model it on “R7 — a carrier must not enter ready while its impl half is OPEN in the blind context (carrier-only narrow)” at line 481.
- [ ] The test FAILS on current main (token is `couple-carrier:unknown`) and passes after the fix.
- [ ] Existing impl-side tokens (`couple-carrier:<num>` on manifest-less impls) are unchanged. No other deferral reason changes.
- [ ] The `verify` operation (`we:scripts/operations/run.mjs verify --checkout=<lane>`) is green.

## Done when

1. **Executable** — `npx vitest run` on the couple-join test file named above fails before this item lands (the new #2072-shape case sees `couple-carrier:unknown`) and passes after. The checklist above is the full bar.
