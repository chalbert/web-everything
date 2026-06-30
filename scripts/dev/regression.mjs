#!/usr/bin/env node
/**
 * regression.mjs — the single end-of-change regression sweep (#1966 follow-up; the aggregate the
 * scattered `verify` + `check:standards` + `test:*` lanes never had).
 *
 * Runs every regression lane in sequence, CONTINUES past a red one (so one failure doesn't hide the
 * rest — unlike a `&&` chain), and prints a pass/fail summary at the end. Exits non-zero iff any lane
 * failed. The live-render lanes (a11y/smoke/content/visual/interaction) reuse the already-running dev
 * server via playwright.config.ts `webServer` (REUSE, never kill — and it boots one only if none is up).
 *
 * This is the BEFORE-DONE sweep, not the after-every-edit loop: it's ~1–2 min with the Playwright lanes.
 * For the inner loop, run only the lane that matches what you changed (CSS/template → `check:visual`,
 * logic → `test:unit`, backlog/standards data → `check:standards`). See the memory rule
 * "ai-runs-regression-after-each-change".
 *
 *   node scripts/dev/regression.mjs            # all lanes
 *   node scripts/dev/regression.mjs --no-e2e   # skip the Playwright lanes (fast: unit + standards only)
 */
import { spawnSync } from 'node:child_process';

const noE2e = process.argv.includes('--no-e2e');

// Each lane: a label + the argv to spawn. Order cheapest-first so a fast red surfaces early (but we run
// them all regardless). The Playwright lane runs every project (a11y, content, smoke, visual, interaction,
// block e2e) in one browser-launch — finer per-lane splits aren't worth the extra cold starts here.
const LANES = [
  { label: 'unit (vitest)', cmd: ['npx', ['vitest', 'run']] },
  { label: 'standards (check:standards)', cmd: ['node', ['scripts/check-standards.mjs']] },
  ...(noE2e ? [] : [{ label: 'rendered + interaction (playwright)', cmd: ['npx', ['playwright', 'test']] }]),
];

const results = [];
for (const lane of LANES) {
  process.stdout.write(`\n\x1b[36m▶ ${lane.label}\x1b[0m\n`);
  const started = Date.now();
  const r = spawnSync(lane.cmd[0], lane.cmd[1], { stdio: 'inherit', encoding: 'utf8' });
  results.push({ label: lane.label, ok: r.status === 0, ms: Date.now() - started });
}

const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
process.stdout.write(`\n\x1b[1m═══ regression summary ═══\x1b[0m\n`);
for (const r of results) {
  const mark = r.ok ? '\x1b[32m✓ pass\x1b[0m' : '\x1b[31m✗ FAIL\x1b[0m';
  process.stdout.write(`  ${mark}  ${pad(r.label, 38)} ${(r.ms / 1000).toFixed(1)}s\n`);
}
const failed = results.filter((r) => !r.ok);
process.stdout.write(
  failed.length
    ? `\n\x1b[31m${failed.length} lane(s) red: ${failed.map((r) => r.label).join(', ')}\x1b[0m\n`
    : `\n\x1b[32mall ${results.length} lanes green\x1b[0m\n`,
);
process.exit(failed.length ? 1 : 0);
