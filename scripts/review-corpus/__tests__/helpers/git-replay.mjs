/**
 * @file git-replay.mjs — a recorded `git` for the review-corpus GOLDEN (#1571 CI heal).
 *
 * WHY THIS EXISTS, stated as the failure it closes. The golden re-mines committed comment bodies and demands
 * the cases come back byte-for-byte. `mine-review-corpus.mjs` reaches for real git while it does that: it
 * asks `cat-file -e` whether each verdict's `base`/`head` is reachable, `diff --name-only` what changed
 * between them, and `show -s --format=%cI` when the newest case was committed. In a full checkout every one
 * of those is answerable, so the golden passed. CI checks this repo out at `fetch-depth: 1` — ONE commit —
 * and there every `cat-file -e` misses, every verdict is dropped as unreachable, and the miner writes ZERO
 * cases. The golden was not testing the miner, it was testing the checkout's depth.
 *
 * The mining under test is a PARSE: comment bodies in, case JSON out. Git is an input to it, not the thing
 * being checked (`pathUnchangedBetween`'s own behaviour is pinned separately, against a real two-commit
 * repo). So this module supplies that input from a recording instead of from the ambient checkout — the
 * same move `--comments-dir` already makes for the GitHub reads, one layer down.
 *
 * HOW IT WORKS. `withGitReplay()` writes a directory holding an executable named `git` and puts it FIRST on
 * `PATH` for the miner's child process. Every `git` the miner runs lands here and is answered from
 * `fixtures/git-replay.json`. Nothing is stubbed inside the module under test, so a miner that starts
 * asking git a NEW question does not get a quietly plausible answer — it gets a miss.
 *
 * A MISS EXITS 128, exactly as git does on an unknown revision, because every caller in the miner treats a
 * non-zero exit as "no" (unreachable / nothing changed / no date). Fail-closed is the behaviour the miner
 * already relies on, and re-using it means an unrecorded question shrinks the corpus and reddens the
 * golden's byte-comparison rather than passing on an invented answer.
 *
 * ── REGENERATING THE RECORDING ──────────────────────────────────────────────────────────────────────────
 * Run in a FULL checkout (the recording can only be as complete as the history it is taken from):
 *
 *   node scripts/review-corpus/__tests__/helpers/git-replay.mjs --record
 *
 * That runs the miner over `fixtures/comments/` with this shim in record mode — real git answers, every
 * question and answer written back to `fixtures/git-replay.json`.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = join(HERE, 'git-replay.mjs');

/** The recording. One key per `git <args>` the miner asks, in argv order, joined by single spaces. */
export const RECORDING = resolve(HERE, '..', 'fixtures', 'git-replay.json');

/** The value recorded for a question real git answered with a non-zero exit. */
const FAILED = null;

/**
 * Build a scratch directory whose `git` is this shim, and return the env that puts it first on `PATH`.
 * The caller must `cleanup()` — a leftover directory named `git` on someone's PATH is not merely litter.
 *
 * `calls()` returns every question the shim actually fielded. A test asserts it is non-empty, because
 * BOTH paths pass in a full checkout: if the `PATH` override ever stopped taking effect the miner would
 * quietly go back to ambient git, the golden would still be green here, and CI would still be red.
 *
 * @param {{record?: boolean}} [opts] record: pass questions through to real git and capture the answers.
 * @returns {{dir: string, env: object, calls: () => string[], cleanup: () => void}}
 */
export function withGitReplay({ record = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'we-git-replay-'));
  // The real git, resolved ONCE and before the shim exists, so record mode cannot recurse into itself.
  const realGit = execFileSync('command', ['-v', 'git'], { shell: true, encoding: 'utf8' }).trim();
  const shim = join(dir, 'git');
  const log = join(dir, 'calls.log');
  writeFileSync(shim, `#!/bin/sh\nexec node ${JSON.stringify(SELF)} --shim "$@"\n`);
  chmodSync(shim, 0o755);
  return {
    dir,
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      WE_GIT_REPLAY_FILE: RECORDING,
      WE_GIT_REPLAY_REAL: realGit,
      WE_GIT_REPLAY_LOG: log,
      ...(record ? { WE_GIT_REPLAY_RECORD: '1' } : {}),
    },
    calls: () => { try { return readFileSync(log, 'utf8').split('\n').filter(Boolean); } catch { return []; } },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Read the recording, or an empty one. */
function load() {
  try { return JSON.parse(readFileSync(RECORDING, 'utf8')); } catch { return { answers: {} }; }
}

/** The shim's own entry point — invoked as `git <args>` through the generated launcher. */
function shimMain(args) {
  const key = args.join(' ');
  if (process.env.WE_GIT_REPLAY_LOG) appendFileSync(process.env.WE_GIT_REPLAY_LOG, `${key}\n`);
  if (process.env.WE_GIT_REPLAY_RECORD) {
    let answer = FAILED;
    let status = 1;
    try {
      answer = execFileSync(process.env.WE_GIT_REPLAY_REAL, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
      status = 0;
    } catch { /* recorded as FAILED below — git's own non-zero exit is part of the answer */ }
    const rec = load();
    rec.answers[key] = answer;
    writeRecording(rec);
    if (status === 0) process.stdout.write(answer);
    process.exit(status);
  }
  const { answers } = load();
  if (!(key in answers) || answers[key] === FAILED) {
    process.stderr.write(`git-replay: no recorded answer for \`git ${key}\`\n`);
    process.exit(128);
  }
  process.stdout.write(answers[key]);
  process.exit(0);
}

/** Write the recording with sorted keys, so a re-record produces a reviewable diff rather than a reshuffle. */
function writeRecording(rec) {
  const answers = Object.fromEntries(Object.keys(rec.answers).sort().map((k) => [k, rec.answers[k]]));
  mkdirSync(dirname(RECORDING), { recursive: true });
  writeFileSync(RECORDING, `${JSON.stringify({
    _: 'Recorded answers to the `git` questions `mine-review-corpus.mjs` asks while mining `fixtures/comments/`. Regenerate in a FULL checkout with `node scripts/review-corpus/__tests__/helpers/git-replay.mjs --record`. A key absent here, or recorded null, exits 128 — the miner reads that as unreachable/unchanged, exactly as it reads a real git failure.',
    answers,
  }, null, 2)}\n`);
}

/** `--record`: re-mine the committed fixtures against real git and capture every question it asks. */
function recordMain() {
  const corpus = resolve(HERE, '..', '..');
  const root = resolve(corpus, '..', '..');
  const { env, cleanup } = withGitReplay({ record: true });
  writeRecording({ answers: {} });
  const out = mkdtempSync(join(tmpdir(), 'we-git-replay-out-'));
  try {
    execFileSync('node', [
      join(corpus, 'mine-review-corpus.mjs'),
      `--comments-dir=${join(corpus, '__tests__', 'fixtures', 'comments')}`,
      `--out=${out}`,
    ], { cwd: root, env, encoding: 'utf8', stdio: 'inherit' });
  } finally {
    rmSync(out, { recursive: true, force: true });
    cleanup();
  }
  process.stdout.write(`recorded ${Object.keys(load().answers).length} git answers → ${RECORDING}\n`);
}

if (process.argv[2] === '--shim') shimMain(process.argv.slice(3));
else if (process.argv[2] === '--record') recordMain();
