/**
 * @file scripts/lib/verify-lane-gate.mjs
 * @description The pure decision core for `verify-lane.mjs`'s DEFAULT gate command (#3372).
 *
 * WHY. `verify-lane.mjs`'s default gate used to be a bare `npm run test:unit && npm run check:standards` —
 * unaware that diff-driven test selection (`scripts/readiness/test-selection.mjs`, #2681, under #2612) already
 * exists and is proven safe by its own deny-by-default allow-list. Under N concurrent lanes, N unscoped full-suite
 * runs compete for one local host — the resource-contention bottleneck this item exists to fix.
 *
 * WHY DEFAULTING THE SHRINK HERE DOES NOT VIOLATE #2681's "NOT DEFAULTED" DoD. `test-selection.mjs`'s own DoD
 * reads: "Flag-gated; not defaulted until the measured false-green rate is acceptable and a red-main recovery
 * path exists." That DoD governs defaulting the shrink onto the AUTHORITATIVE pre-merge gate: CI's required
 * `test`/`test-shard` jobs in `.github/workflows/ci.yml`, which still run the FULL, unshrunk, sharded suite
 * unconditionally — they never read `WE_DIFF_TEST_SELECTION` (only the separate, off-by-default
 * `test-selection-measure` evidence-gathering job does, and its own result gates nothing). `verify-lane.mjs` is
 * NOT that gate: per its own header it is a LOCAL, PRE-CI sanity check (#2833 — "run the suites synchronously so
 * a subagent can't background them and yield"). `pr-land.mjs` / the drain still wait for and require CI's real
 * full-suite check before merging — see `scripts/lib/lane-verify.mjs`'s own docs: "the required GitHub `test`
 * check — a red tree also fails it." So a false-green from this LOCAL shrink costs, at worst, a wasted local
 * round-trip (a lane that looked locally green bounces at the real CI gate) — never a merged regression. That is
 * a materially different, and much smaller, risk than the "post-land red under the sole writer" scenario
 * #2681/#3361 (still open, dispatch-freeze dormant) exists to guard against.
 *
 * xpnhz4o (2026-09-25) — THE VITEST HALF NOW USES THE LOCAL POLICY. #3372 first reused the CI deny-by-default
 * allow-list here, under which every `scripts/` edit is a blast-radius surface ⇒ full suite — i.e. almost every
 * real PR. Several fixers each running the 10+ minute suite at once drove host load to 1.8/core and starved lane
 * pickup and reviews. The vitest half now uses `test-selection.mjs#decideLocalSelection`, which shrinks by
 * default and falls back to full only where the module graph is blind (config / setup / dependencies / shared
 * test helpers / deleted sources); the reasoning above for why a local shrink is safe applies unchanged.
 *
 * THE check:standards HALF (#1937/#3395). #1937 (`#gate-on-merged-tree-lane-fast-fail`) already ruled that a
 * lane gate is not the authority for whole-repo/cross-lane invariants — those belong on the merged tree, in CI —
 * and that a lane may run a scoped fast-fail instead. `check-standards.mjs` already has exactly that mode,
 * `--local --files=<list>` (`claimScope.mjs`'s `partitionLocal`): it demotes path-less GLOBAL/RELATIONAL findings
 * and findings on files OUTSIDE the given set to notes — it never skips checking a file that IS in the set. That
 * makes it safe to scope far more broadly than the vitest shrink: scoping check:standards does not risk missing a
 * check on a changed file the way an unsound `vitest related` walk could miss a reverse-dependent test, so it
 * does not need the vitest half's SHRINK_ALLOW_LIST/sensitive-surface gauntlet. It only needs to stay unscoped
 * for the two surfaces that gauntlet can't help with anyway:
 *   - `backlog/` — the stranded-hash false-red symptom (#3368's landing) reads `origin/main` directly, independent
 *     of the lane's own diff; a lane that itself touches `backlog/` keeps the unscoped run as an extra margin.
 *   - a gate-self/policy-core path (`isGateSelfPath`/`isPolicyCorePath`, `gate-config.mjs`) — the gate's own
 *     trust chain must always see the unscoped whole-repo signal on a change to itself.
 * See {@link canScopeCheckStandards}.
 *
 * `resolveDefaultGate` is pure — no fs, no child_process, no clock. It takes an injectable `runGit` (mirroring
 * `test-selection.mjs`'s own convention) so tests drive it deterministically.
 *
 * PER-REPO SCRIPTS (#3919). The gate halves above name WE's own npm scripts (`test:unit`, `check:standards`), but
 * `verify-lane.mjs --repo=` also verifies sibling checkouts (plateau-app, frontierui). plateau-app has neither
 * script (its suite is `"test": "vitest run"`), so the WE-shaped gate always failed there with "Missing script".
 * The IO shell now injects the target checkout's npm script NAMES (`scripts`, read from its package.json) and
 * {@link composeGate} builds only the halves that checkout actually has:
 *   - vitest half: `test:unit` present ⇒ today's logic, unchanged (diff-driven shrink or `npm run test:unit`);
 *     absent but `test` present ⇒ `npm test` (full — the shrink's allow-list is WE-shaped, so it is never applied
 *     to a checkout without WE's `test:unit` convention); neither ⇒ skipped, with an explicit reason.
 *   - check:standards half: included (scoped exactly as before) only when the checkout has `check:standards`.
 * `scripts` omitted/unknown ⇒ assumed WE-shaped, so a WE checkout's command is byte-for-byte unchanged. frontierui
 * has both `test:unit` and `check:standards`, so it too gets today's gate unchanged.
 */
