// Tests for the keyed design-ref taxonomy + the #394 re-key (backlog #509).
//
// Locks the migration invariants the ruling ratified (forks B/C/B/A): a seeded taxonomy.json with both
// vocabularies, every target + sidecar carrying `productRegister` (never the retired `designRegister`)
// and a present `visualStyle`, and every keyed value being registered in the vocab. These are pure
// data assertions over the committed corpus — no capture, no network.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'design-refs');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const taxonomy = read(join(ROOT, 'taxonomy.json'));
const targets = read(join(ROOT, 'targets.json')).targets;
const productRegisters = new Set(taxonomy.productRegister.values.map((v) => v.id));
const categories = new Set(taxonomy.category.values.map((v) => v.id));

const sidecars = readdirSync(join(ROOT, 'items'))
  .map((id) => join(ROOT, 'items', id, 'meta.json'))
  .filter(existsSync)
  .map(read);

describe('taxonomy.json — seeded vocab (#394 fork 2 = C)', () => {
  it('seeds the five product registers and the coarse category domains', () => {
    expect(productRegisters).toEqual(
      new Set(['enterprise', 'modern-saas', 'consumer', 'creative-tool', 'utilitarian']),
    );
    // Fork 4 = A: at minimum the ten coarse domains from the ruling.
    for (const c of [
      'developer-tools',
      'whiteboard-diagramming',
      'code-playground',
      'consumer-social',
      'commerce-admin',
      'finance-banking',
      'productivity-collaboration',
      'communication-inbox',
      'content-media',
      'analytics',
    ])
      expect(categories.has(c)).toBe(true);
  });
});

describe('re-key (#394 fork 1 = B) — targets + sidecars', () => {
  it('every target is re-keyed: productRegister present, designRegister gone, visualStyle present', () => {
    for (const t of targets) {
      expect(t.designRegister, `${t.url} still has designRegister`).toBeUndefined();
      expect(productRegisters.has(t.productRegister), `${t.url} productRegister "${t.productRegister}"`).toBe(true);
      expect('visualStyle' in t, `${t.url} missing visualStyle`).toBe(true);
      expect(categories.has(t.category), `${t.url} category "${t.category}"`).toBe(true);
    }
  });

  it('every existing sidecar is re-keyed with visualStyle left empty (vision fills it)', () => {
    expect(sidecars.length).toBeGreaterThanOrEqual(16);
    for (const m of sidecars) {
      expect(m.designRegister, `${m.id} still has designRegister`).toBeUndefined();
      expect(productRegisters.has(m.productRegister), `${m.id} productRegister "${m.productRegister}"`).toBe(true);
      expect(m.visualStyle, `${m.id} visualStyle should be null at collect time`).toBeNull();
      expect(categories.has(m.category), `${m.id} category "${m.category}"`).toBe(true);
    }
  });
});

describe('scarcity grow-targets (#394 fork 3 = B)', () => {
  it('appends thin-cell worklist entries across the under-covered categories', () => {
    const thinCats = [
      'consumer-social',
      'commerce-admin',
      'finance-banking',
      'productivity-collaboration',
      'content-media',
    ];
    for (const c of thinCats)
      expect(targets.some((t) => t.category === c), `no grow-target for ${c}`).toBe(true);
    expect(targets.length).toBeGreaterThanOrEqual(30); // 16 seeded + ≥14 grow-targets (~30–50 first run)
  });

  it('every target url is unique (collect is idempotent by sourceUrl)', () => {
    const urls = targets.map((t) => t.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
