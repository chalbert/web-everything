#!/usr/bin/env node
/**
 * bootstrap-session.mjs — make a machine ready to work the constellation, idempotently.
 *
 * WHY THIS EXISTS. The instruction layer already travels: `AGENTS.md` is committed, so any session that
 * opens this repo reads the rules. MACHINE STATE does not travel. A fresh Claude Code cloud VM has the
 * repo on disk and nothing else wired: `~/.claude/skills/` is empty of this repo's skills, so `/drain`,
 * `/jury`, `/pr` and the rest are inert; the sibling repos of the constellation are not cloned; and the
 * lane pool the laptop relies on does not exist and should not. Every VM session so far has rediscovered
 * that by hand, differently. This script is the one answer, in code rather than prose — prose gets
 * half-followed, an idempotent script cannot be.
 *
 * HOST-AWARE, because the right setup differs. On the LAPTOP the lane pool, the reserved memory lane and
 * the user-level guard are the environment, and a skills deploy is deliberately scoped so a WE-specific
 * orchestration skill never leaks into an unrelated repo (see sync-skills-deploy.mjs). On an EPHEMERAL VM
 * none of that holds: there are no unrelated repos, the box is reclaimed on idle, `--reference` has no
 * full object store to share (cloud clones are `--depth 1`), and the branch guard that FORCED clone-based
 * lanes is not installed — so provisioning a pool costs an `npm ci` per lane and buys nothing.
 *
 * WHAT IT NEVER DOES. It does not clone the sibling repos: in a cloud session they arrive through the
 * harness's `add_repo` + credential-proxied clone, which no script here can or should perform. It reports
 * which are missing and names the tool. It does not touch the reserved memory lane or repoint the
 * machine-global memory symlink — that is #2350's supervised, human-gated half, and a script that moved
 * it silently would be the wipe that decision exists to prevent.
 *
 * Usage:
 *   node scripts/bootstrap-session.mjs             # do it (idempotent; safe to re-run)
 *   node scripts/bootstrap-session.mjs --check     # report drift only, write nothing; exit 1 if any
 *   node scripts/bootstrap-session.mjs --dry-run   # print the plan, write nothing; exit 0
 *   node scripts/bootstrap-session.mjs --json      # machine-readable summary on stdout
 *   node scripts/bootstrap-session.mjs --laptop    # force the non-ephemeral plan (override detection)
 *   node scripts/bootstrap-session.mjs --ephemeral # force the ephemeral plan (override detection)
 *   node scripts/bootstrap-session.mjs uninstall   # drop the SessionStart registration
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLineSync } from './lib/write-all-sync.mjs';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The constellation's sibling repos, by the directory name they are expected to occupy. */
export const SIBLINGS = ['frontierui', 'plateau-app'];

/**
 * Is this an ephemeral cloud VM rather than a durable workstation?
 *
 * PURE over an env bag so the plan is testable without a container. The signals are the runner's own, not
 * guesses: `CLAUDE_CODE_CONTAINER_ID` is stamped per cloud container, and `CCR_AGENT_PROXY_ENABLED` marks
 * the credential-proxied egress only the managed environment sets. Either alone is sufficient — requiring
 * BOTH would fail closed the moment the runner renames one, and failing closed here means the laptop plan
 * (lane pool, guard) runs on a VM that has neither.
 */
export function detectHost(env = process.env) {
  const signals = [];
  if (env.CLAUDE_CODE_CONTAINER_ID) signals.push('CLAUDE_CODE_CONTAINER_ID');
  if (env.CCR_AGENT_PROXY_ENABLED === '1') signals.push('CCR_AGENT_PROXY_ENABLED');
  return { ephemeral: signals.length > 0, signals };
}

/**
 * Where memory lives, both candidates, derived exactly as check-memory.mjs derives them (#2301).
 *
 * Kept as ONE function rather than a second copy of the `replace(/\//g, '-')` project key, so the
 * bootstrap can never disagree with the checker about which directory it is reporting on.
 */
