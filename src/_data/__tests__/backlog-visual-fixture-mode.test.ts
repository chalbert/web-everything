// Regression test for the #2236 `WE_VISUAL_FIXTURES` fixture-mode override in `../backlog.js`. Pins two
// things: (1) the LIVE docs build's data source is completely unaffected — the env var unset must still
// read the real `backlog/` directory, and (2) when set, the loader reads ONLY the small, checked-in,
// frozen fixture set at `../../../tests/visual/fixtures/backlog/*.md` (never the live directory, never the
// dev-only reservations file), and the fixture set's blockedBy/dependents wiring produces the deterministic
// tier/leverage fields the visual spec's detail-page target renders.
//
// `backlog.js` computes its `BACKLOG_DIR` constant ONCE at module-load time from `process.env`, so each
// variant needs a FRESH module evaluation — `require.cache` is busted by hand between reads (mirrors how a
// real process boots once per env, e.g. the Eleventy `--serve` process playwright.config.ts launches).
import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const backlogPath = require.resolve('../backlog.js');

type BacklogItem = {
  num?: string;
  title?: string;
  tier?: 'A' | 'B' | 'C';
  directUnblocks: number;
};
type BacklogFn = (() => BacklogItem[] & { activeBatches: unknown[] });

function freshBacklog(): BacklogFn {
  delete require.cache[backlogPath];
  return require('../backlog.js') as BacklogFn;
}

describe('backlog.js — #2236 WE_VISUAL_FIXTURES fixture-mode override', () => {
  afterEach(() => {
    delete process.env.WE_VISUAL_FIXTURES;
    delete require.cache[backlogPath];
  });

  it('reads the LIVE backlog/ directory when the env var is unset (live docs build unaffected)', () => {
    delete process.env.WE_VISUAL_FIXTURES;
    const items = freshBacklog()();
    // The live backlog has hundreds of real numbered items and none of the fixture set's high ids.
    expect(items.length).toBeGreaterThan(100);
    expect(items.some((it) => it.num === '9001')).toBe(false);
  });

  it('reads ONLY the frozen tests/visual/fixtures/backlog/ set when WE_VISUAL_FIXTURES is set', () => {
    process.env.WE_VISUAL_FIXTURES = '1';
    const items = freshBacklog()();
    expect(items.map((it) => it.num).sort()).toEqual(['9001', '9002', '9003']);
  });

  it('the detail-target fixture (9001) is deterministically Tier A with a nonzero dependent count', () => {
    process.env.WE_VISUAL_FIXTURES = '1';
    const items = freshBacklog()();
    const target = items.find((it) => it.num === '9001');
    expect(target?.title).toMatch(/frozen visual-regression detail target/i);
    // Its only blockedBy edge (fixture 9002) is resolved, so it clears to Tier A.
    expect(target?.tier).toBe('A');
    // Fixture 9003 is blocked on it, so it has a nonzero direct-unblock count for the leverage badge.
    expect(target?.directUnblocks).toBeGreaterThan(0);
  });

  it('never reads the dev-only reservations file in fixture mode (pure function of the fixture set)', () => {
    process.env.WE_VISUAL_FIXTURES = '1';
    const items = freshBacklog()();
    expect(items.activeBatches).toEqual([]);
  });
});
