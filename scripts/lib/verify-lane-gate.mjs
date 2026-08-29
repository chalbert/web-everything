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
 *
 * `resolveDefaultGate` is pure — no fs, no child_process, no clock. It takes an injectable `runGit` (mirroring
 * `test-selection.mjs`'s own convention) so tests drive it deterministically.
 */
import { selectTests } from '../readiness/test-selection.mjs';

/** The historical, always-safe fallback gate: the full unit suite plus the repo health gate. */
export const FULL_GATE = 'npm run test:unit && npm run check:standards';

/** Single-quote a repo-relative path for safe inclusion in a shell command string (handles an embedded `'`). */
function shellQuote(path) {
  return `'${String(path).replace(/'/g, `'\\''`)}'`;
}

/**
 * Decide verify-lane's DEFAULT gate command from the actual diff against `base` (default `origin/main`).
 *   - `shrink` ⇒ `npx vitest related <selected files> --run && npm run check:standards` — only the tests the
 *     PR's real diff affects, via vitest's own module graph (mirrors `test-selection.mjs`'s own CLI shell,
 *     `vitestRelatedSelectedFiles`, for consistency).
 *   - `full`   ⇒ {@link FULL_GATE} — the fail-safe direction: a sensitive/glob-edge/unlisted diff, an empty or
 *     unknown (git failure) changed set, or the selection flag explicitly off, ALL resolve here unchanged.
 * The selection flag defaults ON for this call site specifically (unless the ambient environment explicitly sets
 * it) — verify-lane does not require the operator to separately export `WE_DIFF_TEST_SELECTION` for its own
 * local gate; an explicit override (e.g. `WE_DIFF_TEST_SELECTION=0`) still wins.
 * @param {{base?: string, runGit: (args:string[]) => string, env?: Record<string,string|undefined>}} args
 * @returns {{ command: string, decision: import('../readiness/test-selection.mjs').SelectionDecision & {changedFiles: string[]|null} }}
 */
export function resolveDefaultGate({ base = 'origin/main', runGit, env = process.env } = {}) {
  const selectionEnv = { ...env };
  if (selectionEnv.WE_DIFF_TEST_SELECTION === undefined) selectionEnv.WE_DIFF_TEST_SELECTION = '1';
  const decision = selectTests({ base, runGit, env: selectionEnv });
  if (decision.mode === 'shrink' && decision.selectedFiles.length > 0) {
    const files = decision.selectedFiles.map(shellQuote).join(' ');
    return { command: `npx vitest related ${files} --run && npm run check:standards`, decision };
  }
  return { command: FULL_GATE, decision };
}
