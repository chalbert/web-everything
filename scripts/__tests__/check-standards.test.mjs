/**
 * @file scripts/__tests__/check-standards.test.mjs
 * @description Unit harness for the validator's backlog rules (#251).
 *
 * `check-standards.mjs` is a top-to-bottom live script, so before this each new rule's correctness —
 * false-positive safety especially — was a manual, un-regressed check (#247 fell back to a throwaway
 * negative-path script + a hand dry-run). These tests exercise the *exact* pure rule the script
 * composes (`validateBacklogItem` from check-standards-rules.mjs) against synthetic fixtures, plus a
 * standing false-positive guard that runs it over the real backlog + registries so a future rule
 * tightening can't silently start erroring on legitimate free-form data.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { buildGraduatedKinds, validateBacklogItem } from '../check-standards-rules.mjs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = join(ROOT, 'src/_data');
const loadJson = (rel) => JSON.parse(readFileSync(join(DATA, rel), 'utf8'));

// ── Synthetic fixtures ────────────────────────────────────────────────────────
// A compact registry so resolution is deterministic: `intent:droplist` / `intent:motion` and
// `block:data-grid` resolve; everything else does not.
const FIXTURE_KINDS = buildGraduatedKinds({
  intents: [{ id: 'droplist' }, { id: 'motion' }],
  blocks: [{ id: 'data-grid' }],
});
const FIXTURE_CTX = {
  projectById: new Map([['plateau-app', { id: 'plateau-app' }]]),
  graduatedKinds: FIXTURE_KINDS,
  knownNums: new Set(['100']),
  reportExists: (rel) => rel === 'reports/real.md',
};
// A minimally-valid item; spread + override per case.
const baseItem = {
  id: '999-fixture',
  num: '999',
  title: 'Fixture item',
  type: 'idea',
  status: 'open',
  summary: 'A synthetic backlog item for the rule harness.',
  dateOpened: '2026-06-09',
  workItem: 'task',
};
const run = (overrides) => validateBacklogItem({ ...baseItem, ...overrides }, FIXTURE_CTX);
const messages = (res) => res.errors.map((e) => e.message);

describe('validateBacklogItem — graduatedTo resolution (#247)', () => {
  it('errors on an unknown kind (typo)', () => {
    const res = run({ status: 'resolved', dateResolved: '2026-06-09', graduatedTo: 'intnet:droplist' });
    expect(messages(res)).toContainEqual(expect.stringContaining('uses unknown kind "intnet"'));
  });

  it('errors on an unresolved slug within a known kind', () => {
    const res = run({ status: 'resolved', dateResolved: '2026-06-09', graduatedTo: 'intent:droplsit' });
    expect(messages(res)).toContainEqual(expect.stringContaining('graduatedTo "intent:droplsit" does not resolve'));
    // It is the agent-targetable unresolved-ref descriptor (fed to the #196 fixer), not a bare message.
    const e = res.errors.find((x) => x.message.includes('intent:droplsit'));
    expect(e.descriptor).toMatchObject({ kind: 'unresolved-ref', field: 'graduatedTo', refRegistry: 'intents.json' });
  });

  it('accepts a resolving compact ref', () => {
    const res = run({ status: 'resolved', dateResolved: '2026-06-09', graduatedTo: 'intent:motion' });
    expect(res.errors).toEqual([]);
  });

  it('accepts the `none` sentinel and free-form prose without resolving them', () => {
    for (const graduatedTo of ['none', 'enhanced the existing validation engine', '/intents/motion/', 'reports/x.md']) {
      const res = run({ status: 'resolved', dateResolved: '2026-06-09', graduatedTo });
      expect(res.errors, `graduatedTo: ${graduatedTo}`).toEqual([]);
    }
  });

  it('nudges a resolved idea that records no graduatedTo (warning, not error)', () => {
    const res = run({ status: 'resolved', dateResolved: '2026-06-09' });
    expect(res.errors).toEqual([]);
    expect(res.warnings.map((w) => w.message)).toContainEqual(expect.stringContaining('no graduatedTo'));
  });
});

describe('validateBacklogItem — sibling reference + sizing rules', () => {
  it('errors on an unresolved relatedProject', () => {
    const res = run({ relatedProject: 'nonexistent-project' });
    expect(messages(res)).toContainEqual(expect.stringContaining('relatedProject "nonexistent-project" does not resolve'));
  });

  it('errors on a crossRef missing its label', () => {
    const res = run({ crossRef: { url: '/somewhere/' } });
    expect(messages(res)).toContainEqual(expect.stringContaining('crossRef must have both "url" and "label"'));
  });

  it('errors on a non-Fibonacci size', () => {
    const res = run({ workItem: 'story', size: 4 });
    expect(messages(res)).toContainEqual(expect.stringContaining('non-Fibonacci size "4"'));
  });

  it('errors on an unresolved parent', () => {
    const res = run({ parent: '777' });
    expect(messages(res)).toContainEqual(expect.stringContaining('parent "#777" does not resolve'));
  });

  it('stays clean for a well-formed item', () => {
    expect(run({}).errors).toEqual([]);
  });
});

// ── False-positive safety over the REAL data (the #247 dry-run, now a standing test) ──
describe('validateBacklogItem — real backlog stays clean', () => {
  // Load the live registries exactly as check-standards.mjs does, build the same resolution table,
  // and assert the pure rule emits zero errors over every real item. This is the regression guard:
  // a future rule tightening that starts erroring on a legitimate free-form graduatedTo / crossRef /
  // size in the real backlog fails here instead of only surfacing on a manual live run.
  const blocks = loadJson('blocks.json');
  const intents = loadJson('intents.json');
  const protocols = loadJson('protocols.json');
  const projects = loadJson('projects.json');
  const plugs = loadJson('plugs.json');
  const adapters = loadJson('adapters.json');
  const demos = loadJson('demos.json');
  const capabilityIds = new Set(loadJson('capabilities.json').map((c) => c.id));
  const loadBacklog = require(join(ROOT, 'src/_data/backlog.js'));
  const backlog = typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog;

  const ctx = {
    projectById: new Map(projects.map((p) => [p.id, p])),
    graduatedKinds: buildGraduatedKinds({ blocks, intents, protocols, projects, plugs, capabilityIds, adapters, demos }),
    knownNums: new Set(backlog.map((b) => b.num).filter(Boolean)),
    reportExists: (rel) => existsSync(join(ROOT, rel)),
  };

  it('emits zero errors for every real backlog item', () => {
    const offenders = [];
    for (const item of backlog) {
      const { errors } = validateBacklogItem(item, ctx);
      if (errors.length) offenders.push({ id: item.id, errors: errors.map((e) => e.message) });
    }
    expect(offenders).toEqual([]);
  });
});
