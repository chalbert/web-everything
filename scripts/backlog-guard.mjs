#!/usr/bin/env node
/**
 * Backlog write-time guard (AI-optimisation program). Shift-left for two summary footguns the
 * `check:standards` gate only catches LATE, plus a double-count it misses entirely.
 *
 *   --pre  (PreToolUse Edit|Write, DENY via exit 2): predict the gate's "missing required field
 *          summary" BEFORE the edit lands. An item's summary is derived from its body's first real
 *          paragraph (mirrors firstParagraph in src/_data/backlog.js, #745) — a body that leads with
 *          `**Label:**`, a heading, or a list derives an EMPTY summary; so does a stray body added to
 *          a frontmatter-only `relatedReport` pointer. Both hard-error the gate. Also denies the
 *          retired `childlessReason/unsplittableReason: undecided` sentinels.
 *   default (PostToolUse Edit|Write, WARN via exit 2): a `kind: story` carrying a `size` that also
 *          has children (some other item's `parent:`) double-counts in the burndown — a case the gate
 *          only flags for sized epics, not stories.
 *
 * Fails open on unparseable input / non-backlog paths.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKLOG_RE = /(?:^|\/)backlog\/(\d+)-[^/]+\.md$/;

/** Split a markdown doc into { fm, body } on a leading --- … --- frontmatter block. */
function split(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  return m ? { fm: m[1], body: m[2] } : { fm: '', body: text };
}

/** Read a top-level scalar frontmatter field (quotes stripped); '' if absent/empty. */
const fmField = (fm, k) => {
  const m = fm.match(new RegExp(`^${k}:\\s*(.+?)\\s*$`, 'm'));
  return m ? m[1].replace(/^["']|["']$/g, '').trim() : '';
};

/**
 * First real paragraph — mirrors src/_data/backlog.js firstParagraph (#745): skips headings, rules,
 * quotes, lists, code-fences AND a `**Label:**` lead (exactly the digest footgun). '' if none.
 */
function firstParagraph(body) {
  const buf = [];
  for (const raw of body.split('\n')) {
    const l = raw.trim();
    const skip = !l || l === '---' || /^#{1,6}\s/.test(l) || /^>/.test(l)
      || /^```/.test(l) || /^[-*|]/.test(l) || /^\*\*[^*]+:\*\*/.test(l);
    if (skip) { if (buf.length) break; else continue; }
    buf.push(l);
  }
  return buf.length ? buf.join(' ') : '';
}

/** Compute the post-edit content without writing it (Write → content; Edit → apply old→new). */
function proposedContent(ev) {
  const ti = ev.tool_input || {};
  const onDisk = (() => { try { return readFileSync(ti.file_path, 'utf8'); } catch { return ''; } })();
  if (ev.tool_name === 'Write') return ti.content ?? '';
  if (ev.tool_name === 'Edit' && typeof ti.old_string === 'string')
    return onDisk.includes(ti.old_string)
      ? (ti.replace_all ? onDisk.split(ti.old_string).join(ti.new_string ?? '') : onDisk.replace(ti.old_string, ti.new_string ?? ''))
      : (ti.new_string ?? '');
  return ti.content ?? ti.new_string ?? onDisk;
}

function deny(msg) { process.stderr.write('backlog-guard: ' + msg + '\n'); process.exit(2); }

const argv = process.argv.slice(2);
let ev;
try { ev = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const file = ev?.tool_input?.file_path;
if (!file || !BACKLOG_RE.test(file)) process.exit(0);

// ── PreToolUse GATE: deny edits that would land an empty summary or a retired sentinel ──
if (argv.includes('--pre')) {
  const text = proposedContent(ev);
  if (!text.trim()) process.exit(0); // empty proposal — nothing to judge
  const { fm, body } = split(text);

  if (/^(?:childlessReason|unsplittableReason):\s*undecided\s*$/m.test(fm))
    deny('`childlessReason/unsplittableReason: undecided` is retired — give a real reason or restructure (no-decision/epic-conflation). Don\'t leave it for the gate.');

  const ownBody = body.trim();
  const fmSummary = fmField(fm, 'summary');
  const relatedReport = fmField(fm, 'relatedReport');
  const summary = ownBody ? (firstParagraph(ownBody) || fmSummary) : (relatedReport ? 'report' : fmSummary);
  if (!summary)
    deny('this edit yields an EMPTY summary (the gate\'s "missing required field summary"). The summary is the body\'s first real paragraph — don\'t lead with `**Label:**`, a heading, or a list; lead with a plain prose sentence (or set a `summary:` field). For a frontmatter-only relatedReport pointer, keep it body-less.');

  process.exit(0);
}

// ── PostToolUse WARN: a sized story that also has children double-counts the burndown ──
const num = (file.match(BACKLOG_RE) || [])[1];
let text;
try { text = readFileSync(file, 'utf8'); } catch { process.exit(0); }
const { fm } = split(text);
if (fmField(fm, 'kind') === 'story' && fmField(fm, 'size')) {
  let hasChild = false;
  try {
    for (const f of readdirSync(join(ROOT, 'backlog'))) {
      if (!f.endsWith('.md') || (f.match(/^(\d+)-/) || [])[1] === num) continue;
      if (new RegExp(`^parent:\\s*["']?${num}\\b`, 'm').test(readFileSync(join(ROOT, 'backlog', f), 'utf8'))) {
        hasChild = true;
        break;
      }
    }
  } catch { /* dir unreadable — skip the warn */ }
  if (hasChild) {
    process.stderr.write(
      `backlog-guard: #${num} is a sized \`story\` that also has children (another item's \`parent: ${num}\`) — that double-counts in the burndown. Convert the parent to an \`epic\` (sized only while unsliced) or drop its size.\n`,
    );
    process.exit(2);
  }
}
process.exit(0);
