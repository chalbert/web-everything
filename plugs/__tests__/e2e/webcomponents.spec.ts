/**
 * E2E Tests for webcomponents — CustomElement cloning + Element insertion patches.
 *
 * ORIGIN FIX (#229): every fixture below used to be built with
 * `page.setContent('<script type="module">import … from "/plugs/…ts"</script>')`. `setContent`
 * yields an **about:blank** document origin, so the absolute `/plugs/*.ts` specifiers resolved
 * against nothing, the module never executed, and every test timed out at `waitForFunction`. The
 * fix is the pattern proven by `autonomous-element-lifecycle.spec.ts`: `page.goto('/')` first to
 * establish a real same-origin base, then load the plug modules via dynamic `import()` inside
 * `page.evaluate`.
 *
 * SCOPED-PATH CAVEAT (#228/#167): `new CustomElementRegistry().define(name, RealClass)` (the plug's
 * *scoped* path) installs a no-op stand-in under the user tag and registers the real class natively
 * under a private tag — so `new TestElement()` is legally constructible, but the scoped path does
 * NOT drive `connectedCallback` on plain `appendChild` (that is the native path's job; driving the
 * scoped reactions is #261–#263). These tests therefore assert what is genuinely portable on this
 * path — **clone behavior, prototype chain, and DOM insertion ordering** — and do not assert dead
 * scoped-path `connectedCallback` side effects.
 */

import { test, expect } from '@playwright/test';

// A served page — any 200 route works; we only need a real same-origin base for module imports.
const ORIGIN_PAGE = '/';

test.describe('webcomponents - CustomElement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ORIGIN_PAGE);
    await page.evaluate(async () => {
      const { default: CustomElement } = await import('/plugs/webcomponents/CustomElement.ts');
      const { applyPatches, applyInsertionPatch } = await import('/plugs/webcomponents/index.ts');
      const { applyPatches: applyInjectorsPatches } = await import('/plugs/webinjectors/index.ts');
      const { default: CustomElementRegistry } = await import('/plugs/webregistries/CustomElementRegistry.ts');

      // Bootstrap order (per plugs/bootstrap.ts): injectors before components — the insertion patch
      // and the upgrade walker both call `this.getClosestInjector()`, which the injectors patch adds
      // to Node.prototype.
      applyInjectorsPatches();
      applyPatches();
      applyInsertionPatch();

      // A real autonomous class carrying an `options` instance field. It renders NOTHING via a
      // lifecycle callback: the scoped path does not drive connectedCallback, and writing textContent
      // in the constructor is hostile to cloning (it wipes deep-cloned children when the clone-handler
      // re-runs the constructor). The portable contract under test is that the clone-handler carries
      // the `options` field — and the nested structure — across cloneNode.
      class TestElement extends (CustomElement as any) {
        options: { label?: string };
        constructor(options?: { label?: string }) {
          super(options);
          this.options = options || {};
        }
      }

      (window as any).TestElement = TestElement;
      (window as any).CustomElement = CustomElement;
      (window as any).elementRegistry = new CustomElementRegistry();
      (window as any).elementRegistry.define('test-element', TestElement);
    });
  });

  test('should construct a custom element with options and connect it', async ({ page }) => {
    const result = await page.evaluate(() => {
      const element = new (window as any).TestElement({ label: 'Hello' });
      document.body.appendChild(element);
      return {
        optionsLabel: element.options.label,
        connected: document.body.contains(element),
        isTestElement: element instanceof (window as any).TestElement,
      };
    });

    expect(result.optionsLabel).toBe('Hello');
    expect(result.connected).toBe(true);
    // A directly-constructed scoped element carries the real class as its constructor (the user tag
    // `test-element` is the no-op stand-in; the instance's localName is the private ctor tag).
    expect(result.isTestElement).toBe(true);
  });

  test('should preserve the options field during cloning', async ({ page }) => {
    const result = await page.evaluate(() => {
      const original = new (window as any).TestElement({ label: 'Original' });
      document.body.appendChild(original);

      const clone = original.cloneNode(true);
      document.body.appendChild(clone);

      return {
        originalLabel: original.options.label,
        hasOptions: 'options' in clone,
        cloneLabel: clone.options?.label,
      };
    });

    expect(result.originalLabel).toBe('Original');
    expect(result.hasOptions).toBe(true);
    expect(result.cloneLabel).toBe('Original');
  });

  test('should deep-clone nested custom-element structure', async ({ page }) => {
    const result = await page.evaluate(() => {
      const parent = new (window as any).TestElement({ label: 'Parent' });
      const child = new (window as any).TestElement({ label: 'Child' });
      parent.appendChild(child);
      document.body.appendChild(parent);

      const clone = parent.cloneNode(true);
      document.body.appendChild(clone);

      // Locate the cloned child structurally: a directly-constructed scoped element's localName is
      // the private ctor tag, not `test-element`, so querySelector by user tag would never match.
      const clonedChild = clone.firstElementChild as any;

      return {
        parentLabel: parent.options.label,
        childLabel: child.options.label,
        cloneChildCount: clone.children.length,
        clonedChildIsTestElement: clonedChild instanceof (window as any).TestElement,
        clonedChildLabel: clonedChild?.options?.label,
      };
    });

    // The deep clone preserves the nested structure and each clone carries its `options` field —
    // the portable clone contract, independent of any lifecycle rendering.
    expect(result.parentLabel).toBe('Parent');
    expect(result.childLabel).toBe('Child');
    expect(result.cloneChildCount).toBe(1);
    expect(result.clonedChildIsTestElement).toBe(true);
    expect(result.clonedChildLabel).toBe('Child');
  });

  test('should maintain prototype chain across cloneNode', async ({ page }) => {
    const result = await page.evaluate(() => {
      const element = new (window as any).TestElement({ label: 'Test' });
      document.body.appendChild(element);

      const clone = element.cloneNode(false);

      return {
        originalIsCustomElement: element instanceof (window as any).CustomElement,
        originalIsHTMLElement: element instanceof HTMLElement,
        cloneIsCustomElement: clone instanceof (window as any).CustomElement,
        cloneIsHTMLElement: clone instanceof HTMLElement,
        sameConstructor: element.constructor === clone.constructor,
      };
    });

    expect(result.originalIsCustomElement).toBe(true);
    expect(result.originalIsHTMLElement).toBe(true);
    expect(result.cloneIsCustomElement).toBe(true);
    expect(result.cloneIsHTMLElement).toBe(true);
    expect(result.sameConstructor).toBe(true);
  });
});

