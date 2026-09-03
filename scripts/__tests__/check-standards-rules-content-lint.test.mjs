/**
 * @file scripts/__tests__/check-standards-rules-content-lint.test.mjs
 * @description Split from check-standards-rules.test.mjs (#3383 test-speedup): module-resolution
 * exports-lock, codegen-placement invariants, the markdown/backlog-body lint detectors (raw HTML, bad
 * links, duplicate manifest keys, buried fork sections, non-batchable markers), research-freshness
 * derivation, the capability-presence join table, retirement-shape, and dual-mode plug conformance.
 * Pure file-move — same tests, smaller file.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isExportsSafeTarget, validateModuleResolutionLock,
  flattenExportsTargets, validateRenderersNotPublished, validateReferenceRuntimeForms, REFERENCE_RUNTIME_FORMS,
  findRawHtmlInMarkdown, findBadBodyLinks,
  findHarnessScaffoldingMarkers, scanHarnessScaffolding,
  findDuplicateKeysPerScope, validateNoDuplicateManifestKeys,
  findBuriedForkSections, findNonBatchableMarkers,
  deriveResearchFreshness, addIsoDuration, RESEARCH_REVIEW_HORIZON_DEFAULT,
  validateCapabilityPresence, validateRetirementShape,
  validatePlugDualMode, PLUG_UNPLUGGED_TEST_ENFORCED,
} from '../check-standards-rules.mjs';
import { require, ROOT, SRC } from './fixtures/check-standards-rules-fixtures.mjs';

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

describe('findDuplicateKeysPerScope — the #2149 Fork 1 dup-key merge gate for keyed manifests', () => {
  it('flags two same-name keys in one object scope (the clean-but-wrong merge class)', () => {
    // Two lanes both add a "wrangler" dep at different offsets → git line-merges CLEAN into this:
    const raw = '{ "dependencies": { "wrangler": "^3.1.0", "vite": "^5.0.0", "wrangler": "^3.2.0" } }';
    expect(findDuplicateKeysPerScope(raw)).toEqual(['wrangler']);
  });
  it('does NOT flag the SAME key name in DIFFERENT object scopes', () => {
    // "name" appears once per object — legitimate, distinct scopes.
    const raw = '{ "name": "root", "nested": { "name": "child" }, "list": [ { "name": "a" }, { "name": "b" } ] }';
    expect(findDuplicateKeysPerScope(raw)).toEqual([]);
  });
  it('does NOT treat a repeated STRING VALUE as a duplicate key', () => {
    // "^5.0.0" is a value twice, not a key — must not flag.
    const raw = '{ "vite": "^5.0.0", "vitest": "^5.0.0" }';
    expect(findDuplicateKeysPerScope(raw)).toEqual([]);
  });
  it('is not fooled by braces/colons inside string values', () => {
    const raw = '{ "a": "has {a} and : colon", "a": "again" }';
    expect(findDuplicateKeysPerScope(raw)).toEqual(['a']);
  });
  it('returns [] for a clean manifest or a non-string input', () => {
    expect(findDuplicateKeysPerScope('{ "a": 1, "b": 2 }')).toEqual([]);
    expect(findDuplicateKeysPerScope(undefined)).toEqual([]);
  });
  it('validateNoDuplicateManifestKeys yields one labelled finding per dup, [] when clean', () => {
    const findings = validateNoDuplicateManifestKeys('{ "a": 1, "a": 2 }', 'package.json');
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('package.json');
    expect(findings[0].message).toContain('"a"');
    expect(validateNoDuplicateManifestKeys('{ "a": 1 }', 'package.json')).toEqual([]);
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

describe('findHarnessScaffoldingMarkers — leaked harness-scaffolding in backlog/report content (#3448)', () => {
  it('flags a bare <system-reminder> block opening its own line', () => {
    const f = findHarnessScaffoldingMarkers('Some digest.\n\n<system-reminder>\nleaked context\n</system-reminder>\n');
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ line: 3, label: '<system-reminder> tag' });
    expect(f[1]).toMatchObject({ line: 5, label: '<system-reminder> tag' });
  });

  it('does NOT flag the same marker fenced in a code block (documenting the pattern itself)', () => {
    const body = 'Discussion.\n\n```\n<system-reminder>\nexample\n</system-reminder>\n```\n\nmore prose.';
    expect(findHarnessScaffoldingMarkers(body)).toEqual([]);
  });

  it('does NOT flag a mid-sentence mention describing the incident (no false positive on prose)', () => {
    const body = 'PR #1803 committed a literal <system-reminder> block by accident; the marker `Claude-Session:` and SendUserFile-style tool-invocation instructions were also involved.';
    expect(findHarnessScaffoldingMarkers(body)).toEqual([]);
  });

  it('flags a <system> tag opening its own line, without colliding with <system-reminder>', () => {
    expect(findHarnessScaffoldingMarkers('<system>\ninjected\n</system>').map((h) => h.label))
      .toEqual(['<system> tag', '<system> tag']);
    expect(findHarnessScaffoldingMarkers('<system-reminder>\nx\n</system-reminder>').map((h) => h.label))
      .toEqual(['<system-reminder> tag', '<system-reminder> tag']);
  });

  it('flags a Claude-Session: header opening its own line', () => {
    const f = findHarnessScaffoldingMarkers('Claude-Session: https://claude.ai/code/session_abc123');
    expect(f).toEqual([{ line: 1, label: 'Claude-Session: header', match: 'Claude-Session:' }]);
  });

  it('flags a Claude-Session: header case-insensitively', () => {
    const f = findHarnessScaffoldingMarkers('claude-session: https://claude.ai/code/session_abc123');
    expect(f).toEqual([{ line: 1, label: 'Claude-Session: header', match: 'claude-session:' }]);
  });

  it('flags a leak quoted with a > blockquote prefix (a leak pasted into review discussion)', () => {
    const f = findHarnessScaffoldingMarkers('> <system-reminder>\n> leaked\n> </system-reminder>');
    expect(f.map((h) => h.label)).toEqual(['<system-reminder> tag', '<system-reminder> tag']);
  });

  it('flags a SendUserFile tool-invocation instruction phrase anywhere in the line', () => {
    const f = findHarnessScaffoldingMarkers('To share it, send it with SendUserFile right away.');
    expect(f).toEqual([{ line: 1, label: 'SendUserFile tool-invocation instruction', match: 'with SendUserFile' }]);
  });

  it('scanHarnessScaffolding aggregates per-file hits from a docs array', () => {
    const findings = scanHarnessScaffolding([
      { file: 'backlog/1-a.md', content: 'clean body, no markers here.' },
      { file: 'backlog/2-b.md', content: '<system-reminder>\nleak\n</system-reminder>' },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].file).toBe('backlog/2-b.md');
    expect(findings[0].hits.length).toBeGreaterThan(0);
  });

  it('returns [] for an empty or non-string body', () => {
    expect(findHarnessScaffoldingMarkers('')).toEqual([]);
    expect(findHarnessScaffoldingMarkers(undefined)).toEqual([]);
  });
});
