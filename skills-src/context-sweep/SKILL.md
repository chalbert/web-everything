---
name: context-sweep
description: Re-run the AI-context optimisation sweep — audit MEMORY.md + AGENTS.md + docs/agent for rules that should move from model-recall into deterministic hooks, report the delta, and convert the approved ones. Use when the user wants to "run the context sweep", "optimise our context/memory", "find rules to move to hooks", "what else can be hooked", or refresh the hookable-vs-judgment audit. Idempotent — already-hooked rules don't resurface.
---

# Context-sweep — move script-decidable rules out of recall and into hooks

Self-contained. The governing rule is the memory `feedback_hookable_vs_judgment_rule`: a rule moves
OUT of loaded context and INTO a hook **iff a script can decide compliance** (regex/pattern on tool
input, file-path check, count, size limit, banned command, required-field check). Judgment rules
(intent, design forks, "is this on merit?") STAY in context. The win is double — the line leaves the
context budget AND the rule starts being enforced instead of hoped-for — so prioritise mechanical
"footgun" rules currently caught late at the gate (or nowhere).

## The current hook surface (the ALREADY-HOOKED set — don't re-propose these)

| Hook | Seam | Enforces |
|---|---|---|
| `scripts/lint-locus-prefix.mjs` | Pre+Post Edit\|Write | `we:`/`fui:`/`plateau:` locus prefix on code-paths (#883) |
| `scripts/check-memory.mjs` | Pre Edit\|Write | MEMORY.md size / line budget |
| `scripts/backlog-guard.mjs` | Pre(`--pre`)+Post Edit\|Write | empty-summary deny; `…Reason: undecided`; sized-story double-count |
| `scripts/guard-bash.mjs` | Pre Bash | build:plugs run, pkill vite\|node, rm/renumber backlog, shell-append corpus |
| `~/.claude/hooks/guard-git-branch.mjs` | Pre Bash (GLOBAL) | branch create/switch; `push`; `add -A/./--all`; `commit -a` |

Project hooks wire in `.claude/settings.json`; cross-repo (git/dev-server) hooks in `~/.claude/settings.json`.

## The loop

1. **Read the surface.** Read both `settings.json` files + skim each hook script above to refresh the
   ALREADY-HOOKED set (it drifts as hooks are added).

2. **Sweep the rule sources.** Fan out parallel readers (one per surface): `MEMORY.md` + every
   `memory/*.md`; `AGENTS.md`; every `docs/agent/*.md`. Each returns every distinct rule classified
   HOOKABLE / JUDGMENT / ALREADY-HOOKED, with the filter test above. For HOOKABLE rows capture: the
   rule, source, tool seam, *what a script would check*, DENY-vs-WARN, and where it's caught today.

3. **Report the delta — NEW hookable candidates only.** Drop anything already in the surface (that's
   the idempotency guarantee: an unchanged corpus → empty delta → stop). Present the survivors as a
   ranked table; lead with rules caught *nowhere* today. Briefly name the JUDGMENT set so nothing
   mechanical is misfiled there. **Gate here** — the human picks which to convert (and DENY vs WARN
   per rule; some footguns are cheaper as a soft post-write WARN than a hard pre-write deny).

4. **Convert the approved ones.** Per rule:
   - Mirror the gate's *pure detector* where one exists (lint-locus-prefix's design principle) — don't
     re-implement logic that can drift from `check-standards-rules.mjs` / `src/_data/backlog.js`.
   - Extend an existing hook over adding a new one when the seam matches; new file only for a new seam.
   - DENY = `PreToolUse`, exit 2 + stderr (or `permissionDecision:deny` JSON) — keeps it off disk.
     WARN = `PostToolUse`, exit 2 surfaces feedback without blocking.
   - Wire it into the right `settings.json`.

5. **Test from a FILE, not the command line.** The hooks are live in *this* session — a Bash test whose
   command string contains a banned pattern (e.g. `npm run build:plugs`) gets denied before it runs.
   Put cases in a scratchpad `.mjs` and `node` it. Cover deny cases AND must-allow cases (false-positive
   guard: a *mention* of a banned token ≠ a *run* of it — match the runner, not the bare word).

6. **Prune the payoff.** For each rule now hook-enforced, drop its `MEMORY.md` index line and delete the
   now-redundant memory file (the deny message carries the fix, so the prose is clutter). Confirm no
   dangling index→file pointers. Report KB freed.

## Notes
- This is agent-harness/process work — its artifacts are hooks + memory edits, NOT backlog cards (the
  backlog tracks Web Everything *standards*). Don't file gaps from this sweep as backlog items.
- Don't hook the heavy cross-file gate validators (block/intent/demo/capability JSON) — they already run
  at `check:standards` and need cross-entity resolution; per-keystroke is marginal cost for no recall win.
- Restraint is part of the optimisation: only convert when the double-win (reliability + budget) is real.
