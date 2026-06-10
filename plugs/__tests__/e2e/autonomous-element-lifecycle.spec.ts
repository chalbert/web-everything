/**
 * E2E verification for backlog #167 — autonomous custom-element lifecycle completeness.
 *
 * Question #167 asked: does the WE `plugs/` runtime DRIVE disconnectedCallback,
 * attributeChangedCallback, and the form-associated callbacks for an *autonomous* custom element?
 *
 * Two registration paths exist for autonomous elements in WE:
 *   1. NATIVE  — `customElements.define(name, RealClass)` (e.g. <auto-heading>, <validity-merge-field>).
 *                The browser drives every reaction natively; nothing for the plug to do. (control below)
 *   2. SCOPED  — `new CustomElementRegistry().define(name, RealClass)` (the plug). The registry
 *                installs a no-op stand-in (`class extends HTMLElement {}`) via native
 *                `customElements.define` and keeps the real definition itself, so lifecycle driving
 *                on this path would be the plug's responsibility. This is the path #167 is about.
 *
 * VERIFIED FINDING (2026-06-09, real Chromium): the SCOPED path is non-functional in a real browser
 * *before any lifecycle question arises*. `CustomElementRegistry.define()` does `new element()` to
 * snapshot instance-field callbacks, and constructing a custom-element class that is NOT itself
 * natively registered throws `TypeError: Failed to construct 'HTMLElement': Illegal constructor`.
 * The same barrier hits `Reflect.construct(RealClass, …)` in pathInsertionMethods' upgrade flow.
 * The existing jsdom unit tests pass only because jsdom permits constructing unregistered
 * custom-element classes — Chromium does not. So disconnect/attributeChanged/form callbacks can't be
 * verified as firing because no real instance can be produced at all.
 *
 * These tests pin that contract. They are written to PASS today and to START FAILING the moment the
 * scoped path can construct/drive — at which point whoever closes the follow-up item rewrites the
 * assertions to require the callbacks fire.
 *
 * We navigate to a served page first so `/plugs/*.ts` imports resolve against a real origin —
 * page.setContent alone yields an about:blank origin where those imports silently never load (which
 * is why the older webcomponents.spec.ts times out and is itself non-functional; see #NNN follow-up).
 */

import { test, expect } from '@playwright/test';

// A served page — any 200 route works; we only need a real same-origin base for module imports.
const ORIGIN_PAGE = '/';

test.describe('autonomous element lifecycle — scoped CustomElementRegistry (plugs path)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ORIGIN_PAGE);
    await page.evaluate(async () => {
      const { default: CustomElement } = await import('/plugs/webcomponents/CustomElement.ts');
      const { applyPatches, applyInsertionPatch } = await import('/plugs/webcomponents/index.ts');
      const { default: CustomElementRegistry } = await import('/plugs/webregistries/CustomElementRegistry.ts');
      // bootstrap.ts calls applyPatches() (clone handlers + cloneNode); applyInsertionPatch() is
      // exported but NOT called by applyPatches(), so apply it explicitly to give the scoped path its
      // best shot at the connect half.
      applyPatches();
      applyInsertionPatch();
      (window as any).__CustomElement = CustomElement;
      (window as any).__CustomElementRegistry = CustomElementRegistry;
    });
  });

  test('upstream blocker: scoped define() of an autonomous element throws "Illegal constructor"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const CustomElement = (window as any).__CustomElement;
      const CustomElementRegistry = (window as any).__CustomElementRegistry;
      const registry = new CustomElementRegistry();

      class ScopedEl extends CustomElement {
        static observedAttributes = ['value'];
        static formAssociated = true;
        connectedCallback() {}
        disconnectedCallback() {}
        attributeChangedCallback() {}
        formResetCallback() {}
        formDisabledCallback() {}
        formStateRestoreCallback() {}
      }

      try {
        registry.define('scoped-lifecycle-el', ScopedEl);
        return { defined: true, error: null as string | null };
      } catch (e) {
        return { defined: false, error: String((e as Error).message || e) };
      }
    });

    // CONTRACT: scoped define() cannot construct the real class in a real browser. Until the scoped
    // path natively registers the real class (or constructs instances some other legal way), this is
    // the wall every lifecycle callback sits behind. Flip these assertions when the path is fixed.
    expect(result.defined).toBe(false);
    expect(result.error).toContain('Illegal constructor');
  });

  // The three callbacks #167 named are unverifiable while define() itself throws (above). We still
  // attempt each so this file fails loudly — prompting a real assertion — the day construction works.
  for (const probe of [
    { name: 'disconnectedCallback', attr: false, form: false },
    { name: 'attributeChangedCallback', attr: true, form: false },
    { name: 'form-associated callbacks', attr: false, form: true },
  ]) {
    test(`${probe.name} — currently blocked by the scoped-define barrier`, async ({ page }) => {
      const result = await page.evaluate(() => {
        const CustomElement = (window as any).__CustomElement;
        const CustomElementRegistry = (window as any).__CustomElementRegistry;
        const registry = new CustomElementRegistry();
        class Probe extends CustomElement {
          static observedAttributes = ['value'];
          static formAssociated = true;
        }
        try {
          registry.define('probe-el', Probe);
          return { constructed: true };
        } catch {
          return { constructed: false };
        }
      });
      // No instance can exist yet, so the callback cannot be exercised. Asserting the blocker keeps
      // the named concern visible; the day `constructed` becomes true, rewrite this to drive the
      // mutation (remove / setAttribute / form.reset) and assert the callback fired.
      expect(result.constructed).toBe(false);
    });
  }
});

test.describe('control — natively-registered autonomous element drives the full lifecycle', () => {
  // Proves the BROWSER is fully capable; the gaps above are specific to the scoped plug path, not to
  // the environment. This is the path <auto-heading> and <validity-merge-field> already use.
  test('native customElements.define drives connect, disconnect, attributeChanged, and form reset', async ({ page }) => {
    await page.goto(ORIGIN_PAGE);
    const result = await page.evaluate(() => {
      const fired: string[] = [];
      class NativeEl extends HTMLElement {
        static observedAttributes = ['value'];
        static formAssociated = true;
        constructor() { super(); (this as any).attachInternals(); }
        connectedCallback() { fired.push('connected'); }
        disconnectedCallback() { fired.push('disconnected'); }
        attributeChangedCallback() { fired.push('attr'); }
        formResetCallback() { fired.push('reset'); }
      }
      const tag = 'native-lifecycle-el';
      if (!customElements.get(tag)) customElements.define(tag, NativeEl);

      const form = document.createElement('form');
      document.body.appendChild(form);
      const el = document.createElement(tag);
      form.append(el);                 // connected
      el.setAttribute('value', 'x');   // attr
      form.reset();                    // reset
      el.remove();                     // disconnected
      form.remove();
      return { fired };
    });

    expect(result.fired).toContain('connected');
    expect(result.fired).toContain('attr');
    expect(result.fired).toContain('disconnected');
    expect(result.fired).toContain('reset');
  });
});
