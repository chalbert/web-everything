// Rendered /backlog/ content smoke test (#796) — the content-correctness sibling of the rendered-site
// a11y gate (tests/a11y/rendered-site-a11y.spec.ts). The tier rubric is unit-pinned (src/_data/__tests__/
// tier.test.ts), but the *rendered* Prioritisation table — the surface a human reads — had no content
// assertion: a loader→template wiring regression (a wrong readiness badge, a wrong tier count, a
// 'ready to ratify' chip on a blocked decision) renders silently green, because check:standards skips the
// 11ty build and the only docs-site spec checks axe a11y, not content. This asserts the rendered table
// against the loader projection itself — not hard-coded fixtures — so it stays correct as the backlog churns
// and ports cleanly to a future plateau-hosted rendered-site regression harness (#800): the contract is
// "the live loader output, extracted and compared", nothing site-specific baked in.

import { test, expect } from '@playwright/test';

// Hit the WE-docs origin directly (11ty :8080), mirroring the a11y spec — /backlog/ is the real docs page.
test.use({ baseURL: 'http://localhost:8080' });

// The SAME loader the 11ty build consumes (src/_data/backlog.js). Calling it here yields the exact
// projection the page was rendered from — the stable, extractable contract the assertions compare against.
// Playwright transpiles specs to CommonJS, so `require` is available directly (no import.meta needed).
const loadBacklog = require('../../src/_data/backlog.js') as () => Array<{
  num?: string;
  type: string;
  status: string;
  tier?: 'A' | 'B' | 'C';
  batchable?: boolean;
  sliceable?: boolean;
}>;

/** The readiness bucket the Prioritisation row carries — mirrors backlog.njk's `data-readiness` expression
 * (the open-row branch; active decisions are pinned separately and always render as 'decision'). Kept in
 * lock-step with the template so a divergence between loader fields and rendered badge is exactly what fails. */
function readinessOf(it: { batchable?: boolean; sliceable?: boolean; tier?: string }): string {
  if (it.batchable) return 'batchable';
  if (it.sliceable) return 'sliceable';
  if (it.tier === 'A') return 'agentready';
  if (it.tier === 'B') return 'decision';
  return 'notready';
}

// Deliberately skipped in the live dev-server e2e lane: this compares the loader (read from the
// CURRENT files at spec-collection time) against the WATCHED 11ty render on :8080, which lags during active
// backlog churn (a batch / concurrent session adding-resolving items) — the rendered row count drifts one or
// more items behind the loader (the observed 83-vs-82). The assertion is sound only against a FROZEN tree:
// re-home it to the build-then-test rendered-site regression harness (#800), where the render and the loader
// are taken from the same snapshot. Tracked by #800 (the #1572 triage that first parked it is resolved).
test.describe.skip('Rendered /backlog/ Prioritisation table matches the loader projection', () => {
  const all = loadBacklog();
  const openItems = all.filter((i) => i.status === 'open' && i.num);
  const activeDecisions = all.filter((i) => i.status === 'active' && i.type === 'decision' && i.num);

  // The rows the template renders: pinned active decisions, then every open item (backlog.njk `tableRows`).
  const expectedByNum = new Map<string, string>();
  for (const d of activeDecisions) expectedByNum.set(d.num as string, 'decision');
  for (const it of openItems) expectedByNum.set(it.num as string, readinessOf(it));

  const expectedTally: Record<string, number> = {};
  for (const r of expectedByNum.values()) expectedTally[r] = (expectedTally[r] ?? 0) + 1;
  const expectedBatchable = all.filter((i) => i.batchable).length;

  test('every rendered row carries the loader-derived readiness, and the counts match', async ({ page }) => {
    await page.goto('/backlog/', { waitUntil: 'domcontentloaded' });

    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('tr[data-readiness]')].map((tr) => ({
        num: (tr.getAttribute('data-search') ?? '').trim().split(/\s+/)[0],
        readiness: (tr as HTMLElement).dataset.readiness ?? '',
      })),
    );

    // 1. Row set matches the loader's open(+active-decision) set, 1:1 — catches a dropped/extra row.
    expect(rows.length, 'rendered row count vs loader open(+active-decision) count').toBe(expectedByNum.size);

    // 2. Each row's readiness badge matches what the loader fields imply — the core wiring check: a single
    //    mis-badged item (e.g. a 'ready to ratify' chip on a blocked decision) fails here, not silently.
    const mismatches = rows.filter((r) => expectedByNum.get(r.num) !== r.readiness);
    expect(
      mismatches.map((m) => `#${m.num}: rendered=${m.readiness} expected=${expectedByNum.get(m.num)}`),
      'rows whose rendered readiness diverges from the loader projection',
    ).toEqual([]);

    // 3. Per-bucket rendered counts equal the loader tally — the "tier/readiness counts" a human scans.
    const renderedTally: Record<string, number> = {};
    for (const r of rows) renderedTally[r.readiness] = (renderedTally[r.readiness] ?? 0) + 1;
    expect(renderedTally, 'rendered per-readiness counts vs loader tally').toEqual(expectedTally);
  });

  test('the batchable filter chip count equals the loader batchable count and the batchable row count', async ({ page }) => {
    await page.goto('/backlog/', { waitUntil: 'domcontentloaded' });

    const chipCount = await page.evaluate(() => {
      const chip = document.querySelector('[data-pfilter="batchable"]');
      const m = chip?.textContent?.match(/(\d+)\s+batchable/i);
      return m ? Number(m[1]) : null;
    });
    const batchableRows = await page.locator('tr[data-readiness="batchable"]').count();

    expect(chipCount, 'the "N batchable" filter chip count').toBe(expectedBatchable);
    expect(batchableRows, 'rendered batchable rows vs loader batchable count').toBe(expectedBatchable);
  });
});
