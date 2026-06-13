/**
 * #454 — regression for the route-view empty-clone on a complex inline form fragment.
 *
 * Root cause (found via live forensics): the patched `Node.cloneNode` (webcomponents) dispatched a
 * native `<select>`/`<datalist>` to the CustomElement clone handler, because that handler matched on
 * `'options' in node` — and those native controls inherit a *read-only* `options` accessor. The
 * handler then assigned onto that getter-only property and threw `TypeError: Cannot set property
 * options …`, which escaped `cloneNode` (route-view clones the template OUTSIDE its try/catch), so a
 * template body containing a `<select>` stamped nothing and the view went blank with no caught error.
 * Fix: match (and `copyOptions`) only on an OWN `options` data property, so native form controls fall
 * through to the generic prototype-fix handler.
 *
 * Runs in the real browser (bootstrap loaded) so the live HTML parser + the cloneNode patch are both
 * in play — the conditions the unit layer can't reproduce.
 */
import { test, expect, type Page } from '@playwright/test';

// A multi-fieldset inline form body with the trigger element: a native <select> with <option>s.
const WIZARD = `<div id="quote-wizard" class="stepper">
  <ol class="step-rail"><li data-step-indicator>1</li><li data-step-indicator>2</li></ol>
  <fieldset data-step class="step"><legend>Primary driver</legend>
    <label>First name<input name="firstName" required></label>
    <label>Years licensed<input name="licenseYears" type="number" min="0" max="60" required></label>
  </fieldset>
  <fieldset data-step class="step" hidden><legend>Vehicle</legend>
    <label>Vehicle<select name="vehicle" required><option value="0">A</option><option value="1">B</option></select></label>
  </fieldset>
  <div class="step-controls"><button type="button" data-step-prev>Back</button><button type="button" data-step-next>Next</button></div>
</div>
<div id="quote-live" class="sr-only" aria-live="polite"></div>`;

test.beforeEach(async ({ page }) => {
  // Any bootstrap-loaded page works; this one registers the router + behaviors and the cloneNode patch.
  await page.goto('/demos/declarative-spa-router.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!customElements.get('route-view'));
});

test('the patched cloneNode preserves a <select>-bearing template body (does not throw)', async ({ page }) => {
  const probe = await page.evaluate((markup) => {
    const t = document.createElement('template');
    t.innerHTML = markup;
    const afterParse = t.content.childNodes.length;
    const clone = t.content.cloneNode(true) as DocumentFragment;
    return {
      afterParse,
      afterClone: clone.childNodes.length,
      selects: clone.querySelectorAll('select').length,
      options: clone.querySelectorAll('select option').length,
    };
  }, WIZARD);
  // Before the fix this cloneNode threw on the <select>; the clone is now byte-for-byte.
  expect(probe.afterParse).toBeGreaterThan(0);
  expect(probe.afterClone).toBe(probe.afterParse);
  expect(probe.selects).toBe(1);
  expect(probe.options).toBe(2);
});

/** Build a live route-view with the wizard inlined into a matched template, then navigate to it. */
async function stampInlineWizard(page: Page): Promise<{ fieldsets: number; options: number; errors: string[] }> {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  const counts = await page.evaluate(async (markup) => {
    document.body.querySelectorAll('route-view').forEach((n) => n.remove());
    const rv = document.createElement('route-view');
    rv.innerHTML =
      `<template route="/__t454-home"><p id="t454-home">home</p></template>` +
      `<template route="/__t454-wizard">${markup}</template>`;
    document.body.appendChild(rv);
    (rv as unknown as { navigate(p: string): unknown }).navigate('/__t454-wizard');
    await new Promise((r) => setTimeout(r, 80));
    return {
      fieldsets: rv.querySelectorAll('#quote-wizard fieldset[data-step]').length,
      options: rv.querySelectorAll('#quote-wizard select option').length,
    };
  }, WIZARD);
  return { ...counts, errors };
}

test('route-view stamps a multi-fieldset inline form body containing a <select>', async ({ page }) => {
  const { fieldsets, options, errors } = await stampInlineWizard(page);
  expect(fieldsets).toBe(2); // both fieldsets stamped — not a blank view
  expect(options).toBe(2); // the <select> survived the clone
  expect(errors.join('\n')).not.toMatch(/Cannot set property options|empty fragment/);
});
