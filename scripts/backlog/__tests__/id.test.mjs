/**
 * @file scripts/backlog/__tests__/id.test.mjs
 * @description Unit proof of the two-form backlog id (#2288 — JIT numbering). A new item is born with a
 * collision-free HASH id (`x`+6 base36); the drain rewrites it to the real sequential NNN at land. These
 * cover the id token parsing (numeric vs hash), hash minting, and — the numbering brain — `applyLedger`,
 * the pure decider of which files to rename + rewrite when the drain assigns numbers (incl. the cross-lane
 * case where a dependent references an already-numbered blocker by its old hash).
 */
import { describe, it, expect } from 'vitest';
import { HASH_RE, BORN_AS_RE, ID_TOKEN_RE, isHash, isNum, idFromName, slugFromName, normalizeId, nextHash, applyLedger, stampBornAs } from '../id.mjs';

describe('id token parsing (#2288)', () => {
  it('idFromName reads a numeric NNN or an xNNNNNN hash off a stem/ref', () => {
    expect(idFromName('2288-jit-numbering')).toBe('2288');
    expect(idFromName('x7k2q9a-jit-numbering')).toBe('x7k2q9a');
    expect(idFromName('089')).toBe('089');       // bare ref
    expect(idFromName('x7k2q9a')).toBe('x7k2q9a');  // bare hash ref
    expect(idFromName('notanid')).toBeUndefined();
  });

  it('parses a 5-digit NNN (#xzxc92d note a — headroom past 9999)', () => {
    expect(idFromName('12345-big-item')).toBe('12345');
    expect(isNum('12345')).toBe(true);
    expect(slugFromName('12345-big-item')).toBe('big-item');
    expect(idFromName('123456-too-wide')).toBeUndefined(); // 6 digits is not a valid id token
  });

  it('distinguishes numeric from hash', () => {
    expect(isNum('2288')).toBe(true);
    expect(isNum('x7k2q9a')).toBe(false);
    expect(isHash('x7k2q9a')).toBe(true);
    expect(isHash('2288')).toBe(false);
    expect(HASH_RE.test('x7k2q9a')).toBe(true);
    expect(HASH_RE.test('x7k2q')).toBe(false);   // 5 chars — too short
    expect(HASH_RE.test('xABCDEF')).toBe(false);  // uppercase — base36 lowercase only
  });

  it('a slug that merely starts with x is not mistaken for a hash id (the id always leads the filename)', () => {
    // `xanadu` is only 6 chars after nothing — as a leading token `xanadu` would need `x`+5 more; here the
    // id token is the WHOLE leading run before the dash, and a real 7-char hash never collides with intent.
    expect(idFromName('xray-vision-thing')).toBeUndefined(); // `xray` is 4 chars, not x+6 → not a hash, not numeric
    expect(ID_TOKEN_RE.test('xray-vision')).toBe(false);
  });

  it('slugFromName strips either id form', () => {
    expect(slugFromName('2288-jit-numbering')).toBe('jit-numbering');
    expect(slugFromName('x7k2q9a-jit-numbering')).toBe('jit-numbering');
  });

  it('normalizeId pads a number, leaves a hash untouched', () => {
    expect(normalizeId('7')).toBe('007');
    expect(normalizeId('2288')).toBe('2288');
    expect(normalizeId('x7k2q9a')).toBe('x7k2q9a');
  });
});

describe('nextHash (#2288)', () => {
  it('mints a valid hash', () => {
    const h = nextHash([]);
    expect(HASH_RE.test(h)).toBe(true);
  });
  it('avoids a collision with an existing id', () => {
    // Force a collision on the first candidate is nondeterministic; instead assert it never returns a taken id
    // across many draws.
    const taken = new Set();
    for (let i = 0; i < 200; i++) {
      const h = nextHash(taken);
      expect(taken.has(h)).toBe(false);
      taken.add(h);
    }
  });
});

