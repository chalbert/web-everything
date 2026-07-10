document.addEventListener('DOMContentLoaded', () => {
    const codeBlocks = document.querySelectorAll('pre');

    codeBlocks.forEach((pre) => {
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'code-wrapper';

        // Insert wrapper before pre
        pre.parentNode.insertBefore(wrapper, pre);

        // Move pre into wrapper
        wrapper.appendChild(pre);

        // `pre` scrolls horizontally (CSS `overflow-x: auto`, style.css) once its content is wider
        // than the viewport — a long unbroken line (a shell command, a URL) that `overflow-wrap` can't
        // break. A scrollable region must itself be reachable by keyboard (WCAG 2.1.1 / axe
        // scrollable-region-focusable, #2376): tabindex=0 lets arrow/Tab keys scroll it like any other
        // focusable widget, without changing the visual/copy-button behavior above.
        if (!pre.hasAttribute('tabindex')) pre.setAttribute('tabindex', '0');

        // Create copy button
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.textContent = 'Copy';
        button.setAttribute('aria-label', 'Copy code to clipboard');

        // Add button to wrapper
        wrapper.appendChild(button);

        // Add click event
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const code = pre.querySelector('code');
            const text = code ? code.innerText : pre.innerText;

            let success = false;

            // Try modern Clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                try {
                    await navigator.clipboard.writeText(text);
                    success = true;
                } catch (err) {
                    console.warn('Clipboard API failed, using fallback:', err);
                }
            }

            // Fallback: old-school selection + execCommand
            if (!success) {
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);

                    textArea.focus();
                    textArea.select();
                    const result = document.execCommand('copy');
                    document.body.removeChild(textArea);

                    success = result;
                } catch (err) {
                    console.error('Fallback copy failed:', err);
                }
            }

            // Visual feedback
            if (success) {
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.classList.add('copied');

                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove('copied');
                }, 2000);
            } else {
                button.textContent = 'Error';
                setTimeout(() => {
                    button.textContent = 'Copy';
                }, 2000);
            }
        });
    });
});

