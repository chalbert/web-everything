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
 *      or being flagged. WHAT "DISCOVERS" MEANS, EXACTLY (it is not magic): a symbol counts as a consumer when the
 *      scan sees ≥2 members either SYMBOLICALLY (`ENUM.MEMBER`, incl. `[ENUM.MEMBER]:`) or, when the enrolment
 *      allows it, as bare/quoted object-literal KEYS (`accept:`, `'needs-human':`). For `VERDICTS` both passes are
 *      on, so a new consumer written in either spelling is discovered without anyone updating a list. THE REACH IS
 *      NOT UNIVERSAL — it is a regex over source text, so other spellings are invisible; what it does and does not
 *      see is written out at `keyRefsEnabled`, which also covers why the key half is narrowed for an enum whose
 *      members are ordinary English words.
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
 * now also parameterised on the enum's SYMBOL NAME, its marker pair, and how wide its bare-key discovery reaches,
 * so a SECOND enum+rank-table pair enrols in the same discovery machinery with one extra call rather than a
 * hand-rolled local mirror. `IMPACT_LEVELS` / `IMPACT_STRICTNESS` / `IMPACT_GLOSS` (jury-core) is the first such
 * tenant, under `@impact-total`. Its enrolment is DELIBERATELY NARROWER than the `VERDICTS` one and the tradeoff is
 * written out at `IMPACT_ENROLMENT` — read it before assuming a second tenant gets the same reach as the first.
 */

export const VERDICT_TOTAL_MARKER = '@verdicts-total';
export const VERDICT_PARTIAL_MARKER = '@verdicts-partial';

/** The default enrolment: the `VERDICTS` enum under its `@verdicts-total` / `@verdicts-partial` markers. A second
 *  enum passes its own `{ enumSymbol, totalMarker, partialMarker, genericKeysNeedSymbol }` (see
 *  `check-standards.mjs` §14).
 *
 *  `genericKeysNeedSymbol: false` is the ORIGINAL, UNRESTRICTED behaviour and is what `VERDICTS` has always had:
 *  bare object-literal keys (`accept:`, `changes:`) count as references wherever they appear. That is not
 *  negotiable for this enum — `DECISION_COPY = Object.freeze({ accept: …, changes: … })` written by a future PR
 *  with no `VERDICTS` import in sight is EXACTLY the unannotated-consumer class this gate was built for after
 *  PR #976. See `keyRefsEnabled` for why the flag is a per-ENROLMENT property and never a per-VALUE filter. */
const DEFAULT_ENROLMENT = Object.freeze({
  enumSymbol: 'VERDICTS',
  totalMarker: VERDICT_TOTAL_MARKER,
  partialMarker: VERDICT_PARTIAL_MARKER,
  genericKeysNeedSymbol: false,
});

// NOT exported (#xdompzx round-2, finding 3): these two strings are consumed only by `IMPACT_ENROLMENT` just below.
// The enrolment object IS the public handle — exporting the raw markers as well invites a caller to re-type a marker
// name, which is the drift this gate exists to stop.
const IMPACT_TOTAL_MARKER = '@impact-total';
const IMPACT_PARTIAL_MARKER = '@impact-partial';

/** The second enrolment (#xdompzx review, finding 5): `IMPACT_LEVELS` (jury-core) — the finding-impact enum whose
 *  rank table (`IMPACT_STRICTNESS`) and gloss map (`IMPACT_GLOSS`) must each stay total over it. Exported so
 *  `check-standards.mjs` passes an object rather than re-typing marker strings (a second copy of a marker name is
 *  the same drift this gate exists to stop).
 *
 *  `genericKeysNeedSymbol: true`, AND WHAT THAT COSTS (#xdompzx round-4, finding c — stated here because a reader
 *  must not have to infer it). EVERY `IMPACT_LEVELS` value is an ordinary English word — `cosmetic`, `degraded`,
 *  `broken`, `unrecoverable`. Matching those in bare key position across all of `scripts/` + `skills-src/` would
 *  turn an unrelated `const HEALTH = { ok: 0, degraded: 1, broken: 2 }` into a nonsense impact-totality error whose
 *  cheapest escape is a bogus `@impact-partial` on innocent code. So this enrolment discovers a consumer only when
 *  the span NAMES `IMPACT_LEVELS`.
 *
 *  THE HOLE THAT LEAVES, EXPLICITLY: a table that spells the levels as bare keys and never names the enum —
 *  `const IMPACT_WEIGHTS = Object.freeze({ cosmetic: 0, degraded: 1, broken: 2, unrecoverable: 3 })` — is INVISIBLE
 *  to this gate. It is pinned as a characterization test in `verdict-totality.test.mjs` so nobody rediscovers it as
 *  a surprise.
 *
 *  WHAT IT STILL BUYS, and why the enrolment is not merely decorative: a THIRD structure total over the enum,
 *  written the way both of today's real consumers are (`frozenLookup({ [IMPACT_LEVELS.COSMETIC]: … })` — the form
 *  `IMPACT_STRICTNESS` and `IMPACT_GLOSS` use), IS discovered and must carry `@impact-total`. A third table written
 *  some other way is subject to the same reach limits as any other span (see `keyRefsEnabled`) — the enrolment buys
 *  discovery of the SYMBOLIC form, not of every form. The module-load loop in `jury-core.mjs` cannot catch it — it
 *  asserts `IMPACT_STRICTNESS` and `IMPACT_GLOSS` BY NAME, so it is total-checking the two tables it was written
 *  next to and blind to any third. The division of labour is therefore: the module-load assert is the coverage for
 *  the two NAMED tables (including a fifth level added to the enum); this gate is the coverage for a NEW symbolic
 *  consumer nobody listed. */
