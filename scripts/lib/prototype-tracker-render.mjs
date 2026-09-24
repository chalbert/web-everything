/**
 * @file scripts/lib/prototype-tracker-render.mjs
 * @description PURE renderer — turns {@link import('./prototype-tracker-data.mjs').parseTracker} output into
 *   the HTML fragment the `prototype-tracker` skill publishes as an Artifact. No fs, no clock (the caller
 *   supplies `generatedAt`), no git — unit-tested in `__tests__/prototype-tracker-render.test.mjs` on hand-built
 *   data structs, the same split `we:skills-src/decision-docket/` documents as the target shape for this card
 *   (`we:backlog/3562`) but does not yet implement there.
 *
 * WHAT THIS IS DELIBERATELY NOT. It is not a second "Dispatch Scaling Roadmap" — that page (published earlier
 * this session, see the tracker's own session-update log) synthesizes cross-epic research (provider pricing,
 * probation state, a six-phase strategic plan) that does not live as structured text anywhere in the tracker
 * file; reproducing it mechanically would mean inventing content, which is worse than not having a generator
 * at all. This renderer instead does the thing decision-docket's own SKILL.md names as the point: a REAL,
 * literal, mechanically-faithful rendering of the tracker's OWN content — frontmatter, the standing goal, the
 * "Done when" gate, and the full session-update history — so the page can never drift from the card the way a
 * hand-authored one can. The roadmap page keeps its own separate URL and its own hand-maintained cadence;
 * nothing here touches it.
 *
 * Output is a FRAGMENT (a `<title>`, a `<style>`, and body markup) — no `<!doctype>`/`<html>`/`<head>`/`<body>`
 * — because the Artifact tool wraps the file it is given in that skeleton at publish time.
 */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Turn a wall of markdown-ish prose into HTML paragraphs. Deliberately minimal: this card's body prose is
 *  plain paragraphs with occasional `` `code` `` spans and **bold** — not a general markdown renderer, just
 *  enough so the rendered page doesn't show literal asterisks/backticks. PURE. */