describe('applyLedger — the drain numbering brain (#2288)', () => {
  const file = (name, content) => ({ name, content });

  it('renames the just-landed item and rewrites its own frontmatter/body refs', () => {
    const files = [
      file('x7k2q9a-alpha', '---\nkind: story\n---\n# Alpha\n\nSee x7k2q9a for context and #x7k2q9a again.\n'),
    ];
    const { renames, rewrites } = applyLedger(files, { x7k2q9a: '2314' });
    expect(renames).toEqual([{ from: 'x7k2q9a-alpha', to: '2314-alpha' }]);
    expect(rewrites).toHaveLength(1);
    expect(rewrites[0].content).toContain('See 2314 for context and #2314 again.'); // body refs rewritten
    expect(rewrites[0].content).toContain('bornAs: x7k2q9a');                        // birth-hash proof-of-land stamped (#2392)
    // The ONLY surviving x7k2q9a is the protected bornAs record — the body ref is fully rewritten.
    expect(rewrites[0].content.replace('bornAs: x7k2q9a', '')).not.toContain('x7k2q9a');
  });

  it("repairs another item's blockedBy that points at the numbered hash (cross-lane edge)", () => {
    const files = [
      file('x7k2q9a-alpha', '---\nkind: story\nstatus: resolved\n---\n# Alpha\n'),
      file('xbb000a-beta', '---\nkind: story\nblockedBy: ["x7k2q9a"]\n---\n# Beta\n'),
    ];
    // Both landed: alpha→2314, beta→2315. Applying the WHOLE ledger fixes beta's stale hash ref too.
    const { renames, rewrites } = applyLedger(files, { x7k2q9a: '2314', xbb000a: '2315' });
    expect(renames).toContainEqual({ from: 'x7k2q9a-alpha', to: '2314-alpha' });
    expect(renames).toContainEqual({ from: 'xbb000a-beta', to: '2315-beta' });
    const beta = rewrites.find((r) => r.name === 'xbb000a-beta');
    expect(beta.content).toContain('blockedBy: ["2314"]');
  });

  it('numbers a dependent while its blocker is already landed (blocker not in this file set, still in ledger)', () => {
    // Blocker x7k2q9a already landed (its file is now 2314-alpha on main, hash gone); dependent beta lands now.
    const files = [
      file('2314-alpha', '---\nkind: story\nstatus: resolved\n---\n# Alpha\n'),
      file('xbb000a-beta', '---\nkind: story\nblockedBy: ["x7k2q9a"]\n---\n# Beta\n'),
    ];
    // The ledger still carries x7k2q9a→2314 (kept until the queue drains), so beta's edge resolves.
    const { renames, rewrites } = applyLedger(files, { x7k2q9a: '2314', xbb000a: '2315' });
    expect(renames).toEqual([{ from: 'xbb000a-beta', to: '2315-beta' }]); // 2314-alpha already numeric, not renamed
    const beta = rewrites.find((r) => r.name === 'xbb000a-beta');
    expect(beta.content).toContain('blockedBy: ["2314"]');
  });

  it('leaves numeric-only files untouched but stamps bornAs on the item it numbers', () => {
    const files = [
      file('2200-legacy', '---\nkind: story\nblockedBy: ["2100"]\n---\n# Legacy\n'),
      file('xother1-gamma', '---\nkind: task\n---\n# Gamma references xnope01 which is not ledgered\n'),
    ];
    const { renames, rewrites } = applyLedger(files, { xother1: '2316' });
    expect(renames).toEqual([{ from: 'xother1-gamma', to: '2316-gamma' }]);
    expect(rewrites.find((r) => r.name === '2200-legacy')).toBeUndefined();     // numeric-only file untouched
    // gamma is the item being numbered → it gets its bornAs proof-of-land stamp (#2392); its unrelated
    // body hash (xnope01, not ledgered) is left as-is.
    const gamma = rewrites.find((r) => r.name === 'xother1-gamma');
    expect(gamma.content).toContain('bornAs: xother1');
    expect(gamma.content).toContain('xnope01'); // unledgered hash untouched
  });

  it('is a no-op with an empty ledger', () => {
    const files = [file('x7k2q9a-alpha', '# Alpha x7k2q9a\n')];
    expect(applyLedger(files, {})).toEqual({ renames: [], rewrites: [] });
  });
});

describe('bornAs proof-of-land (#2392)', () => {
  const file = (name, content) => ({ name, content });

  it('stampBornAs inserts the birth hash as the first frontmatter field', () => {
    const out = stampBornAs('---\nkind: story\nstatus: resolved\n---\n# Alpha\n', 'x7k2q9a');
    expect(out).toBe('---\nbornAs: x7k2q9a\nkind: story\nstatus: resolved\n---\n# Alpha\n');
    expect(BORN_AS_RE.test('bornAs: x7k2q9a')).toBe(true);
  });

  it('stampBornAs is idempotent — never double-stamps an already-recorded birth hash', () => {
    const once = stampBornAs('---\nkind: story\n---\n# A\n', 'x7k2q9a');
    expect(stampBornAs(once, 'x7k2q9a')).toBe(once);
  });

  it('stampBornAs leaves content with no frontmatter delimiter untouched', () => {
    expect(stampBornAs('# no frontmatter\n', 'x7k2q9a')).toBe('# no frontmatter\n');
  });

  it('DEADLOCK REGRESSION: applyLedger keeps a bornAs value intact while rewriting a blockedBy hash→NNN', () => {
    // The permanent-strand deadlock the adversary found: without the guard the blind hash→NNN rewrite
    // clobbers the item's own bornAs record to its assigned number, erasing the sole cross-clone proof.
    const stamped = stampBornAs('---\nkind: story\nblockedBy: ["xblk001"]\n---\n# Beta\n', 'x7k2q9a');
    const files = [file('x7k2q9a-beta', stamped)];
    const { renames, rewrites } = applyLedger(files, { x7k2q9a: '2314', xblk001: '2301' });
    expect(renames).toEqual([{ from: 'x7k2q9a-beta', to: '2314-beta' }]);
    const beta = rewrites.find((r) => r.name === 'x7k2q9a-beta').content;
    expect(beta).toContain('bornAs: x7k2q9a');       // birth hash SURVIVES numbering (the fix)
    expect(beta).not.toContain('bornAs: 2314');       // never clobbered to its assigned NNN
    expect(beta).toContain('blockedBy: ["2301"]');    // every OTHER hash ref still rewritten
  });
});
