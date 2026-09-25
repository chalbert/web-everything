---
bornAs: xcf4556
kind: story
size: 3
parent: "3443"
status: open
scope: ["we:scripts/lane-resume.mjs", "we:scripts/__tests__/lane-resume.test.mjs", "we:.claude/skills/finish/SKILL.md", "we:skills-src/finish/SKILL.md"]
dateOpened: "2026-09-24"
tags: []
---

# lane-resume: discover + open pushed-but-PR-less lane refs (/finish)

we:scripts/lane-resume.mjs discover only sees labelled PRs, so a lane that committed, resolved its card, and pushed a lane/* ref but never got a PR (orchestrator ended mid we:scripts/pr-land.mjs, e.g. lane/batch-2026-09-25-waveB4-3915) is invisible to /finish and /drain. Add a pr-missing discover bucket (remote lane/* refs across the constellation with no open/merged PR, tip not on origin/main, carrying a real non-manifest delivery, within a configurable age window, skipping CLOSED-PR heads) and a we:scripts/lane-resume.mjs 'open <laneRef>' command that opens the PR through we:scripts/pr-land.mjs --label-on-green (never raw gh pr create), refusing when a PR already exists, the tip is already on main, or the card it resolves is already resolved on main by a different commit.

## Done when

1. **Executable** — `npm run test:unit -- we:scripts/__tests__/lane-resume.test.mjs` passes, including new
   synthetic-fixture cases for the pure `pr-missing` classifier (no PR / already has a PR incl. CLOSED / tip
   already on main / too old / manifest-free-no-real-delivery / item derivation from manifest, commit message,
   and resolved backlog filename) and for the `open <laneRef>` refusal rules (PR already exists, tip on main,
   card already resolved on main by a different commit).
2. **Executable** — `node we:scripts/lane-resume.mjs discover --json` lists a genuinely pushed-but-PR-less
   `lane/*` ref (real delivery, no PR, tip not on main, within the age window) under a new `prMissing` bucket
   with its item number when derivable, and stops listing it once `node we:scripts/lane-resume.mjs open <ref>`
   has opened a PR for it.
3. **Faithful transport** — `open` opens the PR via `we:scripts/pr-land.mjs --label-on-green` (never a raw
   `gh pr create`), and `npm run check:standards` reports 0 errors.

## Live case (why this is real, not hypothetical)

2026-09-25: a `/workflow` orchestrator ended while a lane agent was inside `we:scripts/pr-land.mjs` waiting for
checks. The lane had already committed, resolved its card, and pushed `lane/batch-2026-09-25-waveB4-3915`
(graduation slice #3915, tip `a9a6d8a78a`) — but no PR exists for it, and `we:scripts/lane-resume.mjs discover`
had no bucket that could ever surface it.
