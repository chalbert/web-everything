---
kind: decision
size: 5
status: resolved
locus: webeverything
relatedReport: reports/2026-07-04-memory-skills-sot-relocation.md
dateOpened: "2026-07-04"
dateStarted: "2026-07-04"
dateResolved: "2026-07-04"
codifiedIn: one-off
preparedDate: "2026-07-04"
tags: [permissions, agent-ergonomics, memory, skills, tooling, decision]
---

# Relocate agent-memory/skills SoT out of .claude/ + redirect hook to auto-approve their edits

## Grounding digest + verdict
The Claude Code VS Code extension hard-prompts on **every** edit whose literal path or realpath contains
`/.claude/`, and nothing in config-land overrides it — the provenance verified `Edit()` allow rules (every
path form), `additionalDirectories`, workspace membership, `acceptEdits`, project `bypassPermissions`,
symlinks *into* `.claude`, and a `permissionDecision: "allow"` hook **all** fail to suppress it. Two levers
**do** work (both verified 2026-07-04): a `PreToolUse` hook that **rewrites** the path to a real
non-`.claude` path (`hookSpecificOutput.updatedInput.file_path`) makes the gate auto-approve and the write
lands on the real file; and Claude Code **follows a symlinked skill dir**. Because the gate checks
**realpath**, the real files must physically leave `.claude` — a genuine SoT relocation, not just a hook.

**Verdict: GO — strong form (relocate BOTH agent-memory and skills out of `.claude` now; build the scoped
redirect hook).** Ratified 2026-07-04 after the prepared NOT-YET default was red-teamed *by the human owner*
and overturned on two grounds the prepared merit axis under-weighted:
1. **Self-improving loops are a committed direction, not hypothetical.** The prepared cost/benefit rested on
   "unattended runs rarely edit memory" — false for a self-sustaining, self-*improving* loop whose entire
   purpose is editing memory/skills. So the `--dangerously-skip-permissions` fallback isn't free: it forces
   exactly those long-running, least-supervised loops onto a **global** permission bypass — the worst safety
   posture for the highest-risk workload. Scoped auto-approval (memory/skills only, everything else still
   gated) is strictly better there. The lane→PR-is-the-real-boundary counter does **not** rescue the flag for
   memory, because memory is **guard-exempt from lanes** — a self-improving loop edits `.claude/agent-memory`
   in the **primary** checkout, so the flag would bypass permissions on the primary tree.
2. **Solo-dev + full git history collapses the migration's blast radius.** The hazards below are real but are
   now **side-effects to manage**, not blockers: nothing lands on `main` except via reviewed PR, every move is
   recoverable from history, and there are no concurrent human/agent sessions to derail while the move settles.
   The exact hook mechanics are tunable after the fact — the owner explicitly accepts iterating on side-effects.

The prepared "phase memory-only first, skills a separate later slice" caution is **overridden**: its sole
basis was coordination/frequency risk that does not exist in the solo window, so both move together. Grounding:
[research topic](/research/memory-skills-sot-relocation/) · `we:reports/2026-07-04-memory-skills-sot-relocation.md`.

## Why this is a validation gate, not a fork
Pass-0 standing test reroutes both original branches away from `## Fork N`:
- **"Adopt vs keep `.claude`" is not a two-branch fork.** Keeping `.claude` + launching unattended runs with
  `--dangerously-skip-permissions` is the **null / do-nothing baseline**, and the flag is *always* the
  fallback on a machine without the personal hook (graceful degradation) — it does not mutually exclude
  adopting. So the real question is one-sided: *is the relocation+hook candidate worth building at all?* →
  a **go/no-go validation gate**, not a values fork.
- **"Scope: memory-only vs memory-then-skills" was a deferred config dimension**, not a fork — its only
  distinction was cost/frequency (skills change rarely, heavier coupling), which is prioritization, not merit.
  The Ruling below **resolves it to "both together"**: the phasing caution's sole basis was coordination risk,
  which the solo-dev window removes (`#config-extends-platform-default`).

This decision therefore carries a single **verdict** (go/no/not-yet), not forks — ruled **GO** below.

