/**
 * @file ci-heal-pr-dispatch.test.mjs — `dispatchCiHeal` (#3852), the entry that dispatches one ci-heal for a
 * PR carrying `ci:failed`, from land-advance's `dispatch-ci-heal` owed row.
 *
 * NO PROCESS IS STARTED AND NO FILE IS READ. The module takes its brief reader and its effect sinks by
 * injection (`readBrief`, `sinks`), so each test hands it a stub template and a recording sink. The one
 * exception reads the REAL `fix-agent-ci-brief.md` off disk, to prove the tokens the module fills are the
 * tokens that brief actually carries.
 *
 * WHAT IS PINNED HERE, AND WHAT IS NOT. The module hands ONE payload to the sink and passes back what the sink
 * answers; the double-dispatch guard itself (the action-record that keys on the PR) is the SINK's, so the
 * `held` test uses a sink that behaves as that guard does and asserts the module passes it through unchanged.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

import { DISPATCH_EFFECT } from '../dispatch-lane.mjs';
import { briefPath, REPO_ROOT } from '../dispatch-lane-io.mjs';
import { dispatchCiHeal } from '../ci-heal-pr-dispatch.mjs';

const TEMPLATE = 'heal #{{ITEM_NUM}} pr={{PR_NUM}} ref={{LANE_REF}} lane={{LANE}} slug={{SESSION_SLUG}} scope={{SCOPE}} why={{REASON}}';

const PLANNED = {
  itemNum: '2638', pr: 743, laneRef: 'lane/2638-some-slug', scope: ['we:scripts/a.mjs', 'we:scripts/b.mjs'], lane: 9,
};

/** A sink that records every payload it is handed and answers like the real one does on a first dispatch. */
const recordingSink = (answer = { handle: 'agent-1' }) => {
  const calls = [];
  return { calls, sinks: { [DISPATCH_EFFECT]: async (payload) => { calls.push(payload); return answer; } } };
};

describe('dispatchCiHeal (#3852)', () => {
  it('fills the brief with the PR, lane, scope, ref and reason tokens', async () => {
    const { calls, sinks } = recordingSink();
    await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    expect(calls).toHaveLength(1);
    const slug = calls[0].sessionSlug;
    expect(calls[0].prompt).toBe(
      `heal #2638 pr=743 ref=lane/2638-some-slug lane=9 slug=${slug} scope=we:scripts/a.mjs,we:scripts/b.mjs why=red-ci`,
    );
  });

  it('hands one ci-heal payload keyed on the PR to the dispatch effect sink', async () => {
    const { calls, sinks } = recordingSink();
    const out = await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    expect(calls[0]).toMatchObject({
      launchKind: 'ci-heal', num: '2638', lane: 9, pr: 743, reason: 'red-ci', repo: 'we',
      scope: ['we:scripts/a.mjs', 'we:scripts/b.mjs'],
    });
    expect(out).toEqual({
      agentId: 'agent-1', sessionSlug: calls[0].sessionSlug, pr: 743, itemNum: '2638', lane: 9, unknownTokens: [],
    });
  });

  it('carries an explicit reason through to the brief and the payload', async () => {
    const { calls, sinks } = recordingSink();
    await dispatchCiHeal({ ...PLANNED, reason: 'behind' }, { readBrief: () => TEMPLATE, sinks });
    expect(calls[0].reason).toBe('behind');
    expect(calls[0].prompt).toMatch(/why=behind$/);
  });

  it('a second call for the same PR comes back held, and dispatches nothing new', async () => {
    // Stands in for the action-record guard the real sink applies, which keys on the PR.
    const seen = new Set();
    const sinks = {
      [DISPATCH_EFFECT]: async (payload) => {
        if (seen.has(payload.pr)) return { held: true, reason: `pr ${payload.pr} already has a ci-heal in flight` };
        seen.add(payload.pr);
        return { handle: 'agent-1' };
      },
    };
    const first = await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    const second = await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    expect(first.agentId).toBe('agent-1');
    expect(second).toEqual({ held: true, reason: 'pr 743 already has a ci-heal in flight' });
  });

  it('never touches a review:* label: the sink is the only call it makes and no payload names one', async () => {
    const { calls, sinks } = recordingSink();
    await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    expect(Object.keys(sinks)).toEqual([DISPATCH_EFFECT]);
    const payload = { ...calls[0] };
    delete payload.prompt; // the brief text itself may say "never touch review:*"; the payload fields must not carry one
    expect(JSON.stringify(payload)).not.toMatch(/review:|label/);
  });

  it('an item-less PR fills ITEM_NUM blank and reports itemNum null', async () => {
    const { calls, sinks } = recordingSink();
    const out = await dispatchCiHeal({ ...PLANNED, itemNum: null }, { readBrief: () => TEMPLATE, sinks });
    expect(calls[0].prompt).toMatch(/^heal # pr=743/);
    expect(calls[0].num).toBeUndefined();
    expect(out.itemNum).toBeNull();
  });

  it('a handle-less sink answer reports agentId null instead of throwing', async () => {
    const { sinks } = recordingSink({});
    const out = await dispatchCiHeal(PLANNED, { readBrief: () => TEMPLATE, sinks });
    expect(out.agentId).toBeNull();
  });

  it('refuses a scope token the brief cannot carry safely, before any sink call', async () => {
    const { calls, sinks } = recordingSink();
    await expect(
      dispatchCiHeal({ ...PLANNED, scope: ['we:scripts/a b.mjs'] }, { readBrief: () => TEMPLATE, sinks }),
    ).rejects.toThrow(/SCOPE|cannot carry safely/);
    expect(calls).toHaveLength(0);
  });

  it('the real fix-agent-ci-brief.md is fully filled: no required token is left behind', async () => {
    const { calls, sinks } = recordingSink();
    const real = readFileSync(briefPath(REPO_ROOT, 'ci-heal'), 'utf8');
    await dispatchCiHeal(PLANNED, { readBrief: () => real, sinks });
    for (const name of ['ITEM_NUM', 'PR_NUM', 'LANE_REF', 'LANE', 'SESSION_SLUG', 'SCOPE', 'REASON']) {
      expect(calls[0].prompt).not.toContain(`{{${name}}}`);
    }
    expect(calls[0].prompt).toContain('lane/2638-some-slug');
  });
});
