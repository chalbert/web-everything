import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import AutoHeading from '../../../transient/AutoHeading';

// Register once
if (!customElements.get('auto-heading-test')) {
  customElements.define('auto-heading-test', class extends AutoHeading {}, );
}
if (!customElements.get('auto-heading')) {
  customElements.define('auto-heading', AutoHeading);
}

/**
 * Flush microtask queue so queueMicrotask callbacks run.
 */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('AutoHeading', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('explicit level attribute', () => {
    it('should resolve to h1 when level="1"', async () => {
      const el = document.createElement('auto-heading');
      el.setAttribute('level', '1');
      el.textContent = 'Title';
      document.body.appendChild(el);

      await flushMicrotasks();

      const h = document.body.querySelector('h1');
      expect(h).not.toBeNull();
      expect(h!.textContent).toBe('Title');
    });

    it('should resolve to h3 when level="3"', async () => {
      const el = document.createElement('auto-heading');
      el.setAttribute('level', '3');
      el.textContent = 'Sub-section';
      document.body.appendChild(el);

      await flushMicrotasks();

      expect(document.body.querySelector('h3')).not.toBeNull();
    });

    it('should clamp to h6 when level="10"', async () => {
      const el = document.createElement('auto-heading');
      el.setAttribute('level', '10');
      document.body.appendChild(el);

      await flushMicrotasks();

      expect(document.body.querySelector('h6')).not.toBeNull();
    });

    it('should clamp to h1 when level="0"', async () => {
      // level 0 is invalid (< 1), falls through to next resolution
      // With no sectioning ancestors, DOM fallback returns h1
      const el = document.createElement('auto-heading');
      el.setAttribute('level', '0');
      document.body.appendChild(el);

      await flushMicrotasks();

      expect(document.body.querySelector('h1')).not.toBeNull();
    });

    it('should ignore non-numeric level attribute and fall through', async () => {
      // "abc" is NaN, falls through to DOM traversal → h1 (no sectioning ancestors)
      const el = document.createElement('auto-heading');
      el.setAttribute('level', 'abc');
      document.body.appendChild(el);

      await flushMicrotasks();

      expect(document.body.querySelector('h1')).not.toBeNull();
    });

    it('should exclude level attribute from replacement', async () => {
      const el = document.createElement('auto-heading');
      el.setAttribute('level', '2');
      el.setAttribute('class', 'title');
      document.body.appendChild(el);

      await flushMicrotasks();

      const h = document.body.querySelector('h2');
      expect(h).not.toBeNull();
      expect(h!.hasAttribute('level')).toBe(false);
      expect(h!.getAttribute('class')).toBe('title');
    });
  });

  describe('DOM traversal fallback', () => {
    it('should resolve to h1 with no sectioning ancestors', async () => {
      const el = document.createElement('auto-heading');
      el.textContent = 'Top Level';
      document.body.appendChild(el);

      await flushMicrotasks();

      expect(document.body.querySelector('h1')).not.toBeNull();
    });

    it('should resolve to h2 with one section ancestor', async () => {
      const section = document.createElement('section');
      const el = document.createElement('auto-heading');
      el.textContent = 'Section Title';
      section.appendChild(el);
      document.body.appendChild(section);

      await flushMicrotasks();

      expect(document.body.querySelector('h2')).not.toBeNull();
      expect(document.body.querySelector('h2')!.textContent).toBe('Section Title');
    });

    it('should resolve to h3 with section > article ancestors', async () => {
      document.body.innerHTML = '<section><article></article></section>';
      const article = document.body.querySelector('article')!;
      const el = document.createElement('auto-heading');
      el.textContent = 'Nested';
      article.appendChild(el);

      await flushMicrotasks();

      expect(document.body.querySelector('h3')).not.toBeNull();
    });

    it('should count nav and aside as sectioning elements', async () => {
      document.body.innerHTML = '<nav><aside></aside></nav>';
      const aside = document.body.querySelector('aside')!;
      const el = document.createElement('auto-heading');
      aside.appendChild(el);

      await flushMicrotasks();

      // nav + aside = 2 ancestors → h3
      expect(document.body.querySelector('h3')).not.toBeNull();
    });

    it('should NOT count div as sectioning', async () => {
      document.body.innerHTML = '<div><div></div></div>';
      const inner = document.body.querySelector('div > div')!;
      const el = document.createElement('auto-heading');
      inner.appendChild(el);

      await flushMicrotasks();

      // 0 sectioning ancestors → h1
      expect(document.body.querySelector('h1')).not.toBeNull();
    });
  });

  describe('excludedAttributes', () => {
    it('should return level in excludedAttributes', () => {
      const el = document.createElement('auto-heading') as AutoHeading;
      expect(el.excludedAttributes).toEqual(['level']);
    });
  });
});
