/**
 * @file scripts/__tests__/fidelity-contract.test.mjs
 * @description Pins the UI-fidelity contract SHAPE validator (#2805) — the WE-side, deterministic
 * well-formedness check for the `fidelity:` frontmatter block. Fixture-tested so the pure rule doesn't
 * depend on the live backlog tree, and asserted BOTH ways: a well-formed contract is accepted; an
 * incomplete one, a fixture-route one, and a mandatory-seed-omitting one are each rejected. The validator
 * NEVER boots the product — it only reads the parsed block.
 */
import { describe, it, expect } from 'vitest';
import { validateFidelityContract } from '../lib/fidelity-contract.mjs';

const msgs = (r) => r.errors.map((e) => e.message);

// A canonical well-formed contract (the design-reference example, placeholder paths).
const wellFormed = () => ({
  route: 'plateau:/console-board',
  host: 'plateau:src/app-shell',
  assembledOwner: true,
  webcases: {
    file: 'plateau:src/backlog-view/card-taxonomy.webcases',
    required: ['UC-A5', 'UC-A6', 'UC-B5'],
  },
  seeds: {
    empty: 'plateau:tests/fixtures/board-empty',
    populated: 'plateau:tests/fixtures/board-populated',
    overflow: 'plateau:tests/fixtures/board-overflow',
  },
  themes: ['light', 'dark'],
  target: {
    registryId: 'mock:console-board@v3',
    contentHash: 'sha256:abc123',
    authoredInCommit: 'deadbeef',
  },
  baseline: {
    template: 'plateau:tests/visual/baselines/console-board/{seed}.{theme}',
  },
});

describe('validateFidelityContract — ACCEPTS a well-formed contract', () => {
  it('accepts the canonical block with zero errors', () => {
    const r = validateFidelityContract(wellFormed());
    expect(r.errors).toHaveLength(0);
  });

  it('accepts it without the OPTIONAL assembledOwner / populated seed', () => {
    const c = wellFormed();
    delete c.assembledOwner;
    delete c.seeds.populated;
    expect(validateFidelityContract(c).errors).toHaveLength(0);
  });
});

describe('validateFidelityContract — REJECTS an INCOMPLETE contract', () => {
  it('rejects an empty object (every required field missing)', () => {
    const r = validateFidelityContract({});
    expect(r.errors.length).toBeGreaterThan(0);
    expect(msgs(r).join('\n')).toMatch(/route/);
    expect(msgs(r).join('\n')).toMatch(/host/);
    expect(msgs(r).join('\n')).toMatch(/target/);
  });

  it('rejects a missing/absent contract', () => {
    expect(validateFidelityContract(undefined).errors.length).toBeGreaterThan(0);
    expect(validateFidelityContract(null).errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing target block', () => {
    const c = wellFormed();
    delete c.target;
    expect(msgs(validateFidelityContract(c)).join('\n')).toMatch(/target/);
  });

  it('rejects an incomplete target (missing contentHash)', () => {
    const c = wellFormed();
    delete c.target.contentHash;
    expect(msgs(validateFidelityContract(c)).join('\n')).toMatch(/contentHash/);
  });

  it('rejects an empty webcases.required set', () => {
    const c = wellFormed();
    c.webcases.required = [];
    expect(msgs(validateFidelityContract(c)).join('\n')).toMatch(/required/);
  });

  it('rejects a missing baseline template', () => {
    const c = wellFormed();
    delete c.baseline.template;
    expect(msgs(validateFidelityContract(c)).join('\n')).toMatch(/template/);
  });

  it('rejects themes missing dark', () => {
    const c = wellFormed();
    c.themes = ['light'];
    expect(msgs(validateFidelityContract(c)).join('\n')).toMatch(/dark/);
  });
});

describe('validateFidelityContract — REJECTS a FIXTURE route (not the assembled real route)', () => {
  it('rejects a `?demo=` fixture route', () => {
    const c = wellFormed();
    c.route = 'plateau:/console-board?demo=1';
    expect(msgs(validateFidelityContract(c)).join('\n')).toMatch(/FIXTURE/);
  });

  it('rejects a route carrying any query string', () => {
    const c = wellFormed();
    c.route = 'plateau:/console-board?fixture';
    expect(msgs(validateFidelityContract(c)).join('\n')).toMatch(/FIXTURE/);
  });

  it('rejects a locus pointing at a leaf source file rather than a served route', () => {
    const c = wellFormed();
    c.route = 'plateau:src/backlog-view/board.ts';
    expect(msgs(validateFidelityContract(c)).join('\n')).toMatch(/served route/);
  });
});

describe('validateFidelityContract — REJECTS omitting a MANDATORY seed', () => {
  it('rejects a contract with no empty seed', () => {
    const c = wellFormed();
    delete c.seeds.empty;
    expect(msgs(validateFidelityContract(c)).join('\n')).toMatch(/empty/);
  });

  it('rejects a contract with no overflow seed', () => {
    const c = wellFormed();
    delete c.seeds.overflow;
    expect(msgs(validateFidelityContract(c)).join('\n')).toMatch(/overflow/);
  });

  it('rejects a missing seeds block entirely', () => {
    const c = wellFormed();
    delete c.seeds;
    const out = msgs(validateFidelityContract(c)).join('\n');
    expect(out).toMatch(/seeds/);
  });
});

describe('validateFidelityContract — misc shape guards', () => {
  it('rejects a non-object contract', () => {
    expect(validateFidelityContract('nope').errors.length).toBeGreaterThan(0);
    expect(validateFidelityContract(['a']).errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-boolean assembledOwner', () => {
    const c = wellFormed();
    c.assembledOwner = 'yes';
    expect(msgs(validateFidelityContract(c)).join('\n')).toMatch(/assembledOwner/);
  });

  it('prefixes messages with the item id when given', () => {
    const r = validateFidelityContract({}, { id: '2805-demo' });
    expect(msgs(r)[0]).toMatch(/2805-demo/);
  });
});
