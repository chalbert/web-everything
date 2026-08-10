---
name: single-session-should-use-a-lane
description: "RULED (#2123): every edit-action session — solo /next, /prepare, resolve — runs in an isolated lane CLONE, not the main checkout; no content-session carve-out"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 06795551-286a-48d6-950a-4ccf3dd404e9
---

**RULED — #2123 resolved 2026-07-02 (codified as a rider under `platform-decisions.md#pr-flow-rollout-mechanism`).** Every edit-action session — a lone `/next NNN`, a `/prepare`, a one-item `resolve`, `/workflow` alike — runs in an **isolated lane clone**, not on the main checkout.

**DEFAULT FOR *ANY* CHANGE, command-invoked or not (user directive 2026-07-02).** The lane isn't triggered by the *command* — it's triggered by *making an edit at all*. An ad-hoc typed request ("fix the homepage", "tweak this CSS") that never routes through a skill still lanes. Do **not** start editing the main checkout just because no `/`-command framed the work; provision/pick a lane FIRST, edit there. (Learned the hard way: a "quick" homepage CSS fix + baseline regen was done in the main checkout before this correction.) **Uniform, no content-session carve-out** (a `backlog/`/`reports/`-only session isn't exempt: it can codify a doc or regen a derived artifact mid-session, and the proven collision `batch-2026-06-29e` sat on that very file class — misclassification-safety beats the carve-out).

**The primitive is a CLONE, not a git worktree** — `git worktree add`/`checkout -b` are guard-blocked in the shared checkout (#1153), and #1996 codified "isolation = a clone" (`we:scripts/lane-pool.mjs`). So do **not** reach for `EnterWorktree` for a session lane; that harness worktree stays fine only for throwaway read-mostly sub-agents.

**The branch guard fires INSIDE the lane clone too — a lane is not an exemption (verified 2026-08-09).** The
wording "in the shared checkout" above invites the opposite inference, and agents have been given the wrong
instruction on the strength of it. Run in an acquired lane, `git branch <new>` is denied outright:

> *single-branch (main) workflow — creating or switching git branches is disabled in these shared checkouts.
> A `git checkout -b`/`<branch>`, `git switch`, `git branch <new>`, or `git worktree add` moves the shared HEAD
> and derails concurrent agent sessions. Commit on the current branch.*

`git checkout -b`, `git switch` and `git worktree add` are denied the same way. **The sanctioned route needs no
local branch at all:** commit on the lane's own `main`, then publish the ref directly —
`git push origin HEAD:refs/heads/lane/<slug>` — and land it with `node scripts/pr-land.mjs --ref=…`. The lane
ref exists only on the remote; nothing local is ever branched. (Recovery for a stray branch, per the guard's own
text: fast-forward main with `git branch -f main <tip>`, never `reset`.)

**Why:** working the main checkout directly means every claim edit, `resolve`, and codification mutates the shared tree — a concurrent session or the user's uncommitted work / running dev server can collide and break it. A lane clone isolates the changeset; silent same-file last-write-wins becomes loud, mergeable divergence.

**How to apply — phase-1 trigger (capability, not calendar):** *code-only* writing sessions (WE-only, non-visual, verify = tests/gate) lane **now**. *Interactive/content* sessions (a `/prepare`, a decision turn where the human reads the rendering item body live) **stay on the shared primary until a lane can boot its own WE dev-pair on its band ports** (the `.env.local` env-load link, spin-off 0) — because the dev server runs against the main checkout, so a lane's edits don't surface for Playwright/visual verification without that wiring. Then they flip; the steady state is uniform. **The flip is now directed (2026-07-02): visual/interactive work lanes too — boot the lane's OWN WE dev-pair on its band ports (its `.env.local`) and run Playwright/visual verification against THAT, not the main checkout's :3000/:8080.**

Merge/land mechanics (claim locus, before-state soundness, PR/merge-queue substrate) are **not** part of this scope ruling — they live in the #2138 merge-queue line (#2151/#2152/#2153).

Related: [[parallel-workflow-blocked-by-git-guard]], [[commit-on-current-branch]].