import { SELECTION_FLAG, pinnedMergeBase, decideLocalSelection, referencedTestNeedles } from '../readiness/test-selection.mjs';
import { isPolicyCorePath } from './gate-config.mjs';

/** Above this many `vitest related` targets the local gate runs the full suite instead (argv size; little saving). */
export const MAX_RELATED_TARGETS = 300;

/** The historical, always-safe fallback gate: the full unit suite plus the repo health gate. */
export const FULL_GATE = 'npm run test:unit && npm run check:standards';

/** Script names a WE-shaped checkout is assumed to have when the caller injects none (back-compat default). */
const WE_SCRIPTS = Object.freeze(['test:unit', 'check:standards']);

/**
 * Build the gate command from its two halves, keeping only the halves the checkout's npm scripts support (#3919).
 * Pure. With both WE scripts present the output is exactly `${vitestCmd} && ${checkStandardsCmd}` — today's shape.
 * @param {{vitestCmd: string, checkStandardsCmd: string, scripts?: Iterable<string>|null}} args
 * @returns {{command: string, gateReasons: string[]}}
 */
export function composeGate({ vitestCmd, checkStandardsCmd, scripts }) {
  const have = new Set(scripts == null ? WE_SCRIPTS : scripts);
  const gateReasons = [];
  let testHalf = null;
  if (have.has('test:unit')) testHalf = vitestCmd;
  else if (have.has('test')) {
    testHalf = 'npm test';
    gateReasons.push('no `test:unit` script in this checkout — running `npm test` (full, no diff shrink)');
  } else gateReasons.push('no `test:unit` or `test` script in this checkout — test half skipped');
  let standardsHalf = null;
  if (have.has('check:standards')) standardsHalf = checkStandardsCmd;
  else gateReasons.push('no `check:standards` script in this checkout — health-gate half skipped');
  const halves = [testHalf, standardsHalf].filter(Boolean);
  if (halves.length === 0) {
    return { command: `echo ${shellQuote('verify-lane: no test:unit/test/check:standards npm script in this checkout — nothing to run')}`, gateReasons };
  }
  return { command: halves.join(' && '), gateReasons };
}

