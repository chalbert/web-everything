---
kind: story
size: 5
parent: "2193"
status: resolved
dateOpened: "2026-07-03"
dateResolved: "2026-07-03"
tags: [lane, pr-flow, merge-queue, session-tooling, drain, resume]
---

# Build the /resume skill — take over and finish a producer's stuck lanes, then land

`/drain` lands couples that are **already ready**; it has no answer for the recurring case where a producer
(`/workflow`, `/batch`) leaves lanes that **can't** land — a conflict with a peer that landed first, a red
required `test` (the lane shipped a real bug), or a `blockedBy` item not yet landed. Observed live 2026-07-03:
one `/workflow` batch left **17** such PRs; the lanes were then closed, orphaning otherwise-good work with no
mechanism to finish it. "This will happen again" — so it needs a durable skill, not hand-salvage.

**Built:** `/resume` = discover the stuck lanes → seed a **finisher subagent with the EXISTING lane ref**
(reuse the ~done work, repair only the broken part) → land via the normal drain transport.

- **`we:scripts/lane-resume.mjs discover [--json]`** — the discover brain. Buckets open `ready-to-merge` PRs
  into `ready` / `conflict` / `test-red` / `blocked` / `unknown`, reading each lane's `we:.lane-manifest.json`
  for `item` / `repos` / `blockedBy`; a blocker counts landed when its backlog file is `status: resolved` on
  `main`; orders lanes so none precedes one it is `blockedBy` (cycle-safe). Pure `classifyLane` +
  `orderByBlockedBy` are unit-tested (`we:scripts/__tests__/lane-resume.test.mjs`, 10 green).
- **`we:.claude/skills/resume/SKILL.md`** — the ceremony: `discover` → per stuck lane (blockedBy order,
  cross-repo impl-first) spawn a finisher subagent seeded with the ref (`git clone --branch <laneRef>` — clone
  is not branch-guarded; push only to `lane/*`), which rebases onto `main`, resolves conflicts, **regenerates
  derived artifacts** (not hand-merge), runs the full gate, drops the transient manifest, pushes, confirms CI
  green → then `/drain` lands it. Landing is **not** re-implemented.

**The one knob:** `resolve-only` (default — mechanical conflicts + regenerated artifacts only) vs `--fix`
(the finisher also debugs/fixes the red `test` code). Ships resolve-only; `--fix` is explicit opt-in because an
agent "making tests pass" can paper over a real bug.

Distinct from `/drain` in one line: **drain lands lanes already ready; resume repairs stuck lanes first, then
lands them.** Reuses `we:scripts/merge-ai-prs.mjs` + `we:scripts/pr-land.mjs` as the land transport. Follow-on:
fold the finisher's rebase-drop-manifest into the lander itself (#2198), and run the drain/resume from an
isolated clone (#2197).
