/**
 * merge-gate-totality.mjs — the DISCOVER-BASED class guard for the merge-decision gate in `merge-ai-prs.mjs`
 * (#2820, the round-2 introspection directive).
 *
 * WHY: #2820 made a green PR under an uncleared review hold `decision:'skip'` (not `'merge'`) with `reviewHeld:true`.
 * That one status change re-routed the PR through EVERY site gated on the merge decision (`decision === 'merge'` /
 * `decision !== 'merge'`). Rounds 1–2 fixed the sites the author REMEMBERED — the escalation loop, the id-collision
 * heal, the `!escalate` dead zone — but a FIFTH site (the review-label mint set) slipped, and the reviewer's point
 * was that the round-2 "general-invariant guard" only pinned the `reviewHeld` PREDICATE's MEANING; it never
 * enumerated the predicate's CONSUMERS, so the 5th slipped and a 6th could too.
 *
 * This is the SAME move as the just-landed `verdict-totality.mjs` gate: DON'T carry a hand list of the sites (a list
 * repeats the exact miss — it goes stale the moment someone adds a site nobody put on it). Instead DISCOVER the
 * consumers by scanning source: every line that gates on the merge decision is a consumer, and each MUST either
 *   • already consider `reviewHeld` in its gate expression (→ covered), OR
 *   • carry an explicit `@merge-gate-exempt <reason>` marker stating WHY the hold is legitimately irrelevant there
 *     (e.g. the FINAL `toMerge` filter, which must exclude a held PR; the downgrade-only backstop; the merge-order
 *     builder; the human-readable log; the manifest-strip predicate, which must never mutate a held PR).
 * An UNMARKED, uncovered merge-decision gate is itself an ERROR — so a NEW site a future PR adds cannot slip past a
 * stale list: it either handles `reviewHeld`, is deliberately exempted (visible in review, with a reason), or fails
 * this guard. THAT is what closes the class — coverage is derived from the source, not from memory.
 *
 * Pure — takes the `merge-ai-prs.mjs` source string and returns `{ errors, sites }`. The fs read + the assertion
 * live in the caller (the test `scripts/__tests__/merge-gate-consumers.test.mjs`). Deliberately NOT wired into
 * `check-standards.mjs` — it ships as a source-scanning invariant TEST to avoid colliding with the in-flight
 * `check-standards*` work on PR #974; a test over one file is the right altitude for a one-file invariant anyway.
 */

export const MERGE_GATE_EXEMPT_MARKER = '@merge-gate-exempt';

/** The merge-decision gate: `decision === 'merge'` or `decision !== 'merge'` (single or double quotes, any spacing).
 *  Global so we can find EVERY occurrence; the meaning we care about is "this line branches on the merge decision". */
const GATE_RE = /\bdecision\s*(?:===|!==)\s*['"]merge['"]/;

// Replace every comment (line + block) with same-length whitespace, preserving newlines + offsets, so a merge-gate
// expression that appears only inside PROSE (a doc comment, an inline note like "leave v.decision === 'merge'") is
// NOT mistaken for a real gate site. A single char-scanner, NOT two regex passes: a naive block-first regex
// mis-pairs a slash-star that appears INSIDE a line comment (merge-ai-prs.mjs has several such notes) with a later
// real block-comment close, blanking real code between them. The scanner tracks string state (single/double/backtick
// quotes) so a comment-opener inside a string never starts a comment, and comment state so a quote inside a comment
// never starts a string. Strings are left INTACT — a quoted 'merge' literal is real code we must see.
function stripComments(src) {
  const out = src.split('');
  let i = 0;
  const n = src.length;
  let str = null; // the open quote char when inside a string, else null
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (str) {
      if (c === '\\') { i += 2; continue; }      // escape — skip the next char (incl. an escaped quote)
      if (c === str) str = null;                 // string closes
      i += 1;
      continue;
    }
    if (c === '/' && d === '/') {                // line comment → whitespace to EOL
      while (i < n && src[i] !== '\n') { out[i] = ' '; i += 1; }
      continue;
    }
    if (c === '/' && d === '*') {                // block comment → whitespace to the closing */
      out[i] = ' '; out[i + 1] = ' '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] !== '\n') out[i] = ' '; i += 1; }
      if (i < n) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') str = c; // string opens (left intact)
    i += 1;
  }
  return out.join('');
}

