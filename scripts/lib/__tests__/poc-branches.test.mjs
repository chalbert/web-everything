/**
 * @file scripts/lib/__tests__/poc-branches.test.mjs
 * @description Unit proof of the POC-branch registry (#3637 Fork 4) — the declared list of long-lived branches
 *   an item may target with `deliveryTarget:`. Covers the read/write round-trip against a REAL temp file, the
 *   rule-10(c) required fields (a branch must NAME what it is for and who graduates it), the FAIL-CLOSED
 *   lookups, and the `deliveryTarget:` predicate the gate + the dispatcher both call.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  POC_REGISTRY_PATH, DEFAULT_GRADUATION_TARGET,
  normalizeBranchRef, validatePocBranch, normalizeRegistry, findPocBranch, isPocBranch,
  upsertPocBranch, removePocBranch, validateDeliveryTarget,
  readRegistry, writeRegistry, primaryPocBranch, driftDefaults,
} from '../poc-branches.mjs';

const ENTRY = Object.freeze({
  branch: 'lane/demo',
  purpose: 'a demo POC branch',
  owner: '1234',
  dateOpened: '2026-09-12',
  target: 'main',
  scope: ['we:scripts/demo/'],
  graduationItem: '5678',
});

let dir;
let path;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'poc-reg-')); path = join(dir, 'poc-branches.json'); });
afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ } });

describe('normalizeBranchRef', () => {
  it('strips a leading origin/ so the two spellings compare equal', () => {
    expect(normalizeBranchRef('origin/lane/mechanical-dispatcher')).toBe('lane/mechanical-dispatcher');
    expect(normalizeBranchRef('lane/mechanical-dispatcher')).toBe('lane/mechanical-dispatcher');
  });
  it('never truncates a branch that merely CONTAINS a slash', () => {
    expect(normalizeBranchRef('lane/origin/thing')).toBe('lane/origin/thing');
  });
});

describe('validatePocBranch — doctrine rule 10(c): a POC branch must NAME what it is for and who graduates it', () => {
  it('accepts a complete entry', () => {
    expect(validatePocBranch(ENTRY)).toEqual({ ok: true, errors: [] });
  });
  it('REFUSES an entry with no purpose — an unnamed divergent branch is the failure mode the rule exists for', () => {
    const v = validatePocBranch({ ...ENTRY, purpose: '' });
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/purpose/);
  });
  it('REFUSES an entry with no owner', () => {
    expect(validatePocBranch({ ...ENTRY, owner: undefined }).ok).toBe(false);
  });
  it('REFUSES a non-day dateOpened', () => {
    expect(validatePocBranch({ ...ENTRY, dateOpened: '2026-09-12T00:00:00Z' }).ok).toBe(false);
  });
  it('REFUSES a branch that would graduate into itself', () => {
    const v = validatePocBranch({ ...ENTRY, target: 'lane/demo' });
    expect(v.errors.join(' ')).toMatch(/cannot graduate into itself/);
  });
  it('REFUSES a branch name carrying shell/ref metacharacters — the value reaches `git push` as an argument', () => {
    for (const bad of ['--upload-pack=evil', 'a b', 'lane/..\/x', '/leading', 'trailing/']) {
      expect(validatePocBranch({ ...ENTRY, branch: bad }).ok).toBe(false);
    }
  });
  it('never throws on garbage', () => {
    expect(validatePocBranch(null).ok).toBe(false);
    expect(validatePocBranch('nope').ok).toBe(false);
    expect(validatePocBranch([]).ok).toBe(false);
  });
});

describe('normalizeRegistry — tolerant read, one bad entry never takes the whole registry offline', () => {
  it('drops an invalid entry and REPORTS it, keeping the valid ones', () => {
    const reg = normalizeRegistry({ version: 1, branches: [ENTRY, { branch: 'lane/broken' }] });
    expect(reg.branches.map((b) => b.branch)).toEqual(['lane/demo']);
    expect(reg.dropped[0].branch).toBe('lane/broken');
  });
  it('drops a duplicate branch, first entry wins', () => {
    const reg = normalizeRegistry({ version: 1, branches: [ENTRY, { ...ENTRY, purpose: 'second' }] });
    expect(reg.branches).toHaveLength(1);
    expect(reg.branches[0].purpose).toBe('a demo POC branch');
  });
  it('a missing/garbage file shape yields an EMPTY registry rather than throwing', () => {
    expect(normalizeRegistry(null).branches).toEqual([]);
    expect(normalizeRegistry({}).branches).toEqual([]);
    expect(normalizeRegistry({ branches: 'nope' }).branches).toEqual([]);
  });
  it('defaults `target` to main and `scope` to []', () => {
    const reg = normalizeRegistry({ branches: [{ branch: 'lane/x', purpose: 'p', owner: 'o', dateOpened: '2026-01-01' }] });
    expect(reg.branches[0].target).toBe(DEFAULT_GRADUATION_TARGET);
    expect(reg.branches[0].scope).toEqual([]);
    expect(reg.branches[0].graduationItem).toBeNull();
  });
});

describe('lookups fail CLOSED', () => {
  const reg = normalizeRegistry({ branches: [ENTRY] });
  it('finds a registered branch by either spelling', () => {
    expect(findPocBranch(reg, 'lane/demo').purpose).toBe('a demo POC branch');
    expect(findPocBranch(reg, 'origin/lane/demo').purpose).toBe('a demo POC branch');
    expect(isPocBranch(reg, 'lane/demo')).toBe(true);
  });
  it('returns null for an unknown branch — never a silent fall back to main', () => {
    expect(findPocBranch(reg, 'lane/nope')).toBeNull();
    expect(findPocBranch(reg, '')).toBeNull();
    expect(isPocBranch(reg, 'main')).toBe(false);
  });
});

describe('validateDeliveryTarget — the Fork-3 filing-time predicate', () => {
  const reg = normalizeRegistry({ branches: [ENTRY] });
  it('an ABSENT field is legal and means main (today\'s behaviour, byte-identical)', () => {
    expect(validateDeliveryTarget(reg, undefined)).toEqual({ ok: true, target: 'main', isPoc: false, error: null });
    expect(validateDeliveryTarget(reg, '')).toEqual({ ok: true, target: 'main', isPoc: false, error: null });
  });
  it('an explicit main is legal and is NOT a POC landing', () => {
    expect(validateDeliveryTarget(reg, 'main')).toMatchObject({ ok: true, isPoc: false });
  });
  it('a REGISTERED branch is legal and IS a POC landing', () => {
    expect(validateDeliveryTarget(reg, 'origin/lane/demo')).toMatchObject({ ok: true, target: 'lane/demo', isPoc: true });
  });
  it('an UNREGISTERED branch is refused, and the message names the fix', () => {
    const v = validateDeliveryTarget(reg, 'lane/never-declared');
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/not a registered POC branch/);
    expect(v.error).toMatch(/poc-branches\.json/);
  });
  it('an EMPTY registry refuses every POC target — fail closed', () => {
    expect(validateDeliveryTarget(normalizeRegistry(null), 'lane/demo').ok).toBe(false);
  });
});

describe('upsert / remove — pure, never mutate the input', () => {
  it('adds a new entry without touching the original', () => {
    const before = normalizeRegistry({ branches: [ENTRY] });
    const after = upsertPocBranch(before, { ...ENTRY, branch: 'lane/second' });
    expect(before.branches).toHaveLength(1);
    expect(after.branches.map((b) => b.branch).sort()).toEqual(['lane/demo', 'lane/second']);
  });
  it('REPLACES an existing entry rather than duplicating it', () => {
    const after = upsertPocBranch(normalizeRegistry({ branches: [ENTRY] }), { ...ENTRY, purpose: 'rewritten' });
    expect(after.branches).toHaveLength(1);
    expect(after.branches[0].purpose).toBe('rewritten');
  });
  it('THROWS on an invalid entry — a bad WRITE is the caller\'s bug and must be loud', () => {
    expect(() => upsertPocBranch(normalizeRegistry(null), { branch: 'lane/x' })).toThrow(/invalid entry/);
  });
  it('remove is idempotent', () => {
    const once = removePocBranch(normalizeRegistry({ branches: [ENTRY] }), 'lane/demo');
    expect(once.branches).toEqual([]);
    expect(removePocBranch(once, 'lane/demo').branches).toEqual([]);
  });
});

describe('read / write round-trip against a real file', () => {
  it('writes a registry and reads back exactly what was written', () => {
    const written = writeRegistry({ registry: normalizeRegistry({ branches: [ENTRY] }), path });
    expect(written.branches).toHaveLength(1);
    const back = readRegistry({ path });
    expect(back.branches[0]).toMatchObject({ branch: 'lane/demo', purpose: 'a demo POC branch', owner: '1234', target: 'main', graduationItem: '5678' });
    expect(back.branches[0].scope).toEqual(['we:scripts/demo/']);
    // Pretty-printed with a trailing newline so a registration is a readable diff, not a one-line reflow.
    expect(readFileSync(path, 'utf8').endsWith('}\n')).toBe(true);
  });
  it('a MISSING file reads as an empty registry, not a throw', () => {
    expect(readRegistry({ path: join(dir, 'nope.json') }).branches).toEqual([]);
  });
  it('a MALFORMED file reads as an empty registry, not a throw', () => {
    writeFileSync(path, '{ not json', 'utf8');
    expect(readRegistry({ path }).branches).toEqual([]);
  });
  it('a write of an entry the read path would drop is normalized away first', () => {
    const out = writeRegistry({ registry: { version: 1, branches: [ENTRY, { branch: 'lane/broken' }] }, path });
    expect(out.branches).toHaveLength(1);
    expect(readRegistry({ path }).branches).toHaveLength(1);
  });
});

describe('driftDefaults — the single source that replaced two duplicated constant blocks', () => {
  it('derives branch/target/scope from the first registered entry', () => {
    writeRegistry({ registry: normalizeRegistry({ branches: [ENTRY] }), path });
    expect(driftDefaults({ path })).toEqual({ branch: 'lane/demo', target: 'main', scope: ['we:scripts/demo/'] });
    expect(primaryPocBranch({ path }).branch).toBe('lane/demo');
  });
  it('an empty registry yields a null branch — nothing declared, nothing to sweep', () => {
    expect(driftDefaults({ path: join(dir, 'nope.json') })).toEqual({ branch: null, target: 'main', scope: [] });
    expect(primaryPocBranch({ path: join(dir, 'nope.json') })).toBeNull();
  });
});

describe('the SHIPPED registry', () => {
  it('registers lane/mechanical-dispatcher as the first real POC branch, fully named', () => {
    const reg = readRegistry({ path: POC_REGISTRY_PATH });
    expect(reg.dropped).toEqual([]);
    const entry = findPocBranch(reg, 'lane/mechanical-dispatcher');
    expect(entry).not.toBeNull();
    expect(entry.purpose.length).toBeGreaterThan(20);
    expect(entry.owner).toBe('3383');
    expect(entry.target).toBe('main');
    expect(entry.graduationItem).toBe('3443');
    expect(entry.scope).toContain('we:scripts/conveyor/');
  });
});
