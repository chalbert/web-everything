/**
 * @file scripts/readiness/couple-plan.mjs
 * @description Pure planner for the cross-locus couple's CI concurrency (#2684, under #2612). Decides three
 *   things from INJECTED shas — never touching git, the filesystem, or gh — so every rule is unit-testable:
 *
 *     1. `planCoupleOpen`  — open-order + WE stack-base, so BOTH PRs open before either lands (overlapped
 *                            first CI). The WE half stacks on the impl lane's PINNED tip sha (#2393), so its
 *                            first CI validates impl+WE together. Impl opens first (its ref must exist as the
 *                            stack base); WE opens second, stacked. Land order (impl-first/WE-last) is
 *                            UNCHANGED and owned by the drain — only the *open* is overlapped.
 *     2. `decideWeReCi`    — the GUARDED skip-vs-rebase verdict for the WE half's post-impl-land re-CI.
 *                            Fail-safe to `rebase`: the WE half is only ever allowed onto a base its OWN CI
 *                            already validated.
 *
 * WHY (#2684): a cross-locus couple's two CIs serialize today — the WE half is opened off `origin/main`, so
 * after the impl half lands the WE half goes `BEHIND`, the drain rebase-drops it, and the rebuilt tip re-runs
 * `test` and lands a pass later — a whole second CI cycle. Overlap-opening the WE half stacked on the impl tip
 * overlaps the FIRST CIs; and when the impl lands as a provable CLEAN fast-forward the WE half's first CI is
 * STILL valid against `main`, so the re-CI can be skipped.
 *
 * THE GUARD (design jury — the naive "no second CI" claim was false in steady state). The skip is CONDITIONAL,
 * with a clean fallback, because the fast-forward assumption breaks in the common cases:
 *   • **Squash-merge** rewrites the impl commit → the landed sha ≠ the sha the WE half stacked on → the guard
 *     trips → fall back to rebase + re-CI. Never assume a byte-identical land.
 *   • **Impl `review:changes` bounce** (a NORMAL outcome of the mandatory non-author sign-off) supersedes the
 *     stacked base → the landed sha ≠ the stacked base → fall back. Never land the WE half on a stale impl.
 *   • **`main` advanced past the impl land** (another couple landed in between) → the WE first CI no longer
 *     reflects `main`'s tip → fall back.
 *   • Any **missing / malformed** sha → fall back. The default is ALWAYS rebase — the skip is the exception it
 *     takes only on positive proof.
 *
 * This module is the SINGLE source of truth (#96) for the MODEL of that decision from injected shas. Its
 * runtime consumers: the couple opener (via `scripts/lane-stack.mjs couple-open`) uses `planCoupleOpen` for the
 * open-order + stack-base; `decideWeReCi` is the pure statement of the guard invariant that the same opener uses
 * to reason about the skip. Note the drain (`scripts/merge-ai-prs.mjs`) does NOT re-derive this verdict at land
 * time — it reads the git TRUTH directly: a stacked WE half whose impl landed as a clean fast-forward is already
 * on `main` (rebase-drop → `current` → lands on its first CI, no re-CI), and a superseded base makes it BEHIND
 * (→ `rebased` → re-CI). That git machinery IS the guard realized; this module is its pure, testable model. The
 * IO shell (the `main()` CLI, gated on `import.meta.url === pathToFileURL(process.argv[1]).href`) only parses
 * flags + reads shas from its args and prints the verdict as JSON — it owns no git, so the pure core stays
 * importable with zero side effects.
 */

import { pathToFileURL } from 'node:url';

/** A git object hash: 7–64 hex chars (matches `lane-manifest.mjs`'s `base` validation). */
const SHA_RE = /^[0-9a-f]{7,64}$/;

