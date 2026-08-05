/**
 * verdict-totality.mjs — the DERIVE-BASED enum-totality gate for `VERDICTS` (#2823, item `xiqj3w9`).
 *
 * WHY: PR #976 added a fourth `VERDICTS` member (`prevention-outstanding`) and, across THREE review rounds, three
 * different structures that must be TOTAL over that enum were missed — each caught by a human, none by a gate:
 *   • round 1 — `VERDICT_STRICTNESS` (disposition-judge) had no rank for it → it compared `undefined` and lost.
 *   • round 2 — a hand-copied `VERDICT_STRICTNESS` twin + `combineValidatedVerdict` flattened it to `changes`.
 *   • round 3 — `derivePlanOutcome` let it fall through the `changes` round-cap path → a non-progressing loop.
 * Every miss is the SAME script-decidable class: an enum member added without updating a structure total over it.
 * The round-2 meta-finding is why this gate is DERIVE-BASED, not a hand list: the first cut of the fix enumerated
 * the tables it REMEMBERED and missed the two nobody listed. A gate carrying its own list would repeat that exact
 * failure. So this gate DISCOVERS its coverage by scanning the enum's consumers in source — a new consumer a future
 * PR adds is covered automatically (it either carries the marker and is checked, or is flagged as unannotated).
 *
 * THE DESIGN (deterministic + maintainable): each structure total over `VERDICTS` carries a one-line MARKER comment
 * in its doc — `@verdicts-total` — and the gate does two things:
 *   1. COVERAGE (discovery). Scan every source symbol for verdict references. A top-level symbol that references ≥2
 *      DISTINCT verdicts is a "verdict consumer". Every such symbol MUST carry a marker (`@verdicts-total`, or an
 *      explicit opt-out `@verdicts-partial <reason>`) — an UNMARKED consumer is itself an ERROR. THIS is what makes
 *      coverage derived: you cannot introduce a new verdict-total structure without either annotating it (→ checked)
 *      or being flagged. The gate finds ALL sites; a forgotten new consumer can't slip past a stale list.
 *   2. TOTALITY. For each `@verdicts-total` symbol, assert every `VERDICTS` member is referenced — as an object-literal
 *      KEY (`[VERDICTS.X]:` or `'accept':`) for a table, or in a branch (`=== VERDICTS.X` / `case VERDICTS.X`) for a
 *      reducer. A branch reducer with ONE documented default may declare it: `@verdicts-total fallthrough=changes`
 *      exempts EXACTLY `changes` (the round-cap catch-all) and requires every OTHER member explicitly — so a new
 *      member still can't ride the fallthrough (the round-3 defect). At most one fallthrough member is allowed, so
 *      the exemption can't be abused to list away a real miss.
 *
 * Pure — takes `{file, content}[]` docs + the `VERDICTS` enum OBJECT (so the member set is DERIVED from the enum,
 * never hardcoded here) and returns `{ errors, sites }`. The fs walk + the real `VERDICTS` import live in the
 * `check-standards.mjs` caller (mirrors `scanRepoLocusPrefixes`). Unit-tested with a synthetic enum + fixtures.
 *
 * ENUM-AGNOSTIC (#xdompzx review, finding 5). The gate was already parameterised on the enum's MEMBER SET; it is
 * now also parameterised on the enum's SYMBOL NAME and its marker pair, so a SECOND enum+rank-table pair enrols in
 * the same discovery machinery with one extra call rather than a hand-rolled local mirror. `IMPACT_LEVELS` /
 * `IMPACT_STRICTNESS` / `IMPACT_GLOSS` (jury-core) is the first such tenant, under `@impact-total`. The whole point
 * of this gate is that coverage is DISCOVERED, so a new structure total over an enrolled enum can never rely on
 * someone remembering to list it — that includes structures total over an enum nobody thought to enrol.
 */

export const VERDICT_TOTAL_MARKER = '@verdicts-total';
export const VERDICT_PARTIAL_MARKER = '@verdicts-partial';

/** The default enrolment: the `VERDICTS` enum under its `@verdicts-total` / `@verdicts-partial` markers. A second
 *  enum passes its own `{ enumSymbol, totalMarker, partialMarker }` (see `check-standards.mjs` §14). */
const DEFAULT_ENROLMENT = Object.freeze({
  enumSymbol: 'VERDICTS',
  totalMarker: VERDICT_TOTAL_MARKER,
  partialMarker: VERDICT_PARTIAL_MARKER,
});