export const IMPACT_ENROLMENT = Object.freeze({
  enumSymbol: 'IMPACT_LEVELS',
  totalMarker: IMPACT_TOTAL_MARKER,
  partialMarker: IMPACT_PARTIAL_MARKER,
  genericKeysNeedSymbol: true,
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

/** Distinct enum VALUES referenced as an object-literal KEY (`'needs-human':`, `accept:`; `[VERDICTS.X]:` is the
 *  symbolic form handled above) in a code span. The key must sit in KEY POSITION — immediately after `{`, `,`, or a
 *  line start — so an enum word inside a sentence-shaped string (`before accept: …`) is NOT mistaken for a key.
 *  Every value is treated alike; whether this pass runs AT ALL for a given span is `keyRefsEnabled`'s call. */
function verdictKeyRefs(span, values) {
  const found = new Set();
  for (const v of values) {
    const re = new RegExp(`(?:[{,]|^)\\s*(['"]?)${v.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}\\1\\s*:`, 'gm');
    if (re.test(span)) found.add(v);
  }
  return found;
}

/**
 * Is bare-key discovery enabled for THIS span? ALL-OR-NOTHING, PER SPAN — never per value (#xdompzx round-4,
 * BLOCKER). Round 3 put this restriction inside the matcher as a per-VALUE filter (`skip generic values unless the
 * span names the enum`), on the SHARED matcher, and it broke the gate three ways at once:
 *
 *   (a) COVERAGE LOST for `VERDICTS`. `accept` and `changes` are hyphen-free, so an unannotated
 *       `DECISION_COPY = Object.freeze({ accept: 'ship it', changes: 'bounce it' })` — the exact class the gate was
 *       built for — went from FLAGGED to zero sites, zero errors.
 *   (b) A FALSE "NOT total" ERROR. A per-value filter yields a PARTIAL reference set, and a partial set is then
 *       reported as MISSING MEMBERS. A table marked `@verdicts-total` and spelling every member as a bare key —
 *       `{ accept: 1, changes: 2, 'needs-human': 3, 'prevention-outstanding': 4 }`, genuinely total — errored
 *       "missing [accept, changes]", because only the two hyphenated keys were collected. The only sanctioned
 *       escape was `@verdicts-partial`, permanently exempting a real consumer.
 *   (c) It bought the new tenant nothing anyway (see `IMPACT_ENROLMENT`).
 *
 * (b) is the structural lesson and is why this predicate returns a BOOLEAN FOR THE WHOLE SPAN: key discovery is
 * either fully on for a span (no value skipped on account of its spelling) or fully off (the key pass does not run,
 * so the span is a consumer only via its symbolic refs). WHAT THAT BUYS, EXACTLY: this FLAG can no longer be the
 * thing that half-collects a span's reference set — it never leaves some members matchable and others not.
 *
 * IT IS NOT A PROMISE THAT EVERY TOTAL TABLE IS SEEN AS TOTAL. The key pass reads two spellings only — bare
 * (`accept:`) and quoted (`'needs-human':`), in key position; the separate symbolic pass reads `VERDICTS.ACCEPT`
 * (incl. `[VERDICTS.ACCEPT]:`). A computed or template-literal key (`['accept']:`) is read by NEITHER, so a table
 * mixing spellings — `{ [VERDICTS.ACCEPT]: 1, ['needs-human']: 2 }` — still collects a partial set and can still
 * error "NOT total", and one written entirely in computed keys collects nothing and is never discovered. That is
 * the matcher's reach, verified identical at this PR's merge-base; widening it is out of scope here.
 *
 * @param {boolean} genericKeysNeedSymbol - the ENROLMENT's opt-in (see `IMPACT_ENROLMENT`), not a property of a value.
 * @param {boolean} spanNamesEnum - does the span reference the enum symbol itself?
 */
function keyRefsEnabled(genericKeysNeedSymbol, spanNamesEnum) {
  return !genericKeysNeedSymbol || spanNamesEnum;
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
 * @param {{enumSymbol?: string, totalMarker?: string, partialMarker?: string, genericKeysNeedSymbol?: boolean}}
 *   [enrolment] - which enum this pass guards. Defaults to `VERDICTS` / `@verdicts-total` / `@verdicts-partial`
 *   with UNRESTRICTED bare-key discovery; a second enum (e.g. `IMPACT_LEVELS` under `@impact-total`) passes its
 *   own, so it reuses this discovery machinery instead of hand-rolling a mirror. `genericKeysNeedSymbol` narrows
 *   discovery for an enum whose values are ordinary English words — see `keyRefsEnabled` and `IMPACT_ENROLMENT`.
 * @returns {{errors: string[], sites: Array<{file: string, line: number, symbol: string, marker: 'total'|'partial'|null,
 *   referenced: string[], missing: string[]}>}}
 */
export function checkVerdictTotality(docs = [], verdicts = {}, enrolment = {}) {
  const { enumSymbol, totalMarker, partialMarker, genericKeysNeedSymbol } = { ...DEFAULT_ENROLMENT, ...enrolment };
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
      const spanNamesEnum = span.includes(enumSymbol);
      const keyRefs = keyRefsEnabled(genericKeysNeedSymbol, spanNamesEnum) ? verdictKeyRefs(span, values) : [];
      const referenced = new Set([...verdictSymbolRefs(span, name2val, enumSymbol), ...keyRefs]);
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
