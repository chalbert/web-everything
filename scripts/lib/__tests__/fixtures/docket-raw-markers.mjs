/**
 * @file docket-raw-markers.mjs — test support: find markdown that reached the Decision Docket page UNRENDERED.
 *
 * `findRawMarkers(html)` removes everything where a marker is legitimate content (`<style>`, `<script>`,
 * `<pre>`, `<code>` — a code block or code span may contain `**`, backticks, `## ` etc. by design), then reports
 * every markdown marker still sitting in the visible text: bold, backticks, a fence, a `> ` quote line, a `#`
 * heading line, a `- ` list line. An empty array means the page shows no raw markdown.
 */

/**
 * @param {string} html
 * @returns {string} the page with every legitimate-marker region replaced by a placeholder (never deleted:
 * removing a `<code>` span at the start of a wrapped line would leave its neighbour looking like a line start)
 */
export function visibleProse(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<pre[\s\S]*?<\/pre>/g, '\u0001')
    .replace(/<code[\s\S]*?<\/code>/g, '\u0001');
}

// A "line start" in rendered HTML is a real line start OR the start of a block element's text (`<p>`, `<li>`,
// `<div …>`, a cell, a heading, a blockquote). NOT "after any tag": `</strong> + a trigger` is prose, not a list.
const LINE_START = String.raw`(?:^|<(?:p|li|div|td|th|blockquote|h[1-6])(?:\s[^>]*)?>)[ \t]*`;
const RULES = [
  ['bold **', /\*\*/],
  ['backtick', /`/],
  ['leading "&gt; " quote line', new RegExp(`${LINE_START}&gt;[ \\t]`, 'm')],
  ['"#" heading line', new RegExp(`${LINE_START}#{1,6}[ \\t]+\\S`, 'm')],
  ['"- " list line', new RegExp(`${LINE_START}[-*+][ \\t]+\\S`, 'm')],
];

/** @param {string} html @returns {string[]} one entry per offending rule, with a snippet of the first hit */
export function findRawMarkers(html) {
  const prose = visibleProse(html);
  const found = [];
  for (const [name, re] of RULES) {
    const m = re.exec(prose);
    if (m) found.push(`${name}: …${prose.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\n/g, '⏎')}…`);
  }
  return found;
}
