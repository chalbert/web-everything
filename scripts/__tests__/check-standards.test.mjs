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
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { loadBlocks } from '../lib/blocks-loader.cjs';
import { loadIntents } from '../lib/intents-loader.cjs';
import { loadProtocols } from '../lib/protocols-loader.cjs';
import { loadDemos } from '../lib/demos-loader.cjs';
import { loadDataRegistry } from '../lib/registry-loader.cjs';
import { loadAdapters } from '../lib/adapters-loader.cjs';
import { buildGraduatedKinds, validateBacklogItem, isCanonicalGraduated } from '../check-standards-rules.mjs';

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
  kind: 'task',
  status: 'open',
  summary: 'A synthetic backlog item for the rule harness.',
  dateOpened: '2026-06-09',
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
});

describe('isCanonicalGraduated — graduatedTo leading-token canonicality (#614)', () => {
  it('treats none / resolving typed-id / repo-path / file#anchor as canonical', () => {
    for (const v of ['none', 'intent:motion', 'block:data-grid', 'capabilities/resolver.ts', 'blocks/renderers/x.ts', 'a/b/c.mjs'])
      expect(isCanonicalGraduated(v, FIXTURE_KINDS), v).toBe(true);
  });
  it('treats a leading typed-id or repo-path with a trailing annotation as canonical (entity still leads)', () => {
    for (const v of ['intent:motion — the announcer contract', 'capabilities/resolver.ts (resolveSlot / native-first)'])
      expect(isCanonicalGraduated(v, FIXTURE_KINDS), v).toBe(true);
  });
  it('treats a bare id resolvable in a registry as canonical (the normalizer will prefix it)', () => {
    expect(isCanonicalGraduated('motion', FIXTURE_KINDS)).toBe(true);          // bare intent id
    expect(isCanonicalGraduated('data-grid', FIXTURE_KINDS)).toBe(true);       // bare block id
  });
  it('strips a YAML end-of-line comment before judging', () => {
    expect(isCanonicalGraduated('none   # triage epic — decomposed', FIXTURE_KINDS)).toBe(true);
  });
  it('flags pure prose / an unresolvable lead / an item-id split as non-canonical', () => {
    for (const v of ['Protocol', 'enhanced the existing validation engine', '575, 576, 577', 'plateau: getStandInElement.ts (tag-keyed rehydration)'])
      expect(isCanonicalGraduated(v, FIXTURE_KINDS), v).toBe(false);
  });
  it('leaves the object (crossRef) form alone — not this rule\'s subject', () => {
    expect(isCanonicalGraduated({ url: '/blocks/x/', label: 'X' }, FIXTURE_KINDS)).toBe(true);
  });

  it('nudges a resolved story that records no graduatedTo (warning, not error)', () => {
    // base fixture is a `task` (exempt from the nudge, like a decision); a resolved story/epic is the
    // class that should record what it became (#487 maps the old `issue` exemption to `task`).
    const res = run({ kind: 'story', size: 3, status: 'resolved', dateResolved: '2026-06-09' });
    expect(res.errors).toEqual([]);
    expect(res.warnings.map((w) => w.message)).toContainEqual(expect.stringContaining('no graduatedTo'));
  });
});

