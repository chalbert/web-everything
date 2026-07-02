#!/usr/bin/env node
/**
 * push-if-green.mjs — publish a repo's `main` to origin after a green gate (#2073).
 *
 * WHY: nothing in the batch / lane / close flow ever pushed `main`, so `origin/main` silently drifted
 * (observed 185 commits behind local after one parallel batch). The parallel orchestrator round-trips
 * `main` through the remote as throwaway `lane/_base` + `lane/*` refs (which it deletes) and lands merges
 * on the LOCAL primary checkout only; the serial `/batch` and close paths commit locally and (a leftover of
 * the pre-2026-06-29 never-push stance, now lifted) never pushed. Result: GitHub frozen, no off-machine
 * backup, no CI trigger, a fresh clone sees none of it.
 *
 * This is the ONE shared helper both the parallel integrator and the serial/close commit path call to
 * publish `main`. It generalizes the PUSH, not the LANE — lanes stay parallel-only (#2073 out-of-scope note).
 *
 * RULES (#2073):
 *  - Green-gate precondition — push a repo's `main` ONLY when that repo's gate is green. Either this script
 *    runs the gate itself (default), or the caller already ran it and passes `--assume-green` (the parallel
 *    integrator has just run the full per-repo gate on the merged tree — re-running would be wasteful).
 *    Never publish a red state.
 *  - Fast-forward ONLY, never --force. One local `main` serializes all merges (the integrator is a mutex),
 *    so pushes to origin/main are ff appends. A non-ff push (someone else advanced origin) ABORTS — it is
 *    never forced; the drift is recoverable, a later green push resolves it once origin is merged in.
 *  - Per-repo across the constellation (#96): WE + frontierui + plateau-app each push their OWN `main` after
 *    their OWN gated merge. Point `--repo` / cwd at the repo to publish; `--gate` names its gate command.
 *  - Only ever pushes the branch named `main` (or `--branch`), and only when HEAD is on it — never a lane ref,
 *    never a detached HEAD. Honors the standing guards: pushing `main` is allowed (never-push lifted
 *    2026-06-29); this script does NOT create branches or broad-stage.
 *
 * Usage:
 *   node scripts/push-if-green.mjs                       # gate (vitest unit suite + check:standards, #2080) THIS repo, ff-push main if green
 *   node scripts/push-if-green.mjs --repo=~/workspace/frontierui --gate="npm run check:standards"
 *   node scripts/push-if-green.mjs --repo=~/workspace/plateau-app --gate="npm run build"
 *   node scripts/push-if-green.mjs --assume-green        # caller already gated green — skip the gate, just ff-push
 *   node scripts/push-if-green.mjs --dry-run             # gate + report the push decision, but do NOT push
 *   node scripts/push-if-green.mjs --json                # machine-readable result
 *
 * Flags:
 *   --repo=<path>     checkout to publish (default: the cwd's git toplevel)
 *   --gate=<cmd>      the gate command to run in that repo (default: "npm run test:unit && npm run check:standards")
 *   --branch=<ref>    the branch to publish (default: "main")
 *   --remote=<name>   the remote to push to (default: "origin")
 *   --assume-green    skip running the gate — the caller has already verified green (integrator path)
 *   --dry-run         run the gate + decide, but never push
 *   --json            emit a JSON result object on stdout
 *
 * Exit codes: 0 = pushed (or nothing-to-push / dry-run OK); 2 = gate red (nothing pushed); 3 = not ff /
 * wrong branch / push failed (nothing pushed). A non-zero exit means origin/<branch> was left UNTOUCHED.
 */
import { execFileSync, execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// ── tiny arg parsing (matches lane-pool.mjs) ────────────────────────────────────────────────────────
const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
}

