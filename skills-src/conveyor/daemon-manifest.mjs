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

/** @type {Record<string, DaemonManifestEntry>} */
export const DAEMON_MANIFEST = {
  // Populated by later daemon-launcher slices (#3873, #3874, …) — see the file header. Deliberately empty here.
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
