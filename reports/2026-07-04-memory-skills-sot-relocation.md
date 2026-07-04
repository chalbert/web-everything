# Relocating the agent-memory/skills SoT out of `.claude/` — prep research for decision #2265

**Date**: 2026-07-04
**Point**: Prep research for decision #2265 — whether to relocate the `we:.claude/agent-memory/**` and
`we:.claude/skills/**` source-of-truth *out* of `.claude/` (symlinked back, plus a personal `PreToolUse`
redirect hook) so the Claude Code `.claude`-path permission gate auto-approves memory/skills edits — or
keep `.claude` and defeat the unattended-workflow stall with `--dangerously-skip-permissions`. Not
greenfield standard design: an agent-tooling / repo-layout call over the WE harness, so no web-platform
survey — the research is a consuming-tree read of the governed surfaces plus a statute-overlap check.
**Research page**: `/research/memory-skills-sot-relocation/`
**Plan file**: n/a (surfaced from an interactive debugging session, not a `plans/` file)

---

## Question

The Claude Code VS Code extension hard-prompts on every edit whose literal path **or realpath** contains
`/.claude/`, and nothing in config-land overrides it (the item's provenance verified `Edit()` allow rules
in every path form, `additionalDirectories`, workspace membership, `acceptEdits`, project
`bypassPermissions`, symlinks *into* `.claude`, and a `permissionDecision: "allow"` hook all fail to
suppress it). Two verified levers do work: (1) a `PreToolUse` hook that **rewrites** a
`.claude/(agent-memory|skills)/…` path to a real non-`.claude` path makes the gate classify the edit as
non-`.claude` and auto-approve, the write landing on the real file; (2) Claude Code **follows a symlinked
skill dir**, so `we:.claude/skills` / `we:.claude/agent-memory` can be symlinks to an out-of-`.claude` SoT
and discovery still works. Because the gate checks realpath, the real files must physically live outside
`.claude` — this is a genuine SoT relocation, not just a hook.

So: **adopt the relocation** (scoped auto-approval, keeps the interactive gate for everything else, but
touches statute-cited paths + the guard-lane exemption + ~14 skills-coupled scripts) **or keep `.claude`**
and launch unattended runs with `--dangerously-skip-permissions` (one flag, no governed-path churn, but a
blunt hammer that disables *all* gating)? And if adopting, at what scope — memory-only, or memory-first
with skills as a gated second slice?

## Recommendation

**NOT-YET — keep `.claude`, use `--dangerously-skip-permissions` for unattended runs (a validation gate,
not a fork).** The 2026-07-04 skeptic pass reclassified this: "adopt vs keep-`.claude`" is not a two-branch
fork — keeping `.claude` + the launch flag is the null/do-nothing baseline (and the flag is *always* the
no-hook fallback), so it does not mutually exclude adopting. The real question is one-sided: *is the
relocation+hook candidate worth building at all?* → a go/no-go gate. The verdict is **not-yet**: the
migration's blast radius (a statute-anchored path, the realpath-keyed guard-lane logic, ~18 scripts, and a
personal path-rewrite hook with live mis-fire + symlink-clobber surfaces — see F3/F7) outweighs its marginal
benefit, and the only case that actually *blocks* a run (the unattended stall) is already covered by the
launch flag. The scope question (memory-only vs skills-later) collapses to a deferred config dimension
(cost/frequency, not merit), so there is nothing to rule there today either. **Un-gate** when: the
per-click / all-or-nothing-bypass cost becomes *measured*; the hook is scoped to design out the F7 hazards;
and the F4 statute re-anchoring is specced into the adopting change. If ever built, sequence memory-only
first (low coupling, already guard-exempt); skills is a separately-gated later slice.

## Key Findings

### F1 — The gate is above the settings/hook allow pipeline; only a path rewrite clears it
The `.claude`-path prompt is emitted by the extension *before* the settings allow-rules / `permissionDecision`
pipeline runs, and it keys on **realpath**, so no allow-rule, mode, or `allow`-decision hook suppresses it —
verified exhaustively in the item's provenance. The single lever that works is a `PreToolUse` **input
rewrite** (`hookSpecificOutput.updatedInput.file_path`) that changes the target path to a non-`.claude`
path *before* the gate classifies it. This is why the real files must leave `.claude`: a symlink *pointing
into* `.claude` still resolves to a `.claude` realpath and still prompts.

