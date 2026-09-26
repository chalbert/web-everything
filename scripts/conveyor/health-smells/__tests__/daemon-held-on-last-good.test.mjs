/**
 * @file scripts/conveyor/health-smells/__tests__/daemon-held-on-last-good.test.mjs
 * @description x5wbsbc (epic #4075) — the PURE `evaluate()` of the `daemon-held-on-last-good` smell (a daemon
 *   clone the rebuild has frozen on its last-good build after a failed live smoke, per the 2026-09-26 operator
 *   ruling to fall back rather than block delivery), its `notifyEvenInShadow` wiring through `planActions`, and
 *   `health-watch.mjs#probeSelfSync`'s pass-through of `state.held` from a real `<cloneKey>.rebuild.json` file.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import daemonHeldOnLastGood, { MAX_HELD_AGE_MS } from '../daemon-held-on-last-good.mjs';
import {
  MINUTE, HOUR, emptyHealthState, stepEpisodes, planActions,
} from '../../health-watch-core.mjs';
import { probeSelfSync } from '../../health-watch.mjs';

const NOW = Date.parse('2026-09-26T20:00:00Z');

const clone = (cloneKey, held) => ({ cloneKey, alerts: [], rebuild: { held } });

describe('daemon-held-on-last-good — evaluate', () => {
  it('breaches once held past heldForMs (16 min) and names the failing check(s) + reason in the summary', () => {
    const held = {
      since: NOW - 16 * MINUTE, reason: 'smoke-harness-broken', failed: 'lane-acquire-release', lastGood: 'abc123def4567890', target: 'def456789abc', mainSha: 'xyz',
    };
    const out = daemonHeldOnLastGood.evaluate({ selfSync: [clone('x', held)] }, { now: NOW });
    const r = out.find((x) => x.subject === 'clone:x');
    expect(r.breach).toBe(true);
    expect(r.summary).toMatch(/smoke-harness-broken/);
    expect(r.summary).toMatch(/lane-acquire-release/);
    expect(r.summary).toMatch(/abc123def456/);
    expect(r.summary).toMatch(/still dispatching from it/);
    expect(r.measure.heldMin).toBe(16);
    expect(r.measure.failedChecks).toBe('lane-acquire-release');
  });

  it('does not breach yet at 10 minutes held', () => {
    const held = { since: NOW - 10 * MINUTE, reason: 'smoke-rejected', failed: 'tree-stays-clean', lastGood: 'abc123', target: 'def456' };
    const out = daemonHeldOnLastGood.evaluate({ selfSync: [clone('x', held)] }, { now: NOW });
    const r = out.find((x) => x.subject === 'clone:x');
    expect(r.breach).toBe(false);
  });

  it('never breaches when the clone is not held at all', () => {
    const out = daemonHeldOnLastGood.evaluate({ selfSync: [clone('x', null)] }, { now: NOW });
    const r = out.find((x) => x.subject === 'clone:x');
    expect(r.breach).toBe(false);
    expect(r.measure.heldReason).toBeNull();
  });

  it('smoke-harness-broken gets the "fix the tool, not the tree" recommendation wording', () => {
    const held = {
      since: NOW - 20 * MINUTE, reason: 'smoke-harness-broken', failed: 'lane-acquire-release', lastGood: 'abc123def4567890', target: 'def456',
    };
    const out = daemonHeldOnLastGood.evaluate({ selfSync: [clone('x', held)] }, { now: NOW });
    const r = out.find((x) => x.subject === 'clone:x');
    expect(r.recommendation).toMatch(/smoke harness\/environment itself fails/);
    expect(r.recommendation).toMatch(/lane-acquire-release/);
    expect(r.recommendation).toMatch(/not the clone/);
    expect(r.recommendation).not.toMatch(/origin\/main \(or an overlay\) fails/);
  });

  it('any other reason gets the "the new tree fails" recommendation wording instead', () => {
    const held = {
      since: NOW - 20 * MINUTE, reason: 'smoke-rejected', failed: 'tree-stays-clean', lastGood: 'abc123def4567890', target: 'def456',
    };
    const out = daemonHeldOnLastGood.evaluate({ selfSync: [clone('x', held)] }, { now: NOW });
    const r = out.find((x) => x.subject === 'clone:x');
    expect(r.recommendation).toMatch(/origin\/main \(or an overlay\) fails/);
    expect(r.recommendation).toMatch(/tree-stays-clean/);
  });

  it('flags overMaxAge once held past 24h, not before', () => {
    const under = { since: NOW - 1 * HOUR, reason: 'smoke-rejected', failed: 'x', lastGood: 'abc123' };
    const over = { since: NOW - (MAX_HELD_AGE_MS + HOUR), reason: 'smoke-rejected', failed: 'x', lastGood: 'abc123' };
    const outUnder = daemonHeldOnLastGood.evaluate({ selfSync: [clone('x', under)] }, { now: NOW });
    const outOver = daemonHeldOnLastGood.evaluate({ selfSync: [clone('x', over)] }, { now: NOW });
    expect(outUnder.find((x) => x.subject === 'clone:x').measure.overMaxAge).toBe(false);
    expect(outOver.find((x) => x.subject === 'clone:x').measure.overMaxAge).toBe(true);
  });
});

describe('daemon-held-on-last-good — notifyEvenInShadow', () => {
  it('an "opened" transition in shadow mode yields a notify with suppressed:null', () => {
    const r = stepEpisodes(emptyHealthState(), [
      { smell: daemonHeldOnLastGood, results: [{ subject: 'clone:x', breach: true }] },
    ], 0);
    const plan = planActions(r.transitions, { [daemonHeldOnLastGood.id]: daemonHeldOnLastGood }, { mode: 'shadow' });
    const notify = plan.find((p) => p.kind === 'notify' && p.key === `${daemonHeldOnLastGood.id}::clone:x`);
    expect(notify).toBeDefined();
    expect(notify.suppressed).toBeNull();
  });
});

describe('probeSelfSync — passes `held` through with `since` parsed to ms', () => {
  it('reads a real <cloneKey>.rebuild.json and parses held.since', () => {
    const dir = mkdtempSync(join(tmpdir(), 'x5wbsbc-self-sync-'));
    try {
      const sinceIso = new Date(NOW - 16 * MINUTE).toISOString();
      writeFileSync(join(dir, 'myclone.rebuild.json'), JSON.stringify({
        adopted: null,
        rejected: null,
        inProgress: null,
        quarantine: null,
        held: {
          since: sinceIso, reason: 'smoke-harness-broken', failed: 'lane-acquire-release', details: [{ name: 'lane-acquire-release', detail: 'no lanes provisioned' }], lastGood: 'abc123def4567890', target: 'def456789abc', mainSha: 'xyz', updatedAt: sinceIso,
        },
      }));
      const out = probeSelfSync(dir);
      const row = out.find((x) => x.cloneKey === 'myclone');
      expect(row).toBeTruthy();
      expect(row.rebuild.held.since).toBe(Date.parse(sinceIso));
      expect(row.rebuild.held.reason).toBe('smoke-harness-broken');
      expect(row.rebuild.held.failed).toBe('lane-acquire-release');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses an invalid `since` as null (never a false-positive timestamp)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'x5wbsbc-self-sync-'));
    try {
      writeFileSync(join(dir, 'myclone.rebuild.json'), JSON.stringify({ held: { since: 'not-a-date', reason: 'smoke-transient' } }));
      const out = probeSelfSync(dir);
      const row = out.find((x) => x.cloneKey === 'myclone');
      expect(row.rebuild.held.since).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads `held: null` as null (an adopted clone)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'x5wbsbc-self-sync-'));
    try {
      writeFileSync(join(dir, 'myclone.rebuild.json'), JSON.stringify({ adopted: { at: new Date(NOW).toISOString() }, held: null }));
      const out = probeSelfSync(dir);
      const row = out.find((x) => x.cloneKey === 'myclone');
      expect(row.rebuild.held).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
