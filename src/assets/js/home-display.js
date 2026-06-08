// Per-section display tool for the home page. Each toolbar scopes to its own
// section: a density toggle (default card grid vs. compact list of smaller
// tiles), a magnifying-glass search that expands inline on click, plus opt-in
// status/type filter chips (e.g. /backlog/). The chosen view, the active
// filters, and the search query are all remembered per section in localStorage.
//
// init() is safe to run more than once: the dev server hot-reloads pages with
// morphdom, which re-executes this (classic) script but repaints chips/cards to
// the server default first. So we re-apply the saved state on every run, and
// guard event wiring per-element so re-runs never double-bind. This is what
// keeps the latest filters from being lost on reload after a backlog edit.
(function () {
    function initToolbar(toolbar) {
        const section = toolbar.closest('section');
        if (!section) return;

        // Stable per-section key for localStorage. The visible title carries a
        // live count badge ("Tracked work 186"), so we strip [data-count-target]
        // before reading the text — otherwise the key changes as you filter and
        // the saved state is read back under a key that no longer exists.
        const titleEl = section.querySelector('.section-title');
        let titleText = '';
        if (titleEl) {
            const clone = titleEl.cloneNode(true);
            clone.querySelectorAll('[data-count-target]').forEach(function (n) { n.remove(); });
            titleText = clone.textContent.trim();
        }
        const viewKey = 'we-home-view:' + titleText;
        const statusKey = 'we-status-filter:' + titleText;
        const typeKey = 'we-type-filter:' + titleText;
        const searchKey = 'we-search-filter:' + titleText;

        const buttons = Array.from(toolbar.querySelectorAll('.view-toggle-btn'));
        const search = toolbar.querySelector('.home-search');
        const filter = toolbar.querySelector('.home-filter');
        const countTarget = section.querySelector('[data-count-target]');
        const statusChips = Array.from(section.querySelectorAll('[data-status-chip]'));
        const typeChips = Array.from(section.querySelectorAll('[data-type-chip]'));
        const statusAll = statusChips.map(function (c) { return c.dataset.statusChip; });
        const typeAll = typeChips.map(function (c) { return c.dataset.typeChip; });

        // Cards are re-queried live so a hot-reload that adds/removes a backlog
        // item is reflected without a captured stale list.
        function cards() { return Array.from(section.querySelectorAll('.project-card')); }

        // Active filter sets are derived from localStorage on demand (never held
        // in a closure) so a re-executed script and any surviving click handlers
        // always agree on the current state. `defaultExclude` is hidden until the
        // user opts it back in (resolved is hidden by default).
        function readSet(storageKey, allValues, defaultExclude) {
            let saved = null;
            try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch (e) { /* ignore */ }
            if (Array.isArray(saved)) {
                return new Set(saved.filter(function (s) { return allValues.indexOf(s) !== -1; }));
            }
            return new Set(allValues.filter(function (s) { return defaultExclude.indexOf(s) === -1; }));
        }
        function activeStatuses() { return statusChips.length ? readSet(statusKey, statusAll, ['resolved']) : null; }
        function activeTypes() { return typeChips.length ? readSet(typeKey, typeAll, []) : null; }

        function applyFilter() {
            const q = filter ? filter.value.trim().toLowerCase() : '';
            const st = activeStatuses();
            const ty = activeTypes();
            let shown = 0;
            cards().forEach(function (card) {
                const title = card.querySelector('.project-title');
                const desc = card.querySelector('p');
                const text = ((title ? title.textContent : '') + ' ' + (desc ? desc.textContent : '')).toLowerCase();
                const failSearch = !!q && text.indexOf(q) === -1;
                const failStatus = st && card.dataset.status && !st.has(card.dataset.status);
                const failType = ty && card.dataset.type && !ty.has(card.dataset.type);
                const hidden = failSearch || failStatus || failType;
                card.classList.toggle('is-filtered-out', hidden);
                if (!hidden) shown++;
            });
            if (countTarget) countTarget.textContent = shown;
        }

        function syncChips(chips, attr, activeFn) {
            const set = activeFn();
            chips.forEach(function (chip) {
                const on = set ? set.has(chip.dataset[attr]) : false;
                chip.classList.toggle('is-active', on);
                chip.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
        }

        function wireChips(chips, attr, storageKey, allValues, defaultExclude, activeFn) {
            chips.forEach(function (chip) {
                if (chip.__homeWired) return;
                chip.__homeWired = true;
                chip.addEventListener('click', function () {
                    const set = readSet(storageKey, allValues, defaultExclude);
                    const v = chip.dataset[attr];
                    if (set.has(v)) { set.delete(v); } else { set.add(v); }
                    try { localStorage.setItem(storageKey, JSON.stringify(Array.from(set))); } catch (e) { /* ignore */ }
                    syncChips(chips, attr, activeFn);
                    applyFilter();
                });
            });
        }

        wireChips(statusChips, 'statusChip', statusKey, statusAll, ['resolved'], activeStatuses);
        wireChips(typeChips, 'typeChip', typeKey, typeAll, [], activeTypes);

        function setView(view) {
            const isList = view === 'list';
            section.classList.toggle('home-list-view', isList);
            buttons.forEach(function (btn) {
                const active = btn.dataset.view === view;
                btn.classList.toggle('is-active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            try { localStorage.setItem(viewKey, view); } catch (e) { /* ignore */ }
        }

        buttons.forEach(function (btn) {
            if (btn.__homeWired) return;
            btn.__homeWired = true;
            btn.addEventListener('click', function () { setView(btn.dataset.view); });
        });

        // Expanding search: the icon reveals the field and focuses it; the field
        // collapses again once it loses focus while empty. The query is persisted
        // per section so it survives a reload.
        if (search && filter) {
            const btn = search.querySelector('.home-search-btn');
            function expand() {
                search.classList.add('is-open');
                btn.setAttribute('aria-expanded', 'true');
                filter.focus();
            }
            function collapseIfEmpty() {
                if (!filter.value.trim()) {
                    search.classList.remove('is-open');
                    btn.setAttribute('aria-expanded', 'false');
                }
            }
            if (!filter.__homeWired) {
                filter.__homeWired = true;
                btn.addEventListener('click', function () {
                    if (search.classList.contains('is-open')) { filter.focus(); } else { expand(); }
                });
                filter.addEventListener('input', function () {
                    try { localStorage.setItem(searchKey, filter.value); } catch (e) { /* ignore */ }
                    applyFilter();
                });
                filter.addEventListener('blur', collapseIfEmpty);
                filter.addEventListener('keydown', function (e) {
                    if (e.key === 'Escape') {
                        filter.value = '';
                        try { localStorage.removeItem(searchKey); } catch (e2) { /* ignore */ }
                        applyFilter();
                        search.classList.remove('is-open');
                        btn.setAttribute('aria-expanded', 'false');
                        btn.focus();
                    }
                });
            }
            // Restore the saved query and open the field if it's non-empty.
            let savedQuery = '';
            try { savedQuery = localStorage.getItem(searchKey) || ''; } catch (e) { /* ignore */ }
            if (savedQuery) {
                filter.value = savedQuery;
                search.classList.add('is-open');
                btn.setAttribute('aria-expanded', 'true');
            }
        }

        // Re-apply the saved state on every run (first load and hot-reload).
        syncChips(statusChips, 'statusChip', activeStatuses);
        syncChips(typeChips, 'typeChip', activeTypes);
        applyFilter();
        let savedView = 'grid';
        try { savedView = localStorage.getItem(viewKey) || 'grid'; } catch (e) { /* ignore */ }
        setView(savedView);
    }

    function init() {
        document.querySelectorAll('[data-home-display]').forEach(initToolbar);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
