/**
 * @file scripts/lib/lane-pool-paths.mjs
 *
 * The PURE path derivations `lane-pool.mjs` used to assume (#3265). Extracted rather than left inline because
 * `lane-pool.mjs` runs its CLI at import time, so nothing in it can be unit-tested by importing it — and these
 * two answers are exactly the kind that must be pinned, since getting them wrong is silent.
 *
 * THE DEFECT THEY CLOSE. The pool root was `join(homedir(), 'workspace', '.lanes')`, which assumes `$HOME` and
 * the checkouts agree about their prefix. On a laptop they do. On a cloud VM they do not: `$HOME` is `/root`
 * while the harness clones into `/home/user`, so the default resolved to `/root/workspace/.lanes` — a
 * directory that does not exist. `status` reported that phantom root cheerfully, no lane could be provisioned,
 * and because the COMMITTED `guard-lane.mjs` hook denies every write to a primary checkout, the box was left
 * with no writable surface at all.
 *
 * `we:scripts/guard-lane.mjs` already derives its workspace from where the checkout actually is — which is why
 * it correctly fired on `/home/user/web-everything` while the pool was looking in `/root`. One component
 * derived the path and the other assumed it. This module is that disagreement closed, on the derived side.
 */
import { homedir } from 'node:os';
import { join, dirname, sep } from 'node:path';

/** `~`-expansion against a supplied home, so the whole module stays pure over its inputs. */
const expandHome = (p, home) => (p && p.startsWith('~') ? join(home, p.slice(1)) : p);

/**
 * The WORKSPACE a checkout sits in — the directory holding its constellation siblings and the `.lanes` pool.
 * PURE.
 *
 * From a lane clone (`<workspace>/.lanes/<pool>/lane-N`) that is the segment BEFORE `.lanes`, never the lane's
 * own parent: a caller standing in a lane must resolve the SAME pool as one standing in the primary, or a lane
 * would provision its own nested pool. From a primary checkout it is simply the parent.
 *
 * The `.lanes` match is NON-GREEDY so it takes the OUTERMOST pool — the same reason
 * `judge-spawn.mjs#laneRootOf` is non-greedy: a path that happens to contain a nested `.lanes` must not
 * re-root the answer.
 *
 * @param {string} path - an absolute checkout path (or a subdirectory of one).
 * @returns {string} the workspace directory.
 */
export function workspaceFor(path) {
  const s = String(path || '');
  const i = s.indexOf(`${sep}.lanes${sep}`);
  return i >= 0 ? s.slice(0, i) : dirname(s);
}

/**
 * The default lane-pool root — `<workspace>/.lanes`, DERIVED from where the checkout actually is.
 *
 * Byte-identical to the old `homedir()`-based default on any host where the checkouts live under `$HOME`
 * (`~/workspace/webeverything` → `~/workspace/.lanes`), so a laptop sees no change. `LANE_POOL_ROOT` remains
 * the explicit override and still expands `~`.
 *
 * **`checkoutRoot` MUST be a checkout ROOT, not an arbitrary cwd** — the caller resolves it (`git rev-parse
 * --show-toplevel`). This function cannot: it is pure, and "is this path the repo root or three levels inside
 * it?" is not answerable from the string. Handed `<checkout>/scripts` it would return the CHECKOUT as the
 * workspace and put the pool at `<checkout>/.lanes` — inside the repo the pool is meant to sit beside. The
 * pre-#3265 `homedir()` default was wrong about the host but at least cwd-INDEPENDENT; deriving without
 * normalising first trades one bug for another (#1539 reviewer, round 2). A lane path needs no normalising —
 * `workspaceFor` strips at `.lanes` from any depth — but the root is still the honest input.
 *
 * @param {string} checkoutRoot - the checkout (or lane) ROOT the caller is in.
 * @param {object} env - environment bag; reads `LANE_POOL_ROOT` and `HOME`.
 * @returns {string} the pool root.
 */
export function defaultPoolRoot(checkoutRoot = process.cwd(), env = process.env) {
  const home = env.HOME || homedir();
  return expandHome(env.LANE_POOL_ROOT, home) || join(workspaceFor(checkoutRoot), '.lanes');
}

/**
 * The `--reference` argv for a clone — EMPTY when the reference repo is shallow. PURE: the caller does the
 * `rev-parse --is-shallow-repository` probe and passes the answer, so the DECISION is testable without a
 * filesystem (the shape the #1539 reviewer's mutation showed was missing).
 *
 * `git clone --reference <shallow>` is **fatal**, not a lost optimisation: `fatal: reference repository
 * '<path>' is shallow`, and `cloneLane` died on the raw `execFileSync` throw. Every cloud-VM checkout arrives
 * `--depth 1`, so on that host NO lane could be cloned at all, and the sibling clones failed the same way —
 * warned, leaving a lane with no `frontierui`/`plateau-app` beside it. `docs/agent/vm-sessions.md` described
 * shallow clones as merely "sharing nothing via `--reference`", which reads as a missed saving rather than a
 * hard stop (#3265).
 *
 * Dropping the flag is the right degradation: `--reference` is a disk/bandwidth optimisation and a plain clone
 * is correct wherever it cannot apply. `--reference-if-able` would also avoid the fatal, but it makes the
 * CALLER unable to tell whether sharing happened — returning the argv lets the caller log which one it got.
 *
 * `isShallow` is compared strictly against `true`, so an UNKNOWN probe (a `null` from an unreadable path)
 * keeps `--reference` — degrading to today's behaviour rather than silently dropping object sharing on every
 * clone because one `git` call failed.
 *
 * @param {string} referencePath - the repo to share objects with.
 * @param {boolean|null} isShallow - result of `git rev-parse --is-shallow-repository` on that path.
 * @returns {string[]} argv fragment, empty when the reference is unusable.
 */
export function referenceArgs(referencePath, isShallow) {
  return isShallow === true ? [] : ['--reference', referencePath];
}
