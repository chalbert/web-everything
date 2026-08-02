/**
 * citation-check.mjs — pure, testable core for the CITATION-VERIFICATION gate family (backlog #2821).
 *
 * The unifying root class these rules hook is "a reference asserted without resolving it against the
 * source it points at" (#2821). The #957 ratification review bounced six times, and the most expensive
 * miss — 11 occurrences across the item, the statute, and two rendered research files that six review
 * rounds never caught — was an *anchor-ruling* mis-attribution: a platform-decisions `#anchor` whose
 * governing decision is `#2398` was attributed to `#2439` (a real, topically-plausible build slice, so a
 * plausibility check passes while the authority is wrong). Resolving a citation against its target is
 * exactly what a machine does better than a reviewer (#51 hookable-vs-judgment), so it becomes a gate.
 *
 * This module is I/O-free: every filesystem fact (does the file exist? how many lines? what does the
 * codifiedIn front-matter say?) is injected by the caller (`check-standards.mjs`), so each rule is
 * exercisable with synthetic fixtures (see scripts/__tests__/citation-check.test.mjs). It delivers the
 * proven subset of #2821 — the three deterministic checks whose real instances the #957 bounce proved:
 *
 *   • findAnchorRulingMismatches — gate "anchor-authority resolution" (#2821 gate 10, the 11-vs-1 core).
 *   • findDanglingLoci           — gate 5 (`we:<path>:<line>` must resolve to a real file + in-range line).
 *   • findOutOfScopeHashSlugs    — gate 3 (a `xNNNNNN` hash-slug cited outside the at-land rewrite scope).
 *
 * #2821 stays OPEN — the ratify-gate (1a/1b), the `#NNN`-plausibility / PR-number check (gate 2), the
 * symbol-anchor convention (gate 6), and the declarative-leash / ruled-not-implemented markers (gates
 * 8/9) are not in this subset.
 */

// ── Enforcement level. The gate ships at WARN, not ERROR (#2821 "don't break the gate on the existing
// corpus"): a whole-repo scan surfaces ~39 anchor-ruling co-citations, ~429 drifted `we:<path>:<line>`
// loci, and ~85 out-of-scope hash-slugs — all in HISTORICAL reports/research authored before the gate
// existed, most legitimate-at-the-time or long-since-relocated. Red-erroring them would block every
// batch on content no one is touching. Warn surfaces each finding (and `--scope` attributes a SESSION's
// own new bad cite to that session), while a corpus cleanup drains the backlog of historical hits. Flip
// this to `true` — promoting all three to hard `check:standards` errors — once that scan reads clean.
// TODO(#2821): promote CITATION_GATES_ENFORCED → true after the historical corpus is triaged to zero.
export const CITATION_GATES_ENFORCED = false;

// ── The at-land hash→NNN rewrite scope. numberPendingHashes (we:scripts/lane-drain.mjs#numberPendingHashes),
// via the numbering brain applyLedger (we:scripts/backlog/id.mjs#applyLedger), rewrites hash→NNN only in
// these two dirs. A hash slug cited from anywhere else never self-heals → dead link post-land (#2821 gate 3).
export const HASH_REWRITE_DIRS = ['backlog/', 'docs/agent/'];

// The dirs the rewriter does NOT cover but where a hash-slug citation still renders / is cite-able.
// Same set as DERIVED_ARTIFACT_DIRS in check-standards-rules.mjs (#2180) — kept as its own constant so the
// gate-3 scope is legible at the call site.
export const HASH_SLUG_OUT_OF_SCOPE_DIRS = [
  'reports/',
  'src/_data/researchTopics/',
  'src/_includes/research-descriptions/',
];

// Repo-locus prefixes (we:docs/agent/conventions.md → the repo-locus convention). `we:` resolves against
// THIS working tree (deterministic); `fui:` / `plateau:` name a sibling repo not in this checkout, so their
// path/line existence can't be resolved here and must never be errored (#2821 gate 5 scope note).
export const IN_REPO_LOCUS = 'we:';
export const CROSS_REPO_LOCI = new Set(['fui:', 'plateau:']);

