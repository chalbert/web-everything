#!/usr/bin/env node
/**
 * check-visual-baseline-update.mjs — gate that blocks bare snapshot commits (#2179).
 *
 * PROBLEM: `npm run check:visual:update` blindly rewrites committed PNG baselines. An agent
 * (or human) can accept a visually-broken page with a single command, no review. The hookable-
 * vs-judgment gap (#51) left this as judgment: "look at the diff before committing." That is not
 * enforced and has already caused undetected regressions (#1895).
 *
 * GATE: when snapshot PNG files (in `*-snapshots/`) are staged for commit, each changed file MUST
 * have a corresponding AI verdict (a JSON file in `tests/visual/verdicts/`) that:
 *   1. declares the snapshot filename it covers,
 *   2. contains an explicit `"verdict": "approved"` field, and
 *   3. was written AFTER the snapshot (mtime guard — no stale verdicts).
 *
 * WORKFLOW (enforced path):
 *   1. Run `npm run check:visual` → it fails + writes diffs to `tests/visual/review/`.
 *   2. Run `node scripts/dev/visual-baseline-review.mjs` → opens the before/after + prompts the AI.
 *   3. The AI writes / approves a verdict file in `tests/visual/verdicts/`.
 *   4. Run `npm run check:visual:update` to accept the baseline.
 *   5. Stage both the updated PNG(s) AND the verdict file(s) → `git commit` now passes this gate.
 *
 * BYPASS: explicitly not possible via a flag — if you need to force-commit a snapshot without an
 * AI review, that is a conscious decision that should surface in the PR diff as a missing verdict.
 *
 * Usage:
 *   node scripts/check-visual-baseline-update.mjs [--staged]   # check staged snapshots (pre-commit)
 *   node scripts/check-visual-baseline-update.mjs [--all]      # check ALL committed snapshots
 *
 * Exit codes: 0 = clean; 1 = usage error; 2 = gate failure (blocks commit).
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERDICTS_DIR = join(ROOT, 'tests/visual/verdicts');
const SNAPSHOTS_GLOB_PATTERN = '-snapshots';

const args = process.argv.slice(2);
const allMode = args.includes('--all');
const staged = !allMode; // default (no args or --staged) = staged mode; --all = whole-repo audit

// ---------------------------------------------------------------------------
// 1. Collect the snapshot files to check
// ---------------------------------------------------------------------------

/** Returns all staged files that look like visual snapshot PNGs. */
function getStagedSnapshots() {
  let output;
  try {
    output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch {
    return [];
  }
  return output
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => f && f.includes(SNAPSHOTS_GLOB_PATTERN) && f.endsWith('.png'));
}

/** Returns all committed snapshot PNGs in the repo (--all mode). */
function getAllSnapshots() {
  const result = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.png') && dir.includes(SNAPSHOTS_GLOB_PATTERN)) {
        result.push(relative(ROOT, full));
      }
    }
  }
  walk(join(ROOT, 'tests'));
  return result;
}

const snapshotFiles = allMode ? getAllSnapshots() : getStagedSnapshots();

if (snapshotFiles.length === 0) {
  // Nothing to check — no snapshot change in this commit.
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2. Load available verdicts
// ---------------------------------------------------------------------------

/** Loads all verdict JSON files from the verdicts directory. */
function loadVerdicts() {
  if (!existsSync(VERDICTS_DIR)) return [];
  return readdirSync(VERDICTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const full = join(VERDICTS_DIR, f);
      try {
        const data = JSON.parse(readFileSync(full, 'utf8'));
        // Stat fields come LAST so a JSON field named "mtime"/"file"/"path" cannot spoof them.
        return { ...data, file: f, path: full, mtime: statSync(full).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const verdicts = loadVerdicts();

// ---------------------------------------------------------------------------
// 3. Check each snapshot against the verdict index
// ---------------------------------------------------------------------------

const failures = [];

for (const snapshotPath of snapshotFiles) {
  const snapshotName = basename(snapshotPath); // e.g. home-chromium-linux.png

  // Find a matching verdict: snapshot field must match the filename, verdict must be "approved".
  const matching = verdicts.filter(
    (v) => v.snapshot === snapshotName && v.verdict === 'approved'
  );

  if (matching.length === 0) {
    failures.push({
      snapshot: snapshotPath,
      reason: `No approved AI verdict found for "${snapshotName}". Run: node scripts/dev/visual-baseline-review.mjs`,
    });
    continue;
  }

  // Mtime guard: in --staged mode, compare verdict mtime vs snapshot mtime on disk.
  // (In --all mode we skip the mtime check since the snapshot mtime is the commit time.)
  if (staged && !allMode) {
    const snapshotFull = join(ROOT, snapshotPath);
    if (existsSync(snapshotFull)) {
      const snapshotMtime = statSync(snapshotFull).mtimeMs;
      const hasRecent = matching.some((v) => v.mtime >= snapshotMtime - 60_000); // 60s grace
      if (!hasRecent) {
        failures.push({
          snapshot: snapshotPath,
          reason: `Verdict for "${snapshotName}" predates the snapshot (stale). Re-review with: node scripts/dev/visual-baseline-review.mjs`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Report
// ---------------------------------------------------------------------------

if (failures.length === 0) {
  console.log(`✓ visual baseline gate: all ${snapshotFiles.length} staged snapshot(s) have an approved AI verdict.`);
  process.exit(0);
}

console.error(`\n✖ visual baseline gate — ${failures.length} snapshot(s) staged without an approved AI verdict:\n`);
for (const f of failures) {
  console.error(`  • ${f.snapshot}`);
  console.error(`    ${f.reason}`);
}
console.error(`
ENFORCEMENT (#2179): a bare snapshot update is not allowed without an explicit AI verdict.

WORKFLOW:
  1. npm run check:visual              ← see what changed (diffs written to tests/visual/review/)
  2. node scripts/dev/visual-baseline-review.mjs
                                       ← AI reviews before/after and writes tests/visual/verdicts/<name>.json
  3. npm run check:visual:update       ← accept the baseline
  4. git add tests/visual/verdicts/<name>.json <updated-snapshots>
  5. git commit                        ← now passes this gate

If the visual change is intentional, the verdict file IS the paper trail. It rides the PR.
`);
process.exit(2);
