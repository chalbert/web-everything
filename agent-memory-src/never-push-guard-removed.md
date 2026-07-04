---
name: never-push-guard-removed
description: "The never-push guard's push-block was removed 2026-06-29 (user authorized) — git push to main is now allowed; branch-create + broad-stage guards stay; frontierui/plateau-app remotes switched HTTPS→SSH"
metadata: 
  node_type: memory
  type: project
  originSessionId: 76b5c1a9-019a-4c4d-a34a-85e7989511e1
---

`~/.claude/hooks/guard-git-branch.mjs` had three independent checks: (1) branch create/switch/worktree,
(2) **push** (denied unless every refspec targeted a throwaway `lane/*`/`batch-parallel/*` ref), (3)
`git add -A` / `commit -a` broad-stage. On **2026-06-29 the user removed check (2)** — `git push` (incl.
to `main`) is now allowed. Checks (1) and (3) remain intact (shared-checkout HEAD safety + broad-stage
hygiene are unaffected). `pushTargetsOnlyTempRefs` is kept but unused for an easy revert.

**Why:** the constellation impl repos (frontierui, plateau-app) must keep their `origin/main` current or
cross-repo `/workflow` lanes reset to a stale base and false-drop (see
[[workflow-crossrepo-lanes-falsedrop]]). The never-push default kept them dozens of commits behind.

**Also done 2026-06-29:** frontierui + plateau-app `origin` remotes repointed **HTTPS→SSH**
(`git@github.com:chalbert/<repo>.git`) — the HTTPS remotes had no stored creds (`could not read Username`),
while WE's SSH auth works. All three (`chalbert/web-everything`, `/frontierui`, `/plateau-app`) are private.

**How to apply:** the old MEMORY rule "104 never-push" is now **partially stale** — branch-first is still
banned, but pushing is fine. Agents may `git push origin main` when the user wants origin synced (still
prefer explicit, deliberate pushes — it's no longer hard-blocked, so don't push casually).
