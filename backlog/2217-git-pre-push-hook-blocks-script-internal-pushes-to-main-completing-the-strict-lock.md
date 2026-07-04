---
kind: story
size: 3
relatedTo: ["2203"]
status: open
dateOpened: "2026-07-03"
tags: [lane, pr-flow, git, governance]
---

# A git `pre-push` hook blocks script-internal pushes to `main` — completing the #2203 strict lock

The #2203 enforcement `we:scripts/guard-bash.mjs` (PreToolUse Bash) blocks an **agent-typed** `git push` to
`main` — which covers the common path (all `/workflow` git runs via the Bash tool). But it is blind to a
**script's internal push**: `we:scripts/pr-land.mjs` pushes to `main` via `execFileSync` on its degraded paths
(`--fallback-git`, and the post-land heal / regen commits), which never passes through the Bash tool, so the
guard never sees it. A buggy or future script could likewise push `main` ungated.

**Fix:** install a git `pre-push` hook (per checkout — via a `postinstall`/setup script, since `.git/hooks` is
not version-controlled) that **rejects a push whose refspec targets `main`** unless the sanctioned override is
set (mirror `MAIN_PUSH_OK=1`). This catches *every* push regardless of how it's invoked (agent, script,
terminal), completing the "nothing reaches `main` ungated" guarantee. Then audit the sanctioned scripts
(`pr-land` fallback/heal/regen) to pass the override explicitly, so they still work while everything else is
blocked. Note the `--no-verify` caveat (a hook is bypassable) — acceptable as defence-in-depth alongside the
Bash guard and branch protection. Relates to #2203 (the ruling; this is its layer-3 enforcement).
