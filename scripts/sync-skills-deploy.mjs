#!/usr/bin/env node
/**
 * sync-skills-deploy.mjs — #2579.
 *
 * The bug this closes: a fix under `we:skills-src/<skill>/` (the skills SoT, #2265/#2266) lands on `main`
 * but does NOT take effect anywhere the agent reads skills from the user's machine-global
 * `~/.claude/skills/` tree — that copy is a plain, one-time hand-copy, not a symlink and not kept in sync.
 * (This repo's OWN `we:.claude/skills` is already a symlink to `skills-src/`, so it never drifts — only the
 * cross-repo home deploy needs a sync mechanism.) Concretely: this session's
 * `skills-src/closing-session/session-cost.mjs` rate fix merged to `main` but `~/.claude/skills/closing-session`
 * kept serving the old 3x-inflated numbers until it was caught and hand-synced at close.
 *
 * WHAT IT DEPLOYS: by default, only skill dirs that are ALREADY present under the deploy root (so this
 * script never silently makes a WE-repo-specific orchestration skill — batch-backlog-items, drain, jury,
 * pr, … — globally available in an unrelated repo; those stay project-local via the `.claude/skills`
 * symlink). Pass --all to deploy every skills-src/* entry (bootstrapping a new machine, or deliberately
 * promoting a skill to global), or --only=name1,name2 to scope to specific skills.
 *
 * WHAT IT COPIES: per skill, only the files `git` tracks under `skills-src/<skill>/` — never a gitignored
 * runtime/local-state file (batch-backlog-items' claims.json/reservations.json/capacity.json are per-repo
 * orchestrator state, not part of the portable skill definition, and must never leave this repo). Tracked
 * files are mirrored — added, updated, AND removed at the deploy target — so a renamed/deleted source file
 * doesn't leave a stale copy behind (the same class of drift this item exists to close).
 *
 * Usage:
 *   node scripts/sync-skills-deploy.mjs                  # sync every skill already deployed at ~/.claude/skills
 *   node scripts/sync-skills-deploy.mjs --all             # also deploy skills-src entries not yet present there
 *   node scripts/sync-skills-deploy.mjs --only=closing-session,drain
 *   node scripts/sync-skills-deploy.mjs --check           # report drift only, write nothing; exit 1 if any found
 *   node scripts/sync-skills-deploy.mjs --dry-run         # print planned actions, write nothing; exit 0
 *   node scripts/sync-skills-deploy.mjs --json            # machine-readable summary on stdout
 *
 * WE_SKILLS_DEPLOY_DIR overrides the deploy root (tests / a non-default machine layout).
 *
 * Wired: `npm run skills:sync` / `npm run skills:sync:check` (package.json), and auto-invoked by
 * `.githooks/post-merge` whenever a merge touches `skills-src/` — so a landed skill fix is live without a
 * manual hand-sync.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..');
export const SRC_ROOT = path.join(REPO_ROOT, 'skills-src');

export function deployRoot(env = process.env) {
  return env.WE_SKILLS_DEPLOY_DIR
    ? path.resolve(env.WE_SKILLS_DEPLOY_DIR)
    : path.join(os.homedir(), '.claude', 'skills');
}

export function parseArgs(argv) {
  const args = { all: false, check: false, dryRun: false, json: false, only: null };
  for (const raw of argv) {
    if (raw === '--all') args.all = true;
    else if (raw === '--check') args.check = true;
    else if (raw === '--dry-run') args.dryRun = true;
    else if (raw === '--json') args.json = true;
    else if (raw.startsWith('--only=')) {
      args.only = raw.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean);
    } else throw new Error(`sync-skills-deploy: unrecognised arg "${raw}"`);
  }
  return args;
}

/** Every file under `dir`, recursively, as paths relative to `dir` (posix-joined). Empty array if `dir` is absent. */
export function listFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (rel) => {
    const abs = rel ? path.join(dir, rel) : dir;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) walk(childRel);
      else if (entry.isFile()) out.push(childRel);
    }
  };
  walk('');
  return out;
}

/** The files `git` tracks under `srcDir`, as paths relative to `srcDir`. */
export function gitTrackedFiles(srcDir, repoRoot = REPO_ROOT) {
  const relToRepo = path.relative(repoRoot, srcDir);
  const out = execFileSync('git', ['ls-files', '--', relToRepo], { cwd: repoRoot, encoding: 'utf8' });
  return out.split('\n').filter(Boolean).map((p) => path.relative(relToRepo, p));
}

