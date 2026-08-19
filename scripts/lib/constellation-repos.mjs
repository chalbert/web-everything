/**
 * constellation-repos.mjs — the #96 constellation repo table, single-sourced (WE #2830 M3).
 *
 * A parked PR can live in any of the constellation repos. Two vocabularies name a repo and they are NOT the same:
 *   • the internal repo KEY — `we` / `frontierui` / `plateau-app` — used everywhere in-process (the ledger subject
 *     `${key}#${pr}`, the discovered-PR `repo` field, the review reporting).
 *   • the gh SLUG — `chalbert/web-everything` / `frontierui` / `plateau-app` — passed to `gh --repo`.
 * A tool that parses a `--repo=<slug>` flag but hard-codes the key (the #2830 review's M3 defect: `--repo=…frontierui`
 * read FrontierUI but emitted `repo: 'we'`, so the ledger subject pointed at an unrelated WE PR) crosses the two
 * silently. This module is the ONE mapping between them, so no consumer keeps its own key literal.
 */

/** The constellation repos, keyed by internal repo KEY. `slug` is the gh `--repo` slug; `path` is the checkout
 *  (empty = the WE primary's own cwd); `dirs` are the directory basenames that checkout is known to occupy —
 *  WE answers to two (the laptop's `webeverything` and the clone-from-slug `web-everything`), which is why a
 *  caller must never derive a key from a basename by hand. Frozen — the single source both the convergence
 *  workflow and the scheduled runner read (never a second copy). */
export const CONSTELLATION_REPOS = Object.freeze({
  we: { slug: 'chalbert/web-everything', path: '', dirs: ['web-everything', 'webeverything'] },
  frontierui: { slug: 'frontierui', path: '$HOME/workspace/frontierui', dirs: ['frontierui'] },
  'plateau-app': { slug: 'plateau-app', path: '$HOME/workspace/plateau-app', dirs: ['plateau-app'] },
});

/**
 * The default repo key when none is named — the WE primary.
 *
 * PROVISIONAL, and the seam to pull when it stops being true. `path: ''` above encodes the same assumption
 * structurally: WE is the hub every other checkout is located relative to. That is an artefact of where the
 * orchestration happens to live today, not a property of the constellation — WE is a PUBLIC peer, and the
 * lane/delivery machinery is Plateau's product. A consumer that wants to survive that move must ask which
 * repo it is IN (`repoKeyForDir`) rather than assume this default.
 */
export const DEFAULT_REPO_KEY = 'we';

/**
 * Map a checkout's directory BASENAME to its internal repo KEY. Returns `null` for an unknown directory —
 * fail-closed, never a silent fall back to `we` (the M3 bug, one level up). PURE.
 * @param {string} dirName
 * @returns {string|null}
 */
export function repoKeyForDir(dirName) {
  const v = String(dirName || '');
  if (!v) return null;
  for (const [key, meta] of Object.entries(CONSTELLATION_REPOS)) {
    if (meta.dirs.includes(v)) return key;
  }
  return null;
}

/**
 * The other constellation repos, given the one you are in. Returns every key when `selfKey` is unknown, so a
 * caller in an unrecognised checkout reports the whole constellation rather than a confidently wrong subset.
 * PURE.
 * @param {string|null} selfKey
 * @returns {string[]}
 */
export function siblingKeys(selfKey) {
  return Object.keys(CONSTELLATION_REPOS).filter((k) => k !== selfKey);
}

/**
 * Map a `gh` slug (or an already-internal key) to its internal repo KEY. Accepts either vocabulary so a caller can
 * pass whatever `--repo` carried. Returns `null` for an unknown value — the caller decides (fail-closed: never
 * silently fall back to `we`, the exact M3 bug). PURE.
 * @param {string} slugOrKey
 * @returns {string|null}
 */
export function repoKeyForSlug(slugOrKey) {
  const v = String(slugOrKey || '');
  if (!v) return null;
  for (const [key, meta] of Object.entries(CONSTELLATION_REPOS)) {
    if (key === v || meta.slug === v) return key;
  }
  return null;
}
