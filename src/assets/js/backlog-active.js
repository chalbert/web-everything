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
    var label = a.num ? (esc(a.label || ('#' + a.num))) : esc(a.label || a.agentId || 'agent');
    var inner = a.num ? numLink(a.num) + ' ' + esc(a.label || '') : label;
    var tip = a.lastLine ? ' title="' + esc(a.lastLine) + '"' : '';
    return '<span class="aw-agent ' + cls + '"' + tip + '><span class="dot"></span>' + inner + '</span>';
  }

  function runCard(run) {
    var agents = Array.isArray(run.agents) ? run.agents : [];
    var done = agents.filter(function (a) { return stateClass(a.state) === 'done'; }).length;
    var running = agents.filter(function (a) { return stateClass(a.state) === 'running'; });
    var statusColor = run.status === 'completed' ? '#166534'
      : run.status === 'failed' || run.status === 'aborted' ? '#991b1b' : '#1e40af';

    var h = '<div style="border:1px solid var(--color-border); border-radius:0.6rem; padding:0.85rem 1rem; background:var(--color-surface-alt, #f8fafc);">';
    h += '<div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.5rem;">';
    h += '<span style="font-weight:700;">▸ ' + esc(run.name || run.id) + '</span>';
    h += '<span style="font-size:0.72em; font-weight:700; text-transform:uppercase; letter-spacing:0.03em; color:' + statusColor + ';">' + esc(run.status || 'running') + '</span>';
    if (run.phase) h += '<span style="font-size:0.8em; color:var(--color-text-muted);">phase: <strong>' + esc(run.phase) + '</strong></span>';
    h += '<span style="font-size:0.78em; color:var(--color-text-muted); font-variant-numeric:tabular-nums;">' + done + '/' + agents.length + ' agents</span>';
    if (run.updatedAt) h += '<span style="margin-left:auto; font-size:0.72em; color:var(--color-text-muted);">' + esc(ago(run.updatedAt)) + '</span>';
    h += '</div>';

    // Items this run owns (union of agent nums) — the membership signal.
    var nums = {};
    agents.forEach(function (a) { if (a.num) nums[a.num] = 1; });
    var numList = Object.keys(nums).sort(function (x, y) { return Number(x) - Number(y); });
    if (numList.length) {
      h += '<div style="font-size:0.8em; color:var(--color-text-muted); margin-bottom:0.5rem;">owns ' +
        numList.map(numLink).join(' ') + '</div>';
    }

    // Per-agent state chips.
    h += '<div style="display:flex; flex-wrap:wrap; gap:0.35rem;">' + agents.map(agentChip).join('') + '</div>';

    // Current activity — the running agents' last transcript line (slice-3 jsonl tail).
    var live = running.filter(function (a) { return a.lastLine; });
    if (live.length) {
      h += '<div style="margin-top:0.6rem; display:flex; flex-direction:column; gap:0.25rem;">';
      live.forEach(function (a) {
        h += '<div style="font-size:0.78em; color:var(--color-text-muted);"><span style="color:#1e40af; font-weight:600;">' +
          esc(a.label || a.agentId) + '</span>: ' + esc(a.lastLine) + '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function render(data) {
    var runs = (data && Array.isArray(data.runs) ? data.runs : [])
      .filter(function (r) { return r && r.kind === 'workflow'; });
    // A run is "live" (drives the tab pulse) while not yet terminal.
    var liveN = runs.filter(function (r) {
      return ['completed', 'failed', 'aborted', 'cancelled'].indexOf(r.status) === -1;
    }).length;
    setTabLive(liveN);
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
      .then(function (d) { if (d) render(d); else { wrap.hidden = true; setTabLive(0); } })
      .catch(function () { /* watcher not running / static publish — stay silent */ wrap.hidden = true; setTabLive(0); });
  }

  function start() { if (timer) return; poll(); timer = setInterval(poll, INTERVAL); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  // Only poll while the tab is visible (cheap, and pauses in a background browser tab).
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  start();
})();
