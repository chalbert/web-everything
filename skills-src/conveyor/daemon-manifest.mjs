/**
 * @file skills-src/conveyor/daemon-manifest.mjs
 * @description #3871 (epic #3383) — the CLOSED ALLOWLIST {@link ../pass-daemon.mjs} resolves every launch
 *   through. `pass-daemon.mjs` never takes a raw script path from its own CLI flags — it takes a `--pass=<name>`
 *   and looks `name` up here. A name not registered here refuses, loudly, before anything spawns. This is the
 *   one thing every daemon launcher in this epic shares (the watcher-wiring slice #3873, the Supervisor
 *   manifest launcher #3874) — a single file naming every script this epic's daemons may ever start.
 *
 * STARTS EMPTY, BY DESIGN. This item builds the MECHANISM only — it introduces no changes to any existing
 * pass script, and registers none of them. #3873 (wiring the 8 watcher passes) and any later daemon-launcher
 * slice are what actually populate {@link DAEMON_MANIFEST}; each does so by editing THIS file, never by
 * teaching `pass-daemon.mjs` a new way to resolve a path. The mechanism is proven here with fixture entries
 * (see the test file), not real ones — a real entry is a one-line addition once its slice lands.
 *
 * @typedef {{ script: string, args?: string[], intervalMs: number }} DaemonManifestEntry
 *   - `script`: repo-relative path to the pass's own CLI entry point (e.g.
 *     `'scripts/conveyor/branch-drift.mjs'`), resolved against the repo root at spawn time — never absolute,
 *     never containing `..` (validated below).
 *   - `args`: the fixed argv this entry always spawns with (e.g. `['sweep']`) — not user-suppliable at launch
 *     time, so a manifest entry is a complete, reviewed launch spec, not a template.
 *   - `intervalMs`: how often {@link ../pass-daemon.mjs} re-runs this pass after each run completes.
 */

import { CONSTELLATION_REPOS } from '../../scripts/lib/constellation-repos.mjs';

/** Every mechanical pass ran at this same cadence as one of `runner.mjs`'s own `makeCliMechanicalPasses`
 *  steps — unchanged here, since #3873 wires the SAME passes onto standalone daemons, not a redesign of how
 *  often they run. */
const DEFAULT_PASS_INTERVAL_MS = 120_000;

/**
 * #3873 — one manifest entry per (repo-generic pass × constellation repo), matching exactly what
 * `runner.mjs`'s own per-repo loop already does today (`run(path, args, key, slug)` appends `--repo=${slug}`
 * for every repo in `CONSTELLATION_REPOS`). A single WE-only entry per pass here would have silently
 * narrowed each one's real coverage from three repos down to one — the exact class of bug just live-caught
 * and fixed in `we:skills-src/conveyor/review-daemon.mjs` (#xvyuwtg, plateau-app PR #167 sat unwatched
 * because ITS daemon never asked any repo but WE). Named `<passName>-<repoKey>` (e.g. `ci-queue-watch-we`,
 * `ci-queue-watch-plateau-app`) so each repo's sweep is its own independently-launchable, independently-leased
 * pass-daemon process — consistent with this whole epic's "many small independent daemons" shape, not a
 * special case.
 * @param {string} passName
 * @param {string} script
 * @param {string[]} args
 * @returns {Record<string, DaemonManifestEntry>}
 */
function perRepoEntries(passName, script, args) {
  const out = {};
  for (const [key, { slug }] of Object.entries(CONSTELLATION_REPOS)) {
    out[`${passName}-${key}`] = { script, args: [...args, `--repo=${slug}`], intervalMs: DEFAULT_PASS_INTERVAL_MS };
  }
  return out;
}

/**
 * #3873 (epic #3383) — the 8 watcher passes named in that card's scope, wired onto `pass-daemon.mjs`.
 *
 * ONE NAMED SCRIPT DOES NOT EXIST ON `main`: `poc-branch-sync.mjs`. Confirmed by direct read (no such file
 * under `scripts/conveyor/`, and no reference to it anywhere in the tree outside a stray, unrelated
 * `.git/poc-branch-sync` ref) — a false premise carried into the card's scope, corrected here rather than
 * invented from scratch (inventing a new pass's own logic is a different, much bigger task than "wire an
 * existing pass"). The other 7 are real and wired below.
 *
 * THREE stay WE-only, genuinely — not a coverage gap, a real invariant of each:
 *   - `branch-drift.mjs` / `infra-blocked.mjs` — neither script HAS a `--repo` flag at all (confirmed by
 *     direct read); both monitor WE-specific concepts (the WE mechanical-dispatcher branch; WE backlog
 *     infra holds) with no cross-repo equivalent to watch.
 *   - `duplicate-pr-watch.mjs` — DOES accept `--repo`, but `runner.mjs`'s own comment states why it is never
 *     called with one: "duplicate item numbers refer to WE backlog ids, not cross-repo deliveries." Using it
 *     cross-repo would be semantically wrong, not merely unbuilt.
 *
 * FOUR are wired per-repo via {@link perRepoEntries}, matching their own real, already-cross-repo behavior
 * in `runner.mjs` today: `ci-queue-watch.mjs`, `parked-pr-conflict-watch.mjs`, `parked-pr-progress-watch.mjs`,
 * `lane-pool-health-watch.mjs` (the last of these matters concretely: plateau-app's own lane pool has no
 * health-watch coverage today precisely because nothing runs this pass against it — live-caught 2026-09-22
 * investigating why plateau-app PR #167 couldn't get a review lane).
 *
 * `runner.mjs`'s own `makeCliMechanicalPasses` still runs all 7 scripts inline, unchanged, in this same PR —
 * per the card's own "drop each from runner.mjs's own mechanicalPasses list AS IT BAKES" (a rolling,
 * pass-by-pass cutover, the same discipline #3870/#3876 already followed): standing up a daemon here does
 * not yet retire the old runner's own copy of the same sweep.
 */
