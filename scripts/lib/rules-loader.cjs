// The `rules` read-path loader (#1828, builds the read-path #1792 Fork 1 → (c) ratified).
//
// The project's *statute layer* — the standing rules in docs/agent/platform-decisions.md plus the three
// sibling governance docs cited by `codifiedIn:` across the backlog — has historically had NO URL on the
// docs site: Eleventy's input dir is `src/` only, so the entire `docs/` tree sits outside the build and
// every `codifiedIn:` cite 404s. #1792 ratified the synthesis (c): keep the markdown the source of truth,
// render the four cited docs to `/rules/` with their anchors intact, derive a plain rendered index, and add
// a gate (validate-rules-anchors.cjs) that asserts every `codifiedIn:` anchor resolves to rendered output.
//
// This loader is the SoT-preserving render half. It reads the four cited docs raw and renders each with the
// same markdown-it 11ty ships. The docs anchor headings three ways, and ALL must resolve:
//   1. explicit kramdown `### heading {#id}` (platform-decisions.md, most cites)
//   2. plain `## Heading (#1321)` whose id is the GitHub-style slug of the heading text
//   3. raw inline HTML `<span id="…">` and standalone `{#id}` markers (e.g. canonical-build-kind-predicate)
// `extractAnchors(src)` is the single pure inventory of every anchor a doc exposes; both the renderer and
// the gate (scripts/lib/validate-rules-anchors.cjs) consume it, so the render and the gate can never
// disagree about what resolves. Each rule exposes:
//   { id, file, title, html, anchors:[string], headings:[{level,text,anchor}] }
// `anchors` is the set the gate matches `codifiedIn:` cites against; `headings` drives the rendered index.

const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');

const ROOT = path.resolve(__dirname, '..', '..');

// The four `codifiedIn:`-cited governance docs (#1792 grounding: 209/57 + 7 + 4 + 2 cites, all 404 today).
// `title` is the human label for the index + detail header; order is most-cited first.
const RULE_DOCS = [
  { id: 'platform-decisions', file: 'docs/agent/platform-decisions.md', title: 'Platform Decisions' },
  { id: 'block-standard', file: 'docs/agent/block-standard.md', title: 'Block Standard' },
  { id: 'backlog-workflow', file: 'docs/agent/backlog-workflow.md', title: 'Backlog Workflow' },
  { id: 'vision-tiers', file: 'docs/agent/vision-tiers.md', title: 'Vision Tiers' },
];

const HEADING_LINE_RE = /^(#{1,6})\s+(.*)$/;
const EXPLICIT_ANCHOR_RE = /\s*\{#([\w-]+)\}\s*$/;     // `### Title {#id}` (kramdown form)
const INLINE_MARKER_RE = /\{#([\w-]+)\}/g;             // standalone `{#id}` not on a heading line
const HTML_ID_RE = /\bid=["']([\w-]+)["']/g;           // raw inline `<span id="…">`

// GitHub-style heading slug: lowercase, drop everything but word chars / spaces / hyphens, spaces → `-`.
// Punctuation (incl. `#`, `(`, `)`, em-dash) is *removed*, leaving surrounding spaces — so `… — readiness`
// collapses to `--readiness` and `(#608)` to `-608`, matching the cited anchors.
function githubSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')   // strip punctuation, keep word chars / whitespace / hyphen
    .trim()
    .replace(/\s/g, '-');
}

// Strip markdown emphasis/code/link syntax from heading text for a clean index label.
function plainText(s) {
  return s
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();
}

// The pure anchor inventory of one doc's raw markdown: heading ids (explicit `{#id}` or slugged text),
// standalone inline `{#id}` markers, and raw-HTML `id="…"`. Pure — no render — so the gate can call it.
function extractAnchors(src) {
  const headings = [];
  const anchors = new Set();
  for (const rawLine of src.split('\n')) {
    const hm = rawLine.match(HEADING_LINE_RE);
    if (hm) {
      const level = hm[1].length;
      let text = hm[2];
      const em = text.match(EXPLICIT_ANCHOR_RE);
      const anchor = em ? em[1] : githubSlug(text);
      if (em) text = text.replace(EXPLICIT_ANCHOR_RE, '');
      anchors.add(anchor);
      headings.push({ level, text: plainText(text), anchor });
      continue;
    }
    // Non-heading line: standalone `{#id}` markers and raw-HTML `id="…"`.
    let m;
    INLINE_MARKER_RE.lastIndex = 0;
    while ((m = INLINE_MARKER_RE.exec(rawLine))) anchors.add(m[1]);
    HTML_ID_RE.lastIndex = 0;
    while ((m = HTML_ID_RE.exec(rawLine))) anchors.add(m[1]);
  }
  return { anchors, headings };
}

// markdown-it whose `### heading {#id}` and `## Heading (#1321)` both emit a real heading `id` — explicit
// anchor wins, else the GitHub slug — so every rendered heading is a fragment target.
function makeRenderer() {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
  md.core.ruler.push('rules_heading_anchors', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'heading_open') continue;
      const inline = tokens[i + 1];
      if (!inline || inline.type !== 'inline') continue;
      const em = inline.content.match(EXPLICIT_ANCHOR_RE);
      const id = em ? em[1] : githubSlug(inline.content);
      tokens[i].attrSet('id', id);
      if (em) {
        inline.content = inline.content.replace(EXPLICIT_ANCHOR_RE, '');
        if (inline.children && inline.children.length) {
          const last = inline.children[inline.children.length - 1];
          if (last.type === 'text') last.content = last.content.replace(EXPLICIT_ANCHOR_RE, '');
        }
      }
    }
    return true;
  });
  return md;
}

// Standalone inline `{#id}` markers (not on a heading line) — e.g. `{#relocation-granularity}` opening a
// list item (platform-decisions.md:135) — become a real zero-width anchor span the FIRST time the id is
// seen (the definition); a later `{#id}` in prose (e.g. `see {#relocation-granularity}`) becomes a link to
// that fragment. Done at the source-string level so markdown-it passes the span through verbatim.
function preprocessInlineAnchors(src) {
  const defined = new Set();
  return src
    .split('\n')
    .map((line) => {
      if (/^#{1,6}\s/.test(line)) return line; // heading lines handled by the core rule
      return line.replace(INLINE_MARKER_RE, (_full, id) => {
        if (!defined.has(id)) {
          defined.add(id);
          return `<span id="${id}" class="rules-anchor"></span>`;
        }
        return `<a href="#${id}">#${id}</a>`;
      });
    })
    .join('\n');
}

function loadRules() {
  const md = makeRenderer();
  return RULE_DOCS.map((doc) => {
    const src = fs.readFileSync(path.join(ROOT, doc.file), 'utf8');
    const { anchors, headings } = extractAnchors(src);
    const html = md.render(preprocessInlineAnchors(src));
    return { id: doc.id, file: doc.file, title: doc.title, html, anchors: [...anchors], headings };
  });
}

// Render one repo-root markdown doc to { id, file, title, html, headings } with heading anchors — the same
// renderer the rules use, re-used for the Fork 2 governance narratives (DEV_GUIDE / SELF-DRIVEN / CLA),
// which are also outside the 11ty input dir and otherwise unreachable. No `codifiedIn:` gate over these
// (they are human-read narrative, not cite targets), so only the index/heading data is exposed.
function renderRootDoc({ id, file, title }) {
  const md = makeRenderer();
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const { headings } = extractAnchors(src);
  const html = md.render(preprocessInlineAnchors(src));
  return { id, file, title, html, headings };
}

module.exports = { loadRules, renderRootDoc, extractAnchors, githubSlug, RULE_DOCS, plainText };
