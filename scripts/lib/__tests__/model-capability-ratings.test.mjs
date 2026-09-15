import { describe, it, expect } from 'vitest';
import {
  CAPABILITY_REGISTRY_PATH, CAPABILITY_REGISTRY_VERSION, CAPABILITY_CATEGORIES,
  identityKey, validateCapabilityEntry, normalizeRegistry, findEntry, ratingsFor,
  isUsableForExploration, readRegistry, writeRegistry, liveRatingsFor,
} from '../model-capability-ratings.mjs';

const baseEntry = () => ({
  provider: 'example-provider', model: 'example-model', verified: false,
  source: 'unverified external report, needs confirmation', asOf: '2026-01-01', lastUpdated: '2026-01-02',
  categories: Object.fromEntries(CAPABILITY_CATEGORIES.map((category) => [category, {
    value: null, unit: category === 'contextIngestion' ? 'tokens' : '0-100 index', note: '',
  }])),
});

function memIo(initial = { version: 1, entries: [] }) {
  const files = new Map([['memory.json', JSON.stringify(initial)]]);
  return {
    path: 'memory.json',
    read: (path) => files.get(path),
    write: (path, text) => { files.set(path, text); },
  };
}

describe('validateCapabilityEntry', () => {
  it('accepts explicit unverified provenance, null values, and finite numeric ratings', () => {
    const entry = baseEntry();
    expect(validateCapabilityEntry(entry)).toEqual({ ok: true, errors: [] });
    entry.verified = true;
    entry.categories.cliToolUse.value = 0;
    expect(validateCapabilityEntry(entry).ok).toBe(true);
  });

  it.each(['provider', 'model', 'verified', 'source', 'asOf', 'lastUpdated', 'categories'])('requires %s', (field) => {
    const entry = baseEntry(); delete entry[field];
    expect(validateCapabilityEntry(entry).ok).toBe(false);
  });

  it.each([
    ['source', '  '], ['verified', 'true'], ['verified', 1],
    ['asOf', '2026-1-01'], ['asOf', 'yesterday'], ['asOf', 20260101],
    ['lastUpdated', '2026-01-01T00:00:00Z'], ['lastUpdated', null],
    ['categories', []], ['categories', null],
  ])('rejects malformed %s (%j)', (field, value) => {
    expect(validateCapabilityEntry({ ...baseEntry(), [field]: value }).ok).toBe(false);
  });

  it.each(CAPABILITY_CATEGORIES)('requires category %s', (category) => {
    const entry = baseEntry(); delete entry.categories[category];
    expect(validateCapabilityEntry(entry).ok).toBe(false);
  });

  it.each([null, [], 'rating', {}, { value: 1, unit: '', note: '' },
    { value: 1, unit: 'index', note: null }, { value: '90', unit: 'index', note: '' },
    { value: NaN, unit: 'index', note: '' }, { value: Infinity, unit: 'index', note: '' },
  ])('rejects malformed category shape %j', (rating) => {
    const entry = baseEntry(); entry.categories.cliToolUse = rating;
    expect(validateCapabilityEntry(entry).ok).toBe(false);
  });

  it.each([null, undefined, [], 'garbage', 3])('never throws on malformed input %j', (entry) => {
    expect(validateCapabilityEntry(entry)).toEqual({ ok: false, errors: ['entry is not an object'] });
  });
});