## Prior-art delta
Not greenfield standard design (an agent-tooling / repo-layout call over the WE harness), so no web-platform
survey. No ratified precedent governs it — a grep of `we:docs/agent/platform-decisions.md` finds no
permission-bypass / redirect-hook / `--dangerously-skip` anchor. The one confirmed external fact is the
Claude Code hook API: a user-level `PreToolUse` hook (registered in the personal home `~/.claude` settings)
can rewrite tool input via `hookSpecificOutput.updatedInput.file_path` and auto-approve via
`permissionDecision: "allow"` — exactly the lever the gate uses.

## The candidate mechanism (verified, if ever built)
```jsonc
// personal machine ~/.claude settings (NOT the repo — a machine without it just gets prompts)
{ "hooks": { "PreToolUse": [ { "matcher": "Read|Edit|Write",
  "hooks": [ { "type": "command", "command": "node ~/.claude/hooks/claude-sot-redirect.mjs" } ] } ] } }
```
```js
// ~/.claude/hooks/claude-sot-redirect.mjs — rewrite a .claude SoT path to its real out-of-.claude path
const ev = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const p = ev.tool_input?.file_path ?? '';
const real = p.replace(/(\/.*?)\/\.claude\/agent-memory\//, '$1/agent-memory-src/')
             .replace(/(\/.*?)\/\.claude\/skills\//,       '$1/skills-src/');
if (real !== p) process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...ev.tool_input, file_path: real } }
}));
```

## Cost / hazard ledger (side-effects to manage under GO)
*These are now the build's known work-items and watch-points, not reasons to hold — each is designed out or
tolerated-and-tweaked per the ruling. They stay verbatim below because the build must address every one.*

- **Guard-lane self-deny (the decisive hazard).** `we:scripts/guard-lane.mjs:56` is a **realpath** exemption
  (`real.includes(<.claude/agent-memory/ literal>)`). The redirect hook and guard-lane are *both* `PreToolUse`
  hooks: once the redirect rewrites `.claude/agent-memory/x` → `we:agent-memory-src/x`, guard-lane sees a
  primary-tree path that is `inPrimary && !inLane && !inAgentMemory` → **hard-denies (exit 2)** the very
  interactive memory edit the exemption exists to permit. Adopting therefore *requires* widening `:56` to the
  new path (below) — a coupled, order-sensitive change the naive "just add a hook" framing misses.
  ```js
  // we:scripts/guard-lane.mjs:56 — the widening the relocation would need
  const inAgentMemory = real.includes(`${path.sep}.claude${path.sep}agent-memory${path.sep}`)
                     || real.includes(`${path.sep}agent-memory-src${path.sep}`);
  ```
- **Hook mis-fire surface.** A broad substring rewrite would also redirect *non-memory* `.claude` edits (a
  personal `~/.claude` settings file, or `we:.claude/commands/*.md`) to a phantom `*-src` path with no
  symlink backing — the hook must be scoped precisely.
- **Symlink-clobber surface.** The symlink collapses every session to one SoT inode with no lane isolation
  (memory is already guard-exempt from lanes, so this is pre-existing for memory, but skills' stateful JSON
  would inherit it).
- **Script blast radius.** ~4 scripts do realpath/string tests on the literal `.claude/agent-memory`
  (`we:scripts/guard-lane.mjs`, `we:scripts/check-standards.mjs`, `we:scripts/check-memory-freshness.mjs`,
  `we:scripts/lib/memory-freshness.cjs`) and break on the move; ~14 scripts hardcode the
  `we:.claude/skills/batch-backlog-items` state dir (reads resolve through the symlink, but any
  realpath-then-string-test does not) — see `we:scripts/check-standards.mjs:1484`.
- **Benefit (the ratified upside):** scoped auto-approval of memory/skills edits — which for a self-improving
  loop is the difference between running under a **global** `--dangerously-skip-permissions` bypass and running
  with *only* memory/skills auto-approved while every other write stays gated. That scoped-safety gap is the
  whole point, and it is decisive precisely for the unsupervised self-improvement workload this repo is
  building toward (see verdict ground 1). The per-click interactive saving is a secondary bonus.

