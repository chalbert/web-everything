/**
 * #1207 — regression for `{{ }}` / `[[ ]]` interpolation rendering the expression *path* instead of
 * its evaluated value on the text-interpolation demo.
 *
 * Root cause (found via live forensics on a cold-started server): `CustomTextNodeRegistry.upgrade()`
 * walked the subtree with a live `TreeWalker` while `#upgradeTextNode` mutated it. The text-node parser
 * returns a *fresh* `Text` even for a static segment with no delimiters, so a plain (e.g. whitespace)
 * text node was replaced by an equal one via `element.replaceWith(...)` — detaching the walker's current
 * node mid-walk. `nextNode()` then returned null and the iteration aborted, silently skipping every
 * expression text node that followed any static/whitespace text node in the same subtree. The demo's
 * `<div class="result">\n  <span>Hello, {{name}}!</span></div>` shape (leading whitespace before the
 * expression-bearing span) hit this exactly: the `{{name}}` node was never reached, so the raw path
 * rendered. Fix: snapshot the text nodes before mutating, so the walk never aborts.
 *
 * The existing unit suite is green yet missed this because it runs under happy-dom (which does not model
 * the live `TreeWalker`/`replaceWith` interaction) and because its fixtures put the expression node
 * first. This spec drives the real `customTextNodes.upgrade()` DOM path in a real browser — the
 * condition the unit layer can't reproduce (the "improve testing" ask in the item).
 */
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // A bootstrap-loaded page that registers the text-node parsers + registry and provides the demo
  // state/theme/filters contexts on the document injector.
  await page.goto('/demos/text-interpolation-demo.html', { waitUntil: 'load' });
  await page.waitForFunction(() => (window as unknown as { demoReady?: boolean }).demoReady === true);
});

test('the demo RESULT boxes render evaluated values, not the raw expression path', async ({ page }) => {
  const results = await page.evaluate(() => {
    const out: Record<string, string> = {};
    document.querySelectorAll('.result[data-test]').forEach((r) => {
      out[r.getAttribute('data-test') as string] = (r.textContent || '').replace(/\s+/g, ' ').trim();
    });
    return out;
  });

  expect(results.basic).toBe('Hello, World!');
  expect(results.nested).toBe('User: Jane Doe (Platform Engineer)');
  expect(results.context).toBe('Primary color: #6366f1');
  expect(results.pipe).toBe('Shouting: WORLD');
  expect(results.multiple).toBe('Full name: Jane Doe');
  expect(results.polymer).toBe('Count: 42');
  expect(results.mixed).toBe('Mustache: World / Polymer: 42');
  expect(results.template).toBe('World — Platform Engineer Items: 42');

  // None may leak the raw delimiters or a bare expression path.
  for (const value of Object.values(results)) {
    expect(value).not.toMatch(/\{\{|\}\}|\[\[|\]\]/);
  }
});

test('upgrade() on a connected subtree evaluates an expression that FOLLOWS static text (#1207)', async ({
  page,
}) => {
  // The exact shape that aborted the pre-fix walk: a leading whitespace text node, then the
  // expression-bearing span. Before the fix only the whitespace was processed (and needlessly
  // replaced), aborting the walk before the `{{name}}` node — so the raw path rendered.
  const rendered = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = '\n      <span>Hello, {{name}}!</span>';
    document.body.appendChild(host); // connected BEFORE upgrade so determination can resolve contexts
    (window as unknown as { customTextNodes: { upgrade(n: Node): void } }).customTextNodes.upgrade(host);
    const value = (host.textContent || '').replace(/\s+/g, ' ').trim();
    host.remove();
    return value;
  });

  expect(rendered).toBe('Hello, World!');
});

test('upgrade() determines EVERY expression node, even after several static segments (#1207)', async ({
  page,
}) => {
  // Multiple expressions separated by static text in one subtree — the pre-fix abort skipped all but
  // (at most) the first reachable expression. Assert they all evaluate.
  const rendered = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = '\n  <span>A {{first}} B {{last}} C [[count]] D</span>';
    document.body.appendChild(host);
    (window as unknown as { customTextNodes: { upgrade(n: Node): void } }).customTextNodes.upgrade(host);
    const value = (host.textContent || '').replace(/\s+/g, ' ').trim();
    host.remove();
    return value;
  });

  expect(rendered).toBe('A Jane B Doe C 42 D');
});
