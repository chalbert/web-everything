/**
 * @file scripts/operations/gap-sweep-status-io.mjs
 * @description THE IO SHELL of the `gap-sweep-status` declaration — the ONE shell of the existing
 *   `we:scripts/gap-sweep-status.mjs` CLI. Kept out of `gap-sweep-status.mjs` for the same reason
 *   `verify-io.mjs` is kept out of `verify.mjs`: that file's import graph is asserted free of `node:`
 *   specifiers, so every step function there provably holds no writer or subprocess in lexical scope.
 *
 * NO `--json` ON THE HOME. Unlike `verify-lane.mjs`, the CLI this wraps prints human-readable text and was
 * built and shipped before this operation existed — "no new logic" means it stays exactly that. So this file
 * classifies the CLI's OWN fixed output format rather than parsing a machine format that does not exist,
 * which is why the regexes below are anchored to the CLI's literal strings (`✓ invariants ok`,
 * `snapshot written: …`, `✓ no-op delta`) rather than to a schema.
 *
 * THE CLI HAS NO `checkout`/`repo` PARAMETER, unlike `verify-lane.mjs`. It resolves its own data directory
 * (`src/_data/`) relative to ITS OWN file location, so — unlike `verify`, which must verify an arbitrary lane
 * — this operation always reports on the repo this script lives in. `cliPath` is still overridable below, but
 * only so a test can point it at an isolated copy of the CLI + fixture data, never at a different tree's data
 * through the real one.
 *
 * IMPURE by construction: subprocess only, no direct fs.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GAP_SWEEP_STATUS_EFFECT } from './gap-sweep-status.mjs';

/** The single home. Resolved from THIS file, never from cwd. */
export const GAP_SWEEP_STATUS_CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'gap-sweep-status.mjs');

/** How long one invocation may run before the spawn is abandoned. A kill lands as `unrun`, never `ok`. */
export const GAP_SWEEP_TIMEOUT_MS = 60 * 1000;

/**
 * The argv for one invocation. PURE, and exported so a test can assert the exact command with no subprocess —
 * the same discipline `verify-io.mjs`'s `verifyArgv` applies.
 */
export function gapSweepStatusArgv({ mode, baseline = '' } = {}, { cliPath = GAP_SWEEP_STATUS_CLI } = {}) {
  const base = [cliPath];
  if (mode === 'snapshot') base.push('--snapshot');
  else if (mode === 'diff') base.push(`--baseline=${baseline}`);
  return base;
}

/** The CLI's own violation block, e.g. `✗ gap-sweep invariant violations (2):\n  - <msg>\n  - <msg>`. */
const VIOLATIONS_RE = /✗ gap-sweep invariant violations \(\d+\):\n((?:\s*-\s.*\n?)+)/;
/** `snapshot written: reports/gap-sweep-snapshots/<date>.json` — `mode: 'snapshot'` only. */
const SNAPSHOT_RE = /snapshot written: (.+)/;

/**
 * Map what the CLI printed onto the three outcomes. PURE over the spawn result.
 *
 * THE MAPPING IS POSITIVE, same discipline as `verify-io.mjs`'s `classifyVerifyResult`: `ok` is produced only
 * by a run whose stdout carries the CLI's own success marker. Everything else — a violations block, a crash,
 * output that matches neither — is handled explicitly rather than defaulted into a pass.
 */
export function classifyGapSweepResult({ mode, status, stdout = '', stderr = '', error, signal } = {}) {
  const outText = String(stdout ?? '');
  const errText = String(stderr ?? '');
  // THE CLI SPLITS ITS OUTPUT, AND EACH MARKER IS MATCHED ONLY AGAINST THE STREAM IT ACTUALLY LIVES ON.
  // `validate()`'s violation block is `console.error` (stderr) and, on that path, NOTHING else is ever
  // printed — the CLI exits before reaching any mode branch. The success marker, the status report,
  // `snapshot written:` and the diff delta are all `console.log` (stdout), and on THAT path stderr is empty.
  // Matching `VIOLATIONS_RE` against stdout too (or the success markers against stderr too) would let a
  // status/diff report's own DATA — a gap's `id` or `gapNote` field, echoed verbatim by `printStatus`/`diff`
  // — masquerade as the CLI's own error block if it ever happened to contain matching text. Concatenated only
  // for the `tail` shown in an `unrun` reason, which is diagnostic text a human reads, never re-matched.
  const tail = `${outText}${errText}`.trim().split('\n').slice(-5).join(' / ').slice(0, 400);

  if (error) return { mode, outcome: 'unrun', reason: `runner error: ${error.message}` };
  if (signal) {
    return { mode, outcome: 'unrun', reason: `killed by ${signal} — the CLI did not finish, so nothing was observed` };
  }

  // Checked FIRST and independent of exit code or mode: the CLI's own invariant gate runs before any mode
  // branch, so a violations block can appear under `status`, `snapshot`, or `diff` alike. STDERR ONLY.
  const violMatch = errText.match(VIOLATIONS_RE);
  if (violMatch) {
    const violations = violMatch[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
    return { mode, outcome: 'violations', violations, report: errText };
  }

  if (status !== 0) {
    // A non-zero exit with NO parsed violations block is a crash, not an invariant failure — the clearest
    // case is a bad `--baseline` path: `readFileSync` throws `ENOENT` and prints a Node stack trace on
    // stderr, in a format that shares nothing with the CLI's own violation report. Folding it into
    // `violations` would certify a "gap sweep failure" that was actually a usage error.
    return { mode, outcome: 'unrun', reason: `exit ${status} with no parseable violation report — ${tail || '<empty output>'}` };
  }

  if (!/✓ invariants ok/.test(outText)) {
    return { mode, outcome: 'unrun', reason: `exit 0 but no "invariants ok" marker on stdout — ${tail || '<empty output>'}` };
  }

  const out = { mode, outcome: 'ok', report: outText };
  if (mode === 'snapshot') out.snapshotPath = outText.match(SNAPSHOT_RE)?.[1]?.trim() ?? '';
  if (mode === 'diff') out.noop = /✓ no-op delta/.test(outText);
  return out;
}

/**
 * The runner the declaration is injected with. ONE spawn of the single home; `spawn` is injected so every
 * branch above is reachable with no `node` spawn.
 */
export function createGapSweepRunner({ spawn = spawnSync, cliPath = GAP_SWEEP_STATUS_CLI } = {}) {
  return ({ mode, baseline = '' }) => {
    const argv = gapSweepStatusArgv({ mode, baseline }, { cliPath });
    let r;
    try {
      r = spawn(process.execPath, argv, { encoding: 'utf8', timeout: GAP_SWEEP_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
    } catch (e) {
      r = { error: e };
    }
    return classifyGapSweepResult({
      mode, status: r?.status, stdout: r?.stdout, stderr: r?.stderr, error: r?.error, signal: r?.signal,
    });
  };
}

/**
 * The sink that applies the `gap-sweep-status.run` effect.
 *
 * The engine records an effect's return value as the step's finding, so the runner's result reaches `assess`
 * through the normal path — no second channel, and the declaration stays unable to reach the world.
 */
export function createGapSweepSinks(deps = {}) {
  const run = createGapSweepRunner(deps);
  return {
    [GAP_SWEEP_STATUS_EFFECT]: async (payload) => run(payload),
  };
}
