/**
 * conflict-label.mjs — the `merge-status:conflicting` label constant, as its OWN leaf (#xkmu3gv).
 *
 * WHY A NEW LEAF AND NOT A DIRECT IMPORT OF `parked-pr-conflict-watch.mjs`. That file owns the value but pulls
 * in a wide, impure import graph (fs, child_process, `gh-throttle.mjs`, `dispatch-lane-io.mjs`, …) — exactly the
 * kind of pull-in `we:scripts/conveyor/advisory-round-count.mjs`'s own header warns against for
 * `we:scripts/conveyor/reconcile-core.mjs`, which is deliberately PURE and leaf-light (no fs, no clock, no
 * process, no network — see that file's own header). `reconcile-core.mjs` needs only the bare STRING (to tell a
 * mechanical conflict-resolution bounce apart from an ordinary reviewer-finding bounce, #xkmu3gv) — never the
 * watch's own detection/posting machinery — so this file holds just the constant, single-sourced, and
 * `parked-pr-conflict-watch.mjs` re-exports it unchanged so every existing importer keeps working with no edit.
 *
 * PURE. No imports, no fs, no clock, no process, no network — a true leaf.
 */

/** The informative, auto-managed label `we:scripts/conveyor/parked-pr-conflict-watch.mjs` owns exclusively —
 *  single-sourced here so `we:scripts/conveyor/reconcile-core.mjs` can read it with no heavier pull-in. */
export const CONFLICT_LABEL = 'merge-status:conflicting';

/** Provisioning metadata, mirrors `we:scripts/conveyor/review-status-tag.mjs`'s own `ensureLabel` call shape.
 *  `description` stays at or under GitHub's 100-char label-description cap (#xw0odtv). */
export const CONFLICT_LABEL_META = Object.freeze({
  color: 'B60205', // same red as `review:human` — this is also a "something needs a human" signal
  description: 'auto-managed: this review-parked PR has drifted into a real merge conflict — see #xw0odtv',
});
