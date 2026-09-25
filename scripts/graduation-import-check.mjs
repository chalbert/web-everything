#!/usr/bin/env node
/**
 * @file scripts/graduation-import-check.mjs
 * @description Epic #3443 (porting `origin/lane/mechanical-dispatcher` to `main` in slices) has hit the same
 *   failure TWICE: a slice's scoped TEST file imports a module owned by a LATER slice — one whose files are
 *   not on `main` yet and are not declared as a `blockedBy` dependency — so the slice cannot pass its own
 *   tests once it lands on `main`. #3901 had three test files like this (hand-fixed in PR #2567, moved to
 *   #3856/#3908/#3902); #3895 has two more, not yet fixed, at the snapshot this tool defaults to.
 *
 *   This checks EVERY OPEN card parented to the epic: for each `.mjs` file in its `scope:`, read the file AS IT
 *   STOOD AT THE PORT SNAPSHOT (`git show <sha>:<path>` — the port has not landed, so main's own working tree
 *   copy, if any, is irrelevant; the snapshot is the branch content about to be ported), statically extract its
 *   relative imports (`import … from './x.mjs'`, `import './x.mjs'`, and `import('./x.mjs')`), resolve each to a
 *   repo path, and classify it:
 *     - `on-main`   — the path already exists on `origin/main` (kept simple per the card: existence only, no
 *                     content diff — a file `main` already has can never be a slice-ordering hazard).
 *     - `own`       — declared in the SAME card's own `scope:`.
 *     - `blocker`   — declared in the `scope:` of a card this card's `blockedBy` reaches, transitively — landing
 *                     order is guaranteed by the epic's drain (Slice procedure rule 2), so this is safe.
 *     - `later:#N`  — declared in the `scope:` of some OTHER open card, with no declared `blockedBy` edge
 *                     guaranteeing it lands first. THIS is the hazard: nothing enforces #N lands before this
 *                     card, so the import may not exist on `main` when this card's tests run.
 *     - `unowned`   — not on `main`, not in any open card's `scope:` — likely a moved/renamed file or a scope
 *                     gap; flagged for a human, since there is no card to point a fix at.
 *
 *   Only `later` and `unowned` are findings. The proposed fix differs by file kind (`*.test.mjs` vs. impl):
 *     - a TEST file moves wholesale to the owning card that LANDS LAST among its `later` imports — moving it to
 *       the earliest-landing owner would just recreate the same hazard one hop down. "Lands last" is read off
 *       the `blockedBy` DAG as topological depth (`landingDepth`, counting only OPEN blockers — a resolved
 *       blocker has already landed and costs no further depth): #3895's own `telemetry-wiring.test.mjs` imports
 *       modules owned by #3902 (depth 1), #3905 (depth 4) and #3908 (depth 5) — #3908 wins, and that agrees with
 *       the epic card's own hand-written "Critical path: 3897 → 3902 → 3903 → 3906 → 3908 → 3487" and its Wave
 *       lettering (3902 is Wave B, 3905 is Wave C, 3908 is Wave D — D lands after B and C).
 *     - an IMPL file cannot be moved (its OWN card owns it) — the fix is to add the later owner(s) as
 *       `blockedBy`, which is exactly what the `blocker` classification then makes safe on the next run — UNLESS
 *       that edge would itself cycle (the later owner is already, transitively, `blockedBy` THIS card): then the
 *       one dependency FILE moves into this card's own scope instead (safe by construction — see `buildFindings`).
 *
 * NON-IMPORT DEPENDENCIES (#3906 drop, epic #3443's second graduation failure past the plain-import one above).
 *   A slice's tests can also fail on a sibling's file that a plain `import` scan can never see:
 *     - a STRING-LITERAL path — `join(ROOT, 'a', 'b', 'c.mjs')`, `new URL('./x.md', import.meta.url)`, a bare
 *       `readFileSync('scripts/x.mjs')`/`spawn(node, [path])` argv element — see `extractPathLiteralSpecifiers`.
 *       Only a candidate that resolves to a REAL blob at the snapshot counts (existence is the noise filter for
 *       a guess this much less certain than a real `import`); classified exactly like an import once resolved.
 *     - CONTENT DRIFT — a file `origin/main` already has is normally an unconditional `on-main` (no hazard, by
 *       the header comment above). But if it is ALSO in an OPEN SIBLING's own `scope:` (the slice that will
 *       change it), main's CURRENT content is not what lands — only the sibling's ported version is. A snapshot
 *       vs. `origin/main` content diff on exactly that bounded set (referenced AND sibling-scoped) reclassifies
 *       it `later:#N` instead. Real cases: `we:scripts/operations/completion-record.mjs` (#3903 — main lacks
 *       `'task'` in `COMPLETION_KINDS`), `we:skills-src/conveyor/fix-agent-brief.md` (#3904),
 *       `we:docs/agent/dispatcher-runbook.md` (#3910), a fake-CLI test helper (#3907).
 *   KNOWN GAP, stated rather than hidden: a path assembled ACROSS module boundaries — a re-exported constant
 *   (`RUNBOOK` from `we:scripts/gen-dispatch-routing-table.mjs`, read with `readFileSync(RUNBOOK, …)` in a
 *   DIFFERENT file) or a runtime-variable lookup (`briefPath(root, kind)` picking a brief filename out of a
 *   `kind`-keyed table, joined elsewhere) — is not resolvable from one file's text alone; this tool intentionally
 *   stays single-file, matched to `extractImportSpecifiers`'s own "not a real parser" scope, rather than growing
 *   a cross-module resolver for it. See the epic-#3443 PR notes for exactly which live #3906 findings this
 *   extension explains and which remain that gap.
 *
 *   PURE CORE below (no fs/child_process/Date) is unit-tested on synthetic fixtures
 *   (`we:scripts/__tests__/graduation-import-check.test.mjs`). The IO shell (git/fs) and the CLI sit at the
 *   bottom, guarded by the `import.meta.url` check so importing this module for its exports never runs it.
 *
 * REUSES, NEVER REINVENTS: frontmatter scalar-field read/insert (`./backlog/frontmatter.mjs`, #2603-descended)
 *   and the ONE card-mutation writer (`./backlog/guarded-write.mjs`, #3034) — `--apply` never hand-rolls a
 *   frontmatter splice or a raw `writeFileSync` on a backlog card.
 *
 * Usage:
 *   node scripts/graduation-import-check.mjs [--snapshot=600acc14f] [--parent=3443] [--json] [--apply]
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, posix as pathPosix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';

import { readField, setFrontmatterField } from './backlog/frontmatter.mjs';
import { writeBacklogMd } from './backlog/guarded-write.mjs';
import { localToday } from './lib/local-date.mjs';

// ---------------------------------------------------------------------------------------------------------------
// PURE CORE — no fs, no child_process, no Date. Every fact this half needs (card data, file text, "does this
// path exist on origin/main", "today") is INJECTED by the IO shell below.

/** `backlog/3895-graduate-….md` → `3895`; `backlog/x8w8pux-….md` → `x8w8pux` (a not-yet-JIT-numbered card). */
export function idFromFilename(name) {
  return String(name).replace(/\.md$/, '').split('-')[0];
}

/** Strip/add the `we:` repo-locus prefix (#883) that every `scope:`/`blockedBy` display path in this repo carries. */
export function stripWe(p) { return p.startsWith('we:') ? p.slice(3) : p; }
export function withWe(p) { return p.startsWith('we:') ? p : `we:${p}`; }

/**
 * Parse one card's frontmatter into the fields this check needs. PURE (gray-matter is a string parser, no IO).
 * `blockedBy`/`scope` are always arrays of strings, regardless of whether the source YAML had zero, one
 * (bare-scalar) or many entries — mirrors `we:scripts/lib/priority-order.mjs#parseCard`'s normalization.
 * @param {string} name  the backlog filename (`3895-graduate-….md`)
 * @param {string} text  the file's full text
 * @returns {{id:string, kind:string, status:string, parent:string|null, blockedBy:string[], scope:string[]}|null}
 */
export function parseCard(name, text) {
  let data;
  try { data = matter(String(text ?? '')).data ?? {}; } catch { return null; }
  const asArray = (v) => (Array.isArray(v) ? v.map(String) : v != null && v !== '' ? [String(v)] : []);
  return {
    id: idFromFilename(name),
    kind: String(data.kind ?? ''),
    status: String(data.status ?? ''),
    parent: data.parent != null && data.parent !== '' ? String(data.parent) : null,
    blockedBy: asArray(data.blockedBy),
    scope: asArray(data.scope),
  };
}