// A provisional hash-slug id: `x` + exactly 6 lowercase-alnum chars (the born-as id form, e.g. `x9kptqv`).
// Mirrors the two-form id in check-standards-rules.mjs ITEM_REF_RX (`x[0-9a-z]{6}`).
const HASH_SLUG = 'x[0-9a-z]{6}';

/**
 * Build the anchor → owning-item map from backlog front-matter. Exactly one backlog item carries
 * `codifiedIn: docs/agent/platform-decisions.md#<anchor>` for a given anchor; that item's number IS the
 * anchor's ruling authority. This is a lookup, not a recall (#2821 gate 10).
 *
 * @param items array of `{ num, codifiedIn }` (codifiedIn may be absent). `num` is the backlog number.
 * @param opts.doc the statute doc basename the anchors live in (default platform-decisions.md).
 * @returns Map<anchorName, ownerNum:string>. If two items claim the same anchor the first wins and the
 *          collision is ignored here (a separate rule owns "one codifiedIn owner per anchor").
 */
export function buildAnchorOwners(items, { doc = 'docs/agent/platform-decisions.md' } = {}) {
  const owners = new Map();
  const re = new RegExp(`${doc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#([a-z0-9][a-z0-9-]*)`);
  for (const it of items || []) {
    if (!it || typeof it.codifiedIn !== 'string' || it.num == null) continue;
    const m = it.codifiedIn.match(re);
    if (m && !owners.has(m[1])) owners.set(m[1], String(it.num));
  }
  return owners;
}

/**
 * Gate 10 — anchor-authority resolution. Find sentences that cite a platform-decisions `#anchor` AND
 * attribute its ruling to an `#NNN` that is NOT the anchor's codifiedIn owner.
 *
 * PRECISION is the whole game (the task's zero-false-positive bar): a bare `#2439` used as a build-slice
 * reference, and a cross-reference to an anchor with no attributing number, must NOT fire. We fire on only
 * two tight *attribution* shapes, and only for anchors we can resolve (a known codifiedIn owner):
 *
 *   A. anchor immediately followed by an attribution paren whose LEADING token is a number —
 *      `#anchor (#2439, …)` or `[…](#anchor) (#2439)`. A trailing PROSE paren — `#anchor (independence
 *      rests on …)` — does not match (it does not open with `#NNN`), so real cross-refs are safe.
 *   B. an anchor and a number sharing ONE parenthetical group — `(#2439, #anchor-name)` /
 *      `(#anchor-name, #2439)`. A number in a *different* paren than the anchor (e.g. a preceding
 *      `**Ratified … (#2563).**` clause that then mentions the anchor in prose) is NOT in the same group,
 *      so it does not match.
 *
 * The heading-definition form `{#anchor}` is never a citation and is excluded (we only match `#anchor`
 * and `](#anchor)`). Cross-repo / numeric noise can't be an anchor because the anchor must resolve in
 * `anchorOwners`.
 *
 * @param text     the file body (raw). Newlines are normalised so a citation split across lines still matches.
 * @param anchorOwners Map<anchorName, ownerNum> from buildAnchorOwners.
 * @returns array of `{ anchor, citedNum, expectedNum, shape, context }`.
 */
