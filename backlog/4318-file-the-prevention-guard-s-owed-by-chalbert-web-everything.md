---
bornAs: x7at0uc
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/lib/citation-check.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/citation-check.test.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/conveyor/health-smells/dispatch-permission-stall.mjs", "we:scripts/conveyor/health-smells/dispatch-trust-refused.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "755a028a365b4e3a32068358009c09c97d84f7a1"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2824's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-smells/dispatch-trust-refused.mjs:38` — A check:standards rule that resolves every `we:backlog/<id>-*.md` string literal embedded in source (comments or runtime strings) against the actual backlog directory and flags any that don't match an existing file — the repo already runs a check:standards pass per the PR description, so this slots into existing infrastructure.
2. `we:scripts/operations/__tests__/dispatch-lane.test.mjs:849` — Add an execution counter to the repeated-refusal test and assert exactly two calls; this deterministic assertion guards retry bounds on persistent failures.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2824@636c8553c09ba6415b30343473049cde6aa744b4

## Design

**Scope correction (prepare-first step 2):** the `:38`/`:849` locators on the two guards above are
*evidence* pointers (where a live instance of each problem sits), not the implementation target. Guard 1's
implementation is a check:standards rule, which — per the guard's own text — "slots into existing
infrastructure": `we:scripts/lib/citation-check.mjs` (the pure detector core) + `we:scripts/check-standards.mjs`
(the fs-reading gate wiring), the same shape every sibling citation gate in that file already follows.
`we:scripts/conveyor/health-smells/dispatch-trust-refused.mjs` itself needs no code change for guard 1 — it
only supplied the example literal. Guard 2's implementation is exactly where it points
(`we:scripts/operations/__tests__/dispatch-lane.test.mjs`). Scope corrected above to the real touch-set; the
originally-declared health-smell file/its `__tests__` file are dropped from "files to add a rule to" and
kept only because a MANUAL audit while building guard 1 (not the gate itself — see the correction below)
turned up two real, live hygiene/dangling citations, one of which touches that same file.

**Guard 1 — new citation gate.** Add `findDanglingBacklogGlobCite(text, relPath, { resolvableIds })` to
`we:scripts/lib/citation-check.mjs`: matches the literal wildcard-glob citation convention `backlog/<id>`
followed by a literal `-*.md` (not a real slug — ~93 corpus hits) and flags any whose `<id>` resolves to
NEITHER a currently-tracked item's `num` NOR any backlog item's `bornAs` hash. This is a genuinely new gate —
the closest existing sibling, gate 6f-ii-c (`findHashPathCiteOutsideBacklog`), only matches a citation
carrying a REAL slug (`[A-Za-z0-9-]+`, no `*`) and flags the FORM unconditionally; it can't and doesn't match
the wildcard-glob convention at all, and none of gates 3/3b/5/10 do either (verified by reading all of
`we:scripts/lib/citation-check.mjs`). Wire it into `we:scripts/check-standards.mjs` as a new try-block
("6f-ii-d"), same WARN-vs-err posture as its siblings (`CITATION_GATES_ENFORCED`), reusing the already-loaded
`backlog` array (no extra fs pass) to build `resolvableIds`. Deliberately outside the Rust-port branch,
matching 6f-ii-c's own precedent (the port covers only the four original gates; parity is unaffected).

