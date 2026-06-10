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
  var typeChips = Array.prototype.slice.call(document.querySelectorAll('[data-ptype]'));
  var search = document.querySelector('[data-ptable-search]');
  var countEl = document.querySelector('[data-ptable-count]');
  if (!readyChips.length && !typeChips.length && !search) return;

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
    var types = active(typeChips, 'data-ptype');
    var q = ((search && search.value) || '').trim().toLowerCase();
    var shown = 0;
    rows.forEach(function (r) {
      var ok = (!reads || reads[r.getAttribute('data-readiness')])
            && (!types || types[r.getAttribute('data-type')])
            && (!q || (r.getAttribute('data-search') || '').indexOf(q) >= 0);
      r.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    if (countEl) countEl.textContent = shown;
  }

  // Summary count chips (data-pfilter) are one-click shortcuts that drive the readiness filter. Manually
  // touching a filter chip / search clears their "active" highlight so it never lies about the state.
  var summaryChips = Array.prototype.slice.call(document.querySelectorAll('[data-pfilter]'));
  function clearSummary() {
    summaryChips.forEach(function (s) { s.setAttribute('aria-pressed', 'false'); s.style.boxShadow = ''; });
  }
  function resetAllChips() {
    readyChips.forEach(function (c) { c.setAttribute('aria-pressed', 'true'); });
    typeChips.forEach(function (c) { c.setAttribute('aria-pressed', 'true'); });
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
  typeChips.forEach(bindToggle);
  if (search) search.addEventListener('input', function () { clearSummary(); apply(); });

  summaryChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var wasActive = chip.getAttribute('aria-pressed') === 'true';
      clearSummary();
      if (wasActive) {                         // clicking the active shortcut again clears the filter
        resetAllChips();
      } else {
        var cats = (chip.getAttribute('data-pfilter') || '').split(',');
        typeChips.forEach(function (c) { c.setAttribute('aria-pressed', 'true'); });   // readiness-only shortcut
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

  apply();
})();
