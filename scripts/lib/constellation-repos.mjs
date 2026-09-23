/**
 * constellation-repos.mjs — the #96 constellation repo table, single-sourced (WE #2830 M3).
 *
 * A parked PR can live in any of the constellation repos. Two vocabularies name a repo and they are NOT the same:
 *   • the internal repo KEY — `we` / `frontierui` / `plateau-app` — used everywhere in-process (the ledger subject
 *     `${key}#${pr}`, the discovered-PR `repo` field, the review reporting).
 *   • the gh SLUG — `chalbert/web-everything` / `chalbert/frontierui` / `chalbert/plateau-app` — passed to `gh --repo`.
 * A tool that parses a `--repo=<slug>` flag but hard-codes the key (the #2830 review's M3 defect: `--repo=…frontierui`
 * read FrontierUI but emitted `repo: 'we'`, so the ledger subject pointed at an unrelated WE PR) crosses the two
 * silently. This module is the ONE mapping between them, so no consumer keeps its own key literal.
 *
 * `repoProfile`/`gateFor` (multi-repo slice 1, we:backlog/xjko7gy-multi-repo-slice-1-a-per-repo-profile.md, see
 * we:reports/2026-09-23-conveyor-multi-repo-gap-map.md) go one step further: they collapse the FIVE scattered
 * per-repo vocabularies (key, slug, slugTag, backlog scope prefix, `check-standards` locus marker) this file's own
 * consumers each re-derive today into ONE frozen profile per repo, so a future stage asks "what can this repo's
 * profile do" instead of re-deriving a repo fact inline. `capabilities` records TODAY'S truth (`we` alone has a fix
 * loop and a CI heal) — a later slice flips `frontierui`/`plateau-app` on as their own gates come online; nothing
 * here should be read as a permanent limitation.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { composeGate } from './verify-lane-gate.mjs';

/** The constellation repos, keyed by internal repo KEY. `slug` is the gh `--repo` slug; `path` is the checkout
 *  (empty = the WE primary's own cwd); `dirs` are the directory basenames that checkout is known to occupy —
 *  WE answers to two (the laptop's `webeverything` and the clone-from-slug `web-everything`), which is why a
 *  caller must never derive a key from a basename by hand. Frozen — the single source both the convergence
 *  workflow and the scheduled runner read (never a second copy). */