export const IMPACT_TOTAL_MARKER = '@impact-total';
export const IMPACT_PARTIAL_MARKER = '@impact-partial';

/** The second enrolment (#xdompzx review, finding 5): `IMPACT_LEVELS` (jury-core) — the finding-impact enum whose
 *  rank table (`IMPACT_STRICTNESS`) and gloss map (`IMPACT_GLOSS`) must each stay total over it. Exported so
 *  `check-standards.mjs` passes an object rather than re-typing marker strings (a second copy of a marker name is
 *  the same drift this gate exists to stop). */
export const IMPACT_ENROLMENT = Object.freeze({
  enumSymbol: 'IMPACT_LEVELS',
  totalMarker: IMPACT_TOTAL_MARKER,
  partialMarker: IMPACT_PARTIAL_MARKER,
});

/** Replace every comment (line + block) with same-length whitespace, preserving newlines + offsets, so a verdict
 *  named in PROSE (a doc comment, an inline note) never counts as a code reference. Strings are left intact — a
 *  quoted verdict KEY (`'accept':`) is real code we DO want to see; a verdict inside a longer string is excluded by
 *  the key-position anchor in `verdictKeyRefs`, not by stripping. Pure. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:/])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, ' '));
}

/** Distinct enum VALUES referenced SYMBOLICALLY (`<ENUM>.MEMBER_NAME`) in a code span, mapped through the enum
 *  so the value set is derived from the enum object, never hardcoded. `<ENUM>.includes`-style lowercase members
 *  don't match (member names are UPPER_SNAKE), so an unrelated same-named array elsewhere never false-triggers. */
function verdictSymbolRefs(span, name2val, enumSymbol) {
  const found = new Set();
  for (const m of span.matchAll(new RegExp(`${enumSymbol}\\.([A-Z0-9_]+)`, 'g'))) {
    const v = name2val[m[1]];
    if (v) found.add(v);
  }
  return found;
}

/** Distinct verdict VALUES referenced as an object-literal KEY (`accept:`, `'needs-human':`, `[VERDICTS.X]:` is the
 *  symbolic form handled above) in a code span. The key must sit in KEY POSITION — immediately after `{`, `,`, or a
 *  line start — so a verdict word inside a sentence-shaped string (`before accept: …`) is NOT mistaken for a key. */
function verdictKeyRefs(span, values) {
  const found = new Set();
  for (const v of values) {
    const re = new RegExp(`(?:[{,]|^)\\s*(['"]?)${v.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}\\1\\s*:`, 'gm');
    if (re.test(span)) found.add(v);
  }
  return found;
}

/** The contiguous comment block IMMEDIATELY above line `start` (skipping a single run of blank lines between the doc
 *  and the declaration), joined. This is where a symbol's marker lives — isolating it here means a marker is only
 *  ever read for the symbol it actually annotates, never bled from a neighbour. `rawLines` are the ORIGINAL lines
 *  (comments intact — the marker IS a comment). */
function precedingComment(rawLines, start) {
  let i = start - 1;
  while (i >= 0 && rawLines[i].trim() === '') i--; // skip blanks between the doc and the decl
  const block = [];
  for (; i >= 0; i--) {
    const t = rawLines[i].trim();
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.endsWith('*/')) block.unshift(rawLines[i]);
    else break;
  }
  return block.join('\n');
}

/** Parse a marker line's `fallthrough=a,b` clause into a set of enum values. Empty when absent. */
function parseFallthrough(commentBlock, totalMarker) {
  const m = commentBlock.match(new RegExp(`${totalMarker}[^\\n]*?fallthrough=([a-z0-9,\\-]+)`, 'i'));
  if (!m) return new Set();
  return new Set(m[1].split(',').map((s) => s.trim()).filter(Boolean));
}

const SYMBOL_RE = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z0-9_$]+)/;