/** The contiguous comment block IMMEDIATELY above line `start` (skipping a single run of blank lines between the
 *  comment and the gate), joined. A marker may live there OR as a trailing comment on the gate line itself; both are
 *  read. `rawLines` are the ORIGINAL lines (comments intact — the marker IS a comment). Mirrors verdict-totality. */
function precedingComment(rawLines, start) {
  let i = start - 1;
  while (i >= 0 && rawLines[i].trim() === '') i--;
  const block = [];
  for (; i >= 0; i--) {
    const t = rawLines[i].trim();
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.endsWith('*/')) block.unshift(rawLines[i]);
    else break;
  }
  return block.join('\n');
}

/**
 * Discover every merge-decision-gate site in `source` and check that each considers `reviewHeld` or is exempt. Pure.
 * @param {string} source - the `merge-ai-prs.mjs` file contents.
 * @returns {{errors: string[], sites: Array<{line: number, marker: 'reviewHeld'|'exempt', reason?: string}>}}
 */
export function checkMergeGateConsumers(source) {
  const errors = [];
  const sites = [];
  if (typeof source !== 'string') return { errors, sites };

  const rawLines = source.split('\n');
  const codeLines = stripComments(source).split('\n'); // gate sites are found in CODE only, never in a comment

  codeLines.forEach((codeLn, i) => {
    if (!GATE_RE.test(codeLn)) return; // not a merge-decision gate — nothing to enforce
    const loc = `merge-ai-prs.mjs:${i + 1}`;

    // COVERED: the gate expression itself references `reviewHeld` — it already accounts for the held PR (the
    // escalation loop's `&& !v.reviewHeld`, the heal guard's `|| v.reviewHeld`, the mint set's `|| v.reviewHeld`).
    if (/reviewHeld/.test(codeLn)) {
      sites.push({ line: i + 1, marker: 'reviewHeld' });
      return;
    }

    // EXEMPT: an explicit marker (trailing comment on the gate line, or the comment block above it) with a reason.
    const markerText = `${rawLines[i]}\n${precedingComment(rawLines, i)}`;
    const idx = markerText.indexOf(MERGE_GATE_EXEMPT_MARKER);
    if (idx !== -1) {
      const reason = markerText.slice(idx + MERGE_GATE_EXEMPT_MARKER.length).split('\n')[0].replace(/\*+\/?/g, '').trim();
      if (!reason) {
        errors.push(`${loc} carries a bare \`${MERGE_GATE_EXEMPT_MARKER}\` with no reason — a merge-decision gate that intentionally ignores \`reviewHeld\` must document WHY on the same line so a reviewer can judge it.`);
      }
      sites.push({ line: i + 1, marker: 'exempt', reason });
      return;
    }

    // THE DISCOVERY CHECK — an unannotated merge-decision gate that does not consider `reviewHeld`. This is exactly
    // the class the #2820 5th-site miss belongs to. Force the author to either handle the held PR or exempt it.
    errors.push(`${loc} branches on the merge decision (\`decision ===/!== 'merge'\`) but neither considers \`reviewHeld\` nor carries a \`${MERGE_GATE_EXEMPT_MARKER} <reason>\` marker. Post-#2820 a green held PR is \`decision:'skip'\` with \`reviewHeld:true\`, so every merge-decision gate must decide whether it applies to a held PR. Handle \`reviewHeld\` here, or mark it \`${MERGE_GATE_EXEMPT_MARKER} <why the hold is irrelevant at this site>\`.`);
    sites.push({ line: i + 1, marker: null });
  });

  return { errors, sites };
}
