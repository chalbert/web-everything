/**
 * @file scripts/backlog/frontmatter.mjs
 * @description Surgical backlog-frontmatter editing — the shared core behind the `backlog.mjs`
 * status verbs (claim / resolve / release / scaffold).
 *
 * The mechanical half of backlog work — flipping `status`, stamping `dateStarted`/`dateResolved`,
 * setting `graduatedTo` — is pure frontmatter field hygiene the agent currently does by hand (re-read,
 * reason, Edit), burning a tool round-trip and context on every item. This module does it
 * deterministically with one rule borrowed from `readiness/engine.mjs#spliceStaleEdges` and the
 * intents-JSON footgun lesson: **splice the single line, never round-trip the whole document.** Only
 * the frontmatter block (first `---` … next `---`) is ever touched; the body is byte-for-byte
 * preserved, so a status flip can never disturb prose, a digest, or a `## Progress` block.
 *
 * PURE — no fs, no process, no `Date`. The CLI injects the file text and "today" so the same logic
 * runs against the live backlog or an in-memory fixture in tests.
 */

/** Match a top-level `key:` line inside the frontmatter (not indented list items). */
const keyLineRe = (key) => new RegExp(`^${key}:.*$`, 'm');

/**
 * Locate the frontmatter block. Returns `{ start, end, block }` where `block` is the text *between*
 * the opening and closing `---` (start = first char after the opening `---\n`, end = index of the
 * closing `---`), or `null` if the document has no frontmatter.
 */
function locateFrontmatter(content) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const start = fm.index + fm[0].indexOf('\n') + 1;
  const end = fm.index + fm[0].length - 3; // index of the closing `---`
  return { start, end, block: content.slice(start, end) };
}

/** Read a top-level scalar frontmatter field's raw (unquoted, untrimmed-of-quotes) value, or `undefined`. */
export function readField(content, key) {
  const fm = locateFrontmatter(content);
  if (!fm) return undefined;
  const m = fm.block.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, '') || undefined;
}

/**
 * Set a top-level scalar frontmatter field. If the key already exists, its line is replaced in place;
 * otherwise the new line is inserted **after** the last present key from `after` (so a stamped date
 * lands next to `dateOpened`/`status` rather than at the bottom), falling back to just before the
 * closing `---`. Returns the new content, or `null` if there's no frontmatter to edit.
 *
 * @param {string} content
 * @param {string} key
 * @param {string} rendered  The value text as it should appear (already quoted if a string: `'"2026-06-10"'`).
 * @param {{ after?: string[] }} [opts]  Anchor keys for insertion when the field is absent.
 * @returns {string|null}
 */
export function setFrontmatterField(content, key, rendered, { after = [] } = {}) {
  const fm = locateFrontmatter(content);
  if (!fm) return null;
  const line = `${key}: ${rendered}`;
  const existing = fm.block.match(keyLineRe(key));
  let newBlock;
  if (existing) {
    newBlock = fm.block.replace(keyLineRe(key), line);
  } else {
    const lines = fm.block.split('\n');
    let insertAt = lines.length; // default: end of block (just before closing ---)
    // The block ends with a trailing '' element (the newline before `---`); insert before it.
    if (lines[lines.length - 1] === '') insertAt = lines.length - 1;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^([A-Za-z0-9_]+):/);
      if (m && after.includes(m[1])) insertAt = i + 1;
    }
    lines.splice(insertAt, 0, line);
    newBlock = lines.join('\n');
  }
  return content.slice(0, fm.start) + newBlock + content.slice(fm.end);
}

/** Today's date as a quoted `"YYYY-MM-DD"` string, ready to drop into frontmatter. The CLI passes the value. */
export const quoteDate = (ymd) => `"${ymd}"`;

/**
 * Apply a status transition + its stamps in one splice pass. Pure: caller supplies `today`.
 *
 *   claim:   open    → active    + dateStarted
 *   resolve: active  → resolved  + dateResolved (+ graduatedTo if given)
 *   release: active  → open      (stamps untouched — Progress says where it stopped)
 *
 * Enforces the legal `from` status so a script can't silently double-claim or resolve an open item.
 * Returns `{ content }` on success or `{ error }` if the transition is illegal or unspliceable —
 * the CLI turns the latter into a non-zero exit, never a half-written file.
 *
 * @param {string} content
 * @param {'claim'|'resolve'|'release'} verb
 * @param {{ today: string, graduatedTo?: string }} opts
 * @returns {{ content: string } | { error: string }}
 */
export function applyTransition(content, verb, { today, graduatedTo } = {}) {
  const status = readField(content, 'status');
  const DATE_ANCHORS = ['dateOpened', 'dateStarted', 'dateResolved', 'status', 'blockedBy', 'size', 'workItem', 'type'];

  if (verb === 'claim') {
    if (status !== 'open') return { error: `status is "${status}", expected "open" — lost the race or already claimed` };
    let next = setFrontmatterField(content, 'status', 'active');
    next = setFrontmatterField(next, 'dateStarted', quoteDate(today), { after: DATE_ANCHORS });
    return next ? { content: next } : { error: 'could not splice frontmatter' };
  }
  if (verb === 'resolve') {
    if (status !== 'active' && status !== 'open') return { error: `status is "${status}", expected "active" — only an in-flight item is resolved` };
    let next = setFrontmatterField(content, 'status', 'resolved');
    next = setFrontmatterField(next, 'dateResolved', quoteDate(today), { after: DATE_ANCHORS });
    if (graduatedTo) next = setFrontmatterField(next, 'graduatedTo', graduatedTo, { after: ['dateResolved', ...DATE_ANCHORS] });
    return next ? { content: next } : { error: 'could not splice frontmatter' };
  }
  if (verb === 'release') {
    if (status !== 'active') return { error: `status is "${status}", expected "active" — only an active claim is released` };
    const next = setFrontmatterField(content, 'status', 'open');
    return next ? { content: next } : { error: 'could not splice frontmatter' };
  }
  return { error: `unknown verb "${verb}"` };
}
