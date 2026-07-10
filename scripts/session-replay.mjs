#!/usr/bin/env node
/**
 * @file scripts/session-replay.mjs
 * @description #2272 — Tier-B session-replay harness. `open` allocates an ephemeral throwaway-clone
 * substrate (#2274's ratified pattern, via scripts/lib/replay-substrate.mjs) seeded from a golden-corpus
 * fixture (#2270), and prints instructions for a LIVE session to drive one judgment skill for real
 * inside it. `check` then asserts that skill's Tier-B invariants (#2271's invariant-catalogue.json)
 * against the resulting tree. `close` discards the worktree. Session-run, not CI: the skill itself is
 * LLM-judgment-driven and has no deterministic output — this harness only makes the isolation and the
 * invariant assertion mechanical; it does not (and cannot) drive the skill itself.
 *
 * v1 scope (split candidate, size 8, per the story digest): one skill end-to-end — `batch`
 * (batch-backlog-items) — wired first. `--skill` is already parameterized so a follow-on can add
 * fixture-seeding for drain/finish/next-backlog-item/review-program without reshaping the CLI.
 *
 * Usage:
 *   node scripts/session-replay.mjs open --skill=batch
 *   # ... in a FRESH session, cd into the printed work dir and drive the skill for real ...
 *   node scripts/session-replay.mjs check --dir=<work dir printed by open>
 *   node scripts/session-replay.mjs close --dir=<work dir>
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createReplaySubstrate } from './lib/replay-substrate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_NAME = '.replay-session.json';
// Follow-on generalizes this list — see the v1-scope note above.
const SUPPORTED_SKILLS = ['batch'];

function flag(argv, name, fallback) {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf('=');
  return eq === -1 ? true : hit.slice(eq + 1);
}

function loadCatalogue() {
  return JSON.parse(readFileSync(join(ROOT, 'scripts/lib/invariant-catalogue.json'), 'utf8'));
}

function tierBInvariantsFor(skill, catalogue) {
  // subject text is free-form prose (e.g. "batch / drain / finish / ..."); match on the skill token.
  return catalogue.invariants.filter((inv) => inv.tier === 'B' && inv.subject.toLowerCase().includes(skill));
}

/** Seeds one #2270 golden-corpus `backlog-claim` fixture as a small, agent-ready item for the
 * replayed batch run to actually claim/resolve — never the miner's own project files. */
