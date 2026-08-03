/**
 * #2900 — WHICH TREE DID THE MEASUREMENT RUN ON? The pure decision behind `we:scripts/lane-stack.mjs`'s
 * `recheck` / `record` refusing to certify from a checkout that is not a lane clone.
 *
 * WHY IT EXISTS. `recheck` asserts `actual ⊆ declared` so a post-hoc overlap can never reach the drain as a
 * certified-disjoint sibling. Run from the primary checkout it diffed `origin/main...origin/main`, found an
 * EMPTY actual set, and printed the same `clean — push` line a real certification prints — a silent FALSE PASS
 * on a safety gate, with no observable difference from a genuine one. `record` then pinned the chain frontier
 * to the primary's HEAD instead of the lane tip, so the next stacked child would acquire at a base missing its
 * parent's commit. `lane-stack.mjs` already validates the sha MATH (`--base` is "validated, not trusted"); this
 * validates the TREE that math ran on — the same threat through the undefended door.
 *
 * WHY ITS OWN MODULE. `lane-stack.mjs` is an all-top-level CLI: importing it runs the command switch. A pure
 * rule that cannot be imported cannot be tested, and this rule is exactly the kind that must be.
 *
 * WHY THE RULE IS NARROW. It refuses ONE shape — the seam measuring the checkout the script itself lives in,
 * which is the observed incident and the only case callable with certainty. A throwaway clone, a scratch tree,
 * a foreign path: allowed through, because guessing wrong would break honest workflows. The vacuous-diff check
 * (A2, in the CLI) is the belt to this braces and catches the wrong-tree case wherever this heuristic cannot.
 *
 * Detection reuses guard-bash's `/.lanes/` primitives (#2302/#2335/#2367) — never a second copy.
 */
import { isLaneCwd, isPrimaryCwd } from '../guard-bash.mjs';

/**
 * @param {{tree?:string, selfRoot?:string}} o  `tree` = what will be measured (`--lane` or cwd);
 *                                              `selfRoot` = the repo root the running script lives in.
 * @returns {{ok:boolean, reason:string}} `ok:false` only for `primary-checkout`.
 */
export function laneTreeVerdict({ tree, selfRoot } = {}) {
  if (!tree) return { ok: true, reason: 'no-tree' };
  if (isLaneCwd(tree)) return { ok: true, reason: 'lane-clone' };
  if (isLaneCwd(selfRoot)) return { ok: true, reason: 'script-in-lane' };
  if (!isPrimaryCwd(tree, [selfRoot].filter(Boolean))) return { ok: true, reason: 'foreign-tree' };
  return { ok: false, reason: 'primary-checkout' };
}
