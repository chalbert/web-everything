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
 * ORIGINAL FINDING (2026-06-09, real Chromium): the SCOPED path was non-functional in a real browser
 * *before any lifecycle question arose*. `CustomElementRegistry.define()` does `new element()` to
 * snapshot instance-field callbacks, and constructing a custom-element class that is NOT itself
 * natively registered threw `TypeError: Failed to construct 'HTMLElement': Illegal constructor`.
 * The same barrier hit `Reflect.construct(RealClass, …)` in pathInsertionMethods' upgrade flow.
 *
 * ROOT FIX (#228, 2026-06-10): the scoped registry now registers the real autonomous class natively
 * under a unique *private* tag (`ensureNativelyConstructible`), which makes the class a registered
 * constructor — so `new element()` and `Reflect.construct(RealClass, …)` are legal — without
 * colliding with the user's tag (which still carries the no-op stand-in). The construction barrier
 * below has therefore INVERTED: scoped `define()` now succeeds and produces a legally-constructed
 * real-class instance. The native control test still proves the browser was always capable.
 *
 * What remains is *driving* the per-callback reactions on the scoped path — disconnectedCallback
 * (#261), attributeChangedCallback (#262), form-associated callbacks (#263) — each of which now has
 * a constructible instance to react. Those items flip the three per-callback probes below from
 * "construction succeeds" to "the callback actually fires".
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
      const { applyPatches: applyInjectorsPatches } = await import('/plugs/webinjectors/index.ts');
      const { default: CustomElementRegistry } = await import('/plugs/webregistries/CustomElementRegistry.ts');
      // bootstrap.ts order: injectors before components. The insertion patch and the path-insertion
      // walker (which replaceChildren/remove route through) call `this.getClosestInjector()`, added
      // by the injectors patch. applyInsertionPatch() is exported but NOT called by applyPatches(),
      // so apply it explicitly to give the scoped path its best shot at the connect/disconnect halves.
      applyInjectorsPatches();
      applyPatches();
      applyInsertionPatch();
      (window as any).__CustomElement = CustomElement;
      (window as any).__CustomElementRegistry = CustomElementRegistry;
    });
  });

  test('root fix: scoped define() of an autonomous element succeeds and produces a legally-constructed real-class instance', async ({ page }) => {
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
        // Prove a real instance can now be legally constructed (the wall #228 tore down).
        const instance = new ScopedEl();
        return {
          defined: true,
          error: null as string | null,
          isRealInstance: instance instanceof ScopedEl && instance instanceof HTMLElement,
        };
      } catch (e) {
        return { defined: false, error: String((e as Error).message || e), isRealInstance: false };
      }
    });

    // CONTRACT (inverted by #228): the scoped registry registers the real class natively under a
    // private tag, so constructing it is legal. define() succeeds and a real-class instance exists.
    expect(result.defined).toBe(true);
    expect(result.error).toBeNull();
    expect(result.isRealInstance).toBe(true);
  });

  // disconnectedCallback (#261): DRIVEN. Because #228 registers the real class natively under a
  // private ctor tag, an instance built with `new ScopedEl()` is a genuinely native-upgraded custom
  // element — so the browser drives its removal reactions itself. No bespoke removeChild/remove patch
  // is needed: removing the element (and the disconnect half of replaceChildren) fires
  // disconnectedCallback natively. This probe drives both removal paths and asserts the callback ran.
  test('disconnectedCallback — fires natively on remove() and on the replaceChildren disconnect half (#261)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const CustomElement = (window as any).__CustomElement;
      const CustomElementRegistry = (window as any).__CustomElementRegistry;
      const registry = new CustomElementRegistry();
      const fired: string[] = [];
      class Probe extends CustomElement {
        connectedCallback() { fired.push('connected'); }
        disconnectedCallback() { fired.push('disconnected'); }
      }
      registry.define('probe-disconnect-el', Probe);

      // Path 1: remove()
      const el = new Probe();
      document.body.appendChild(el);
      const connectedFirst = fired.filter((f) => f === 'connected').length;
      el.remove();
      const disconnectedAfterRemove = fired.filter((f) => f === 'disconnected').length;

      // Path 2: the disconnect half of replaceChildren()
      const host = document.createElement('div');
      const el2 = new Probe();
      host.appendChild(el2);
      document.body.appendChild(host);
      host.replaceChildren();
      const disconnectedAfterReplace = fired.filter((f) => f === 'disconnected').length;

      return { connectedFirst, disconnectedAfterRemove, disconnectedAfterReplace };
    });

    expect(result.connectedFirst).toBe(1);
    expect(result.disconnectedAfterRemove).toBe(1);
    expect(result.disconnectedAfterReplace).toBe(2);
  });

  // attributeChangedCallback (#262): DRIVEN. Same mechanism as #261 — the #228 private-tag native
  // registration carries the real class's `static observedAttributes`, so the browser observes those
  // attributes natively and fires attributeChangedCallback on setAttribute, honouring the observed
  // list (non-observed attributes are ignored). No setAttribute/MutationObserver patch is needed.
  test('attributeChangedCallback — fires natively for observed attributes, ignores the rest (#262)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const CustomElement = (window as any).__CustomElement;
      const CustomElementRegistry = (window as any).__CustomElementRegistry;
      const registry = new CustomElementRegistry();
      const calls: Array<[string, string | null, string | null]> = [];
      class Probe extends CustomElement {
        static observedAttributes = ['value'];
        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
          calls.push([name, oldValue, newValue]);
        }
      }
      registry.define('probe-attr-el', Probe);

      const el = new Probe();
      document.body.appendChild(el);
      el.setAttribute('value', 'x'); // observed → fires (null → 'x')
      el.setAttribute('value', 'y'); // observed → fires ('x' → 'y')
      el.setAttribute('ignored', 'z'); // not observed → no fire
      return { calls };
    });

    expect(result.calls).toEqual([
      ['value', null, 'x'],
      ['value', 'x', 'y'],
    ]);
  });

  // form-associated callbacks (#263): DRIVEN. Same mechanism as #261/#262 — the #228 private-tag
  // native registration carries the real class's `static formAssociated = true`, so the browser
  // associates a scoped instance with its owning form and drives the form callbacks natively:
  // formResetCallback on form.reset(), formDisabledCallback when an ancestor fieldset toggles
  // disabled. No additional form-association wiring was added. (formStateRestoreCallback is invoked
  // only by browser-initiated state restoration — bfcache/autofill — so it is not synchronously
  // triggerable in a test; the two callbacks below prove the element is genuinely form-associated.)
  test('form-associated callbacks — formReset + formDisabled fire natively on the scoped element (#263)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const CustomElement = (window as any).__CustomElement;
      const CustomElementRegistry = (window as any).__CustomElementRegistry;
      const registry = new CustomElementRegistry();
      const fired: string[] = [];
      class Probe extends CustomElement {
        static formAssociated = true;
        constructor(options?: any) {
          super(options);
          (this as any).attachInternals();
        }
        formResetCallback() { fired.push('reset'); }
        formDisabledCallback(disabled: boolean) { fired.push('disabled:' + disabled); }
      }
      registry.define('probe-form-el', Probe);

      const form = document.createElement('form');
      const fieldset = document.createElement('fieldset');
      const el = new Probe();
      fieldset.appendChild(el);
      form.appendChild(fieldset);
      document.body.appendChild(form);

      form.reset(); // → formResetCallback
      const afterReset = [...fired];
      fieldset.disabled = true; // → formDisabledCallback(true)
      fieldset.disabled = false; // → formDisabledCallback(false)

      return { afterReset, fired };
    });

    expect(result.afterReset).toEqual(['reset']);
    expect(result.fired).toEqual(['reset', 'disabled:true', 'disabled:false']);
  });
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