export function findAnchorRulingMismatches(text, anchorOwners) {
  const findings = [];
  if (typeof text !== 'string' || text === '' || !anchorOwners || anchorOwners.size === 0) return findings;
  // Join lines so a citation wrapped across a newline (as in platform-decisions Lineage blocks) still reads
  // as one adjacency; collapse runs of whitespace so the adjacency regexes stay simple.
  const flat = text.replace(/\s+/g, ' ');
  // Longest anchor first so a shorter anchor that prefixes a longer one can't shadow it.
  const anchorAlt = [...anchorOwners.keys()].sort((a, b) => b.length - a.length)
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!anchorAlt) return findings;

  const record = (anchor, citedNum, shape, idx) => {
    const expectedNum = anchorOwners.get(anchor);
    if (expectedNum === undefined || String(citedNum) === String(expectedNum)) return;
    findings.push({
      anchor,
      citedNum: String(citedNum),
      expectedNum: String(expectedNum),
      shape,
      context: flat.slice(Math.max(0, idx - 30), idx + 80).trim(),
    });
  };

  // Shape A: `#anchor` — optionally closing a markdown link (`)`) or a backtick/quote wrapper (`` ` `` / `'`
  // / `"`) — directly followed by an attribution paren whose LEADING token is `#NNN`. The trailing-wrapper
  // class covers the real backtick-wrapped form `` `#anchor` (#NNN) ``. A trailing PROSE paren does not
  // open with `#NNN`, so real cross-refs stay safe.
  const shapeA = new RegExp(`(?:\\]\\(#|#)(${anchorAlt})[)\`'"]*\\s*\\(\\s*#(\\d{3,5})\\b`, 'g');
  for (const m of flat.matchAll(shapeA)) record(m[1], m[2], 'A', m.index);

  // Shape B: a single parenthetical group holding the anchor and a number as COMMA-SEPARATED attribution
  // tokens, in either order — `` (`#anchor`, #NNN) `` / `(#NNN, #anchor-name)`. The comma-adjacency is what
  // makes it an ATTRIBUTION rather than mere co-residence: an incidental number in prose beside the anchor
  // (`(#NNN introduced the check enforced by #anchor)`) has no comma directly between the two tokens, so it
  // no longer over-fires (the earlier "any anchor + any number in one paren" test broke the zero-false-positive
  // bar). A backtick/quote wrapper between a token and the comma is tolerated (the real `` `#anchor`, #NNN `` form).
  const parenGroup = /\(([^()]*)\)/g;
  const anchorThenNum = new RegExp(`#(${anchorAlt})[\`'"]*\\s*,\\s*#(\\d{3,5})\\b`);
  const numThenAnchor = new RegExp(`#(\\d{3,5})\\b[\`'"]*\\s*,\\s*[\`'"]*#(${anchorAlt})\\b`);
  for (const pm of flat.matchAll(parenGroup)) {
    const inner = pm[1];
    const am = inner.match(anchorThenNum);
    if (am) { record(am[1], am[2], 'B', pm.index); continue; }
    const nm = inner.match(numThenAnchor);
    if (nm) record(nm[2], nm[1], 'B', pm.index);
  }
  return findings;
}

/**
 * Gate 5 — `we:<path>:<line>` resolution. A code-locus citation must resolve: the file exists and the line
 * is within it. Dangling path or out-of-range line = error. `fui:` / `plateau:` loci are recognised and
 * skipped (their targets aren't in this checkout). Line ranges (`:164-194`) resolve on both bounds.
 *
 * @param text the file body (raw).
 * @param opts.fileExists (relPath:string) => boolean — does the repo-relative path exist?
 * @param opts.lineCount  (relPath:string) => number|null — line count, or null if unreadable/missing.
 * @returns array of `{ locus, path, line, reason }` (reason: 'missing-file' | 'line-out-of-range').
 */
