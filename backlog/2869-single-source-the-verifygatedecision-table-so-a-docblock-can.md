---
bornAs: xridvpy
kind: story
size: 2
status: open
relatedTo: ["2833"]
scope: ["we:scripts/lib/lane-verify.mjs", "we:scripts/pr-land.mjs", "we:scripts/__tests__/lane-verify.test.mjs"]
dateOpened: "2026-08-02"
tags: [gate, verification, docs-drift]
---

# Single-source the verifyGateDecision table so a docblock cannot contradict a cell

Correct the four sites that still claim a `running` marker is refused unconditionally (the #2833 TTL degrade made that false), then make the drift structurally impossible: export the gate's cells as one frozen table and pin every documented cell to a real `verifyGateDecision` call in a test.

## Why — the same drift hit this gate twice in one review

`verifyGateDecision` (`we:scripts/lib/lane-verify.mjs`) is a decision table: `{absent, running, red, green, corrupt, other-sha}` × `requireVerified` × `breakGlass`. Both rounds of the #983 review found a **cell whose prose and code disagreed**, in the same function:

- **Round 1, finding 2** — the docs promised "absent/**red** under `--require-verified`" while the code refused a matching `red` unconditionally. Fixed by making `red` conditional.
- **Round 3 (the accept pass)** — finding 1's fix made a past-TTL `running` record degrade to the non-blocking `untracked` verdict when `requireVerified` is false, but four sites still assert the old unconditional rule.

Twice is a class, not a slip. The prose is written by hand from the author's mental model of the table, so any cell that later moves leaves a true-sounding sentence behind — and the sentence is what the next reader (and the next reviewer) trusts.

## The four stale sites

Each says, in substance, "a `running` marker is always refused", which is now false in the default (non-`--require-verified`) mode:

- `we:scripts/lib/lane-verify.mjs` — the `DEFAULT_VERIFY_TTL_MINUTES` docblock: "This only refines the human message (`abandoned` vs `in-flight`) … so the gate refuses regardless of age."
- `we:scripts/lib/lane-verify.mjs` — the `verifyGateDecision` docblock: "'never finished' (`running`) is always refused".
- `we:scripts/pr-land.mjs` — the finish-guard block comment: "A `running` marker for THIS HEAD is ALWAYS refused (a half-run must never look complete)".
- #2833's own resolution bullet: "REFUSES when the verification is `running` (unfinished — the exact stall) always".

The last one matters most: a resolution note is a durable record that later items cite as settled precedent.

## The guard

A lint for "a comment saying *always* must match the code" is not script-decidable. What **is** decidable is the pattern this repo already uses for the `check-standards` policy contract (pinned equal to the engine's exported constants): **single-source the contract, then test the prose against it.**

- Export the cells as one frozen `VERIFY_GATE_TABLE` — each entry `{ status, requireVerified, breakGlass, ok, reason, summary }`, where `summary` is the one-line human description.
- `verifyGateDecision` reduces **through** that table, so a cell cannot change without the table changing.
- The docblock summary is derived from (or asserted equal to) the table's `summary` strings, so editing behaviour without editing the prose fails a test rather than shipping.
- A unit test walks every table row, calls `verifyGateDecision` with that row's inputs, and asserts the returned `{ ok, reason }` — no documented cell may be unreachable, and no reachable cell may be undocumented.

## Design

**The seam already exists — nothing new is stood up.** `verifyGateDecision` in
[we:scripts/lib/lane-verify.mjs](scripts/lib/lane-verify.mjs) is the single decision point (the pure DECISION
half of the module, per its own header docblock); `we:scripts/__tests__/lane-verify.test.mjs` is the existing
suite.

**Consumer inventory — TWO production callers, not one** (checked both ways, ES imports and subprocess entry
points):

- `we:scripts/pr-land.mjs` — the finish-guard call.
- `we:scripts/verify-lane.mjs` — its `check` subcommand calls `verifyGateDecision` directly; it is a
  subprocess entry point delivery agents invoke (see `we:skills-src/conveyor/delivery-agent-brief.md`), so it
  is reached without an import edge from `we:scripts/pr-land.mjs`.
- `we:scripts/operations/open-pr.mjs` mentions the function in a docblock only — no call site, nothing to
  change.

The refactor preserves `verifyGateDecision`'s external signature and return shape, so neither caller needs an
edit; the inventory matters because the **prose** correction must sweep both files (only
`we:scripts/pr-land.mjs` currently carries a stale "ALWAYS refused" comment, so `we:scripts/verify-lane.mjs`
needs no prose fix — confirmed, not assumed).

**The reachable cells, read off the current branches.** `verifyGateDecision` returns
`{ ok, status, reason, detail }` and today discriminates in this order: `breakGlass` →
`record.corrupt` → `matches && status==='green'` → `matches && status==='running'` (split on
`isVerifyAbandoned(rec, nowMs, ttlMs) && !requireVerified`) → `matches && status==='red'` (split on
`requireVerified`) → the no-marker / other-sha tail (split on `requireVerified`). That is **10** reachable
`(status, requireVerified, breakGlass, pastTtl) → (ok, reason)` cells — the table below is the authoritative
count; it has ten rows:

| status | requireVerified | breakGlass | pastTtl | ok | reason |
| --- | --- | --- | --- | --- | --- |
| any | any | true | any | true | `break-glass` |
| corrupt | any | false | — | false | `verify-corrupt` |
| green (sha matches) | any | false | — | true | `verified` |
| running (sha matches) | false | false | true | true | `untracked` |
| running (sha matches) | false | false | false | false | `verify-unfinished` |
| running (sha matches) | true | false | any | false | `verify-unfinished` |
| red (sha matches) | true | false | — | false | `verify-red` |
| red (sha matches) | false | false | — | true | `red-ci-gated` |
| absent / other-sha | true | false | — | false | `unverified` |
| absent / other-sha | false | false | — | true | `untracked` |

**Shape of the export.** `summary` is the one-line human sentence the four prose sites must agree with; it is
NOT the runtime `detail` (which interpolates SHAs, TTLs and timestamps and so cannot be a constant).

```js
// we:scripts/lib/lane-verify.mjs
/** The frozen decision table — the ONLY home for the gate's cells. `detail` stays computed per call. */
export const VERIFY_GATE_TABLE = Object.freeze([
  Object.freeze({ status: 'running', requireVerified: false, breakGlass: false, pastTtl: true,
                  ok: true,  reason: 'untracked',
                  summary: 'a past-TTL `running` marker degrades to `untracked` when `--require-verified` is not set.' }),
  // … one frozen entry per row above; `pastTtl: null` means "the cell does not depend on it"
]);

/** The cell this input set lands on, or `null` if the table has no entry for it (an undocumented branch). */
export function lookupVerifyGateCell({ status, requireVerified, breakGlass, pastTtl } = {}) { /* … */ }
```

`verifyGateDecision` keeps its signature and its computed `detail`, but takes its `{ ok, reason }` from
`lookupVerifyGateCell`, so a behaviour change that skips the table is a missing cell rather than a silent
divergence.

**A table miss must FAIL LOUD, not degrade.** If `lookupVerifyGateCell` ever returns `null` for an input
combination a future edit introduces, `verifyGateDecision` **throws** with the offending
`(status, requireVerified, breakGlass, pastTtl)` tuple in the message. It must not return an `undefined`
`{ ok, reason }` and it must not fall back to a default cell: a gate that silently answers "no opinion" reads
as `ok: undefined` downstream, which is falsy, which is the fail-*open*-looking-like-fail-closed shape this
module's `corrupt` handling already refuses (#2833 finding 5). The completeness case in `## Done when` catches
this pre-merge for the shipped table; the throw is what covers drift after.

**Sequencing matters here** — do the prose correction first, so the four stale sites are fixed even if the
structural half is bounced:

1. Correct the four sites listed above (two docblocks in `we:scripts/lib/lane-verify.mjs`, the finish-guard
   block comment in `we:scripts/pr-land.mjs`, and #2833's resolution bullet).
2. Add `VERIFY_GATE_TABLE` + `lookupVerifyGateCell`, reduce `verifyGateDecision` through them.
3. Add the two table-walk cases to `we:scripts/__tests__/lane-verify.test.mjs`.

## Done when

1. **Executable** — `npx vitest run lane-verify` (the suite at
   [we:scripts/__tests__/lane-verify.test.mjs](scripts/__tests__/lane-verify.test.mjs)) is green with a new
   round-trip case that, for **every** entry in `VERIFY_GATE_TABLE`, constructs the matching `record`/flags
   and asserts the real `verifyGateDecision` call returns that entry's `{ ok, reason }`. Fails today (no
   such export exists); passes once the table drives the branches.
2. **Executable** — the same suite carries the **both-directions** completeness case: a fuzz over the full
   input cross-product (`status` ∈ `{green, running, red, corrupt, absent, other-sha}` × `requireVerified` ×
   `breakGlass` × past/fresh TTL) asserts every produced `{ ok, reason }` pair is present in
   `VERIFY_GATE_TABLE` (no undocumented reachable branch), and that every table entry was hit at least once
   (no unreachable documented cell).
3. **Observable** — one `grep` for `always refused` / `ALWAYS refused` / `refuses regardless of age` across
   [we:scripts/lib/lane-verify.mjs](scripts/lib/lane-verify.mjs),
   [we:scripts/pr-land.mjs](scripts/pr-land.mjs) and #2833's card returns **no** line asserting an
   unconditional `running` refusal. All four sites instead state the real rule: a **fresh in-flight**
   `running` is refused; a **past-TTL** `running` degrades to `untracked` when `requireVerified` is false and
   is refused under it.
4. **Executable** — `npm run check:standards` reports 0 errors.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: check by mutation or reversion ahead of the build) — The card's claim that four sites still assert an unconditional "running is always refused" rule was re-verified against the live repo: we:scripts/lib/lane-verify.mjs (the DEFAULT_VERIFY_TTL_MINUTES docblock and the verifyGateDecision docblock), we:scripts/pr-land.mjs ("refused UNCONDITIONALLY" near its --require-verified flag comment), and we:backlog/2833-subagent-stall-reaping-detect-a-subagent-blocked-on-a-backgr.md ("always" in the resolution bullet) all still read exactly as the card describes, while the actual verifyGateDecision code path does allow a past-TTL running marker to degrade to untracked when requireVerified is false. The premise holds.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The card's Design section names we:scripts/pr-land.mjs as "its production caller" (singular), but we:scripts/verify-lane.mjs also imports and calls verifyGateDecision directly (its `check` subcommand, documented in we:skills-src/conveyor/delivery-agent-brief.md as a subprocess entry point delivery agents invoke). The refactor preserves verifyGateDecision's external signature/contract and no stale "always refused" prose exists in we:scripts/verify-lane.mjs to miss, so this is an incomplete consumer inventory in the write-up rather than a functional gap.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The proposed guard is a round-trip test calling the real verifyGateDecision (not a mock) plus a bidirectional fuzz across the full input cross-product (no undocumented reachable cell, no unreachable documented cell), which is a substantive behavioral guard rather than a decorative one.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — The design leaves unspecified what verifyGateDecision does at runtime if lookupVerifyGateCell ever returns null for a future input combination absent from the table — throw loudly, or silently return undefined {ok, reason}. The Done-when completeness test catches this pre-merge for the shipped state, so it isn't exploitable at ship time, but the prose doesn't commit to a fail-loud contract for future drift.

**Corrections applied by this review:**

- The card states the reachable-cells table has "9 reachable ... cells" but then lists 10 distinct rows (break-glass, verify-corrupt, verified, untracked/pastTtl-running, verify-unfinished×2, verify-red, red-ci-gated, unverified, untracked/no-match) — the count is off by one against its own table.

The card accurately identifies four genuinely stale "running is always refused" sites (re-verified against the live repo) and proposes a sound, precedented single-source-table fix with a real round-trip + bidirectional-completeness test; only minor issues surface: a self-contradictory cell count (9 claimed vs 10 listed) and an incomplete consumer inventory that omitted we:scripts/verify-lane.mjs's own call site (functionally harmless given the preserved signature).

_Recorded through the declared `review-prep` operation._

**Applied by the lane, 2026-08-21.** All three points above are now folded into the body: the cell count reads
**10** (matching its own table), the Design section carries a two-caller consumer inventory naming
we:scripts/verify-lane.mjs (confirmed by grep: `we:scripts/verify-lane.mjs:95` calls `verifyGateDecision`
directly; `we:scripts/operations/open-pr.mjs` only mentions it in a docblock), and the Design now commits
`verifyGateDecision` to THROW on a table miss rather than degrade. No finding was judged wrong.
