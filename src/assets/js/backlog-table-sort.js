// Click-to-sort for any `table.sortable` (the /backlog/ Prioritisation table, #258-ish UX).
// Headers carry `data-sort-key` (presence = sortable) and `data-sort-type` (num | text); body cells
// carry `data-sort-val`. Sorting is purely client-side over the already-rendered rows — the server
// emits them in leverage order, and a click re-orders in place. No dependency, no re-fetch.
(function () {
  'use strict';
  var tables = document.querySelectorAll('table.sortable');
  Array.prototype.forEach.call(tables, function (table) {
    var headers = table.querySelectorAll('thead th[data-sort-key]');
    Array.prototype.forEach.call(headers, function (th) {
      th.style.cursor = 'pointer';
      th.setAttribute('role', 'button');
      th.setAttribute('tabindex', '0');
      var run = function () {
        var col = th.cellIndex;
        var type = th.getAttribute('data-sort-type') || 'text';
        // First click on a column: numeric defaults to descending (most leverage first), text ascending.
        var dir = th.getAttribute('data-sort-dir') === 'asc' ? 'desc'
                : th.getAttribute('data-sort-dir') === 'desc' ? 'asc'
                : (type === 'num' ? 'desc' : 'asc');
        // Reset every header's state + indicator, then set this one.
        Array.prototype.forEach.call(headers, function (o) {
          o.removeAttribute('data-sort-dir');
          var oi = o.querySelector('.sort-ind'); if (oi) oi.textContent = '';
        });
        th.setAttribute('data-sort-dir', dir);
        var ind = th.querySelector('.sort-ind'); if (ind) ind.textContent = dir === 'asc' ? ' ▲' : ' ▼';

        var tbody = table.querySelector('tbody');
        var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
        rows.sort(function (a, b) {
          var av = (a.children[col] && a.children[col].getAttribute('data-sort-val')) || '';
          var bv = (b.children[col] && b.children[col].getAttribute('data-sort-val')) || '';
          var cmp = type === 'num'
            ? (parseFloat(av) || 0) - (parseFloat(bv) || 0)
            : String(av).localeCompare(String(bv));
          return dir === 'asc' ? cmp : -cmp;
        });
        rows.forEach(function (r) { tbody.appendChild(r); });
      };
      th.addEventListener('click', run);
      th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(); } });
    });
  });
})();