**Correction (round-1 panel review — correctness/claim-accuracy):** `resolvableIds` counts a `bornAs` hash as
resolving, by design (mirroring gate 3b: a landed item's birth hash is a STALENESS/hygiene issue — "cite the
current id instead" — never a "resolves to nothing" defect). An id that graduated hash→NNN therefore does
NOT trip this gate; the panel caught an earlier draft of this card wrongly claiming the gate itself
"discovered" that exact case. What the gate DOES catch — confirmed by running its resolution logic against
this real tree with the full `backlog` array — is an id with no `num` and no `bornAs` match anywhere: exactly
one such instance exists on this tree today (`we:scripts/conveyor/reconcile-core.mjs`, id `x9wz0ir`), filed
separately rather than fixed here (outside this item's declared scope) — see Follow-ups.

**Guard 2 — deterministic retry-bound assertion.** The "if the retry ALSO refuses on trust" test in
`we:scripts/operations/__tests__/dispatch-lane.test.mjs` throws on every `exec()` call but never counts
calls, unlike its sibling ("re-grants opts.cwd and retries once", which already asserts `calls === 2`). Add
the same counter and `expect(calls).toBe(2)` — proves the retry-once bound holds even on a persistently-failing
retry, not just the happy-path retry.

## MVP (Musts only)

1. `findDanglingBacklogGlobCite` in `we:scripts/lib/citation-check.mjs` + unit tests in
   `we:scripts/__tests__/citation-check.test.mjs` (resolves / dangling / per-file dedup / test-file exemption).
2. Wired into `we:scripts/check-standards.mjs` as a new WARN-level gate, reusing the loaded `backlog` array.
3. `we:scripts/operations/__tests__/dispatch-lane.test.mjs`: execution-counter assertion on the
   repeated-refusal test (guard 2).
4. Fix the 5 stale glob citations a manual audit (while building the gate) found, all naming the id
   `4238` — which graduated to `#4238` — instead of the current id: re-point them to `#4238` in
   `we:scripts/operations/dispatch-lane-io.mjs`, `we:scripts/conveyor/health-smells/dispatch-permission-stall.mjs`
   (×2), `we:scripts/conveyor/health-smells/dispatch-trust-refused.mjs`, and
   `we:scripts/operations/__tests__/dispatch-lane.test.mjs` (×1). (Per the correction above, the new gate does
   NOT itself flag these — `bornAs` resolves — so this is a hygiene fix the audit surfaced, not the gate's own
   proof case; that proof case is `x9wz0ir`, filed separately per Follow-ups.)

## Test plan

- `we:scripts/__tests__/citation-check.test.mjs`: new `describe` block for `findDanglingBacklogGlobCite` —
  dangling hash id, dangling numeric id, a resolving id (via `num` and via `bornAs`), per-file/per-id dedup,
  test-file path exemption. Each new assertion fails against the pre-fix export (function doesn't exist) and
  passes after.
- `we:scripts/operations/__tests__/dispatch-lane.test.mjs`: the repeated-refusal test gets a call counter and
  `expect(calls).toBe(2)`. Round-3 red-team correction: this closes a COVERAGE gap, not a red-before-fix
  defect — the underlying retry-once behavior already held on the old code (only the assertion proving it
  was missing), so this does not fail before and pass after; it adds a deterministic assertion the old test
  had no way to fail even if the bound broke.

## Proof plan (live before/after)

Ran the new gate's actual resolution logic (`findDanglingBacklogGlobCite` + a `resolvableIds` set built the
same way `we:scripts/check-standards.mjs` builds it — every backlog item's `num` UNION every item's `bornAs`)
against this real tree's full `git grep` hit set for the wildcard-glob pattern, before touching any source
file: **one** genuine zero-resolution finding — `we:scripts/conveyor/reconcile-core.mjs` citing id `x9wz0ir`,
which matches no `num` and no `bornAs` anywhere on the tree. That is the gate's real "before" catch; it is
filed separately (see Follow-ups) rather than fixed in this PR (outside this item's declared scope).
Separately, a manual `git grep` for the specific id `4238` found 5 STALE citations (see MVP item 4) — that
id resolves via `#4238`'s `bornAs`, so the new gate does not flag them, but the citation itself names an id
that no longer matches any file, which is worth fixing as hygiene. After the fix: re-running the same
`git grep` for that specific id, restricted to non-test source files, returns zero hits.

## Follow-ups

- `we:backlog/4482-*.md` — fix the one citation the new gate actually flags today
  (`we:scripts/conveyor/reconcile-core.mjs`, id `x9wz0ir`, resolves to nothing) — filed rather than fixed here
  since it's an unrelated file outside this item's declared scope.
- `we:backlog/4483-*.md` — `we:scripts/conveyor/health-smells/dispatch-trust-refused.mjs` has no unit test
  at all, unlike its sibling `we:scripts/conveyor/health-smells/dispatch-permission-stall.mjs` — a real but
  unrelated coverage gap, filed rather than folded in here.

## Done when

1. **Executable** — a `vitest related` pass over the touched files (`we:scripts/lib/citation-check.mjs`,
   `we:scripts/check-standards.mjs` — drop the `we:` locus prefix when actually typing the shell command,
   it is a citation form, not a filesystem path) is green with the new `findDanglingBacklogGlobCite` tests
   included, and `git grep -n 'backlog/4238-\*\.md' -- . ':!backlog' ':!*.test.mjs'` exits 1 (no matches
   — the 5 stale glob citations the build's own audit found are fixed; a bare `#4238` cross-ref is fine
   and expected to remain, since it always resolves via `#4238`'s `bornAs` regardless of rename).
