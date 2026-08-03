/**
 * @file scripts/__tests__/lane-stack-tree-guard.test.mjs
 * @description Unit proof of #2900's tree guard — the rule behind `lane-stack.mjs`'s `recheck` / `record` /
 * `apply-rebase` refusing to operate on anything but the item's own leased lane clone.
 *
 * WHY THIS FILE EXISTS IN THIS SHAPE. The first version of the guard asked "does the path contain `/.lanes/`",
 * and an advisory jury found it did not work: its `script-in-lane` allowance made the refusal unreachable
 * whenever the running script lived in a lane clone — this repo's NORMAL execution context — so the guard was
 * off exactly when it should fire. The unit test that claimed to cover that branch passed `tree: LANE`, which
 * returned at the EARLIER branch, so the line was never exercised and deleting it left the suite green.
 *
 * Two lessons are baked into the tests below. First, the rule is now a POSITIVE check against a fact the lane
 * pool wrote (`.git/.lane-lease`), not an inference from a name — so the cases are about lease presence and
 * lease ownership, which cannot be spoofed by a path. Second, every allow-case here asserts the REASON, not
 * just `ok`, so a test can no longer pass by reaching a different branch than the one it names.
 */
import { describe, it, expect } from 'vitest';
import { laneTreeVerdict, leaseItem } from '../readiness/lane-tree-guard.mjs';

const leaseFor = (purpose) => ({ session: 'Mac:1', purpose, acquiredAt: '2026-08-03T00:00:00Z', ttlMinutes: 240 });

describe('#2900 — leaseItem', () => {
  it('reads the item from an explicit field, then from the purpose slug', () => {
    expect(leaseItem({ item: 2899 })).toBe('2899');
    expect(leaseItem(leaseFor('2899-resolve-on-land'))).toBe('2899');
    expect(leaseItem(leaseFor('xdxlevu-resolve-on-land'))).toBe('xdxlevu');
  });
  it('is null when the lease names no item', () => {
    expect(leaseItem(leaseFor('close-session'))).toBe(null);
    expect(leaseItem(leaseFor(null))).toBe(null);
    expect(leaseItem(null)).toBe(null);
    expect(leaseItem('nonsense')).toBe(null);
  });
});

describe('#2900 — laneTreeVerdict: a leased lane, and the RIGHT one', () => {
  it('REFUSES a tree with no lease — the primary checkout, or any unleased tree', () => {
    const v = laneTreeVerdict({ lease: null, id: '2899' });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('no-lease');
    expect(v.detail).toMatch(/not a leased lane clone/);
  });

  it('ALLOWS the lane leased for THIS item', () => {
    expect(laneTreeVerdict({ lease: leaseFor('2899-resolve-on-land'), id: '2899' }))
      .toEqual({ ok: true, reason: 'leased-lane' });
  });

  it('REFUSES a lane leased for a DIFFERENT item — the hole the path guess could not close', () => {
    // Under the old rule any directory under /.lanes/ was accepted unconditionally, so aiming `--lane` at the
    // wrong lane produced a full `clean` certification against someone else's tree.
    const v = laneTreeVerdict({ lease: leaseFor('2900-lane-stack'), id: '2899' });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('wrong-lane');
    expect(v.detail).toMatch(/leased for #2900/);
    expect(v.detail).toMatch(/certifying #2899/);
  });

  it('matches a hash-born id against a hash-slug lease', () => {
    expect(laneTreeVerdict({ lease: leaseFor('xdxlevu-resolve'), id: 'xdxlevu' }).ok).toBe(true);
    expect(laneTreeVerdict({ lease: leaseFor('xdxlevu-resolve'), id: 'xother1' }).reason).toBe('wrong-lane');
  });

  it('ALLOWS a lease that names no item — it cannot disagree with the id', () => {
    // A lane acquired with a non-item purpose (`--purpose=close-session`) is still a real leased lane. Refusing
    // it would break honest workflows; the no-lease rule already covers the case that actually caused #2900.
    expect(laneTreeVerdict({ lease: leaseFor('close-session'), id: '2899' }))
      .toEqual({ ok: true, reason: 'leased-lane-unnamed' });
  });

  it('skips the ownership compare when the seam has no id, but still requires a lease', () => {
    expect(laneTreeVerdict({ lease: leaseFor('2900-x'), id: null }).reason).toBe('leased-lane');
    expect(laneTreeVerdict({ lease: leaseFor('2900-x'), id: '' }).reason).toBe('leased-lane');
    expect(laneTreeVerdict({ lease: null, id: null }).ok).toBe(false);
  });

  it('no argument shape reaches `ok` without a lease — the guard cannot be defaulted open', () => {
    expect(laneTreeVerdict().ok).toBe(false);
    expect(laneTreeVerdict({}).ok).toBe(false);
    expect(laneTreeVerdict({ id: '2899' }).ok).toBe(false);
    expect(laneTreeVerdict({ lease: null, requireItemMatch: false }).ok).toBe(false);
  });
});
