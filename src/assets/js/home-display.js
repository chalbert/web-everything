// Per-section display tool for the home page. Each toolbar scopes to its own
// section: a density toggle (default card grid vs. compact list of smaller
// tiles) plus a magnifying-glass search that expands inline on click. The
// default (grid) view is unchanged; the chosen view is remembered per section.
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-home-display]').forEach(function (toolbar) {
        const section = toolbar.closest('section');
        if (!section) return;

        const key = 'we-home-view:' + (section.querySelector('.section-title') || {}).textContent;
        const buttons = toolbar.querySelectorAll('.view-toggle-btn');
        const search = toolbar.querySelector('.home-search');
        const filter = toolbar.querySelector('.home-filter');
        const cards = Array.from(section.querySelectorAll('.project-card'));

        // Pre-compute searchable text (title + description) for each card.
        cards.forEach(function (card) {
            const title = card.querySelector('.project-title');
            const desc = card.querySelector('p');
            card._searchText = ((title ? title.textContent : '') + ' ' + (desc ? desc.textContent : '')).toLowerCase();
        });

        function applyFilter() {
            const q = filter ? filter.value.trim().toLowerCase() : '';
            cards.forEach(function (card) {
                card.classList.toggle('is-filtered-out', !!q && card._searchText.indexOf(q) === -1);
            });
        }

        function setView(view) {
            const isList = view === 'list';
            section.classList.toggle('home-list-view', isList);
            buttons.forEach(function (btn) {
                const active = btn.dataset.view === view;
                btn.classList.toggle('is-active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            try { localStorage.setItem(key, view); } catch (e) { /* ignore */ }
        }

        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () { setView(btn.dataset.view); });
        });

        // Expanding search: the icon reveals the field and focuses it; the field
        // collapses again once it loses focus while empty.
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

            btn.addEventListener('click', function () {
                if (search.classList.contains('is-open')) {
                    filter.focus();
                } else {
                    expand();
                }
            });
            filter.addEventListener('input', applyFilter);
            filter.addEventListener('blur', collapseIfEmpty);
            filter.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') {
                    filter.value = '';
                    applyFilter();
                    search.classList.remove('is-open');
                    btn.setAttribute('aria-expanded', 'false');
                    btn.focus();
                }
            });
        }

        let saved = 'grid';
        try { saved = localStorage.getItem(key) || 'grid'; } catch (e) { /* ignore */ }
        setView(saved);
    });
});
