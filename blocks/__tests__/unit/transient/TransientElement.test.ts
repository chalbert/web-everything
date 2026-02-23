import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import TransientElement from '../../../transient/TransientElement';

// Concrete test subclass
class TestTransient extends TransientElement {
  resolveTag(): string {
    return 'div';
  }
}

class TestTransientWithExclusions extends TransientElement {
  resolveTag(): string {
    return 'span';
  }

  get excludedAttributes(): string[] {
    return ['data-internal', 'my-config'];
  }
}

// Register test elements once
if (!customElements.get('test-transient')) {
  customElements.define('test-transient', TestTransient);
}
if (!customElements.get('test-transient-excl')) {
  customElements.define('test-transient-excl', TestTransientWithExclusions);
}

/**
 * Flush microtask queue so queueMicrotask callbacks run.
 */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('TransientElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should be an instance of HTMLElement', () => {
    const el = document.createElement('test-transient');
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el).toBeInstanceOf(TestTransient);
  });

  describe('self-replacement', () => {
    it('should replace itself with the resolved element after microtask', async () => {
      const el = document.createElement('test-transient');
      document.body.appendChild(el);

      await flushMicrotasks();

      // Original element should be gone
      expect(document.querySelector('test-transient')).toBeNull();
      // Replacement should exist
      const replacement = document.body.querySelector('div');
      expect(replacement).not.toBeNull();
    });

    it('should only replace once even if connectedCallback fires twice', async () => {
      const el = document.createElement('test-transient') as TestTransient;
      document.body.appendChild(el);

      // Manually call connectedCallback again
      el.connectedCallback();

      await flushMicrotasks();

      // Should only have one div, not two
      const divs = document.body.querySelectorAll('div');
      expect(divs.length).toBe(1);
    });

    it('should handle element with no attributes and no children', async () => {
      const el = document.createElement('test-transient');
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('div');
      expect(replacement).not.toBeNull();
      expect(replacement!.attributes.length).toBe(0);
      expect(replacement!.childNodes.length).toBe(0);
    });
  });

  describe('attribute transfer', () => {
    it('should transfer class attribute to replacement', async () => {
      const el = document.createElement('test-transient');
      el.setAttribute('class', 'foo bar');
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('div');
      expect(replacement!.getAttribute('class')).toBe('foo bar');
    });

    it('should transfer id attribute to replacement', async () => {
      const el = document.createElement('test-transient');
      el.setAttribute('id', 'my-id');
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('div');
      expect(replacement!.getAttribute('id')).toBe('my-id');
    });

    it('should transfer aria-* attributes to replacement', async () => {
      const el = document.createElement('test-transient');
      el.setAttribute('aria-label', 'My heading');
      el.setAttribute('aria-describedby', 'desc');
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('div');
      expect(replacement!.getAttribute('aria-label')).toBe('My heading');
      expect(replacement!.getAttribute('aria-describedby')).toBe('desc');
    });

    it('should transfer custom data attributes to replacement', async () => {
      const el = document.createElement('test-transient');
      el.setAttribute('data-testid', 'heading-1');
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('div');
      expect(replacement!.getAttribute('data-testid')).toBe('heading-1');
    });

    it('should NOT transfer data-transient-* attributes', async () => {
      const el = document.createElement('test-transient');
      el.setAttribute('data-transient-id', '123');
      el.setAttribute('data-transient-source', 'auto');
      el.setAttribute('class', 'keep');
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('div');
      expect(replacement!.hasAttribute('data-transient-id')).toBe(false);
      expect(replacement!.hasAttribute('data-transient-source')).toBe(false);
      expect(replacement!.getAttribute('class')).toBe('keep');
    });

    it('should NOT transfer is attribute', async () => {
      const el = document.createElement('test-transient');
      el.setAttribute('is', 'custom-thing');
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('div');
      expect(replacement!.hasAttribute('is')).toBe(false);
    });
  });

  describe('excludedAttributes', () => {
    it('should respect excludedAttributes getter', async () => {
      const el = document.createElement('test-transient-excl');
      el.setAttribute('data-internal', 'secret');
      el.setAttribute('my-config', 'value');
      el.setAttribute('class', 'visible');
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('span');
      expect(replacement!.hasAttribute('data-internal')).toBe(false);
      expect(replacement!.hasAttribute('my-config')).toBe(false);
      expect(replacement!.getAttribute('class')).toBe('visible');
    });
  });

  describe('child transfer', () => {
    it('should move child nodes to replacement element', async () => {
      const el = document.createElement('test-transient');
      el.textContent = 'Hello World';
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('div');
      expect(replacement!.textContent).toBe('Hello World');
    });

    it('should preserve child element references (move, not clone)', async () => {
      const el = document.createElement('test-transient');
      const child = document.createElement('strong');
      child.textContent = 'Bold text';
      el.appendChild(child);
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('div');
      const movedChild = replacement!.querySelector('strong');
      expect(movedChild).toBe(child); // Same reference, not a clone
    });

    it('should preserve order of children', async () => {
      const el = document.createElement('test-transient');
      el.innerHTML = '<span>First</span><em>Second</em><strong>Third</strong>';
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('div');
      const children = replacement!.children;
      expect(children[0].tagName).toBe('SPAN');
      expect(children[1].tagName).toBe('EM');
      expect(children[2].tagName).toBe('STRONG');
    });

    it('should transfer both attributes and children together', async () => {
      const el = document.createElement('test-transient');
      el.setAttribute('class', 'heading');
      el.setAttribute('id', 'title');
      el.innerHTML = '<span>Content</span>';
      document.body.appendChild(el);

      await flushMicrotasks();

      const replacement = document.body.querySelector('div');
      expect(replacement!.getAttribute('class')).toBe('heading');
      expect(replacement!.getAttribute('id')).toBe('title');
      expect(replacement!.querySelector('span')!.textContent).toBe('Content');
    });
  });
});
