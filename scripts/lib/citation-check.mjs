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
 *   • findUnresolvedIdentifiers  — the PROVENANCE gate (#3026): a bare backticked identifier in prose must
 *     resolve against the tree, or carry an explicit not-asserted marker.
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
 * Build the anchor → owning-items map from backlog front-matter. A platform-decisions `#anchor` is owned
 * by EVERY backlog item that resolves to it — an anchor is genuinely multi-owner on this corpus (measured:
 * 109 anchors resolve, 32 have 2+ owners; `#constellation-placement` alone has 43). Two front-matter fields
 * confer ownership, both written as `…platform-decisions.md#<anchor>`:
 *   • `codifiedIn` — the item whose ruling the anchor codifies.
 *   • `graduatedTo` — an item that graduated INTO the anchor (14 items on this tree do), which is just as
 *     much a legitimate authority for it.
 * So the map is `anchor → Set(ownerNum)`, the UNION of both fields across all items. Firing must test set
 * membership, never a single "the owner" — an earlier single-owner premise kept whichever item `readdirSync`
 * yielded first and mislabeled the other 30+ legitimate owners as wrong (#2821 gate 10). This is a lookup,
 * not a recall (#51 hookable-vs-judgment).
 *
 * @param items array of `{ num, codifiedIn?, graduatedTo? }`. `num` is the backlog number; either field may
 *        be absent. Both are scanned for the doc#anchor form.
 * @param opts.doc the statute doc path the anchors live in (default platform-decisions.md).
 * @returns Map<anchorName, Set<ownerNum:string>>. Every item that cites the anchor via either field is in
 *          the set; membership — not identity — is what `findAnchorRulingMismatches` tests.
 */
export function buildAnchorOwners(items, { doc = 'docs/agent/platform-decisions.md' } = {}) {
  const owners = new Map();
  const re = new RegExp(`${doc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#([a-z0-9][a-z0-9-]*)`);
  const add = (anchor, num) => {
    let set = owners.get(anchor);
    if (!set) { set = new Set(); owners.set(anchor, set); }
    set.add(String(num));
  };
  for (const it of items || []) {
    if (!it || it.num == null) continue;
    for (const field of [it.codifiedIn, it.graduatedTo]) {
      if (typeof field !== 'string') continue;
      const m = field.match(re);
      if (m) add(m[1], it.num);
    }
  }
  return owners;
}

/**
 * Gate 10 — anchor-authority resolution. Find sentences that cite a platform-decisions `#anchor` AND
 * attribute its ruling to an `#NNN` that is NOT in the anchor's owner set (its codifiedIn / graduatedTo
 * owners). An anchor with several legitimate owners passes for a citation to ANY one of them.
 *
 * PRECISION is the whole game (the task's zero-false-positive bar): a bare `#2439` used as a build-slice
 * reference, and a cross-reference to an anchor with no attributing number, must NOT fire. We fire on only
 * two tight *attribution* shapes, and only for anchors we can resolve (present in the owner map):
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
 * @param anchorOwners Map<anchorName, Set<ownerNum>> from buildAnchorOwners.
 * @returns array of `{ anchor, citedNum, owners, shape, context }` — `owners` is the anchor's full sorted
 *          owner set (the legitimate authorities the cited number was NOT one of).
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
    const ownerSet = anchorOwners.get(anchor);
    // Fire ONLY when the cited number owns NONE of this anchor — a genuinely wrong attribution. An anchor
    // is multi-owner on this corpus, so a citation to any ONE of its legitimate owners must pass.
    if (!ownerSet || ownerSet.size === 0 || ownerSet.has(String(citedNum))) return;
    findings.push({
      anchor,
      citedNum: String(citedNum),
      owners: [...ownerSet].sort(),
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// PROVENANCE gate (#3026) — a bare backticked identifier in prose must resolve, or be marked
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * The three markers that say "this name is NOT being asserted to exist". A closed vocabulary of exactly
 * three, one per legitimate class MEASURED on this corpus (#3026) — not an open synonym list, because the
 * escape's whole value is being greppable: `grep -rn '(proposed)\|(does not exist)\|(example)'` finds every
 * deliberate forward reference in one pass, and a reviewer reading the sentence sees the author's intent
 * inline. Each marker follows the closing backtick: `` `newThing` (proposed) ``.
 *
 *   • `proposed`        — a name for something not built yet (the dominant corpus class: 1,068 distinct
 *                         unresolved tokens are mostly an unbuilt item naming the function it will write).
 *   • `does not exist`  — a name cited AS absent: a refuted claim, an audit finding, a defect being reported.
 *                         Real instance: #3013 prep's "`enforceFlipReady`, which the statute names but which
 *                         does not exist in the tree".
 *   • `example`         — a name quoted illustratively or as a historical citation, where whether it exists
 *                         is beside the point. Real instance: this gate's own item quoting the seven misses.
 */
export const PROVENANCE_ESCAPE_MARKERS = Object.freeze(['proposed', 'does not exist', 'example']);

/** Heading zones where an unresolved name is conventional and expected (#3026). A `## Done when` section
 *  names the functions the item will WRITE; a `## Design` section names the shape it proposes. Both are
 *  already the conventional homes for not-yet-real names, so an author writing there does not also have to
 *  mark each token. The zone runs until the next heading at the SAME OR SHALLOWER level, so a `###`
 *  subsection of `## Done when` inherits it. Verified against the historical misses this gate exists to
 *  catch: none of them lived under an escape heading (`validateTodoMarkerBlock` was under
 *  `## Where it is today`, `enforceFlipReady` in the item lede, `collectOpenItemIds` in a JSDoc block). */
export const PROVENANCE_ESCAPE_HEADINGS = Object.freeze(['done when', 'design']);

/** The region escape, for a block that quotes MANY non-resolving names (a table of historical defects, a
 *  list of illustrative proposals) where a per-token marker would be pure noise. Two lines instead of N
 *  markers. A REASON is REQUIRED — a bare `off` does not escape and is reported in its own right, so the
 *  escape can never be a silent blanket. Greppable as `provenance-lint:`; visible in the rendered diff. */
export const PROVENANCE_REGION_OFF_RE = /provenance-lint:\s*off\b(.*)$/i;
export const PROVENANCE_REGION_ON_RE = /provenance-lint:\s*on\b/i;

// Identifier SHAPES that read as a code symbol in prose. camelCase must carry an interior capital (so a
// plain English word like `status` is never a citation) and SCREAMING_SNAKE must carry an underscore (so a
// bare acronym like `WE` / `TODO` is never one). Deliberately excludes PascalCase: on this corpus that shape
// is dominated by class/type NOUNS used as concepts (`CustomStore`, `InjectorRoot`) rather than existence
// claims, and including it re-introduces the false positives the corpus-wide run proved fatal.
const PROVENANCE_CAMEL_RE = /^[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*$/;
const PROVENANCE_SCREAMING_RE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

/** Longest backticked span we will even look at. Caps regex work on a pathological line (a NUL-sentinel
 *  file read as utf8 is one long line) and no real identifier citation is longer. */
const PROVENANCE_MAX_SPAN = 120;

const isIdentifierShape = (t) =>
  typeof t === 'string' && t.length > 1 && t.length <= PROVENANCE_MAX_SPAN &&
  (PROVENANCE_CAMEL_RE.test(t) || PROVENANCE_SCREAMING_RE.test(t));

/**
 * Parse ONE backticked span into the identifier it asserts, or null if it asserts none.
 *
 * Two accepted forms — and the CALL form is not cosmetic. #3026's design said "a trailing `()` tolerated",
 * i.e. `` `foo()` ``. Measured against the real corpus that misses the single most important instance: the
 * statute asserts `` `enforceFlipReady({ ciStatus, reviewShadowLedger })` `` — a call written WITH its
 * arguments, which is the STRONGEST form of "this function exists" and the exact citation the briefing
 * flagged as resolving to zero code files. So the call form accepts any argument list, not just `()`.
 *
 * @param raw the span's inner text, already trimmed.
 * @returns `{ token, form }` (form: 'bare' | 'call') or null.
 */
export function parseIdentifierSpan(raw) {
  if (typeof raw !== 'string' || raw === '' || raw.length > PROVENANCE_MAX_SPAN) return null;
  if (isIdentifierShape(raw)) return { token: raw, form: 'bare' };
  // `foo(…)` / `ns.foo(…)` — the callee is the last dotted segment.
  const call = raw.match(/^([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*){0,4})\s*\(/);
  if (call) {
    const callee = call[1].slice(call[1].lastIndexOf('.') + 1);
    if (isIdentifierShape(callee)) return { token: callee, form: 'call' };
  }
  return null;
}

/**
 * Every inline code span on a line, innermost text first, with whatever FOLLOWS the span (so the caller can
 * look for a trailing escape marker).
 *
 * Handles BOTH markdown forms, and the doubled one is not academic. `docs/agent/conventions.md` writes
 * `` `we:CustomComment.ts` `` — the double-backtick wrapper you need whenever the displayed code itself
 * contains a backtick — throughout. A single-backtick-only regex silently sees nothing there, which is the
 * worst failure mode a gate can have: it read the file, found no citation, and reported clean. (Observed:
 * the first wiring returned zero findings on a docs page deliberately seeded with two bad names.)
 *
 * @returns array of `{ inner, after }`.
 */
export function codeSpans(line) {
  const out = [];
  if (typeof line !== 'string' || line === '') return out;
  // Double-backtick spans first; their content MAY contain single backticks, so match non-greedily and then
  // peel the inner wrapper. Mask each consumed region so the single-backtick pass cannot re-scan inside it.
  const chars = [...line];
  const masked = chars.slice();
  for (const m of line.matchAll(/``(.+?)``/g)) {
    const inner = m[1].trim().replace(/^`+/, '').replace(/`+$/, '').trim();
    out.push({ inner, after: line.slice(m.index + m[0].length) });
    for (let i = m.index; i < m.index + m[0].length && i < masked.length; i++) masked[i] = ' ';
  }
  const rest = masked.join('');
  for (const m of rest.matchAll(/`([^`\n]{1,120})`/g)) {
    out.push({ inner: m[1].trim(), after: line.slice(m.index + m[0].length) });
  }
  return out;
}

/** Does the text immediately following a span's closing backtick carry a not-asserted marker? Tolerates
 *  markdown emphasis inside the parens — the real instance is written `(**does not exist**)`. */
function hasInlineEscape(rest) {
  const m = rest.match(/^\s*\(\s*[*_~]{0,2}\s*([a-z ]+?)\s*[*_~]{0,2}\s*\)/i);
  return !!m && PROVENANCE_ESCAPE_MARKERS.includes(m[1].trim().toLowerCase());
}

/**
 * The PROVENANCE gate (#3026) — extract identifier-shaped backticked tokens from PROSE and report the ones
 * that do not resolve against the tree and are not explicitly marked as unasserted.
 *
 * WHY THIS IS DIFF-SCOPED, AND WHY THAT IS THE WHOLE DESIGN. Measured on this checkout (re-derived
 * 2026-08-09, and it reproduces the filing measurement): a corpus-wide run over the 3,040 markdown files in
 * `backlog/` + `docs/` extracts **11,779 identifier tokens of which 1,068 distinct (1,808 occurrences) do
 * not resolve** — and spot-checking the head of that list (`createRadioGroup`, `detectAnomalies`,
 * `mountLaneBoard`, `produceFunctionalBytes`) shows the dominant class is LEGITIMATE: an unbuilt item naming
 * the function it proposes to write. A gate that fires 1,808 times on correct prose is a gate everyone
 * learns to scroll past. So the caller passes `addedLines` — the lines the change under review ADDED — and
 * only findings on those lines are returned. The existing corpus is never re-litigated.
 *
 * WHY `backlog/` IS OUT OF SCOPE — a MEASURED narrowing of #3026's filed design, not a shortcut. The item
 * specifies `backlog/*.md` + `docs/**` + `leash: spec` comments, on the strength of one hand-picked diff
 * ("19 tokens, 1 unresolved, zero false positives"). Replaying the SHIPPING extractor over the 40 most
 * recent merges into `main` does not reproduce that:
 *
 *   scope                                 findings   merges non-clean
 *   backlog + docs + leash-spec              503          22 / 40
 *   …plus a "token appears in the item's
 *     own filename" proposal escape          339          20 / 40
 *   docs + leash-spec (SHIPPED)                0           0 / 40
 *
 * The 503 are overwhelmingly correct prose: `clearerId`(108) and `authorId`(99) are parameters an OPEN item
 * accurately describes as not yet existing; `buildPassRecord`(72) is a function a slice proposes to write.
 * That is not a lint, it is a wolf-cry. The dividing line is what the surface is FOR: `backlog/` is a
 * PROPOSAL register whose prose is mostly about work not yet done, so an unresolved name there is the norm;
 * `docs/agent/**` (the statute and the agent instructions) and the `leash: spec` contracts are ASSERTION
 * surfaces that describe what IS, and a name there resolving nowhere is exactly the defect class.
 *
 * The shipped zero is NOT vacuous — a positive control (same 40 merges, `resolves` forced false) shows the
 * gate put **271 identifier tokens on added prose lines through resolution across 12 of the 40 merges** and
 * flagged none. #3026 therefore stays OPEN for its `backlog/` half, which needs a proposal-vs-assertion
 * discriminator nobody has yet built.
 *
 * The state that decides an escape (fenced-code, heading zone, `provenance-lint: off` region) is computed
 * over the WHOLE text, not just the added lines, because a line added inside a pre-existing fence or under
 * an untouched `## Done when` heading must inherit that context. Hence: scan everything, report the subset.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT. Resolution here is deliberately LOOSE — a token resolves if the
 * name appears anywhere in the tree's source files. The question the gate answers is "does this name exist
 * at all?", which is precisely the question the historical misses failed. It cannot prove the SENTENCE about
 * the name is true: a resolvable name can still be cited wrongly (a real symbol in the wrong file, a
 * miscounted fixture total, a misdescribed behaviour). That residue stays a review-and-author discipline.
 *
 * @param text the file body (raw).
 * @param opts.resolves (token:string) => boolean — injected; does this name exist anywhere in the tree's
 *        source files? I/O-free here, so the index is built by check-standards.mjs and faked by the tests.
 * @param opts.addedLines Set<number> of 1-based line numbers the change added, or null for "the whole file"
 *        (used only by the corpus-wide measurement, never by the wired gate).
 * @param opts.syntax 'markdown' (default) or 'comment' — in 'comment' mode only `//` and `/* *\/` comment
 *        lines are prose, so the gate reads a `leash: spec` source file's JSDoc without reading its code.
 * @returns array of `{ kind, token, line, form, context }`. `kind` is 'unresolved' for a failing citation,
 *          or 'escape-no-reason' for a `provenance-lint: off` marker that states no reason (which therefore
 *          does NOT escape — the fail-closed direction: an unexplained blanket is refused, not honoured).
 */
export function findUnresolvedIdentifiers(text, {
  resolves,
  addedLines = null,
  syntax = 'markdown',
  escapeHeadings = PROVENANCE_ESCAPE_HEADINGS,
} = {}) {
  const findings = [];
  if (typeof text !== 'string' || text === '' || typeof resolves !== 'function') return findings;

  const lines = text.split('\n');
  let inFence = false;
  let fenceChar = '';
  let escapeLevel = null;   // heading depth that opened the current escape zone, or null
  let regionOff = false;
  let inBlockComment = false;
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // ── fenced code: never prose, in either syntax mode (JSDoc carries ``` blocks too).
    const fence = line.match(/^\s{0,3}(```+|~~~+)/);
    if (fence) {
      if (!inFence) { inFence = true; fenceChar = fence[1][0]; }
      else if (fence[1][0] === fenceChar) { inFence = false; }
      continue;
    }
    if (inFence) continue;

    // ── the region escape. Checked before anything else so it works in both syntaxes and inside any zone.
    const off = line.match(PROVENANCE_REGION_OFF_RE);
    if (off) {
      const reason = off[1].replace(/(-->|\*\/)\s*$/, '').replace(/^[\s—–:,.*_-]+/, '').trim();
      if (reason.length >= 3) regionOff = true;
      else findings.push({ kind: 'escape-no-reason', token: null, line: lineNo, form: null, context: line.trim().slice(0, 120) });
      continue;
    }
    if (PROVENANCE_REGION_ON_RE.test(line)) { regionOff = false; continue; }

    // ── prose selection + heading zones.
    let prose;
    if (syntax === 'comment') {
      // Track `/* … */` blocks; a `//` line is prose too. Everything else is code — not our surface.
      const opensBlock = /\/\*/.test(line);
      const closesBlock = /\*\//.test(line);
      prose = inBlockComment || opensBlock || /^\s*\/\//.test(line);
      if (opensBlock && !closesBlock) inBlockComment = true;
      else if (closesBlock) inBlockComment = false;
    } else {
      prose = true;
      const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (h) {
        const depth = h[1].length;
        const title = h[2].replace(/[`*_]/g, '').trim().toLowerCase();
        // A heading at the same-or-shallower depth closes an open zone; a deeper one inherits it.
        if (escapeLevel !== null && depth <= escapeLevel) escapeLevel = null;
        if (escapeLevel === null && escapeHeadings.some((k) => title === k || title.startsWith(`${k} `) || title.startsWith(`${k}:`)))
          escapeLevel = depth;
        continue;
      }
    }
    if (!prose) continue;
    if (regionOff || escapeLevel !== null) continue;
    if (addedLines && !addedLines.has(lineNo)) continue;

    for (const { inner, after } of codeSpans(line)) {
      const parsed = parseIdentifierSpan(inner);
      if (!parsed) continue;
      if (hasInlineEscape(after)) continue;
      if (resolves(parsed.token)) continue;
      const key = `${lineNo}:${parsed.token}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ kind: 'unresolved', token: parsed.token, line: lineNo, form: parsed.form, context: line.trim().slice(0, 160) });
    }
  }
  return findings;
}

/**
 * Strip COMMENT text from a source body so the resolution index is built from code only.
 *
 * This is not a nicety — it is the fix for a measured miss. Replaying PR #1112 round 1 (`2423f255`), the
 * false cite `collectOpenItemIds` did NOT fire, because the index included the very JSDoc block that
 * invented the name: the token "resolved" against its own false assertion. A citation in prose asserts
 * something about the CODE, so the index must be what the code knows, never what another comment claims.
 *
 * Deliberately conservative about `//`: only a line whose first non-space characters are `//` is stripped.
 * A trailing `// …` is left alone because the same two characters appear inside every `https://` URL in
 * every JSON/config string, and stripping to end-of-line there would silently delete real code tokens.
 * Block comments (`/* … *\/`, which is where JSDoc — and the miss — lives) are stripped wherever they occur.
 */
export function stripSourceComments(body) {
  if (typeof body !== 'string' || body === '') return '';
  // Block comments first; keep newlines so nothing merges across lines.
  const noBlocks = body.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.split('\n').map((l) => (/^\s*\/\//.test(l) ? '' : l)).join('\n');
}

/**
 * Build the resolution index: every identifier-shaped token appearing in the tree's SOURCE CODE.
 *
 * Two exclusions, both load-bearing:
 *   • PROSE DIRS (`backlog/`, `docs/`, `reports/`, …) are excluded by the caller — if the index covered them,
 *     every false citation would resolve against the very sentence that made it up.
 *   • COMMENTS are excluded here (see `stripSourceComments`) — same failure one level down, and it is the
 *     one that actually bit on replay.
 *
 * Tolerant of NUL bytes by construction — three committed scripts carry deliberate NUL sentinels
 * (`guard-bash.mjs`, `renumber-collisions.mjs`, `component-render-build-hook.cjs`) that make plain `grep`
 * silently report nothing on them. This reads with `readFileSync(…, 'utf8')` and matches with a JS regex,
 * both of which treat `\0` as an ordinary character, so those files index normally rather than dropping out.
 *
 * @param texts iterable of source-file bodies.
 * @param opts.stripComments default true; false only for the measurement harness.
 * @returns Set<string> of identifier-shaped tokens.
 */
export function buildIdentifierIndex(texts, { stripComments = true } = {}) {
  const idx = new Set();
  for (const raw of texts || []) {
    if (typeof raw !== 'string') continue;
    const body = stripComments ? stripSourceComments(raw) : raw;
    for (const m of body.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) if (isIdentifierShape(m[0])) idx.add(m[0]);
  }
  return idx;
}
