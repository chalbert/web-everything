// Interaction regression lane for the /backlog/ Active-work LIVE poller (backlog-active.js, #1854). This is
// the third dynamic surface: it polls /active-progress.json and renders live /workflow run cards + /batch
// cards, collapsing each item's pipeline stages to ONE chip per #NNN (rolled-up state), and overlays per-item
// digests onto the build-time lane rows. The poll must be DETERMINISTIC, so the spec intercepts the JSON
// endpoint via page.route with a fixed payload (never live data). Behaviour, not pixels: we assert the run
// card renders, stages collapse to items, the batch card splits working vs planned, and the lane-row digest
// overlay populates — against the REAL shipped script.

import { test, expect, type Page } from '@playwright/test';

const FIXTURE = '/tests/interaction/fixtures/backlog-active.html';

// One deterministic poll payload. A single running workflow run works #400 through TWO pipeline stages
// (done + running) and #401 through one — so the raw agent list is 3 but collapses to 2 items. A batch run
// holds #500 (actively working, via the digest link) and #501 (planned). The digests carry each item's live
// progress for the lane-row overlay.
const FEED = {
  updatedAt: '2026-06-15T12:00:00.000Z',
  runs: [
    {
      id: 'wf-1',
      kind: 'workflow',
      name: 'Parallel batch alpha',
      status: 'running',
      phase: 'work',
      updatedAt: '2026-06-15T12:00:00.000Z',
      agents: [
        { num: '400', label: 'slice:400', state: 'done', lastLine: 'stage A finished', steps: [{ at: '2026-06-15T11:58:00.000Z', text: 'A done', kind: 'text' }] },
        { num: '400', label: 'slice:400', state: 'running', lastLine: 'stage B running', steps: [{ at: '2026-06-15T11:59:30.000Z', text: 'B working', kind: 'tool' }] },
        { num: '401', label: 'slice:401', state: 'running', lastLine: 'working 401', steps: [{ at: '2026-06-15T11:59:00.000Z', text: '401 step', kind: 'text' }] },
      ],
    },
    {
      id: 'batch-x',
      kind: 'batch',
      status: 'running',
      updatedAt: '2026-06-15T12:00:00.000Z',
      nums: ['500', '501'],
    },
  ],
  digests: {
    '500': { batch: 'batch-x', currentTodo: 'implement the fixture', lastTool: 'Edit', updatedAt: '2026-06-15T11:59:00.000Z', sessionId: 'sess-500', steps: [{ at: '2026-06-15T11:59:00.000Z', text: 'editing', kind: 'tool' }] },
    '501': { currentTodo: 'awaiting turn', lastTool: 'Read', updatedAt: '2026-06-15T11:58:00.000Z', sessionId: 'sess-501', steps: [] },
  },
};

async function routeFeed(page: Page, body: unknown = FEED) {
  await page.route('**/active-progress.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

test('a running workflow run renders as a card with its name and phase', async ({ page }) => {
  await routeFeed(page);
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const board = page.locator('#active-live');
  await expect(board).toBeVisible();
  await expect(board).toContainText('Parallel batch alpha');
  await expect(board).toContainText('phase:');
  await expect(page.locator('#active-live-count')).toHaveText('1');
});

test('pipeline stages collapse to ONE chip per item (3 agents → 2 items)', async ({ page }) => {
  await routeFeed(page);
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  // #400's two stages (done + running) roll up to a single chip; #401 is the second. So exactly 2 item chips,
  // and the header reports "2 agents" for #400+... wait: header says "<done>/<items> items · <agents> agents".
  const card = page.locator('#active-live-runs');
  // One chip per #NNN: 400 appears once, 401 once → 2 chips total.
  await expect(card.locator('.aw-agent')).toHaveCount(2);
  // The rolled-up header reflects 2 items and 3 raw agents.
  await expect(card).toContainText('items · 3 agents');
});

test('the batch card splits actively-worked items from planned ones', async ({ page }) => {
  await routeFeed(page);
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const batch = page.locator('#active-batches');
  await expect(batch).toBeVisible();
  await expect(batch).toContainText('batch-x');
  // #500 (has the live digest.batch link) shows as working; #501 (no link) is planned.
  await expect(batch).toContainText('1 working · 1 planned');
  await expect(page.locator('#active-batches-runs')).toContainText('implement the fixture');
});

test('per-item digests overlay onto the build-time lane rows (matched by num)', async ({ page }) => {
  await routeFeed(page);
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  // The row for #501 (not in a batch) still gets its live digest — currentTodo shown, row un-hidden.
  const row501 = page.locator('[data-digest-for="501"]');
  await expect(row501).toBeVisible();
  await expect(row501).toContainText('awaiting turn');
});

test('an empty / missing feed leaves the board silent (static snapshot stands)', async ({ page }) => {
  // A 404 (watcher not running / static publish) must degrade to silence, not throw.
  await page.route('**/active-progress.json', (route) => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await expect(page.locator('#active-live')).toBeHidden();
  await expect(page.locator('#active-batches')).toBeHidden();
});

// #2150 — regression for the 77a66d18 fix: a TaskStop'd /workflow run carries status:'killed'. It must be
// treated as TERMINAL — never driving the tab pulse / workflows-live vital — and must age out of the feed
// once past the 10-min --recent window. `updatedAt` is computed relative to the REAL clock (the client uses
// Date.now()), so "fresh" and "stale" are honest against the shipped TERMINAL_MAX_AGE_MS.
function killedFeed(ageMs: number) {
  return {
    updatedAt: new Date(Date.now() - ageMs).toISOString(),
    runs: [
      {
        id: 'wf-killed',
        kind: 'workflow',
        name: 'Killed parallel batch',
        status: 'killed',
        phase: 'work',
        updatedAt: new Date(Date.now() - ageMs).toISOString(),
        agents: [{ num: '900', label: 'slice:900', state: 'done', lastLine: 'stopped' }],
      },
    ],
    digests: {},
  };
}

test('a fresh killed run renders but does NOT drive the tab pulse or workflows vital', async ({ page }) => {
  await routeFeed(page, killedFeed(60_000)); // 1 min old — still within the 10-min window
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  // It's recent, so it still renders as a (terminal) card…
  await expect(page.locator('#active-live')).toBeVisible();
  await expect(page.locator('#active-live-count')).toHaveText('1');
  // …but it is terminal, so liveN is 0: the tab live-pill and the workflows vital both stay hidden.
  await expect(page.locator('#active-tab-live')).toBeHidden();
  await expect(page.locator('#aw-vital-workflows')).toBeHidden();
});

test('a stale killed run is dropped from the feed (ages out past the 10-min window)', async ({ page }) => {
  await routeFeed(page, killedFeed(20 * 60_000)); // 20 min old — past the window
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  // The only run is a stale terminal one → dropped → board hidden, no live signal anywhere.
  await expect(page.locator('#active-live')).toBeHidden();
  await expect(page.locator('#active-tab-live')).toBeHidden();
  await expect(page.locator('#aw-vital-workflows')).toBeHidden();
});