/** Single-quote a string for safe inclusion in a shell command (handles an embedded `'`). */
function shellQuote(str) {
  return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

/** Is this repo-relative path under `backlog/` — the stranded-hash false-red surface #1937/#3395 routes around. */
function isBacklogPath(path) {
  return /^backlog\//.test(String(path || ''));
}

/**
 * May the check:standards half of the gate scope to `--local --files=<changedFiles>` (#1937)? Pure. True only
 * when the changed set is KNOWN (not `null` — an unreadable/unknown diff never shrinks) and non-empty, and no
 * changed file is under `backlog/` or is a gate-self/policy-core path (see the file header for why those two,
 * and only those two, keep the fail-safe unscoped run — unlike the vitest half, this scoping does not need the
 * full sensitive-surface gauntlet).
 * @param {string[]|null} changedFiles
 * @returns {boolean}
 */
export function canScopeCheckStandards(changedFiles) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return false;
  return !changedFiles.some((f) => isBacklogPath(f) || isPolicyCorePath(f));
}

/**
 * Decide verify-lane's DEFAULT gate command from the actual diff against `base` (default `origin/main`).
 *   - the VITEST half (xpnhz4o — the LOCAL policy, `test-selection.mjs#decideLocalSelection`, NOT the CI
 *     deny-by-default one): `shrink` ⇒ `npx vitest related <changed files + tests naming them> --run
 *     --passWithNoTests`; `full` ⇒ `npm run test:unit` — only when a config / setup / dependency / shared-test-
 *     helper file changed, a source file was deleted, the diff is empty or unknown, or `WE_DIFF_TEST_SELECTION=0`.
 *     The CI deny-by-default list is deliberately NOT reused here: it made every `scripts/` change a full local
 *     run, and CI (the authority) still runs the full suite regardless. {@link describeGate} states which it was.
 *   - the check:standards half: scoped to `--local --files=<changedFiles>` whenever
 *     {@link canScopeCheckStandards} allows it (#1937) — independently of the vitest half's mode, since it is a
 *     separately-safe, already-ratified mechanism, not gated behind the vitest shrink's not-yet-defaulted flag.
 * Selection is ON by default here; only an explicit `WE_DIFF_TEST_SELECTION=0` turns it off (vitest half only).
 * `scripts` (#3919): the target checkout's npm script names; omitted ⇒ WE-shaped (unchanged). See {@link composeGate}.
 * @param {{base?: string, runGit: (args:string[]) => string, env?: Record<string,string|undefined>, scripts?: Iterable<string>|null}} args
 * @returns {{ command: string, gateReasons: string[], decision: import('../readiness/test-selection.mjs').SelectionDecision & {changedFiles: string[]|null} }}
 */
export function resolveDefaultGate({ base = 'origin/main', runGit, env = process.env, scripts } = {}) {
  // xpnhz4o — the changed set is the WORKING TREE against the pinned merge-base (tracked edits, staged or not,
  // plus untracked files), not HEAD's committed diff. The gate runs against the working tree, so that is the set
  // it must key on — and a fixer runs the gate BEFORE committing, which under the old "dirty ⇒ full" rule (#3389)
  // meant every fixer gate was a full-suite run.
  const diff = localChangedSet({ base, runGit });
  const changedFiles = diff ? diff.changedFiles : null;
  const optOut = String(env?.[SELECTION_FLAG] ?? '') === '0';
  const local = decideLocalSelection({ changedFiles, deletedFiles: diff ? diff.deletedFiles : [], optOut });

  // #1937: scope only the local, non-authoritative fast-fail — the central, unscoped check:standards CI runs
  // against the real merged tree remains the actual authority and is untouched by this local shrink.
  const checkStandardsCmd = canScopeCheckStandards(changedFiles)
    ? `npm run check:standards -- --local --files=${shellQuote(changedFiles.join(','))}`
    : 'npm run check:standards';

  if (local.mode === 'shrink') {
    const referencedTests = testsNaming(referencedTestNeedles(local.relatedFiles), runGit);
    const targets = Array.from(new Set([...local.relatedFiles, ...referencedTests])).sort();
    // xpnhz4o review — a huge diff (a mass rename) would build a command line past the OS argv limit; at that
    // size the selection saves little anyway, so fall back to the full suite cleanly and say so.
    if (targets.length > MAX_RELATED_TARGETS) {
      const reasons = [`${targets.length} selection targets (over ${MAX_RELATED_TARGETS}) — full suite (too large to pass to \`vitest related\`; the selection would save little)`];
      return { ...composeGate({ vitestCmd: 'npm run test:unit', checkStandardsCmd, scripts }), decision: { ...local, mode: 'full', reasons, changedFiles, referencedTests, targets: [] } };
    }
    const decision = { ...local, changedFiles, referencedTests, targets };
    // `--passWithNoTests`: a diff whose files no test reaches (docs, a backlog card) is a pass, not a failure.
    const vitestCmd = `npx vitest related ${targets.map(shellQuote).join(' ')} --run --passWithNoTests`;
    return { ...composeGate({ vitestCmd, checkStandardsCmd, scripts }), decision };
  }
  return { ...composeGate({ vitestCmd: 'npm run test:unit', checkStandardsCmd, scripts }), decision: { ...local, changedFiles, referencedTests: [], targets: [] } };
}