### F2 — Symlinked discovery works, so the relocation is transparent to loaders
A symlinked `we:.claude/skills/…` entry pointing out of `.claude` was listed as an available skill after
reload, and every existing `join(ROOT, …)` reference into the skills / agent-memory dirs resolves through
the symlink with no code change. So relocation + symlink-back is discovery-neutral; the coupling risk is
confined to (a) realpath-keyed logic (below) and (b) the statute path citations (below).

### F3 — The guard-lane exemption is realpath-keyed and *breaks* on relocation
`we:scripts/guard-lane.mjs:56` exempts agent-memory from the "edits must run in a lane" block via a
`real.includes()` test for the literal `.claude/agent-memory` segment — a **realpath** test. After a
`git mv` to `we:agent-memory-src/`, the realpath no longer contains that segment, so the exemption silently
stops matching and primary-checkout memory edits would be blocked again. The memory slice **must** widen
this exemption to also match the new SoT path (`we:agent-memory-src`). This is the one non-mechanical code
change on the memory side and belongs in slice 1.

### F4 — Statute path citations must be reconciled, not just followed
`we:docs/agent/platform-decisions.md:2488` cites `we:.claude/agent-memory/**` as the durable-content path
that rides a **lane→PR** (with the `we:.claude/skills/batch-backlog-items/claims.json`-class *local
signals* as the only sanctioned-direct carve-out, which "never widens to memory content"). `:2379` lists
`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` as a ③ merge-risk mirror-home. These
are **transport / merge-risk** rules keyed to a path *string*; relocation makes the SoT path indirect
(symlinked). The rules themselves are orthogonal to *where the file physically sits* and to *permission
auto-approval* — auto-approving a local Edit is not a direct-`main` commit, so the lane→PR transport rule
is **unchanged**. But the anchor's literal path citation would read as stale, so the ratifying change must
amend `:2488` (and, for the skills slice, `:2379`) to point at the new SoT path (or note the symlink) and
restate that transport is unchanged. This is a reconciliation the prep flags now so ratification doesn't
inherit an unreconciled statute conflict.

### F5 — Skills coupling is materially heavier than memory (the scope fork)
A `grep` for the `we:.claude/skills/batch-backlog-items` state dir across `we:scripts/` returns **14**
scripts (backlog, lane-drain, check-readiness, check-standards, readiness/*, audit-backlog-health, …) that
read+write its stateful queued / claims / capacity state files through a `join(ROOT, …)` on that dir.
`we:scripts/check-standards.mjs:1484` is a representative read of
`we:.claude/skills/batch-backlog-items/claims.json`. These resolve through a symlink in principle, but the
state-file semantics (the local-signal carve-out that "never pushes") plus the count make skills a
genuinely riskier, separately-gated migration than memory — the substance of the scope fork.

### F7 — The redirect hook self-denies via guard-lane (decisive hazard, skeptic pass)
The redirect hook and `we:scripts/guard-lane.mjs` are *both* `PreToolUse` hooks. Once the redirect rewrites
`.claude/agent-memory/x` → `we:agent-memory-src/x`, guard-lane (running after) sees a primary-tree path that
is `inPrimary && !inLane && !inAgentMemory` (the `.claude/agent-memory` segment is gone) → it **hard-denies
the write (exit 2)**, killing the very interactive memory edit the exemption at `:56` exists to permit. So
adopting is not "just add a hook": it *requires* widening `:56` (F3) and is an order-sensitive coupling.
Two further residual hazards: a broad substring rewrite mis-fires on non-memory `.claude` edits (redirecting
them to a phantom `*-src` path with no symlink backing), and the symlink collapses every session to one SoT
inode with no lane isolation. Together these are the core of the **not-yet** verdict — the cost/hazard side
of a benefit (scoped auto-approval) that mostly removes a per-click interactive cost the launch flag already
covers for the only blocking case.

### F6 — This is not on the standard·impl·product axis
The decision governs the WE repo's own agent-tooling layout, not a standard, impl, or product surface. The
7-question classification sequence (layer / dimension / DI / default) doesn't map; the relevant frame is
cost-vs-benefit plus statute-path reconciliation (F4). It is a repo-infra decision.

## Files Created/Modified

| File | Action |
| --- | --- |
| `we:reports/2026-07-04-memory-skills-sot-relocation.md` | created (this report) |
| `we:src/_data/researchTopics/memory-skills-sot-relocation.json` | created (registry entry) |
| `we:src/_includes/research-descriptions/memory-skills-sot-relocation.njk` | created (write-up) |
| `we:backlog/2265-relocate-agent-memory-skills-sot-out-of-claude-redirect-hook.md` | rewritten to prepared-fork shape; `preparedDate` set |
