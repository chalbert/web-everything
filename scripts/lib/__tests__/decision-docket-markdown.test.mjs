/**
 * @file decision-docket-markdown.test.mjs — proof that the Decision Docket renders markdown, not markers.
 *
 * Two layers, per #2949 (real mechanism, not a mock of it):
 *  1. `renderMarkdown` and friends — the shared renderer's own contract (safe by construction, link policy,
 *     heading demotion, comment stripping).
 *  2. The REAL generator on a fixture card set — one card per construct (bold, italic, inline code, a fenced
 *     code block with `<svg>` inside, a blockquote, ordered and unordered lists, a link, an HTML-looking
 *     string that must stay escaped). Cards go through the real extractor (`buildDecisionRecord`), and the
 *     page is produced by spawning the real CLI (`gen-decision-docket.mjs render`) against the real
 *     `template.html`. Assert the rendered elements are present and NO raw marker is left outside `<pre>`/`<code>`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  renderMarkdown, renderMarkdownBlocks, renderMarkdownInline, stripHtmlComments,
} from '../decision-docket-markdown.mjs';
import { buildDecisionRecord } from '../decision-docket-data.mjs';
import { findRawMarkers } from './fixtures/docket-raw-markers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('renderMarkdown — the shared renderer', () => {
  it('reports a lone plain paragraph as inline (no <p>) so a caller keeps its own container', () => {
    expect(renderMarkdown('plain **bold** text')).toEqual({ html: 'plain <strong>bold</strong> text', flow: false });
  });

  it('reports any block construct as flow, and renders it', () => {
    expect(renderMarkdown('- a\n- b')).toMatchObject({ flow: true, html: expect.stringContaining('<ul>') });
    expect(renderMarkdown('1. a\n2. b').html).toContain('<ol>');
    expect(renderMarkdown('> quoted').html).toContain('<blockquote>');
    expect(renderMarkdown('one\n\ntwo').flow).toBe(true);
  });

  it('never emits raw HTML from the source — it is escaped (safe by construction, html: false)', () => {
    const html = renderMarkdownBlocks('<script>alert(1)</script> and <img src=x onerror=alert(1)>\n\n<div>block</div>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<div>');
    expect(html).toContain('&lt;script&gt;');
    expect(renderMarkdownInline('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
  });

  it('renders a fenced code block as <pre><code> with its contents escaped and its blank lines kept', () => {
    const html = renderMarkdownBlocks('```svg\n<svg><path d="M0 0"/></svg>\n\n<!-- kept -->\n```');
    expect(html).toContain('<pre><code class="language-svg">');
    expect(html).toContain('&lt;svg&gt;&lt;path d=&quot;M0 0&quot;/&gt;&lt;/svg&gt;\n\n&lt;!-- kept --&gt;');
  });

  it('links: an absolute http(s) link is a real anchor; a repo-relative link is reduced to its text', () => {
    expect(renderMarkdownInline('[site](https://example.com/a)')).toBe('<a href="https://example.com/a" rel="noopener noreferrer">site</a>');
    expect(renderMarkdownInline('see [#64](/backlog/064/) and [doc](../docs/x.md#y)')).toBe('see #64 and doc');
    expect(renderMarkdownInline('[bad](javascript:alert(1))')).not.toContain('href');
  });

  it('demotes headings below the page h1–h3', () => {
    const html = renderMarkdownBlocks('# one\n\n## two\n\n### three\n\n#### four');
    expect(html).not.toMatch(/<h[123]>/);
    expect(html).toContain('<h4>one</h4>');
    expect(html).toContain('<h4>three</h4>');
    expect(html).toContain('<h5>four</h5>');
  });

  it('drops HTML comments except inside code', () => {
    expect(stripHtmlComments('a <!-- glance table --> b')).toBe('a  b');
    expect(stripHtmlComments('`<!-- x -->` stays')).toBe('`<!-- x -->` stays');
    expect(stripHtmlComments('```\n<!-- x -->\n```\n<!-- gone -->')).toBe('```\n<!-- x -->\n```\n');
  });

  it('renders a pipe table (a fork "at a glance" grid)', () => {
    expect(renderMarkdownBlocks('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table>');
  });
});

// ── the real generator over a fixture card set ─────────────────────────────────────────────────────────────

const OPT = '- **(a)** Alpha. **Rejected**: no.\n- **(b)** **Beta** ← **RECOMMENDED**.';
const VERDICT = '**Skeptic:** SURVIVES.\n**Screen:** clear.';

/** One prepared decision card. `digest` and `noteBlock` carry the construct under test. */
function card({ digest = 'Plain digest.', optionB = '**Beta** ← **RECOMMENDED**.', why = 'Why.', noteBlock = '' } = {}) {
  return `---\ndateOpened: "2026-09-01"\n---\n\n# Fixture\n\n${digest}\n\n## Fork 1 — q\n\n${why}\n\n- **(a)** Alpha. **Rejected**: no.\n- **(b)** ${optionB}\n\n${noteBlock}\n\n${VERDICT}\n\n## Done when\n\n1. Ratified.\n`;
}

const FIXTURES = {
  bold: card({ digest: 'A **bold claim** in the digest.' }),
  italic: card({ digest: 'An *italic aside* in the digest.' }),
  inlineCode: card({ digest: 'Call `renderDocketHtml()` here.', optionB: 'Use `--ref=origin/main` ← **RECOMMENDED**.' }),
  fence: card({ noteBlock: 'Illustrative shape:\n\n```svg\n<svg viewBox="0 0 8 8">\n  <path d="M0 0h8"/>\n\n  <!-- second half -->\n</svg>\n```' }),
  blockquote: card({ digest: '> **Update (2026-09-15):** the tracking mechanism is built.\n> Second quoted line.\n\nAfter the quote.' }),
  unordered: card({ digest: 'The plan:\n\n- first step\n- second step\n  - nested step' }),
  ordered: card({ digest: 'The order:\n\n1. one\n2. two\n3. three' }),
  link: card({ digest: 'See [the standard](https://example.com/standard) and [a card](/backlog/64-x/).' }),
  escapedHtml: card({ digest: 'Raw <script>alert("x")</script> and <img src=x onerror=alert(1)> stay text.', noteBlock: '<div class="evil">block</div>' }),
  headings: card({ noteBlock: '### Worked example\n\nText under it.' }),
};