describe('validateBacklogItem — repo-locus (#repo-locus)', () => {
  it('errors on an authored locus that is not a known value', () => {
    const res = run({ locus: 'plateu-app', locusAuthored: true });
    expect(messages(res)).toContainEqual(expect.stringContaining('invalid locus "plateu-app"'));
  });
  it('accepts a known authored locus with no error/warning', () => {
    const res = run({ locus: 'plateau-app', locusAuthored: true });
    expect(messages(res)).not.toContainEqual(expect.stringContaining('locus'));
    expect(res.warnings.map((w) => w.message)).not.toContainEqual(expect.stringContaining('locus'));
  });
  it('nudges (warning) an inferred cross-repo locus on a batchable item that was never made explicit', () => {
    const res = run({ locus: 'plateau-app', locusAuthored: false, batchable: true });
    expect(res.errors).toEqual([]);
    expect(res.warnings.map((w) => w.message)).toContainEqual(expect.stringContaining("reads as locus \"plateau-app\""));
  });
  it('does NOT nudge a non-batchable (epic / blocked) cross-repo item — locus only matters for the pack', () => {
    const res = run({ locus: 'plateau-app', locusAuthored: false, batchable: false });
    expect(res.warnings.map((w) => w.message)).not.toContainEqual(expect.stringContaining('reads as locus'));
  });
  it('is silent for the default webeverything locus', () => {
    const res = run({ locus: 'webeverything', locusAuthored: false });
    expect(res.warnings.map((w) => w.message)).not.toContainEqual(expect.stringContaining('locus'));
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
    const res = run({ kind: 'story', size: 4 });
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
  const blocks = loadBlocks(); // per-block specs src/_data/blocks/<id>.json, assembled (#882)
  const intents = loadIntents(); // per-intent specs src/_data/intents/<id>.json, assembled (#1145)
  const protocols = loadProtocols(); // per-protocol specs src/_data/protocols/<id>.json, assembled (#1146)
  const projects = loadDataRegistry('projects'); // per-project specs src/_data/projects/<id>.json (#1157)
  const plugs = loadDataRegistry('plugs'); // per-plug specs src/_data/plugs/<id>.json (#1157)
  const adapters = loadAdapters(); // per-adapter specs src/_data/adapters/<id>.json + _groups.json, assembled (#1938)
  const demos = loadDemos(); // per-demo specs src/_data/demos/<id>.json, assembled (#1146)
  const capabilityIds = new Set(loadDataRegistry('capabilities').map((c) => c.id)); // per-cap specs (#1157)
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

// ── `scope:` must be repo-qualified (#883/#2613) ──────────────────────────────────
// The `scope:` shape/qualification rule lives INLINE in check-standards.mjs (it reads RAW frontmatter, before
// the loader normalizes), and that script isn't importable here (top-level `git ls-tree origin/main` +
// `process.exit`). So we mirror its three-branch decision as a pure `classifyScope` — the SAME repo-prefix key
// set as check-standards-rules.mjs `LOCUS_MARKER_RE` — kept in sync by (a) the requested unit cases below and
// (b) the standing corpus guard, which runs the identical predicate over the REAL backlog so a bare entry
// reaching disk fails here, not only on a live gate run.
describe('scope: must be repo-qualified', () => {
  const matter = require('gray-matter');
  const SCOPE_REPO_PREFIX_RE = /^(?:we|fui|plateau|webeverything|frontierui|plateau-app):/;

  /** Mirror of the inline check-standards.mjs branches → 'ok' | 'empty' | 'non-string' | 'bare'. */
  const classifyScope = (scope) => {
    if (!Array.isArray(scope)) return 'non-array';
    if (scope.length === 0) return 'empty';
    if (scope.some((p) => typeof p !== 'string')) return 'non-string';
    if (scope.some((p) => !SCOPE_REPO_PREFIX_RE.test(p))) return 'bare';
    return 'ok';
  };

  it('accepts a we:-qualified (and multi-repo) scope', () => {
    expect(classifyScope(['we:src/backlog-view/', 'we:docs/agent/'])).toBe('ok');
    expect(classifyScope(['we:src/x/', 'fui:plugs/foo/', 'plateau:app/y/'])).toBe('ok');
  });

  it('errors on a bare (non-repo-qualified) entry', () => {
    expect(classifyScope(['src/x/'])).toBe('bare');
    expect(classifyScope(['we:src/x/', 'docs/agent/'])).toBe('bare'); // one bad entry taints the array
  });

  it('still errors on an empty scope', () => {
    expect(classifyScope([])).toBe('empty');
  });

  it('every real backlog item with a scope is repo-qualified', () => {
    const dir = join(ROOT, 'backlog');
    const offenders = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      let data;
      try { data = matter(readFileSync(join(dir, file), 'utf8')).data; } catch { continue; }
      if (data?.scope === undefined) continue;
      if (classifyScope(data.scope) !== 'ok') offenders.push({ id: file.replace(/\.md$/, ''), scope: data.scope });
    }
    expect(offenders).toEqual([]);
  });
});