/** Numeric-first id compare (`"3902" < "3908"`), falling back to string compare for non-numeric (hash) ids —
 *  used only to make an otherwise-arbitrary tie-break (equal landing depth, or several `later` owners)
 *  deterministic, never as a claim about actual landing order. */
export function idCompare(a, b) {
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}

/**
 * The file's leading run of `import` statements — everything from the top up to the first line that is
 * neither blank, nor part of an import statement, nor one of two narrow, explicitly-recognized PREAMBLE
 * shapes that this repo's tests routinely interleave BETWEEN two import blocks (found live, #3906's
 * `dispatch-lane-prepare-wiring.test.mjs`: a `vi.mock('node:child_process', …)` / `vi.mock('node:fs', …)` pair
 * sits between the file's `vitest` import and its real (mocked-module) imports, so the OLD single-contiguous-
 * block rule silently dropped everything after the mock calls — including the very import
 * (`../prepare-scope-run.mjs`) a later slice needed flagged):
 *   - a `vi.mock(<literal>, <factory>);` call — vitest's own hoisting idiom for "mock this module, then import
 *     the real (mocked) bindings below it"; skipped whole (balanced-paren, string-aware, so a `)`/`;` inside
 *     the factory's body or a mocked literal never mis-terminates it).
 *   - a trivial recorder declaration the SAME tests set up right beside those mocks, e.g. `const spawned = [];`
 *     — deliberately narrow (`[]`/`{}`/`new Map()`/`new Set()` only, never an arbitrary expression) so it can
 *     never itself swallow real code.
 * Every OTHER non-blank, non-import line still ends the header exactly as before — this is a widening of what
 * counts as "still preamble", not a loosening of the boundary itself. This remains a NECESSARY restriction, not
 * merely a convenience one: some modules embed literal `import … from '…'` text inside a template-literal
 * STRING (a source string handed to a spawned subprocess for a test, e.g.
 * `we:scripts/conveyor/validate-and-promote.mjs`'s `DISPATCH_PROBE_SRC` and
 * `we:scripts/operations/__tests__/coordination-cross-clone.test.mjs`'s spawned `-e` probe) — text that
 * matches the static-import regex but is not an import of the current module at all. Both of those cases sit
 * well past any run of imports/mocks/trivial recorders (inside a real function body), so they still correctly
 * fall outside the widened header. (Dynamic `import()` is scanned over the WHOLE file, not just the header — a
 * lazy `await import(...)` deep in a function, as in `we:scripts/operations/review-loop-cli.mjs`, is a real
 * import there.) Assumes the house style of terminating every import statement with a semicolon (true of every
 * file this tool has read) — a file that relied on ASI would fail open (header would swallow the rest of the
 * file), which only widens what gets scanned, never narrows it.
 */
