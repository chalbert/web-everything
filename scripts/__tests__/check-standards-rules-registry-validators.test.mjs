/**
 * @file scripts/__tests__/check-standards-rules-registry-validators.test.mjs
 * @description Split from check-standards-rules.test.mjs (#3383 test-speedup): the lifecycle/tier/
 * protocol/design-system/intent/capability registry validators, plus the reports-not-hidden, compiled-
 * shadow, vite-proxy-coverage and frontmatter-quote lint rules, and the standing "real data stays clean"
 * guard that exercises all of them over the live registries. Pure file-move — same tests, smaller file.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadBlocks } from '../lib/blocks-loader.cjs';
import { loadIntents } from '../lib/intents-loader.cjs';
import { loadResearch } from '../lib/research-loader.cjs';
import { loadProtocols } from '../lib/protocols-loader.cjs';
import { loadDataRegistry } from '../lib/registry-loader.cjs';
import {
  checkStatus, validateProjectTier, PROJECT_TIERS, advisoryTierCrossCheck, validateProtocol, validateDesignSystem, validateIntent, validateCapability, validateCapabilityMatrix,
  validateReportsNotHidden, findCompiledShadows, isSegmentCovered, permalinkSegment,
  validateViteProxyCoverage, deDateReport,
  findUnquotedColonScalars,
} from '../check-standards-rules.mjs';
import { require, ROOT, SRC } from './fixtures/check-standards-rules-fixtures.mjs';

const DATA = join(ROOT, 'src/_data');
const INC = join(ROOT, 'src/_includes');
const messages = (res) => res.errors.map((e) => e.message);

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

// ── Portfolio project tier — the named-consumer evidence bar (#2088 → #2132) ────────────────────
// Guards the enum-validated `tier` + required-`tierEvidence`-per-non-exploratory rule codified at
// docs/agent/platform-decisions.md#portfolio-project-tiering. Exercises the pure validator over
// SYNTHETIC projects so the rule is pinned independently of the live 46-project catalog.
describe('validateProjectTier — enum + required tierEvidence for non-exploratory', () => {
  it('the tier vocabulary is exactly core | contextual | exploratory', () => {
    expect([...PROJECT_TIERS].sort()).toEqual(['contextual', 'core', 'exploratory']);
  });
  it('is silent for a valid non-exploratory tier WITH tierEvidence', () => {
    expect(validateProjectTier('webvalidation', 'core', 'benchmarkCoverage covers form-validation-flow')).toEqual([]);
    expect(validateProjectTier('webreliability', 'contextual', 'FUI ships reliability/provider.ts')).toEqual([]);
  });
  it('is silent for exploratory with NO tierEvidence (only non-exploratory must name a consumer)', () => {
    expect(validateProjectTier('webprocess', 'exploratory', undefined)).toEqual([]);
    expect(validateProjectTier('webprocess', 'exploratory', '')).toEqual([]);
  });
  it('flags a missing/invalid tier with a model-fixable descriptor (intended tier is a judgment)', () => {
    for (const bad of [undefined, '', 'deferred', 'Core', 'tier1']) {
      const [e] = validateProjectTier('webx', bad, undefined);
      expect(e.message).toMatch(/missing\/invalid tier/);
      expect(e.descriptor).toMatchObject({ kind: 'invalid-tier', fix: 'model', entity: 'Project', field: 'tier' });
    }
  });
  it('does NOT also demand evidence once the tier is already invalid (single error)', () => {
    expect(validateProjectTier('webx', 'bogus', undefined)).toHaveLength(1);
  });
  it('flags a non-exploratory tier with empty/whitespace tierEvidence — the falsifiability hook', () => {
    for (const tier of ['core', 'contextual']) {
      for (const ev of [undefined, '', '   ', 42, null]) {
        const [e] = validateProjectTier('webx', tier, ev);
        expect(e.message).toMatch(/no non-empty tierEvidence/);
        expect(e.descriptor).toMatchObject({ kind: 'missing-tier-evidence', fix: 'model', field: 'tierEvidence' });
      }
    }
  });
  it('the live 46-project catalog is fully stamped and clean against this rule', () => {
    const ids = readdirSync(join(DATA, 'projects')).filter((f) => f.endsWith('.json'));
    expect(ids.length).toBe(46);
    const problems = [];
    for (const f of ids) {
      const p = JSON.parse(readFileSync(join(DATA, 'projects', f), 'utf8'));
      for (const e of validateProjectTier(p.id, p.tier, p.tierEvidence)) problems.push(e.message);
    }
    expect(problems).toEqual([]);
  });
});

// ── Derived advisory tier cross-check (#2135) — the declared domain→project evidence join ──
describe('advisoryTierCrossCheck — warn-only domain→project demand join (#2135)', () => {
  const tiers = new Map([
    ['webinjectors', 'exploratory'],
    ['webvalidation', 'core'],
    ['webaudit', 'contextual'],
  ]);
  it('returns NO errors — it is advisory only, never a gate (never owns the tier)', () => {
    const { errors } = advisoryTierCrossCheck(
      [{ project: 'webinjectors', capability: 'combobox', evidence: 'x' }], tiers);
    expect(errors).toEqual([]);
  });
  it('warns when an EXPLORATORY project has declared benchmark demand — the tier-understated nudge', () => {
    const { warnings } = advisoryTierCrossCheck(
      [{ project: 'webinjectors', capability: 'combobox', evidence: 'benchmark demand cite' }], tiers);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/exploratory.*benchmark demand for "combobox"/);
    expect(warnings[0].message).toMatch(/ADVISORY ONLY/);
    expect(warnings[0].message).toMatch(/benchmark demand cite/);
    expect(warnings[0].descriptor).toMatchObject({ kind: 'advisory-tier-cross-check', entity: 'Project', id: 'webinjectors' });
  });
  it('is SILENT for core/contextual projects — the demand is already reflected in the stamped tier', () => {
    const { warnings } = advisoryTierCrossCheck([
      { project: 'webvalidation', capability: 'form-validation-flow', evidence: 'x' },
      { project: 'webaudit', capability: 'audit-timeline', evidence: 'x' },
    ], tiers);
    expect(warnings).toEqual([]);
  });
  it('warns (unresolved-ref) when the declared join names a project that no longer exists — drift guard', () => {
    const { warnings } = advisoryTierCrossCheck(
      [{ project: 'webgone', capability: 'tabs', evidence: 'x' }], tiers);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/does not resolve in projects\.json/);
    expect(warnings[0].descriptor).toMatchObject({ entity: 'Project', id: 'webgone', field: 'projectDomainDemand' });
  });
  it('tolerates a missing/empty declared join (the real-data state today) — no warnings', () => {
    expect(advisoryTierCrossCheck(undefined, tiers).warnings).toEqual([]);
    expect(advisoryTierCrossCheck([], tiers).warnings).toEqual([]);
  });
  it('the live declared join in benchmarkCoverage.json is clean against real tiers (warns zero today)', () => {
    const coverage = JSON.parse(readFileSync(join(DATA, 'benchmarkCoverage.json'), 'utf8'));
    const projectTierById = new Map(
      readdirSync(join(DATA, 'projects'))
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(DATA, 'projects', f), 'utf8')))
        .map((p) => [p.id, p.tier]));
    const { errors, warnings } = advisoryTierCrossCheck(coverage.projectDomainDemand, projectTierById);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
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

// ── Design systems (§6b-ter, #747 Fork-3-A / #871) ─────────────────────────────
describe('validateDesignSystem — registry + manifest two-layer shape', () => {
  const manifests = {
    'ds/full.designsystem.json': {
      extends: '@webtheme/default', themeTokens: './full.tokens.json',
      intentDefaults: { density: 'comfortable' }, traitDefaults: { radius: 'lg' },
    },
    'ds/minimal.designsystem.json': { extends: '@webtheme/default', themeTokens: './minimal.tokens.json' },
    'ds/no-tokens.designsystem.json': { extends: '@webtheme/default' },
    'ds/bad-extends.designsystem.json': { extends: '@nope/ghost', themeTokens: './full.tokens.json' },
    'ds/bad-intent.designsystem.json': { themeTokens: './full.tokens.json', intentDefaults: { ghost: 'x' } },
    'ds/missing-token-file.designsystem.json': { themeTokens: './gone.tokens.json' },
  };
  const ctx = {
    projectById: new Map([['webtheme', { id: 'webtheme' }]]),
    intentById: new Map([['density', { id: 'density' }]]),
    designSystemIds: new Set(['full', 'minimal']),
    readManifest: (rel) => manifests[rel] || null,
    // every referenced token file resolves except the explicit "gone" one
    tokenRefResolves: (_m, ref) => ref !== './gone.tokens.json',
  };
  const base = { id: 'full', name: 'Full', summary: 's', status: 'concept', ownedByProject: 'webtheme', manifest: 'ds/full.designsystem.json' };
  const run = (o) => validateDesignSystem({ ...base, ...o }, ctx);

  it('stays clean for a well-formed full bundle', () => {
    expect(run({}).errors).toEqual([]);
  });
  it('stays clean for a colors-only minimal bundle (optional fields omitted)', () => {
    expect(run({ id: 'minimal', manifest: 'ds/minimal.designsystem.json' }).errors).toEqual([]);
  });
  it('errors on a missing required registry field', () => {
    expect(messages(run({ summary: '' }))).toContainEqual(expect.stringContaining('missing required field "summary"'));
  });
  it('errors on an unresolved ownedByProject', () => {
    expect(messages(run({ ownedByProject: 'ghost' }))).toContainEqual(expect.stringContaining('ownedByProject "ghost" does not resolve'));
  });
  it('errors when the manifest pointer does not resolve', () => {
    expect(messages(run({ manifest: 'ds/absent.designsystem.json' }))).toContainEqual(expect.stringContaining('does not resolve (missing or not valid JSON)'));
  });
  it('errors when the manifest omits themeTokens (the only required manifest field)', () => {
    expect(messages(run({ id: 'x', manifest: 'ds/no-tokens.designsystem.json' }))).toContainEqual(expect.stringContaining('missing required field "themeTokens"'));
  });
  it('errors when themeTokens does not resolve relative to the manifest', () => {
    expect(messages(run({ id: 'x', manifest: 'ds/missing-token-file.designsystem.json' }))).toContainEqual(expect.stringContaining('themeTokens "./gone.tokens.json" does not resolve'));
  });
  it('errors when extends resolves to neither the platform default nor a known design system', () => {
    expect(messages(run({ id: 'x', manifest: 'ds/bad-extends.designsystem.json' }))).toContainEqual(expect.stringContaining('extends "@nope/ghost" does not resolve'));
  });
  it('errors when an intentDefaults key is not a known intent', () => {
    expect(messages(run({ id: 'x', manifest: 'ds/bad-intent.designsystem.json' }))).toContainEqual(expect.stringContaining('intentDefaults "ghost" does not resolve'));
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

// ── Custom-intent meta-schema (#1929, ruling #1913 custom-intents-namespace-by-ownership) ──
describe('validateIntent — custom-intent meta-schema (#1929)', () => {
  const surface = {
    id: 'surface', name: 'Surface', summary: 's', status: 'draft',
    dimensions: { texture: { values: ['solid', 'glass'] }, locked: { values: ['a', 'b'], closed: true } },
  };
  const ctx = { capabilityIds: new Set(), intentById: new Map([['surface', surface]]) };
  const cbase = { name: 'Lozenge', summary: 's', status: 'draft', dimensions: {} };
  const runC = (o) => validateIntent({ ...cbase, ...o }, ctx);

  it('accepts a standalone namespaced custom intent (no extends)', () => {
    expect(runC({ id: 'acme:lozenge', provenance: 'npm:@acme/ui' }).errors).toEqual([]);
  });
  it('accepts additive extends — namespaced new dim + owner:value into an open inherited dim', () => {
    expect(runC({
      id: 'acme:lozenge', extends: 'surface',
      dimensions: { 'acme:fizz': { values: ['x'] }, texture: { values: ['acme:matte'] } },
    }).errors).toEqual([]);
  });
  it('rejects a malformed namespace (uppercase / not owner:intent)', () => {
    expect(messages(runC({ id: 'acme:Lozenge' }))).toContainEqual(expect.stringContaining('must be namespaced'));
  });
  it('rejects a non-namespaced new dimension under extends', () => {
    expect(messages(runC({ id: 'acme:lozenge', extends: 'surface', dimensions: { bareDim: { values: ['x'] } } })))
      .toContainEqual(expect.stringContaining('non-namespaced dimension'));
  });
  it('rejects a bare value-addition to an inherited open dimension', () => {
    expect(messages(runC({ id: 'acme:lozenge', extends: 'surface', dimensions: { texture: { values: ['matte'] } } })))
      .toContainEqual(expect.stringContaining('bare value "matte"'));
  });
  it('rejects widening a closed inherited dimension even when namespaced (#1337)', () => {
    expect(messages(runC({ id: 'acme:lozenge', extends: 'surface', dimensions: { locked: { values: ['acme:c'] } } })))
      .toContainEqual(expect.stringContaining('closed enum'));
  });
  it('rejects an extends that does not resolve', () => {
    expect(messages(runC({ id: 'acme:lozenge', extends: 'made-up' })))
      .toContainEqual(expect.stringContaining('does not resolve'));
  });
  it('rejects a non-boolean mustUnderstand', () => {
    expect(messages(runC({ id: 'acme:lozenge', mustUnderstand: 'yes' })))
      .toContainEqual(expect.stringContaining('mustUnderstand'));
  });
  it('leaves bare standard intents unaffected by the custom-intent rules', () => {
    expect(validateIntent(surface, ctx).errors).toEqual([]);
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

describe('findUnquotedColonScalars — frontmatter quote-fix lint (#453)', () => {
  it('flags an unquoted scalar embedding a colon-space (the loader-skip trigger)', () => {
    const raw = '---\nkind: story\ngraduatedTo: a/b.json: foo\nstatus: open\n---\nbody: has colons: fine\n';
    const hits = findUnquotedColonScalars(raw);
    expect(hits).toEqual([{ line: 3, key: 'graduatedTo', value: 'a/b.json: foo' }]);
  });
  it('flags a trailing colon on an unquoted value', () => {
    expect(findUnquotedColonScalars('---\nfoo: bar:\n---\n')).toEqual([{ line: 2, key: 'foo', value: 'bar:' }]);
  });
  it('exempts a quoted value, a flow mapping, and a bare URL (no colon-space)', () => {
    expect(findUnquotedColonScalars('---\ngraduatedTo: "a/b.json: foo"\n---\n')).toEqual([]);
    expect(findUnquotedColonScalars('---\ncrossRef: { url: /adapters/, label: Rendering Adapters }\n---\n')).toEqual([]);
    expect(findUnquotedColonScalars('---\nhome: https://example.com/x\n---\n')).toEqual([]);
  });
  it('only scans the frontmatter block, never the body', () => {
    expect(findUnquotedColonScalars('---\nkind: story\n---\nA line: with a colon in the body.\n')).toEqual([]);
  });
  it('ignores content with no frontmatter fence', () => {
    expect(findUnquotedColonScalars('no frontmatter: here\n')).toEqual([]);
  });
});

// ── False-positive safety over the REAL data (the standing regression guards) ──
// Each guard runs the exact pure rule the script composes over the live registries/filesystem and
// asserts zero errors, so a future rule tightening that starts erroring on legitimate real data fails
// here instead of only surfacing on a manual `npm run check:standards` run.
describe('real data stays clean (per family)', () => {
  const blocks = loadBlocks(); // per-block specs src/_data/blocks/<id>.json, assembled (#882)
  const intents = loadIntents(); // per-intent specs src/_data/intents/<id>.json, assembled (#1145)
  const protocols = loadProtocols(); // per-protocol specs src/_data/protocols/<id>.json, assembled (#1146)
  const projects = loadDataRegistry('projects'); // per-project specs src/_data/projects/<id>.json (#1157)
  const capabilities = loadDataRegistry('capabilities'); // per-capability specs (#1157)
  const capabilityMatrix = JSON.parse(readFileSync(join(DATA, 'capabilityMatrix.json'), 'utf8'));
  const research = loadResearch(); // per-topic specs src/_data/researchTopics/<id>.json, assembled (#1145)
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
  it('design systems', () => {
    const designSystems = loadDataRegistry('designSystems'); // per-entry specs (#1157)
    const designSystemIds = new Set(designSystems.map((d) => d.id).filter(Boolean));
    const readManifest = (rel) => {
      const p = join(ROOT, rel);
      if (!existsSync(p)) return null;
      try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
    };
    const tokenRefResolves = (manifestRel, ref) => existsSync(join(dirname(join(ROOT, manifestRel)), ref));
    expect(collect(designSystems, (d) => validateDesignSystem(d, { projectById, intentById, designSystemIds, readManifest, tokenRefResolves }))).toEqual([]);
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
    const proxyKeys = [...viteCfg.matchAll(/^\s*(['"])(\^?\/[^'"]*)\1\s*:\s*(?:\{|proxyToEleventy\()/gm)].map((m) => m[2]).join(' ');
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
  it('backlog frontmatter — no unquoted-colon scalars (#453)', () => {
    const BACKLOG = join(ROOT, 'backlog');
    const offenders = readdirSync(BACKLOG).filter((f) => f.endsWith('.md')).flatMap((f) =>
      findUnquotedColonScalars(readFileSync(join(BACKLOG, f), 'utf8')).map((h) => ({ file: f, ...h })));
    expect(offenders).toEqual([]);
  });
  // (Compiled-artifact shadow has no per-family real-data guard here — its live filesystem walk is the
  // production check; findCompiledShadows is exercised by the synthetic cases above. The live
  // `npm run check:standards` remains the production gate over the real tree.)
});
