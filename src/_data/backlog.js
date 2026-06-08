// The backlog feeds entirely off a directory of markdown files — one per item:
//
//   backlog/<id>.md
//     ---
//     type / status / dateOpened / tags / relatedReport / relatedProject /
//     crossRef / graduatedTo            (metadata only — the registry fields)
//     ---
//     # Title
//     First paragraph (the summary)…
//     …the rest is the detail-page body.
//
// EVERYTHING shown — title, description, detail-page body — is derived from
// markdown, never from hand-typed frontmatter strings:
//   • an item with its own markdown body → title = its H1, summary = its first
//     paragraph, details = the rendered body.
//   • a pointer item (a `relatedReport` and NO body) → it MIRRORS the report:
//     title/summary/details are loaded from the report md itself.
//
// This `.js` data file is the single loader: it parses backlog/*.md into the
// `backlog` array the pages (backlog.njk, backlog-pages.njk) and the validator
// (scripts/check-standards.mjs) all consume. There is no backlog.json.
const { readdirSync, readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
const BACKLOG_DIR = join(__dirname, '../../backlog');
const ROOT = join(__dirname, '../..');

const toDateString = (v) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : v;

// Strip inline markdown so a line makes a clean one-line summary.
const stripInline = (s) => s
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .trim();

// First real paragraph of a markdown body (skips headings/rules/quotes/lists/code/meta).
function firstParagraph(body) {
  const buf = [];
  for (const raw of body.split('\n')) {
    const l = raw.trim();
    const skip = !l || l === '---' || /^#/.test(l) || /^>/.test(l)
      || /^```/.test(l) || /^[-*|]/.test(l) || /^\*\*[^*]+:\*\*/.test(l);
    if (skip) { if (buf.length) break; else continue; }
    buf.push(l);
  }
  return buf.length ? buf.join(' ') : undefined;
}

// Derive { title, summary, details } from a markdown document.
// Reports carry a metadata block (Date/Point/…) before a `---` rule and a
// `**Point:**` lead; item bodies are plain (H1 + paragraphs).
function derive(text, { isReport = false } = {}) {
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  let lead;
  let bodyMd;
  if (isReport) {
    const meta = text.match(/\*\*(?:Point|Goal|Subject|Scope|Purpose|Summary):\*\*\s*(.+)/i);
    if (meta) lead = stripInline(meta[1]);
    const hrIdx = text.search(/^\s*---\s*$/m); // drop the H1 + metadata block
    bodyMd = hrIdx !== -1
      ? text.slice(text.indexOf('\n', hrIdx) + 1).trimStart()
      : (titleMatch ? text.replace(titleMatch[0], '').trimStart() : text);
  } else {
    bodyMd = titleMatch ? text.replace(titleMatch[0], '').trimStart() : text;
  }

  if (!lead) { const p = firstParagraph(bodyMd); if (p) lead = stripInline(p); }
  return {
    title,
    summary: lead,
    details: bodyMd.trim() ? md.render(bodyMd) : undefined,
  };
}

function loadReport(relPath) {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return null;
  const { content } = matter(readFileSync(p, 'utf8')); // reports have no frontmatter
  return derive(content, { isReport: true });
}

module.exports = function backlog() {
  const items = readdirSync(BACKLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const id = file.replace(/\.md$/, '');
      // Filenames are `NNN-slug.md`: `num` (the leading NNN) is the stable unique id shown as
      // "#042" and used for short references; `slug` is the human-readable text. `id` stays the
      // full filename stem so it remains the route key (permalink = /backlog/<id>/).
      const num = (id.match(/^(\d+)-/) || [])[1];
      const slug = id.replace(/^\d+-/, '');
      const { data, content } = matter(readFileSync(join(BACKLOG_DIR, file), 'utf8'));
      const ownBody = content.trim();

      // Own markdown body wins; else mirror the related report; else nothing.
      const src = ownBody
        ? derive(ownBody)
        : (typeof data.relatedReport === 'string' ? loadReport(data.relatedReport) : null) || {};

      const reportDate = typeof data.relatedReport === 'string'
        ? (data.relatedReport.match(/(\d{4}-\d{2}-\d{2})/) || [])[1]
        : undefined;

      return {
        ...data,
        id,
        num,
        slug,
        title: src.title || data.title || id,
        summary: src.summary || data.summary,
        dateOpened: toDateString(data.dateOpened),
        dateStarted: toDateString(data.dateStarted),
        dateResolved: toDateString(data.dateResolved),
        reportDate,
        details: src.details || data.details || undefined,
      };
    });

  items.sort((a, b) =>
    String(b.dateOpened || '').localeCompare(String(a.dateOpened || '')) ||
    a.id.localeCompare(b.id));
  return items;
};
