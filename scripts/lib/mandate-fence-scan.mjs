/**
 * mandate-fence-scan.mjs — the WIRING half of rule 19, the unfenced-mandate-param gate (#2967b).
 *
 * WHY IT IS A MODULE AND NOT AN INLINE BLOCK (PR #1235 review, finding 4). The pure rule
 * (`findUnfencedMandateParams`) was unit-tested from day one, but the code that FEEDS it — which directory it
 * reads, and the fact that it is called at all — lived inline in `check-standards.mjs`. Mutating the call to
 * `findUnfencedMandateParams([])` left every test green: the standing guards re-implemented the walk inside the
 * test file, so they pinned the rule and never the registration. With the walk here, the test imports THIS —
 * the same function the gate runs — and a neutered walk reddens it.
 *
 * `check-standards.mjs` calls this OUTSIDE any try/catch on purpose: rule 19 ERRORS, and a catch-all that
 * demoted its failure to a warning would be a gate that fails OPEN — the exact shape #2967 exists to stop
 * shipping. Nothing here catches either.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findUnfencedMandateParams } from '../check-standards-rules.mjs';

/** The scanned set: every module under `scripts/lib/` (non-recursive) — where this repo's mandate builders
 *  live (`review-core.mjs`, `jury-core.mjs`, the subject adapters). Exported so a widening is one edit here
 *  rather than a second copy in a test. */
export const MANDATE_BUILDER_DIR = ['scripts', 'lib'];

/**
 * Read the modules rule 19 judges: `{ file, content }` for each `.mjs` directly inside `<root>/scripts/lib`.
 * Deterministic order (readdir's), so a finding list is stable between runs.
 * @param {string} root - repo root.
 * @returns {Array<{file: string, content: string}>}
 */
export function readMandateBuilderModules(root) {
  const dir = join(root, ...MANDATE_BUILDER_DIR);
  if (!existsSync(dir)) return [];
  const mods = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.mjs')) continue;
    const abs = join(dir, name);
    try { if (!statSync(abs).isFile()) continue; } catch { continue; }
    mods.push({ file: `${MANDATE_BUILDER_DIR.join('/')}/${name}`, content: readFileSync(abs, 'utf8') });
  }
  return mods;
}

/**
 * Run rule 19 end to end over a repo root — the walk plus the pure rule, exactly as the gate does.
 * @param {string} root - repo root.
 * @returns {{errors: Array<{message: string, descriptor: object}>, warnings: Array<{message: string, descriptor: object}>}}
 */
export function scanUnfencedMandateParams(root) {
  return findUnfencedMandateParams(readMandateBuilderModules(root));
}
