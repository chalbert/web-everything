/**
 * lane-page-proxy.mjs — pure resolution logic for the #2139 lane page-proxy.
 *
 * While a backlog item is worked in an isolated lane clone (#1933), its latest card render lives on
 * that lane's offset-port dev server (#1997 deterministic bands) — not on the primary checkout's
 * `:3000`. The primary Vite server (vite.config.mts `lanePageProxy` plugin) keeps port 3000 the single
 * review URL by forwarding `/backlog/<NNN>…/` requests to the lane that owns the item, per a small
 * registry file maintained by `scripts/lane-pool.mjs map|unmap` (written at dispatch, cleared on
 * lane remove/refresh).
 *
 * This module is the PURE half (registry parse + URL→target resolution) so it can be unit-tested;
 * all fs/http stays in the Vite plugin and lane-pool CLI.
 */

/** Registry location, relative to the primary checkout root. Ephemeral dev state — git-ignored. */
export const LANE_PORTS_REGISTRY = '.claude/lane-ports.json';

/**
 * Tolerant parse of the registry file's text: `{ "<NNN>": { port, lane, repo } }`.
 * Missing file (null/undefined text), invalid JSON, or a non-object root all resolve to
 * "no mappings" — the proxy must never break the main server.
 */
export function parseRegistry(text) {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const entries = {};
    for (const [num, entry] of Object.entries(parsed)) {
      if (!/^\d+$/.test(num)) continue;
      if (!entry || typeof entry !== 'object' || !Number.isInteger(entry.port)) continue;
      entries[num] = entry;
    }
    return entries;
  } catch {
    return {};
  }
}

/**
 * Resolve a request path to a lane target, or null to fall through to the normal 11ty proxy.
 * Matches any path under a backlog item page — `/backlog/2138/`, `/backlog/2138-some-slug/`,
 * and their sub-paths — keyed by the leading item number. Non-item backlog paths (`/backlog/`,
 * the index) and unmapped items resolve null.
 */
export function resolveLaneTarget(urlPath, registry) {
  if (!urlPath || !registry) return null;
  const match = /^\/backlog\/(\d+)(?:-[^/]*)?(?:\/|$)/.exec(urlPath.split('?')[0]);
  if (!match) return null;
  const num = String(Number(match[1])); // normalize zero-padded ids (#042 → 42 keys both ways below)
  const entry = registry[match[1]] ?? registry[num];
  if (!entry) return null;
  return { num: match[1], port: entry.port, lane: entry.lane };
}
