/**
 * @file scripts/lib/prototype-tracker-compact.mjs
 * @description PURE builder of the COMPACT prototype-tracker page — the default of `prototype-tracker.mjs render`
 *   (the old full page stays behind `--full`, see `prototype-tracker-render.mjs`). No fs, no clock, no git, no
 *   process: the caller hands in the parsed tracker, the `## Priority order` text, the card titles and statuses,
 *   the operator queue's NEEDS YOU lines and the two stamps (branch tip, render time).
 *
 * WHY A SECOND PAGE. The full page is 307 KB: the latest note in full plus 76 notes with their bodies, and none
 * of the one thing an operator opens a tracker to see (what is next, and what needs them). This page is built to
 * be read on a phone held upright: header, NEEDS YOU, the top of the priority list as a small table, a counts
 * strip, then the notes collapsed. It carries no prose of its own beyond a section title and a table.
 *
 * WHAT COMES FROM WHERE (nothing here is invented):
 *   - rank, band, size, claimed lines, off-path lines, `why: (unwritten)` marks: the card's own
 *     `## Priority order` lines (`parsePriorityRows`), in the order the list gives them (health chain and delegation
 *     section first, because the list puts them first);
 *   - the short title of a row: the card's own H1 (`cardTitleFromText`), cut to {@link TITLE_MAX} characters — never
 *     the long "why" sentence. A card no source has falls back to the cut "why" text so the row is not blank;
 *   - NEEDS YOU: the operator-queue script's own section, verbatim (`wip-report.mjs#parseNeedsYou` reads it).
 *
 * THE STAMP. The tip sha and the render time sit in ONE `<span class="stamp">` element. {@link stripStamp} removes
 * it, so a content hash of the page (`tracker-page-hash.mjs`, used by `operations/tracker-refresh.mjs`) changes when
 * the CONTENT changes, not when a commit that touched nothing shown here, or the clock, moves the stamp.
 *
 * NO SCRIPT. Collapsing is `<details>`; every table is plain markup.
 */
import { FONT_IMPORT_CSS, PALETTE_CSS, proseToHtml } from './prototype-tracker-render.mjs';
import { parsePriorityOrder } from './priority-order.mjs';
import { stripStamp } from './tracker-page-hash.mjs';

/** How many upcoming items the first table carries; the rest go behind a collapsed "N more". */
export const UP_NEXT_COUNT = 15;
/** A row's title is cut to about this many characters. */
export const TITLE_MAX = 40;
/** The epic goal is shown as at most this many characters (and clamped to two lines). */
export const GOAL_MAX = 200;

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Cut `text` to about `max` characters on a word boundary when one is close, with an ellipsis. PURE. */
export function cutText(text, max = TITLE_MAX) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max - 1);
  const sp = head.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? head.slice(0, sp) : head).replace(/[\s,;:.—-]+$/, '')}…`;
}

/** The first `# ` heading of a card, after its frontmatter; `null` when it has none. PURE. */
export function cardTitleFromText(text) {
  const body = String(text ?? '').replace(/^---\n[\s\S]*?\n---\n?/, '');
  const m = /^# (.+)$/m.exec(body);
  return m ? m[1].trim() : null;
}

/** One line `N. #id · size · band · why` (or a claimed / off-path line) split into its cells. PURE. */
function splitCells(line) {
  return String(line).split(' · ').map((c) => c.trim());
}

/**
 * The priority list as rows. PURE. Entries come from `parsePriorityOrder` (the gate's own parser, so this page and
 * `check-priority` can never disagree about what counts as a line); the cells are read off each entry's line.
 * @param {string} trackerText the whole tracker card
 * @returns {{found: boolean,
 *   ordered: Array<{rank: number, id: string, size: string, band: string, why: string, unwritten: boolean}>,
 *   claimed: Array<{id: string, size: string, why: string, unwritten: boolean}>,
 *   offpath: Array<{id: string, size: string, why: string}>}}
 */