/**
 * Discover every verdict-consumer symbol in `docs` and check coverage + totality over `VERDICTS`. Pure.
 * @param {Array<{file: string, content: string}>} docs - source files to scan (the caller supplies the fs walk).
 * @param {Object<string,string>} verdicts - the enum object (`{ ACCEPT: 'accept', ... }`); the member set
 *   is DERIVED from its values, so the gate can never drift from the enum it guards.
 * @param {{enumSymbol?: string, totalMarker?: string, partialMarker?: string}} [enrolment] - which enum this pass
 *   guards. Defaults to `VERDICTS` / `@verdicts-total` / `@verdicts-partial`; a second enum (e.g. `IMPACT_LEVELS`
 *   under `@impact-total`) passes its own, so it reuses this discovery machinery instead of hand-rolling a mirror.
 * @returns {{errors: string[], sites: Array<{file: string, line: number, symbol: string, marker: 'total'|'partial'|null,
 *   referenced: string[], missing: string[]}>}}
 */
export function checkVerdictTotality(docs = [], verdicts = {}, enrolment = {}) {
  const { enumSymbol, totalMarker, partialMarker } = { ...DEFAULT_ENROLMENT, ...enrolment };
  const values = Object.values(verdicts);
  const name2val = Object.fromEntries(Object.entries(verdicts).map(([k, v]) => [k, v]));
  const errors = [];
  const sites = [];

  for (const { file, content } of docs) {
    if (typeof content !== 'string') continue;
    const rawLines = content.split('\n');
    const codeLines = stripComments(content).split('\n');
    // Top-level symbol starts, in order; each symbol's span runs to the NEXT symbol start (line-based — these files
    // declare one top-level symbol per block, and comments in the span are already whitespaced out).
    const starts = [];
    codeLines.forEach((ln, i) => {
      const m = ln.match(SYMBOL_RE);
      if (m) starts.push({ line: i, symbol: m[1] });
    });
    for (let s = 0; s < starts.length; s++) {
      const { line, symbol } = starts[s];
      const end = s + 1 < starts.length ? starts[s + 1].line : codeLines.length;
      const span = codeLines.slice(line, end).join('\n');
      const referenced = new Set([...verdictSymbolRefs(span, name2val, enumSymbol), ...verdictKeyRefs(span, values)]);
      if (referenced.size < 2) continue; // not a consumer of this enum — nothing to enforce

      const comment = precedingComment(rawLines, line);
      const hasTotal = comment.includes(totalMarker);
      const hasPartial = comment.includes(partialMarker);
      const loc = `${file}:${line + 1} (${symbol})`;

      if (hasPartial) {
        // Documented intentional partial — allowed, but the reason must be present (visible in review), not a bare tag.
        const reason = comment.split(partialMarker).slice(1).join(partialMarker).split('\n')[0].replace(/\*+\/?/g, '').trim();
        if (!reason) {
          errors.push(`${loc} carries a bare \`${partialMarker}\` with no reason — an intentional non-total ${enumSymbol} consumer must document WHY on the same line so a reviewer can judge it.`);
        }
        sites.push({ file, line: line + 1, symbol, marker: 'partial', referenced: [...referenced], missing: [] });
        continue;
      }

      if (!hasTotal) {
        // THE DISCOVERY CHECK — an unannotated consumer is the miss this gate exists to catch. Force the author
        // to either mark it total (and make it total) or document an intentional partial. This is what keeps coverage
        // DERIVED from the enum's consumers rather than a hand list nobody updates.
        errors.push(`${loc} references ${referenced.size} ${enumSymbol} members [${[...referenced].sort().join(', ')}] but carries no \`${totalMarker}\` marker — a structure total over ${enumSymbol} must be annotated so the gate enforces its totality (or mark it \`${partialMarker} <reason>\` if it is intentionally not total).`);
        sites.push({ file, line: line + 1, symbol, marker: null, referenced: [...referenced], missing: [] });
        continue;
      }

      const fallthrough = parseFallthrough(comment, totalMarker);
      if (fallthrough.size > 1) {
        errors.push(`${loc} declares more than one \`fallthrough=\` member [${[...fallthrough].sort().join(', ')}] — at most ONE documented default is allowed, so the exemption can't be used to list away a real missing member.`);
      }
      const missing = values.filter((v) => !referenced.has(v) && !fallthrough.has(v));
      if (missing.length) {
        errors.push(`${loc} is marked \`${totalMarker}\` but is NOT total over ${enumSymbol} — missing member(s) [${missing.sort().join(', ')}]. Every ${enumSymbol} member must be handled here (or be the single documented \`fallthrough=\` default); an added enum member silently dropped here is exactly the #2823 defect class.`);
      }
      sites.push({ file, line: line + 1, symbol, marker: 'total', referenced: [...referenced], missing });
    }
  }
  return { errors, sites };
}
