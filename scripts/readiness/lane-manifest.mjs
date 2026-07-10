/**
 * @file scripts/readiness/lane-manifest.mjs
 * @description Durable lane manifest — the per-item source of truth for #2138's deferred merge queue
 *   (Fork 2, ruled: option a). A standalone `.lane-manifest.json` written as a NEW file in the WE lane
 *   commit, carrying each queued item's cross-repo shape so the drain can land it in a LATER session.
 *
 * WHY (#2138 Fork 2): today an item's cross-repo shape — which repos' `lane/*` refs form it, the
 * impl-first/WE-last merge order, and `blockedBy` edges BETWEEN queued items — lives ONLY in the
 * orchestrator's in-run memory (`pushedRefs` on the item result, plus `INTEGRATION_ORDER`) and evaporates
 * when the producing session ends. A deferred drain runs in a DIFFERENT session, so it needs that shape
 * persisted. This manifest is a SUPERSET of the in-run `pushedRefs` array: it also carries cross-ITEM /
 * cross-SESSION `blockedBy` (do-not-drain-until #PRED lands) and the `mergeRiskFiles` list Fork 3's
 * whitelisted-additive check reads — data the run-scoped array never held.
 *
 * WHY A STANDALONE FILE (not a fenced block in `backlog/NNN.md`): a NEW file is a one-sided ADD, which
 * preserves the #1869 conflict-free WE-lane merge and keeps the manifest out of the resolve diff a human
 * reviews. The drain DELETES it at landing (co-located with the `lane/*` ref deletion) so `main` carries
 * no post-drain cruft.
 *
 * WHO WRITES/DELETES IT: the lane agent writes it into the WE lane commit at push; the drain reads every
 * queued item's manifest to order the merges and deletes each at landing. Those call-sites live in the
 * relocated push+land flow owned by the drain/monitor command (#2162) — THIS item ships the primitive
 * (build / validate / parse / serialize / order) + the reader the drain consumes. Pairs with the
 * ready-to-merge token (#2161): the token says WHICH items are queued, the manifest says HOW to land each.
 *
 * This module is PURE — no fs, no process, no `Date` reads. The CLI / drain owns the fs at its boundary.
 */
import { isHash } from '../backlog/id.mjs';

/** An item/edge id is a numeric NNN (landed) or an `xNNNNNN` hash (provisional, #2288) — keep a hash as a
 * string, coerce a number to Number (backward compat with pre-#2288 numeric manifests). */
const asItemId = (v) => (isHash(String(v)) ? String(v) : Number(v));
const isItemId = (v) => isHash(String(v)) || Number.isFinite(Number(v));

/** The manifest filename — a NEW file in the WE lane commit (one-sided add; drain deletes at landing). */
export const MANIFEST_FILENAME = '.lane-manifest.json';

/**
 * Merge order across the constellation (#96): impl repos first, WE last — WE carries the `active→resolved`
 * flip, so it lands only after every impl repo lands clean (a failed impl merge never leaves a false
 * `resolved`). Mirrors `INTEGRATION_ORDER` in the orchestrator; the drain (#2162) is the shared consumer.
 */
export const INTEGRATION_ORDER = ['frontierui', 'plateau-app', 'we'];

/** A repo's rank in {@link INTEGRATION_ORDER}; unknown repos sort AFTER known ones (stable, defensive). */
function orderRank(repo) {
  const i = INTEGRATION_ORDER.indexOf(repo);
  return i === -1 ? INTEGRATION_ORDER.length : i;
}

/**
 * Build a normalized manifest from an item's cross-repo shape. Repos are stored impl-first/WE-last so the
 * drain can merge them in order directly. `carriesResolve` marks the repo carrying the `active→resolved`
 * flip (always WE — the item + claims.json always live in WE); defaulted onto the `we` repo when omitted.
 * Pure — returns a plain object; run {@link validateManifest} for the invariants.
 *
 * @param {{item:number|string, batchSlug?:string, repos:Array<{repo:string, ref:string, carriesResolve?:boolean}>, blockedBy?:Array<number|string>, mergeRiskFiles?:string[]}} input
 */
export function buildManifest(input) {
  const item = asItemId(input.item); // NNN or provisional hash (#2288)
  const repos = (input.repos ?? [])
    .map((r) => ({
      repo: String(r.repo),
      ref: String(r.ref),
      // WE carries the resolve by default; honor an explicit flag otherwise.
      carriesResolve: r.carriesResolve != null ? !!r.carriesResolve : r.repo === 'we',
    }))
    .sort((a, b) => orderRank(a.repo) - orderRank(b.repo) || a.repo.localeCompare(b.repo));
  return {
    item,
    ...(input.batchSlug ? { batchSlug: String(input.batchSlug) } : {}),
    repos,
    blockedBy: (input.blockedBy ?? []).map(asItemId).filter(isItemId),
    mergeRiskFiles: (input.mergeRiskFiles ?? []).map((f) => String(f)),
    // #2171 — the count of pre-PR review findings the lane DISMISSED (#2170). The drain's escalation rubric
    // reads it as its strongest signal (a lane judging its own reviewer's findings away → a second look). 0 default.
    dismissedFindings: Number.isFinite(Number(input.dismissedFindings)) ? Math.max(0, Number(input.dismissedFindings)) : 0,
  };
}

