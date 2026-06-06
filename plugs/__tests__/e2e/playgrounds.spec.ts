/**
 * Data-driven E2E smoke for every conformance playground.
 *
 * Iterates every `kind: "playground"` entry in src/_data/demos.json (so new playgrounds are
 * covered automatically, not hand-listed — coverage plan #16). For each one it asserts the demo:
 *   - loads and signals readiness (`window.playgroundReady === true`),
 *   - renders ALL badges green (no `.badge.fail`, summary is `.pass`, `window.playgroundPass` > 0),
 *   - produces ZERO console / page errors (this also catches a bootstrap or jsxInject failure,
 *     since vite auto-injects bootstrap.ts into every demo HTML).
 *
 * A red badge, a runtime throw, or a build misconfig that would otherwise pass CI unnoticed turns
 * this red. Needs the dev server on :3000 (see playwright.config.ts). Coverage plan #E.
 */
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import demos from '../../../src/_data/demos.json';

interface DemoEntry {
  id: string;
  name: string;
  kind?: string;
  liveUrl?: string;
}

const playgrounds = (demos as DemoEntry[]).filter((d) => d.kind === 'playground');

/** Attach a console/page error collector; ignores favicon/404 noise. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!text.includes('favicon') && !text.includes('404')) errors.push(text);
  });
  page.on('pageerror', (err: Error) => errors.push(`${err.name}: ${err.message}`));
  return errors;
}

test.describe('Conformance playgrounds (data-driven from demos.json)', () => {
  test('there is at least one playground to cover', () => {
    expect(playgrounds.length).toBeGreaterThan(0);
  });

  for (const demo of playgrounds) {
    const path = `/demos/${demo.id}.html`;

    test(`${demo.name} loads green with no console errors`, async ({ page }) => {
      const errors = collectErrors(page);

      await page.goto(path);
      await page.waitForFunction(() => (window as unknown as { playgroundReady?: boolean }).playgroundReady === true, {
        timeout: 10000,
      });

      // Every conformance badge is green.
      await expect(page.locator('.badge.fail')).toHaveCount(0);
      await expect(page.locator('.summary')).toHaveClass(/pass/);

      // The playground actually checked something (guards an empty/short-circuited run).
      const passCount = await page.evaluate(
        () => (window as unknown as { playgroundPass?: number }).playgroundPass
      );
      expect(passCount).toBeGreaterThan(0);

      // No runtime / bootstrap / jsxInject errors slipped through.
      await page.waitForTimeout(200); // catch any late async errors
      expect(errors, errors.join('\n')).toHaveLength(0);
    });
  }
});

/**
 * Component Adapter Playground proves a DIFFERENT invariant (one-way lowering, not round-trip), and
 * ships an editable sandbox. Exercise it end-to-end: type a definition → Run → a live custom element
 * with the lowered template renders.
 */
test.describe('Component Adapter Playground — editable sandbox', () => {
  test('type a definition → Run → a live element renders', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/demos/component-adapter-demo.html');
    await page.waitForFunction(() => (window as unknown as { playgroundReady?: boolean }).playgroundReady === true);

    const textarea = page.locator('.sandbox textarea');
    await textarea.fill(
      [
        '<component name="sandbox-greeter" shadow="open">',
        '  <template>',
        '    <strong><slot>hi</slot></strong>',
        '  </template>',
        '</component>',
        '',
        '<sandbox-greeter>hello there</sandbox-greeter>',
      ].join('\n')
    );
    await page.locator('.sandbox-run').click();

    // The generated class is emitted, and a live element is registered + rendered under a unique tag.
    await expect(page.locator('.sandbox .code').first()).toContainText('customElements.define');
    const liveHost = page.locator('.sandbox .preview > *').first();
    await expect(liveHost).toHaveCount(1);
    // The slotted light-DOM content survives the lowering.
    await expect(page.locator('.sandbox .preview')).toContainText('hello there');

    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});
