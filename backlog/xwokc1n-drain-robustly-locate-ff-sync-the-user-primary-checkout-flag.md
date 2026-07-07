---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-07"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
graduatedTo: none
tags: []
---

# Drain: robustly locate + ff-sync the user primary checkout (flag/env, skip dirty)

The drain's primary ff-sync (we:scripts/merge-ai-prs.mjs) only finds the primary via the clone's git alternates file, which a --local clone (the drain skill's own provisioning) never creates — so primary is silently never synced and rots (observed 75 commits behind origin/main). Make primary resolution robust and independent of clone mode: resolve in order --primary=PATH flag, then WE_PRIMARY env, then git alternates (legacy). Sync only when primary is a different dir, on main, AND its tree is clean — a pure git pull --ff-only, NEVER --autostash (the 2026-07-03 strand incident). A dirty / diverged / unlocatable primary is left untouched and LOUDLY logged (never silent, never stranded). The drain skill run command passes --primary. Trust-chain edit (we:scripts/merge-ai-prs.mjs) so it lands review:human.

## Resolution (2026-07-07)

- **Root cause:** the post-land primary ff-sync in we:scripts/merge-ai-prs.mjs located the primary *only* through the clone's `.git/objects/info/alternates` file. The drain skill provisions its clone with `git clone --local`, which creates **no** alternates — so the finder always returned null and the primary was silently never advanced (found 75 commits behind).
- **Done:**
  - New exported pure helper `resolvePrimaryPath(cwd, {flag, env}, readAlt)` in we:scripts/merge-ai-prs.mjs — resolves the primary in precedence order: `--primary=<path>` flag → `WE_PRIMARY` env → git alternates (legacy `--reference`/`--shared` clones). A bare/whitespace flag is ignored, not coerced to a path.
  - Rewrote the post-land sync block to use it and to be **safe by construction**: ff-syncs only a primary that is a DIFFERENT dir, on `main`, and with a **clean tree** — a pure `git pull --ff-only`, dropping `--autostash` entirely (the autostash-pop that stranded the tree on 2026-07-03). A dirty / diverged / non-repo / unlocatable primary is left UNTOUCHED and loudly logged — never silent, never stranded.
  - we:skills-src/drain/SKILL.md (hardlinked to the built we:.claude/skills/drain/SKILL.md) — the run commands pass `--primary=<primary>`, with a note that a `--local` clone has no alternates so the flag/env is required or the primary silently rots.
  - Tests: 6 cases for `resolvePrimaryPath` in we:scripts/__tests__/merge-ai-prs.test.mjs (flag/env/alternates precedence, the unlocatable `--local` rot case, bare-flag guard). Module suite 69 green.
- **Trust-chain edit:** touches we:scripts/merge-ai-prs.mjs, so this PR lands `review:human` (an agent may not review a change to its own merge leash) — a human accepts it, as with #194.
