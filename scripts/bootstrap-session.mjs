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
 * WHERE THIS LIVES IS NOT WHERE IT STAYS. The lane and delivery machinery this sets up is Plateau's
 * product; WE is a PUBLIC peer that happens to dogfood it, not the constellation's hub. So nothing here
 * hard-codes its own home: the checkout it is in is DERIVED (`selfKey`), the siblings come from the shared
 * constellation table rather than a local literal, and the skills CLI is looked up self-then-siblings so
 * the two halves can move in either order. Relocating this file should be a `git mv`, not a rewrite.
 *
 * WHAT IT NEVER DOES. It does not clone the sibling repos: in a cloud session they arrive through the
 * harness's `add_repo` + credential-proxied clone, which no script here can or should perform. It reports
 * which are missing and names the tool. It does not touch the reserved memory lane or repoint the
 * machine-global memory symlink — that is #2350's supervised, human-gated half, and a script that moved
 * it silently would be the wipe that decision exists to prevent.
 *
 * CONSENT: A DURABLE HOST IS REPORTED ON, NEVER MUTATED IMPLICITLY. The committed project SessionStart hook
 * means this runs the moment anyone opens the repo, so a default run must not reach outside the repository.
 * On a workstation it reports what it would do and stops; `install` is the explicit opt-in, `uninstall` the
 * reverse. An ephemeral cloud VM writes freely — its `$HOME` is a container reclaimed on idle, so there is
 * no durable state to consent about, and the value of a session that configures itself is the whole point.
 *
 * Usage:
 *   node scripts/bootstrap-session.mjs             # report; applies only on an ephemeral host
 *   node scripts/bootstrap-session.mjs --check     # report drift only, write nothing; exit 1 if any
 *   node scripts/bootstrap-session.mjs --dry-run   # print the plan, write nothing; exit 0
 *   node scripts/bootstrap-session.mjs --json      # machine-readable summary on stdout
 *   node scripts/bootstrap-session.mjs --laptop    # force the non-ephemeral plan (override detection)
 *   node scripts/bootstrap-session.mjs --ephemeral # force the ephemeral plan (override detection)
 *   node scripts/bootstrap-session.mjs install     # apply on ANY host (the explicit opt-in)
 *   node scripts/bootstrap-session.mjs uninstall   # drop the SessionStart registration
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLineSync } from './lib/write-all-sync.mjs';
import { CONSTELLATION_REPOS, repoKeyForDir, siblingKeys } from './lib/constellation-repos.mjs';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Which constellation repo is this script sitting in? DERIVED, never assumed.
 *
 * This script must survive its own relocation. The lane and delivery machinery is Plateau's product, and WE
 * — a PUBLIC peer, not a hub — is where it happens to be dogfooded today; the move is a `git mv`, and
 * anything that hard-coded "I am WE, my siblings are the other two" would silently invert on the day it
 * happened (reporting WE as a missing sibling of itself). Asking the shared table which checkout we are in
 * costs one basename lookup and makes the move free. PURE over a root.
 */
export function selfKey(root = REPO_ROOT) {
  return repoKeyForDir(basename(root));
}

/**
 * The constellation members this checkout expects beside it, with the path each should occupy. Resolved
 * relative to the CURRENT repo's parent rather than the table's `$HOME/workspace` literals, because the
 * laptop and a cloud VM disagree about that prefix and both are correct.
 */
