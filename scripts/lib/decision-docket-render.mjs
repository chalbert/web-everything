/**
 * @file decision-docket-render.mjs — the TEMPLATE half of the Decision Docket's data/template separation
 * (see decision-docket-data.mjs's header for the full "why" — the meta-commentary problem this pair fixes).
 *
 * `renderDocketHtml(data, templateHtml)` is a PURE function: the same `data` JSON and the same
 * `skills-src/decision-docket/template.html` content always produce byte-identical HTML. There is no code
 * path here that accepts free-text narrative ("correction", "second pass", "false alarm") — the render
 * function only knows how to turn the data schema's fields into markup, so there is nowhere to hand-inject
 * session commentary without editing THIS file (which would then apply to every future render, not just one
 * page — exactly the discipline a real template is supposed to enforce). Any note about how the data changed
 * belongs in `git log` on the JSON data file this reads, never in the rendered output.
 *
 * Reuses `template.html`'s own CSS/token palette VERBATIM (sliced out of the real file at render time) rather
 * than re-declaring it here, so the two can never drift into two different visual languages — the exact
 * failure `skills-src/decision-docket/SKILL.md` documents happened to the last two hand-built revisions.
 */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * Minimal, deterministic inline-markdown → HTML for the prose fragments extracted out of a backlog item's own
 * body (option text, skeptic/screen verdicts, digest paragraphs). Escapes first, then converts ``code``,
 * **bold**, *italic*. A markdown link `[text](url)` renders as its visible TEXT only (this is a standalone
 * published page, not a place the source repo's relative backlog paths resolve) — dropping the href is a
 * deliberate, deterministic choice, not a parsing failure.
 * @param {string} s
 * @returns {string}
 */
export function mdInline(s) {
  let t = escapeHtml(s);
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Non-greedy `.+?` (not `[^*]+`) — a **bold** span routinely contains a nested *italic* word (single
  // asterisks), and requiring "no asterisk at all" inside the bold match would refuse to match those spans at
  // all, leaving the raw `**` markers in the rendered output.
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  return t;
}

/** Age → the docket's three-way bucket + row class, mirroring the past docket's own convention. */
export function ageClass(days) {
  if (days > 60) return 'stale';
  if (days > 30) return 'waiting';
  return 'fresh';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function humanDate(d) {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Slice `template.html`'s own head+style shell (everything before `<div class="wrap">`) out verbatim. */
function extractShell(templateHtml) {
  const marker = '<div class="wrap">';
  const idx = templateHtml.indexOf(marker);
  if (idx === -1) throw new Error('decision-docket template.html: could not find the <div class="wrap"> marker — has the template shape changed?');
  return templateHtml.slice(0, idx);
}

function renderOption(opt) {
  const cls = opt.kind === 'default' ? 'oc' : opt.kind === 'rejected' ? 'ov' : 'oo';
  const mark = opt.kind === 'default' ? '✓ Default' : opt.kind === 'rejected' ? '✕ Rejected' : '○ Option';
  return `<div class="opt ${cls}">
            <div class="opt-lbl">${mark} — ${escapeHtml(opt.label)}</div>
            <div class="opt-bd">${mdInline(opt.body)}</div>
          </div>`;
}

function optsWidthClass(count) {
  if (count <= 1) return ' one';
  if (count === 3) return ' three';
  return '';
}

function renderNote(note) {
  if (note.kind === 'code') return `<pre><code>${escapeHtml(note.text)}</code></pre>`;
  return `<p>${mdInline(note.text)}</p>`;
}

function renderFork(fork) {
  // A fork whose body doesn't match the documented prepared-fork shape (docs/agent/backlog-workflow.md
  // #decision-docket) most often predates that convention — it uses a different, more free-form markdown
  // dialect (bracket markers like "[bold default]" instead of "← **RECOMMENDED**", sub-bullets nested INSIDE
  // one option's own body, unclosed ** pairs). Attempting to render that prose through the same fixed inline
  // rules the canonical shape earns produces genuinely garbled output — stray literal "**", flattened
  // sub-bullets running on as unpunctuated dash-separated fragments — which is worse than showing nothing:
  // a decider could misread a mangled fragment as the item's actual position. So a parse-incomplete fork
  // shows ONLY its heading + a clear referral to the source file, never a best-effort (and possibly
  // misleading) rendering of content this renderer could not confidently structure.
  if (!fork.parseOk) {
    return `
        <div class="forkhd"><span class="forktag">FORK ${fork.n}</span> ${mdInline(fork.crux || '')}</div>
        <p class="attack flagged"><b>Parse incomplete:</b> ${escapeHtml(fork.warning || 'this fork did not match the documented prepared-fork shape.')} Read this fork directly in the item's own file — the extracted text is not shown here rather than risk a garbled or misleading render.</p>`;
  }

  const optsHtml = fork.options.map(renderOption).join('\n          ');
  const notesHtml = fork.notes.map(renderNote).join('\n        ');
  // The verdict CLASS is read off the START of the Skeptic/Screen text (the actual vocabulary — REFUTED /
  // SURVIVES[-WITH-AMENDMENT] for Skeptic, clear / flagged(impl|prio) for Screen — docs/agent/backlog-
  // workflow.md's "two-confusion screen"), never a substring search: the prose ITSELF routinely uses the word
  // "flagged" in an unrelated sense ("the attack also flagged X as under-specified"), which a substring match
  // would misread as the verdict.
  const screenText = (fork.screen || '').trim();
  const skepticText = (fork.skeptic || '').trim();
  const attackClass = /^flagged/i.test(screenText) ? 'flagged' : /^REFUTED/i.test(skepticText) ? 'refuted' : 'clear';
  const skepticScreen = (fork.skeptic || fork.screen)
    ? `<p class="attack ${attackClass}">${fork.skeptic ? `<b>Skeptic:</b> ${mdInline(fork.skeptic)}` : ''}${fork.skeptic && fork.screen ? ' &nbsp;·&nbsp; ' : ''}${fork.screen ? `<b>Screen:</b> ${mdInline(fork.screen)}` : ''}</p>`
    : '';
  return `
        <div class="forkhd"><span class="forktag">FORK ${fork.n}</span> ${mdInline(fork.crux || '')}</div>
        ${fork.why ? `<p class="forkwhy">${mdInline(fork.why)}</p>` : ''}
        <div class="opts${optsWidthClass(fork.options.length)}">
          ${optsHtml}
        </div>
        ${notesHtml}
        ${skepticScreen}`;
}

function renderDoneWhen(doneWhen) {
  if (!doneWhen.length) return 'See the item\'s own <code>## Done when</code> section.';
  return mdInline(doneWhen[0]);
}

function renderCard(item) {
  const forksHtml = item.forks.map(renderFork).join('\n');
  const digestHtml = item.digest.length
    ? item.digest.map((p) => `<p>${mdInline(p)}</p>`).join('\n        ')
    : '<p><em>No digest paragraph could be extracted from this item\'s body.</em></p>';
  const topWarning = item.parseOk
    ? ''
    : `<p><strong>Parse incomplete</strong> — ${escapeHtml((item.warnings || []).join(' ') || 'this item\'s forks did not match the documented prepared-fork shape.')} Ratify from <code>backlog/${escapeHtml(item.num)}-*.md</code> directly until this is fixed.</p>`;
  return `
    <div class="dcard">
      <div class="hd">
        <span class="num">#${escapeHtml(item.num)}</span><span class="nm">${mdInline(item.title)}</span>
        <span class="meta">prepared ${escapeHtml(item.preparedDate || '—')} · unblocks ${item.directUnblocks} · waiting ${item.ageInDays}d</span>
      </div>
      <div class="bd">
        ${digestHtml}
        ${topWarning}
        ${forksHtml}
      </div>
      <div class="thecall"><span>Once ratified</span>${renderDoneWhen(item.doneWhen)}</div>
    </div>`;
}

function renderTableRow(item) {
  const cls = ageClass(item.ageInDays);
  const pill = item.prepared
    ? '<span class="pill prepd">prepared</span>'
    : '<span class="pill warnp">needs prep</span>';
  const agePct = Math.min(100, Math.round((item.ageInDays / 90) * 100));
  return `      <tr class="${cls}">
        <td class="n mono">#${escapeHtml(item.num)}</td>
        <td class="ti">${mdInline(item.title)} ${pill}</td>
        <td class="n mono">${item.directUnblocks}</td>
        <td class="n mono">${item.unblocksToReady}</td>
        <td class="agec"><span class="bar"><i style="width:${agePct}%"></i></span><span class="mono age">${item.ageInDays}d</span></td>
      </tr>`;
}

/**
 * Render the full Decision Docket page from the clean data JSON and the real `template.html` content. PURE:
 * no fs, no clock reads unless `now` is supplied — the same inputs always produce the same output.
 * @param {{ items: object[], generatedAt?: string, generatedFromRef?: string, targetCount?: number }} data
 * @param {string} templateHtml - the raw content of `skills-src/decision-docket/template.html`.
 * @param {{ now?: Date }} [opts]
 * @returns {string}
 */
export function renderDocketHtml(data, templateHtml, { now = new Date() } = {}) {
  const items = Array.isArray(data.items) ? [...data.items] : [];
  items.sort((a, b) => (b.leverageScore ?? 0) - (a.leverageScore ?? 0));

  const prepared = items.filter((i) => i.prepared);
  const needsPrep = items.filter((i) => !i.prepared);
  const stale = items.filter((i) => i.ageInDays > 60);

  const shell = extractShell(templateHtml);
  const kicker = `Session docket · web-everything · ${humanDate(now)}`;

  const rows = items.map(renderTableRow).join('\n');
  const cards = prepared.map(renderCard).join('\n');
  const upstreamRows = needsPrep.map(renderTableRow).join('\n');

  const provenance = [
    `Generated ${now.toISOString()}`,
    data.generatedFromRef ? `from ${escapeHtml(data.generatedFromRef)}` : null,
    `by scripts/gen-decision-docket.mjs (backlog/3562's data/template separation) — regenerate with`,
  ].filter(Boolean).join(' ');

  return `${shell}<div class="wrap">

<header class="mast">
  <p class="kicker">${escapeHtml(kicker)}</p>
  <h1>Decision Docket</h1>
  <p class="lede">Every open decision on the board, ranked by what it unblocks and how long it has waited. <b>${prepared.length} are prepared and awaiting ratification.</b></p>
  <div class="stats">
    <div class="stat a"><div class="v">${prepared.length}</div><div class="k">Ready to ratify</div></div>
    <div class="stat"><div class="v">${needsPrep.length}</div><div class="k">Need preparation</div></div>
    <div class="stat s"><div class="v">${stale.length}</div><div class="k">Waiting 61+ days</div></div>
  </div>
</header>

<section>
  <h2>The docket — ranked by leverage</h2>
  <h3>Prepared and not-yet-prepared, one table for context and ranking ONLY</h3>
  <p><code>unblocks</code> is how many items name this decision as a blocker. <code>to&nbsp;ready</code> is how many of those would become immediately agent-ready once it is ruled. <strong>This table never substitutes for the fork breakdown below</strong>.</p>
  <div class="tw"><table>
    <thead><tr><th>ID</th><th class="ti">Decision</th><th class="n">Unblocks</th><th class="n">To ready</th><th>Waiting</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table></div>
</section>

<section>
  <h2>Prepared — full fork detail</h2>
  <h3>Every prepared item, in full — nothing here is a summary</h3>
  <p>Each card below renders the item's own <code>## Fork N</code> sections: every option, the reason each rejected option was rejected, and the recommended default — never compressed to a title and a row.</p>

  <div class="batch">${cards}
  </div>
</section>

<section>
  <h2>Upstream</h2>
  <h3>Not yet prepared</h3>
  <p>These have no researched forks, options or default yet — a decision turn on them would be cold research, not ratification. <code>/prepare</code> closes the gap.</p>
  <div class="tw"><table>
    <thead><tr><th>ID</th><th class="ti">Decision</th><th class="n">Unblocks</th><th class="n">To ready</th><th>Waiting</th></tr></thead>
    <tbody>
${upstreamRows}
    </tbody>
  </table></div>
</section>

<footer>
  <p>${provenance} <code>npm run gen:decision-docket</code>. This page is deterministically generated — no hand edits; fix the data (backlog files) and regenerate instead.</p>
  <p>Ratify with <code>/next decision</code>. Prepare with <code>/prepare &lt;id&gt;</code>.</p>
</footer>

</div>

</body></html>
`;
}
