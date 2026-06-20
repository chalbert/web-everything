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
import { loadBlocks } from '../lib/blocks-loader.cjs';
import { loadIntents } from '../lib/intents-loader.cjs';
import { loadResearch } from '../lib/research-loader.cjs';
import { loadProtocols } from '../lib/protocols-loader.cjs';
import { loadDataRegistry } from '../lib/registry-loader.cjs';
import {
  checkStatus, validateProtocol, validateDesignSystem, validateIntent, validateCapability, validateCapabilityMatrix,
  validateReportsNotHidden, findCompiledShadows, isSegmentCovered, permalinkSegment,
  validateViteProxyCoverage, deDateReport,
  isExportsSafeTarget, validateModuleResolutionLock, findRawHtmlInMarkdown,
  flattenExportsTargets, validateRenderersNotPublished, validateReferenceRuntimeForms, REFERENCE_RUNTIME_FORMS,
  findBuriedForkSections, findUnquotedColonScalars, findBadBodyLinks, findNonBatchableMarkers,
  deriveResearchFreshness, addIsoDuration, RESEARCH_REVIEW_HORIZON_DEFAULT,
  validateCapabilityPresence, validateRetirementShape,
  validatePlugDualMode, PLUG_UNPLUGGED_TEST_ENFORCED,
  validateBlockImplConformance, BLOCK_IMPL_DRIFT_ENFORCED,
  validateBlockExportShape, EXPORT_SHAPE_ENFORCED,
  validateBlockComposesTraits, COMPOSE_TRAITS_ENFORCED,
  scanRepoLocusPrefixes,
  validateTemplateA11y, NAV_ACTIVE_STATE_ENFORCED,
  lintBacklogItemRendering,
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

describe('module-resolution exports-lock (#274/#271)', () => {
  it('isExportsSafeTarget: URL / node_modules / bare specifier are safe', () => {
    expect(isExportsSafeTarget('https://esm.sh/@frontierui/jsx-runtime@1')).toBe(true);
    expect(isExportsSafeTarget('/node_modules/@frontierui/jsx-runtime/dist/index.js')).toBe(true);
    expect(isExportsSafeTarget('@frontierui/jsx-runtime')).toBe(true);
    expect(isExportsSafeTarget('@frontierui/jsx-runtime/jsx-dev-runtime')).toBe(true);
  });

  it('isExportsSafeTarget: raw in-repo / foreign source paths are NOT safe', () => {
    expect(isExportsSafeTarget('/plugs/jsx-runtime')).toBe(false);
    expect(isExportsSafeTarget('./jsx-runtime')).toBe(false);
    expect(isExportsSafeTarget('../frontierui/blocks/renderers/jsx')).toBe(false);
    expect(isExportsSafeTarget('/abs/path/frontierui/src/jsx')).toBe(false);
    expect(isExportsSafeTarget('')).toBe(false);
  });

  it('flags a locked-scope entry pointing at WE/foreign source', () => {
    const { errors } = validateModuleResolutionLock([
      { specifier: '@frontierui/jsx-runtime', target: '/plugs/blocks/jsx', source: 'vite.config.mts' },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('@frontierui/jsx-runtime');
  });

  it('passes a locked-scope entry that resolves to a URL or bare specifier', () => {
    const { errors } = validateModuleResolutionLock([
      { specifier: '@frontierui/jsx-runtime', target: 'https://esm.sh/@frontierui/jsx-runtime@1', source: 'x' },
      { specifier: '@frontierui/blocks', target: '@frontierui/blocks', source: 'y' },
    ]);
    expect(errors).toEqual([]);
  });

  it('ignores non-locked-scope specifiers (e.g. internal @webinjectors alias)', () => {
    const { errors } = validateModuleResolutionLock([
      { specifier: '@webinjectors', target: '/plugs/webinjectors', source: 'vite.config.mts' },
    ]);
    expect(errors).toEqual([]);
  });

  it('real data stays clean: the live vite aliases carry no locked-scope violation', () => {
    const viteCfg = readFileSync(join(ROOT, 'vite.config.mts'), 'utf8');
    const entries = [...viteCfg.matchAll(/(['"])(@[^'"]+)\1\s*:\s*(['"])([^'"]+)\3/g)].map((m) => ({
      specifier: m[2], target: m[4], source: 'vite.config.mts',
    }));
    const { errors } = validateModuleResolutionLock(entries);
    expect(errors.map((e) => e.message)).toEqual([]);
  });
});

describe('codegen-placement invariants (#964 — hardening #956)', () => {
  it('flattenExportsTargets: pulls leaf strings from a nested exports map', () => {
    expect(flattenExportsTargets('./dist/index.js')).toEqual(['./dist/index.js']);
    expect(flattenExportsTargets({ '.': { import: './a.js', require: './b.cjs' }, './x': './x.js' }))
      .toEqual(['./a.js', './b.cjs', './x.js']);
    expect(flattenExportsTargets(undefined)).toEqual([]);
  });

  it('flags an @webeverything/* package re-exporting blocks/renderers/*', () => {
    const { errors } = validateRenderersNotPublished([
      { name: '@webeverything/contracts', exports: { './serve': './blocks/renderers/module-service/moduleService.js' }, source: 'pkg/package.json' },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('blocks/renderers/');
  });

  it('passes when @webeverything/* exports only contract/vector paths', () => {
    const { errors } = validateRenderersNotPublished([
      { name: '@webeverything/contracts', exports: { '.': './dist/contracts.js', './vectors': './dist/vectors.js' }, source: 'pkg/package.json' },
    ]);
    expect(errors).toEqual([]);
  });

  it('ignores unscoped / @frontierui manifests (only the published @webeverything scope is governed)', () => {
    const { errors } = validateRenderersNotPublished([
      { name: 'web-everything', exports: undefined, source: 'package.json' },
      { name: '@frontierui/blocks', exports: { './renderers': './blocks/renderers/index.js' }, source: '../frontierui/package.json' },
    ]);
    expect(errors).toEqual([]);
  });

  it('flags a new WE-side serve() form beyond the ratified reference-runtime set', () => {
    const { errors } = validateReferenceRuntimeForms(['declarative', 'wc-class', 'html', 'jsx', 'functional', 'vue-sfc']);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('vue-sfc');
    expect(errors[0].message).toContain('genWrapper');
  });

  it('passes the ratified reference-runtime form set', () => {
    const { errors } = validateReferenceRuntimeForms([...REFERENCE_RUNTIME_FORMS]);
    expect(errors).toEqual([]);
  });

  it('real data stays clean: live package manifests carry no published-renderer leak', () => {
    const { errors } = validateRenderersNotPublished([
      { name: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).name, exports: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).exports, source: 'package.json' },
    ]);
    expect(errors).toEqual([]);
  });

  it('real data stays clean: the live ServeForm union is the ratified set', () => {
    const src = readFileSync(join(ROOT, 'blocks/renderers/module-service/moduleService.ts'), 'utf8');
    const union = src.match(/export type ServeForm\s*=\s*([^;]+);/);
    const ids = [...union[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(validateReferenceRuntimeForms(ids).errors).toEqual([]);
  });
});

describe('findRawHtmlInMarkdown — raw HTML in backlog body (#290)', () => {
  const names = (body) => findRawHtmlInMarkdown(body).map((f) => f.name);

  it('flags an un-backticked interactive tag (the #020 content-swallow bug)', () => {
    const f = findRawHtmlInMarkdown('A digest with a literal <select> in it.');
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ line: 1, name: 'select', tag: '<select>' });
  });

  it('ignores a tag inside an inline code span', () => {
    expect(names('Native: `<select>` and `<dialog>` are the anchors.')).toEqual([]);
  });

  it('ignores tags inside a fenced code block (``` and ~~~)', () => {
    expect(names('before\n```html\n<select><option>x</option></select>\n```\nafter')).toEqual([]);
    expect(names('~~~\n<table><tr><td>x</td></tr></table>\n~~~')).toEqual([]);
  });

  it('does NOT flag placeholder tokens that are not HTML elements (<NNN>, <date>, <slug>)', () => {
    expect(names('Rename to <NNN>-slug on <date>, e.g. <my-id> — these are not tags.')).toEqual([]);
  });

  it('does NOT flag a hyphenated custom element (inert, not a standard element)', () => {
    expect(names('A bare <auto-complete> mounts a window.')).toEqual([]);
  });

  it('reports each raw tag with its body line number', () => {
    const f = findRawHtmlInMarkdown('line one\n\n<div>raw</div> and <ul> here');
    expect(f.map((x) => [x.line, x.name])).toEqual([[3, 'div'], [3, 'div'], [3, 'ul']]);
  });

  it('matches close tags and tags carrying attributes', () => {
    expect(names('<input type="file"> then </form>')).toEqual(['input', 'form']);
  });

  it('returns [] for an empty or non-string body', () => {
    expect(findRawHtmlInMarkdown('')).toEqual([]);
    expect(findRawHtmlInMarkdown(undefined)).toEqual([]);
  });
});

describe('findBadBodyLinks — leaked authoring syntax in a backlog body', () => {
  const kinds = (body) => findBadBodyLinks(body).map((f) => f.kind);

  it('flags a [[wiki-link]] as a wikilink (memory-only syntax)', () => {
    const f = findBadBodyLinks('Per [[feedback_bias_separation_decoupling]] this splits.');
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ line: 1, kind: 'wikilink' });
  });

  it('flags localhost, absolute /Users/, and file:// links as dead', () => {
    expect(kinds('see [x](http://localhost:3000/y)')).toEqual(['localhost']);
    expect(kinds('see [x](/Users/me/repo/src/a.ts)')).toEqual(['absfile']);
    expect(kinds('see [x](file:///tmp/a.html)')).toEqual(['absfile']);
  });

  it('flags a link to another backlog item .md file (should be /backlog/NNN-slug/)', () => {
    expect(kinds('see [#178](../backlog/178-access-control.md#L14)')).toEqual(['backlog-md']);
    expect(kinds('see [#016](backlog/016-gap-9.md)')).toEqual(['backlog-md']);
    // The common form: a BARE sibling NNN-slug.md with no backlog/ prefix — renders as a 404 from
    // /backlog/<id>/ just the same (was previously missed by the lint — the #707 broken-link regression).
    expect(kinds('see [#604](604-migrate-the-we-site.md)')).toEqual(['backlog-md']);
    expect(kinds('see [#700](700-converter.md#fork-1)')).toEqual(['backlog-md']);
    expect(kinds('see [#178](./178-access-control.md)')).toEqual(['backlog-md']);
  });

  it('does NOT flag the correct rendered URL or reports/docs .md refs', () => {
    expect(kinds('see [#178](/backlog/178-access-control/)')).toEqual([]);
    expect(kinds('report [r](../reports/2026-06-14-x.md) and [d](docs/agent/backlog-workflow.md)')).toEqual([]);
    expect(kinds('source [s](src/_data/intents.json#L899)')).toEqual([]);
  });

  it('ignores [[ ]] / [[...]] inside code (template-interpolation examples)', () => {
    expect(kinds('reactive `{{ }}`/`[[ ]]` interpolation stays manual')).toEqual([]);
    expect(kinds('before\n```\nrender([[1,2],[3,4]])\n```\nafter')).toEqual([]);
  });

  it('returns [] for an empty or non-string body', () => {
    expect(findBadBodyLinks('')).toEqual([]);
    expect(findBadBodyLinks(undefined)).toEqual([]);
  });
});

describe('findBuriedForkSections — a fork section in a non-decision body (#441 carve rule)', () => {
  const headings = (body) => findBuriedForkSections(body).map((f) => f.heading);

  it('flags a fork-shaped section heading', () => {
    const f = findBuriedForkSections('# Title\n\n## Open design points\n\n- A vs B, leaning A.');
    expect(f).toEqual([{ line: 3, heading: 'Open design points' }]);
  });

  it('matches the #192 / #315 / #087 heading variants', () => {
    expect(headings('## Open decisions\n- x')).toEqual(['Open decisions']);
    expect(headings('## Design tensions to settle\n- x')).toEqual(['Design tensions to settle']);
    expect(headings('### Open question — how to single-source\n- x')).toEqual(['Open question — how to single-source']);
  });

  it('SUPPRESSES a section already carved to a decision (#NNN + carve/block/resolve language)', () => {
    // The #192 / #134 / #315 post-carve shape must stay quiet.
    expect(headings('## Open design points\n\nForks live in their own decision items, carved to #441 (blockedBy).')).toEqual([]);
    expect(headings('## Open questions\n\nResolved by the child stories — see #346 / #349.')).toEqual([]);
  });

  it('does NOT suppress when a number is present without carve/resolve language', () => {
    // A bare cross-ref like "5k rows" or "#317 surfaced this" is not a settlement pointer.
    expect(headings('## Open questions\n\nSurfaced in #317 — should the coordinator be a block or a composition?')).toEqual(['Open questions']);
  });

  it('ignores non-fork headings and bounds each section at the next heading', () => {
    const body = '## Scope\n\n## Open decisions\n\n- live fork, no pointer\n\n## Notes\n\ncarved #99 resolved';
    // "Notes" (with the pointer) is a separate section, so it must not suppress "Open decisions".
    expect(headings(body)).toEqual(['Open decisions']);
  });

  it('returns [] for an empty or non-string body', () => {
    expect(findBuriedForkSections('')).toEqual([]);
    expect(findBuriedForkSections(undefined)).toEqual([]);
  });
});

describe('findNonBatchableMarkers — body asserts non-batchability (mis-flagged-batchable lint)', () => {
  const marks = (body) => [...new Set(findNonBatchableMarkers(body).map((h) => h.marker))];

  it('flags the recurring disqualifier phrases', () => {
    expect(marks('Size 8 — not batchable as one; re-slice under #658.')).toEqual(['not batchable', 're-slice']);
    expect(marks('The deliverable is external infrastructure a code-session agent cannot stand up.'))
      .toEqual(['external infra', 'agent cannot provision']);
    expect(marks('Re-flagged **blocked-in-fact**; this is a human-in-the-loop build.'))
      .toEqual(['blocked-in-fact', 'human-in-the-loop']);
  });

  it('matches a backticked slash-command marker (inline code is NOT stripped here)', () => {
    // The #774 shape: the disqualifier is written as a backticked command.
    expect(marks('**Needs a `/decision` (or `/prepare`) pass** to settle scope.')).toEqual(['needs prep/decision']);
  });

  it('reports the body line number', () => {
    const f = findNonBatchableMarkers('# Title\n\nfine line\nnot batchable here');
    expect(f).toEqual([{ line: 4, marker: 'not batchable' }]);
  });

  it('skips markers inside a fenced code block (a sample is not an assertion)', () => {
    const body = '```\n// not batchable — a code comment sample\n```\nreal prose, fine.';
    expect(marks(body)).toEqual([]);
  });

  it('does not fire on an unrelated, genuinely-batchable body', () => {
    expect(marks('Add a uniform live-example slot to every /blocks/ page. Wire the shortcode.')).toEqual([]);
  });

  it('returns [] for an empty or non-string body', () => {
    expect(findNonBatchableMarkers('')).toEqual([]);
    expect(findNonBatchableMarkers(undefined)).toEqual([]);
  });
});

describe('deriveResearchFreshness — staleness derivation (#441 Fork 4 / #477)', () => {
  const now = new Date('2026-06-13T00:00:00Z');

  it('is unreviewed when lastReviewed is missing or malformed', () => {
    expect(deriveResearchFreshness({}, { now }).state).toBe('unreviewed');
    expect(deriveResearchFreshness({ lastReviewed: '' }, { now }).state).toBe('unreviewed');
    expect(deriveResearchFreshness({ lastReviewed: 'June 2026' }, { now }).state).toBe('unreviewed');
  });

  it('is fresh within the horizon, stale once past it (P6M)', () => {
    // reviewed 2026-05 → due 2026-11 → fresh on 2026-06-13
    expect(deriveResearchFreshness({ lastReviewed: '2026-05-01', reviewHorizon: 'P6M' }, { now }))
      .toMatchObject({ state: 'fresh', dueDate: '2026-11-01' });
    // reviewed 2025-01 → due 2025-07 → stale on 2026-06-13
    expect(deriveResearchFreshness({ lastReviewed: '2025-01-01', reviewHorizon: 'P6M' }, { now }))
      .toMatchObject({ state: 'stale', dueDate: '2025-07-01' });
  });

  it('falls back to the global P6M horizon when the topic declares none', () => {
    const fr = deriveResearchFreshness({ lastReviewed: '2026-05-01' }, { now });
    expect(fr.horizon).toBe(RESEARCH_REVIEW_HORIZON_DEFAULT);
    expect(fr.state).toBe('fresh');
  });

  it('treats the horizon boundary as still-fresh (stale only strictly past due)', () => {
    // due exactly == now → not yet past → fresh
    expect(deriveResearchFreshness({ lastReviewed: '2025-12-13', reviewHorizon: 'P6M' }, { now }).state).toBe('fresh');
  });

  it('honours week/day/year durations', () => {
    expect(deriveResearchFreshness({ lastReviewed: '2026-06-01', reviewHorizon: 'P2W' }, { now }).state).toBe('fresh'); // 06-01 + 14d = 06-15 > now 06-13 → fresh
    expect(deriveResearchFreshness({ lastReviewed: '2026-06-10', reviewHorizon: 'P1D' }, { now }).state).toBe('stale'); // due 06-11 < now → stale
    expect(deriveResearchFreshness({ lastReviewed: '2026-01-01', reviewHorizon: 'P1Y' }, { now }).state).toBe('fresh'); // due 2027-01-01 > now → fresh
  });

  it('addIsoDuration returns null for empty / bare-P durations', () => {
    expect(addIsoDuration(new Date('2026-01-01T00:00:00Z'), 'P')).toBeNull();
    expect(addIsoDuration(new Date('2026-01-01T00:00:00Z'), '')).toBeNull();
    expect(addIsoDuration(new Date('2026-01-01T00:00:00Z'), 'P6M').toISOString().slice(0, 10)).toBe('2026-07-01');
  });
});

describe('validateCapabilityPresence — capability×source join table (#352)', () => {
  const ctx = {
    capabilityIds: new Set(['button', 'menu']),
    sourceIds: new Set(['material-3', 'carbon']),
    provenanceKinds: ['notable-inference', 'verified'],
  };
  const run = (rows) => validateCapabilityPresence({ rows }, ctx);

  it('stays clean for well-formed rows', () => {
    const res = run([
      { capabilityId: 'button', sourceId: 'material-3', present: true, provenance: 'verified', url: 'https://m3/button' },
      { capabilityId: 'menu', sourceId: 'carbon', present: true, provenance: 'notable-inference', url: null },
    ]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it('errors on an unknown capability or source id', () => {
    const res = run([{ capabilityId: 'ghost', sourceId: 'nope', present: true, provenance: 'verified', url: 'x' }]);
    expect(res.errors.map((e) => e.message).join(' ')).toMatch(/unknown capability "ghost".*|unknown corpus source "nope"/);
    expect(res.errors.length).toBe(2);
  });

  it('errors on a non-boolean present and an unknown provenance', () => {
    const res = run([{ capabilityId: 'button', sourceId: 'carbon', present: 'yes', provenance: 'guess' }]);
    const msg = res.errors.map((e) => e.message).join(' ');
    expect(msg).toMatch(/"present" must be a boolean/);
    expect(msg).toMatch(/unknown provenance "guess"/);
  });

  it('errors on a duplicate (capability, source) row', () => {
    const res = run([
      { capabilityId: 'button', sourceId: 'carbon', present: true, provenance: 'verified', url: 'x' },
      { capabilityId: 'button', sourceId: 'carbon', present: true, provenance: 'verified', url: 'y' },
    ]);
    expect(res.errors.map((e) => e.message).join(' ')).toMatch(/duplicate row for \(button, carbon\)/);
  });

  it('warns (not errors) when a verified row lacks its deep doc url', () => {
    const res = run([{ capabilityId: 'button', sourceId: 'material-3', present: true, provenance: 'verified' }]);
    expect(res.errors).toEqual([]);
    expect(res.warnings.map((w) => w.message).join(' ')).toMatch(/verified row \(button, material-3\) has no deep doc url/);
  });

  it('the live seed file (notable-inference) stays clean', () => {
    const presence = require(join(SRC, '_data/benchmarkCapabilityPresence.json'));
    const caps = require(join(SRC, '_data/benchmarkCapabilities.json'));
    const corpus = require(join(SRC, '_data/benchmarkCorpus.json'));
    const res = validateCapabilityPresence(presence, {
      capabilityIds: new Set(caps.capabilities.map((c) => c.id)),
      sourceIds: new Set(corpus.sources.map((s) => s.id)),
      provenanceKinds: presence.provenanceKinds.map((k) => k.id),
    });
    expect(res.errors).toEqual([]);
  });
});

describe('validateRetirementShape — general reference-retirement convention (#584)', () => {
  const run = (entry, opts) => validateRetirementShape(entry, { label: 'ref', ...opts });

  it('passes vacuously when no retirement markers are present (most-permissive default)', () => {
    expect(run({ title: 'MDN', url: 'https://mdn' }).errors).toEqual([]);
  });

  it('accepts a complete death triplet', () => {
    const res = run({ retired: true, retiredDate: '2026-06-14', retiredReason: 'docs 404; folded into Fluent' });
    expect(res.errors).toEqual([]);
  });

  it('errors when retired:true lacks a reason or a date', () => {
    const msg = run({ retired: true }).errors.map((e) => e.message).join(' ');
    expect(msg).toMatch(/requires a retiredReason/);
    expect(msg).toMatch(/requires a retiredDate/);
  });

  it('errors on a non-ISO retiredDate', () => {
    expect(run({ retired: true, retiredReason: 'x', retiredDate: 'June 2026' }).errors
      .map((e) => e.message).join(' ')).toMatch(/retiredDate must be an ISO date/);
  });

  it('errors on death fields without retired:true (all-or-nothing triplet)', () => {
    expect(run({ retiredDate: '2026-06-14', retiredReason: 'x' }).errors
      .map((e) => e.message).join(' ')).toMatch(/without retired:true/);
  });

  it('errors on a non-boolean retired', () => {
    expect(run({ retired: 'yes' }).errors.map((e) => e.message).join(' ')).toMatch(/"retired" must be a boolean/);
  });

  it('treats death and supersession as orthogonal — both can co-exist (state 4)', () => {
    const res = run(
      { retired: true, retiredDate: '2026-06-14', retiredReason: 'docs dead', supersededBy: 'fluent-2' },
      { resolveSupersededBy: (t) => t === 'fluent-2' },
    );
    expect(res.errors).toEqual([]);
  });

  it('errors when supersededBy does not resolve (only where a resolver is supplied)', () => {
    expect(run({ supersededBy: 'ghost' }, { resolveSupersededBy: () => false }).errors
      .map((e) => e.message).join(' ')).toMatch(/supersededBy "ghost" does not resolve/);
    // No resolver → pointer is not resolution-checked (homes without an id space).
    expect(run({ supersededBy: 'https://newer' }).errors).toEqual([]);
  });

  it('the live corpus retired source (#546 FAST) stays clean', () => {
    const corpus = require(join(SRC, '_data/benchmarkCorpus.json'));
    const fast = corpus.sources.find((s) => s.id === 'fast');
    expect(validateRetirementShape(fast, { label: 'fast' }).errors).toEqual([]);
  });
});

describe('validatePlugDualMode — #606 dual-mode plug conformance (#636)', () => {
  it('passes a domain with both an unplugged-mode and plugged-mode test', () => {
    const res = validatePlugDualMode([
      { name: 'webbehaviors', hasSource: true, hasUnpluggedTest: true, hasPluggedTest: true },
    ]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it('ERRORs a domain that ships no plugged-mode test (missing a mode)', () => {
    const res = validatePlugDualMode([
      { name: 'webfoo', hasSource: true, hasUnpluggedTest: true, hasPluggedTest: false },
    ]);
    expect(res.errors.map((e) => e.message).join(' ')).toMatch(/webfoo.*no plugged-mode test/);
  });

  it('flags a missing unplugged-mode test as the #649 backfill target (warn until enforced)', () => {
    const res = validatePlugDualMode([
      { name: 'webbar', hasSource: true, hasUnpluggedTest: false, hasPluggedTest: true },
    ]);
    const bucket = PLUG_UNPLUGGED_TEST_ENFORCED ? res.errors : res.warnings;
    expect(bucket.map((e) => e.message).join(' ')).toMatch(/webbar.*no unplugged-mode.*#649/);
    // The opposite bucket carries nothing about the unplugged gap.
    const other = PLUG_UNPLUGGED_TEST_ENFORCED ? res.warnings : res.errors;
    expect(other.map((e) => e.message).join(' ')).not.toMatch(/unplugged-mode/);
  });

  it('skips a non-plug directory (no source files)', () => {
    const res = validatePlugDualMode([
      { name: 'webempty', hasSource: false, hasUnpluggedTest: false, hasPluggedTest: false },
    ]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });
});

describe('validateBlockImplConformance — block contract↔impl drift (#659, the #606/#641 analogue)', () => {
  it('passes a block whose impl resolves in FUI', () => {
    const res = validateBlockImplConformance([
      { id: 'button', implementedBy: '@frontierui/blocks/button/', implPresent: true },
    ]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.checked).toBe(1);
  });

  it('flags a missing FUI impl as drift (warn until enforced)', () => {
    const res = validateBlockImplConformance([
      { id: 'wizard', implementedBy: '@frontierui/blocks/wizard/WizardElement.ts', implPresent: false },
    ]);
    const bucket = BLOCK_IMPL_DRIFT_ENFORCED ? res.errors : res.warnings;
    expect(bucket.map((e) => e.message).join(' ')).toMatch(/wizard.*does not resolve.*#170\/#659/);
    const other = BLOCK_IMPL_DRIFT_ENFORCED ? res.warnings : res.errors;
    expect(other.map((e) => e.message).join(' ')).not.toMatch(/does not resolve/);
  });

  it('skips the content arm when FUI is absent (implPresent null) — never a failure', () => {
    const res = validateBlockImplConformance([
      { id: 'button', implementedBy: '@frontierui/blocks/button/', implPresent: null },
    ]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.skipped).toBe(1);
    expect(res.checked).toBe(0);
  });

  it('ignores a block with no implementedBy (form gated elsewhere)', () => {
    const res = validateBlockImplConformance([{ id: 'composite-widget', implPresent: true }]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.checked).toBe(0);
  });
});

describe('validateBlockExportShape — CEM surface ↔ impl export drift (#927, the deeper #170 arm)', () => {
  it('passes a block whose declared exports are all present in the resolved barrel (extras OK)', () => {
    const res = validateBlockExportShape([
      { id: 'router', implementedBy: '@frontierui/blocks/router/index.ts', declaredExports: ['A', 'B'], actualExports: ['A', 'B', 'Extra'] },
    ]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.checked).toBe(1);
  });

  it('flags a declared export missing from the barrel as drift (warn until enforced)', () => {
    const res = validateBlockExportShape([
      { id: 'tabs', implementedBy: '@frontierui/blocks/tabs/index.ts', declaredExports: ['TabsComponent', 'Present'], actualExports: ['Present'] },
    ]);
    const bucket = EXPORT_SHAPE_ENFORCED ? res.errors : res.warnings;
    expect(bucket.map((e) => e.message).join(' ')).toMatch(/tabs.*TabsComponent.*#170\/#927/);
    const other = EXPORT_SHAPE_ENFORCED ? res.warnings : res.errors;
    expect(other).toEqual([]);
  });

  it('skips when the barrel could not be resolved (actualExports null) — FUI absent / no barrel', () => {
    const res = validateBlockExportShape([
      { id: 'view', implementedBy: '@frontierui/blocks/view/index.ts', declaredExports: ['X'], actualExports: null },
    ]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.skipped).toBe(1);
    expect(res.checked).toBe(0);
  });
});

describe('validateBlockComposesTraits — compose-don\'t-hand-roll deny-list (#937, Fork 1 of #933)', () => {
  const handRolledDisclosure = `
    head.setAttribute('aria-expanded', 'false');
    head.addEventListener('click', () => toggle(head));
  `;

  it('warns a curated target that hand-rolls behaviour it should compose (warn until enforced)', () => {
    const res = validateBlockComposesTraits([
      { id: 'sectioned-nav', source: handRolledDisclosure },
    ]);
    const bucket = COMPOSE_TRAITS_ENFORCED ? res.errors : res.warnings;
    expect(bucket.map((e) => e.message).join(' ')).toMatch(/sectioned-nav.*nav:section.*#933\/#937/);
    expect(res.checked).toBe(1);
    const other = COMPOSE_TRAITS_ENFORCED ? res.warnings : res.errors;
    expect(other).toEqual([]);
  });

  it('clears the finding once the block composes the behaviour (the migration path)', () => {
    const res = validateBlockComposesTraits([
      { id: 'sectioned-nav', composesBehaviors: ['nav:section'], source: handRolledDisclosure },
    ]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.checked).toBe(1);
  });

  it('accepts {name} object form in composesBehaviors', () => {
    const res = validateBlockComposesTraits([
      { id: 'sectioned-nav', composesBehaviors: [{ name: 'nav:section' }], source: handRolledDisclosure },
    ]);
    expect(res.warnings).toEqual([]);
  });

  it('never sniffs a block outside the curated allow-list (zero false-positive by construction)', () => {
    const res = validateBlockComposesTraits([
      { id: 'some-other-block', source: handRolledDisclosure },
    ]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.checked).toBe(0);
  });

  it('does not fire on a partial signature match (AND across regexes)', () => {
    const res = validateBlockComposesTraits([
      { id: 'sectioned-nav', source: "head.setAttribute('aria-expanded', 'false');" }, // no listener
    ]);
    expect(res.warnings).toEqual([]);
    expect(res.checked).toBe(1);
  });

  it('skips when FUI source is absent (source null) — never a failure', () => {
    const res = validateBlockComposesTraits([{ id: 'sectioned-nav', source: null }]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.skipped).toBe(1);
    expect(res.checked).toBe(0);
  });
});

describe('scanRepoLocusPrefixes — #884 repo-locus prefix detection (#883 convention)', () => {
  const scan = (content) => scanRepoLocusPrefixes([{ file: 'backlog/x.md', content }]);

  it('flags a bare unmarked code-path reference', () => {
    const f = scan('Edit `src/_data/blocks.json` to add the field.');
    expect(f.length).toBe(1);
    expect(f[0].sample).toBe('src/_data/blocks.json');
  });

  it('accepts a marked reference (we:/fui:/plateau: or full name)', () => {
    expect(scan('See `we:src/_data/blocks.json`.')).toEqual([]);
    expect(scan('See `fui:blocks/temporal/traits/Clock.ts`.')).toEqual([]);
    expect(scan('See `plateau:src/main.ts`.')).toEqual([]);
    expect(scan('See `webeverything:scripts/gen-cem.mjs`.')).toEqual([]);
  });

  it('exempts a markdown-link target (the link text carries the locus)', () => {
    expect(scan('[we:src/_data/blocks.json](src/_data/blocks.json) is the file.')).toEqual([]);
  });

  it('exempts @scope/pkg npm specifiers and URLs', () => {
    expect(scan('Import from `@frontierui/blocks/index.ts`.')).toEqual([]);
    expect(scan('See https://example.com/path/file.ts for details.')).toEqual([]);
  });

  it('exempts fenced code blocks and WE-relative frontmatter fields', () => {
    expect(scan('```\nsrc/foo.ts\n```\n')).toEqual([]);
    expect(scan('graduatedTo: scripts/gen-cem.mjs')).toEqual([]);
    expect(scan('relatedReport: reports/2026-01-01-x.md')).toEqual([]);
  });

  it('counts multiple unmarked tokens per file', () => {
    const f = scan('`a/b.ts` and `c/d.mjs` and `e/f.json`');
    expect(f[0].count).toBe(3);
  });

  it('carves out JS-ecosystem product names, glob masks, and bare type fragments (#885)', () => {
    // Product names (single Capitalized word + .js) are prose, not repo files.
    expect(scan('Built on Node.js and shipped to Next.js / Three.js.')).toEqual([]);
    // Glob masks are file-type patterns, not concrete paths.
    expect(scan('Match every *.test.ts and *.d.ts under the tree.')).toEqual([]);
    // Bare type-suffix fragments (no name segment) are extensions, not paths.
    expect(scan('Emit `.d.ts` and `.spec.ts` files.')).toEqual([]);
    // But a real file whose name happens to start with a dot still needs a marker.
    expect(scan('Edit `.eleventy.js` config.').length).toBe(1);
    // And a real lowercase .js path is still flagged.
    expect(scan('Run `scripts/gen-cem.mjs` then `src/app.js`.')[0].count).toBe(2);
  });
});

describe('validateTemplateA11y — static template a11y lint (#772, #762 class)', () => {
  const FULL_PAGE = '<!DOCTYPE html><html lang="en"><head><title>X</title></head><body><nav><a href="/a/" aria-current="page">A</a></nav><main>y</main></body></html>';

  it('passes a full-page layout with lang, title, main, and aria-current-wired nav', () => {
    const res = validateTemplateA11y([{ path: 'src/_layouts/base.njk', content: FULL_PAGE }]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });

  it('ERRORs <html> without lang, without title, and without a <main> landmark', () => {
    const res = validateTemplateA11y([{ path: 'l.njk', content: '<html><head></head><body><p>x</p></body></html>' }]);
    const msgs = res.errors.map((e) => e.message).join(' ');
    expect(msgs).toMatch(/without a lang/);
    expect(msgs).toMatch(/no <title>/);
    expect(msgs).toMatch(/no <main> landmark/);
  });

  it('flags a hardcoded nav link list lacking aria-current as the #762 class (warn until enforced)', () => {
    const content = '<html lang="en"><head><title>X</title></head><body><nav><a href="/a/">A</a><a href="/b/">B</a></nav><main>y</main></body></html>';
    const res = validateTemplateA11y([{ path: 'src/_layouts/legacy.html', content }]);
    const bucket = NAV_ACTIVE_STATE_ENFORCED ? res.errors : res.warnings;
    expect(bucket.map((e) => e.message).join(' ')).toMatch(/aria-current.*#762/);
    const other = NAV_ACTIVE_STATE_ENFORCED ? res.warnings : res.errors;
    expect(other.map((e) => e.message).join(' ')).not.toMatch(/aria-current/);
  });

  it('does not apply landmark rules to a partial template (no <html>)', () => {
    const res = validateTemplateA11y([{ path: 'partial.njk', content: '<section><p>fragment</p></section>' }]);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
  });
});

describe('lintBacklogItemRendering (#845 — the shared per-item rendering lint)', () => {
  const item = (over = {}) => ({ id: '999-x', kind: 'story', status: 'open', batchable: false, ...over });

  it('errors on a [[wiki-link]] and a dead .md backlog link; warns on raw HTML', () => {
    const body = 'See [[feedback_foo]].\n\nA raw <select> here.\n\nLink to [x](092-thing.md).';
    const { errors, warnings } = lintBacklogItemRendering({ item: item(), body });
    expect(errors.some((e) => /\[\[wiki-link\]\]/.test(e))).toBe(true);
    expect(errors.some((e) => /dead \.md path/.test(e))).toBe(true);
    expect(warnings.some((w) => /raw HTML/.test(w))).toBe(true);
  });

  it('warns on a fork-shaped heading only in a non-decision, non-resolved body', () => {
    const body = '## Open question — A vs B\n\nWeigh the options.';
    expect(lintBacklogItemRendering({ item: item(), body }).warnings.some((w) => /fork-shaped/.test(w))).toBe(true);
    expect(lintBacklogItemRendering({ item: item({ kind: 'decision' }), body }).warnings.some((w) => /fork-shaped/.test(w))).toBe(false);
    expect(lintBacklogItemRendering({ item: item({ status: 'resolved' }), body }).warnings.some((w) => /fork-shaped/.test(w))).toBe(false);
  });

  it('warns on a non-batchability marker only when the item computes batchable', () => {
    const body = 'This is not batchable; re-slice first.';
    expect(lintBacklogItemRendering({ item: item({ batchable: true }), body }).warnings.some((w) => /asserts non-batchability/.test(w))).toBe(true);
    expect(lintBacklogItemRendering({ item: item({ batchable: false }), body }).warnings.some((w) => /asserts non-batchability/.test(w))).toBe(false);
  });

  it('is clean for a well-formed body', () => {
    const body = 'A normal item body linking to [another](/backlog/092-thing/) the right way.';
    const { errors, warnings } = lintBacklogItemRendering({ item: item(), body });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  describe('premature-epic-closure guard (#777)', () => {
    const epic = (over = {}) => item({ kind: 'epic', status: 'resolved', ...over });

    it('errors on an unchecked scope box in a RESOLVED epic', () => {
      const body = '# T\n\n- [ ] migration slice not done\n';
      expect(lintBacklogItemRendering({ item: epic(), body }).errors.some((e) => /RESOLVED epic with .* unchecked scope box/.test(e))).toBe(true);
    });

    it('warns on forward-looking uncarved-slice language in a RESOLVED epic', () => {
      const body = '# T\n\nThe chrome slice is not carved yet (gated on #765).\n';
      const { errors, warnings } = lintBacklogItemRendering({ item: epic(), body });
      expect(errors).toEqual([]);
      expect(warnings.some((w) => /uncarved-slice language/.test(w))).toBe(true);
    });

    it('does not fire on a checked-and-cited box, or on a non-resolved/non-epic item', () => {
      const checked = '# T\n\n- [x] slice shipped (#123)\n';
      expect(lintBacklogItemRendering({ item: epic(), body: checked }).errors).toEqual([]);
      const openEpic = '# T\n\n- [ ] not carved yet\n';
      expect(lintBacklogItemRendering({ item: epic({ status: 'open' }), body: openEpic }).errors).toEqual([]);
      expect(lintBacklogItemRendering({ item: item({ status: 'resolved' }), body: openEpic }).errors).toEqual([]);
    });

    it('ignores an unchecked box inside a fenced code block', () => {
      const body = '# T\n\n```\n- [ ] this is sample text, not scope\n```\n';
      expect(lintBacklogItemRendering({ item: epic(), body }).errors).toEqual([]);
    });
  });
});
