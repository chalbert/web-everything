/**
 * E2E (real-browser) test for the webvalidation plugs (#215 validity-merge / #224 validator-resolution),
 * slice #1010 of the #1002 coverage wave. This is the dedicated real-browser lane the WE mirror lacked —
 * happy-dom units cover the merge math; this proves the form-associated controls work under the **full
 * plugged `we:plugs/bootstrap.ts`**, driving native `ElementInternals.setValidity` / `:invalid`.
 *
 * Exercises both plugged custom elements (`<validity-merge-field>` + `<async-validator-field>`) and
 * asserts **plugged ↔ unplugged parity**: the plugged element resolves the same native-first default
 * strategy (`source-reduction`) as a standalone `createDefaultValidityMergeRegistry()` built with no
 * global patch, so the same sources collapse identically either way.
 */
import { test, expect } from '@playwright/test';

const PAGE = `<!DOCTYPE html>
<html>
  <head><title>webvalidation e2e</title></head>
  <body>
    <form id="f">
      <validity-merge-field id="merge">
        <input id="inner" type="text" />
      </validity-merge-field>
      <async-validator-field id="async"></async-validator-field>
    </form>
    <script type="module">
      import '/plugs/bootstrap.ts';
      import { createDefaultValidityMergeRegistry } from '/plugs/webvalidation/index.ts';
      // Expose the unplugged factory for the parity check.
      window.__createDefaultValidityMergeRegistry = createDefaultValidityMergeRegistry;
      await Promise.all([
        customElements.whenDefined('validity-merge-field'),
        customElements.whenDefined('async-validator-field'),
      ]);
      window.testReady = true;
    </script>
  </body>
</html>`;

test.describe('webvalidation — plugged real-browser (#1010)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.setContent(PAGE);
    await page.waitForFunction(() => (window as any).testReady === true, { timeout: 15000 });
  });

  test('the plugged <validity-merge-field> collapses sources into native setValidity / :invalid', async ({
    page,
  }) => {
    const result = await page.evaluate(() => {
      const field = document.getElementById('merge') as any;
      // One invalid source must drive the merged state invalid and the native :invalid pseudo.
      field.setSource('manual', { state: 'invalid', message: 'nope' });
      const invalid = { mergedValid: field.merged?.valid, matchesInvalid: field.matches(':invalid') };
      // Clearing the only invalid source drops the field to `idle` (no constraint asserted) — it must no
      // longer drive the native `:invalid` pseudo.
      field.clearSource('manual');
      const cleared = { state: field.merged?.state, matchesInvalid: field.matches(':invalid') };
      return { invalid, cleared };
    });
    expect(result.invalid.mergedValid).toBe(false);
    expect(result.invalid.matchesInvalid).toBe(true);
    expect(result.cleared.state).toBe('idle');
    expect(result.cleared.matchesInvalid).toBe(false);
  });

  test('the plugged <async-validator-field> feeds the merge field’s async source', async ({ page }) => {
    const asyncState = await page.evaluate(async () => {
      const field = document.getElementById('merge') as any;
      const driver = document.getElementById('async') as any;
      driver.useTargetField(field);
      driver.useValidator(async (input: unknown) => ({
        state: input === 'ok' ? 'valid' : 'invalid',
        message: input === 'ok' ? undefined : 'async rejected',
      }));
      const bad = await driver.validate('bad');
      const badMerged = field.merged?.valid;
      const good = await driver.validate('ok');
      return { badState: bad?.state, badMerged, goodState: good?.state };
    });
    expect(asyncState.badState).toBe('invalid');
    expect(asyncState.badMerged).toBe(false);
    expect(asyncState.goodState).toBe('valid');
  });

  test('plugged ↔ unplugged parity: same native-first default strategy resolves either way', async ({
    page,
  }) => {
    const parity = await page.evaluate(() => {
      // Unplugged: a standalone registry built with no global patch.
      const standalone = (window as any).__createDefaultValidityMergeRegistry();
      // Plugged: the registry the bootstrap installed on the global, which the element consults.
      const plugged = (window as any).customValidityMerge;
      return {
        standaloneDefault: standalone.resolve().key,
        pluggedDefault: plugged.resolve().key,
        sameLocalName: standalone.localName === plugged.localName,
      };
    });
    expect(parity.standaloneDefault).toBe('source-reduction');
    expect(parity.pluggedDefault).toBe('source-reduction');
    expect(parity.sameLocalName).toBe(true);
  });
});
