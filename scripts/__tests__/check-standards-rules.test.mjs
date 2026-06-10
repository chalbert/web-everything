/**
 * @file scripts/__tests__/check-standards-rules.test.mjs
 * @description Unit harness for the validator's non-backlog rule families (#256).
 *
 * Extends the #251 pattern (which covered the backlog rules) to the rest of the validator: each
 * family's rule body is a pure function in check-standards-rules.mjs (data in → `{errors, warnings}`
 * out), so its false-positive safety is regression-tested with synthetic fixtures instead of a manual
 * live run. The gnarliest logic — the capability-matrix completeness grid + single-native-substrate
 * invariant, and the Vite-proxy segment-coverage regex — gets the most cases, since a silent
 * false-positive/negative is most likely to hide there. Each family also gets a standing "real data
 * stays clean" guard that runs the exact pure rule the script composes over the live registries.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import {
  checkStatus, validateProtocol, validateIntent, validateCapability, validateCapabilityMatrix,
  validateReportsNotHidden, findCompiledShadows, isSegmentCovered, permalinkSegment,
  validateViteProxyCoverage, deDateReport,
} from '../check-standards-rules.mjs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DATA = join(ROOT, 'src/_data');
const INC = join(ROOT, 'src/_includes');
const SRC = join(ROOT, 'src');
const loadJson = (rel) => JSON.parse(readFileSync(join(DATA, rel), 'utf8'));
const messages = (res) => res.errors.map((e) => e.message);

// ── Shared status enum check (extracted, now composed by blocks/plugs + the entity validators) ──
describe('checkStatus — lifecycle enum + fixable descriptors', () => {
  it('is silent for a canonical status (and for an absent one)', () => {
    expect(checkStatus('Block', 'b1', 'active')).toEqual([]);
    expect(checkStatus('Block', 'b1', undefined)).toEqual([]);
  });
  it('flags a deprecated synonym with a reference-fixable descriptor (canonical target known)', () => {
    const [e] = checkStatus('Block', 'b1', 'stable');
    expect(e.message).toContain('deprecated status "stable" — use canonical "active"');
    expect(e.descriptor).toMatchObject({ kind: 'deprecated-status', fix: 'reference', field: 'status', from: 'stable', to: 'active' });
  });
  it('flags an unknown status with a model-fixable descriptor (target not derivable)', () => {
    const [e] = checkStatus('Intent', 'i1', 'someday');
    expect(e.message).toContain('invalid status "someday"');
    expect(e.descriptor).toMatchObject({ kind: 'invalid-status', fix: 'model', field: 'status' });
  });
});

// ── Protocols (§6b) ────────────────────────────────────────────────────────────
describe('validateProtocol — fields, refs, anchor probe', () => {
  const ctx = {
    // Both projects resolve; only `plateau-app` has a partial file (so the partial-absent case is
    // isolated from the ownedByProject-resolution error).
    projectById: new Map([['plateau-app', { id: 'plateau-app' }], ['no-partial', { id: 'no-partial' }]]),
    intentById: new Map([['droplist', { id: 'droplist' }]]),
    readProjectPartial: (id) => (id === 'plateau-app' ? '<section id="binding">…</section>' : null),
  };
  const base = {
    id: 'p1', name: 'P1', summary: 's', status: 'draft',
    ownedByProject: 'plateau-app', anchor: 'binding',
  };
  const run = (o) => validateProtocol({ ...base, ...o }, ctx);

  it('stays clean for a well-formed protocol', () => {
    expect(run({}).errors).toEqual([]);
  });
  it('errors on a missing required field', () => {
    expect(messages(run({ summary: '' }))).toContainEqual(expect.stringContaining('missing required field "summary"'));
  });
  it('errors on an unresolved ownedByProject', () => {
    expect(messages(run({ ownedByProject: 'ghost', anchor: undefined })))
      .toContainEqual(expect.stringContaining('ownedByProject "ghost" does not resolve'));
  });
  it('errors on an unresolved realizesIntent', () => {
    expect(messages(run({ realizesIntent: 'nope' })))
      .toContainEqual(expect.stringContaining('realizesIntent "nope" does not resolve'));
  });
  it('errors when the project partial is absent', () => {
    const res = run({ ownedByProject: 'no-partial' });
    expect(messages(res)).toContainEqual(expect.stringContaining('expects project partial src/_includes/project-no-partial.njk'));
    // …and the resolution check stays quiet (the project itself resolves) — only the partial is missing.
    expect(messages(res)).not.toContainEqual(expect.stringContaining('does not resolve'));
  });
  it('errors when the anchor is missing from an existing partial', () => {
    expect(messages(run({ anchor: 'ghost-anchor' })))
      .toContainEqual(expect.stringContaining('anchor "ghost-anchor" not found'));
  });
});

// ── Intents (§6c) ────────────────────────────────────────────────────────────
describe('validateIntent — fields, dimensions, requiresCapabilities', () => {
  const ctx = { capabilityIds: new Set(['view-transitions', 'anchor-positioning']) };
  const base = { id: 'i1', name: 'I1', summary: 's', status: 'draft', dimensions: { axis: ['a', 'b'] } };
  const run = (o) => validateIntent({ ...base, ...o }, ctx);

  it('stays clean for a well-formed intent', () => {
    expect(run({}).errors).toEqual([]);
  });
  it('warns (not errors) on no dimensions', () => {
    const res = run({ dimensions: {} });
    // `dimensions: {}` is present-but-empty: required-field passes, the axis nudge fires as a warning.
    expect(res.warnings.map((w) => w.message)).toContainEqual(expect.stringContaining('no dimensions'));
  });
  it('errors on a non-array requiresCapabilities', () => {
    expect(messages(run({ requiresCapabilities: 'view-transitions' })))
      .toContainEqual(expect.stringContaining('requiresCapabilities must be an array'));
  });
  it('errors on an unknown required capability', () => {
    const res = run({ requiresCapabilities: ['view-transitions', 'made-up'] });
    expect(messages(res)).toContainEqual(expect.stringContaining('requires unknown capability "made-up"'));
    expect(res.errors.find((e) => e.message.includes('made-up')).descriptor)
      .toMatchObject({ kind: 'unresolved-ref', field: 'requiresCapabilities', refRegistry: 'capabilities.json' });
  });
  it('accepts a fully-resolving requiresCapabilities list', () => {
    expect(run({ requiresCapabilities: ['view-transitions', 'anchor-positioning'] }).errors).toEqual([]);
  });
});

// ── Capabilities + build-matrix (§6c-bis) — the gnarliest logic ──────────────
describe('validateCapability — vocab shape', () => {
  const base = { id: 'c1', label: 'C1', webFeaturesKey: 'c-1', baseline: '2024', polyfill: 'polyfillable', summary: 's' };
  const run = (o) => validateCapability({ ...base, ...o });

  it('stays clean for a well-formed capability', () => {
    expect(run({}).errors).toEqual([]);
  });
  it('accepts baseline:false (not-yet-Baseline) without a missing-field error', () => {
    expect(run({ baseline: false }).errors).toEqual([]);
  });
  it('errors on a non-string, non-false baseline', () => {
    expect(messages(run({ baseline: 2024 }))).toContainEqual(expect.stringContaining('baseline must be a year string or false'));
  });
  it('errors on an invalid polyfill class', () => {
    expect(messages(run({ polyfill: 'maybe' }))).toContainEqual(expect.stringContaining('invalid polyfill class "maybe"'));
  });
});

describe('validateCapabilityMatrix — completeness grid + native invariant', () => {
  const capabilityIds = new Set(['cap-a', 'cap-b']);
  const hasAdapterDesc = () => true; // descriptions present unless a case overrides
  const fullTiers = { 'cap-a': 'native-ok', 'cap-b': 'polyfill-ok' };
  const impl = (o) => ({ id: 'native', label: 'Native', summary: 's', tiers: fullTiers, native: true, ...o });
  const run = (impls, ctx = {}) => validateCapabilityMatrix(impls, { capabilityIds, hasAdapterDesc, ...ctx });

  it('stays clean for a complete, single-native table', () => {
    expect(run([impl()]).errors).toEqual([]);
  });
  it('errors on an empty table', () => {
    expect(messages(run([]))).toContainEqual(expect.stringContaining('no registered capability adapters'));
  });
  it('errors when a row is missing a tier for some capability (incomplete grid)', () => {
    const res = run([impl({ tiers: { 'cap-a': 'native-ok' } })]);
    expect(messages(res)).toContainEqual(expect.stringContaining('missing a tier for capability "cap-b"'));
  });
  it('errors on a tier value outside the three states', () => {
    expect(messages(run([impl({ tiers: { 'cap-a': 'native-ok', 'cap-b': 'best-effort' } })])))
      .toContainEqual(expect.stringContaining('invalid tier "best-effort"'));
  });
  it('errors on a tier keyed by an unknown capability', () => {
    expect(messages(run([impl({ tiers: { ...fullTiers, 'cap-z': 'native-ok' } })])))
      .toContainEqual(expect.stringContaining('tiers unknown capability "cap-z"'));
  });
  it('errors when more than one impl is marked native (ambiguous substrate)', () => {
    const res = run([impl({ id: 'a' }), impl({ id: 'b' })]);
    expect(messages(res)).toContainEqual(expect.stringContaining('registers 2 native adapters'));
  });
  it('warns (not errors) when no impl is native', () => {
    const res = run([impl({ native: false })]);
    expect(res.errors).toEqual([]);
    expect(res.warnings.map((w) => w.message)).toContainEqual(expect.stringContaining('no native adapter'));
  });
  it('errors on a non-boolean native marker', () => {
    expect(messages(run([impl({ native: 'yes' })]))).toContainEqual(expect.stringContaining('native must be a boolean'));
  });
  it('errors on duplicate impl ids', () => {
    expect(messages(run([impl({ id: 'dup' }), impl({ id: 'dup', native: false })])))
      .toContainEqual(expect.stringContaining('Duplicate id "dup"'));
  });
  it('errors on a missing adapter description partial', () => {
    expect(messages(run([impl()], { hasAdapterDesc: () => false })))
      .toContainEqual(expect.stringContaining('has no src/_includes/capability-adapter-descriptions/native.njk'));
  });
});

// ── Reports-not-hidden (§6e) ────────────────────────────────────────────────
describe('validateReportsNotHidden — de-date + visibility', () => {
  it('de-dates a report filename to its slug', () => {
    expect(deDateReport('2026-06-06-front-end-platform-book.md')).toBe('front-end-platform-book');
  });
  it('errors on a report with no research topic and no backlog ref', () => {
    const res = validateReportsNotHidden(['2026-01-01-orphan.md'], { researchIds: new Set(), backlogReportRefs: new Set() });
    expect(messages(res)).toContainEqual(expect.stringContaining('Report "reports/2026-01-01-orphan.md" is hidden'));
  });
  it('is clean when a research topic covers the de-dated slug', () => {
    const res = validateReportsNotHidden(['2026-01-01-known.md'], { researchIds: new Set(['known']), backlogReportRefs: new Set() });
    expect(res.errors).toEqual([]);
  });
  it('is clean when a backlog item references the full filename', () => {
    const res = validateReportsNotHidden(['2026-01-01-known.md'], { researchIds: new Set(), backlogReportRefs: new Set(['2026-01-01-known.md']) });
    expect(res.errors).toEqual([]);
  });
});

// ── Compiled-artifact shadow (§8) ──────────────────────────────────────────
describe('findCompiledShadows — .js/.d.ts shadowing a TS source', () => {
  it('flags a .js next to its .tsx source', () => {
    const res = findCompiledShadows(['blocks/foo.tsx', 'blocks/foo.js']);
    expect(messages(res)).toContainEqual(expect.stringContaining('Compiled artifact "blocks/foo.js" shadows'));
  });
  it('flags a .d.ts next to its .ts source', () => {
    expect(messages(findCompiledShadows(['plugs/bar.ts', 'plugs/bar.d.ts'])))
      .toContainEqual(expect.stringContaining('plugs/bar.d.ts'));
  });
  it('is clean for a standalone .js with no TS sibling (hand-authored)', () => {
    expect(findCompiledShadows(['demos/standalone.js']).errors).toEqual([]);
  });
  it('is clean for a lone .ts source', () => {
    expect(findCompiledShadows(['blocks/only.ts']).errors).toEqual([]);
  });
});

// ── Vite proxy coverage (§9) — the bounded-match regex ─────────────────────
describe('isSegmentCovered — bounded segment match', () => {
  const keys = '^/(intents|protocols|capabilities)/ /js/ /backlog/';
  it('matches a segment inside an alternation', () => {
    expect(isSegmentCovered('protocols', keys)).toBe(true);
  });
  it('matches a segment delimited by slashes', () => {
    expect(isSegmentCovered('js', keys)).toBe(true);
  });
  it('does NOT match a stray substring of a longer word', () => {
    // The `js` inside a hypothetical `/project-lifecycle/` key must not count as covering `/js/`.
    expect(isSegmentCovered('js', '^/(project-lifecycle)/')).toBe(false);
  });
  it('does NOT match an uncovered segment', () => {
    expect(isSegmentCovered('demos', keys)).toBe(false);
  });
  it('treats a regex-special segment literally', () => {
    expect(isSegmentCovered('a.b', '^/(a.b)/')).toBe(true);
    expect(isSegmentCovered('a.b', '^/(axb)/')).toBe(false);
  });
});

describe('permalinkSegment — first URL segment from an njk body', () => {
  it('reads an explicit permalink front-matter', () => {
    expect(permalinkSegment('---\npermalink: "/capabilities/index.html"\n---', 'caps.njk')).toBe('capabilities');
  });
  it('falls back to the 11ty default from the filename', () => {
    expect(permalinkSegment('<h1>no front matter</h1>', 'protocols.njk')).toBe('protocols');
  });
  it('returns null for a fully-templated first segment', () => {
    expect(permalinkSegment('---\npermalink: "/{{ x }}/index.html"\n---', 'dyn.njk')).toBeNull();
  });
});

describe('validateViteProxyCoverage — uncovered catalog routes', () => {
  it('errors on a catalog segment the proxy does not forward', () => {
    const res = validateViteProxyCoverage([{ seg: 'newsurface', file: 'newsurface.njk' }], '^/(intents|protocols)/');
    expect(messages(res)).toContainEqual(expect.stringContaining('missing catalog route "/newsurface/"'));
  });
  it('is clean when every segment is covered', () => {
    expect(validateViteProxyCoverage([{ seg: 'intents', file: 'intents.njk' }], '^/(intents|protocols)/').errors).toEqual([]);
  });
});

// ── False-positive safety over the REAL data (the standing regression guards) ──
// Each guard runs the exact pure rule the script composes over the live registries/filesystem and
// asserts zero errors, so a future rule tightening that starts erroring on legitimate real data fails
// here instead of only surfacing on a manual `npm run check:standards` run.
describe('real data stays clean (per family)', () => {
  const blocks = loadJson('blocks.json');
  const intents = loadJson('intents.json');
  const protocols = loadJson('protocols.json');
  const projects = loadJson('projects.json');
  const capabilities = loadJson('capabilities.json');
  const capabilityMatrix = JSON.parse(readFileSync(join(DATA, 'capabilityMatrix.json'), 'utf8'));
  const research = loadJson('researchTopics.json');
  const loadBacklog = require(join(ROOT, 'src/_data/backlog.js'));
  const backlog = typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog;

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const intentById = new Map(intents.map((i) => [i.id, i]));
  const capabilityIds = new Set(capabilities.map((c) => c.id).filter(Boolean));
  const readProjectPartial = (id) => {
    const p = join(INC, `project-${id}.njk`);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  };
  const hasDesc = (folder, id) => existsSync(join(INC, folder, `${id}.njk`));

  const collect = (items, fn) => items.flatMap((x) => fn(x).errors.map((e) => ({ id: x.id, msg: e.message })));

  it('protocols', () => {
    expect(collect(protocols, (p) => validateProtocol(p, { projectById, intentById, readProjectPartial }))).toEqual([]);
  });
  it('intents', () => {
    expect(collect(intents, (i) => validateIntent(i, { capabilityIds }))).toEqual([]);
  });
  it('capabilities', () => {
    expect(collect(capabilities, (c) => validateCapability(c))).toEqual([]);
  });
  it('capability matrix', () => {
    const { errors } = validateCapabilityMatrix(capabilityMatrix.impls || [], {
      capabilityIds, hasAdapterDesc: (id) => hasDesc('capability-adapter-descriptions', id),
    });
    expect(errors.map((e) => e.message)).toEqual([]);
  });
  it('reports-not-hidden', () => {
    const REPORTS = join(ROOT, 'reports');
    const reportFiles = existsSync(REPORTS) ? readdirSync(REPORTS).filter((f) => f.endsWith('.md')) : [];
    const researchIds = new Set(research.map((r) => r.id).filter(Boolean));
    const backlogReportRefs = new Set(backlog.map((b) => b.relatedReport).filter(Boolean).map((p) => p.replace(/^reports\//, '')));
    const { errors } = validateReportsNotHidden(reportFiles, { researchIds, backlogReportRefs });
    expect(errors.map((e) => e.message)).toEqual([]);
  });
  it('vite proxy coverage', () => {
    const viteCfg = readFileSync(join(ROOT, 'vite.config.mts'), 'utf8');
    const proxyKeys = [...viteCfg.matchAll(/^\s*(['"])(\^?\/[^'"]*)\1\s*:\s*\{/gm)].map((m) => m[2]).join(' ');
    const needed = new Map();
    for (const f of readdirSync(SRC).filter((n) => n.endsWith('.njk'))) {
      if (f === 'index.njk') continue;
      const seg = permalinkSegment(readFileSync(join(SRC, f), 'utf8'), f);
      if (seg && !needed.has(seg)) needed.set(seg, f);
    }
    const segments = [...needed].map(([seg, file]) => ({ seg, file }));
    const { errors } = validateViteProxyCoverage(segments, proxyKeys);
    expect(errors.map((e) => e.message)).toEqual([]);
  });
  // (Compiled-artifact shadow has no per-family real-data guard here — its live filesystem walk is the
  // production check; findCompiledShadows is exercised by the synthetic cases above. The live
  // `npm run check:standards` remains the production gate over the real tree.)
});
