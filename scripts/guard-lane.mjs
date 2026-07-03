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
 * `~/.claude` agent memory (incl. the repo `.claude/agent-memory/` it symlinks to), untracked scratch.
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

function allow() { process.exit(0); }
function deny(msg) { process.stderr.write('guard-lane: ' + msg + '\n'); process.exit(2); }

try {
  if (process.env.LANE_GUARD_OFF === '1') allow();

  const ev = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const file = ev?.tool_input?.file_path;
  if (!file) allow(); // no path to judge (never block)

  // The constellation PRIMARY roots, derived from this script's own location so the hook is portable:
  //   <workspace>/<repo>/scripts/guard-lane.mjs  →  <workspace> is the shared parent of every checkout.
  const weRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const workspace = path.dirname(weRoot);
  const PRIMARY_REPOS = ['webeverything', 'web-everything', 'frontierui', 'plateau-app'];
  const primaries = PRIMARY_REPOS.map((r) => path.join(workspace, r) + path.sep);

  // Resolve the target's real path. For a Write to a not-yet-existing file, realpath the nearest existing
  // ancestor dir so the location still classifies. Fall back to the raw path.
  let real = path.resolve(file);
  try { real = realpathSync(real); } catch {
    try { real = path.join(realpathSync(path.dirname(real)), path.basename(real)); } catch { /* keep raw */ }
  }
  real += ''; // string

  // A lane clone lives under `<workspace>/.lanes/…` — never under a primary root — so a primary-root
  // prefix test alone cleanly separates the two.
  const inLane = real.includes(`${path.sep}.lanes${path.sep}`);
  // Agent-memory tree is exempt (restores the guard's stated intent that ~/.claude memory is free to edit —
  // the per-project memory dir is symlinked INTO <repo>/.claude/agent-memory, which would otherwise classify
  // as primary). Memory is low-collision, frequently-updated, and not lane-isolated work (user directive 2026-07-03).
  const inAgentMemory = real.includes(`${path.sep}.claude${path.sep}agent-memory${path.sep}`);
  const inPrimary = primaries.some((p) => (real + path.sep).startsWith(p));

  if (inPrimary && !inLane && !inAgentMemory) {
    deny(
      `edit BLOCKED — "${path.relative(workspace, real)}" is in the shared PRIMARY checkout. Per #2123 every ` +
      `edit runs in an isolated lane CLONE, not the primary tree (a concurrent session or the user's dev ` +
      `server can collide otherwise). Provision/pick a lane and edit THERE:\n` +
      `  node scripts/lane-pool.mjs status --json      # find a clean lane\n` +
      `  node scripts/lane-pool.mjs path --lane=N       # its path under ~/workspace/.lanes/\n` +
      `Then edit the file at that lane path. (Sanctioned primary edit? re-run with LANE_GUARD_OFF=1.)`,
    );
  }
  allow();
} catch {
  allow(); // fail-open: a guard fault must not wedge the agent
}