## Mandatory statute reconciliation (a required task of the adopting build)
`we:docs/agent/platform-decisions.md:2488` anchors the durable-content rule — *substantive agent-memory
writes ride a **lane→PR**, never a direct-`main` commit; the sanctioned-direct carve-out is
`we:.claude/skills/batch-backlog-items/claims.json`-class local signals ONLY and **never widens to memory
content*** — to the **literal path** `we:.claude/agent-memory/**`. Relocating the SoT to
`we:agent-memory-src/**` (a path the anchor does not name) opens the exact gap `:2488` forbids: an agent
could argue the new path isn't covered → direct-commit memory content = the "widening" the carve-out bans,
through a back door. So the adopting change **must** re-anchor `:2488` (plus the
`:2396` `closeout-never-infers…` reference and `we:scripts/guard-lane.mjs:56`) from `.claude/agent-memory/**`
to `we:agent-memory-src/**`, with an explicit clause: *"relocation is a physical path move only; the
lane→PR-only landing rule and the 'never widens' carve-out are unchanged and now attach to the new path.
Auto-approving the VS Code permission prompt is a permission-gate event, not a landing-path change, and
creates no new sanctioned-direct carve-out."* (Note the distinction so the item doesn't over-claim: the hook
does **not** by itself create a direct-`main` path — the write still lands in the working tree and lane→PR
still governs how it reaches `main`. The collision is purely the literal-anchor gap.)

## Ruling (2026-07-04) — GO, strong form
**Adopt the relocation + scoped redirect hook now, for BOTH agent-memory and skills together.** The build:
1. **Relocate the real files out of `.claude`** to out-of-`.claude` SoT dirs (`we:agent-memory-src/**`,
   `we:skills-src/**` or equivalent), leaving symlinks at the old `.claude/agent-memory` + `.claude/skills`
   paths so every existing reader/skill-loader keeps resolving.
2. **Add the scoped personal `~/.claude` redirect hook** (rewrites *only* the two SoT path prefixes; precisely
   scoped so it never touches `~/.claude` settings or `we:.claude/commands/**` — the mis-fire surface).
3. **Widen `we:scripts/guard-lane.mjs:56`** to recognise the new path alongside the old (the self-deny fix),
   and fix the ~4 realpath/string-test scripts + ~14 skill-state-dir refs in the blast-radius bullet.
4. **Re-anchor the statute** (`:2488`/`:2396`/`:56`) per *Mandatory statute reconciliation* above — physical
   path move only; lane→PR-only landing + the "never widens" carve-out are unchanged and re-attach to the new
   path; the permission-gate auto-approve creates no new sanctioned-direct carve-out.

**Accepted residual risk (owner's call):** the exact hook mechanics and any side-effects are tunable after the
fact; full git history makes every step recoverable, and the solo-dev window means no concurrent session is at
risk while it settles. If a side-effect proves worse than expected, roll the piece back and iterate — do not
re-litigate the GO.

Skeptic: the prepared four-axis red-team REFUTED "adopt-**now**" under the *assumption* that memory edits are
rare in unattended runs and the flag adequately covers them. The human owner's counter-red-team overturned
that assumption (self-improving loops make memory edits the *common* case, and the flag's global bypass is the
wrong posture for exactly that workload), and re-weighted the migration hazards as recoverable-under-solo-dev.
The statute-overlap and citation-scope axis findings **survive unchanged** — they are not reasons to hold but
required build tasks (folded into the Ruling steps above). Verdict flipped not-yet → **GO (strong form)**.

Screen: clear on impl (a repo-internal agent-tooling/layout call, invisible to any WE↔FUI standard consumer;
never claims to be a standard decision). The "memory-only vs skills-later" scope sub-question is resolved by
the ruling — both move together in the solo window; no residual config dimension to defer.

## Provenance
Mechanism discovered + fully verified in an interactive debugging session on 2026-07-04 (the `.claude`-path
gate sits *above* the settings/hook allow pipeline and keys on realpath; a `updatedInput` path-rewrite is the
only lever that auto-approves a `.claude`-classified edit). Prepared 2026-07-04 (`/prepare all`): grounded
against the real tree, published research topic `memory-skills-sot-relocation`, ran the skeptic + two-confusion
screen passes — which reclassified it to a validation gate and set the prepared default to not-yet.
Ratified 2026-07-04 in a decision-mode session: the owner's counter-red-team overturned the not-yet default's
"memory edits are rare" assumption (self-improving loops make them common) and re-weighted the migration
hazards as recoverable under full-history + solo-dev → **GO, strong form (memory + skills together)**. The
implementing build is tracked as a follow-up story (#2266).