export function proseToHtml(text) {
  const paras = String(text ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paras.map((p) => {
    let html = esc(p)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br>');
    // A line that is itself a `- ` list is common in these bodies; render as a <ul> instead of one run-on <p>.
    if (/^-\s+/m.test(p) && p.split('\n').every((l) => /^-\s+/.test(l) || l.trim() === '')) {
      const items = p.split('\n').filter((l) => l.trim()).map((l) => `<li>${esc(l.replace(/^-\s+/, ''))
        .replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')}</li>`).join('');
      return `<ul>${items}</ul>`;
    }
    return `<p>${html}</p>`;
  }).join('\n');
}

/** The web-font import and the light/dark palette of the tracker pages, shared with the compact page
 *  (`prototype-tracker-compact.mjs`) so the two never drift apart. Byte-for-byte the text the full page always carried. */
export const FONT_IMPORT_CSS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
`;
export const PALETTE_CSS = `:root{
  --paper:#f6f5f2; --raised:#ffffff; --ink:#1c1f22; --ink-soft:#5a6570; --line:#dee3e6;
  --accent:#a8433d; --accent-soft:#f6e4e2; --ok:#0f7a72; --ok-soft:#e2f1ef; --wait:#b8791f; --wait-soft:#f7ecd9;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --paper:#14171a; --raised:#1b1f23; --ink:#eef1f2; --ink-soft:#a3adb5; --line:#2b323a;
    --accent:#e2807a; --accent-soft:#3a1f1d; --ok:#4fc3b8; --ok-soft:#183531; --wait:#e0a94a; --wait-soft:#332a15;
  }
}
:root[data-theme="dark"]{
  --paper:#14171a; --raised:#1b1f23; --ink:#eef1f2; --ink-soft:#a3adb5; --line:#2b323a;
  --accent:#e2807a; --accent-soft:#3a1f1d; --ok:#4fc3b8; --ok-soft:#183531; --wait:#e0a94a; --wait-soft:#332a15;
}
`;

const STATUS_LABEL = { active: 'active', open: 'open', resolved: 'resolved', parked: 'parked' };

/**
 * Render the full page fragment. PURE.
 * @param {ReturnType<typeof import('./prototype-tracker-data.mjs').parseTracker>} data
 * @param {{generatedAt: string, itemNumber?: string, sourcePath?: string}} ctx
 *   `generatedAt` — an already-formatted string (caller decides format/zone); this module does no date math.
 * @returns {string}
 */
export function renderTrackerHtml(data, { generatedAt, itemNumber = '3383', sourcePath = '' } = {}) {
  const fm = data?.frontmatter ?? {};
  const title = data?.title ?? `Epic #${itemNumber}`;
  const status = STATUS_LABEL[fm.status] ?? (fm.status || 'unknown');
  const updates = Array.isArray(data?.sessionUpdates) ? data.sessionUpdates : [];
  const latest = data?.latestUpdate ?? null;
  const older = latest ? updates.slice(0, -1).slice().reverse() : [];
  const doneWhen = Array.isArray(data?.doneWhen) ? data.doneWhen : [];

  return `<title>Prototype Tracker — #${esc(itemNumber)}</title>
<style>
${FONT_IMPORT_CSS}${PALETTE_CSS}*{box-sizing:border-box;}
body{background:var(--paper); color:var(--ink); font-family:'Public Sans',-apple-system,sans-serif; line-height:1.55;}
.wrap{max-width:860px; margin:0 auto; padding:48px 24px 88px;}
h1,h2,h3{font-family:'Fraunces',Georgia,serif; text-wrap:balance; margin:0 0 8px;}
.eyebrow{font-family:'IBM Plex Mono',monospace; font-size:11.5px; letter-spacing:.07em; text-transform:uppercase; color:var(--accent); margin-bottom:8px;}
header.hero h1{font-size:clamp(24px,3.6vw,34px); font-weight:600; letter-spacing:-0.01em; margin-bottom:10px;}
.badges{display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 6px;}
.badge{font-family:'IBM Plex Mono',monospace; font-size:11.5px; padding:4px 10px; border-radius:999px; border:1px solid var(--line); color:var(--ink-soft);}
.badge.status-active{background:var(--ok-soft); color:var(--ok); border-color:transparent;}
.badge.status-open{background:var(--wait-soft); color:var(--wait); border-color:transparent;}
.meta{font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--ink-soft); margin-top:14px;}
.goal{margin:22px 0; padding:14px 18px; border-radius:10px; background:var(--accent-soft); border-left:3px solid var(--accent); font-size:14.5px;}
.goal b{color:var(--accent); font-family:'IBM Plex Mono',monospace; font-size:11px; text-transform:uppercase; letter-spacing:.04em; display:block; margin-bottom:6px;}
section{margin-top:40px;}
section > h2{font-size:19px; margin-bottom:14px;}
.gate{border:1px solid var(--line); border-radius:12px; background:var(--raised); padding:6px 4px;}
.gitem{display:flex; gap:10px; padding:12px 16px; font-size:14px; border-top:1px solid var(--line);}
.gitem:first-child{border-top:none;}
.gnum{font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--ink-soft); flex:none; padding-top:2px;}
.card{border:1px solid var(--line); border-radius:12px; background:var(--raised); padding:20px 22px; margin-bottom:16px;}
.card.latest{border-color:var(--accent); border-width:2px; box-shadow:0 0 0 4px var(--accent-soft);}
.card .when{font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--accent); text-transform:uppercase; letter-spacing:.03em; margin-bottom:6px;}
.card.latest .when::before{content:'● latest — '; }
.card h3{font-size:16.5px; margin-bottom:10px;}
.card p, .card ul{font-size:14px; margin:0 0 10px;}
.card ul{padding-left:20px;}
.card code{font-family:'IBM Plex Mono',monospace; font-size:0.92em; background:var(--paper); padding:1px 4px; border-radius:4px;}
details.card summary{cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:baseline; gap:10px;}
details.card summary::-webkit-details-marker{display:none;}
details.card summary .when{margin-bottom:0;}
details.card summary .digest{font-family:'Fraunces',serif; font-size:15px; color:var(--ink); flex:1;}
details.card summary .toggle{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--ink-soft);}
details.card[open] summary{margin-bottom:12px;}
footer{margin-top:56px; padding-top:18px; border-top:1px solid var(--line); font-size:12px; color:var(--ink-soft); font-family:'IBM Plex Mono',monospace;}
.empty{color:var(--ink-soft); font-size:13.5px; font-style:italic;}
</style>
<div class="wrap">
  <header class="hero">
    <div class="eyebrow">Epic #${esc(itemNumber)} — prototype tracker</div>
    <h1>${esc(title)}</h1>
    <div class="badges">
      <span class="badge status-${esc(fm.status || '')}">${esc(status)}</span>
      ${fm.dateOpened ? `<span class="badge">opened ${esc(fm.dateOpened)}</span>` : ''}
      ${fm.dateStarted ? `<span class="badge">started ${esc(fm.dateStarted)}</span>` : ''}
      ${updates.length ? `<span class="badge">${updates.length} session update${updates.length === 1 ? '' : 's'}</span>` : ''}
    </div>
    <div class="meta">generated ${esc(generatedAt)} · mechanically from ${esc(sourcePath || `backlog/${itemNumber}-*.md`)} — never hand-edited</div>
  </header>

  ${data?.standingGoal ? `<div class="goal"><b>Standing goal</b>${esc(data.standingGoal)}</div>` : ''}

  <section>
    <h2>Done when</h2>
    ${doneWhen.length
      ? `<div class="gate">${doneWhen.map((d, i) => `<div class="gitem"><div class="gnum">${i + 1}</div><div>${esc(d)}</div></div>`).join('')}</div>`
      : '<p class="empty">No "Done when" section found on the card.</p>'}
  </section>

  <section>
    <h2>Latest session update</h2>
    ${latest
      ? `<div class="card latest">
          <div class="when">${esc(latest.date)}${latest.qualifier ? `, ${esc(latest.qualifier)}` : ''}</div>
          <h3>${esc(latest.digest)}</h3>
          ${proseToHtml(latest.body)}
        </div>`
      : '<p class="empty">No session-update entries found on the card yet.</p>'}
  </section>

  ${older.length ? `<section>
    <h2>Earlier updates (${older.length})</h2>
    ${older.map((u) => `<details class="card">
      <summary><span class="when">${esc(u.date)}${u.qualifier ? `, ${esc(u.qualifier)}` : ''}</span><span class="digest">${esc(u.digest)}</span><span class="toggle">expand ▾</span></summary>
      ${proseToHtml(u.body)}
    </details>`).join('\n')}
  </section>` : ''}

  <footer>Generated by <code>node scripts/prototype-tracker.mjs render</code> — a real parser/renderer over the
  card's own text (mirrors the decision-docket pattern). Never hand-edited; re-run the CLI and republish to
  refresh.</footer>
</div>
`;
}