/**
 * Pure diff: given the set of tracked-relative-paths for a skill and its src/dest dirs on disk, return the
 * add/update/remove actions that bring dest into sync with src. No git call here (testable with plain tmp dirs).
 */
export function planSkill({ name, srcDir, destDir, trackedRel }) {
  const trackedSet = new Set(trackedRel);
  const destExisting = listFilesRecursive(destDir);
  const actions = [];
  for (const rel of trackedRel) {
    const srcFile = path.join(srcDir, rel);
    const destFile = path.join(destDir, rel);
    const srcBuf = fs.readFileSync(srcFile);
    const existed = fs.existsSync(destFile);
    const same = existed && srcBuf.equals(fs.readFileSync(destFile));
    if (!same) actions.push({ type: existed ? 'update' : 'add', rel });
  }
  for (const rel of destExisting) {
    if (!trackedSet.has(rel)) actions.push({ type: 'remove', rel });
  }
  return { name, srcDir, destDir, actions, alreadyDeployed: fs.existsSync(destDir) };
}

/** Apply a plan's actions to disk (add/update copy from src, remove deletes from dest). */
export function applyPlan(plan) {
  for (const action of plan.actions) {
    const destFile = path.join(plan.destDir, action.rel);
    if (action.type === 'remove') {
      fs.rmSync(destFile, { force: true });
    } else {
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(path.join(plan.srcDir, action.rel), destFile);
    }
  }
}

export function listSkillNames(srcRoot = SRC_ROOT) {
  if (!fs.existsSync(srcRoot)) return [];
  return fs.readdirSync(srcRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/** Build the full set of per-skill plans for a run. Pulls `git ls-files` per skill (the only I/O git call). */
export function buildPlans({ srcRoot = SRC_ROOT, destRoot, only = null, all = false, repoRoot = REPO_ROOT } = {}) {
  const allNames = listSkillNames(srcRoot);
  if (only) {
    const unknown = only.filter((n) => !allNames.includes(n));
    if (unknown.length) throw new Error(`sync-skills-deploy: unknown skill(s): ${unknown.join(', ')}`);
  }
  const names = only ?? allNames;
  const plans = [];
  for (const name of names) {
    const srcDir = path.join(srcRoot, name);
    const destDir = path.join(destRoot, name);
    if (!only && !all && !fs.existsSync(destDir)) continue; // default: keep already-deployed skills in sync only
    const trackedRel = gitTrackedFiles(srcDir, repoRoot);
    plans.push(planSkill({ name, srcDir, destDir, trackedRel }));
  }
  return plans;
}

function formatPlans(plans, { checkOnly, dryRun }) {
  const drifted = plans.filter((p) => p.actions.length > 0);
  const lines = [];
  if (drifted.length === 0) {
    lines.push(`✓ in sync — ${plans.length} skill(s) checked, no drift`);
  } else {
    const verb = checkOnly ? 'DRIFT' : dryRun ? 'WOULD SYNC' : 'SYNCED';
    for (const plan of drifted) {
      const counts = { add: 0, update: 0, remove: 0 };
      for (const a of plan.actions) counts[a.type] += 1;
      const parts = [];
      if (counts.add) parts.push(`+${counts.add}`);
      if (counts.update) parts.push(`~${counts.update}`);
      if (counts.remove) parts.push(`-${counts.remove}`);
      lines.push(`${verb} ${plan.name}: ${parts.join(' ')} (${plan.destDir})`);
    }
    lines.push(`${drifted.length}/${plans.length} skill(s) drifted`);
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const destRoot = deployRoot();
  if (!fs.existsSync(SRC_ROOT)) throw new Error(`sync-skills-deploy: missing skills-src at ${SRC_ROOT}`);

  const plans = buildPlans({ destRoot, only: args.only, all: args.all });
  const drifted = plans.filter((p) => p.actions.length > 0);

  if (!args.check && !args.dryRun) {
    for (const plan of drifted) applyPlan(plan);
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({
      ok: args.check ? drifted.length === 0 : true,
      checked: plans.length,
      drifted: drifted.length,
      applied: !args.check && !args.dryRun,
      skills: plans.map((p) => ({ name: p.name, actions: p.actions, alreadyDeployed: p.alreadyDeployed })),
    }, null, 2) + '\n');
  } else {
    process.stdout.write(formatPlans(plans, { checkOnly: args.check, dryRun: args.dryRun }) + '\n');
  }

  if (args.check && drifted.length > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    const message = /^sync-skills-deploy:/.test(err.message) ? err.message : `sync-skills-deploy: ${err.message}`;
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
