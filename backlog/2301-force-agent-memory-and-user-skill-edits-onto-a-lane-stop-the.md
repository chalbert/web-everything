---
kind: story
size: 5
status: open
dateOpened: "2026-07-06"
tags: [agent-memory, lane, guard-lane, primary-checkout, self-improving-loop, "2266"]
---

# Force agent-memory and user-skill edits onto a lane (stop them landing in primary)

Memory/skill writes currently land in the PRIMARY checkout: the ~/.claude memory path is a symlink into we:agent-memory-src/ (#2266) and we:scripts/guard-lane.mjs exempts that path from the lane-only rule, so every memory write dirties primary and bypasses lane→PR. Fix: repoint the symlink at a DEDICATED memory-lane (keeps writes off primary while staying prompt-free), invert the guard exemption into a deny-with-reason backstop, and land the lane via a deterministic hook — the agent never manages the memory PR. Follow-up to #2266.

## The bug, exactly

Reproduced live. The chain that lands memory in primary:

```
~/.claude/projects/-Users-…-webeverything/memory   (Claude Code's fixed memory path)
  → symlink → we:.claude/agent-memory                (#2266 back-compat symlink)
  → symlink → we:agent-memory-src/                    (the git-tracked SoT, INSIDE the primary checkout)
```

`we:scripts/guard-lane.mjs:54-61` keys on realpath and **explicitly exempts** any path containing
`agent-memory-src/` or `.claude/agent-memory/` from the "edits must run in a lane clone" deny (#2123/#104).
So a memory Write sails straight into `we:agent-memory-src/` in the **primary working tree**, tracked and
uncommitted, bypassing the lane→PR transport. Every session that writes a memory dirties primary.

## The prompt constraint (why the SoT is where it is)

**Any write whose realpath contains `.claude` prompts for permission** — the reason #2266 relocated the
memory SoT *out* of `.claude` to `we:agent-memory-src/` and kept a back-compat symlink at the old path
(`we:scripts/guard-lane.mjs:56`). The symlink's whole job is to make the memory realpath land somewhere
**not** under `.claude`, so the autonomous self-improving loop writes memory with **zero prompts**. This
kills the tempting "just keep normal memory local in `~/.claude`" idea: a plain `~/.claude` dir realpaths
under `.claude` → prompts on every write → breaks the loop. **Memory must live at a non-`.claude` realpath.**

## Why the naïve fixes fail (constraints that pin the design)

1. **Can't keep a local `~/.claude` tier.** Its realpath contains `.claude` → every update prompts → breaks
   the loop (above). There is no untracked-local option; memory must resolve outside `.claude`.
2. **Can't just deny the write.** A `guard-lane` deny fires on *every* write to the guarded path. While the
   symlink still resolves to primary, a blanket deny blocks **all** memory writes (loop included). A deny
   only works as a **backstop**, once the happy-path write already resolves somewhere allowed.
3. **Can't make the agent land it.** A transparent symlink hides *which* lane a write landed in, so the
   agent can't know where to commit/PR. The landing must be **machinery, not agent judgment** (mirrors the
   autonomous-loop memory: auto-landed lane→PR, red-team gate, never a prompt; and `/close-session`'s
   existing "survivors ride a lane → PR").

## Design (three parts — all required)

1. **Repoint the memory symlink at a DEDICATED, persistent memory-lane clone.** `~/.claude/…/memory →
   <memory-lane>/agent-memory-src`. The realpath is non-`.claude` (no prompt) **and** non-primary (clean
   tree). Must be a *dedicated* lane, never a pooled code-lane — `we:scripts/lane-pool.mjs` `refresh` resets
   pooled lanes to origin/main and would wipe uncommitted memory before the hook lands it.
2. **Invert the `guard-lane` exemption into a deny-with-reason backstop.** Delete the `agent-memory-src` /
   `.claude/agent-memory` allow-carve-out at `we:scripts/guard-lane.mjs:54-61`; any Write that realpaths into
   the **primary** `agent-memory-src/` (or the skills dir) is denied with an instructive reason. In the happy
   path it never fires; it catches a mis-pointed symlink or a stray direct primary write **loudly** instead
   of silently dirtying the tree. Covers **user skills** too (same primary-leak class).
3. **A deterministic hook lands the memory lane.** Stop / loop-tick / `/close-session` commits the memory
   lane's `agent-memory-src` diff and opens a `ready-to-merge` PR on the standard transport
   (`we:scripts/pr-land.mjs` + the drain) — the agent never runs `/pr` for memory.

## Open sub-fork (settle before build)

Only the memory-lane's **lifecycle** remains: one **machine-global** memory-lane shared by all sessions
(simplest; serializes memory writes — tiny + infrequent, low collision) vs **per-session** memory-lanes (no
sharing, but the single global symlink can't repoint per-session without racing concurrent sessions).
Recommendation: **one machine-global dedicated memory-lane**, committed frequently. If it needs a real
decision, split it out as a `type:decision` card.

## Definition of done

- A memory/skill Write from any session lands in the memory-lane, not primary; `git status` in the primary
  checkout stays clean across a session that writes memory.
- The autonomous self-improving loop writes memory with **zero** prompts (non-`.claude` realpath preserved).
- A direct write into primary `agent-memory-src/` is **denied with a reason**, not silently accepted.
- Memory reaches `main` via a `ready-to-merge` PR with no agent-run `/pr`.
- `we:scripts/guard-lane.mjs` no longer special-cases agent-memory as an *allow* exemption.

## Note

May slice (symlink/provisioning · guard deny · auto-land hook are separable) — re-run `/slice 2301` if it
sizes above the batch bar once scoped against the real `we:scripts/lane-pool.mjs` + hook surface.
