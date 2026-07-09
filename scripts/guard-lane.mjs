#!/usr/bin/env node
/**
 * guard-lane.mjs — PreToolUse(Edit|Write) gate enforcing the #2123 lane-isolation rule.
 *
 * RULED (#2123): every edit-action runs in an isolated lane CLONE (`~/workspace/.lanes/<repo>/lane-N`),
 * NOT the shared primary checkout of a constellation repo (web-everything / frontierui / plateau-app).
 * That rule was previously judgment-only — nothing stopped an agent from editing the primary tree, and
 * it silently happened. "Is this file in a primary checkout instead of a lane?" is fully script-decidable
 * (a path test), so per the hookable-vs-judgment rule (#51) it belongs in a deterministic hook, here.
 *
 * DECISION: deny the Edit/Write when the target file resolves under a constellation PRIMARY checkout and
 * NOT under a `.lanes/` clone. Everything else is allowed — lane clones, other repos, the scratchpad,
 * genuinely-personal `~/.claude/*` config that does NOT resolve into a repo, untracked scratch.
 *
 * AGENT MEMORY IS NOT EXEMPT (2026-07-09, superseding a conflicting 2026-07-03 "memory is low-collision,
 * edit-in-place" note). The repo memory store is git-TRACKED project content: its SoT is `<repo>/
 * agent-memory-src/`, reachable via the `<repo>/.claude/agent-memory` symlink AND via the user-level
 * `~/.claude/projects/<slug>/memory` symlink — BOTH realpath under the primary. Editing it in the primary
 * collides with concurrent sessions and a lane-refresh `reset --hard` can wipe it, exactly like any other
 * tracked file. So memory rides a lane → PR like everything else (the close flow's red-team→lane→PR path
 * already does; this only closes the interactive hole). The gate keys on REALPATH, so all three aliases
 * resolve to `agent-memory-src/…` under the primary and are denied — edit memory in a lane instead. This
 * is uniform with the no-carve-out rule; the `~/.claude/*` bypass survives ONLY for paths that do NOT
 * realpath into a repo (e.g. `~/.claude/settings.json`).
 *
 * ESCAPE HATCH: set `LANE_GUARD_OFF=1` for the rare sanctioned primary-tree edit (e.g. bootstrapping this
 * very guard, or an emergency hotfix the user directs). The escape is loud by being explicit.
 *
 * Protocol: reads the PreToolUse event JSON on stdin, denies via exit code 2 + a stderr message (mirrors
 * scripts/backlog-guard.mjs). Fail-OPEN on any internal error — a guard bug must never wedge the agent.
 */
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRIMARY_REPOS = ['webeverything', 'web-everything', 'frontierui', 'plateau-app'];
const SEP = path.sep;

/**
 * PURE decision — no I/O. Given an already-resolved REAL path and the guard's own repo root, return a deny
 * message when the edit targets a constellation PRIMARY checkout outside any lane clone, else null (allow).
 * Kept separate from the stdin/exit-code wrapper so it is unit-testable (mirrors guard-git-push.mjs).
 * @param {string} real  the target's resolved real path (symlinks already followed by the caller)
 * @param {string} weRoot  this guard's repo root (`<workspace>/<repo>`); `<workspace>` is its parent
 * @returns {string|null}
 */
export function laneGuardDecision(real, weRoot) {
  if (!real) return null; // no path to judge (never block)
  const workspace = path.dirname(weRoot);
  const primaries = PRIMARY_REPOS.map((r) => path.join(workspace, r) + SEP);

  // A lane clone lives under `<workspace>/.lanes/…` — never under a primary root — so a primary-root prefix
  // test alone cleanly separates the two. Agent memory is NO LONGER exempt (2026-07-09): its realpath
  // resolves under `<primary>/agent-memory-src/…` (via `.claude/agent-memory` OR the user-level
  // `~/.claude/projects/<slug>/memory` symlink), so a primary memory edit is denied like any tracked file.
  const inLane = real.includes(`${SEP}.lanes${SEP}`);
  const inPrimary = primaries.some((p) => (real + SEP).startsWith(p));
  if (!inPrimary || inLane) return null;

  const isMemory = real.includes(`${SEP}agent-memory-src${SEP}`)
                || real.includes(`${SEP}.claude${SEP}agent-memory${SEP}`);
  return (
    `edit BLOCKED — "${path.relative(workspace, real)}" is in the shared PRIMARY checkout. Per #2123 every ` +
    `edit runs in an isolated lane CLONE, not the primary tree (a concurrent session or the user's dev ` +
    `server can collide otherwise)${isMemory ? '. Agent memory is git-tracked project content — it is NOT ' +
    'exempt (2026-07-09); edit it in a lane too, same as any file' : ''}. Provision/pick a lane and edit THERE:\n` +
    `  node scripts/lane-pool.mjs status --json      # find a clean lane\n` +
    `  node scripts/lane-pool.mjs path --lane=N       # its path under ~/workspace/.lanes/\n` +
    `Then edit the file at that lane path.${isMemory ? '' : ' (Sanctioned primary edit? re-run with LANE_GUARD_OFF=1.)'}`
  );
}

/** Resolve a target to its REAL path: follow symlinks; for a not-yet-existing file realpath the nearest
 *  existing ancestor dir so the location still classifies; fall back to the raw resolved path. */
export function resolveReal(file) {
  let real = path.resolve(file);
  try { real = realpathSync(real); } catch {
    try { real = path.join(realpathSync(path.dirname(real)), path.basename(real)); } catch { /* keep raw */ }
  }
  return real + '';
}

// ── CLI wrapper: stdin event → exit code (only when run directly, not when imported by the test) ──────────
if (process.argv[1] && realpathSyncSafe(process.argv[1]) === realpathSyncSafe(fileURLToPath(import.meta.url))) {
  try {
    if (process.env.LANE_GUARD_OFF !== '1') {
      const ev = JSON.parse(readFileSync(0, 'utf8') || '{}');
      const file = ev?.tool_input?.file_path;
      if (file) {
        // Roots derived from this script's own location so the hook is portable:
        //   <workspace>/<repo>/scripts/guard-lane.mjs  →  <workspace> is the shared parent of every checkout.
        const weRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
        const msg = laneGuardDecision(resolveReal(file), weRoot);
        if (msg) { process.stderr.write('guard-lane: ' + msg + '\n'); process.exit(2); }
      }
    }
  } catch { /* fail-OPEN: a guard fault must never wedge the agent */ }
  process.exit(0);
}

function realpathSyncSafe(p) { try { return realpathSync(p); } catch { return path.resolve(p); } }