describe('normalizeRegistry — PURE, documentation is never data', () => {
  it.each([null, undefined, {}, 'garbage', { entries: {} }])('degrades malformed input to EMPTY (%j)', (parsed) => {
    expect(normalizeRegistry(parsed)).toEqual({ version: CAPABILITY_REGISTRY_VERSION, entries: [], dropped: [] });
  });

  it('keeps valid entries and reports invalid/duplicate entries, first valid identity wins', () => {
    const entry = baseEntry();
    const registry = normalizeRegistry({ entries: [null, { provider: 'broken' }, entry, { ...entry, verified: true }] });
    expect(registry.entries).toEqual([entry]);
    expect(registry.dropped).toHaveLength(3);
    expect(registry.dropped[2].errors[0]).toMatch(/duplicate identity/);
  });

  it('drops malformed identity objects without invoking their string conversion', () => {
    const registry = normalizeRegistry({ entries: [{ ...baseEntry(), provider: { toString: null } }, baseEntry()] });
    expect(registry.entries).toEqual([baseEntry()]);
    expect(registry.dropped).toHaveLength(1);
  });

  it('never even reads exampleEntry, whether malformed or a fully valid verified entry', () => {
    const parsed = { entries: [] };
    Object.defineProperty(parsed, 'exampleEntry', { get: () => { throw new Error('documentation accessed'); } });
    expect(normalizeRegistry(parsed).entries).toEqual([]);
    const registry = normalizeRegistry({ entries: [], exampleEntry: { ...baseEntry(), verified: true } });
    expect(registry).toEqual({ version: 1, entries: [], dropped: [] });
    expect(ratingsFor(registry, baseEntry())).toBeNull();
  });

  it('copies and freezes entries, categories, and category values', () => {
    const entry = baseEntry();
    const registry = normalizeRegistry({ entries: [entry] });
    for (const value of [CAPABILITY_CATEGORIES, registry, registry.entries, registry.dropped,
      registry.entries[0], registry.entries[0].categories, registry.entries[0].categories.cliToolUse]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    entry.categories.cliToolUse.value = 88;
    expect(registry.entries[0].categories.cliToolUse.value).toBeNull();
  });
});

describe('identity and verification — PURE', () => {
  it('matches provider case/whitespace but preserves model case, just like probation', () => {
    const registry = normalizeRegistry({ entries: [baseEntry()] });
    const identity = { provider: ' EXAMPLE-PROVIDER ', model: ' example-model ' };
    expect(identityKey(identity)).toBe(identityKey(baseEntry()));
    expect(findEntry(registry, identity)).toBe(registry.entries[0]);
    expect(ratingsFor(registry, identity)).toBe(registry.entries[0]);
    expect(ratingsFor(registry, { ...identity, model: 'EXAMPLE-MODEL' })).toBeNull();
    expect(findEntry(null, identity)).toBeNull();
    expect(identityKey()).toBe('::');
  });

  it('allows exploration only for explicit verified true, never truthy or absent verification', () => {
    for (const entry of [null, undefined, {}, baseEntry(), { ...baseEntry(), verified: 'true' }]) {
      expect(isUsableForExploration(entry)).toBe(false);
    }
    expect(isUsableForExploration({ ...baseEntry(), verified: true })).toBe(true);
  });
});

describe('readRegistry/writeRegistry — injected IO only', () => {
  it('round-trips through injected path/read/write and retains provenance', () => {
    const io = memIo();
    writeRegistry({ version: 1, entries: [baseEntry()] }, io);
    expect(readRegistry(io).entries).toEqual([baseEntry()]);
    expect(liveRatingsFor(baseEntry(), io)).toEqual(baseEntry());
    expect(io.read(io.path).endsWith('\n')).toBe(true);
    expect(JSON.parse(io.read(io.path))).toEqual({ version: 1, entries: [baseEntry()] });
    expect(CAPABILITY_REGISTRY_PATH).toMatch(/model-capability-ratings\.json$/);
  });

  it('degrades unreadable and malformed files to empty', () => {
    expect(readRegistry({ read: () => { throw new Error('missing'); } }).entries).toEqual([]);
    expect(readRegistry({ read: () => 'not json' }).entries).toEqual([]);
    expect(liveRatingsFor(baseEntry(), { read: () => 'null' })).toBeNull();
  });

  it('writes defaults and excludes diagnostic/documentation keys', () => {
    const io = memIo();
    writeRegistry({ dropped: ['bad'], exampleEntry: baseEntry() }, io);
    expect(JSON.parse(io.read(io.path))).toEqual({ version: 1, entries: [] });
  });
});
