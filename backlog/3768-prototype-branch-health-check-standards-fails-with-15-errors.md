---
bornAs: xntmgs1
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md", "we:backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md", "we:scripts/operations/land-advance-io.mjs", "we:scripts/operations/wip-report-io.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Prototype branch health: check:standards fails with 15 errors on lane/mechanical-dispatcher, which blocks graduating anything to main

`npm run check:standards` fails on the tip of lane/mechanical-dispatcher (95aae605b, 219 commits ahead of and 398 behind main; merge-base ca7e68b71 of 2026-09-14), so nothing can graduate from the branch to main until it is green there. The reaper-split worker reported 12 errors; the tip now shows 15. Run 2026-09-20 in a throwaway clone of the branch, with `npm run check:standards` run through we:scripts/readiness/heavy-admission.mjs (10 s): `15 error(s), 1823 warning(s)`, exit 1. The 15, exactly:

A. Duplicate backlog ids (4). #3663 (probe-cursor-as-an-additional-dispatch-provider vs cap-vitest-worker-thread-count), #3664 (probe-grok-top-tier vs neglect-watch-a-completed-fix), #3665 (probe-open-weight-payg vs fold-the-gate-s-request-check-modes), #3666 (live-fire-probe-grok-base-tier vs delivery-report-reports-dir). On main the ids 3663 to 3666 belong to the four "probe" cards (JIT-numbered at land, commits 0a9b7abb1 and 02d649797); the branch's own drain numbered four different cards 3663 to 3666 (commit cb183511c, "3650 to 3663, x30inwx to 3664, xab3jh7 to 3665, xoppas2 to 3666"), and both sets are on the branch after the merge. Of the four branch-only cards: cap-vitest is already on main as #3650 (the branch carries it as 3650 too, and as 3663; the two copies differ only in status and resolved date); fold-the-gate is a card of the same subject as main's #3485 but a distinct file (no parent, other slug; NOT confirmed identical); neglect-watch and delivery-report have no card of that slug on main.
B. Hand-picked ids not on main (3). 2260 (poc-branch-delivery-mode), 2261 (collectandclearrolloutquota) and 3180 (codex-model-routing). Main carries the same three slugs as #3637, #3636 and #3635. The branch's heal commit acac6d817 ("heal new-item id collision(s) pre-check (#3635 to #3180, #3636 to #2261, #3637 to #2260)") renamed them the other way. Why the two sides disagree is not confirmed.
C. Missing locus prefixes (2). 105 code-path references in we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md and 16 in we:backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md.
D. Dead cites (4), a symptom of B: agent four memory notes cite #3635 or #3637, which do not exist on the branch (they exist on main). we:agent-memory-src/default-to-prototype-for-mechanical-fixes.md and we:agent-memory-src/prototype-branch-uses-direct-push-not-full-pr.md cite #3637; we:agent-memory-src/delegate-work-to-codex-when-feasible.md and we:agent-memory-src/new-review-seats-must-earn-their-place.md cite #3635.
E. Missing real-mechanism tests (2). we:scripts/operations/land-advance-io.mjs and we:scripts/operations/wip-report-io.mjs have no test importing the real-repo helper (the #2949 fidelity rule).

Two further facts to record. (i) Authorship: 215 of the 219 commits that are on the branch and not on main are authored with the git user name `test` and the placeholder address test at test.com (the machine's git identity; only the Co-Authored-By trailer names Claude), 3 by Nicolas Gilbert, 1 by the name `test` with the operator's own address. The same placeholder identity appears on 1285 commits on main, so this is the machine's git config, not something the branch did. (ii) Card #3475 has 3 warnings (not errors): its code-locus cites name line ranges 364-394, 381-386 and 387-393 of the reaper file we:scripts/conveyor/session-reaper.mjs, and those point past the end of that file, which is now 278 lines after the reaper split.

DESIGN TO SETTLE.
1. A: renumber versus drop. Renumber the four branch-only cards to free ids through the sanctioned path (we:scripts/backlog.mjs `yield`, which refuses a tracked file, so it may not apply) or drop the ones main already has (cap-vitest as #3650). Who owns each: the branch's session or the drain.
2. B and D: either point the branch at main's numbers (#3635 to #3637) by rebasing onto main first, which removes B and D together, or fix each cite by hand. Decide whether to rebase (398 commits behind) before or after the cleanup.
3. C: add the `we:` prefixes to the two big cards mechanically (a script, not by hand) or split their old tracker entries off.
4. E: write the two tests, or ship the two modules with the sanctioned exemption the rule offers.
5. Authorship: fix the machine's git identity, and whether to rewrite nothing (history stays; only new commits change).
6. Guard against the recurrence: a check that runs `check:standards` on the branch on every push, so the count cannot grow unnoticed (it went 12 to 14 to 15 during one day).

## Done when

1. **Executable** — in a fresh clone of `lane/mechanical-dispatcher` at the head of this item's landing, `npm run check:standards` prints `0 error(s)` and exits 0. Before: `15 error(s), 1823 warning(s)`, exit 1 (run on 95aae605b, 2026-09-20).
2. **Executable** — the same run prints no warning line for card 3475 (before: 3, its cites past the end of the reaper file). Check: the output contains no line matching `warn backlog/3475`.
3. **Executable** — a listing of the backlog folder on the branch has each of the ids 3663, 3664, 3665 and 3666 exactly once.
4. **Human verify** — `git log -5 --format=%an` on the branch shows the operator's real name on new commits, not the placeholder `test`.
5. **Executable, if the design adds the recurrence guard** — a test or check that fails when the branch's error count goes above zero.