export function parsePriorityRows(trackerText) {
  const lines = String(trackerText ?? '').split('\n');
  const { found, entries } = parsePriorityOrder(trackerText);
  const ordered = [];
  const claimed = [];
  for (const e of entries) {
    const cells = splitCells(lines[e.line - 1]);
    const size = cells[1] ?? '';
    if (e.kind === 'ordered') {
      ordered.push({ rank: e.n, id: e.id, size, band: cells[2] ?? '', why: cells.slice(3).join(' · '), unwritten: e.unwritten });
    } else {
      claimed.push({ id: e.id, size, why: cells.slice(3).join(' · '), unwritten: e.unwritten });
    }
  }
  // The off-path list: `- off-path #id · size · prose`, inside the priority section only.
  const offpath = [];
  const start = lines.findIndex((l) => l.trimEnd() === '## Priority order');
  if (start >= 0) {
    for (let i = start + 1; i < lines.length && !/^## /.test(lines[i]); i++) {
      const m = /^-\s+off-path\s+#([0-9a-z]+)\b(.*)$/.exec(lines[i]);
      if (!m) continue;
      const cells = splitCells(`#${m[1]}${m[2]}`);
      offpath.push({ id: m[1], size: cells[1] ?? '', why: cells.slice(2).join(' · ') });
    }
  }
  return { found, ordered, claimed, offpath };
}

/** `#NNN` as text, or a link to `<base>/backlog/<n>/` when the page has a base URL. PURE. */
export function cardRef(id, baseUrl = '') {
  const base = String(baseUrl ?? '').replace(/\/+$/, '');
  return base ? `<a href="${esc(base)}/backlog/${esc(id)}/">#${esc(id)}</a>` : `#${esc(id)}`;
}

/** The short title shown for one row: the card's H1 cut, else the cut "why" text. PURE. */
export function rowTitle(row, titles) {
  const h1 = titles instanceof Map ? titles.get(row.id) : titles?.[row.id];
  if (h1) return cutText(h1, TITLE_MAX);
  return cutText(String(row.why ?? '').replace(/^(operator-added\s+·\s+)?(Clears|Removes|Adds|Off path|Container)[^:]*:\s*/i, ''), TITLE_MAX);
}

/**
 * One table of rows — the ONLY table shape on the page: rank, card (`#NNN` and its short title), band, size.
 * A row whose card is claimed (`status: active`) carries a `claimed` tag. PURE.
 * @param {Array<{rank: (number|string), id: string, size: string, band: string}>} rows
 * @param {{titles?: (Map|object), claimedIds?: Set<string>, baseUrl?: string}} [ctx]
 */
