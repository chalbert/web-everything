// Plug unplugged-parity table (#1844, epic #1836). Fetches the per-plug 3-state verdicts from the FUI
// MaaS parity route (`${origin}/_maas/parity/`, #1890) at RUNTIME — the cross-origin data path #1839
// mandates — and renders one section per plug domain with a works / works-with-caveat / plugged-only
// badge per public-API capability (the #1888 schema shape: PlugParityManifest → PlugParityCapability).
//
// WE holds only the schema; the verdict VALUES are a measured FUI-runtime fact (#1839/#1282 zero-impl),
// so this page has no build-time data. If the FUI origin is unreachable (e.g. a static publish with no
// FUI host, or the dev server is down) the page degrades to an honest "couldn't load" message rather
// than a blank table — the same graceful-degradation posture as the live backlog board.
(function () {
  'use strict';

  var root = document.getElementById('parity-root');
  if (!root) return;
  var origin = (root.getAttribute('data-parity-origin') || '').replace(/\/$/, '');
  var loadingEl = document.getElementById('parity-loading');
  var errorEl = document.getElementById('parity-error');
  var domainsEl = document.getElementById('parity-domains');
  var emptyEl = document.getElementById('parity-empty');
  var search = document.getElementById('parity-search');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // The #1839 3-state vocab → <we-badge> tone + label. Unknown states fall back to neutral so a future
  // 4th state never silently disappears.
  function stateTone(state) {
    if (state === 'works') return 'success';
    if (state === 'works-with-caveat') return 'warning';
    if (state === 'plugged-only') return 'danger';
    return 'neutral';
  }
  function stateLabel(state) {
    if (state === 'works') return 'works';
    if (state === 'works-with-caveat') return 'works with caveat';
    if (state === 'plugged-only') return 'plugged-only';
    return state;
  }

  // A "#1856"-style fix-card ref → a backlog link (the not-yet-ported pendingPort pointer).
  function cardLink(ref) {
    var num = String(ref || '').replace(/^#/, '');
    if (!/^\d+$/.test(num)) return esc(ref);
    return '<a href="/backlog/' + num + '/" style="font-variant-numeric: tabular-nums;">#' + num + '</a>';
  }

  // One capability → a <tr>. data-haystack carries everything the search filters over.
  function renderCapability(domain, cap) {
    var detail = '';
    if (cap.state === 'works-with-caveat' && cap.note) {
      detail += '<div class="parity-note">' + esc(cap.note);
      if (cap.pendingPort) {
        detail += ' <span class="parity-pending">Not yet ported &mdash; tracked by ' +
          cardLink(cap.pendingPort) + '.</span>';
      }
      detail += '</div>';
    } else if (cap.state === 'plugged-only' && cap.residue) {
      detail += '<div class="parity-residue"><strong>Residue:</strong> ' + esc(cap.residue) + '</div>';
    }
    var grounding = cap.grounding
      ? '<div class="parity-grounding"><code>' + esc(cap.grounding) + '</code></div>'
      : '';
    var haystack = [
      domain, cap.capability, cap.state, cap.note, cap.residue, cap.pendingPort, cap.grounding
    ].join(' ').toLowerCase();
    return '<tr class="parity-row" data-haystack="' + esc(haystack) + '">' +
      '<td class="parity-cap">' + esc(cap.capability) + detail + grounding + '</td>' +
      '<td class="parity-verdict"><we-badge tone="' + stateTone(cap.state) + '">' +
        esc(stateLabel(cap.state)) + '</we-badge></td>' +
      '</tr>';
  }

  // One plug manifest → a titled section with its capability table.
  function renderDomain(m) {
    var caps = Array.isArray(m.capabilities) ? m.capabilities : [];
    var rows = caps.map(function (c) { return renderCapability(m.domain, c); }).join('');
    var meta = '';
    if (m.auditedDate) {
      meta += '<span class="parity-domain-meta">audited ' + esc(m.auditedDate) + '</span>';
    }
    return '<section class="parity-domain" data-domain="' + esc(String(m.domain).toLowerCase()) + '">' +
      '<h2 class="parity-domain-title">' + esc(m.domain) + ' ' + meta + '</h2>' +
      '<table class="parity-table"><thead><tr>' +
        '<th scope="col">Public-API capability</th><th scope="col">Unplugged</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '</section>';
  }

  function applyFilter() {
    var q = (search && search.value ? search.value : '').trim().toLowerCase();
    var rows = Array.prototype.slice.call(domainsEl.querySelectorAll('.parity-row'));
    var anyVisible = false;
    rows.forEach(function (row) {
      var ok = !q || row.getAttribute('data-haystack').indexOf(q) !== -1;
      row.style.display = ok ? '' : 'none';
      if (ok) anyVisible = true;
    });
    // Hide a domain section whose every row is filtered out.
    Array.prototype.slice.call(domainsEl.querySelectorAll('.parity-domain')).forEach(function (sec) {
      var visibleRows = Array.prototype.slice.call(sec.querySelectorAll('.parity-row'))
        .some(function (r) { return r.style.display !== 'none'; });
      sec.style.display = visibleRows ? '' : 'none';
    });
    if (emptyEl) emptyEl.hidden = anyVisible;
  }

  function fail(msg) {
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.style.color = 'var(--color-text-muted)';
      errorEl.innerHTML = esc(msg);
    }
  }

  fetch(origin + '/_maas/parity/', { headers: { Accept: 'application/json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var domains = (data && Array.isArray(data.domains)) ? data.domains : [];
      if (loadingEl) loadingEl.hidden = true;
      if (!domains.length) {
        fail('No plug parity manifests are published yet.');
        return;
      }
      domainsEl.innerHTML = domains.map(renderDomain).join('');
      if (search) search.addEventListener('input', applyFilter);
    })
    .catch(function () {
      fail('Couldn’t load the live parity verdicts from the Frontier UI data origin. ' +
        'They’re measured at runtime, so this table needs the FUI host reachable.');
    });
})();
