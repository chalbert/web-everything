---
kind: story
size: 8
status: open
locus: webeverything
blockedBy: ["2265"]
relatedReport: reports/2026-07-04-memory-skills-sot-relocation.md
dateOpened: "2026-07-04"
tags: [permissions, agent-ergonomics, memory, skills, tooling]
---

# Relocate agent-memory + skills SoT out of .claude and add scoped redirect hook

Implements the #2265 GO ruling (strong form): physically move agent-memory and skills SoT out of .claude to out-of-.claude dirs with back-compat symlinks, add the precisely-scoped personal home redirect hook that rewrites only those two path prefixes, widen we:scripts/guard-lane.mjs:56 to recognise the new memory path (self-deny fix), fix the ~4 realpath/string-test scripts + ~14 skill-state-dir refs, and re-anchor the statute (we:docs/agent/platform-decisions.md:2488/:2396/:56) as a physical-path-move-only change. Net effect: memory/skills edits auto-approve past the .claude permission gate while every other write stays gated — the scoped-safety posture self-improving loops need instead of a global permission bypass flag.

## Tasks
1. **Relocate the real files** — move `we:.claude/agent-memory/**` → `we:agent-memory-src/**` and
   `we:.claude/skills/**` → `we:skills-src/**` (final dir names TBD in-build), leaving symlinks at the old
   `.claude/` paths so every reader / skill-loader keeps resolving through them. Preserve git history on the
   move (`git mv`).
2. **Add the scoped personal `~/.claude` redirect hook** — rewrites *only* the two SoT path prefixes via
   `hookSpecificOutput.updatedInput.file_path`; scoped precisely so it never touches `~/.claude` settings or
   `we:.claude/commands/**` (the mis-fire surface). Lives in the machine-local `~/.claude`, NOT the repo — a
   machine without it degrades to prompts.
3. **Widen the guard + fix the blast radius** — extend the `we:scripts/guard-lane.mjs:56` realpath exemption
   to recognise the new memory path alongside the old (the self-deny fix), and update the ~4 realpath/string-
   test scripts (`we:scripts/check-standards.mjs`, `we:scripts/check-memory-freshness.mjs`,
   `we:scripts/lib/memory-freshness.cjs`) + the ~14 skill-state-dir refs (`we:scripts/check-standards.mjs:1484`).
4. **Re-anchor the statute** — re-point `we:docs/agent/platform-decisions.md:2488` (+ the `:2396` reference and
   `we:scripts/guard-lane.mjs:56`) from `.claude/agent-memory/**` to the new path, with the explicit
   physical-path-move-only clause from #2265 (lane→PR-only landing + "never widens" carve-out unchanged; the
   permission-gate auto-approve creates no new sanctioned-direct carve-out). This is the durable rule #2265
   deferred to this build.

## Acceptance
- A memory edit and a skills edit both auto-approve past the `.claude` permission gate (no prompt) in an
  interactive session, while a non-memory `.claude` edit (e.g. `we:.claude/commands/*.md`) still prompts.
- `we:scripts/guard-lane.mjs` permits an interactive memory edit at the new path (no self-deny) and still
  denies a stray primary-tree edit elsewhere.
- `check:standards` green; all readers/skill-loaders resolve through the back-compat symlinks.
- Statute re-anchored; the `:2488` "never widens" carve-out attaches to the new path.

## Notes
Sequence memory first, then skills, within this one story (both land together per the #2265 ruling, but
memory is lower-coupling so do it first and confirm the gate before moving skills). Side-effects are
tunable post-hoc (owner accepts iterating); every step is recoverable from git history.