export function renderRowsTable(rows, { titles, claimedIds = new Set(), baseUrl = '' } = {}) {
  if (!rows.length) return '<p class="empty">none</p>';
  const body = rows.map((r) => `<tr><td class="rank">${esc(r.rank)}</td><td class="card"><span class="num">${cardRef(r.id, baseUrl)}</span>${claimedIds.has(r.id) ? ' <span class="tag">claimed</span>' : ''}<span class="ttl">${esc(rowTitle(r, titles))}</span></td><td class="band">${esc(r.band)}</td><td class="size">${esc(r.size)}</td></tr>`).join('');
  return `<table class="rows"><thead><tr><th>#</th><th>Card</th><th>Band</th><th>Size</th></tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * The UP NEXT block: the first `topN` ordered rows as a table, then "N more" collapsed with the same table for the
 * rest. PURE.
 * @returns {{top: object[], rest: object[], html: string}}
 */
export function buildUpNext(ordered, { topN = UP_NEXT_COUNT, titles, claimedIds, baseUrl } = {}) {
  const top = ordered.slice(0, topN);
  const rest = ordered.slice(topN);
  const ctx = { titles, claimedIds, baseUrl };
  const html = [
    renderRowsTable(top, ctx),
    rest.length ? `<details><summary>${rest.length} more</summary>${renderRowsTable(rest, ctx)}</details>` : '',
  ].join('');
  return { top, rest, html };
}

/** The counts strip: ordered lines by band, claimed, off-path, and lines still `why: (unwritten)`. PURE. The ordered
 *  and claimed lines together are the "lines" `check-priority` reports. */
export function countsFor({ ordered, claimed, offpath }) {
  const band = { A: 0, B: 0, C: 0 };
  for (const r of ordered) if (r.band in band) band[r.band] += 1;
  const unwritten = ordered.filter((r) => r.unwritten).length + claimed.filter((r) => r.unwritten).length;
  return { ordered: ordered.length, band, claimed: claimed.length, offpath: offpath.length, unwritten };
}

/** The goal in at most two lines: the bold lead sentence of the standing-goal callout, without markdown. PURE. */
export function shortGoal(standingGoal) {
  const plain = String(standingGoal ?? '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  const sentence = /^(.+?\.)(?:\s|$)/.exec(plain)?.[1] ?? plain;
  return cutText(sentence, GOAL_MAX);
}

export { stripStamp };

const dateOf = (u) => `${u.date}${u.qualifier ? `, ${u.qualifier}` : ''}`;

const COMPACT_CSS = `*{box-sizing:border-box;}
body{background:var(--paper); color:var(--ink); font-family:'Public Sans',-apple-system,sans-serif; line-height:1.4; font-size:14px;}
.wrap{max-width:640px; margin:0 auto; padding:16px 16px 40px;}
h1,h2{font-family:'Fraunces',Georgia,serif; text-wrap:balance; margin:0;}
h1{font-size:20px; font-weight:600; line-height:1.2; margin:2px 0 6px;}
h2{font-size:15px; font-weight:600; margin:22px 0 8px;}
.eyebrow,.meta,.counts,summary,.tag,th,.rank,.band,.size,.num,.when,footer{font-family:'IBM Plex Mono',monospace;}
.eyebrow{font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--accent);}
.meta{font-size:11.5px; color:var(--ink-soft);}
.goal{margin:10px 0 0; font-size:13px; color:var(--ink-soft); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;}
pre.needs{margin:0; padding:10px 12px; border-radius:8px; background:var(--accent-soft); border-left:3px solid var(--accent); white-space:pre-wrap; word-break:break-word; font-family:'IBM Plex Mono',monospace; font-size:12px;}
p.none,p.empty,p.warn{margin:0; font-size:13px; color:var(--ink-soft);}
p.warn{color:var(--wait);}
table.rows{width:100%; border-collapse:collapse; table-layout:fixed; background:var(--raised); border:1px solid var(--line); border-radius:8px;}
table.rows th{font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-soft); text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); font-weight:500;}
table.rows td{padding:6px 8px; border-top:1px solid var(--line); vertical-align:top; font-size:12.5px;}
table.rows th:nth-child(1),table.rows td.rank{width:34px;}
table.rows th:nth-child(3),table.rows td.band{width:46px;}
table.rows th:nth-child(4),table.rows td.size{width:64px;}
td.rank,td.band,td.size{font-size:11.5px; color:var(--ink-soft);}
td.card .num{font-size:12px; font-weight:500; color:var(--accent);}
td.card .num a{color:inherit;}
td.card .ttl{display:block; overflow-wrap:anywhere;}
.tag{font-size:10px; padding:1px 6px; border-radius:999px; background:var(--wait-soft); color:var(--wait);}
details{margin:8px 0 0;}
summary{cursor:pointer; font-size:12px; color:var(--ink-soft); padding:4px 0;}
.counts{font-size:12px; color:var(--ink); background:var(--raised); border:1px solid var(--line); border-radius:8px; padding:8px 10px; display:flex; flex-wrap:wrap; gap:4px 14px;}
.counts span b{font-weight:600;}
.latest{margin:0; font-size:13.5px;}
.when{font-size:11px; color:var(--accent);}
details .body{font-size:13px; padding:4px 0 0;}
details .body p,details .body ul{margin:0 0 8px;}
details .body ul{padding-left:18px;}
details .body code{font-family:'IBM Plex Mono',monospace; font-size:.92em; background:var(--paper); padding:1px 4px; border-radius:4px;}
ul.old{list-style:none; margin:4px 0 0; padding:0;}
ul.old li{padding:4px 0; border-top:1px solid var(--line); font-size:12.5px;}
ol.gate{margin:4px 0 0; padding-left:20px; font-size:13px;}
footer{margin-top:24px; font-size:10.5px; color:var(--ink-soft);}
`;

/**
 * Render the compact page fragment (a `<title>`, a `<style>` and body markup — the Artifact tool wraps it). PURE.
 * @param {ReturnType<typeof import('./prototype-tracker-data.mjs').parseTracker>} data
 * @param {object} ctx
 * @param {{found: boolean, ordered: object[], claimed: object[], offpath: object[]}} ctx.priority `parsePriorityRows` output
 * @param {Map<string, string>|Record<string, string>} [ctx.titles] card id -> its H1
 * @param {Set<string>} [ctx.claimedIds] card ids whose own status is `active`
 * @param {string[]|null} [ctx.needsYou] the NEEDS YOU lines, verbatim; `[]` = none; `null` = could not be read
 * @param {string} [ctx.needsYouError] why `needsYou` is `null`
 * @param {string} [ctx.tip] the branch tip's short sha
 * @param {string} ctx.generatedAt the render time, already formatted
 * @param {string} [ctx.baseUrl] when set, card numbers link to `<base>/backlog/<n>/`
 * @param {number} [ctx.topN]
 * @param {string} [ctx.itemNumber]
 */
export function renderCompactHtml(data, ctx = {}) {
  const {
    priority = { found: false, ordered: [], claimed: [], offpath: [] }, titles, claimedIds = new Set(),
    needsYou = null, needsYouError = '', tip = '', generatedAt = '', baseUrl = '', topN = UP_NEXT_COUNT, itemNumber = '3383',
  } = ctx;
  const title = data?.title ?? `Epic #${itemNumber}`;
  const updates = Array.isArray(data?.sessionUpdates) ? data.sessionUpdates : [];
  const latest = data?.latestUpdate ?? null;
  const older = latest ? updates.slice(0, -1).slice().reverse() : [];
  const doneWhen = Array.isArray(data?.doneWhen) ? data.doneWhen : [];
  const tableCtx = { titles, claimedIds, baseUrl };
  const counts = countsFor(priority);
  const goal = shortGoal(data?.standingGoal);

  const needsHtml = needsYou === null
    ? `<p class="warn">unavailable: ${esc(needsYouError || 'operator-queue could not be read')}</p>`
    : needsYou.length ? `<pre class="needs">${esc(needsYou.join('\n'))}</pre>` : '<p class="none">none</p>';

  const upNext = priority.found
    ? buildUpNext(priority.ordered, { topN, ...tableCtx }).html
    : '<p class="warn">the tracker card has no "Priority order" section</p>';
  const claimedRows = priority.claimed.map((r) => ({ ...r, rank: '–', band: 'claimed' }));
  const offpathRows = priority.offpath.map((r) => ({ ...r, rank: '–', band: 'off' }));

  return `<title>Prototype Tracker — #${esc(itemNumber)}</title>
<style>
${FONT_IMPORT_CSS}${PALETTE_CSS}${COMPACT_CSS}</style>
<div class="wrap">
  <header>
    <div class="eyebrow">Epic #${esc(itemNumber)} — prototype tracker</div>
    <h1>${esc(title)}</h1>
    <div class="meta"><span class="stamp">tip ${esc(tip || 'unknown')} · rendered ${esc(generatedAt)}</span></div>
    ${goal ? `<p class="goal">${esc(goal)}</p>` : ''}
  </header>

  <section id="needs-you">
    <h2>Needs you</h2>
    ${needsHtml}
  </section>

  <section id="up-next">
    <h2>Up next</h2>
    ${upNext}
    ${claimedRows.length ? `<details><summary>Claimed (${claimedRows.length})</summary>${renderRowsTable(claimedRows, tableCtx)}</details>` : ''}
    ${offpathRows.length ? `<details><summary>Off-path (${offpathRows.length})</summary>${renderRowsTable(offpathRows, tableCtx)}</details>` : ''}
  </section>

  <section id="counts">
    <h2>Counts</h2>
    <div class="counts"><span><b>${counts.ordered}</b> ordered</span><span>A <b>${counts.band.A}</b></span><span>B <b>${counts.band.B}</b></span><span>C <b>${counts.band.C}</b></span><span>claimed <b>${counts.claimed}</b></span><span>off-path <b>${counts.offpath}</b></span><span>why unwritten <b>${counts.unwritten}</b></span></div>
  </section>

  <section id="notes">
    <h2>Notes</h2>
    ${latest
      ? `<p class="latest"><span class="when">${esc(dateOf(latest))}</span> ${esc(latest.digest)}</p>
    <details><summary>Latest note, in full</summary><div class="body">${proseToHtml(latest.body)}</div></details>`
      : '<p class="empty">no session-update notes yet</p>'}
    ${older.length ? `<details><summary>Earlier notes (${older.length})</summary><ul class="old">${older.map((u) => `<li><span class="when">${esc(dateOf(u))}</span> ${esc(u.digest)}</li>`).join('')}</ul></details>` : ''}
    ${doneWhen.length ? `<details><summary>Done when</summary><ol class="gate">${doneWhen.map((d) => `<li>${esc(d)}</li>`).join('')}</ol></details>` : ''}
  </section>

  <footer>${baseUrl ? `card numbers link to ${esc(String(baseUrl).replace(/\/+$/, ''))}/backlog/&lt;n&gt;/` : 'card numbers are plain text (no base URL)'}</footer>
</div>
`;
}
