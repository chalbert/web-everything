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
        const sizeKey = 'we-size-filter:' + titleText;
        const tierKey = 'we-tier-filter:' + titleText;
        const workItemKey = 'we-workitem-filter:' + titleText;
        const searchKey = 'we-search-filter:' + titleText;

        const buttons = Array.from(toolbar.querySelectorAll('.view-toggle-btn'));
        const search = toolbar.querySelector('.home-search');
        const filter = toolbar.querySelector('.home-filter');
        const countTarget = section.querySelector('[data-count-target]');
        const statusChips = Array.from(section.querySelectorAll('[data-status-chip]'));
        const typeChips = Array.from(section.querySelectorAll('[data-type-chip]'));
        const sizeChips = Array.from(section.querySelectorAll('[data-size-chip]'));
        const tierChips = Array.from(section.querySelectorAll('[data-tier-chip]'));
        const workItemChips = Array.from(section.querySelectorAll('[data-workitem-chip]'));
        const statusAll = statusChips.map(function (c) { return c.dataset.statusChip; });
        const typeAll = typeChips.map(function (c) { return c.dataset.typeChip; });
        const sizeAll = sizeChips.map(function (c) { return c.dataset.sizeChip; });
        const tierAll = tierChips.map(function (c) { return c.dataset.tierChip; });
        const workItemAll = workItemChips.map(function (c) { return c.dataset.workitemChip; });

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
        function activeSizes() { return sizeChips.length ? readSet(sizeKey, sizeAll, []) : null; }
        function activeTiers() { return tierChips.length ? readSet(tierKey, tierAll, []) : null; }
        function activeWorkItems() { return workItemChips.length ? readSet(workItemKey, workItemAll, []) : null; }

        function applyFilter() {
            const q = filter ? filter.value.trim().toLowerCase() : '';
            const st = activeStatuses();
            const ty = activeTypes();
            const sz = activeSizes();
            const tr = activeTiers();
            const wi = activeWorkItems();
            let shown = 0;
            cards().forEach(function (card) {
                const title = card.querySelector('.project-title');
                const desc = card.querySelector('p');
                const text = ((title ? title.textContent : '') + ' ' + (desc ? desc.textContent : '')).toLowerCase();
                const failSearch = !!q && text.indexOf(q) === -1;
                const failStatus = st && card.dataset.status && !st.has(card.dataset.status);
                const failType = ty && card.dataset.type && !ty.has(card.dataset.type);
                const failSize = sz && card.dataset.size && !sz.has(card.dataset.size);
                // Only open items carry a tier; a card with no data-tier always passes the tier
                // facet, so filtering to Tier A narrows the open pool without hiding active/resolved.
                const failTier = tr && card.dataset.tier && !tr.has(card.dataset.tier);
                const failWorkItem = wi && card.dataset.workitem && !wi.has(card.dataset.workitem);
                const hidden = failSearch || failStatus || failType || failSize || failTier || failWorkItem;
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
                chip.addEventListener('click', function (e) {
                    const set = readSet(storageKey, allValues, defaultExclude);
                    const v = chip.dataset[attr];
                    if (e.metaKey || e.ctrlKey) {
                        // ⌘/Ctrl-click toggles every OTHER chip in this category, leaving the clicked
                        // one untouched — so ⌘-clicking a lone-active chip "solos" it (turns the rest
                        // off), and ⌘-clicking again flips them all back on.
                        allValues.forEach(function (val) {
                            if (val === v) return;
                            if (set.has(val)) { set.delete(val); } else { set.add(val); }
                        });
                    } else {
                        if (set.has(v)) { set.delete(v); } else { set.add(v); }
                    }
                    try { localStorage.setItem(storageKey, JSON.stringify(Array.from(set))); } catch (e2) { /* ignore */ }
                    syncChips(chips, attr, activeFn);
                    applyFilter();
                });
            });
        }

        wireChips(statusChips, 'statusChip', statusKey, statusAll, ['resolved'], activeStatuses);
        wireChips(typeChips, 'typeChip', typeKey, typeAll, [], activeTypes);
        wireChips(sizeChips, 'sizeChip', sizeKey, sizeAll, [], activeSizes);
        wireChips(tierChips, 'tierChip', tierKey, tierAll, [], activeTiers);
        wireChips(workItemChips, 'workitemChip', workItemKey, workItemAll, [], activeWorkItems);

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
        syncChips(sizeChips, 'sizeChip', activeSizes);
        syncChips(tierChips, 'tierChip', activeTiers);
        syncChips(workItemChips, 'workitemChip', activeWorkItems);
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
