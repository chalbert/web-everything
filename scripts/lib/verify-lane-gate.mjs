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
 * WHAT verify-lane's OWN diff can never do: edits to `scripts/verify-lane.mjs` (or this module) are themselves a
 * blast-radius surface (`isBlastRadiusPath` — `scripts/`), so a PR that changes verify-lane's own gate logic is
 * itself deny-by-default UNSHRINKABLE — the fail-safe applies to its own future changes, not only to callers'.
 * That UNSHRINKABLE rule is about the VITEST half only (module-graph soundness); see below for why the
 * check:standards half is scoped independently of it.
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
 */
import { selectTests } from '../readiness/test-selection.mjs';
import { isPolicyCorePath } from './gate-config.mjs';

/** The historical, always-safe fallback gate: the full unit suite plus the repo health gate. */
export const FULL_GATE = 'npm run test:unit && npm run check:standards';

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
 *   - the VITEST half: `shrink` ⇒ `npx vitest related <selected files> --run` — only the tests the PR's real diff
 *     affects, via vitest's own module graph (mirrors `test-selection.mjs`'s own CLI shell,
 *     `vitestRelatedSelectedFiles`, for consistency); `full` ⇒ `npm run test:unit` — the fail-safe direction: a
 *     sensitive/glob-edge/unlisted diff, an empty or unknown (git failure) changed set, or the selection flag
 *     explicitly off, ALL resolve here unchanged.
 *   - the check:standards half: scoped to `--local --files=<changedFiles>` whenever
 *     {@link canScopeCheckStandards} allows it (#1937) — independently of the vitest half's mode, since it is a
 *     separately-safe, already-ratified mechanism, not gated behind the vitest shrink's not-yet-defaulted flag.
 * The selection flag defaults ON for this call site specifically (unless the ambient environment explicitly sets
 * it) — verify-lane does not require the operator to separately export `WE_DIFF_TEST_SELECTION` for its own
 * local gate; an explicit override (e.g. `WE_DIFF_TEST_SELECTION=0`) still wins. It governs only the vitest half.
 * @param {{base?: string, runGit: (args:string[]) => string, env?: Record<string,string|undefined>}} args
 * @returns {{ command: string, decision: import('../readiness/test-selection.mjs').SelectionDecision & {changedFiles: string[]|null} }}
 */
export function resolveDefaultGate({ base = 'origin/main', runGit, env = process.env } = {}) {
  const selectionEnv = { ...env };
  if (selectionEnv.WE_DIFF_TEST_SELECTION === undefined) selectionEnv.WE_DIFF_TEST_SELECTION = '1';
  const decision = selectTests({ base, runGit, env: selectionEnv });

  // #1937: scope only the local, non-authoritative fast-fail — the central, unscoped check:standards CI runs
  // against the real merged tree remains the actual authority and is untouched by this local shrink.
  const checkStandardsCmd = canScopeCheckStandards(decision.changedFiles)
    ? `npm run check:standards -- --local --files=${shellQuote(decision.changedFiles.join(','))}`
    : 'npm run check:standards';

  if (decision.mode === 'shrink' && decision.selectedFiles.length > 0) {
    const files = decision.selectedFiles.map(shellQuote).join(' ');
    return { command: `npx vitest related ${files} --run && ${checkStandardsCmd}`, decision };
  }
  return { command: `npm run test:unit && ${checkStandardsCmd}`, decision };
}
