---
kind: decision
size: 5
status: open
locus: webeverything
relatedReport: reports/2026-07-04-memory-skills-sot-relocation.md
dateOpened: "2026-07-04"
dateStarted: "2026-07-04"
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

**Verdict: NOT-YET (default = keep `.claude`; use `--dangerously-skip-permissions` for unattended runs).**
The mechanism is real and the itch is real, but the migration's blast radius (a statute-anchored path, the
realpath-keyed guard-lane logic, ~18 scripts, and a personal path-rewrite hook with live mis-fire and
symlink-clobber surfaces) outweighs its marginal benefit, and the *only painful* case (unattended-workflow
stalls) is already covered by the launch flag. Grounding: [research topic](/research/memory-skills-sot-relocation/)
· `we:reports/2026-07-04-memory-skills-sot-relocation.md`.

## Why this is a validation gate, not a fork
Pass-0 standing test reroutes both original branches away from `## Fork N`:
- **"Adopt vs keep `.claude`" is not a two-branch fork.** Keeping `.claude` + launching unattended runs with
  `--dangerously-skip-permissions` is the **null / do-nothing baseline**, and the flag is *always* the
  fallback on a machine without the personal hook (graceful degradation) — it does not mutually exclude
  adopting. So the real question is one-sided: *is the relocation+hook candidate worth building at all?* →
  a **go/no-go validation gate**, not a values fork.
- **"Scope: memory-only vs memory-then-skills" is a deferred config dimension**, not a fork. Its only
  distinction is cost/frequency (skills change rarely and carry the heavier coupling), which is
  prioritization, not merit — under free-to-build/maintained-forever the two collapse. The honest setting is
  "revisit after a memory slice ships," so there is nothing to ratify today (`#config-extends-platform-default`).

This decision therefore carries a single **verdict** (go/no/not-yet), not forks.

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

## Cost / hazard ledger (why NOT-YET)
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
- **Benefit, weighed against all that:** scoped auto-approval of memory/skills edits — which mainly removes a
  *per-click interactive* cost. The unattended-workflow stall (the only case that actually blocks a run) is
  already solved by `--dangerously-skip-permissions`; the migration's edge over the flag is narrow (scoped
  safety *without* a global bypass), and unattended runs rarely edit memory (close-out lands memory via
  lane→PR, red-teamed) so the flag's blast radius on those runs is acceptable.

## Mandatory statute reconciliation (a precondition of ever adopting)
`we:docs/agent/platform-decisions.md:2488` anchors the durable-content rule — *substantive agent-memory
writes ride a **lane→PR**, never a direct-`main` commit; the sanctioned-direct carve-out is
`we:.claude/skills/batch-backlog-items/claims.json`-class local signals ONLY and **never widens to memory
content*** — to the **literal path** `we:.claude/agent-memory/**`. Relocating the SoT to
`we:agent-memory-src/**` (a path the anchor does not name) opens the exact gap `:2488` forbids: an agent
could argue the new path isn't covered → direct-commit memory content = the "widening" the carve-out bans,
through a back door. So **if** this is ever adopted, the ratifying change must re-anchor `:2488` (plus the
`:2396` `closeout-never-infers…` reference and `we:scripts/guard-lane.mjs:56`) from `.claude/agent-memory/**`
to `we:agent-memory-src/**`, with an explicit clause: *"relocation is a physical path move only; the
lane→PR-only landing rule and the 'never widens' carve-out are unchanged and now attach to the new path.
Auto-approving the VS Code permission prompt is a permission-gate event, not a landing-path change, and
creates no new sanctioned-direct carve-out."* (Note the distinction so the item doesn't over-claim: the hook
does **not** by itself create a direct-`main` path — the write still lands in the working tree and lane→PR
still governs how it reaches `main`. The collision is purely the literal-anchor gap.)

## Recommendation & un-gate trigger
**Default now: keep `.claude` (Fork C).** For unattended runs that stall on memory/skills edits, launch with
`--dangerously-skip-permissions`; interactive edits keep the one-click gate. **Un-gate to a build (memory
slice first) when all three hold:** (1) the interactive per-click cost — *or* the flag's all-or-nothing
unattended bypass — becomes a **measured, felt** burden, not an assumed one; (2) the redirect hook is scoped
to design out the guard-lane self-deny + mis-fire + clobber hazards above; and (3) the `:2488`/`:2396`/`:56`
re-anchoring clause is specced into the adopting change. Sequence, if built: memory-only first (low coupling,
already guard-exempt); skills is a separately-gated later slice, decided on Slice-1 evidence, never bundled.

Skeptic: REFUTED "adopt-now" (2026-07-04 red-team, four axes). Axis-0 reclassified it from a fork to a
validation-gate (adopt vs keep-flag don't mutually exclude); the merit axis found the redirect/guard-lane
self-deny + the flag-already-covers-the-only-painful-case cost/benefit → verdict flipped adopt→**not-yet**,
default now Fork C. Statute-overlap axis found the `:2488` literal-anchor widening gap → reconciliation folded
in above (mandatory precondition). Citation-scope axis: the `we:scripts/guard-lane.mjs:56` exemption's
authoring scope is the string literal `.claude/agent-memory/`, so it does **not** reach `we:agent-memory-src/**`
and cannot be inherited to argue the relocated path is safe — it must be re-authored.

Screen: clear on impl (a repo-internal agent-tooling/layout call, invisible to any WE↔FUI standard consumer;
never claims to be a standard decision). The scope sub-question flagged(prio) — "memory-only vs skills-later"
carries no merit distinction — so it is folded into the trigger as a deferred config dimension, not a fork.

## Provenance
Mechanism discovered + fully verified in an interactive debugging session on 2026-07-04 (the `.claude`-path
gate sits *above* the settings/hook allow pipeline and keys on realpath; a `updatedInput` path-rewrite is the
only lever that auto-approves a `.claude`-classified edit). Prepared 2026-07-04 (`/prepare all`): grounded
against the real tree, published research topic `memory-skills-sot-relocation`, ran the skeptic + two-confusion
screen passes — which reclassified it to a validation gate and flipped the verdict to not-yet.