export const CONSTELLATION_REPOS = Object.freeze({
  we: { slug: 'chalbert/web-everything', slugTag: '', path: '', dirs: ['web-everything', 'webeverything'] },
  frontierui: { slug: 'chalbert/frontierui', slugTag: 'fui', path: '$HOME/workspace/frontierui', dirs: ['frontierui'] },
  'plateau-app': { slug: 'chalbert/plateau-app', slugTag: 'pa', path: '$HOME/workspace/plateau-app', dirs: ['plateau-app'] },
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

/** Session tag for a known repo key, or null. */
export function repoSlugTag(key) {
  return Object.hasOwn(CONSTELLATION_REPOS, key) ? CONSTELLATION_REPOS[key].slugTag : null;
}

/** Untagged sessions belong to WE. */
export function repoKeyForSlugTag(tag = '') {
  return Object.entries(CONSTELLATION_REPOS).find(([, meta]) => meta.slugTag === tag)?.[0] ?? null;
}

// ── repoProfile / gateFor (multi-repo slice 1) ──────────────────────────────────────────────────────

// This module's OWN checkout root — the `we` entry's `path: ''` means "wherever this file is physically
// checked out" (the primary checkout or a lane clone of it), never a fixed location. Computed once from
// `import.meta.url` rather than `process.cwd()` so it is right even when this module is `import`-ed from a
// caller running elsewhere (mirrors the `REPO_ROOT` convention every `scripts/operations/*-io.mjs` shell uses).
const WE_CHECKOUT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The backlog-scope / `check-standards` locus-marker prefixes that mean each repo (`LOCUS_MARKER_RE` and the
// `LOCI` table in we:scripts/check-standards-rules.mjs): the short tag, plus the repo's full name.
const SCOPE_PREFIXES = Object.freeze({
  we: Object.freeze(['we', 'webeverything']),
  frontierui: Object.freeze(['fui', 'frontierui']),
  'plateau-app': Object.freeze(['plateau', 'plateau-app']),
});

// The prefix each repo's own backlog cards actually write today (grepped `backlog/*.md`, 2026-09-23):
// `we:` 31513 vs `webeverything:` 5; `fui:` 4147 vs `frontierui:` 281; `plateau:` 1667 vs `plateau-app:` 1436.
const CANONICAL_PREFIX = Object.freeze({ we: 'we', frontierui: 'fui', 'plateau-app': 'plateau' });

// TODAY'S truth (#3919-adjacent): only `we` has a fix loop and a CI-heal path; the couple-repos have neither yet
// — a later multi-repo slice flips these as their own gates come online. `review` is true everywhere already.
const CAPABILITIES = Object.freeze({
  we: Object.freeze({ review: true, fix: true, ciHeal: true, build: 'direct' }),
  frontierui: Object.freeze({ review: true, fix: false, ciHeal: false, build: 'couple' }),
  'plateau-app': Object.freeze({ review: true, fix: false, ciHeal: false, build: 'couple' }),
});

// A scope prefix or full name that is not already a key/slug/slugTag (those are covered by `repoKeyForSlug` /
// `slugTag` lookups below) — the remaining aliases `SCOPE_PREFIXES` introduces.
const PREFIX_ALIASES = Object.freeze({ webeverything: 'we', fui: 'frontierui', plateau: 'plateau-app' });

/**
 * Resolve ANY of the vocabularies `repoProfile`/`gateFor` accept to an internal repo KEY, or `null` for anything
 * unrecognized. Never throws. PURE.
 * @param {unknown} input
 * @returns {string|null}
 */
function resolveProfileKey(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const stripped = raw.endsWith(':') ? raw.slice(0, -1) : raw;
  if (!stripped) return null;
  const bySlugOrKey = repoKeyForSlug(stripped);
  if (bySlugOrKey !== null) return bySlugOrKey;
  for (const [key, meta] of Object.entries(CONSTELLATION_REPOS)) {
    if (meta.slugTag && meta.slugTag === stripped) return key;
  }
  return Object.hasOwn(PREFIX_ALIASES, stripped) ? PREFIX_ALIASES[stripped] : null;
}

/**
 * The ONE per-repo profile — key, slug, slugTag, the expanded checkout path, what `lane-pool.mjs --repo=`
 * expects, every backlog-scope/locus prefix that means this repo, the dominant one to WRITE, and today's
 * capabilities. Accepts a repo key (`we`/`frontierui`/`plateau-app`), a gh slug (`chalbert/plateau-app`), a
 * slug tag (`fui`/`pa`), or a scope prefix (`we`/`fui`/`frontierui`/`plateau`/`plateau-app`), with or without a
 * trailing `:`. Returns `null` for anything unrecognized — NEVER throws. Frozen. PURE given `home`.
 *
 * `lanePoolRepo` matches `scripts/operations/review-dispatch.mjs#planReviewDispatch`'s own derivation exactly
 * (the one this function replaces there): `we` is the literal `'.'` (lane-pool.mjs's own cwd-toplevel default —
 * NOT `null`; this value is interpolated straight into a brief's `--repo=${laneRepo}`, so it must be a real,
 * shell-safe token), every sibling repo is its absolute, `$HOME`-expanded checkout path.
 * @param {unknown} keyOrSlugOrPrefix
 * @param {{home?: string}} [o] - `home` is injectable (mirrors `planReviewDispatch`'s own `home` param) so a
 *   test can resolve a sibling checkout path without touching the real `$HOME`.
 * @returns {{
 *   key: string, slug: string, slugTag: string, checkoutPath: string, lanePoolRepo: string,
 *   scopePrefixes: string[], canonicalPrefix: string,
 *   capabilities: {review: boolean, fix: boolean, ciHeal: boolean, build: 'couple'|'direct'},
 * }|null}
 */
export function repoProfile(keyOrSlugOrPrefix, { home = homedir() } = {}) {
  const key = resolveProfileKey(keyOrSlugOrPrefix);
  if (key === null) return null;
  const meta = CONSTELLATION_REPOS[key];
  const checkoutPath = key === 'we' ? WE_CHECKOUT_ROOT : resolve(meta.path.replace(/^\$HOME(?=\/|$)/, home));
  const lanePoolRepo = key === 'we' ? '.' : checkoutPath;
  return Object.freeze({
    key,
    slug: meta.slug,
    slugTag: meta.slugTag,
    checkoutPath,
    lanePoolRepo,
    scopePrefixes: SCOPE_PREFIXES[key],
    canonicalPrefix: CANONICAL_PREFIX[key],
    capabilities: CAPABILITIES[key],
  });
}

/**
 * The gate command for a constellation repo, reusing `verify-lane-gate.mjs#composeGate` against the profile's
 * `checkoutPath` — never a second gate-derivation. `composeGate` itself is pure; the only IO here is checking the
 * checkout exists and reading its `package.json` for the npm script names it actually has (mirrors
 * `scripts/verify-lane.mjs#readCheckoutScripts`), both injectable so a test never touches the real filesystem.
 * Returns `null` when the profile is unknown OR the checkout does not exist (never throws).
 * @param {unknown} keyOrSlugOrPrefix
 * @param {{home?: string, checkoutExists?: (p: string) => boolean, readPackageJson?: (p: string) => string}} [o]
 * @returns {string|null}
 */
export function gateFor(keyOrSlugOrPrefix, { home, checkoutExists = existsSync, readPackageJson = (p) => readFileSync(p, 'utf8') } = {}) {
  const profile = repoProfile(keyOrSlugOrPrefix, { home });
  if (!profile) return null;
  if (!checkoutExists(profile.checkoutPath)) return null;
  let scripts;
  try {
    scripts = Object.keys(JSON.parse(readPackageJson(join(profile.checkoutPath, 'package.json'))).scripts || {});
  } catch {
    scripts = undefined;
  }
  return composeGate({ vitestCmd: 'npm run test:unit', checkStandardsCmd: 'npm run check:standards', scripts }).command;
}