export function memoryDirs(root = REPO_ROOT, home = homedir()) {
  return {
    user: join(home, '.claude', 'projects', root.replace(/\//g, '-'), 'memory'),
    repo: join(root, '.claude', 'agent-memory'),
  };
}

/**
 * The steps this host needs, as data. PURE — the runner performs them; `--dry-run` and `--check` print
 * them. Every skip carries its REASON, because a silently-absent step is indistinguishable from a step
 * that ran and did nothing.
 */
export function planSteps({ ephemeral, root = REPO_ROOT, home = homedir(), exists = existsSync } = {}) {
  const mem = memoryDirs(root, home);
  const steps = [];

  // Skills. `--all` bootstraps a machine that has none of them; the scoped default exists to protect a
  // real workstation's ~/.claude/skills from gaining WE orchestration skills it should not carry.
  steps.push({
    id: 'skills',
    title: ephemeral ? 'deploy every skill to ~/.claude/skills (--all)' : 'sync already-deployed skills',
    argv: ephemeral ? ['--all'] : [],
  });

  // Memory. Nothing to INSTALL: check-memory.mjs and memory-resolve.mjs both fall back to the in-repo
  // `.claude/agent-memory` symlink, which git carries into any clone. The user-level dir is the LAPTOP's
  // reserved-lane arrangement (#2350) and is never created or repointed from here.
  steps.push({
    id: 'memory',
    title: 'verify memory resolves',
    verify: () =>
      exists(mem.user) ? { via: 'user', dir: mem.user } : exists(mem.repo) ? { via: 'repo', dir: mem.repo } : null,
  });

  // Siblings. Reported, never cloned — see the header.
  steps.push({
    id: 'siblings',
    title: 'report constellation siblings',
    verify: () =>
      SIBLINGS.map((name) => {
        const path = join(dirname(root), name);
        return { name, path, present: exists(path) };
      }),
  });

  steps.push(
    ephemeral
      ? {
          id: 'lanes',
          title: 'lane pool',
          skip: 'ephemeral host: no branch guard to work around, shallow clones share nothing via --reference, and the box is reclaimed on idle — a pool costs npm ci per lane and buys nothing',
        }
      : {
          id: 'lanes',
          title: 'lane pool',
          skip: 'owned by lane-pool.mjs — run `node scripts/lane-pool.mjs provision --count=N` yourself',
        },
  );

  steps.push(
    ephemeral
      ? { id: 'guard', title: 'lane guard', skip: 'ephemeral host: the guard pushes edits into a lane, and there is no pool here' }
      : { id: 'guard', title: 'lane guard', info: 'check with `node scripts/guard-lane-install.mjs status`' },
  );

  return steps;
}

// ── SessionStart hook registration (user level, absolute path — the #3074 shape) ───────────────────────

export const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
export const BOOTSTRAP_PATH = join(REPO_ROOT, 'scripts', 'bootstrap-session.mjs');

const isOurs = (h) => typeof h?.command === 'string' && h.command.includes('bootstrap-session.mjs');

/**
 * Add or repair the SessionStart entry in a settings OBJECT. PURE.
 *
 * Idempotent by IDENTITY, not by count: an entry naming this script is replaced, so re-running after the
 * checkout moves REPAIRS the path rather than leaving a second, stale registration that resolves nowhere.
 */
export function withBootstrapHook(settings, scriptPath = BOOTSTRAP_PATH) {
  const next = JSON.parse(JSON.stringify(settings ?? {}));
  next.hooks = next.hooks ?? {};
  const list = Array.isArray(next.hooks.SessionStart) ? next.hooks.SessionStart : [];
  next.hooks.SessionStart = list
    .map((block) => (Array.isArray(block?.hooks) ? { ...block, hooks: block.hooks.filter((h) => !isOurs(h)) } : block))
    .filter((block) => !Array.isArray(block?.hooks) || block.hooks.length > 0);
  next.hooks.SessionStart.push({ hooks: [{ type: 'command', command: `node ${scriptPath}` }] });
  return next;
}

/** Remove every bootstrap entry, wherever it sits. PURE. */
export function withoutBootstrapHook(settings) {
  const next = JSON.parse(JSON.stringify(settings ?? {}));
  if (!Array.isArray(next.hooks?.SessionStart)) return next;
  next.hooks.SessionStart = next.hooks.SessionStart
    .map((block) => (Array.isArray(block?.hooks) ? { ...block, hooks: block.hooks.filter((h) => !isOurs(h)) } : block))
    .filter((block) => !Array.isArray(block?.hooks) || block.hooks.length > 0);
  return next;
}

/** Which bootstrap commands a settings object registers, and whether each resolves. PURE over a probe. */
export function bootstrapStatus(settings, exists = existsSync) {
  const found = [];
  for (const block of settings?.hooks?.SessionStart ?? []) {
    for (const h of block?.hooks ?? []) {
      if (!isOurs(h)) continue;
      const path = String(h.command).replace(/^node\s+/, '').trim();
      found.push({ path, resolves: exists(path), absolute: path.startsWith('/') });
    }
  }
  return found;
}

// ── io ────────────────────────────────────────────────────────────────────────────────────────────────

const readSettings = () => (existsSync(SETTINGS_PATH) ? JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) : {});

function writeSettings(next) {
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  if (existsSync(SETTINGS_PATH)) copyFileSync(SETTINGS_PATH, `${SETTINGS_PATH}.bak`);
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

function installHook() {
  const before = readSettings();
  if (bootstrapStatus(before).some((f) => f.path === BOOTSTRAP_PATH && f.resolves)) return 'already registered';
  writeSettings(withBootstrapHook(before));
  return `registered in ${SETTINGS_PATH}`;
}

function uninstallHook() {
  const before = readSettings();
  if (!bootstrapStatus(before).length) return `not registered in ${SETTINGS_PATH}`;
  writeSettings(withoutBootstrapHook(before));
  return `removed from ${SETTINGS_PATH} (previous saved to ${SETTINGS_PATH}.bak)`;
}

/** Shell the existing skills CLI — never reimplement its deploy, prune or tracked-file rules. */
function runSkills(argv, { write }) {
  const args = [join(REPO_ROOT, 'scripts', 'sync-skills-deploy.mjs'), ...argv, ...(write ? [] : ['--check'])];
  try {
    return { ok: true, out: execFileSync(process.execPath, args, { encoding: 'utf8' }).trim().split('\n').at(-1) };
  } catch (e) {
    // sync-skills-deploy --check exits 1 on drift; that is a REPORT, not a failure of this script.
    return { ok: false, out: String(e.stdout || e.message).trim().split('\n').at(-1) };
  }
}

function describe(step) {
  if (typeof step.detail === 'string') return step.detail;
  if (step.id === 'memory') {
    return step.detail ? `${step.detail.via} → ${step.detail.dir}` : 'NO memory dir — /note and memory-resolve will fail';
  }
  return step.detail
    .map((s) => `${s.name}${s.present ? '' : ' (MISSING — attach with the harness `add_repo` tool, then clone)'}`)
    .join(', ');
}

function main(argv) {
  const has = (f) => argv.includes(f);
  if (argv[0] === 'uninstall') { writeLineSync(1, `bootstrap-session: ${uninstallHook()}`); return 0; }
  const write = !has('--check') && !has('--dry-run');
  const detected = detectHost();
  const ephemeral = has('--ephemeral') ? true : has('--laptop') ? false : detected.ephemeral;
  const report = { host: ephemeral ? 'ephemeral' : 'laptop', signals: detected.signals, steps: [] };

  for (const step of planSteps({ ephemeral })) {
    if (step.skip) { report.steps.push({ id: step.id, status: 'skipped', detail: step.skip }); continue; }
    if (step.info) { report.steps.push({ id: step.id, status: 'info', detail: step.info }); continue; }
    if (step.id === 'skills') {
      if (has('--dry-run')) { report.steps.push({ id: step.id, status: 'planned', detail: step.title }); continue; }
      const r = runSkills(step.argv, { write });
      report.steps.push({ id: step.id, status: r.ok ? 'ok' : 'drift', detail: r.out });
      continue;
    }
    const v = step.verify();
    const ok = step.id === 'memory' ? Boolean(v) : v.every((s) => s.present);
    report.steps.push({ id: step.id, status: ok ? 'ok' : step.id === 'siblings' ? 'missing' : 'drift', detail: v });
  }

  if (write) report.hook = installHook();

  if (has('--json')) {
    writeLineSync(1, JSON.stringify(report, null, 2));
  } else {
    writeLineSync(1, `bootstrap-session — host: ${report.host}${report.signals.length ? ` (${report.signals.join(', ')})` : ''}`);
    for (const s of report.steps) writeLineSync(1, `  ${s.status.padEnd(8)} ${s.id.padEnd(9)} ${describe(s)}`);
    if (report.hook) writeLineSync(1, `  hook     SessionStart ${report.hook}`);
  }

  return has('--check') && report.steps.some((s) => s.status === 'drift') ? 1 : 0;
}

// `process.exitCode =`, not `process.exit()` — #3061's exit-wraps-call shape discards the callee's flush.
if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
