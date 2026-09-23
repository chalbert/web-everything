/**
 * @file scripts/lib/repo-profile.mjs
 * @description `repoProfile`/`gateFor` — multi-repo slice 1 (we:backlog/xjko7gy-multi-repo-slice-1-a-per-repo-
 *   profile.md, see we:reports/2026-09-23-conveyor-multi-repo-gap-map.md). Collapses the FIVE scattered per-repo
 *   vocabularies (internal key, gh slug, slug tag, backlog scope prefix, `check-standards` locus marker) each
 *   consumer re-derives today into ONE frozen profile per repo, and gives every repo ONE gate-command source.
 *
 * WHY A SEPARATE FILE FROM `./constellation-repos.mjs`, NOT ADDED THERE (this item's own scope names that file;
 * this is the deviation, and the reason). Several operations declared READ-ONLY — `gate-health-io.mjs`,
 * `operator-queue.mjs`'s `dispatch-eligibility.mjs` chain — already import `constellation-repos.mjs` for its
 * plain data table, and a STATIC import-graph guard (`scripts/operations/__tests__/{gate-health,http-adapter}
 * .test.mjs`, using `__tests__/import-graph.mjs`) asserts their whole module graph reaches ZERO `node:` built-ins.
 * `gateFor` needs real IO — `verify-lane-gate.mjs#composeGate`, `homedir()`, a checkout's `package.json` — to do
 * its job; adding it to `constellation-repos.mjs` would hand every one of those read-only consumers a transitive
 * IO capability they are asserted never to have (confirmed live: doing so tripped both guards, plus a THIRD,
 * unrelated-looking failure — `operator-queue-entry.test.mjs`'s symlink tests — because that suite stages a
 * synthetic checkout containing only the files `operator-queue.mjs` is KNOWN to need, and a new static import
 * of `verify-lane-gate.mjs` from `constellation-repos.mjs` is a file that synthetic checkout never staged, so the
 * child process crashed on a missing module). Splitting the file is a smaller, safer change than teaching three
 * unrelated tests about a dependency they exist to keep out. `CONSTELLATION_REPOS`/`repoKeyForSlug` are imported
 * FROM `constellation-repos.mjs` (still the one source of the table itself); this file is never imported BACK
 * from there — a re-export would be its own `from`-clause and the same static scanner would still follow it,
 * defeating the split.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONSTELLATION_REPOS, repoKeyForSlug } from './constellation-repos.mjs';
import { composeGate } from './verify-lane-gate.mjs';

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

// TODAY'S truth. `review` is true everywhere already; multi-repo slice 5 (`we:backlog/3966-*.md`) turns `fix` on
// for the couple-repos too — `reconcile-fix-dispatch.mjs#runReconcileFixDispatch` now dispatches a real fix agent
// for frontierui/plateau-app rather than recording `unsupported-repo`. `ciHeal` stays off for the couple-repos —
// CI-heal is its own capability/stage (slice 7) and turns on independently of `fix`.
const CAPABILITIES = Object.freeze({
  we: Object.freeze({ review: true, fix: true, ciHeal: true, build: 'direct' }),
  frontierui: Object.freeze({ review: true, fix: true, ciHeal: false, build: 'couple' }),
  'plateau-app': Object.freeze({ review: true, fix: true, ciHeal: false, build: 'couple' }),
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

/**
 * The FIVE `{{REPO}}`/`{{LANE_REPO}}`/`{{GATE_COMMAND}}`/`{{WE_ROOT}}`/`{{ATTRIBUTION}}` conveyor-brief
 * placeholders (multi-repo slice 4, `we:backlog/3960-*.md`) computed together from ONE profile, so
 * `dispatchFix`/`dispatchCiHeal` (`we:scripts/conveyor/reconcile-fix-dispatch.mjs`,
 * `we:scripts/operations/ci-heal-pr-dispatch.mjs`) never re-derive any of them a second, possibly-diverging way.
 *
 * `WE_ROOT` is ALWAYS this checkout's own root, regardless of which repo is being profiled — the tools a
 * fix/ci-heal brief runs (`rearm-review.mjs`, `stand-down.mjs`, `ci-heal-mark.mjs`, `lane-pool.mjs`, …) live only
 * in WE, never in the target repo, so a brief needs WE's location even when repairing a sibling repo's PR.
 *
 * `ATTRIBUTION` folds in the item/PR-only distinction the gap-map's "Proposed design C"
 * (`we:reports/2026-09-23-conveyor-multi-repo-gap-map.md`) names for a future item-less fix (slice 6, not wired
 * yet): an item-carrying dispatch (today, every fix/ci-heal) is `<REPO-TAG> #<item>` — `profile.canonicalPrefix`
 * upper-cased, so for `we` this is `WE #<item>`, reproducing the commit-title prefix both briefs hardcoded
 * before this slice, byte-for-byte; a PR with no backlog item is `PR #<pr>`.
 *
 * Returns `null` when the profile is unknown OR its gate is unresolvable (mirrors {@link gateFor}'s own
 * fail-closed shape) — the caller decides what that means. As of multi-repo slice 5, `dispatchFix` reaches this
 * for frontierui/plateau-app too (their `capabilities.fix` is now true — see `runReconcileFixDispatch`'s own
 * capability check); `ci-heal` still only ever reaches this for `we` (its capability stays off elsewhere until
 * slice 7). WE's own checkout always resolves, so the `null` branch there is exercised only by tests.
 * @param {unknown} keyOrSlugOrPrefix
 * @param {{itemNum?: (string|number|null), prNum?: (string|number|null), home?: string,
 *   checkoutExists?: (p: string) => boolean, readPackageJson?: (p: string) => string}} [o] - `itemNum`/`prNum`
 *   feed `ATTRIBUTION` only; `home`/`checkoutExists`/`readPackageJson` are injectable exactly as
 *   {@link repoProfile}/{@link gateFor} take them (so a test can resolve a sibling repo's tokens without
 *   touching the real filesystem).
 * @returns {{REPO: string, LANE_REPO: string, GATE_COMMAND: string, WE_ROOT: string, ATTRIBUTION: string}|null}
 */
export function briefTokensForRepo(keyOrSlugOrPrefix, { itemNum = null, prNum = null, home, checkoutExists, readPackageJson } = {}) {
  const profile = repoProfile(keyOrSlugOrPrefix, { home });
  if (!profile) return null;
  const gateCommand = gateFor(keyOrSlugOrPrefix, { home, checkoutExists, readPackageJson });
  if (!gateCommand) return null;
  const item = itemNum === null || itemNum === undefined || String(itemNum).trim() === '' ? null : String(itemNum).trim();
  const attribution = item ? `${profile.canonicalPrefix.toUpperCase()} #${item}` : `PR #${prNum}`;
  return Object.freeze({
    REPO: profile.slug,
    LANE_REPO: profile.lanePoolRepo,
    GATE_COMMAND: gateCommand,
    WE_ROOT: WE_CHECKOUT_ROOT,
    ATTRIBUTION: attribution,
  });
}
