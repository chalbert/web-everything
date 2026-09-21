/**
 * @file decision-docket-markdown.mjs — the ONE markdown → HTML renderer every text field on the Decision Docket
 * page goes through (digest paragraphs, fork `why`, option bodies, notes, Skeptic/Screen verdicts, the "Once
 * ratified" footer, titles).
 *
 * WHY THIS EXISTS: the page used to run those fields through a hand-rolled inline subset (`mdInline`: code, bold,
 * italic, link-as-text) — no block rules at all — and the extractor (`decision-docket-data.mjs`) flattened every
 * paragraph onto one line first, so block markdown could not survive even if the renderer had understood it.
 * The visible result was raw markdown in the published page: literal `**`/backticks, `> ` blockquote markers,
 * `## `/`### ` headings, ``` fences and `- ` list lines all showing as plain text inside a `<p>`. One shared
 * renderer over the real grammar (`markdown-it`, already a dependency — `scripts/lib/review-escalation.mjs`
 * uses it for the same reason: "enumeration loses to a real grammar") means a construct is either rendered or
 * it is not markdown; there is no third state where some fields handle it and others print the markers.
 *
 * SAFE BY CONSTRUCTION: `html: false` — any HTML in the source (a `<script>`, an `<svg>` pasted outside a
 * fence, a stray `<div>`) is ESCAPED and shown as text, never emitted. markdown-it's default `validateLink` also
 * refuses `javascript:`/`vbscript:`/`file:` URLs. Never set `html: true` here.
 *
 * THREE DELIBERATE CHOICES, each documented rather than accidental:
 *  - Links. This is a standalone published page; the source repo's relative backlog paths
 *    (`/research/…`, `backlog/…`) do not resolve from it. An absolute `http(s)://` link renders as a real
 *    `<a>`; any other link renders as its visible TEXT only (the pre-existing `mdInline` behavior, kept).
 *  - Headings inside a card are demoted to `<h4>`–`<h6>` so they never outrank the page's own `<h1>`–`<h3>`.
 *  - HTML comments (`<!-- glance table -->`) are authoring markers that a rendered markdown view never shows;
 *    they are dropped before parsing (outside fenced and inline code, where they are real content).
 */
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false });

const ABSOLUTE_LINK_RE = /^https?:\/\//i;

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') || '';
  if (!ABSOLUTE_LINK_RE.test(href)) { env.droppedLink = true; return ''; }
  env.droppedLink = false;
  tokens[idx].attrSet('rel', 'noopener noreferrer');
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.link_close = (tokens, idx, options, env, self) => {
  if (env.droppedLink) { env.droppedLink = false; return ''; }
  return self.renderToken(tokens, idx, options);
};

// Headings inside a docket card sit below the page's own h1–h3: `#`–`###` → h4, then h5, h6 for deeper ones.
md.core.ruler.push('docket_demote_headings', (state) => {
  for (const t of state.tokens) {
    if (t.type !== 'heading_open' && t.type !== 'heading_close') continue;
    const level = Number.parseInt(t.tag.slice(1), 10);
    t.tag = `h${Math.min(6, Math.max(4, level + 1))}`;
  }
});

/** A fence opener/closer line: up to any indent, then 3+ backticks or tildes. */
const FENCE_LINE_RE = /^\s*(`{3,}|~{3,})/;

/**
 * Drop `<!-- … -->` comments from markdown source, except where they are content: inside a fenced code block or
 * an inline code span.
 * @param {string} src
 * @returns {string}
 */
export function stripHtmlComments(src) {
  const out = [];
  let chunk = [];
  let fence = null;
  const flush = () => {
    if (!chunk.length) return;
    out.push(chunk.join('\n').replace(/(`+)[\s\S]*?\1|<!--[\s\S]*?-->/g, (m) => (m.startsWith('<!--') ? '' : m)));
    chunk = [];
  };
  for (const line of String(src ?? '').split('\n')) {
    const m = FENCE_LINE_RE.exec(line);
    if (fence) {
      out.push(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && /^\s*[`~]+\s*$/.test(line)) fence = null;
    } else if (m) {
      flush();
      out.push(line);
      fence = m[1];
    } else {
      chunk.push(line);
    }
  }
  flush();
  return out.join('\n');
}

/**
 * Render markdown source to HTML. `flow` is false when the whole source is ONE plain paragraph — `html` is then
 * the paragraph's inline content with no `<p>` wrapper, so a caller can keep its own container (`<p class="…">`,
 * `.opt-bd`) exactly as before. `flow` is true when the source has any block construct (a list, blockquote,
 * fenced code, heading, table, several paragraphs): `html` is then block HTML that must NOT be nested inside a
 * `<p>`.
 * @param {string} src
 * @returns {{ html: string, flow: boolean }}
 */
export function renderMarkdown(src) {
  const env = {};
  const tokens = md.parse(stripHtmlComments(src), env);
  if (!tokens.length) return { html: '', flow: false };
  const single = tokens.length === 3 && tokens[0].type === 'paragraph_open' && tokens[1].type === 'inline';
  if (single) return { html: md.renderer.renderInline(tokens[1].children, md.options, env), flow: false };
  return { html: md.renderer.render(tokens, md.options, env), flow: true };
}

/**
 * Render markdown as block HTML always (a lone paragraph comes out as `<p>…</p>`). Use where the container is
 * the card body and its own `.bd > p` styling should apply to every paragraph.
 * @param {string} src
 * @returns {string}
 */
export function renderMarkdownBlocks(src) {
  return md.render(stripHtmlComments(src), {});
}

/**
 * Render markdown as inline HTML only (no block rules — a leading `1. ` or `> ` stays literal). For one-line
 * fields: titles, fork cruxes.
 * @param {string} src
 * @returns {string}
 */
export function renderMarkdownInline(src) {
  return md.renderInline(stripHtmlComments(src), {});
}