/**
 * Validate a manifest's invariants. Returns `{ ok, errors }` (never throws) so the drain can surface a
 * malformed manifest as a skip-and-report rather than crashing the queue.
 *  - `item` is a finite number;
 *  - at least one repo, each with a `repo` + `ref`;
 *  - the WE repo is present (the item + claims.json + the resolve always live in WE);
 *  - EXACTLY ONE repo carries the resolve, and it is the WE repo (impl-first/WE-last atomicity).
 */
export function validateManifest(m) {
  const errors = [];
  if (!m || typeof m !== 'object') return { ok: false, errors: ['manifest is not an object'] };
  if (!isItemId(m.item)) errors.push('item must be a numeric NNN or an xNNNNNN hash');
  const repos = Array.isArray(m.repos) ? m.repos : [];
  if (repos.length === 0) errors.push('repos must be a non-empty array');
  for (const r of repos) {
    if (!r || !r.repo) errors.push('a repo entry is missing `repo`');
    else if (!r.ref) errors.push(`repo "${r.repo}" is missing its lane \`ref\``);
  }
  if (repos.length && !repos.some((r) => r.repo === 'we')) errors.push('the WE repo must be present (WE carries the resolve; the item + claims.json live in WE)');
  const carriers = repos.filter((r) => r.carriesResolve);
  if (repos.length && carriers.length !== 1) errors.push(`exactly one repo must carry the resolve (found ${carriers.length})`);
  else if (carriers.length === 1 && carriers[0].repo !== 'we') errors.push(`the resolve must be carried by WE, not "${carriers[0].repo}" (impl-first/WE-last)`);
  return { ok: errors.length === 0, errors };
}

/** Repos in merge order (impl-first, WE last) — the order the drain merges the item's `lane/*` refs. */
export function orderedRepos(m) {
  return [...(m?.repos ?? [])].sort((a, b) => orderRank(a.repo) - orderRank(b.repo) || a.repo.localeCompare(b.repo));
}

/** Tolerant parse of `.lane-manifest.json` text → a manifest object, or `null` on empty/invalid JSON. */
export function parseManifest(text) {
  if (!text || !text.trim()) return null;
  try {
    const raw = JSON.parse(text);
    return buildManifest(raw);
  } catch { return null; }
}

/**
 * PR-body carrier (xnsk54v) — the drain metadata belongs ON the PR, not committed into the tree. The lane
 * manifest rode `.lane-manifest.json` at the repo root, but every lane wrote the SAME path, so every open lane
 * PR conflicted with `main` there (#2198) — which forced the `rebase-drop-manifest` merge-fabrication step and
 * its per-pass merge-commit bloat. Since the producer already opens a ready-to-merge PR and the drain is the
 * ONLY consumer, the manifest lives in the PR body as a delimited fenced block instead: no tracked file, no
 * shared-path conflict, no rebase-drop. These helpers are the pure block writer/reader (the CLI/drain own gh).
 */
export const MANIFEST_BODY_BEGIN = '<!-- lane-manifest:begin -->';
export const MANIFEST_BODY_END = '<!-- lane-manifest:end -->';

/** The delimited PR-body block for a manifest — a human-visible fenced `json` payload between HTML-comment
 *  markers (the markers make extraction unambiguous even when a human edits the surrounding body). */
export function manifestBodyBlock(m) {
  const payload = JSON.stringify(m, null, 2);
  return `${MANIFEST_BODY_BEGIN}\n<details><summary>Lane manifest (drain metadata)</summary>\n\n\`\`\`json\n${payload}\n\`\`\`\n</details>\n${MANIFEST_BODY_END}`;
}

/** Embed (or REPLACE, idempotently) a manifest block in a PR body. A null/empty body yields just the block.
 *  Re-embedding on an already-carrying body swaps the block in place rather than appending a second one. */
export function embedManifestInBody(body, m) {
  const block = manifestBodyBlock(m);
  const base = body == null ? '' : String(body);
  const re = new RegExp(`${escapeRe(MANIFEST_BODY_BEGIN)}[\\s\\S]*?${escapeRe(MANIFEST_BODY_END)}`);
  if (re.test(base)) return base.replace(re, block);
  return base.trim() ? `${base.replace(/\s*$/, '')}\n\n${block}\n` : `${block}\n`;
}

/** Extract a manifest from a PR body's delimited block → a parsed manifest, or null (no block / bad JSON). */
export function extractManifestFromBody(body) {
  if (!body) return null;
  const re = new RegExp(`${escapeRe(MANIFEST_BODY_BEGIN)}([\\s\\S]*?)${escapeRe(MANIFEST_BODY_END)}`);
  const m = String(body).match(re);
  if (!m) return null;
  const fenced = m[1].match(/```(?:json)?\s*([\s\S]*?)```/);
  return parseManifest(fenced ? fenced[1] : m[1]);
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Serialize a manifest to `.lane-manifest.json` text (with a self-documenting `_doc` header). */
export function serializeManifest(m) {
  return JSON.stringify(
    {
      _doc:
        'Durable lane manifest for the #2138 deferred merge queue (Fork 2). A NEW file in the WE lane commit (one-sided add — preserves the #1869 conflict-free WE-lane merge, stays out of the resolve diff). Carries this queued item\'s cross-repo shape so a LATER drain session can land it: `repos` in impl-first/WE-last merge order (WE `carriesResolve`, lands last), cross-item `blockedBy` (do not drain until those land), and `mergeRiskFiles` for Fork 3\'s whitelisted-additive check. The drain DELETES this file at landing (co-located with the lane/* ref deletion). Written/deleted by the drain command (#2162); built/validated by this module (#2163). Pairs with the ready-to-merge token (#2161).',
      ...m,
    },
    null,
    2,
  ) + '\n';
}
