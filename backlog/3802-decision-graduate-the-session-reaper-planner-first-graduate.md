---
bornAs: x9wdxlh
kind: decision
parent: "3383"
status: open
relatedTo: ["3744", "3443", "3765", "3766"]
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/session-verdicts.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Decision: graduate the session-reaper planner first, graduate the reaper together, or keep it on the prototype (reaper-planner graduation)

Rule how the session reaper reaches `main`. The stop-verify fix for #3744 is built only on the prototype branch `lane/mechanical-dispatcher`, and #3744 stays open on `main` because that fix lands in the stop module, whose graduation waits on the planner's graduation. The planner's graduation has no card: it exists only as a Progress entry in #3443 and a line in the epic tracker's "owed and not carded" list. This card is that missing decision. Relates #3744, #3443, #3765 and #3766 (planner fixes, open).

*Not prepared:* no skeptic pass has run on the forks below and there is no `preparedDate`. The default is mine, from the code reads cited here.

## FOUND (re-verified 2026-09-21)

- **Main has the monolith; the prototype has the split.** `we:scripts/conveyor/session-reaper.mjs` is on `main`. The three split modules exist only on the prototype: `we:scripts/conveyor/session-reap-plan.mjs` (285 lines, pure), `we:scripts/conveyor/session-reap-evidence.mjs` (195) and `we:scripts/conveyor/session-reap-stop.mjs` (314), behind a 323-line facade that re-exports the 19 names the monolith exported. The split was move-only (reaper-split, 104 tests), then the stop-verify fix landed on the prototype (`e0165b4e9`, 249 reaper tests): one registry re-read after a 5 second wait, confirmed and unconfirmed counted apart, terminal sessions never re-stopped.
- **The planner is nearly self-contained.** `we:scripts/conveyor/session-reap-plan.mjs` has ONE direct import, `we:scripts/conveyor/session-verdicts.mjs`, which imports only `we:scripts/operations/land-advance-tools.mjs` (26 lines, no imports). It carries one local copy of `normalizeHandle` to avoid dragging in the run store; #3766 (open, not built on the prototype: `we:scripts/lib/handle.mjs` does not exist) would extract it. #3765 (a null session row crashes the planner) is also open and not built.
- **The whole reaper is a hand-port, not a cherry-pick.** Main's reaper parses session names with `parseSessionSlug` (repo markers such as `review-pa-148`); the prototype has no marker grammar. The reaper's full import closure is 218 files, 110 of them missing from `main` or different (per the #3443 Progress entry). Its real blocker is `readFollowUps`, which lives in `we:scripts/operations/land-advance-io.mjs` (18 imports, not on `main`). Also missing on `main`: `we:scripts/conveyor/driver-watchdog.mjs` (890 lines) and its mode file.
- **The catch-up merge touches this.** The staged merge of `main` into the prototype (`origin/lane/mechanical-dispatcher-catchup`) kept the branch's split reaper over main's monolith (the branch exports a superset: 26 names against 13) and rewrote main's three repo-guessing test cases; see the catch-up forks card, fork (c).
- **The operator's rulings so far.** Ruled 2026-09-20 (tracker note): a PR closed unmerged is terminal in the reaper's repo-less cross-repo check; only an OPEN PR blocks (reaper-graduate "Fork C"). Still open, recorded in #3443's Progress and in the reaper-graduate result: **Fork A**, where `readFollowUps` goes before graduation; **Fork B**, what an unmarked session name means on `main`.

## Fork 1 — how the reaper graduates

- **(a) [default] The pure planner first, alone; the evidence and stop modules later.** The planner has one import and needs only the verdicts leaf and the tools leaf, so its slice is small and independently reviewable (#3443's own rule). The stop-verify fix (#3744) graduates with the stop module afterwards, and #3744 stays open until then. Requires #3765 and #3766 to be built on the prototype first, so the slice does not carry a known crash and a third `normalizeHandle` copy. Cost: two or three slices instead of one, and the planner runs on `main` before anything schedules the reaper there (the reaper only reports; nothing on `main` acts on `redispatch-once`, a gap already logged).
- **(b) The whole reaper together.** One slice: planner, evidence, stop, verdicts, watchdog chain and the `readFollowUps` extraction. Closes #3744 in one pull request. Rejected: the closure is 110 files different from `main`, including the watchdog chain (890 lines); a reviewer cannot review it as one piece, which is what #3443 exists to prevent.
- **(c) Keep the reaper on the prototype.** Leave it as prototype-only infrastructure, close #3744 as delivered on the prototype, and never graduate. Rejected as the default: the runner that will eventually replace the interactive session runs from `main`, and `main`'s reaper still re-stops about 570 finished sessions per run (the #3744 defect); this only defers the graduation the epic exists to reach. Stays viable if the operator decides the whole prototype graduates as one unit at the end.

## Fork 2 — `readFollowUps` (recorded as Fork A in #3443)

- **(a) [default, as the reaper-graduate worker recommended] Extract it to a small follow-up-ledger module on the prototype first**, leaving the land-advance IO module re-exporting it, then graduate that leaf. The function is 5 lines over `createFileRunStore` and `DISPATCH_EFFECT`, both already on `main`.
- **(b) Graduate land-advance first.** Rejected: large, and it is the runner-adjacent area others are working in.

## Fork 3 — unmarked session names on `main` (recorded as Fork B in #3443)

- **(a) [default, as the worker recommended] Keep the cross-repo check** (an unmarked PR session resolves only when merged or closed in every repo where that number exists; 3 `gh` calls per unmarked session, capped) until sessions minted before repo markers age out. The port must tell "unmarked" from "explicit we".
- **(b) Trust `we` for unmarked names.** Cheaper; wrong for legacy sessions such as the live `review-148` (plateau-app#148).
- **(c) Key on the session's start time against the marker cutover.** Precise but needs the cutover time and adds a clock to a pure planner.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*graduate-the-session-reaper-planner-first*.md` lists this card (it fails until the operator has ruled and the `## Ruling` section names the chosen option for each fork).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
