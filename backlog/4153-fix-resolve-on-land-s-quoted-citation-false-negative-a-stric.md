---
bornAs: x9k9bg5
kind: story
size: 3
status: resolved
scope: ["we:scripts/lib/open-pr-items.mjs", "we:scripts/lib/__tests__/open-pr-items.test.mjs", "we:scripts/backlog-stranded-sweep.mjs", "we:scripts/__tests__/backlog-stranded-sweep.test.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Fix resolve-on-land's quoted-citation false negative + a strict commit-subject auto-resolve safety net

#3916 graduated onto main (092df91c4) but stayed status:active forever: we:scripts/merge-ai-prs.mjs's resolve-on-land (deliveredItemNumsFromPr, we:scripts/lib/open-pr-items.mjs) has a guard 8 (blanket 'no code changes' disclaimer) that misfired on a QUOTED citation inside the PR body ('already landed, no code change' precedent), wiping the credited id before it ever reached landedThisPass — a silent skip the #2899 totality report cannot see because it happens upstream of that set. Fix: guard 8 now strips double-quoted spans before testing, so a cited precedent about a DIFFERENT item can never trip it; inert for the guard's real catches (PR #1599/#1613, both unquoted). Also add a backstop: we:scripts/backlog-stranded-sweep.mjs gains commitSubjectDeliversItem + autoResolvableStrandings + --apply/--dry-run, a STRICT git-ground-truth signal (a commit reachable from origin/main whose subject trails with the card's own (#NNNN), excluding every drain: housekeeping commit) that resolves through the drain's own resolveLandedItem (we:scripts/lane-drain.mjs) — never a second resolver, never guessing; anything short of that bar stays report-only exactly as before. Live-verified: a dry run on the real corpus finds #3916 AND a second, previously-unknown genuine miss of the same class (#4025).

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/open-pr-items.test.mjs we:scripts/__tests__/backlog-stranded-sweep.test.mjs` passes (both files gain #3916 regression cases that fail on the pre-fix code: the quoted-citation guard-8 false negative, and `commitSubjectDeliversItem`/`autoResolvableStrandings`, which did not exist before).
2. **Live proof** — `node we:scripts/backlog-stranded-sweep.mjs --dry-run` on the real corpus reports `#3916` (and `#4025`, a second genuine miss of the same class) under "STRICT commit-subject proof", where before the fix `deliveredItemNumsFromPr(...)` on PR #2594's real ref/title/body returned `[]` instead of `['3916']`.
3. **Executable** — `npm run check:standards` reports 0 errors.
