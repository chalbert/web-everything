/**
 * #2900 — WHICH TREE DID THE MEASUREMENT RUN ON? The decision behind `we:scripts/lane-stack.mjs`'s
 * `recheck` / `record` / `apply-rebase` refusing to operate on a tree that is not the item's own lane clone.
 *
 * WHY IT EXISTS. `recheck` asserts `actual ⊆ declared` so a post-hoc overlap can never reach the drain as a
 * certified-disjoint sibling. Run from the primary checkout it diffed `origin/main...origin/main`, found an
 * EMPTY actual set, and printed the same `clean — push` line a real certification prints — a silent FALSE PASS
 * on a safety gate. `record` then pinned the chain frontier to the primary's HEAD instead of the lane tip, so
 * the next stacked child would acquire at a base missing its parent's commit. `lane-stack.mjs` already
 * validates the sha MATH (`--base` is "validated, not trusted"); this validates the TREE that math ran on.
 *
 * WHY A MARKER, NOT A PATH. The first version of this guard asked "does the path contain `/.lanes/`". That is a
 * GUESS, and it failed twice: the `script-in-lane` allowance made the whole refusal unreachable whenever the
 * running copy of the script lived in a lane clone (this repo's NORMAL execution context — so the guard was off
 * exactly when it should fire), and a substring test lets any directory whose path happens to contain `.lanes`
 * pass while git, which walks UP to find its repository, operates on something else entirely.
 *
 * The pool already records the fact the guess was reaching for. `lane-pool.mjs acquire` writes a lease marker
 * at `<lane>/.git/.lane-lease` when it hands the folder out — the same file `guard-bash.mjs` reads for its own
 * lane checks (#2367). So this asks a POSITIVE question against a fact on disk: *is the tree I am about to
 * measure a leased lane, and is that lease for the item I am certifying?* No naming convention, nothing new to
 * record, nothing to thread through the flow. This is the same "check what you recorded, do not infer it from a
 * name" rule the module's `--base` pinning already follows.
 *
 * It also closes a hole the path guess could not: aiming `--lane` at a DIFFERENT lane used to yield a full
 * `clean` certification, because any directory under `/.lanes/` was accepted. Comparing the lease's own item
 * against `--id` binds the seam to the CORRECT lane, not merely to some lane.
 *
 * Pure — the caller supplies the lease it read; this module never touches the filesystem.
 */

/** The item a lease is for, or null. `lane-pool acquire --purpose=<slug>` writes slugs like `2899-resolve-…`
 *  or `xdxlevu-resolve-…`, and `--item=<id>` records the id directly. Pure. */
export function leaseItem(lease) {
  if (!lease || typeof lease !== 'object') return null;
  if (lease.item != null && String(lease.item)) return String(lease.item);
  const m = String(lease.purpose || '').match(/^(\d{1,6}|x[0-9a-z]{6})\b/);
  return m ? m[1] : null;
}

/**
 * May this seam measure this tree? Pure.
 *
 * @param {{lease?: (object|null), id?: (string|number|null), requireItemMatch?: boolean}} o
 *   `lease` — the parsed `<tree>/.git/.lane-lease`, or null when the file is absent/unreadable.
 *   `id`    — the item being certified (`--id`), when the caller has one.
 * @returns {{ok:boolean, reason:string, detail?:string}}
 */
export function laneTreeVerdict({ lease = null, id = null, requireItemMatch = true } = {}) {
  if (!lease) {
    return {
      ok: false,
      reason: 'no-lease',
      detail: 'the measured tree carries no lane lease (`.git/.lane-lease`), so it is not a leased lane clone — certifying it would measure the wrong tree and print success (#2900). Run the seam from inside the item\'s lane clone, or pass --lane=<lane clone path>.',
    };
  }
  const owner = leaseItem(lease);
  if (!requireItemMatch || id == null || String(id) === '') return { ok: true, reason: 'leased-lane' };
  if (owner == null) return { ok: true, reason: 'leased-lane-unnamed' };   // a lease with no item can't disagree
  if (String(owner) !== String(id)) {
    return {
      ok: false,
      reason: 'wrong-lane',
      detail: `the measured tree is the lane leased for #${owner}, but this seam is certifying #${id} — it would certify one item's tree as another's (#2900). Point --lane at #${id}'s own lane clone.`,
    };
  }
  return { ok: true, reason: 'leased-lane' };
}