function importHeader(source) {
  const n = source.length;
  let i = 0;
  let headerEnd = 0;
  const isWs = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
  const skipString = (quote) => {
    i++; // past the opening quote
    while (i < n) {
      if (source[i] === '\\') { i += 2; continue; }
      if (source[i] === quote) { i++; return; }
      i++;
    }
  };
  /** Consume a `(`-opened, string-aware balanced span starting at `source[i] === '('`; leaves `i` just past
   *  the matching `)`. Only tracks parens (not braces/brackets) — sufficient because valid JS always nests one
   *  bracket TYPE correctly regardless of other types mixed in, as long as strings are skipped (handled here). */
  const skipParens = () => {
    let depth = 0;
    while (i < n) {
      const ch = source[i];
      if (ch === '"' || ch === "'" || ch === '`') { skipString(ch); continue; }
      if (ch === '(') { depth++; i++; continue; }
      if (ch === ')') { depth--; i++; if (depth === 0) return; continue; }
      i++;
    }
  };
  const skipToTopLevelSemicolon = () => {
    while (i < n && source[i] !== ';') {
      if (source[i] === '"' || source[i] === "'" || source[i] === '`') { skipString(source[i]); continue; }
      i++;
    }
    if (i < n) i++; // consume the ';'
  };
  const RECORDER_RE = /^(?:export\s+)?(?:const|let)\s+[A-Za-z_$][\w$]*\s*=\s*(?:\[\s*\]|\{\s*\}|new\s+(?:Map|Set)\(\s*\))\s*;/;
  while (i < n) {
    while (i < n && isWs(source[i])) i++;
    if (i >= n) break;
    const rest = source.slice(i, i + 400); // cheap bound for the anchored checks below
    if (/^import\b/.test(rest)) { skipToTopLevelSemicolon(); headerEnd = i; continue; }
    if (/^vi\.mock\(/.test(rest)) {
      i += 'vi.mock'.length; // i now at '('
      skipParens();
      while (i < n && isWs(source[i])) i++;
      if (source[i] === ';') i++;
      headerEnd = i;
      continue;
    }
    const recorderMatch = RECORDER_RE.exec(rest);
    if (recorderMatch) { i += recorderMatch[0].length; headerEnd = i; continue; }
    break; // first non-blank, non-import, non-preamble top-level line — header ends here
  }
  return source.slice(0, headerEnd);
}

/**
 * Extract every relative static-import / dynamic-`import()` specifier from one module's source text. PURE
 * string scanning, not a real parser — deliberately simple, matched to this repo's house ESM style (explicit
 * `.mjs` extensions, no bundler magic). Comments are stripped first so a JSDoc header that merely MENTIONS an
 * import in prose (this file's own header does exactly that) is never mistaken for a real one; static imports
 * are then read only from {@link importHeader} (see its doc for why). Non-relative specifiers (bare packages,
 * `node:*`) are returned too; the caller (`resolveRelativeImport`) is what filters to repo-local paths — this
 * function only extracts, it does not judge.
 * @param {string} source
 * @returns {string[]}
 */
export function extractImportSpecifiers(source) {
  const stripped = String(source ?? '')
    .replace(/^#!.*\n/, '') // shebang, if any (`#!/usr/bin/env node`) — not a comment, but not code either
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (incl. JSDoc) — do this first, may contain `//`
    .replace(/\/\/.*$/gm, ''); // line comments
  const out = [];
  // `import 'x'` / `import Foo from 'x'` / `import { a, b } from 'x'` (from-clause may span multiple lines —
  // the middle class excludes quotes/parens/semicolons so it can never cross into a NEXT statement).
  const staticRe = /\bimport\s+(?:[^'"();]*?\bfrom\s+)?['"]([^'"]+)['"]/g;
  for (const m of importHeader(stripped).matchAll(staticRe)) out.push(m[1]);
  // `import('x')` / `await import('x')` — excluded from staticRe above (no whitespace before `(`). Scanned over
  // the whole file (see importHeader's doc for why this one is NOT header-restricted).
  const dynamicRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of stripped.matchAll(dynamicRe)) out.push(m[1]);
  return out;
}

/**
 * Resolve a relative import specifier against the repo path of the file that contains it, to a repo-relative
 * path (no `we:` prefix, no `./`/`../`). Returns `null` for a non-relative specifier (bare package, `node:*`)
 * — those never resolve to a card-owned file, so there is nothing to classify.
 * @param {string} fromRepoPath
 * @param {string} specifier
 * @returns {string|null}
 */
export function resolveRelativeImport(fromRepoPath, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;
  const dir = pathPosix.dirname(fromRepoPath);
  return pathPosix.normalize(pathPosix.join(dir, specifier));
}

/** Extensions this tool ever treats a non-import path reference as pointing to — matches the kinds of files a
 *  `scope:` entry can itself be (`.mjs`/`.js` code, `.md` briefs/docs, `.json` data). PURE constant. */
const PATH_LITERAL_EXT_RE = /\.(?:mjs|js|md|json)$/;

/**
 * Extract candidate NON-import file-path references from one module's source text: the shapes #3906's live
 * failures actually used to reach a file this tool's `import`-only scan could never see (a mechanical build
 * provider that SPAWNS a script by path, a test that reads a doc/brief off disk, a helper joined in by
 * `__dirname`) — never a real parser, matched to house style exactly like {@link extractImportSpecifiers}:
 *   - `join(<base>, 'a', 'b', …, 'z.ext')` / `resolve(<base>, …)` — a `node:path` join whose FIRST argument is
 *     an arbitrary single identifier/member expression (`REPO_ROOT`, `ROOT`, `__dirname`, `import.meta.dirname`
 *     — never a nested call, see the limitation note below) and every argument after it is a plain literal;
 *     the literal segments are joined with `/` to form the candidate. Real case: #3906's
 *     `we:scripts/operations/dispatch-providers/build.mjs` — `join(REPO_ROOT, 'scripts', 'operations',
 *     'deliver-item-run.mjs')` (#3903's file — no single literal segment has a `/` in it, so nothing shorter
 *     than joining the whole call would find this).
 *   - `new URL('./x.ext', import.meta.url)` — the other house idiom for "a path next to this file".
 *   - a bare multi-segment literal that already reads like a repo path (`'./helpers/fake-claude.mjs'`,
 *     `'scripts/x.mjs'`) wherever it appears — a `readFileSync(...)` argument, a `spawn`/`execFileSync` argv
 *     array element, a plain constant. Scanned over the WHOLE file (comments stripped first), not just the
 *     header — unlike a static `import`, these calls are house-style at any depth.
 *
 * NOISE CONTROL: every candidate here is a GUESS, far more likely than a real `import` specifier to collide
 * with a string that merely looks path-shaped (a label, a fixture value). The caller is REQUIRED to keep only
 * a candidate that actually resolves to a real blob at the snapshot (`git cat-file -e`) before treating it as a
 * dependency — see the module doc / IO shell below. That existence gate, not this function, is what keeps a
 * coincidental match from becoming a finding.
 *
 * KNOWN LIMITATIONS (found live, #3906): a `join()`/`resolve()` call whose first argument is itself a nested
 * call (`join(dirname(fileURLToPath(import.meta.url)), …)` rather than a bound `__dirname`/`ROOT` identifier)
 * is not matched — the regex below deliberately stays single-identifier-only rather than hand-rolling a
 * balanced-expression scanner for one more argument position. A path assembled from a RUNTIME variable (e.g.
 * `we:scripts/operations/dispatch-lane-io.mjs#briefPath(root, kind)` picking a brief filename out of a
 * `kind`-keyed lookup table, then joining it elsewhere) is never resolvable from one file's text alone — this
 * is a real, accepted gap, not an oversight; see the epic-#3443 PR notes for which live #3906 findings it
 * explains and which it cannot.
 * @param {string} source
 * @returns {Array<{path:string, base:'dirname'|'root'}>} `path` is the candidate (repo-relative when
 *   `base==='root'`; relative-from-the-containing-file, `./`-normalized, when `base==='dirname'`) — NOT yet
 *   checked for existence.
 */
export function extractPathLiteralSpecifiers(source) {
  const stripped = String(source ?? '')
    .replace(/^#!.*\n/, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const out = [];
  const isDirnameBase = (baseArg) => baseArg === '__dirname' || baseArg === 'import.meta.dirname' || /\bdirname\b/.test(baseArg);

  // join(base, 'lit', 'lit', …, 'lit.ext') / resolve(base, 'lit', …) — base is one identifier/member
  // expression (no nested call); every following argument must be a plain single-quoted literal.
  const joinRe = /\b(?:join|resolve)\(\s*([\w.$]+)((?:\s*,\s*'[^'\n]*')+)\s*\)/g;
  for (const m of stripped.matchAll(joinRe)) {
    const segs = [...m[2].matchAll(/'([^']*)'/g)].map((s) => s[1]);
    if (!segs.length) continue;
    const joined = segs.join('/');
    if (!PATH_LITERAL_EXT_RE.test(joined)) continue;
    out.push({ path: joined, base: isDirnameBase(m[1]) ? 'dirname' : 'root' });
  }

  // new URL('./x.ext', import.meta.url)
  const urlRe = /\bnew\s+URL\(\s*'([^'\n]+)'\s*,\s*import\.meta\.url\s*\)/g;
  for (const m of stripped.matchAll(urlRe)) {
    if (PATH_LITERAL_EXT_RE.test(m[1])) out.push({ path: m[1], base: 'dirname' });
  }

  // a bare multi-segment literal anywhere (readFileSync arg, spawn/execFileSync argv element, plain constant).
  // Requires 2+ real `/`-separated segments — directory segments deliberately exclude `.` (`[\w-]+`, never
  // `[\w.-]+`) so a single-segment literal like `'./x.md'` cannot be absorbed by treating its OWN leading `.`
  // as a (degenerate, zero-width-prefix) directory segment; only the FINAL segment (the filename) allows dots,
  // via the explicit extension tail. A hidden directory component (`.github/x.md`) is the one real path shape
  // this excludes — accepted, since nothing this epic scans uses one.
  const bareRe = /'((?:\.\.?\/)?[\w-]+(?:\/[\w-]+)*\/[\w.-]+\.(?:mjs|js|md|json))'/g;
  for (const m of stripped.matchAll(bareRe)) {
    const lit = m[1];
    out.push({ path: lit, base: lit.startsWith('./') || lit.startsWith('../') ? 'dirname' : 'root' });
  }
  return out;
}

/**
 * Resolve one {@link extractPathLiteralSpecifiers} candidate against the repo path of the file that contains
 * it, to a repo-relative path — the non-`import` counterpart of {@link resolveRelativeImport}. PURE.
 * @param {string} fromRepoPath
 * @param {{path:string, base:'dirname'|'root'}} candidate
 * @returns {string}
 */
export function resolvePathLiteralSpecifier(fromRepoPath, candidate) {
  if (candidate.base === 'dirname') {
    const dir = pathPosix.dirname(fromRepoPath);
    const rel = candidate.path.startsWith('./') || candidate.path.startsWith('../') ? candidate.path : `./${candidate.path}`;
    return pathPosix.normalize(pathPosix.join(dir, rel));
  }
  return pathPosix.normalize(candidate.path.replace(/^\.\//, ''));
}

/** Every id reachable from `id`'s `blockedBy` edges, transitively (cycle-safe). PURE. */
export function transitiveBlockedBy(id, cardsById) {
  const out = new Set();
  const stack = [...(cardsById.get(id)?.blockedBy ?? [])];
  while (stack.length) {
    const b = stack.pop();
    if (out.has(b)) continue;
    out.add(b);
    for (const nb of cardsById.get(b)?.blockedBy ?? []) if (!out.has(nb)) stack.push(nb);
  }
  return out;
}

/**
 * Files declared in MORE THAN ONE open card's `scope:` — e.g. `we:scripts/operations/run.mjs` and
 * `we:scripts/operations/__tests__/http-adapter.test.mjs`, which epic #3443's own card documents as shared,
 * append-only files that every slice adds its own line to ("each slice appends only its own lines… so parallel
 * slices merge cleanly"). At the port SNAPSHOT such a file's content is already the union of every slice's
 * lines — not any one slice's own increment — so scanning it as if it were singly owned would misattribute the
 * WHOLE merged import graph to whichever one card happened to be checked, which is exactly the false-positive
 * flood this rule prevents. Generalized past the two named files: ANY scope path with 2+ open owners is
 * treated the same way, never hardcoded by filename. Caller skips these entirely as importers (does not read
 * or scan their content) but leaves them fully eligible as IMPORT TARGETS (unaffected — the existing per-card
 * scope-membership checks already look across every card, single- or multi-owned alike). PURE.
 * @param {Map<string,object>} cardsById
 * @returns {Map<string, string[]>} path -> owning card ids (open only), sorted by {@link idCompare}
 */
export function computeSharedFiles(cardsById) {
  const owners = new Map();
  for (const c of cardsById.values()) {
    if (c.status !== 'open') continue;
    for (const s of c.scope) {
      if (!owners.has(s)) owners.set(s, new Set());
      owners.get(s).add(c.id);
    }
  }
  const shared = new Map();
  for (const [path, ids] of owners) if (ids.size > 1) shared.set(path, [...ids].sort(idCompare));
  return shared;
}

/**
 * Topological depth of `id` in the OPEN-card `blockedBy` DAG: 0 if it has no open blocker, else
 * `1 + max(depth(blocker))` over its OPEN blockers (a resolved blocker has already landed — it costs no
 * further depth). Used only to rank several `later` owners of one test file by "lands last" — see the file
 * header for why this agrees with the epic's own hand-written Wave/critical-path notes. Cycle-safe (a cycle in
 * `blockedBy` is a data bug elsewhere; this returns 0 for the repeated id rather than looping forever).
 */
export function landingDepth(id, cardsById, seen = new Set()) {
  if (seen.has(id)) return 0;
  const card = cardsById.get(id);
  if (!card || !card.blockedBy.length) return 0;
  const nextSeen = new Set(seen);
  nextSeen.add(id);
  let max = 0;
  for (const b of card.blockedBy) {
    const bc = cardsById.get(b);
    if (!bc || bc.status !== 'open') continue;
    const d = 1 + landingDepth(b, cardsById, nextSeen);
    if (d > max) max = d;
  }
  return max;
}

/**
 * Classify one resolved import path for the card that owns the IMPORTING file.
 *
 * `driftedPaths` (default empty — every existing caller/test that omits it keeps the ORIGINAL "on-main always
 * wins" behaviour byte-for-byte) names paths that exist on `origin/main` but whose SNAPSHOT content differs
 * from it — e.g. #3906's live case, `we:scripts/operations/completion-record.mjs`: main already has the file
 * (so it would otherwise be silently `on-main`), but the branch's `COMPLETION_KINDS` adds `'task'`, which main
 * lacks — a real graduation-ordering hazard wearing an `on-main` costume. A drifted path still resolves
 * `on-main` UNLESS a sibling-slice `later` candidate exists for it (the SAME search `later` always ran) — a
 * drift nobody's open scope claims, or one only the importer's OWN card or an already-guaranteed blocker
 * claims, is main's ordinary evolution, not this epic's hazard, so it is left exactly as before.
 * @param {{repoPath:string, ownerId:string, cardsById:Map<string,object>, mainPaths:Set<string>, driftedPaths?:Set<string>}} a
 * @returns {{kind:'on-main'|'own'|'blocker'|'later'|'unowned', ownerId?:string}}
 */
export function classifyImportPath({ repoPath, ownerId, cardsById, mainPaths, driftedPaths = new Set() }) {
  const we = withWe(repoPath);
  const owner = cardsById.get(ownerId);
  const blockers = transitiveBlockedBy(ownerId, cardsById);
  // `later` is deliberately scoped to SIBLING slices of the SAME epic (`owner.parent`), never the whole
  // backlog. The same repo path can legitimately appear in an unrelated card's `scope:` too — e.g. a bug card
  // filed against the not-yet-landed branch file under a completely different epic (measured: one graduation
  // module here has FOUR open owners across three different epics, only one of which is this porting epic) —
  // and that card has nothing to do with this epic's landing order. Reaching outside the epic would propose
  // moving/blocking against a card the drain's Slice-procedure ordering never touches. Shared between the
  // plain "missing on main" path below and the on-main-but-DRIFTED path above it.
  const laterCandidates = () => {
    const candidates = [];
    for (const [id, c] of cardsById) {
      if (id === ownerId || blockers.has(id)) continue;
      if (c.status === 'open' && c.parent === owner?.parent && c.scope.includes(we)) candidates.push(id);
    }
    return candidates.sort(idCompare);
  };
  if (mainPaths.has(repoPath) || mainPaths.has(we)) {
    // A drift the ASKING card itself co-owns (the multi-owner "shared, append-only" files — e.g.
    // `we:scripts/operations/run.mjs`, owned by #3898/#3906/#3909 at once) is never promoted: the asking card
    // is by definition one of the file's own authors, exactly the `own` precedence the non-drifted path below
    // already gives it — a drifted file its OWN scope also claims is this card's job to land correctly, not a
    // hazard pointing somewhere else. Checked before the later-candidate search, not after, so a shared file's
    // simultaneous co-owners are never treated as "some OTHER card" for each other.
    const isOwn = owner && owner.scope.includes(we);
    if (!isOwn && (driftedPaths.has(repoPath) || driftedPaths.has(we))) {
      const candidates = laterCandidates();
      if (candidates.length) return { kind: 'later', ownerId: candidates[0] };
    }
    return { kind: 'on-main' };
  }
  if (owner && owner.scope.includes(we)) return { kind: 'own' };
  for (const bId of blockers) {
    if (cardsById.get(bId)?.scope.includes(we)) return { kind: 'blocker', ownerId: bId };
  }
  const candidates = laterCandidates();
  if (candidates.length) return { kind: 'later', ownerId: candidates[0] };
  return { kind: 'unowned' };
}

/**
 * Rank candidate owner ids by which one SHOULD end up hosting a multi-owner test file, deepest-first:
 *   1. greater `landingDepth` (lands later in the OPEN-card `blockedBy` DAG) wins;
 *   2. tie-break: a card that ALREADY carries ≥1 `blockedBy` entry wins over one with none — never make a
 *      currently blocker-free card (typically a foundational leaf, e.g. #3901) the first to gain a new
 *      blocker when an already-more-constrained alternative exists;
 *   3. further tie-break: {@link idCompare}, for determinism.
 * PURE. `planTestFileFix` walks this order looking for the first ACYCLIC placement — see its doc for why
 * "deepest" alone (this order's #1) is not sufficient on its own to pick a placement.
 */
export function rankOwnerCandidates(ids, cardsById) {
  return [...new Set(ids)].sort((a, b) => {
    const da = landingDepth(a, cardsById), db = landingDepth(b, cardsById);
    if (da !== db) return db - da;
    const ha = (cardsById.get(a)?.blockedBy.length ?? 0) > 0 ? 1 : 0;
    const hb = (cardsById.get(b)?.blockedBy.length ?? 0) > 0 ? 1 : 0;
    if (ha !== hb) return hb - ha;
    return idCompare(a, b);
  });
}

const isTestFile = (repoOrWePath) => /\.test\.mjs$/.test(repoOrWePath);

/** Would giving `target` a `blockedBy` edge on `blockerId` create a cycle? True iff `target` is already
 *  (transitively) a dependency OF `blockerId` — i.e. `blockerId` needs `target` to land first, so `target`
 *  cannot also need `blockerId` first. PURE. */
function wouldCycle(target, blockerId, cardsById) {
  return transitiveBlockedBy(blockerId, cardsById).has(target);
}

/**
 * Choose the home for a test file with imports spread across several cards, and the extra `blockedBy` edges
 * that placement needs. THE CANDIDATE SET IS the file's CURRENT owner plus every `later`-classified owner —
 * not just the `later` owners — because the current owner may ALREADY own some of the file's other imports
 * (classified `own`), and those are exactly as real a constraint on where the file can safely live.
 *
 * Real case found live that a naive "move to whichever later-owner lands deepest" gets BACKWARDS:
 * `action-dispatch-paths.test.mjs` lives at #3856 (owns `land-advance-io.mjs`) and also imports
 * `action-store.mjs`/`action-record.mjs`, both #3901's. #3901 is a foundational LEAF (currently zero
 * `blockedBy`, feeding #3902/#3906/#3907/#3863 downstream); #3856 sits at the END of the land-advance chain
 * (7 blockers already). Only looking at the later owner (#3901) and moving there, then blocking #3901 on
 * #3856, would give a foundational leaf a brand-new dependency on something far downstream — stalling
 * everything #3901 feeds behind the whole land-advance chain. The right call is the reverse: the file STAYS
 * at #3856 (already the deeper, already-more-constrained card — so `target === currentOwnerId` here, no scope
 * move at all) and #3856 gains `blockedBy #3901` instead.
 *
 * Mechanism: rank the candidate set with {@link rankOwnerCandidates} (deepest, then already-has-blockers,
 * first) and walk that order picking the first candidate that can safely receive a `blockedBy` edge to EVERY
 * other candidate (no cycle) — never picking a shallower/blocker-free candidate over a deeper acyclic one.
 * Falls back to the top-ranked candidate (reporting the unavoidable edges as `cycleWarnings`) only if no
 * candidate is fully clean — a genuine circular need between two slices, left for a human.
 *
 * Once a target is chosen, every import of the file is RE-classified as if it belonged to that target (not
 * just the original candidate owners) — a move can turn some other import (safely `own`/`blocker` under the
 * old owner) into a fresh hazard under the new one, exactly the mechanism the #3895→#3908 case needed
 * (residual `blockedBy #3905`). PURE.
 * @param {{currentOwnerId:string, classifications:Array, cardsById:Map<string,object>, mainPaths:Set<string>, driftedPaths?:Set<string>}} a
 * @returns {{target:string, addBlockedBy:string[], cycleWarnings:Array<{path:string, ownerId:string}>}|null}
 *   `null` when the file has no `later` import (nothing to place for). `target === currentOwnerId` means
 *   "stays put" — the caller must not treat that as a scope move.
 */
export function planTestFileFix({ currentOwnerId, classifications, cardsById, mainPaths, driftedPaths = new Set(), sharedPaths = new Set() }) {
  // A SHARED (multi-owner, append-only) file — `we:scripts/operations/run.mjs` is the named case, co-owned by
  // several open siblings at once by house convention ("each slice appends only its own lines") — is never a
  // placement factor and never earns a `blockedBy` edge: any card can freely become one more co-owner of it.
  // Filtered out here, at both call sites below, so it can only ever resolve through `addToScope` (the SAME
  // path `unowned` already takes) — never through a `move`/`blockedBy` decision built for a genuinely
  // single-owner file.
  const isShared = (c) => sharedPaths.has(withWe(c.repoPath));
  const laterOwnerIds = classifications.filter((c) => c.kind === 'later' && !isShared(c)).map((c) => c.ownerId);
  if (!laterOwnerIds.length) return null;
  const candidates = [...new Set([currentOwnerId, ...laterOwnerIds])];
  const ranked = rankOwnerCandidates(candidates, cardsById);
  const isFullyAcyclic = (t) => candidates.every((other) => other === t || !wouldCycle(t, other, cardsById) || transitiveBlockedBy(t, cardsById).has(other));
  const target = ranked.find(isFullyAcyclic) ?? ranked[0];

  const addBlockedBy = new Set();
  const cycleWarnings = [];
  for (const c of classifications) {
    if (isShared(c)) continue; // becomes a co-owner via addToScope under whichever card ends up owning the file
    // Every import is RE-classified under `target`, including one that read `on-main` under the OLD owner —
    // with `driftedPaths` in play that is no longer owner-independent (the sibling-candidate search a drift
    // check runs excludes the ASKING owner and ITS blockers, which differ at `target`) — a plain on-main entry
    // (not drifted, or drifted but unclaimed) reclassifies right back to `on-main` here regardless, so this
    // costs an extra call, never a different answer, when there is no drift to reconsider.
    const under = classifyImportPath({ repoPath: c.repoPath, ownerId: target, cardsById, mainPaths, driftedPaths });
    if (under.kind !== 'later') continue; // own/blocker/on-main under the chosen home — no edge needed
    if (under.ownerId === target) continue; // defensive; classifyImportPath never returns this
    if (wouldCycle(target, under.ownerId, cardsById)) cycleWarnings.push({ path: c.repoPath, ownerId: under.ownerId });
    else addBlockedBy.add(under.ownerId);
  }
  return { target, addBlockedBy: [...addBlockedBy].sort(idCompare), cycleWarnings };
}

/**
 * Group per-import classifications into per-file findings with a proposed fix. Only files carrying a `later`
 * or `unowned` classification produce a finding — `on-main`/`own`/`blocker` are silently fine.
 * @param {{cardsById:Map<string,object>, mainPaths:Set<string>, driftedPaths?:Set<string>, sharedPaths?:Set<string>, results:Array<{ownerId:string, file:string, classifications:Array}>}} a
 *   `results[i].classifications` items are `{specifier, repoPath, ...classifyImportPath() result}`.
 * @returns {Array<object>} one entry per (card, file) with a finding.
 */
export function buildFindings({ cardsById, mainPaths, driftedPaths = new Set(), sharedPaths = new Set(), results }) {
  const findings = [];
  for (const r of results) {
    const isShared = (c) => sharedPaths.has(withWe(c.repoPath));
    // A `later`-classified path that is ALREADY a multi-owner SHARED file (see planTestFileFix's doc) is split
    // off here too — it resolves through `addToScope` exactly like `unowned`, never through `move`/`blockedBy`.
    const laterAll = r.classifications.filter((c) => c.kind === 'later');
    const later = laterAll.filter((c) => !isShared(c));
    const laterShared = laterAll.filter(isShared);
    const unowned = r.classifications.filter((c) => c.kind === 'unowned');
    if (!later.length && !laterShared.length && !unowned.length) continue;
    const test = isTestFile(r.file);
    let fix;
    if (later.length) {
      if (test) {
        fix = { kind: 'move', ...planTestFileFix({ currentOwnerId: r.ownerId, classifications: r.classifications, cardsById, mainPaths, driftedPaths, sharedPaths }) };
      } else {
        // An impl file cannot move (the card's own scope IS the code) — but a proposed blockedBy edge can
        // still cycle (the later owner already depends, transitively, on THIS card). Real case, #3906: its own
        // `dispatch-providers/build.mjs` needs #3903's `deliver-item-run.mjs`, but #3903 is ALREADY `blockedBy`
        // #3906 — so `wouldCycle(3906, 3903)` is true. That very fact is what makes a DIFFERENT fix safe: since
        // #3903 already lands after #3906 no matter what, relocating the one dependency FILE itself out of
        // #3903's scope and into #3906's own scope needs no new edge at all — #3906 already has it, by
        // definition, once it owns it. (Anything inside #3903 that also needs the file keeps seeing it land in
        // time: it now reaches #3906 as a `blocker`, the exact edge that caused this cycle in the first place.)
        // Only fall back to a plain cycle warning — never silently do nothing — for a `later` owner NEITHER a
        // safe blockedBy edge NOR this move can resolve, which cannot happen here: `wouldCycle` false takes the
        // blockedBy branch, `wouldCycle` true takes the move branch, covering both outcomes.
        const targets = [], moveIn = [], byTarget = new Map();
        for (const c of later) {
          if (!byTarget.has(c.ownerId)) byTarget.set(c.ownerId, []);
          byTarget.get(c.ownerId).push(c.repoPath);
        }
        for (const [t, paths] of byTarget) {
          if (wouldCycle(r.ownerId, t, cardsById)) for (const p of paths) moveIn.push({ path: p, fromOwnerId: t });
          else targets.push(t);
        }
        fix = { kind: 'blockedBy', targets: targets.sort(idCompare), moveIn, cycleWarnings: [] };
      }
    } else {
      // Every remaining import is `unowned` and/or a SHARED co-ownership add: `unowned` — the branch has the
      // file, but no OPEN card in the epic claims it, so it has to be ported together with the code that needs
      // it (never invented as a new card, never guessed onto some other card); `laterShared` — the referencing
      // card simply becomes one more append-only co-owner of an already-multi-owned file. Both resolve the
      // SAME way: add to the IMPORTING card's own scope, nothing else.
      fix = { kind: 'add-to-scope', owner: r.ownerId, paths: [] };
    }
    // A file can carry `later`/`unowned`/shared-`later` imports at once. Whichever card ends up owning the
    // FILE (the move target, or this card unchanged) is also the one whose scope should gain the unowned AND
    // shared-co-ownership path(s) — same reasoning as the unowned-only case above, just attached to whatever
    // the primary fix already is.
    const scopeAdds = [...unowned, ...laterShared];
    if (scopeAdds.length) {
      const owner = fix.kind === 'move' ? fix.target : r.ownerId;
      fix.addToScope = { owner, paths: scopeAdds.map((c) => withWe(c.repoPath)) };
      if (fix.kind === 'add-to-scope') fix.paths = fix.addToScope.paths; // unowned/shared-only: same list, top-level too
    }
    findings.push({ ownerId: r.ownerId, file: r.file, isTest: test, later, laterShared, unowned, fix });
  }
  return findings.sort((a, b) => idCompare(a.ownerId, b.ownerId) || a.file.localeCompare(b.file));
}

/** One-line, human-readable rendering of a finding's proposed fix. PURE. */
export function describeFix(finding) {
  const sharedWe = new Set((finding.laterShared ?? []).map((c) => withWe(c.repoPath)));
  const scopeSuffix = finding.fix.addToScope?.paths.length
    ? `; add ${finding.fix.addToScope.paths.map((p) => `\`${p}\` (${sharedWe.has(p) ? 'shared file — new co-owner' : 'unowned'})`).join(', ')} to #${finding.fix.addToScope.owner}'s scope`
    : '';
  if (finding.fix.kind === 'move') {
    const cyc = finding.fix.cycleWarnings?.length
      ? ` — MANUAL: ${finding.fix.cycleWarnings.map((w) => `${withWe(w.path)} needs #${w.ownerId}, which would cycle`).join('; ')}`
      : '';
    if (finding.fix.target === finding.ownerId) {
      const extra = finding.fix.addBlockedBy?.length ? ` blockedBy ${finding.fix.addBlockedBy.map((t) => `#${t}`).join(', ')}` : '';
      return `stays here; add${extra}${cyc}${scopeSuffix}`;
    }
    const extra = finding.fix.addBlockedBy?.length ? `, plus blockedBy ${finding.fix.addBlockedBy.map((t) => `#${t}`).join(', ')} (its other imports, under the new owner)` : '';
    return `move to #${finding.fix.target} (lands last among: ${finding.later.map((c) => `#${c.ownerId}`).join(', ')})${extra}${cyc}${scopeSuffix}`;
  }
  if (finding.fix.kind === 'blockedBy') {
    const cyc = finding.fix.cycleWarnings?.length
      ? ` — MANUAL: #${finding.fix.cycleWarnings.map((w) => w.ownerId).join(', #')} would cycle`
      : '';
    const bb = finding.fix.targets.length ? `add blockedBy ${finding.fix.targets.map((t) => `#${t}`).join(', ')}` : '';
    const mv = finding.fix.moveIn?.length
      ? finding.fix.moveIn.map((m) => `move \`${withWe(m.path)}\` here from #${m.fromOwnerId} (blockedBy the other way would cycle)`).join('; ')
      : '';
    return [bb, mv].filter(Boolean).join('; ') + cyc + scopeSuffix;
  }
  if (finding.fix.kind === 'add-to-scope') {
    return `add ${finding.fix.paths.map((p) => `\`${p}\` (${sharedWe.has(p) ? 'shared file — new co-owner' : 'unowned; ports with the code that needs it'})`).join(', ')} to #${finding.fix.owner}'s own scope`;
  }
  return finding.fix.reason;
}

/**
 * A batch-level cycle backstop. Every PER-FINDING cycle guard in this file (`wouldCycle`, `planTestFileFix`'s
 * `isFullyAcyclic`) checks ONE proposed edge against the graph as it stood BEFORE this run's edits — necessary
 * but not sufficient, because a single run can propose MANY edges from MANY independent findings, and two of
 * them can each look safe alone yet jointly close a cycle. Real case, epic #3443's live run: one finding added
 * #3906 `blockedBy` #3907 (a moved-in test's residual import); a SEPARATE, independently-computed finding in
 * the SAME run added #3907 `blockedBy` #3906 (an impl file's own import) — neither `wouldCycle` call could see
 * the other, since each checked only the pre-run graph, but the batch's UNION is a direct 2-cycle.
 *
 * `createCycleGuard(cardsById)` returns a `tryAddEdge(from, to)` closure over a MUTABLE clone of the graph:
 * each accepted edge is folded in immediately, so the NEXT call in the same batch sees it — turning the
 * "compute every finding against one static snapshot" pipeline into a de-facto sequential one for cycle
 * purposes, without restructuring `buildFindings` itself. Rejects (returns `false` for) any edge that would
 * make `from` and `to` mutually dependent, INCLUDING one closed only by edges THIS SAME BATCH already added —
 * the rejected edge is simply not applied this run; the next run reconsiders it against the graph as it then
 * stands (typically resolving differently once other edges/moves from this run have landed). PURE.
 * @param {Map<string,{id:string, blockedBy:string[]}>} cardsById
 * @returns {(from:string, to:string) => boolean}
 */
export function createCycleGuard(cardsById) {
  const adj = new Map([...cardsById].map(([id, c]) => [id, new Set(c.blockedBy)]));
  const reaches = (from, to, seen = new Set()) => {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    for (const b of adj.get(from) ?? []) if (reaches(b, to, seen)) return true;
    return false;
  };
  return (from, to) => {
    if (from === to || reaches(to, from)) return false; // `to` already (transitively) needs `from` first
    if (!adj.has(from)) adj.set(from, new Set());
    adj.get(from).add(to);
    return true;
  };
}

/**
 * Turn findings into the edits each affected card needs: `scope:`/`blockedBy:` array changes plus a dated
 * one-line note for BOTH sides of every move/blockedBy edge — exactly what `--apply` writes, nothing else.
 * PURE (caller supplies `today`). Only `move` and `blockedBy` fixes produce edits; `unresolved` has no card to
 * point a fix at, so it is left for a human and never auto-applied.
 *
 * `cardsById`, when supplied, arms the {@link createCycleGuard} batch backstop over every `addBlockedBy` edge
 * this call proposes — omitted (the default), every edge is taken as each finding proposed it, matching every
 * existing caller/test's behaviour byte-for-byte. A dropped edge is recorded on the returned Map as a non-
 * enumerable-looking but perfectly ordinary extra property, `.droppedEdges` (`{from, to}[]`), always `[]` when
 * `cardsById` is omitted — read it, never assume every proposed edge landed.
 *
 * Scope MOVES get the same batch-level treatment, always (no `cardsById` needed): each finding proposes its
 * move(s) independently, so two findings can each relocate the SAME single-owner file to DIFFERENT cards —
 * e.g. T `blockedBy` both A and B, and A's and B's impl files both need T's `x.mjs`, so each `moveIn`s it.
 * Applying both would remove it from T once but add it to A AND B, and the next run's `computeSharedFiles`
 * would then read that accident as an intentional multi-owner SHARED file and stop scanning it — silently
 * masking its own dependencies. So the FIRST move of a path this batch wins; a later one to a different card
 * is dropped (no scope change, no notes) and recorded on `.droppedMoves` (`{path, from, to, keptAt}[]`). The
 * next run reconsiders it against the updated graph (B then sees `x.mjs` under A, an ordinary dependency).
 * A repeat move of the same path to the SAME card is simply a no-op.
 * @param {Array<object>} findings  from {@link buildFindings}
 * @param {string} today  `YYYY-MM-DD`
 * @param {{cardsById?:Map<string,object>}} [opts]
 * @returns {Map<string, {removeScope:string[], addScope:string[], addBlockedBy:string[], notes:string[]}> & {droppedEdges: Array<{from:string,to:string}>, droppedMoves: Array<{path:string,from:string,to:string,keptAt:string}>}}
 */
export function planEdits(findings, today, { cardsById } = {}) {
  const edits = new Map();
  const droppedEdges = [];
  const droppedMoves = [];
  edits.droppedEdges = droppedEdges;
  edits.droppedMoves = droppedMoves;
  const tryAddEdge = cardsById ? createCycleGuard(cardsById) : () => true;
  const movedTo = new Map(); // we:path -> the card this batch already moved it into
  /** `'new'` = apply this move; `'repeat'` = already moved to this same card (no-op); `'dropped'` = another
   *  card already took it this batch — skip the move AND everything that assumes it happened. */
  const claimMove = (path, from, to) => {
    const key = withWe(path);
    const keptAt = movedTo.get(key);
    if (keptAt === undefined) { movedTo.set(key, to); return 'new'; }
    if (keptAt === to) return 'repeat';
    droppedMoves.push({ path: key, from, to, keptAt });
    return 'dropped';
  };
  const get = (id) => {
    if (!edits.has(id)) edits.set(id, { removeScope: [], addScope: [], addBlockedBy: [], notes: [] });
    return edits.get(id);
  };
  for (const f of findings) {
    if (f.fix.kind === 'move') {
      const target = f.fix.target;
      const claim = target === f.ownerId ? 'stays' : claimMove(f.file, f.ownerId, target);
      // A dropped move never reached `target`, so neither its residual blockedBy edges nor its `addToScope`
      // (which follows the file to `target`) apply — skip the whole finding; the next run reconsiders it.
      if (claim === 'dropped') continue;
      if (claim === 'new') {
        get(f.ownerId).removeScope.push(f.file);
        get(target).addScope.push(f.file);
        get(f.ownerId).notes.push(`- ${today}: graduation-import-check moved \`${f.file}\` to #${target} — it imports a module #${target} owns.`);
        get(target).notes.push(`- ${today}: graduation-import-check moved \`${f.file}\` here from #${f.ownerId} — it imports a module this card owns.`);
      }
      // Placing (or keeping) the file at `target` can leave one of its OTHER imports uncovered — see
      // planTestFileFix's doc for the #3901/#3856 and #3895/#3908 shapes this covers. Fix with blockedBy on
      // `target` rather than moving again (which could ping-pong between two unrelated owners forever).
      for (const t of f.fix.addBlockedBy ?? []) {
        if (!tryAddEdge(target, t)) { droppedEdges.push({ from: target, to: t }); continue; }
        get(target).addBlockedBy.push(t);
        get(target).notes.push(`- ${today}: graduation-import-check added blockedBy #${t} — the moved-in \`${f.file}\` also imports a module #${t} owns.`);
        get(t).notes.push(`- ${today}: graduation-import-check made this a blocker of #${target} — its moved-in \`${f.file}\` imports a module this card owns.`);
      }
    } else if (f.fix.kind === 'blockedBy') {
      for (const t of f.fix.targets) {
        if (!tryAddEdge(f.ownerId, t)) { droppedEdges.push({ from: f.ownerId, to: t }); continue; }
        get(f.ownerId).addBlockedBy.push(t);
        get(f.ownerId).notes.push(`- ${today}: graduation-import-check added blockedBy #${t} — \`${f.file}\` imports a module #${t} owns.`);
        get(t).notes.push(`- ${today}: graduation-import-check made this a blocker of #${f.ownerId} — its \`${f.file}\` imports a module this card owns.`);
      }
      // The later owner is ALREADY (transitively) blockedBy `f.ownerId` — a blockedBy edge the other way would
      // cycle, so the specific dependency FILE moves here instead. Safe by construction: `f.ownerId` already
      // lands before `fromOwnerId` no matter what, so anything inside `fromOwnerId` that still needs this file
      // reaches it as a `blocker` on its next scan (the very edge that made a `blockedBy` fix cycle here).
      for (const mv of f.fix.moveIn ?? []) {
        const p = withWe(mv.path);
        if (claimMove(p, mv.fromOwnerId, f.ownerId) !== 'new') continue;
        get(mv.fromOwnerId).removeScope.push(p);
        get(f.ownerId).addScope.push(p);
        get(mv.fromOwnerId).notes.push(`- ${today}: graduation-import-check moved \`${p}\` to #${f.ownerId} — #${f.ownerId}'s \`${f.file}\` needs it directly, and this card already (transitively) depends on #${f.ownerId}, so a blockedBy edge the other way would cycle.`);
        get(f.ownerId).notes.push(`- ${today}: graduation-import-check moved \`${p}\` here from #${mv.fromOwnerId} — this card's \`${f.file}\` needs it directly, and a blockedBy edge to #${mv.fromOwnerId} would cycle (it already depends on this card).`);
      }
    }
    if (f.fix.addToScope?.paths.length) {
      const { owner, paths } = f.fix.addToScope;
      for (const p of paths) {
        get(owner).addScope.push(p);
        get(owner).notes.push(`- ${today}: graduation-import-check added ${p} to this card's own scope — no open card owned it, and it is imported by \`${f.file}\`, which this card ports.`);
      }
    }
  }
  return edits;
}

/** Read a card's inline JSON-array frontmatter field (`scope:`/`blockedBy:` are always `["a", "b"]` in this
 *  repo's cards — valid JSON), or `[]` if absent/unparseable. PURE (operates on already-read file text). */
export function readArrayField(content, key) {
  const raw = readField(content, key);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch { return []; }
}

/** Render + splice an array field back with this repo's house style (`, ` between entries — plain
 *  `JSON.stringify` omits the space, which would diff-noise every untouched entry). PURE. */
export function writeArrayField(content, key, arr, { after = [] } = {}) {
  const rendered = `[${arr.map((v) => JSON.stringify(v)).join(', ')}]`;
  return setFrontmatterField(content, key, rendered, { after });
}

const GRAD_NOTE_HEADING = '## Graduation import check';

/** Append one dated note line under a (created-if-absent) `## Graduation import check` section, right after the
 *  heading — so repeat runs stack newest-first without needing to locate "end of section". Idempotent: a byte-
 *  identical line already present is not duplicated. PURE. */
export function appendGraduationNote(content, line) {
  if (content.includes(line)) return content;
  const idx = content.indexOf(GRAD_NOTE_HEADING);
  if (idx === -1) return `${content.replace(/\s+$/, '')}\n\n${GRAD_NOTE_HEADING}\n\n${line}\n`;
  let insertAt = content.indexOf('\n', idx);
  insertAt = insertAt === -1 ? content.length : insertAt + 1;
  if (content[insertAt] === '\n') insertAt += 1;
  return content.slice(0, insertAt) + `${line}\n` + content.slice(insertAt);
}

/**
 * Apply one card's planned edit to its raw file text. Touches ONLY `scope:`, `blockedBy:` and an appended
 * `## Graduation import check` note — no other frontmatter field is ever read or written. PURE.
 * @param {string} content
 * @param {{removeScope?:string[], addScope?:string[], addBlockedBy?:string[], notes?:string[]}} edit
 * @returns {string}
 */
export function applyCardEdits(content, edit) {
  let next = content;
  const { removeScope = [], addScope = [], addBlockedBy = [], notes = [] } = edit;
  if (removeScope.length || addScope.length) {
    let scope = readArrayField(next, 'scope').filter((s) => !removeScope.includes(s));
    for (const s of addScope) if (!scope.includes(s)) scope.push(s);
    next = writeArrayField(next, 'scope', scope, { after: ['blockedBy', 'status', 'parent', 'size', 'kind'] }) ?? next;
  }
  if (addBlockedBy.length) {
    const bb = readArrayField(next, 'blockedBy');
    for (const t of addBlockedBy) if (!bb.includes(t)) bb.push(t);
    next = writeArrayField(next, 'blockedBy', bb, { after: ['status', 'parent', 'size', 'kind'] }) ?? next;
  }
  for (const note of notes) next = appendGraduationNote(next, note);
  return next;
}

// ---------------------------------------------------------------------------------------------------------------
// IO shell — the only part that touches fs/git. Everything above stays testable on plain objects/strings.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function readBacklogCards(backlogDir) {
  const cards = new Map();
  const files = new Map(); // id -> {name, abs}
  for (const name of readdirSync(backlogDir)) {
    if (!name.endsWith('.md')) continue;
    const abs = join(backlogDir, name);
    let text;
    try { text = readFileSync(abs, 'utf8'); } catch { continue; }
    const card = parseCard(name, text);
    if (!card) continue;
    cards.set(card.id, card);
    files.set(card.id, { name, abs, rel: `backlog/${name}`, text });
  }
  return { cards, files };
}

/** `git show <ref>:<path>` → text, or `null` if the ref/path doesn't resolve (moved/renamed/never existed). */
function gitShow(ref, repoPath) {
  try { return execFileSync('git', ['show', `${ref}:${repoPath}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
  catch { return null; }
}

/** `git cat-file -e <ref>:<path>` → does the blob exist (cheaper than reading it when only existence matters). */
function existsAtRef(ref, repoPath) {
  try { execFileSync('git', ['cat-file', '-e', `${ref}:${repoPath}`], { cwd: ROOT, stdio: 'pipe' }); return true; }
  catch { return false; }
}

function parseArgs(argv) {
  const flag = (name, dflt) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : dflt;
  };
  return {
    snapshot: flag('snapshot', '600acc14f'),
    parent: flag('parent', '3443'),
    json: argv.includes('--json'),
    apply: argv.includes('--apply'),
  };
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const backlogDir = join(ROOT, 'backlog');
  const { cards: cardsById, files } = readBacklogCards(backlogDir);

  const targets = [...cardsById.values()].filter((c) => c.status === 'open' && c.parent === args.parent);
  // Shared-file detection is scoped to THIS epic's own sibling slices, not the whole backlog — "each slice
  // appends only its own lines" is a claim epic #3443 makes about ITS OWN cards; a file two unrelated stories
  // elsewhere in the repo both happen to touch (e.g. `we:scripts/check-standards.mjs`) is not that pattern.
  const targetsById = new Map(targets.map((c) => [c.id, c]));
  const sharedFiles = computeSharedFiles(targetsById);

  const results = [];
  const warnings = [];
  const toCheckOnMain = new Set();
  const perFileImports = []; // { ownerId, file, resolved: [{specifier, repoPath, via}] }

  // `.mjs`/`.js` only — the SOURCE side of a scan (what gets read and parsed for references). `.md`/`.json`
  // are still valid TARGET extensions (a brief, a data file) — see PATH_LITERAL_EXT_RE — just never scanned
  // themselves; nothing this epic's slices scope reads a doc/data file's OWN prose for further references.
  const SOURCE_EXT_RE = /\.(?:mjs|js)$/;
  for (const card of targets) {
    for (const file of card.scope) {
      if (!SOURCE_EXT_RE.test(file)) continue;
      if (sharedFiles.has(file)) continue; // reported once below, not once per owning card
      const repoPath = stripWe(file);
      const src = gitShow(args.snapshot, repoPath);
      if (src == null) {
        warnings.push(`could not read ${file} at ${args.snapshot} (git show failed) — skipped`);
        continue;
      }
      const resolved = [];
      const seen = new Set(); // dedupe: an import specifier's own text can also match the path-literal scan
      const addResolved = (specifier, rp, via) => {
        if (!rp || rp === repoPath || seen.has(rp)) return;
        seen.add(rp);
        resolved.push({ specifier, repoPath: rp, via });
        toCheckOnMain.add(rp);
      };
      for (const spec of extractImportSpecifiers(src)) addResolved(spec, resolveRelativeImport(repoPath, spec), 'import');
      for (const cand of extractPathLiteralSpecifiers(src)) {
        const rp = resolvePathLiteralSpecifier(repoPath, cand);
        // A path-LITERAL candidate is a guess (unlike a real `import`, which is unambiguous by construction) —
        // only count one that actually resolves to a real blob at the snapshot, per the card's own instructions.
        if (rp && rp !== repoPath && !seen.has(rp) && existsAtRef(args.snapshot, rp)) addResolved(cand.path, rp, 'path');
      }
      perFileImports.push({ ownerId: card.id, file, resolved });
    }
  }

  for (const [path, ids] of sharedFiles) warnings.push(`${path} is shared across ${ids.map((i) => `#${i}`).join(', ')} (append-only) — not scanned as an importer`);

  const mainPaths = new Set();
  for (const p of toCheckOnMain) if (existsAtRef('origin/main', p)) mainPaths.add(p);

  // CONTENT-DRIFT: a path that already exists on `origin/main` is normally unconditionally safe (`on-main`) —
  // but if it is ALSO in some open sibling slice's own `scope:` (the slice that will actually change it), its
  // CURRENT main content is not what this epic promises to land; only its post-port content is. Bounded to
  // paths that are BOTH referenced (already in `mainPaths`) AND scope-claimed — never the whole epic's scope,
  // and never a full-repo sweep — so the extra `git show` pair this costs stays proportional to what a run
  // already does. Real cases: `we:scripts/operations/completion-record.mjs` (#3903 — main lacks `'task'` in
  // `COMPLETION_KINDS`), `we:docs/agent/dispatcher-runbook.md` (#3910),
  // `we:scripts/operations/__tests__/helpers/fake-claude.mjs` (#3907).
  //
  // EXCLUDES `.json` — measured live: without this, `we:scripts/conveyor/run-scorecards.json` (a LIVE scorecard
  // file that keeps changing on `main` for reasons that have nothing to do with this epic) surfaced as a false
  // graduation hazard — and #3443's OWN tail-sweep card (#3910) already rules explicitly that this exact file
  // "is runtime data, not code… never ported/edited". Generalized past that one named file, on the same
  // reasoning: a `.json` sibling in this epic's scope is a DATA artifact a slice's tests fixture against, not a
  // behavioral file whose drift is a landing-order hazard the way a `.mjs`/`.md` file's drift can be.
  const scopedOnMain = new Set();
  for (const t of targets) for (const s of t.scope) {
    const rp = stripWe(s);
    if (rp.endsWith('.json')) continue;
    if (mainPaths.has(rp)) scopedOnMain.add(rp);
  }
  const driftedPaths = new Set();
  for (const rp of scopedOnMain) {
    const snapText = gitShow(args.snapshot, rp);
    const mainText = gitShow('origin/main', rp);
    if (snapText != null && mainText != null && snapText !== mainText) driftedPaths.add(rp);
  }
  for (const rp of [...driftedPaths].sort()) {
    warnings.push(`${withWe(rp)} exists on origin/main but its content at ${args.snapshot} differs — treated as a graduation dependency, not "on-main"`);
  }

  for (const { ownerId, file, resolved } of perFileImports) {
    const classifications = resolved.map(({ specifier, repoPath, via }) => ({
      specifier, repoPath, via, ...classifyImportPath({ repoPath, ownerId, cardsById, mainPaths, driftedPaths }),
    }));
    results.push({ ownerId, file, classifications });
  }

  const sharedWePaths = new Set(sharedFiles.keys());
  const findings = buildFindings({ cardsById, mainPaths, driftedPaths, sharedPaths: sharedWePaths, results });

  if (args.apply) {
    const edits = planEdits(findings, localToday(), { cardsById });
    for (const { from, to } of edits.droppedEdges) {
      warnings.push(`--apply: dropped blockedBy #${to} on #${from} — would cycle once combined with another edge THIS SAME RUN also added; re-run to reconsider it against the updated graph`);
    }
    for (const { path, from, to, keptAt } of edits.droppedMoves) {
      warnings.push(`--apply: dropped moving \`${path}\` from #${from} to #${to} — THIS SAME RUN already moved it to #${keptAt} (one owner only); re-run to reconsider it against the updated graph`);
    }
    for (const [id, edit] of edits) {
      const f = files.get(id);
      if (!f) { warnings.push(`--apply: no card file found for #${id} (referenced by an edit) — skipped`); continue; }
      const before = readFileSync(f.abs, 'utf8');
      const after = applyCardEdits(before, edit);
      if (after !== before) writeBacklogMd(f.abs, f.rel, after, { root: ROOT });
    }
  }

  report({ args, targets, findings, warnings });
  process.exit(findings.length ? 1 : 0);
}

function report({ args, targets, findings, warnings }) {
  if (args.json) {
    process.stdout.write(`${JSON.stringify({
      snapshot: args.snapshot,
      parent: args.parent,
      cardsChecked: targets.length,
      findings: findings.map((f) => ({
        card: f.ownerId, file: f.file, isTest: f.isTest,
        laterImports: f.later.map((c) => ({ path: withWe(c.repoPath), owner: c.ownerId, via: c.via })),
        sharedLaterImports: f.laterShared.map((c) => ({ path: withWe(c.repoPath), via: c.via })),
        unownedImports: f.unowned.map((c) => ({ path: withWe(c.repoPath), via: c.via })),
        fix: f.fix,
      })),
      warnings,
      applied: args.apply,
    }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`graduation-import-check — snapshot ${args.snapshot}, parent #${args.parent}, ${targets.length} open card(s) checked${args.apply ? ' (--apply)' : ''}\n\n`);
  for (const w of warnings) process.stdout.write(`  ⚠ ${w}\n`);
  if (!findings.length) {
    process.stdout.write('  ✓ no findings — every scoped file imports only on-main / own / blocker paths.\n');
    return;
  }
  process.stdout.write(`  ${findings.length} finding(s):\n\n`);
  for (const f of findings) {
    process.stdout.write(`  #${f.ownerId}  ${f.file}${f.isTest ? '  [test]' : '  [impl]'}\n`);
    for (const c of f.later) process.stdout.write(`        later:  ${withWe(c.repoPath)}  → owned by #${c.ownerId}${c.via === 'path' ? '  (found via non-import path reference)' : ''}\n`);
    for (const c of f.laterShared) process.stdout.write(`        shared: ${withWe(c.repoPath)}  → becomes a new co-owner${c.via === 'path' ? '  (found via non-import path reference)' : ''}\n`);
    for (const c of f.unowned) process.stdout.write(`        unowned: ${withWe(c.repoPath)}${c.via === 'path' ? '  (found via non-import path reference)' : ''}\n`);
    process.stdout.write(`        fix → ${describeFix(f)}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) run();
