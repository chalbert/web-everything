document.addEventListener('DOMContentLoaded', function() {
    const colors = {
        html: '#1e40af',
        jsx: '#7c3aed',
        template: '#059669'
    };

    document.querySelectorAll('.format-selector-container').forEach(function(selector) {
        const id = selector.dataset.formatSelector;
        const tabs = selector.querySelectorAll('.format-tab');
        const contents = selector.querySelectorAll('[data-format-content="' + id + '"]');

        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                const format = this.dataset.format;

                // Update active tab styles
                tabs.forEach(function(t) {
                    t.style.background = 'white';
                    t.style.color = '#6b7280';
                    t.classList.remove('active');
                });
                this.style.background = colors[format];
                this.style.color = 'white';
                this.classList.add('active');

                // Show corresponding content
                contents.forEach(function(content) {
                    content.style.display = content.dataset.format === format ? 'block' : 'none';
                });
            });
        });
    });
});
