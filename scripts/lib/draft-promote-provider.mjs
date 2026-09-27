/**
 * @file scripts/lib/draft-promote-provider.mjs
 * @description THE PROVIDER PORT for the `promote-draft` effect (draft-first PRs, operator-approved
 *   2026-09-27) — the one `gh` call `scripts/operations/promote-draft-pr-dispatch.mjs` needs
 *   (`gh pr ready <pr>`), behind an injectable seam, mirroring `we:scripts/lib/forge-land-provider.mjs`'s own
 *   precedent (pure argv builder + injectable `exec`, so the exec itself is testable with no `gh` on PATH).
 *
 * WHY ITS OWN FILE, NOT A METHOD ON `forge-land-provider.mjs` — that port's own header declares itself the
 * SOLE ROUTE for `pr-land.mjs` only ("nothing outside `pr-land.mjs` should import this file directly").
 * `promote-draft-pr-dispatch.mjs` is a DIFFERENT mutating arc (the reconcile daemon un-drafting a PR, never
 * pr-land itself, which never merges or un-drafts anything post-open) — giving it a second, equally narrow
 * port keeps that sole-route invariant intact for both rather than widening `forge-land-provider.mjs`'s own.
 *
 * DEFAULT `exec` IS THROTTLED, same as `forge-land-provider.mjs` — `we:scripts/lib/gh-throttle.mjs#runGhSync`
 * gives this the shared concurrency cap + rate-limit backoff for free.
 *
 * IMPURE by construction in `createDraftPromoteProvider`; the module itself is pure.
 */

import { runGhSync } from './gh-throttle.mjs';

/** Build the `gh pr ready <pr>` args. Pure. `gh pr ready` is idempotent server-side — GitHub no-ops (never
 *  errors) a PR that is already non-draft, so this never needs a pre-check of its own. */
export function buildReadyArgs(pr) {
  return ['pr', 'ready', String(pr)];
}

/**
 * The `gh` provider for this one effect. `cwd` bound at construction (mirrors `createGhLandProvider`'s own
 * `cwd`-at-construction convention, for the identical reason: every call here relies on `gh` inferring the
 * repo from the git remote in `cwd`, never an explicit `--repo`).
 * @param {{cwd?: string, exec?: Function}} [o]
 */
export function createDraftPromoteProvider({
  cwd,
  exec = (args) => runGhSync(args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], throttle: { op: 'pr-ready' },
  }).trim(),
} = {}) {
  return {
    name: 'gh',
    /** Un-draft `pr`. Returns the (usually empty) trimmed stdout, same convention as every other read/write
     *  method on `forge-land-provider.mjs`'s port. */
    ready(pr) {
      return exec(buildReadyArgs(pr));
    },
  };
}
