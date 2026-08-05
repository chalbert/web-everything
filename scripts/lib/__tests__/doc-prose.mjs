/**
 * doc-prose.mjs — a whitespace-normalizing matcher for asserting against MARKDOWN PROSE from a test.
 *
 * NOT a `.test.mjs` file, so vitest's `scripts` include glob (which requires that suffix) never collects it as a
 * suite. Its own proof lives next door in `doc-prose.test.mjs`.
 *
 * WHY (#xdompzx round-4, finding 3). A test pinned a safety control in `we:skills-src/drain/SKILL.md` with
 * `expect(md).toContain('no\n       > land that the bar un-blocked happens silently')` — an assertion that
 * encodes where the sentence happened to WRAP and how deep the blockquote happened to be INDENTED. Re-flowing the
 * paragraph, or re-nesting the branch one level, fails the suite with a message that reads "the safety control is
 * missing" when the control is right there. That is a false alarm on the one assertion whose job is to be
 * believed.
 *
 * This repo already learned this on this exact file: see the "MATCHING SPANS WRAPPED LINES" note in
 * `we:scripts/lib/review-skill-guard.mjs`, whose first cut was line-anchored, MISSED the real auto-land label swap
 * (wrapped across two lines), and flagged a benign note instead — "it reported a false positive and called it the
 * true one". Same defect, opposite direction. So: normalize, then match.
 *
 * WHAT IS NORMALIZED (deliberately small — this must not become a markdown parser):
 *   • leading blockquote markers (`>`, `  > `, `>>`) are stripped, per line;
 *   • every run of whitespace — including newlines — collapses to one space;
 *   • the result is trimmed.
 * NOTHING ELSE. Emphasis (`**`), backticks and punctuation are left ALONE: a test that pins a phrase inside
 * `**bold**` is pinning the emphasis on purpose, and silently eating it would let a claim change meaning under a
 * still-green assertion.
 */

/** Collapse markdown prose to one whitespace-normalized line with blockquote markers removed. Pure.
 *  @param {string} md
 *  @returns {string} */
export function normalizeProse(md) {
  return String(md ?? '')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:>\s?)+/, ''))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Does `md` contain `phrase`, comparing both whitespace-normalized? Use instead of `expect(md).toContain(...)`
 *  for any assertion against markdown PROSE, so a reflow or a re-indent cannot fail it. Pure.
 *  @param {string} md - the raw document (or a slice of it).
 *  @param {string} phrase - the phrase to find, written naturally; its own wrapping is irrelevant.
 *  @returns {boolean} */
export function proseContains(md, phrase) {
  return normalizeProse(md).includes(normalizeProse(phrase));
}

/**
 * The slice of `md` from the line containing `startMarker` through the end of that contiguous BLOCK — the run of
 * lines up to (not including) the first line that is neither blank nor a blockquote continuation at the same or
 * deeper indent. Use this to SCOPE a negative assertion (`must not say X`) to the passage that makes the claim,
 * rather than to a 400-line document where an unrelated future use of the same words would fail it.
 *
 * Returns `''` when the marker is absent, so a `not.toMatch` over the result cannot vacuously pass on a typo —
 * assert the slice is non-empty first.
 *
 * The start line must ITSELF be a blockquote line. A doc commonly names a block from the step above it ("first
 * run the BAR-UN-BLOCKED PREVENTION CHECK, THEN …"); matching that cross-reference would return a one-line slice
 * and silently under-scope every assertion made against it.
 *
 * @param {string} md
 * @param {string} startMarker - a distinctive substring on the block's first line.
 * @returns {string}
 */
export function blockquoteBlockAt(md, startMarker) {
  const lines = String(md ?? '').split('\n');
  const start = lines.findIndex((l) => /^\s*>/.test(l) && l.includes(startMarker));
  if (start === -1) return '';
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (!/^\s*>/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

/**
 * Every function-call NAME appearing inside a code span (`` `like this()` ``) in `md`. Used to check that the
 * symbols a doc tells an agent to call are actually reachable from the module it tells them to import.
 * Restricted to camelCase identifiers immediately followed by `(` — the JS function-name convention — so ordinary
 * English words in prose are never mistaken for an API the doc promises. Pure.
 * @param {string} md
 * @returns {string[]} sorted, de-duplicated.
 */
export function functionNamesInCodeSpans(md) {
  const names = new Set();
  for (const span of String(md ?? '').matchAll(/`([^`]+)`/g)) {
    for (const call of span[1].matchAll(/\b([a-z][A-Za-z0-9_$]*)\s*\(/g)) {
      if (/[A-Z]/.test(call[1])) names.add(call[1]); // camelCase ⇒ a function name, not an English word
    }
  }
  return [...names].sort();
}
