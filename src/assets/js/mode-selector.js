document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.mode-selector-container').forEach(function(selector) {
        const id = selector.dataset.modeSelector;
        const tabs = selector.querySelectorAll('.mode-tab');
        const contents = selector.querySelectorAll('[data-mode-content="' + id + '"]');

        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                const mode = this.dataset.mode;

                // Update active tab styles
                tabs.forEach(function(t) {
                    t.style.background = 'white';
                    t.style.color = '#6b7280';
                    t.classList.remove('active');
                });
                this.style.background = '#059669';
                this.style.color = 'white';
                this.classList.add('active');

                // Show corresponding content
                contents.forEach(function(content) {
                    content.style.display = content.dataset.mode === mode ? 'block' : 'none';
                });
            });
        });
    });
});