/**
 * The working-tree changed set against the pinned merge-base: `{changedFiles, deletedFiles}`, or `null` when git
 * cannot answer (the caller then runs the full suite). Pure given `runGit`.
 * @param {{base: string, runGit: (args: string[]) => string}} args
 * @returns {{changedFiles: string[], deletedFiles: string[]}|null}
 */
export function localChangedSet({ base = 'origin/main', runGit }) {
  const mergeBase = pinnedMergeBase({ base, runGit });
  if (!mergeBase) return null;
  const lines = (out) => String(out).split('\n').map((s) => s.trim()).filter(Boolean);
  try {
    const tracked = lines(runGit(['diff', '--name-only', mergeBase]));
    const deletedFiles = lines(runGit(['diff', '--name-only', '--diff-filter=D', mergeBase]));
    const untracked = lines(runGit(['ls-files', '--others', '--exclude-standard']));
    return { changedFiles: Array.from(new Set([...tracked, ...untracked])).sort(), deletedFiles };
  } catch {
    return null;
  }
}

/** The vitest test files that contain any of `needles` as a fixed string (`git grep -l -F`). `git grep` exits 1
 *  on no match, which `runGit` surfaces as a throw — that is "no referencing tests", not an error. Pure given
 *  `runGit`. */
export function testsNaming(needles, runGit) {
  if (!needles.length) return [];
  const args = ['grep', '-l', '-F'];
  for (const n of needles) args.push('-e', n);
  args.push('--', '*.test.ts', '*.test.tsx', '*.test.js', '*.test.mjs', '*.test.cjs', '*.test.mts');
  try {
    return String(runGit(args)).split('\n').map((s) => s.trim()).filter(Boolean).sort();
  } catch {
    return [];
  }
}

/**
 * One human-readable block describing what the default gate decided — printed by `verify-lane.mjs` before the
 * gate runs, so an agent (and the operator reading its transcript) can see whether this was a SELECTED run or a
 * FULL-SUITE fallback, and why. Pure.
 * @param {{command: string, decision: object}} gate - `resolveDefaultGate`'s return value
 * @returns {string}
 */
export function describeGate({ command, decision }) {
  const out = [];
  if (decision.mode === 'shrink') {
    out.push(`verify-lane gate: SELECTED tests only — ${decision.changedFiles.length} changed path(s) → \`vitest related\` on ${decision.targets.length} target(s) (${decision.referencedTests.length} added because they name a changed file). CI still runs the full suite.`);
  } else {
    out.push('verify-lane gate: FULL SUITE (fallback) — the diff could not be safely scoped:');
  }
  for (const r of decision.reasons || []) out.push(`  - ${r}`);
  out.push(`  command: ${command}`);
  return out.join('\n');
}