const tmp = mkdtempSync(join(tmpdir(), 'docket-md-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function runGenerator() {
  const items = Object.entries(FIXTURES).map(([name, text], i) => buildDecisionRecord(
    { num: String(9000 + i), title: `Fixture ${name}`, prepared: true, preparedDate: '2026-09-02', leverageScore: 100 - i, directUnblocks: 1, unblocksToReady: 1 },
    text,
    new Date('2026-09-21'),
  ));
  const dataPath = join(tmp, 'data.json');
  const outPath = join(tmp, 'page.html');
  writeFileSync(dataPath, JSON.stringify({ generatedFromRef: 'fixture', items }));
  execFileSync('node', ['scripts/gen-decision-docket.mjs', 'render', `--data=${dataPath}`, `--out=${outPath}`], { cwd: ROOT, stdio: 'pipe' });
  return { html: readFileSync(outPath, 'utf8'), items };
}

/** The `.dcard` for one fixture, by name. */
function cardHtml(html, name) {
  const num = 9000 + Object.keys(FIXTURES).indexOf(name);
  const start = html.indexOf(`id="item-${num}"`);
  const end = html.indexOf('<div class="dcard"', start + 1);
  return html.slice(start, end === -1 ? undefined : end);
}

describe('the real generator on a fixture card set', () => {
  const { html, items } = runGenerator();

  it('parses every fixture card cleanly (so the assertions below test rendering, not a parse failure)', () => {
    expect(items.every((i) => i.parseOk)).toBe(true);
  });

  it('renders bold, italic, inline code (in prose and in an option) as elements', () => {
    expect(cardHtml(html, 'bold')).toContain('<strong>bold claim</strong>');
    expect(cardHtml(html, 'italic')).toContain('<em>italic aside</em>');
    expect(cardHtml(html, 'inlineCode')).toContain('<code>renderDocketHtml()</code>');
    expect(cardHtml(html, 'inlineCode')).toContain('<code>--ref=origin/main</code>');
  });

  it('renders a fenced code block with <svg> inside as escaped preformatted text, blank line and all', () => {
    const c = cardHtml(html, 'fence');
    expect(c).toMatch(/<pre><code[^>]*>[\s\S]*&lt;svg viewBox=&quot;0 0 8 8&quot;&gt;[\s\S]*&lt;\/svg&gt;[\s\S]*<\/code><\/pre>/);
    expect(c).toContain('&lt;path d=&quot;M0 0h8&quot;/&gt;\n\n  &lt;!-- second half --&gt;'); // the blank line did not tear the block
    expect(c).not.toContain('<svg');
    expect(c).not.toContain('<path');
  });

  it('renders a blockquote as <blockquote>, not a paragraph starting "&gt; "', () => {
    const c = cardHtml(html, 'blockquote');
    expect(c).toContain('<blockquote>');
    expect(c).toContain('<strong>Update (2026-09-15):</strong>');
    expect(c).toContain('After the quote.');
  });

  it('renders unordered (with nesting) and ordered lists as real lists', () => {
    const u = cardHtml(html, 'unordered');
    expect(u).toContain('<ul>');
    expect(u).toMatch(/<li>second step\s*<ul>\s*<li>nested step<\/li>/);
    const o = cardHtml(html, 'ordered');
    expect(o).toContain('<ol>');
    expect(o).toMatch(/<li>one<\/li>\s*<li>two<\/li>\s*<li>three<\/li>/);
  });

  it('renders an absolute link as an anchor and a repo-relative link as plain text', () => {
    const c = cardHtml(html, 'link');
    expect(c).toContain('<a href="https://example.com/standard" rel="noopener noreferrer">the standard</a>');
    expect(c).toContain('a card');
    expect(c).not.toContain('/backlog/64-x/');
  });

  it('keeps HTML-looking source escaped: no script/img/div element is ever emitted from a card', () => {
    const c = cardHtml(html, 'escapedHtml');
    expect(c).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(c).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(c).toContain('&lt;div class=&quot;evil&quot;&gt;block&lt;/div&gt;');
    expect(c).not.toMatch(/<(script|img|div class="evil")/);
  });

  it('renders a heading inside a card as a demoted heading, never a "### " line', () => {
    expect(cardHtml(html, 'headings')).toContain('<h4>Worked example</h4>');
  });

  it('leaves NO raw markdown marker anywhere in the page outside <pre>/<code>', () => {
    expect(findRawMarkers(html)).toEqual([]);
  });

  it('the raw-marker check itself works: it flags the very shapes the old renderer produced', () => {
    expect(findRawMarkers('<p>a **bold** b</p>')).toHaveLength(1);
    expect(findRawMarkers('<p>&gt; **Update** quoted</p>').length).toBeGreaterThan(0);
    expect(findRawMarkers('<p>### Recommendation at a glance</p>')).toHaveLength(1);
    expect(findRawMarkers('<p>- a list line</p>')).toHaveLength(1);
    expect(findRawMarkers('<p>use `x` here</p>')).toHaveLength(1);
    expect(findRawMarkers('<pre><code>**a** `b` ## c\n- d</code></pre><p>fine <code>**x**</code></p>')).toEqual([]);
  });
});