function seedBatchFixture(workDir) {
  const corpusDir = join(ROOT, 'scripts/golden-corpus/backlog-claim');
  const names = readdirSync(corpusDir).filter((f) => f.endsWith('.json')).sort();
  if (names.length === 0) throw new Error('golden corpus backlog-claim category is empty — run npm run mine:corpus first');
  const fixture = JSON.parse(readFileSync(join(corpusDir, names[0]), 'utf8'));
  const destRel = fixture.file.replace(/^backlog\//, 'backlog/replay-');
  mkdirSync(join(workDir, dirname(destRel)), { recursive: true });
  writeFileSync(join(workDir, destRel), fixture.before);
  return { fixtureId: names[0], seededFile: destRel };
}

function cmdOpen(argv) {
  const skill = flag(argv, 'skill', 'batch');
  if (!SUPPORTED_SKILLS.includes(skill)) {
    throw new Error(
      `--skill=${skill} is not wired yet (v1 ships ${SUPPORTED_SKILLS.join(', ')} only — the #2272 follow-on generalizes the rest)`,
    );
  }
  const substrate = createReplaySubstrate({ prefix: `session-replay-${skill}-` });
  const seeded = seedBatchFixture(substrate.workDir);
  substrate.git(['add', '-A']);
  substrate.git(['commit', '--quiet', '-m', `seed: ${skill} replay fixture (${seeded.fixtureId})`]);
  substrate.git(['push', '--quiet', 'origin', 'main']);
  const mainShaAtOpen = substrate.git(['rev-parse', 'origin/main']);

  const catalogue = loadCatalogue();
  const invariantIds = tierBInvariantsFor(skill, catalogue).map((inv) => inv.id);
  const manifest = {
    schemaVersion: 1,
    skill,
    fixtureId: seeded.fixtureId,
    seededFile: seeded.seededFile,
    originDir: substrate.originDir,
    mainShaAtOpen,
    invariantIds,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    itemsProcessed: null,
  };
  writeFileSync(join(substrate.workDir, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Ephemeral replay substrate ready for skill "${skill}":`);
  console.log(`  work dir:   ${substrate.workDir}`);
  console.log(`  origin dir: ${substrate.originDir}`);
  console.log(`  seeded fixture: ${seeded.seededFile} (from golden corpus ${seeded.fixtureId})`);
  console.log('');
  console.log('Next: in a FRESH session, cd into the work dir above and drive the skill for real against');
  console.log('this ephemeral repo (treat the origin dir as its "origin" — never the real project remote).');
  console.log(`When the run terminates, stamp ${MANIFEST_NAME} with stoppedAt + itemsProcessed, then run:`);
  console.log(`  node scripts/session-replay.mjs check --dir=${substrate.workDir}`);
  return substrate.workDir;
}

function cmdCheck(argv) {
  const dir = flag(argv, 'dir');
  if (!dir) throw new Error('check requires --dir=<work dir printed by open>');
  const manifestPath = join(dir, MANIFEST_NAME);
  if (!existsSync(manifestPath)) throw new Error(`no ${MANIFEST_NAME} in ${dir} — was this dir opened by "open"?`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const results = [];
  const record = (id, pass, detail) => results.push({ id, pass, detail });

  // tier-b.lane-isolation-never-primary-checkout — disposable-by-construction: WHITELIST the OS tmp
  // root rather than blacklist "real" checkout roots — mkdtemp always resolves under tmpdir(), and a
  // blacklist derived from where THIS CLI happens to run (e.g. `dirname(ROOT) + '.lanes'`) computes the
  // wrong path when the harness itself is invoked from inside a lane clone (its normal invocation
  // context), silently defeating the check. Whitelisting is correct regardless of invocation location.
  const tmpRoot = resolve(tmpdir());
  const resolvedDir = resolve(dir);
  const isolated = resolvedDir === tmpRoot || resolvedDir.startsWith(tmpRoot + sep);
  record(
    'tier-b.lane-isolation-never-primary-checkout',
    isolated,
    isolated
      ? 'work dir lives under the OS tmp root — a throwaway mkdtemp clone, never a real checkout'
      : `work dir ${dir} is NOT under the OS tmp root (${tmpRoot}) — not a disposable substrate`,
  );

  // tier-b.producer-never-merges-never-pushes-main — the fabricated origin's main ref must be
  // UNCHANGED from when the fixture was seeded; a real skill run lands via a lane/* ref, never a
  // direct push/merge to main.
  let mainShaNow = null;
  try {
    execFileSync('git', ['fetch', '--quiet', 'origin'], { cwd: dir });
    mainShaNow = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: dir, encoding: 'utf8' }).trim();
  } catch {
    /* origin unreachable — treated as a failed check below */
  }
  const mainUntouched = mainShaNow === manifest.mainShaAtOpen;
  record(
    'tier-b.producer-never-merges-never-pushes-main',
    mainUntouched,
    mainUntouched
      ? 'origin/main unchanged since fixture seed'
      : `origin/main moved (${manifest.mainShaAtOpen} -> ${mainShaNow}) — a direct push/merge to main was observed`,
  );

  if (manifest.skill === 'batch') {
    const stopped = Boolean(manifest.stoppedAt) && typeof manifest.itemsProcessed === 'number';
    record(
      'tier-b.batch-hard-stop-guarantees-termination',
      stopped,
      stopped
        ? `session self-reported termination at ${manifest.stoppedAt} after ${manifest.itemsProcessed} item(s)`
        : 'manifest missing stoppedAt/itemsProcessed — the session never stamped a terminal marker (self-reported evidence; not independently provable from the tree alone)',
    );
  }

  const failed = results.filter((r) => !r.pass);
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id} — ${r.detail}`);
  if (failed.length > 0) {
    console.error(`\n${failed.length}/${results.length} Tier-B invariant(s) FAILED for skill "${manifest.skill}"`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${results.length} Tier-B invariant(s) held for skill "${manifest.skill}"`);
  }
  return results;
}

function cmdClose(argv) {
  const dir = flag(argv, 'dir');
  if (!dir) throw new Error('close requires --dir=<work dir printed by open>');
  const resolvedDir = resolve(dir);
  const base = dirname(resolvedDir); // work dir's parent is the mkdtemp base holding origin.git + work
  // SAFETY: this is a recursive delete of `base` — before running it, verify `dir` actually looks like
  // a harness-created work dir (under the OS tmp root, named "work", with a sibling origin.git), so a
  // typo'd/hallucinated --dir (e.g. one path segment short, pointing at a real checkout) refuses loudly
  // instead of rmSync-ing an arbitrary directory.
  const tmpRoot = resolve(tmpdir());
  const looksLikeSubstrate =
    (base === tmpRoot || base.startsWith(tmpRoot + sep)) &&
    resolvedDir.endsWith(`${sep}work`) &&
    existsSync(join(base, 'origin.git'));
  if (!looksLikeSubstrate) {
    throw new Error(
      `refusing to delete ${base} — ${resolvedDir} does not look like a session-replay work dir (expected <tmpdir>/.../work with a sibling origin.git). Pass the exact work dir printed by "open".`,
    );
  }
  rmSync(base, { recursive: true, force: true });
  console.log(`Discarded ephemeral replay substrate at ${base}`);
}

const [, , cmd, ...rest] = process.argv;
try {
  if (cmd === 'open') cmdOpen(rest);
  else if (cmd === 'check') cmdCheck(rest);
  else if (cmd === 'close') cmdClose(rest);
  else {
    console.error('Usage: node scripts/session-replay.mjs <open|check|close> [--skill=batch] [--dir=<work dir>]');
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`session-replay: ${err.message}`);
  process.exitCode = 1;
}
