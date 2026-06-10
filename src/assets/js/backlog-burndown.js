// Backlog burndown tab + chart. Data is computed at build time by
// src/_data/burndown.js and embedded as JSON in #burndown-data. This script
// only switches tabs and renders an SVG (no chart library) for the chosen
// granularity, including the future projection past "today".
(function () {
  'use strict';

  // ── Tab switching ──────────────────────────────────────────────────────
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-bd-tab]'));
  var panels = {
    tracked: document.getElementById('panel-tracked'),
    priority: document.getElementById('panel-priority'),
    graph: document.getElementById('panel-graph'),
    burndown: document.getElementById('panel-burndown'),
  };
  var TAB_KEY = 'we-backlog-tab';
  function activate(name, focus) {
    tabs.forEach(function (t) {
      var on = t.dataset.bdTab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;            // roving tabindex (APG tablist)
      if (on && focus) t.focus();
    });
    Object.keys(panels).forEach(function (k) { if (panels[k]) panels[k].hidden = k !== name; });
    try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* ignore */ }
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { activate(t.dataset.bdTab); }); });
  // Keyboard: Left/Right move (and activate) between tabs; Home/End jump to ends.
  var tablist = tabs[0] && tabs[0].parentNode;
  if (tablist) tablist.addEventListener('keydown', function (e) {
    var cur = tabs.findIndex(function (t) { return t.dataset.bdTab === (localStorage.getItem(TAB_KEY) || 'tracked'); });
    if (cur < 0) cur = 0;
    var next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next !== null) { e.preventDefault(); activate(tabs[next].dataset.bdTab, true); }
  });
  // Restore the last-opened tab on reload (default: tracked / hidden burndown).
  var savedTab = null;
  try { savedTab = localStorage.getItem(TAB_KEY); } catch (e) { /* ignore */ }
  activate(savedTab && panels[savedTab] ? savedTab : 'tracked'); // also sets initial roving tabindex

  // ── Chart ──────────────────────────────────────────────────────────────
  var dataEl = document.getElementById('burndown-data');
  var svg = document.getElementById('bd-chart');
  if (!dataEl || !svg) return;
  var bd;
  try { bd = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (bd.empty) return;

  var W = 900, H = 360, PL = 52, PR = 18, PT = 18, PB = 58;
  var ix = PL, iw = W - PL - PR, iy = PT, ih = H - PT - PB;
  var ms = function (d) { return Date.parse(d); };
  var COL = { scope: '#0ea5e9', done: '#16a34a', remaining: '#7c3aed', proj: '#7c3aed', net: '#94a3b8', grid: '#e2e8f0', axis: '#64748b', today: '#cbd5e1' };

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(t) { var d = new Date(t); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate(); }
  function esc(s) { return String(s); }

  function niceMax(v) {
    if (v <= 0) return 10;
    var step = Math.pow(10, Math.floor(Math.log10(v)));
    var n = Math.ceil(v / step) * step;
    if (n / v > 2) n = Math.ceil((v / step) * 2) / 2 * step;
    return n;
  }

  function render(gran) {
    // Focus on the recent window (the dataset is front-loaded), and cap how far
    // the projection extends so the real days fill the width instead of being
    // crushed against "today". Each visible point gets a dated tick + a dot.
    var step = gran === 'daily' ? 1 : gran === 'weekly' ? 7 : 30;
    var histKeep = gran === 'daily' ? 21 : gran === 'weekly' ? 16 : 18;
    var projMaxPts = 6;
    var histAll = bd.series[gran] || bd.series.weekly;
    // Trim the flat leading region (this backlog was opened in a burst, so most
    // of the early timeline is near-zero) and cap to a recent window, so the
    // active burndown fills the width instead of hugging the right edge.
    var peak = histAll[histAll.length - 1].scope || 1;
    var firstActive = histAll.findIndex(function (p) { return p.scope > peak * 0.1; });
    if (firstActive < 0) firstActive = 0;
    // Start exactly one bucket before the line takes off — no long flat lead-in.
    var startIdx = Math.max(Math.max(0, firstActive - 1), histAll.length - histKeep);
    var hist = histAll.slice(startIdx);
    var projWindow = bd.projection.daily
      .filter(function (p, i) { return i % step === 0; })
      .slice(0, projMaxPts + 1);
    var proj = projWindow;
    var todayMs = ms(bd.today);

    var x0 = ms(hist[0].date);
    var x1 = Math.max(ms(hist[hist.length - 1].date), proj.length ? ms(proj[proj.length - 1].date) : todayMs);
    var span = Math.max(1, x1 - x0);
    // Scale Y to the values we actually plot: historical scope (the ceiling)
    // and the projection's remaining lines. NOT scopeNet — that intake forecast
    // grows unbounded and isn't drawn; including it squashed everything.
    var maxY = 0;
    hist.forEach(function (p) { if (p.scope > maxY) maxY = p.scope; });
    proj.forEach(function (p) { if (p.remainingFrozen > maxY) maxY = p.remainingFrozen; if (!bd.diverging && p.remainingNet > maxY) maxY = p.remainingNet; });
    var yMax = niceMax(maxY);

    var X = function (t) { return ix + (ms(t) - x0) / span * iw; };
    var Y = function (v) { return iy + ih - (v / yMax) * ih; };
    var line = function (pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' '); };

    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';

    // Y gridlines + labels
    var ticks = 4;
    for (var i = 0; i <= ticks; i++) {
      var val = yMax * i / ticks, yy = Y(val);
      s += '<line x1="' + ix + '" y1="' + yy.toFixed(1) + '" x2="' + (ix + iw) + '" y2="' + yy.toFixed(1) + '" stroke="' + COL.grid + '" stroke-width="1"/>';
      s += '<text x="' + (ix - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-size="11" fill="' + COL.axis + '">' + Math.round(val) + '</text>';
    }
    // X axis: a dated tick under every visible day/week/month point.
    var ly = iy + ih + 14;
    var tick = function (dateStr) {
      var xx = X(dateStr);
      s += '<text x="' + xx.toFixed(1) + '" y="' + ly + '" font-size="9" fill="' + COL.axis + '" text-anchor="end" transform="rotate(-40 ' + xx.toFixed(1) + ' ' + ly + ')">' + fmtDate(ms(dateStr)) + '</text>';
    };
    hist.forEach(function (p) { tick(p.date); });
    proj.forEach(function (p, idx) { if (idx > 0) tick(p.date); });

    // Today marker
    var tx = X(bd.today);
    s += '<line x1="' + tx.toFixed(1) + '" y1="' + iy + '" x2="' + tx.toFixed(1) + '" y2="' + (iy + ih) + '" stroke="' + COL.today + '" stroke-width="1.5" stroke-dasharray="2 3"/>';
    s += '<text x="' + tx.toFixed(1) + '" y="' + (iy + 11) + '" text-anchor="middle" font-size="10" fill="' + COL.axis + '">today</text>';

    // Historical lines
    var scopePts = hist.map(function (p) { return [X(p.date), Y(p.scope)]; });
    var donePts = hist.map(function (p) { return [X(p.date), Y(p.done)]; });
    var remPts = hist.map(function (p) { return [X(p.date), Y(p.remaining)]; });
    s += '<path d="' + line(scopePts) + '" fill="none" stroke="' + COL.scope + '" stroke-width="2"/>';
    s += '<path d="' + line(donePts) + '" fill="none" stroke="' + COL.done + '" stroke-width="2"/>';
    s += '<path d="' + line(remPts) + '" fill="none" stroke="' + COL.remaining + '" stroke-width="2.5"/>';

    // Projection (from today forward)
    var frozenPts = proj.map(function (p) { return [X(p.date), Y(p.remainingFrozen)]; });
    s += '<path d="' + line(frozenPts) + '" fill="none" stroke="' + COL.proj + '" stroke-width="2" stroke-dasharray="6 4" opacity="0.8"/>';
    if (!bd.diverging) {
      var netPts = proj.map(function (p) { return [X(p.date), Y(p.remainingNet)]; });
      s += '<path d="' + line(netPts) + '" fill="none" stroke="' + COL.net + '" stroke-width="2" stroke-dasharray="2 3" opacity="0.9"/>';
    }

    // Per-point dots (with a native tooltip on the remaining marker).
    hist.forEach(function (p) {
      var px = X(p.date).toFixed(1);
      s += '<circle cx="' + px + '" cy="' + Y(p.scope).toFixed(1) + '" r="2.2" fill="' + COL.scope + '"/>';
      s += '<circle cx="' + px + '" cy="' + Y(p.done).toFixed(1) + '" r="2.2" fill="' + COL.done + '"/>';
      s += '<circle cx="' + px + '" cy="' + Y(p.remaining).toFixed(1) + '" r="3" fill="' + COL.remaining + '"><title>' + p.date + ': ' + p.remaining + ' remaining (scope ' + p.scope + ', done ' + p.done + ')</title></circle>';
    });
    proj.forEach(function (p, idx) {
      if (idx === 0) return;
      var px = X(p.date).toFixed(1);
      s += '<circle cx="' + px + '" cy="' + Y(p.remainingFrozen).toFixed(1) + '" r="2.6" fill="#ffffff" stroke="' + COL.proj + '" stroke-width="1.5"><title>' + p.date + ': ~' + Math.round(p.remainingFrozen) + ' projected remaining</title></circle>';
    });

    svg.innerHTML = s;
  }

  // Granularity toggle, persisted in localStorage so the chosen scale survives a reload (default weekly),
  // matching the graph filter and tab restore above.
  var GRAN_KEY = 'we-backlog-burndown-gran';
  var GRANS = { daily: 1, weekly: 1, monthly: 1 };
  var granBtns = Array.prototype.slice.call(document.querySelectorAll('[data-bd-gran]'));
  function setGran(gran) {
    granBtns.forEach(function (x) { x.classList.toggle('is-active', x.dataset.bdGran === gran); });
    try { localStorage.setItem(GRAN_KEY, gran); } catch (e) { /* ignore */ }
    render(gran);
  }
  granBtns.forEach(function (b) {
    b.addEventListener('click', function () { setGran(b.dataset.bdGran); });
  });

  var savedGran = 'weekly';
  try { var g = localStorage.getItem(GRAN_KEY); if (g && GRANS[g]) savedGran = g; } catch (e) { /* ignore */ }
  setGran(savedGran);
})();