export function siblingsFor(root = REPO_ROOT, exists = existsSync) {
  const parent = dirname(root);
  return siblingKeys(selfKey(root)).map((key) => {
    const dirs = CONSTELLATION_REPOS[key].dirs;
    const found = dirs.map((d) => join(parent, d)).find((p) => exists(p));
    return { name: key, path: found ?? join(parent, dirs[0]), present: Boolean(found) };
  });
}

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

  // Commands are the half that had no deploy path at all: `.claude/commands/*.md` are live only in a session
  // whose PRIMARY directory is this repo, so from a sibling, a lane, or any VM the twenty slash commands
  // silently did not exist. `--all` on both hosts: unlike a skill, a command is inert until invoked by name,
  // so deploying one the operator never types costs nothing, while NOT deploying it is the whole bug.
  steps.push({ id: 'commands', title: 'deploy .claude/commands to ~/.claude/commands (--all)', argv: ['--all'], cli: 'sync-commands-deploy.mjs' });

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
    verify: () => siblingsFor(root, exists),
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

  // Laptop only: a lane clone reads objects from the primary's `.git` via `--reference`, so that directory
  // needs an explicit grant. No lanes on an ephemeral host, so nothing to grant there.
  if (!ephemeral) steps.push({ id: 'gitdir', title: 'grant the primary checkout .git', gitDir: join(primaryCheckout(root), '.git') });

  return steps;
}

/**
 * The PRIMARY checkout, given any checkout — a lane clone resolves to the checkout it was cloned from.
 *
 * Same derivation `guard-lane-install.mjs` makes for the guard path, and for the same reason: a lane is
 * reset and recycled, so anything registered from inside one silently stops resolving. PURE.
 */
export function primaryCheckout(root = REPO_ROOT, exists = existsSync) {
  const marker = `${sep}.lanes${sep}`;
  const i = root.indexOf(marker);
  if (i < 0) return root;
  const workspace = root.slice(0, i);
  // `<workspace>/.lanes/<pool>/lane-N`. The POOL name is derived by lane-pool.mjs from the origin URL
  // basename (`web-everything`), which is NOT necessarily the directory the primary checkout occupies (the
  // laptop's is `webeverything` — the same divergence guard-lane-install.mjs hard-codes around). So the pool
  // name identifies the REPO, and the primary's directory is then PROBED among that repo's known basenames.
  // Deriving it instead of probing produced a path that resolves nowhere, silently.
  const dirs = CONSTELLATION_REPOS[repoKeyForDir(root.split(sep).at(-2) ?? '') ?? '']?.dirs;
  if (!dirs) return workspace;
  return dirs.map((d) => join(workspace, d)).find((p) => exists(p)) ?? join(workspace, dirs[0]);
}

/**
 * Grant the primary checkout's `.git` to the agent, at USER level, derived rather than typed.
 *
 * A lane is cloned with `--reference <primary>`, so git in a lane reads objects out of the primary's
 * `.git` — which sits outside the lane and needs an explicit grant. That grant lived as an absolute
 * `/Users/<name>/...` literal inside the COMMITTED `.claude/settings.json`, which made it wrong for
 * everyone else and dead in every cloud VM. It is machine state, so it belongs in machine-level settings,
 * computed from where the checkout actually is. PURE.
 */
export function withPrimaryGitDir(settings, gitDir, known = []) {
  const next = JSON.parse(JSON.stringify(settings ?? {}));
  next.permissions = next.permissions ?? {};
  const dirs = Array.isArray(next.permissions.additionalDirectories) ? next.permissions.additionalDirectories : [];
  // Repair, not accumulate: a moved checkout must not leave a dead grant beside the live one. But the set we
  // may drop is ONLY the ones this script could itself have written — the `.git` of a constellation checkout
  // at a path we can name. The first cut matched any string ending in `/.git`, which silently REVOKED an
  // operator's hand-added grant for an unrelated repo on the next run (converge finding, 2026-08-18). A
  // grant we cannot prove is ours is the operator's, and is left alone.
  const ours = new Set([gitDir, ...known]);
  next.permissions.additionalDirectories = [...dirs.filter((d) => !ours.has(d)), gitDir];
  return next;
}

/**
 * Every `.git` path this script could have written on this machine — the constellation checkouts it knows
 * about, in both of the directory names each answers to. Used as the "is this grant ours?" set above, so
 * repair stays exact instead of matching by suffix.
 */
