/**
 * @file judge-panel.integration.test.mjs — the opt-in canary for a REAL two-juror panel (#3050).
 *
 * WHY IT IS OPT-IN, AND MORE FIRMLY THAN THE SINGLE-SPAWN ONE. `judge-spawn.integration.test.mjs` bills one
 * metered `claude` call; A PANEL BILLS N. That is the whole reason this file has its own flag rather than
 * riding `WE_JUDGE_SPAWN_LIVE`: turning the single-spawn canary on should not silently multiply the bill.
 * The unit suite (`judge-panel.test.mjs`) spawns nothing at all and proves every contract this module has —
 * this file exists only for the one class of failure a fake `spawnFn` cannot see: the CLI changing underneath
 * a CONCURRENT fan-out (a `--session-id` no longer honoured per-process, two simultaneous headless spawns
 * colliding on some shared resource).
 *
 *   WE_JUDGE_PANEL_LIVE=1 npx vitest run scripts/lib/__tests__/judge-panel.integration.test.mjs
 *
 * It is deliberately TWO seats — the smallest roster that can show sibling distinctness in a live run — on the
 * cheapest model, with hard per-juror and aggregate ceilings.
 */

import { describe, it, expect } from 'vitest';
import { judgePanel, panelSeats } from '../judge-panel.mjs';

const LIVE = process.env.WE_JUDGE_PANEL_LIVE === '1';

const SHAPE = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['accept', 'reject'] },
    finding: { type: 'string' },
  },
  required: ['verdict', 'finding'],
  additionalProperties: false,
};
const MANDATE = 'You are a code reviewer. Answer only through the provided schema. Be terse.';
const INPUT = 'Review this change: a function `half(n)` was added that returns `n / 0`. State one finding.';

describe.skipIf(!LIVE)('judgePanel against REAL claude processes (set WE_JUDGE_PANEL_LIVE=1)', () => {
  it('runs two live jurors concurrently and they are DISTINCT ACTORS from each other and from this process', async () => {
    const runId = `panel-it-${Date.now()}`;
    const jurors = [{ lens: 'correctness' }, { lens: 'security' }];
    const expected = panelSeats({ runId, jurors }).map((s) => s.sessionId);

    const panel = await judgePanel({
      runId,
      jurors,
      mandate: MANDATE,
      input: INPUT,
      shape: SHAPE,
      model: 'haiku',
      effort: 'low',
      budget: 0.25,
      maxTotalBudgetUsd: 0.5,
      depth: 0,
      maxDepth: 2,
    });

    expect(panel.jurors).toHaveLength(2);
    expect(panel.ok).toBe(true);

    // The CLI honoured the id each seat was handed — the panel's record points at the real transcripts.
    expect(panel.jurors.map((j) => j.reportedSessionId)).toEqual(expected);
    // …and the two seats are not one actor wearing two hats, which is the whole point of the module.
    expect(panel.jurors[0].reportedSessionId).not.toBe(panel.jurors[1].reportedSessionId);
    // …nor is either of them THIS process. A subagent would be; a headless spawn is not.
    if (process.env.CLAUDE_CODE_SESSION_ID) {
      for (const j of panel.jurors) {
        expect(j.reportedSessionId).not.toBe(process.env.CLAUDE_CODE_SESSION_ID);
      }
    }

    for (const j of panel.jurors) {
      expect(['accept', 'reject']).toContain(j.value.verdict);
      expect(j.stopReason).toBe('tool_use'); // `--json-schema` is still a FORCED tool call
      expect(j.loadedContextTokens).toBeGreaterThan(0);
    }
    expect(panel.totalCostUsd).toBeLessThan(panel.maxTotalBudgetUsd);
  }, 300_000);
});

describe.skipIf(LIVE)('the live panel suite is opt-in', () => {
  it('is skipped unless WE_JUDGE_PANEL_LIVE=1 — a panel bills N metered calls, not one', () => {
    expect(LIVE).toBe(false);
  });
});