export function findDanglingLoci(text, { fileExists, lineCount }) {
  const findings = [];
  if (typeof text !== 'string' || text === '') return findings;
  // A code-locus is a REPO-RELATIVE path. A matched path that is absolute or climbs out of the repo with a
  // `..` segment is never a valid citation — and must NOT reach the injected fs readers, or the caller's
  // `readFileSync(join(ROOT, path))` would resolve the traversal and read (and line-split) an arbitrary file
  // outside the tree — a large/streaming target (e.g. `we:../../../../dev/urandom:1`) hangs or OOMs the gate.
  // Skip such loci entirely (never resolved, never errored — same posture as a cross-repo locus).
  const isInRepoPath = (p) => typeof p === 'string' && p !== '' && !p.startsWith('/') && !p.split('/').includes('..');
  // we:<path>:<line> or we:<path>:<start>-<end>. Path is a run of path chars (no whitespace, no `:` — the
  // `:` after the path is the line separator). Requires at least one `/` so a bare `we:foo:1` word can't
  // masquerade as a locus; matches the repo-locus convention (we:docs/agent/conventions.md).
  const rx = /\b(we|fui|plateau):([A-Za-z0-9._\-/]+\/[A-Za-z0-9._\-]+):(\d+)(?:-(\d+))?\b/g;
  const seen = new Set();
  for (const m of text.matchAll(rx)) {
    const [, prefix, path, startStr, endStr] = m;
    if (CROSS_REPO_LOCI.has(`${prefix}:`)) continue; // cross-repo — not resolvable here, never errored
    if (!isInRepoPath(path)) continue;               // absolute / `..`-escaping — never hand to the fs readers
    const locus = endStr ? `${prefix}:${path}:${startStr}-${endStr}` : `${prefix}:${path}:${startStr}`;
    if (seen.has(locus)) continue;
    seen.add(locus);
    if (!fileExists(path)) {
      findings.push({ locus, path, line: Number(startStr), reason: 'missing-file' });
      continue;
    }
    const count = lineCount(path);
    if (count == null) continue; // unreadable — don't guess
    const hi = endStr ? Number(endStr) : Number(startStr);
    if (Number(startStr) < 1 || hi > count) {
      findings.push({ locus, path, line: hi, reason: 'line-out-of-range' });
    }
  }
  return findings;
}

/**
 * Count the LINES of a source file for a `we:<path>:<line>` range check (gate 5). A file ending in a
 * newline has that trailing `\n` as a line TERMINATOR, not a following empty line — so a naive
 * `split('\n').length` overcounts by one and lets a locus pointing one line past the true end read as
 * in-range. This strips that single trailing-newline artifact so the count is the real line total. Pure —
 * the caller injects the file text; this is exercised directly by the unit test (the injected `lineCount`
 * in `findDanglingLoci` should be `countSourceLines(readFileSync(...))`).
 * @param text the file body.
 * @returns the number of lines (0 for an empty file).
 */
export function countSourceLines(text) {
  if (typeof text !== 'string' || text === '') return 0;
  const n = text.split('\n').length;
  return text.endsWith('\n') ? n - 1 : n;
}

/**
 * Gate 3 — hash-slug outside the at-land rewrite scope. A `xNNNNNN` hash-slug citation living in a dir the
 * hash→NNN rewriter never touches (reports/, the two research dirs) will dangle permanently once the item
 * lands with a real NNN. We match only the two citation FORMS the drift takes — a `#xNNNNNN` cross-ref and
 * a `xNNNNNN-slug.md` file link — so a stray word can't trip it.
 *
 * @param text    the file body (raw).
 * @param relPath the file's repo-relative path (decides in/out of scope).
 * @param opts.outOfScopeDirs default HASH_SLUG_OUT_OF_SCOPE_DIRS.
 * @returns array of `{ slug, form }` (form: 'hash-ref' | 'file-link'); empty if relPath is in rewrite scope.
 */
export function findOutOfScopeHashSlugs(text, relPath, { outOfScopeDirs = HASH_SLUG_OUT_OF_SCOPE_DIRS } = {}) {
  const findings = [];
  if (typeof text !== 'string' || text === '' || typeof relPath !== 'string') return findings;
  if (!outOfScopeDirs.some((d) => relPath.startsWith(d))) return findings; // in-scope dir self-heals at land
  const hashRef = new RegExp(`#(${HASH_SLUG})\\b`, 'g');
  const fileLink = new RegExp(`\\b(${HASH_SLUG})-[a-z0-9-]+\\.md\\b`, 'g');
  for (const m of text.matchAll(hashRef)) findings.push({ slug: m[1], form: 'hash-ref' });
  for (const m of text.matchAll(fileLink)) findings.push({ slug: m[1], form: 'file-link' });
  return findings;
}