/** Normalize a caller-supplied sha to lowercase-trimmed, or `''` for anything non-string. Pure. */
export function normSha(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

/** Is `s` a syntactically valid git object hash? Pure. */
export function isSha(s) {
  return SHA_RE.test(normSha(s));
}

/**
 * Decide open-order + the WE half's stack-base for a cross-locus couple, so BOTH PRs open before either lands
 * (overlapped first CI). Pure — the caller supplies the impl lane's already-PUSHED tip sha; this module never
 * resolves a ref itself.
 *
 * The WE half stacks on the impl lane's PINNED tip sha (never a mutable ref — #2393/#2394): its first CI then
 * validates the impl+WE tree together, and on a clean impl fast-forward needs no re-CI (see `decideWeReCi`).
 * Impl opens FIRST (its `lane/*` ref must exist to be the stack base); WE opens second, stacked on that tip.
 *
 * FAIL-SAFE: a couple whose impl tip sha is missing/invalid, or that is not actually cross-locus (impl repo ==
 * WE repo — a single-locus item, not a couple), does NOT stack: `stackBase` is `null` and the WE half opens off
 * `main` (serial first CI, today's behaviour). Overlap is an optimization taken only on positive proof, never a
 * default that could stack a WE half on an unresolved base.
 *
 * @param {{ implRepo?:string, weRepo?:string, implRef?:string, weRef?:string, implTipSha?:string }} o
 * @returns {{ openOrder:Array<{repo:(string|undefined), ref:(string|undefined), role:('impl'|'we')}>,
 *             stackBase:(string|null), weStacked:boolean, concurrent:boolean, reason:string }}
 *   `openOrder` is impl-first/WE-last (the same order the drain lands in); `stackBase` is the impl tip the WE
 *   half stacks on (or `null` → open WE off main); `concurrent` is always true — both PRs open before either
 *   lands, which is the whole point.
 */
export function planCoupleOpen({ implRepo, weRepo = 'we', implRef, weRef, implTipSha } = {}) {
  const tip = isSha(implTipSha) ? normSha(implTipSha) : null;
  const crossLocus = !!implRepo && implRepo !== weRepo;
  const weStacked = !!(tip && crossLocus);
  const openOrder = [
    { repo: implRepo, ref: implRef, role: 'impl' },
    { repo: weRepo, ref: weRef, role: 'we' },
  ];
  let reason;
  if (weStacked) reason = `WE half stacks on impl tip ${tip.slice(0, 8)} — overlapped first CI (impl-first open, WE-last)`;
  else if (!crossLocus) reason = 'not a cross-locus couple (impl repo == WE repo) — no stacking, single PR';
  else reason = 'no pinned impl tip sha — WE opens off main (serial first CI, fail-safe)';
  return { openOrder, stackBase: weStacked ? tip : null, weStacked, concurrent: true, reason };
}

/**
 * The GUARDED skip-vs-rebase verdict for the WE half's post-impl-land re-CI. Pure. Fail-safe to `rebase`.
 *
 * Skip the WE re-CI ONLY when the WE half's first CI is provably STILL valid against current `main` — i.e. the
 * impl landed EXACTLY as the sha the WE half was overlap-stacked on, AND `main` has not advanced past it:
 *
 *     landedImplSha === stackedBaseSha   &&   mainTipSha === landedImplSha
 *
 * Every other configuration falls back to today's rebase + re-CI (each with its own reason so the drain log and
 * the tests distinguish them):
 *   • `stackedBaseSha` unknown (the WE half was NOT stacked — opened off main) → rebase.
 *   • `landedImplSha !== stackedBaseSha` → the impl landed as a DIFFERENT sha: a squash-merge, or a
 *     `review:changes` re-stack superseded the base → rebase (never land the WE half on a stale impl).
 *   • `mainTipSha !== landedImplSha` → `main` advanced past the impl land (another couple landed between) →
 *     rebase (the WE first CI no longer reflects main's tip).
 *   • any missing / malformed sha → rebase (never skip on incomplete proof).
 *
 * @param {{ stackedBaseSha?:string, landedImplSha?:string, mainTipSha?:string }} o  all three are git shas.
 *   `stackedBaseSha` is the impl tip the WE half was overlap-stacked on (from the couple manifest's per-repo
 *   `base`); `landedImplSha` is the sha the impl half actually landed as on `main`; `mainTipSha` is the current
 *   `main` tip. (From the drain's post-land vantage `landedImplSha` and `mainTipSha` are both `origin/main`;
 *   they are modelled separately so the squash/bounce vs. main-advanced cases are distinct and testable.)
 * @returns {{ verdict:('ff-skip'|'rebase'), skipReCi:boolean, reason:string }}
 */
export function decideWeReCi({ stackedBaseSha, landedImplSha, mainTipSha } = {}) {
  const base = normSha(stackedBaseSha);
  const landed = normSha(landedImplSha);
  const main = normSha(mainTipSha);
  const rebase = (reason) => ({ verdict: 'rebase', skipReCi: false, reason });

  if (!isSha(base)) return rebase('WE half was not overlap-stacked (no stacked-base sha) — rebase + re-CI');
  if (!isSha(landed)) return rebase('landed impl sha unknown/invalid — fail-safe to rebase + re-CI');
  if (!isSha(main)) return rebase('main tip sha unknown/invalid — fail-safe to rebase + re-CI');

  if (landed !== base) {
    return rebase(`landed impl ${landed.slice(0, 8)} ≠ stacked base ${base.slice(0, 8)} (squash-merge or review:changes re-stack superseded the base) — rebase + re-CI`);
  }
  if (main !== landed) {
    return rebase(`main ${main.slice(0, 8)} advanced past the landed impl ${landed.slice(0, 8)} — rebase + re-CI`);
  }
  return {
    verdict: 'ff-skip',
    skipReCi: true,
    reason: `clean fast-forward: impl landed at the stacked base ${base.slice(0, 8)} and main is still there — the WE half's first CI stays valid, skip the re-CI`,
  };
}

/** The IO shell: parse flags, read the injected shas, print the verdict as JSON. Owns no git. */
function main(argv) {
  const flags = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  }
  const cmd = flags['couple-open'] ? 'couple-open' : 'we-reci';
  let out;
  if (cmd === 'couple-open') {
    out = planCoupleOpen({
      implRepo: typeof flags['impl-repo'] === 'string' ? flags['impl-repo'] : undefined,
      weRepo: typeof flags['we-repo'] === 'string' ? flags['we-repo'] : 'we',
      implRef: typeof flags['impl-ref'] === 'string' ? flags['impl-ref'] : undefined,
      weRef: typeof flags['we-ref'] === 'string' ? flags['we-ref'] : undefined,
      implTipSha: typeof flags['impl-tip'] === 'string' ? flags['impl-tip'] : undefined,
    });
  } else {
    out = decideWeReCi({
      stackedBaseSha: typeof flags['stacked-base'] === 'string' ? flags['stacked-base'] : undefined,
      landedImplSha: typeof flags['landed-impl'] === 'string' ? flags['landed-impl'] : undefined,
      mainTipSha: typeof flags['main-tip'] === 'string' ? flags['main-tip'] : undefined,
    });
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
}

// Run the IO shell only when invoked directly, never on import (keeps the pure core importable side-effect-free).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
