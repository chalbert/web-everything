#!/usr/bin/env node
/**
 * visual-baseline-review.mjs — AI-verdict scaffold for visual baseline updates (#2179).
 *
 * ROLE: bridges a `check:visual` failure to the `check:visual:update` baseline commit by:
 *   1. Reading the Playwright diff output from the last `check:visual` run.
 *   2. Copying the diff PNG(s), old PNG(s), and new PNG(s) to `tests/visual/review/` (a known,
 *      stable path the AI / agent can always find them at — no hunting through temp dirs).
 *   3. Printing a structured review prompt the agent pastes into the AI to get a verdict.
 *   4. Writing a scaffold verdict JSON to `tests/visual/verdicts/` — the agent fills in the
 *      `"verdict"` field ("approved" | "rejected") and `"notes"` after reviewing.
 *
 * The gate (`check-visual-baseline-update.mjs`, called by the pre-commit hook) BLOCKS a bare
 * snapshot commit until step 4 is complete (verdict file present + verdict = "approved").
 *
 * Usage:
 *   node scripts/dev/visual-baseline-review.mjs [--snapshot=<name>]
 *
 *   --snapshot=<name>   only scaffold this specific snapshot (e.g. home-chromium-darwin.png).
 *                       Defaults to ALL snapshots that currently have a diff on disk.
 */

import { writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOTS_DIR = join(ROOT, 'tests/visual/rendered-site-visual.spec.ts-snapshots');
const PLAYWRIGHT_REPORT_DIR = join(ROOT, 'playwright-report');
const REVIEW_DIR = join(ROOT, 'tests/visual/review');
const VERDICTS_DIR = join(ROOT, 'tests/visual/verdicts');

// Ensure output dirs exist.
mkdirSync(REVIEW_DIR, { recursive: true });
mkdirSync(VERDICTS_DIR, { recursive: true });

const args = process.argv.slice(2);
const snapshotArg = args.find((a) => a.startsWith('--snapshot='))?.slice('--snapshot='.length);

// ---------------------------------------------------------------------------
// 1. Find diffs — Playwright writes actual/diff/expected PNGs under
//    playwright-report/data/ on a failing `check:visual` run.
//    We also check the test-results/ dir which Playwright uses for --update-snapshots.
// ---------------------------------------------------------------------------

/**
 * Finds all diff artifacts Playwright wrote for the last failing visual run.
 * Returns an array of { name, diff, actual, expected } — paths may be null if not found.
 */
function findPlaywrightDiffs() {
  const candidates = [];

  // playwright-report/data/ contains <hash>-diff.png, <hash>-actual.png, <hash>-expected.png
  const dataDir = join(PLAYWRIGHT_REPORT_DIR, 'data');
  if (existsSync(dataDir)) {
    const diffs = readdirSync(dataDir).filter((f) => f.endsWith('-diff.png'));
    for (const diffFile of diffs) {
      const prefix = diffFile.replace(/-diff\.png$/, '');
      candidates.push({
        name: diffFile, // label — will be refined below
        diff: join(dataDir, diffFile),
        actual: join(dataDir, `${prefix}-actual.png`),
        expected: join(dataDir, `${prefix}-expected.png`),
      });
    }
  }

  // test-results/ dir: Playwright puts <test-name>/<snapshot>-actual.png next to the spec output.
  const testResultsDir = join(ROOT, 'test-results');
  if (existsSync(testResultsDir)) {
    for (const entry of readdirSync(testResultsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sub = join(testResultsDir, entry.name);
      for (const f of readdirSync(sub)) {
        if (f.endsWith('-actual.png')) {
          const prefix = f.replace(/-actual\.png$/, '');
          const diff = join(sub, `${prefix}-diff.png`);
          const expected = join(sub, `${prefix}-expected.png`);
          candidates.push({
            name: f,
            diff: existsSync(diff) ? diff : null,
            actual: join(sub, f),
            expected: existsSync(expected) ? expected : null,
          });
        }
      }
    }
  }

  return candidates;
}

// Also look for snapshots in the staging area (--cached = index vs HEAD, not working tree vs HEAD).
function getStagedSnapshotNames() {
  try {
    const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .filter((f) => f.includes('-snapshots') && f.endsWith('.png'))
      .map((f) => basename(f));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2. Copy artifacts + write verdict scaffold
// ---------------------------------------------------------------------------

const diffs = findPlaywrightDiffs();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

if (diffs.length === 0 && !snapshotArg) {
  console.log('No Playwright diff artifacts found in playwright-report/data/ or test-results/.');
  console.log('Run `npm run check:visual` first to generate the diff output, then re-run this script.');
  process.exit(0);
}

const toProcess = snapshotArg
  ? diffs.filter((d) => d.name.includes(snapshotArg.replace('.png', '')))
  : diffs;

// If no playwright diffs found but we have staged snapshots, scaffold from committed baselines.
const snapshots = toProcess.length > 0 ? toProcess : getStagedSnapshotNames().map((name) => ({
  name,
  diff: null,
  actual: null,
  expected: join(SNAPSHOTS_DIR, name),
}));

if (snapshots.length === 0) {
  console.log('Nothing to review. No diffs or staged snapshots found.');
  process.exit(0);
}

const verdictFiles = [];

for (const snap of snapshots) {
  const label = basename(snap.name).replace(/-actual\.png$/, '').replace(/-diff\.png$/, '');
  const slug = `${label}-${timestamp}`;

  // Copy artifacts to review/.
  const reviewFiles = {};
  for (const [key, src] of Object.entries({ diff: snap.diff, actual: snap.actual, expected: snap.expected })) {
    if (src && existsSync(src)) {
      const dest = join(REVIEW_DIR, `${slug}-${key}.png`);
      copyFileSync(src, dest);
      reviewFiles[key] = dest;
    }
  }

  // Write verdict scaffold.
  const verdictPath = join(VERDICTS_DIR, `${slug}.json`);
  const scaffold = {
    _comment: 'AI visual baseline verdict (#2179). Fill in verdict and notes after reviewing the before/after images.',
    snapshot: label.endsWith('.png') ? label : `${label}.png`,
    reviewedAt: new Date().toISOString(),
    reviewFiles,
    verdict: 'PENDING', // MUST be changed to "approved" or "rejected" by the AI reviewer
    notes: '',
    intendedChange: '', // describe WHAT changed and WHY it is expected
  };

  writeFileSync(verdictPath, JSON.stringify(scaffold, null, 2) + '\n');
  verdictFiles.push({ label, verdictPath, reviewFiles });

  console.log(`\n[${label}]`);
  if (reviewFiles.diff) console.log(`  diff:     ${reviewFiles.diff}`);
  if (reviewFiles.expected) console.log(`  before:   ${reviewFiles.expected}`);
  if (reviewFiles.actual) console.log(`  after:    ${reviewFiles.actual}`);
  console.log(`  verdict:  ${verdictPath}`);
}

// ---------------------------------------------------------------------------
// 3. Print the AI review prompt
// ---------------------------------------------------------------------------

console.log(`
====================================================================
AI VISUAL BASELINE REVIEW (#2179)
====================================================================

For each snapshot above, LOOK at the before/after images (paths printed above),
then UPDATE the verdict JSON:

  "verdict": "approved"   — the visual change IS the intended diff; baseline OK to commit.
  "verdict": "rejected"   — the visual change is NOT expected; block the update + fix the code.

Fill in:
  "intendedChange": what changed and why (e.g. "orange gradient removed — #1234 cleanup")
  "notes": anything notable about the diff (anti-aliasing, font reflow, etc.)

VERDICT FILES to update:
${verdictFiles.map((v) => `  ${v.verdictPath}`).join('\n')}

Once ALL verdicts are "approved":
  npm run check:visual:update         ← accept the baseline(s)
  git add tests/visual/verdicts/ <updated-snapshots>
  git commit                          ← the pre-commit gate now passes

====================================================================
`);