export function knownGitDirs(root = REPO_ROOT) {
  const parent = dirname(primaryCheckout(root));
  return Object.values(CONSTELLATION_REPOS).flatMap((m) => m.dirs.map((d) => join(parent, d, '.git')));
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

/**
 * Where the skills deploy CLI lives — THIS checkout only. PURE over a probe.
 *
 * An earlier cut searched sibling constellation checkouts too, so the two halves could move to Plateau
 * independently. That was a cross-repo CODE EXECUTION path: siblings arrive on a cloud VM through the
 * harness's `add_repo`, are not vetted by this repo, and whatever `sync-skills-deploy.mjs` was found got
 * `execFileSync`'d with full privileges on every run — including the automatic SessionStart one, with no
 * provenance check (converge finding, 2026-08-18). The convenience it bought was one commit's worth of
 * ordering freedom during a relocation that has not happened yet and is properly handled by the
 * multi-project registry (#2472). Deleted rather than defended: a missing CLI now reports and skips.
 */
export function skillsDeployScript(root = REPO_ROOT, exists = existsSync, cli = 'sync-skills-deploy.mjs') {
  const here = join(root, 'scripts', cli);
  return exists(here) ? here : null;
}

/** Shell the existing skills CLI — never reimplement its deploy, prune or tracked-file rules. */
function runSkills(script, argv, { write }) {
  const args = [script, ...argv, ...(write ? [] : ['--check'])];
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

/**
 * May this run write OUTSIDE the repository — into the machine-global `$HOME/.claude` tree? PURE.
 *
 * The first cut always could, and the committed project SessionStart hook made that automatic: opening this
 * repo in Claude Code silently granted a directory and installed a USER-level hook that then fired in every
 * unrelated repo on that machine (converge finding, 2026-08-18). Consent is the issue, and it is a
 * WORKSTATION issue — on an ephemeral cloud VM `$HOME` belongs to a container that is reclaimed on idle, so
 * there is no durable state to mutate and nothing to consent to. Hence: ephemeral writes freely, a durable
 * host reports and requires the explicit `install` subcommand.
 */
export function mayWriteUserTree({ ephemeral, explicitInstall = false } = {}) {
  return Boolean(ephemeral || explicitInstall);
}

/**
 * What the `gitdir` step should report, and whether it should write. PURE — the decision lives here so it is
 * testable; `main` keeps only the fs calls around it.
 *
 * WHY IT IS ITS OWN FUNCTION. This branch used to sit inline in `main`, which is not exported and has no
 * test, and it reported `planned` for EVERY read-only path. That made `--check`'s documented contract
 * ("report drift only … exit 1 if any") unreachable for this step: a missing grant and a correct one both
 * printed `planned`, and the exit code — which keys off `status === 'drift'` — could never fire. An
 * untestable branch is where that hides, so the branch stopped being untestable.
 *
 * THE THREE PATHS:
 *   - `--dry-run` DESCRIBES what would happen and reads nothing → `planned`;
 *   - any other read-only path (`--check`, and the default report on a durable host) REPORTS STATE
 *     → `ok` when the grant is present, `drift` when it is not;
 *   - a writing path grants when absent and reports `ok` either way.
 *
 * @param {{gitDir: string, settings: object|null, write: boolean, dryRun?: boolean}} o
 * @returns {{status: 'planned'|'ok'|'drift', detail: string, grant: boolean}}
 */
export function gitDirStatus({ gitDir, settings, write, dryRun = false } = {}) {
  if (dryRun) return { status: 'planned', detail: gitDir, grant: false };
  const granted = (settings?.permissions?.additionalDirectories ?? []).includes(gitDir);
  if (!write) {
    return granted
      ? { status: 'ok', detail: `${gitDir} (already granted)`, grant: false }
      : { status: 'drift', detail: `${gitDir} (NOT granted — run \`npm run bootstrap:install\`)`, grant: false };
  }
  return { status: 'ok', detail: `${gitDir}${granted ? ' (already granted)' : ' (granted)'}`, grant: !granted };
}

function main(argv) {
  const has = (f) => argv.includes(f);
  if (argv[0] === 'uninstall') { writeLineSync(1, `bootstrap-session: ${uninstallHook()}`); return 0; }
  const explicitInstall = argv[0] === 'install';
  const readOnlyFlag = has('--check') || has('--dry-run');
  const detected = detectHost();
  const ephemeral = has('--ephemeral') ? true : has('--laptop') ? false : detected.ephemeral;
  // `write` now means "may touch $HOME/.claude", not merely "was --check absent".
  const write = !readOnlyFlag && mayWriteUserTree({ ephemeral, explicitInstall });
  const locus = selfKey();
  const report = { host: ephemeral ? 'ephemeral' : 'laptop', locus, signals: detected.signals, writes: write, steps: [] };

  for (const step of planSteps({ ephemeral })) {
    if (step.skip) { report.steps.push({ id: step.id, status: 'skipped', detail: step.skip }); continue; }
    if (step.info) { report.steps.push({ id: step.id, status: 'info', detail: step.info }); continue; }
    if (step.gitDir) {
      const dryRun = has('--dry-run');
      const before = dryRun ? null : readSettings();
      const decision = gitDirStatus({ gitDir: step.gitDir, settings: before, write, dryRun });
      if (decision.grant) writeSettings(withPrimaryGitDir(before, step.gitDir, knownGitDirs()));
      report.steps.push({ id: step.id, status: decision.status, detail: decision.detail });
      continue;
    }
    if (step.id === 'skills' || step.id === 'commands') {
      const cli = step.cli ?? 'sync-skills-deploy.mjs';
      const script = skillsDeployScript(REPO_ROOT, existsSync, cli);
      if (!script) {
        report.steps.push({ id: step.id, status: 'skipped', detail: `no ${cli} in this checkout — that source of truth is not here` });
        continue;
      }
      if (has('--dry-run')) { report.steps.push({ id: step.id, status: 'planned', detail: `${step.title} via ${script}` }); continue; }
      const r = runSkills(script, step.argv, { write });
      report.steps.push({ id: step.id, status: r.ok ? 'ok' : 'drift', detail: r.out });
      continue;
    }
    const v = step.verify();
    const ok = step.id === 'memory' ? Boolean(v) : v.every((s) => s.present);
    report.steps.push({ id: step.id, status: ok ? 'ok' : step.id === 'siblings' ? 'missing' : 'drift', detail: v });
  }

  // The user-level SessionStart registration is the most invasive thing here — it makes this script run in
  // repos that never asked for it — so it is the one effect that NEVER happens implicitly on a durable host.
  if (write) report.hook = installHook();

  if (has('--json')) {
    writeLineSync(1, JSON.stringify(report, null, 2));
  } else {
    writeLineSync(1, `bootstrap-session — host: ${report.host}${report.signals.length ? ` (${report.signals.join(', ')})` : ''} · locus: ${report.locus ?? 'UNKNOWN checkout — siblings listed in full'}`);
    for (const s of report.steps) writeLineSync(1, `  ${s.status.padEnd(8)} ${s.id.padEnd(9)} ${describe(s)}`);
    if (report.hook) writeLineSync(1, `  hook     SessionStart ${report.hook}`);
    if (!write && !readOnlyFlag) {
      writeLineSync(1, '  — reported only. This host is durable, so nothing under $HOME/.claude was touched;');
      writeLineSync(1, '    run `npm run bootstrap install` to apply, `… uninstall` to undo.');
    }
  }

  return has('--check') && report.steps.some((s) => s.status === 'drift') ? 1 : 0;
}

// `process.exitCode =`, not `process.exit()` — #3061's exit-wraps-call shape discards the callee's flush.
if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