/**
 * #3913 — the orphaned-claim release pass runs far less often than the watchers: it acts on cards idle for
 * over 48 h and each writing run opens a PR, so a 6-hour cadence loses nothing and keeps the PR rate low. It
 * never stacks PRs — a run that sees its own previous PR still open writes nothing.
 */
const ORPHAN_CLAIM_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const DAEMON_MANIFEST = {
  'orphan-claim-release': { script: 'scripts/conveyor/orphan-claim-release.mjs', args: ['--apply'], intervalMs: ORPHAN_CLAIM_INTERVAL_MS },
  'branch-drift': { script: 'scripts/conveyor/branch-drift.mjs', args: ['sweep'], intervalMs: DEFAULT_PASS_INTERVAL_MS },
  'infra-blocked': { script: 'scripts/conveyor/infra-blocked.mjs', args: ['retry'], intervalMs: DEFAULT_PASS_INTERVAL_MS },
  'duplicate-pr-watch': { script: 'scripts/conveyor/duplicate-pr-watch.mjs', args: ['sweep'], intervalMs: DEFAULT_PASS_INTERVAL_MS },
  ...perRepoEntries('ci-queue-watch', 'scripts/conveyor/ci-queue-watch.mjs', ['sweep']),
  ...perRepoEntries('parked-pr-conflict-watch', 'scripts/conveyor/parked-pr-conflict-watch.mjs', ['sweep']),
  ...perRepoEntries('parked-pr-progress-watch', 'scripts/conveyor/parked-pr-progress-watch.mjs', ['sweep']),
  ...perRepoEntries('lane-pool-health-watch', 'scripts/conveyor/lane-pool-health-watch.mjs', []),
};

/** A script path may be `undefined` is never intended; it must be a plain repo-relative path with no `..`
 *  traversal and no leading `/` — the same shape every `we:` locus-prefixed reference in this repo already
 *  uses, checked here as CODE (not just convention) since this is the one gate standing between a manifest
 *  entry and a real spawn. */
export function isSafeManifestScriptPath(script) {
  return typeof script === 'string' && script.length > 0
    && !script.startsWith('/') && !script.includes('..') && !script.includes('\0');
}

/** Validate one manifest entry's shape. Pure — throws with a specific reason rather than returning a bool,
 *  so a malformed entry (a typo'd field, a negative interval) fails LOUDLY at registration time, never
 *  silently at first spawn. */
export function assertValidManifestEntry(name, entry) {
  if (!entry || typeof entry !== 'object') throw new TypeError(`daemon-manifest: entry "${name}" is not an object`);
  if (!isSafeManifestScriptPath(entry.script)) {
    throw new TypeError(`daemon-manifest: entry "${name}"'s script must be a repo-relative path with no ".." or leading "/" (got ${JSON.stringify(entry.script)})`);
  }
  if (entry.args !== undefined && (!Array.isArray(entry.args) || !entry.args.every((a) => typeof a === 'string'))) {
    throw new TypeError(`daemon-manifest: entry "${name}"'s args must be an array of strings`);
  }
  if (!Number.isFinite(entry.intervalMs) || entry.intervalMs <= 0) {
    throw new TypeError(`daemon-manifest: entry "${name}"'s intervalMs must be a positive number (got ${JSON.stringify(entry.intervalMs)})`);
  }
  return entry;
}

/**
 * THE closed-allowlist lookup — the one function {@link ../pass-daemon.mjs} calls to turn a `--pass=<name>`
 * flag into a real, spawnable entry. Refuses (never returns a made-up default) for any `name` not registered,
 * naming every currently-known entry in the refusal so a typo is obvious. Re-validates the entry on every
 * lookup (not just at author time) — cheap, and it means a manifest that somehow got corrupted on disk still
 * fails closed rather than spawning something malformed.
 * @param {string} name
 * @param {Record<string, DaemonManifestEntry>} [manifest]
 * @returns {DaemonManifestEntry}
 */
export function resolveManifestEntry(name, manifest = DAEMON_MANIFEST) {
  const entry = manifest[name];
  if (!entry) {
    const known = Object.keys(manifest).sort();
    throw new Error(
      `pass-daemon: "${name}" is not in the daemon manifest — pass-daemon never takes a raw script path. `
      + (known.length ? `Known entries: ${known.join(', ')}.` : 'No entries are registered yet.'),
    );
  }
  return assertValidManifestEntry(name, entry);
}
