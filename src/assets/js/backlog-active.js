// Active-work LIVE board (#1854). Polls /active-progress.json — written by the dev-only watcher
// (scripts/dev/active-progress-watch.mjs), which digests the harness's own workflow run-journal +
// subagent transcripts. Renders running workflows with per-agent phase/state and current activity, so a
// multi-agent /workflow run is followable from the website (the VS Code editor has no /workflows TUI).
//
// Honest scope: the JSON 404s on a static publish (and whenever the watcher isn't running), so this
// degrades to silence — the static, build-time snapshot in #panel-active still stands. Only the LIVE
// overlay needs the watcher. Batches are already shown statically, so the live board renders WORKFLOW
// runs only (the layer the snapshot genuinely lacks).
(function () {
  'use strict';

  var FEED = '/active-progress.json';
  var INTERVAL = 4000;

  var wrap = document.getElementById('active-live');
  var runsEl = document.getElementById('active-live-runs');
  var countEl = document.getElementById('active-live-count');
  var stampEl = document.getElementById('active-live-stamp');
  var tabLive = document.getElementById('active-tab-live');     // live pill ON the tab button
  var tabLiveN = document.getElementById('active-tab-live-n');  // its count
  if (!wrap || !runsEl) return;

  // Surface live activity on the tab itself, so progress is visible from ANY tab (the 1-page view never
  // needs to be open to know something's running). Driven from the same poll as the board below.
  function setTabLive(n) {
    if (!tabLive) return;
    tabLive.hidden = !n;
    if (tabLiveN) tabLiveN.textContent = n || '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // "12s ago" / "4m ago" from an ISO timestamp or epoch ms.
  function ago(t) {
    var ms = typeof t === 'number' ? t : Date.parse(t);
    if (!ms) return '';
    var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return s + 's ago';
    var m = Math.round(s / 60);
    if (m < 60) return m + 'm ago';
    return Math.round(m / 60) + 'h ago';
  }

  function stateClass(st) {
    if (st === 'done') return 'done';
    if (st === 'running' || st === 'active') return 'running';
    if (st === 'failed' || st === 'error') return 'failed';
    return 'pending';
  }

  // One #NNN chip linking to the backlog item it maps to (parsed from the agent label by the watcher).
  function numLink(num) {
    return '<a href="/backlog/' + encodeURIComponent(num) +
      '/" style="color:inherit; text-decoration:none; font-variant-numeric:tabular-nums;">#' + esc(num) + '</a>';
  }

  function agentChip(a) {
    var cls = stateClass(a.state);
    // Dedup label vs num: "slice:1622" + num 1622 → "slice #1622" (not "#1622 slice:1622").
    var inner;
    if (a.num) {
      var role = String(a.label || '').replace(/[#:]?\s*\b\d{2,4}\b/, '').replace(/[:\-\s]+$/, '').trim();
      inner = (role ? esc(role) + ' ' : '') + numLink(a.num);
    } else {
      inner = esc(a.label || a.agentId || 'agent');
    }
    var tip = a.lastLine ? ' title="' + esc(a.lastLine) + '"' : '';
    return '<span class="aw-agent ' + cls + '"' + tip + '><span class="dot"></span>' + inner + '</span>';
  }

  var TERMINAL = { completed: 1, failed: 1, aborted: 1, cancelled: 1 };

  var stateColor = { done: '#166534', running: '#1e40af', failed: '#991b1b', pending: '#475569' };

  // One agent's message block: label (state-coloured) + its message — a running agent shows its live
  // step stream, a finished agent shows its final message (its result), a pending one just its name.
  function agentMsg(a) {
    var cls = stateClass(a.state);
    var head = '<span style="font-size:0.78em; font-weight:600; color:' + (stateColor[cls] || '#475569') + ';">' +
      esc(a.label || a.agentId || 'agent') + (a.num ? ' ' + numLink(a.num) : '') + '</span>';
    var body = '';
    if (cls === 'running' && a.steps && a.steps.length) body = '<div class="aw-stream">' + streamHtml(a.steps.slice(-4)) + '</div>';
    else if (a.lastLine) body = '<div style="font-size:0.78em; color:var(--color-text-muted);">' + esc(a.lastLine) + '</div>';
    return '<div style="margin-bottom:0.3rem;">' + head + body + '</div>';
  }

  function runCard(run) {
    var agents = Array.isArray(run.agents) ? run.agents : [];
    var done = agents.filter(function (a) { return stateClass(a.state) === 'done'; }).length;
    var statusColor = run.status === 'completed' ? '#166534'
      : run.status === 'failed' || run.status === 'aborted' ? '#991b1b' : '#1e40af';
    // Default expanded for a running run (you want to follow it); collapsed for a finished one. A click
    // overrides and sticks across polls.
    var open = (run.id in openRuns) ? openRuns[run.id] : !TERMINAL[run.status];

    var h = '<div style="border:1px solid var(--color-border); border-radius:0.6rem; padding:0.7rem 0.9rem; background:var(--color-surface-alt, #f8fafc);">';
    h += '<div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;' + (open ? ' margin-bottom:0.5rem;' : '') + '">';
    h += '<button type="button" data-run-toggle="' + esc(run.id) + '" style="appearance:none; background:none; border:none; cursor:pointer; font:inherit; font-weight:700; padding:0; color:inherit;">' + (open ? '▾' : '▸') + ' ' + esc(run.name || run.id) + '</button>';
    h += '<span style="font-size:0.72em; font-weight:700; text-transform:uppercase; letter-spacing:0.03em; color:' + statusColor + ';">' + esc(run.status || 'running') + '</span>';
    if (run.phase) h += '<span style="font-size:0.8em; color:var(--color-text-muted);">phase: <strong>' + esc(run.phase) + '</strong></span>';
    h += '<span style="font-size:0.78em; color:var(--color-text-muted); font-variant-numeric:tabular-nums;">' + done + '/' + agents.length + ' agents</span>';
    if (run.updatedAt) h += '<span style="margin-left:auto; font-size:0.72em; color:var(--color-text-muted);">' + esc(ago(run.updatedAt)) + '</span>';
    h += '</div>';

    if (open) {
      // State chips (compact overview of every agent).
      h += '<div style="display:flex; flex-wrap:wrap; gap:0.35rem;">' + agents.map(agentChip).join('') + '</div>';
      // Each agent's message — the part you asked to see. Show agents that produced one; if none have a
      // transcript (pruned for an old run), say so rather than render emptiness.
      var withMsg = agents.filter(function (a) { return a.lastLine || (a.steps && a.steps.length); });
      h += '<div style="margin-top:0.6rem; display:flex; flex-direction:column;">';
      if (withMsg.length) h += withMsg.map(agentMsg).join('');
      else h += '<div style="font-size:0.74em; color:var(--color-text-muted); opacity:0.8;">No agent messages captured — subagent transcripts may be pruned for this run.</div>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  var vitalWf = document.getElementById('aw-vital-workflows');
  var vitalWfN = document.getElementById('aw-vital-workflows-n');
  var openStreams = {};   // num → expanded?  (per-row session stream, persists across polls)
  var openRuns = {};      // run.id → expanded? (per-workflow card, persists across polls)
  var lastDigests = null; // last payload, so a toggle can re-render without waiting for the next poll
  var lastRuns = null;    // last workflow runs, for the same reason

  // hh:mm:ss from an ISO/epoch (for step timestamps).
  function clock(t) {
    var ms = typeof t === 'number' ? t : Date.parse(t);
    if (!ms) return '';
    var d = new Date(ms);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }

  // Render a step list (newest first) — the live "agent progress / step / message" stream.
  function streamHtml(steps) {
    return steps.slice().reverse().map(function (s) {
      return '<div class="aw-step ' + (s.kind === 'tool' ? 'tool' : 'text') + '">' +
        '<span class="at">' + esc(clock(s.at)) + '</span><span class="tx">' + esc(s.text) + '</span></div>';
    }).join('');
  }

  // Overlay each active item's live session digest onto its lane row (matched by num): current todo,
  // last action, and an expandable step stream — the live "chat progress" for non-workflow work.
  var vitalBatchN = document.getElementById('aw-vital-batching-n');

  function applyDigests(digests) {
    lastDigests = digests;
    // Count active items currently linked to a batch (the live session→batch link), so the batching vital
    // reflects what's actually being worked in a batch now — not just the build-time open reservations.
    var liveBatched = 0;
    var rows = document.querySelectorAll('[data-digest-for]');
    for (var i = 0; i < rows.length; i++) {
      var el = rows[i];
      var num = el.getAttribute('data-digest-for');
      var d = digests && digests[num];
      if (!d) { el.hidden = true; el.innerHTML = ''; continue; }
      var h = '';
      // Batch membership (live link) — the session working this item belongs to a /batch run. Shown as a
      // badge so "which work is part of which batch" holds even though the claim didn't tag the item.
      if (d.batch) { liveBatched++; h += '<span style="display:inline-block; align-self:flex-start; padding:0.05rem 0.45rem; margin-bottom:0.2rem; border-radius:9999px; font-size:0.72em; font-weight:700; background:#eef2ff; color:#3730a3; border:1px solid #c7d2fe;">⊘ ' + esc(d.batch) + '</span>'; }
      if (d.currentTodo) h += '<span class="now">▸ ' + esc(d.currentTodo) + '</span>';
      var meta = [];
      if (d.lastTool) meta.push('last: ' + esc(d.lastTool));
      if (d.updatedAt) meta.push(esc(ago(d.updatedAt)));
      if (d.sessionId) meta.push('session ' + esc(d.sessionId));
      if (meta.length) h += '<span class="meta">' + meta.join(' · ') + '</span>';
      if (d.lastLine && !d.currentTodo) h += '<span>' + esc(d.lastLine) + '</span>';
      var steps = Array.isArray(d.steps) ? d.steps : [];
      if (steps.length) {
        var open = !!openStreams[num];
        h += '<button type="button" class="aw-stream-toggle" data-stream-toggle="' + esc(num) + '">' +
          (open ? '▾' : '▸') + ' ' + steps.length + ' steps</button>';
        if (open) h += '<div class="aw-stream">' + streamHtml(steps) + '</div>';
      }
      el.innerHTML = h;
      el.hidden = !h;
    }
    // Reflect live batch membership in the batching vital (max of build-time reservations + live link).
    if (vitalBatchN) {
      var base = parseInt(vitalBatchN.getAttribute('data-base') || vitalBatchN.textContent, 10) || 0;
      if (!vitalBatchN.getAttribute('data-base')) vitalBatchN.setAttribute('data-base', base);
      vitalBatchN.textContent = Math.max(base, liveBatched);
    }
  }

  // Delegated toggles (rows + run cards are re-rendered each poll, so delegate once).
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var st = e.target.closest('[data-stream-toggle]');
    if (st) {
      var num = st.getAttribute('data-stream-toggle');
      openStreams[num] = !openStreams[num];
      applyDigests(lastDigests);
      return;
    }
    var rt = e.target.closest('[data-run-toggle]');
    if (rt) {
      var id = rt.getAttribute('data-run-toggle');
      var run = (lastRuns || []).find(function (r) { return r.id === id; });
      var eff = (id in openRuns) ? openRuns[id] : (run ? !TERMINAL[run.status] : false);
      openRuns[id] = !eff;
      if (lastRuns) runsEl.innerHTML = lastRuns.map(runCard).join('');
    }
  });

  function render(data) {
    applyDigests(data && data.digests);
    var runs = (data && Array.isArray(data.runs) ? data.runs : [])
      .filter(function (r) { return r && r.kind === 'workflow'; })
      .sort(function (a, b) {  // running first, then most-recently-updated
        var at = TERMINAL[a.status] ? 1 : 0, bt = TERMINAL[b.status] ? 1 : 0;
        return at - bt || String(b.updatedAt).localeCompare(String(a.updatedAt));
      });
    // A run is "live" (drives the tab pulse + the workflows vital) while not yet terminal.
    var liveN = runs.filter(function (r) {
      return ['completed', 'failed', 'aborted', 'cancelled'].indexOf(r.status) === -1;
    }).length;
    setTabLive(liveN);
    if (vitalWf) { vitalWf.hidden = !liveN; if (vitalWfN) vitalWfN.textContent = liveN; }
    lastRuns = runs;
    if (!runs.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    if (countEl) countEl.textContent = runs.length;
    if (stampEl) stampEl.textContent = data.updatedAt ? '· updated ' + ago(data.updatedAt) : '';
    runsEl.innerHTML = runs.map(runCard).join('');
  }

  var timer = null;
  function poll() {
    fetch(FEED, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) render(d); else { wrap.hidden = true; setTabLive(0); applyDigests(null); } })
      .catch(function () { /* watcher not running / static publish — stay silent */ wrap.hidden = true; setTabLive(0); applyDigests(null); });
  }

  function start() { if (timer) return; poll(); timer = setInterval(poll, INTERVAL); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  // Only poll while the tab is visible (cheap, and pauses in a background browser tab).
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  start();
})();
