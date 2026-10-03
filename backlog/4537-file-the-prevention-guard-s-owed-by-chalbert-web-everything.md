---
bornAs: x19eemk
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/lane-history.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/__tests__/lane-pool-lifecycle-journal.test.mjs", "we:scripts/lib/__tests__/lane-history.test.mjs", "we:scripts/__tests__/check-standards-rules-lane-journal-guard.test.mjs", "we:scripts/lib/lane-whois-core.mjs", "we:scripts/lib/__tests__/lane-whois-core.test.mjs", "we:docs/agent/delivery-loop.md", "we:scripts/conveyor/__tests__/health-watch.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "bc2b51e50a781b4ab6e1840d64121052aedc6b19"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2989's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/lane-history.mjs:175` — Add a unit test asserting `isUnsalvagedDestructiveUnpushed` is false for `litter-delete` with unpushed commits and true only for actions that reset the tree. Better: record a distinct field such as `destroyedUnpushed` at the call site instead of deriving it from the action name.
2. `we:scripts/lib/lane-history.mjs:195` — Doc note in the `we:scripts/lib/lane-history.mjs` journal header: `actor.name` is caller-declared, and `pid`/`ppid` are the trustworthy fields. If tamper-evidence is ever required, add a hash chain to the journal as a backlog item.
3. `we:scripts/lib/lane-history.mjs:298` — Add a shared `stripControlChars` in `we:lane-whois-core.mjs` and use it in `formatLaneTimeline` and the loud stderr write. Add a lint rule against interpolating raw `reason` strings into stderr or terminal output.
4. `we:scripts/check-standards-rules.mjs:4004` — Extend `LANE_MUTATION_RES` to cover `takeMarkerIf` and `rmSync(file…` in the reclaim code, and tighten the window to the enclosing function. Alternatively, route all lane mutations through one journaled helper and forbid raw calls with a lint rule.
5. `we:scripts/lib/lane-history.mjs` — Add a deterministic regression test that cleans disposable litter beside an unpushed commit, verifies the commit survives, and requires the destructive-work smell to remain silent.
6. `we:scripts/conveyor/health-watch.mjs` — Add deterministic probe tests placing a recent destructive event in a rotated file and beyond the live tail budget, and require it to remain visible throughout the configured window.
7. `we:scripts/__tests__/lane-pool-lifecycle-journal.test.mjs:1` — A standard review checklist ensuring all distinct mutation paths (like `refresh --force` vs `reclaim --override`) claimed in the PR description have corresponding integration tests.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2989@6aa47e21043d9ecc5c994dd4c95e4a4027989780

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/lane-history.test.mjs we:scripts/lib/__tests__/lane-whois-core.test.mjs we:scripts/__tests__/check-standards-rules-lane-journal-guard.test.mjs we:scripts/__tests__/lane-pool-lifecycle-journal.test.mjs we:scripts/conveyor/__tests__/health-watch.test.mjs` passes after; the new behaviour cases (control-char stripping, guard regexes, rotated/tail probe) fail when the source changes are reverted while the new tests are kept (items 1 and 5 are pinning tests: green on add, red on regression); `npm run check:standards` is green.

## Design

Premise check (current `main`, no delivering commit for `4537`/`4537`): none of the 7 guards exist. Citations drifted, goal intact. `isUnsalvagedDestructiveUnpushed` is now `we:scripts/lib/lane-history.mjs:194` (not 175), its litter branch is line 197; `LANE_MUTATION_RES` is `we:scripts/check-standards-rules.mjs:4312` (not 4004); `formatLaneTimeline` lives in `we:scripts/lib/lane-whois-core.mjs:234` (the card's "we:lane-whois-core.mjs" path is `we:scripts/lib/`) and the loud stderr write is `we:scripts/lib/lane-history.mjs:429`; the scope's `we:scripts/__tests__/check-standards-rules.test.mjs` does not exist, the real guard test is `we:scripts/__tests__/check-standards-rules-lane-journal-guard.test.mjs` (scope corrected, plus lane-whois-core and its test added).

1. Pin the litter predicate: unit tests on `isUnsalvagedDestructiveUnpushed` (`we:scripts/lib/lane-history.mjs:194`): `litter-delete` + unpushed + HEAD unchanged → false; `acquire-reset`/`refresh-reset`/`reclaim-reset`/`salvage-reset` with unpushed → true. Keep deriving from action name (the `destroyedUnpushed` field is a Follow-up).
2. Header doc note in `we:scripts/lib/lane-history.mjs` (the #4370 journal section, ~line 170-210): `actor.name` is caller-declared (`journalActor`, line 230); `pid`/`ppid` are the trustworthy fields; hash-chain is a named future item.
3. Add pure `stripControlChars(s)` to `we:scripts/lib/lane-whois-core.mjs` (no imports today, so no cycle); (reuse the existing `stripControlSequences` in `we:skills-src/inspect-agent-health/agent-health.mjs:222` if it is import-safe, else a small local copy) and apply it to every journal-supplied field (`reason`, actor name/script/session/pid/ppid, `action`) in `formatLaneTimeline` (line 234+) and in the stderr write (`we:scripts/lib/lane-history.mjs:429`, importing from lane-whois-core). Test that ESC/CR/NUL sequences are removed, newlines in a reason cannot forge a second timeline line.
4. Extend `LANE_MUTATION_RES` (`we:scripts/check-standards-rules.mjs:4312`) with `takeMarkerIf(` call sites and `rmSync(` of a lease/verify file in the lane files; the window check at line 4337 stays a ±15-line window (tightening to the enclosing function is a Follow-up). The hit list comes from RUNNING the extended scan, not from this card (a review simulation found the unjournalled hits near lines 1697 (verify-marker rmSync), 3318, 3337 and 3679, plus the `function takeMarkerIf(` definition at 3285, which the regex must skip via a lookbehind/`function` exclusion). Real mutations (1697, 3337) get an actual `journalLaneEvent` call or a justified `journal-exempt:`; calls already within 15 lines of a journal call stay as-is. Tightening the window to the enclosing function is NOT delivered here (Follow-up), so item 4 of the original card is partly delivered by design.
5. Regression test (in `we:scripts/__tests__/lane-pool-lifecycle-journal.test.mjs`, which already builds a bare origin + lane fixtures): litter beside an unpushed commit → `acquire`/cleanup removes only the litter, commit survives, and `isUnsalvagedDestructiveUnpushed` over the resulting journal entries is false for all of them.
6. Probe tests in `we:scripts/conveyor/__tests__/health-watch.test.mjs` for `probeLaneJournal` (`we:scripts/conveyor/health-watch.mjs:~405`): a destructive unpushed event sitting in a ROTATED file, and one older than the `readLaneJournalTail` 1 MiB live-tail budget, are both still returned within `windowMs`. This test is expected RED today (the probe reads only the live tail); the fix adds a window-bounded reader next to `readLaneJournal` in `we:scripts/lib/lane-history.mjs` that skips rotated files whose mtime is older than the window (never the whole rotated history per tick) and reads each remaining file's entries, with the live file read in full within the window rather than only its last 1 MiB. Tests create the rotated file by calling `appendLaneJournal` with a small `maxBytes` (rotation at `we:scripts/lib/lane-history.mjs:388-401`) or by writing fixtures directly.
7. A review checklist line (not code): add to the PR/review checklist doc a rule that each distinct mutation path named in a PR description (`refresh --force`, `reclaim --override`, etc.) has an integration test; put it in `we:docs/agent/delivery-loop.md`.

## MVP

Musts: items 1, 2, 3, 4, 5, 6, 7 as above, each with its test (item 2 is a doc note and item 7 a checklist line in `we:docs/agent/delivery-loop.md`, both test-exempt; the stderr write in item 3 is tested by spying `process.stderr.write`). OUT: replacing action-name derivation with a recorded `destroyedUnpushed` field; a journal hash chain; routing all lane mutations through one journaled helper; function-scoped journal window; a lint against raw `reason` interpolation into terminal output (only the shared helper + its two call sites are Musts).

## Test plan

- `isUnsalvagedDestructiveUnpushed` litter/reset matrix — fails red today only if the predicate regresses; it is a pinning test (stated honestly: green on add, red on regression).
- `stripControlChars` + `formatLaneTimeline` ESC/newline injection — red today: the function does not exist and the reason is interpolated raw.
- Guard detects an unjournalled `takeMarkerIf(` and `rmSync(LEASE...` — red today: the regexes only match reset/clean/`rmSync(LEASE_MARKER(`.
- Repo scan of the real lane files yields zero findings — keeps the new regexes honest against existing code.
- Litter + unpushed commit survives, smell silent — pinning test via real git fixtures.
- Rotated-file and past-tail-budget probe cases — red today (the probe reads the live tail only).

## Proof plan

Show before/after on the live `main` lane code: keep the new tests, revert only the source changes (red), then restore them (green); run `node we:scripts/check-standards.mjs`-equivalent (`npm run check:standards`) green; run `node we:scripts/lane-whois.mjs --history 2` style timeline on a crafted journal line containing `\x1b[31m` to show the escape is stripped.

## Follow-ups

- Record `destroyedUnpushed` at the call site instead of deriving from action name.
- Tamper-evident hash chain for the lane journal.
- One journaled helper for all lane mutations + lint forbidding raw calls.
- Function-scoped (not ±15-line) window for the journal guard.
- Lint against interpolating raw `reason` strings into stderr/terminal output.

## Progress

- 2026-10-02 prepare: premise confirmed open; citations and scope corrected as recorded in Design.
