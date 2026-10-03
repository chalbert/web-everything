---
bornAs: xwx7fbq
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "afb711055c4f300be8c01a8e32eef92ec8c71733"
tags: []
---

# Prevention — Derive selfNum from the loaded item's num (backlog.find by id) or the shared ID_TOKEN, and add a hash-i… (from chalbert/web-everything#3326 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/check-standards.mjs:989` — Derive selfNum from the loaded item's `num` (backlog.find by id) or the shared ID_TOKEN, and add a hash-id fixture test. A lint banning ad-hoc `^(\d+)-` filename parsing in we:scripts/check-standards.mjs would also cover the class.
2. `we:scripts/__tests__/check-standards.test.mjs:603` — Store the baseline in a committed file and have the test fail only on increases from touched cards, or scope the ratchet to cards changed in the diff.
3. `we:scripts/check-standards.mjs:989` — Add a deterministic integration test asserting that a hash-prefixed card referencing itself in deferredBlockedBy produces a standards error; extract self IDs using the repository's canonical numeric/hash ID parser.
4. `we:scripts/check-standards.mjs:989` — A unit test in `we:scripts/__tests__/check-standards.test.mjs` asserting that a hash-prefixed item flags a self-edge when its hash is present in its own `deferredBlockedBy` array.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3326@68cb4a99f739e457e61571d13ee1f415964c5f5b

## Premise check (2026-10-03, against `origin/main` afb711055)

Verified, not delivered: `git log -S'selfNum'` shows only #4448 (68cb4a99f) introduced it. The line is now `we:scripts/check-standards.mjs:996` (card cites :989 — drift only). `selfNum = (/^(\d+)-/.exec(id) || [])[1]` yields `undefined` for every hash-named card (246 `x…` cards exist), so `deferredBlockedByFindings` (`we:scripts/check-standards-rules.mjs:3886`) skips its `selfId` branch. Worse, a hash card citing itself passes silently: its hash is in `seenNums` (`we:scripts/check-standards.mjs:786`), so it never reaches "does not resolve" either. Scope is accurate; test file line 603 is now the corpus-ratchet test at ~`we:scripts/__tests__/check-standards.test.mjs:596`.

## Design

`we:scripts/check-standards.mjs:118` already imports `isHash` from `we:scripts/backlog/id.mjs`; also import `idFromName` (`we:scripts/backlog/id.mjs:46`, backed by the canonical `ID_TOKEN_RE` handling both `\d{1,5}` and `x[0-9a-z]{6}`). Extract the per-card step at lines 996-997 into a pure function `cardDeferredBlockedByFindings(id, raw, seenNums)` in `we:scripts/check-standards-rules.mjs` that derives the self id with `idFromName(id)` and returns `deferredBlockedByFindings(raw, seenNums, selfId)`; the loop calls it, so no inline filename regex remains. No change to `deferredBlockedByFindings`, which already compares `String(selfId)`.

## MVP

Musts only:
1. Line 996 uses `idFromName(id)` (item 1 of card; item 3/4 production half).
2. Unit test: hash `selfId` with its own hash in `deferredBlockedBy` yields a `self-edge` finding (item 4).
3. Integration-style test over the loop's derivation: a hash-named filename run through the same derivation + `deferredBlockedByFindings` yields a self-edge error (item 3).

Out of scope → Follow-ups.

## Test plan

- `deferredBlockedByFindings flags a hash-prefixed self-edge`: `deferredBlockedByFindings({deferredBlockedBy:['xabc123']}, new Set(['xabc123']), 'xabc123')[0]` matches `/self-edge/`. Passes already at the function level (it is string-compared), so it pins the contract.
- `cardDeferredBlockedByFindings flags a hash-named self-edge` (Must 3): `cardDeferredBlockedByFindings('xabc123-slug', {deferredBlockedBy:['xabc123']}, new Set(['xabc123']))[0]` matches `/self-edge/`; the numeric twin `('4448-foo', {deferredBlockedBy:['4448']}, new Set(['4448']))` also does. RED before: the old inline `^(\d+)-` derivation gives `undefined` for the hash name, so the same inputs yield `[]` (the function does not exist yet, and a port of the old inline regex fails this assertion). It is tied to the loop because the loop calls this function.
- Gate-level (the proof, not a committed test): a temp hash card listing itself in `deferredBlockedBy` makes `check:standards` report `self-edge` (RED on current main: no error).

## Proof plan

Precondition: the probe has valid frontmatter (kind, status, dateOpened, hash id, `bornAs` matching) so no unrelated error muddies the baseline; grep the output for exactly `xzzzzz1" is a self-edge` and record both outputs. Before/after on the live gate: create a throwaway `we:backlog/xzzzzz1-probe.md` (not committed) with `deferredBlockedBy: ["xzzzzz1"]`; `npm run check:standards` shows no self-edge error on `origin/main`, and shows `deferredBlockedBy "xzzzzz1" is a self-edge` after the fix. Delete the probe.

## Follow-ups

- Card item 2: move the corpus-ratchet ceiling (`we:scripts/__tests__/check-standards.test.mjs` ~:596, `<= 190`) to a committed baseline file / diff-scoped check.
- Card item 1 tail: a lint banning ad-hoc `^(\d+)-` filename parsing in `we:scripts/check-standards.mjs`.

## Done when

1. **Executable** — `npx vitest run` on the `we:scripts/__tests__/check-standards.test.mjs` file passes, and `npm run check:standards` errors on a hash-named card listing its own hash in `deferredBlockedBy`.