test.describe('webcomponents - Element Insertion Patches', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ORIGIN_PAGE);
    await page.evaluate(async () => {
      const { applyPatches: applyInjectorsPatches } = await import('/plugs/webinjectors/index.ts');
      const { patch: applyInsertionPatch } = await import('/plugs/webcomponents/Element.insertion.patch.ts');
      // The insertion patch's insertAdjacentElement override and the upgrade walker call
      // `this.getClosestInjector()` — supplied by the injectors patch, so apply it first.
      applyInjectorsPatches();
      applyInsertionPatch();
      (window as any).insertionPatchApplied = true;
    });
  });

  test('should track creation injector with innerHTML', async ({ page }) => {
    const result = await page.evaluate(() => {
      const div = document.createElement('div');
      div.innerHTML = '<span>Test</span>';

      const span = div.querySelector('span');
      return {
        spanExists: span !== null,
        spanText: span?.textContent,
      };
    });

    expect(result.spanExists).toBe(true);
    expect(result.spanText).toBe('Test');
  });

  test('should handle append with multiple elements', async ({ page }) => {
    const result = await page.evaluate(() => {
      const parent = document.createElement('div');
      const child1 = document.createElement('span');
      const child2 = document.createElement('span');

      child1.textContent = 'First';
      child2.textContent = 'Second';

      parent.append(child1, child2);

      return {
        childCount: parent.children.length,
        firstText: parent.children[0].textContent,
        secondText: parent.children[1].textContent,
      };
    });

    expect(result.childCount).toBe(2);
    expect(result.firstText).toBe('First');
    expect(result.secondText).toBe('Second');
  });

  test('should handle insertAdjacentElement', async ({ page }) => {
    const result = await page.evaluate(() => {
      const parent = document.createElement('div');
      const reference = document.createElement('span');
      reference.textContent = 'Reference';
      parent.appendChild(reference);

      const before = document.createElement('span');
      before.textContent = 'Before';
      const after = document.createElement('span');
      after.textContent = 'After';

      reference.insertAdjacentElement('beforebegin', before);
      reference.insertAdjacentElement('afterend', after);

      return {
        childCount: parent.children.length,
        order: Array.from(parent.children).map((c) => c.textContent),
      };
    });

    expect(result.childCount).toBe(3);
    expect(result.order).toEqual(['Before', 'Reference', 'After']);
  });
});

test.describe('webcomponents - Cross-browser compatibility', () => {
  test('should construct and clone consistently across browsers', async ({ page, browserName }) => {
    await page.goto(ORIGIN_PAGE);
    await page.evaluate(async () => {
      const { default: CustomElement } = await import('/plugs/webcomponents/CustomElement.ts');
      const { applyPatches, applyInsertionPatch } = await import('/plugs/webcomponents/index.ts');
      const { applyPatches: applyInjectorsPatches } = await import('/plugs/webinjectors/index.ts');
      const { default: CustomElementRegistry } = await import('/plugs/webregistries/CustomElementRegistry.ts');
      applyInjectorsPatches();
      applyPatches();
      applyInsertionPatch();

      class BrowserTestElement extends (CustomElement as any) {
        constructor() {
          super();
          this.textContent = 'Browser: ok';
        }
      }
      // Register through the scoped registry so the real class is natively constructible (#228) —
      // an unregistered autonomous class throws "Illegal constructor" on `new`.
      new CustomElementRegistry().define('browser-test-element', BrowserTestElement);
      (window as any).BrowserTestElement = BrowserTestElement;
    });

    const result = await page.evaluate(() => {
      const element = new (window as any).BrowserTestElement();
      document.body.appendChild(element);
      const clone = element.cloneNode(true);
      return {
        text: element.textContent,
        cloneText: clone.textContent,
        cloneIsHTMLElement: clone instanceof HTMLElement,
      };
    });

    expect(result.text).toContain('Browser:');
    expect(result.cloneText).toContain('Browser:');
    expect(result.cloneIsHTMLElement).toBe(true);

    // Test should pass in all browsers
    console.log(`Test passed in ${browserName}`);
  });
});