// Client-side filtering for the /backlog/ Prioritisation table — readiness chips, type chips, and a
// free-text box over `data-search`. Deselecting every chip in a group means "no filter" (show all), so
// the table never silently empties from a half-toggled group. The `data-ptable-count` badge tracks
// the visible row count. Sorting (above) and filtering compose: hidden rows just stay display:none.
(function () {
  'use strict';
  var table = document.querySelector('table.sortable');
  if (!table) return;
  var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
  var readyChips = Array.prototype.slice.call(document.querySelectorAll('[data-pready]'));
  var kindChips = Array.prototype.slice.call(document.querySelectorAll('[data-pkind]'));
  // `splittable` is an ORTHOGONAL facet, not a readiness value — a split candidate (story · size > 8) is
  // ALSO agent-ready or not-ready, so it can't live in the mutually-exclusive readiness group. It's a
  // single ON/OFF toggle (default OFF) that AND-composes with the other filters: when on, narrow to rows
  // carrying `data-splittable`. `splitSummary` is the big "N to split" pill — a one-click shortcut to it.
  var splitChip = document.querySelector('[data-psplit]');
  var splitSummary = document.querySelector('[data-psplitfilter]');
  var search = document.querySelector('[data-ptable-search]');
  var countEl = document.querySelector('[data-ptable-count]');
  if (!readyChips.length && !kindChips.length && !search) return;

  // ── Visual state + persistence ──────────────────────────────────────────────
  // A chip's pressed state lives in `aria-pressed`, but the chip palette (style.css) only highlights
  // `.status-filter-chip.is-active` — the same class home-display.js drives on the Tracked-work chips. So
  // mirror aria-pressed → .is-active on every render, or a click changes nothing visible. The resulting
  // filter (which chips are on + the search box) is remembered in localStorage and re-applied on reload,
  // matching every other backlog filter (graph toggle, tab, home chips).
  var READY_KEY = 'we-backlog-priority-ready';
  var KIND_KEY = 'we-backlog-priority-kind';
  var SPLIT_KEY = 'we-backlog-priority-split';
  var SEARCH_KEY = 'we-backlog-priority-search';
  function pressedVals(chips, attr) {
    return chips.filter(function (c) { return c.getAttribute('aria-pressed') !== 'false'; })
                .map(function (c) { return c.getAttribute(attr); });
  }
  function splitOn() { return splitChip && splitChip.getAttribute('aria-pressed') === 'true'; }
  function syncVisual() {
    readyChips.concat(kindChips).forEach(function (c) {
      c.classList.toggle('is-active', c.getAttribute('aria-pressed') !== 'false');
    });
    // The split toggle defaults OFF, so (unlike the groups above) is-active tracks pressed === 'true'.
    if (splitChip) splitChip.classList.toggle('is-active', splitOn());
  }
  function save() {
    try {
      localStorage.setItem(READY_KEY, JSON.stringify(pressedVals(readyChips, 'data-pready')));
      localStorage.setItem(KIND_KEY, JSON.stringify(pressedVals(kindChips, 'data-pkind')));
      localStorage.setItem(SPLIT_KEY, splitOn() ? '1' : '0');
      localStorage.setItem(SEARCH_KEY, (search && search.value) || '');
    } catch (e) { /* ignore */ }
  }
  // Restore before the first apply(). A chip not in the saved list is set unpressed; a missing/garbled key
  // leaves the server default (all pressed = no filter) untouched.
  function restore() {
    try {
      var r = JSON.parse(localStorage.getItem(READY_KEY));
      if (Array.isArray(r)) readyChips.forEach(function (c) { c.setAttribute('aria-pressed', r.indexOf(c.getAttribute('data-pready')) >= 0 ? 'true' : 'false'); });
      var t = JSON.parse(localStorage.getItem(KIND_KEY));
      if (Array.isArray(t)) kindChips.forEach(function (c) { c.setAttribute('aria-pressed', t.indexOf(c.getAttribute('data-pkind')) >= 0 ? 'true' : 'false'); });
      var s = localStorage.getItem(SPLIT_KEY);
      if (splitChip && s != null) splitChip.setAttribute('aria-pressed', s === '1' ? 'true' : 'false');
      var q = localStorage.getItem(SEARCH_KEY);
      if (search && typeof q === 'string') search.value = q;
    } catch (e) { /* ignore */ }
  }

  // Active set for a chip group; empty (= none pressed) is treated as "no filter" by the caller.
  function active(chips, attr) {
    var set = {}, any = false;
    chips.forEach(function (c) {
      if (c.getAttribute('aria-pressed') !== 'false') { set[c.getAttribute(attr)] = true; any = true; }
    });
    return any ? set : null;            // null → group imposes no constraint
  }

  function apply() {
    var reads = active(readyChips, 'data-pready');
    var kinds = active(kindChips, 'data-pkind');
    var q = ((search && search.value) || '').trim().toLowerCase();
    var shown = 0;
    rows.forEach(function (r) {
      // A pinned row (an in-flight decision being actively made) is still subject to the readiness/type
      // chips — it carries data-readiness="decision", so it stays visible by default and under the
      // Decision filter, but correctly drops out when you narrow to a readiness it isn't (e.g. Batchable
      // should show only batchable cards). Pinning governs ORDER (it's concatenated to the top), not an
      // unconditional filter bypass. Free-text search narrows it like any other row.
      var ok = (!reads || reads[r.getAttribute('data-readiness')])
            && (!kinds || kinds[r.getAttribute('data-kind')])
            && (!splitOn() || r.getAttribute('data-splittable') === 'true')
            && (!q || (r.getAttribute('data-search') || '').indexOf(q) >= 0);
      r.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    if (countEl) countEl.textContent = shown;
    // Every code path that changes chip/search state calls apply() afterwards, so this is the single place
    // to mirror the pressed state onto the chips and persist the whole filter.
    syncVisual();
    save();
  }

  // Summary count chips (data-pfilter) are one-click shortcuts that drive the readiness filter. Manually
  // touching a filter chip / search clears their "active" highlight so it never lies about the state.
  var summaryChips = Array.prototype.slice.call(document.querySelectorAll('[data-pfilter]'));
  function clearSummary() {
    summaryChips.forEach(function (s) { s.setAttribute('aria-pressed', 'false'); s.style.boxShadow = ''; });
    if (splitSummary) { splitSummary.setAttribute('aria-pressed', 'false'); splitSummary.style.boxShadow = ''; }
  }
  function resetAllChips() {
    readyChips.forEach(function (c) { c.setAttribute('aria-pressed', 'true'); });
    kindChips.forEach(function (c) { c.setAttribute('aria-pressed', 'true'); });
    if (splitChip) splitChip.setAttribute('aria-pressed', 'false');   // split defaults OFF (no constraint)
    if (search) search.value = '';
  }

  function bindToggle(chip) {
    chip.addEventListener('click', function () {
      chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'false' ? 'true' : 'false');
      clearSummary();
      apply();
    });
  }
  readyChips.forEach(bindToggle);
  kindChips.forEach(bindToggle);
  if (splitChip) bindToggle(splitChip);   // same flip-and-apply as the group chips; its is-active is OFF-default
  if (search) search.addEventListener('input', function () { clearSummary(); apply(); });

  // The "N to split" summary pill — a one-click shortcut: reset the groups to "all", then turn the split
  // toggle on so the table isolates exactly the split candidates (any tier). Clicking it again clears.
  if (splitSummary) {
    splitSummary.addEventListener('click', function () {
      var wasActive = splitSummary.getAttribute('aria-pressed') === 'true';
      clearSummary();
      resetAllChips();
      if (!wasActive) {
        if (splitChip) splitChip.setAttribute('aria-pressed', 'true');
        splitSummary.setAttribute('aria-pressed', 'true');
        splitSummary.style.boxShadow = '0 0 0 2px #334155';
      }
      apply();
    });
  }

  summaryChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var wasActive = chip.getAttribute('aria-pressed') === 'true';
      clearSummary();
      if (wasActive) {                         // clicking the active shortcut again clears the filter
        resetAllChips();
      } else {
        var cats = (chip.getAttribute('data-pfilter') || '').split(',');
        kindChips.forEach(function (c) { c.setAttribute('aria-pressed', 'true'); });   // readiness-only shortcut
        if (splitChip) splitChip.setAttribute('aria-pressed', 'false');   // a readiness shortcut is a fresh view — drop the split facet
        if (search) search.value = '';
        readyChips.forEach(function (c) {
          c.setAttribute('aria-pressed', cats.indexOf(c.getAttribute('data-pready')) >= 0 ? 'true' : 'false');
        });
        chip.setAttribute('aria-pressed', 'true');
        chip.style.boxShadow = '0 0 0 2px #334155';     // active ring, visible on every chip colour
      }
      apply();
    });
  });

  restore();
  apply();
})();
