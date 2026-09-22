# Graduating the session reaper from the prototype branch to main — grounding for #3802

**Date**: 2026-09-21
**Point**: The reaper's cost to graduate is 13 new files (9 with a leaf extraction), not the 110 the card carried; how to slice it is already ruled by the epic, so #3802 reduces to a ratify plus two real forks (the human gate the stop module answers on its own, and what an untagged session name means).
**Plan file**: none (decision prep for `we:backlog/3802-decision-graduate-the-session-reaper-planner-first-graduate.md`)
**Research page**: `/research/session-reaper-graduation/`

---

## Question

How does the session reaper reach `main`? On `main` it is one 488-line `we:scripts/conveyor/session-reaper.mjs`. On the prototype `origin/lane/mechanical-dispatcher` it is a pure planner, an evidence module, a stop module (carrying the #3744 fix) and a 323-line facade. The card asked: planner first, whole reaper together, or keep it on the prototype; where `readFollowUps` goes; and what an unmarked session name means.

## Recommendation

- **Ratify** graduation in slices, planner first, facade swap last (closes #3744), the stuck-session repair held for #3684.
- **Fork 1** default: split the unattended stuck-session clear out of the graduating stop module; it waits for #3684. Fallback: graduate it opt-in and off by default on both sides.
- **Fork 2** default: keep the every-repo check for every untagged name, with a sunset pinned by a contract test.
- `readFollowUps` moves to a leaf (build note, not a fork).

## Key findings

Measured 2026-09-21 against `origin/main` `ad60a9153` (later `b69c470aa`; the reaper's directories did not change), the prototype, and the staging ref `origin/lane/mechanical-dispatcher-catchup` `dd9d51bfb`.

| Fact | How measured | Value |
| --- | --- | --- |
| Whole static import closure of the facade, staging ref | walk `import`, `export … from` and `import()` from the facade, compare each file to `origin/main` | 253 paths: 139 same, 51 different, 62 missing, 1 unresolvable |
| Files `main` lacks, counting only files main does not have and checking each named import against main's copy | same walk, expanding only files missing on main | planner 3; evidence adds 2; stop adds 1; watchdog chain 2; whole facade 13 (5 of them land-advance, because of `readFollowUps`) |
| Named imports not satisfied by main's copy | same walk | 0 |
| Planner tests on a copy of main with only the planner's 3 files | `git archive origin/main`, add the files and the planner test, `vitest run` | 36 of 36 pass |
| Verdicts test on the same copy | same | fails: imports the facade, `we:scripts/operations/land-advance-escalations.mjs` and `we:scripts/operations/land-advance.mjs` (`OWED_ACTIONS`) |
| Reaper test size | `wc -l` | main 406 lines, staging ref 88 |
| Facade imports never used | read `we:scripts/conveyor/session-reaper.mjs:47-48` on the staging ref | `parseSessionSlug`, `CONSTELLATION_REPOS` |
| Repair (clear-stuck) footprint | read stop module and facade on the staging ref | stop module: a tail cut (imports :56-65, functions :229-314, header :23-47); facade: about 7 hunks (:66, :90-96, :130, :250-267, :283, :299); pins in `we:scripts/conveyor/__tests__/session-reaper.test.mjs:26` and `we:scripts/conveyor/__tests__/session-reap-stop-cli.test.mjs:121-265` |
| clear-stuck-session runs on this machine | the operation run store | 15 runs: 13 applied a move, 1 refused, 1 pending; 13 quarantined directories under the Claude jobs directory |
| Prototype runner calls the reaper | `we:skills-src/conveyor/runner.mjs:515` on the prototype | every tick, no flags (repair on by default) |
| WE session-name tag | `we:scripts/lib/constellation-repos.mjs:19` | `slugTag: ''` (untagged by design) |
| Marker grammar reached main | `git log` | `f211888d0`, 2026-09-20 08:45 EDT |
| Live session listing | `claude agents --json --all` | 885 rows; 455 PR-style names; 18 tagged; 437 untagged: 363 before the commit, 13 between commit and first tagged session (12:17 EDT), 61 after; 3 non-terminal, all before the commit |
| Minters still emitting untagged names for other repos | read call sites | staging ref: `we:scripts/operations/ci-heal-pr-dispatch.mjs:29`, `we:scripts/operations/review-dispatch-wrapper.mjs:164`, `we:scripts/operations/review-dispatch.mjs:615`, `we:scripts/operations/dispatch-lane.mjs:1022`; prototype: `we:scripts/operations/review-dispatch.mjs:406` |
| `gh` absent-PR handling | `readPrState` and `resolvePr` in `we:scripts/conveyor/session-reap-evidence.mjs` on the staging ref | absent is skipped; unreadable keeps; open anywhere keeps; cap 25 calls per pass |

### Two skeptic passes and two fresh screens

- **Pass 1** refuted Fork 2's first default (a start-time cutover: the prototype's runner still mints untagged names for other repos), found the human gate in the stop module (unflagged in the draft), found that `dispatchGrammar` ignores tagged names, found the `readFollowUps` snippet bug (a bare `export … from` leaves `we:scripts/operations/land-advance-io.mjs:135` unbound), and corrected two claims (S5 keeps `parseSessionSlug`: false; #3744 closes at the stop module: it closes at the facade swap).
- **Screen 1** flagged the `readFollowUps` fork as an implementation detail; dissolved.
- **Pass 2** corrected the repair's footprint (about 7 hunks, not one line), the "unrecoverable" wording (the operation's own header says recoverable), the prototype's default (unstated), and found the first sunset was false (four minters still untagged) and "collisions are rare" was backwards.
- **Screen 2** flagged the slicing fork as prioritization; dissolved to a ratify.

### Not explored

The session listing row carries `cwd`. Non-WE review sessions run with `cwd` set to the target repo (`we:scripts/operations/review-dispatch.mjs:411` on the staging ref), and `repoKeyForDir` exists, so `cwd` might disambiguate legacy untagged names without any cutover. Unverified per kind; a sampled WE review row had a scratch-dispatcher `cwd` (not a repo directory), so it would need a per-kind check.

## Files Created/Modified

| File | Action |
| --- | --- |
| `we:backlog/3802-decision-graduate-the-session-reaper-planner-first-graduate.md` | Rewritten to the prepared shape |
| `we:src/_data/researchTopics/session-reaper-graduation.json` | Created |
| `we:src/_includes/research-descriptions/session-reaper-graduation.njk` | Created |
| `we:reports/2026-09-21-session-reaper-graduation-grounding.md` | Created |