const expandHome = (p) => (p && p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
const REPO = resolve(expandHome(flags.repo) || process.cwd());
const GATE = typeof flags.gate === 'string' ? flags.gate : 'npm run test:unit && npm run check:standards';
const BRANCH = typeof flags.branch === 'string' ? flags.branch : 'main';
const REMOTE = typeof flags.remote === 'string' ? flags.remote : 'origin';
const ASSUME_GREEN = !!flags['assume-green'];
const DRY_RUN = !!flags['dry-run'];
const AS_JSON = !!flags.json;

// ── git helpers (throw-on-error) ────────────────────────────────────────────────────────────────────
const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (args) => { try { return git(args); } catch { return null; } };

function emit(result, exitCode) {
  if (AS_JSON) process.stdout.write(JSON.stringify(result) + '\n');
  else {
    const tag = result.pushed ? '✓ pushed' : (result.reason === 'up-to-date' || result.reason === 'nothing-to-push' ? '· nothing to push' : (DRY_RUN && result.gate === 'green' ? '· dry-run (would push)' : '✗ not pushed'));
    process.stderr.write(`push-if-green [${result.repo}] ${tag}: ${result.detail}\n`);
  }
  process.exit(exitCode);
}

// ── 1. Confirm we're on the branch we intend to publish (never push a lane ref / detached HEAD) ───────
const head = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']);
if (head !== BRANCH) {
  emit(
    { repo: REPO, pushed: false, gate: 'skipped', reason: 'wrong-branch', detail: `HEAD is "${head}", not "${BRANCH}" — refusing to push (only publishes ${BRANCH} from ${BRANCH}).` },
    3,
  );
}

// ── 2. Green-gate precondition — run the gate unless the caller already verified green ────────────────
let gate = 'assumed-green';
if (!ASSUME_GREEN) {
  try {
    execSync(GATE, { cwd: REPO, stdio: 'inherit' });
    gate = 'green';
  } catch {
    emit(
      { repo: REPO, pushed: false, gate: 'red', reason: 'gate-red', detail: `gate "${GATE}" is RED — origin/${BRANCH} left untouched (a later green push recovers the drift).` },
      2,
    );
  }
}

// ── 3. Is there anything to push? Compare local BRANCH to remote-tracking, ff-only ────────────────────
// Fetch the remote branch WITHOUT modifying the working tree (updates only the remote-tracking ref).
tryGit(['fetch', REMOTE, BRANCH, '--quiet']);
const local = git(['rev-parse', BRANCH]);
const remote = tryGit(['rev-parse', `${REMOTE}/${BRANCH}`]);

if (remote && remote === local) {
  emit({ repo: REPO, pushed: false, gate, reason: 'up-to-date', detail: `${REMOTE}/${BRANCH} already matches local ${BRANCH} (${local.slice(0, 8)}).` }, 0);
}

// If origin exists, require the push to be a genuine fast-forward: remote must be an ANCESTOR of local. If
// not, someone else advanced origin/main — do NOT force; abort and report (the drift is recoverable).
if (remote) {
  let isFf = false;
  try { execFileSync('git', ['merge-base', '--is-ancestor', remote, local], { cwd: REPO, stdio: 'ignore' }); isFf = true; } catch { isFf = false; }
  if (!isFf) {
    emit(
      { repo: REPO, pushed: false, gate, reason: 'not-fast-forward', detail: `${REMOTE}/${BRANCH} (${remote.slice(0, 8)}) is NOT an ancestor of local ${BRANCH} (${local.slice(0, 8)}) — refusing non-ff push (never --force). Merge origin/${BRANCH} in, re-gate, then re-run.` },
      3,
    );
  }
}

if (DRY_RUN) {
  emit({ repo: REPO, pushed: false, gate, reason: 'dry-run', detail: `would ff-push local ${BRANCH} (${local.slice(0, 8)}) → ${REMOTE}/${BRANCH}${remote ? ` (from ${remote.slice(0, 8)})` : ' (new remote branch)'}.` }, 0);
}

// ── 4. Fast-forward push (explicit refspec; never --force) ────────────────────────────────────────────
try {
  git(['push', REMOTE, `${BRANCH}:${BRANCH}`]);
} catch (e) {
  emit(
    { repo: REPO, pushed: false, gate, reason: 'push-failed', detail: `git push ${REMOTE} ${BRANCH}:${BRANCH} failed (${String(e && e.message || e).split('\n')[0]}) — origin unchanged.` },
    3,
  );
}
emit({ repo: REPO, pushed: true, gate, reason: 'pushed', detail: `ff-pushed local ${BRANCH} (${local.slice(0, 8)}) → ${REMOTE}/${BRANCH}.` }, 0);
