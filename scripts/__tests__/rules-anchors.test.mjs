/**
 * @file scripts/__tests__/rules-anchors.test.mjs
 * @description Pins the /rules/ read-path anchor machinery (#1828, #1792 Fork 1 → (c)): the loader's
 * anchor extraction (the three anchor forms the docs use) and the cross-doc codifiedIn-resolution gate.
 * Fixture-tested so the pure rules don't depend on the live docs tree.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { extractAnchors, githubSlug } = require('../lib/rules-loader.cjs');
const {
  validateRulesAnchors, collectExplicitAnchorDefs, findDuplicateAnchors, findOrphanAnchors,
  collectAnchorReferences, anchorSubstance, validateAnchorSubstance, runStatuteCheck,
  collectEnforcerPaths, enforcerPathCandidates, validateInvariantEnforcers, collectOpenItemIds,
  collectItemStatuses, validateCitedItemStatusClaims,
} = require('../lib/validate-rules-anchors.cjs');

describe('extractAnchors — the three anchor forms the governance docs use', () => {
  it('lifts explicit kramdown `### Title {#id}` headings', () => {
    const { anchors, headings } = extractAnchors('### Constellation placement {#constellation-placement}\n');
    expect(anchors.has('constellation-placement')).toBe(true);
    expect(headings[0]).toEqual({ level: 3, text: 'Constellation placement', anchor: 'constellation-placement' });
  });

  it('slugs plain `## Heading (#1321)` to its GitHub anchor', () => {
    const { anchors } = extractAnchors('## Packaging governance (#1321)\n');
    expect(anchors.has('packaging-governance-1321')).toBe(true);
  });

  it('collapses an em-dash heading to a double-dash slug', () => {
    const { anchors } = extractAnchors('### Principle-conformance pre-flight — readiness is conformance, not just mechanics (#608)\n');
    expect(anchors.has('principle-conformance-pre-flight--readiness-is-conformance-not-just-mechanics-608')).toBe(true);
  });

  it('recognizes standalone inline `{#id}` markers and raw-HTML `id="…"`', () => {
    const { anchors } = extractAnchors(
      '8. **Rule.** {#relocation-granularity} body text\n' +
      'prose <span id="canonical-build-kind-predicate"></span> more\n'
    );
    expect(anchors.has('relocation-granularity')).toBe(true);
    expect(anchors.has('canonical-build-kind-predicate')).toBe(true);
  });

  it('does NOT treat a heading-line `#id`-looking token as an anchor twice', () => {
    expect(githubSlug('Just a heading')).toBe('just-a-heading');
    expect(githubSlug('Is it a Project / Protocol — or just an intent?')).toBe('is-it-a-project--protocol--or-just-an-intent');
  });
});

describe('validateRulesAnchors — codifiedIn cite resolution gate', () => {
  const index = {
    'docs/agent/platform-decisions.md': new Set(['constellation-placement', 'monetization']),
    'docs/agent/backlog-workflow.md': new Set(['program-definition']),
    'docs/agent/block-standard.md': new Set([]),
    'docs/agent/vision-tiers.md': new Set([]),
  };

  it('passes when every cite resolves', () => {
    const cites = [
      { file: '1.md', value: 'docs/agent/platform-decisions.md#constellation-placement' },
      { file: '2.md', value: 'docs/agent/backlog-workflow.md#program-definition' },
    ];
    expect(validateRulesAnchors(index, cites).errors).toHaveLength(0);
  });

  it('flags an anchor that does not resolve in its doc', () => {
    const cites = [{ file: '3.md', value: 'docs/agent/platform-decisions.md#renamed-heading' }];
    const { errors } = validateRulesAnchors(index, cites);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/does not resolve/);
  });

  it('flags a cite into a doc outside the rendered four', () => {
    const cites = [{ file: '4.md', value: 'docs/agent/conventions.md#whatever' }];
    const { errors } = validateRulesAnchors(index, cites);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/not one of the four/);
  });
});

describe('statute integrity (#2083) — duplicates / orphans / substance', () => {
  it('collects every explicit {#id} occurrence with its line', () => {
    const defs = collectExplicitAnchorDefs('### A {#alpha}\ntext\n1. **Rule.** {#beta} body\n');
    expect(defs).toEqual([{ id: 'alpha', line: 1 }, { id: 'beta', line: 3 }]);
  });

  it('flags an id defined twice (a prose "see {#id}" written in definition syntax)', () => {
    const defs = collectExplicitAnchorDefs('### A {#alpha}\nprose; see {#alpha} for the rule\n');
    const errors = findDuplicateAnchors(defs, 'doc.md');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/defined 2×.*lines 1, 2/);
    expect(errors[0].message).toMatch(/\[link\]\(#alpha\)/);
  });

  it('passes distinct ids', () => {
    const defs = collectExplicitAnchorDefs('### A {#alpha}\n### B {#beta}\n');
    expect(findDuplicateAnchors(defs, 'doc.md')).toHaveLength(0);
  });

  it('counts a #id mention as a reference but never the {#id} definition itself', () => {
    const ids = new Set(['alpha', 'beta', 'alphabet']);
    const refs = collectAnchorReferences(['see docs/agent/x.md#alpha and {#beta} only'], ids);
    expect(refs.has('alpha')).toBe(true);
    expect(refs.has('beta')).toBe(false);   // definition syntax is not a reference
    expect(refs.has('alphabet')).toBe(false); // #alpha must not prefix-match #alphabet
  });

  it('flags an unreferenced named anchor as orphaned, once', () => {
    const defs = [{ id: 'dead', line: 3 }, { id: 'dead', line: 9 }, { id: 'live', line: 5 }];
    const errors = findOrphanAnchors(defs, new Set(['live']), 'doc.md');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/"\{#dead\}" is orphaned/);
  });

  it('measures the content span behind explicit, slugged-heading, and inline anchors', () => {
    const src = '### Alpha {#alpha}\n\nsome rule body here\nmore body\n\n### Plain heading (#42)\n\nplain body\n';
    expect(anchorSubstance(src, 'alpha')).toBeGreaterThan(20);
    expect(anchorSubstance(src, 'plain-heading-42')).toBeGreaterThan(5);
    expect(anchorSubstance(src, 'missing')).toBeNull();
  });

  it('flags a cited anchor whose section is a bare heading', () => {
    const srcByDoc = { 'docs/agent/platform-decisions.md': '### Empty {#empty}\n\n### Next {#next}\n\nreal body\n' };
    const cites = [{ file: '1.md', value: 'docs/agent/platform-decisions.md#empty' }];
    const { 0: e, length } = validateAnchorSubstance(srcByDoc, cites, { minChars: 40 });
    expect(length).toBe(1);
    expect(e.message).toMatch(/rule in name only/);
  });

  it('real statute stays clean end-to-end (fs-backed)', () => {
    const { errors } = runStatuteCheck();
    expect(errors.map((e) => e.message)).toEqual([]);
  });
});

// ── #2844 · an operational-invariant anchor must LINK AN ENFORCER ───────────────────────────────────────────────
// The rules above police the statute's anchor↔cite edges; none of them ask whether a claimed runtime guarantee
// has code behind it. This block pins the gate that does, on the machine-readable invariant surface
// (`scripts/lib/invariant-catalogue.json`). Every case is fixture-driven so it proves the RULE, not the current
// contents of the catalogue — and the negative controls matter as much as the positives: a gate that flags
// everything, or nothing, passes a one-sided suite.
describe('#2844 — validateInvariantEnforcers: an invariant must link a LIVE enforcer', () => {
  const live = new Set(['scripts/lib/real.mjs', 'skills-src/drain/SKILL.md']);
  const deps = (openIds = []) => ({
    exists: (p) => live.has(p),
    isOpenItem: (id) => openIds.includes(id),
  });

  it('accepts an entry whose howChecked names a code path that EXISTS', () => {
    const errs = validateInvariantEnforcers(
      [{ id: 'a', howChecked: 'enforced in scripts/lib/real.mjs, unit-tested', status: 'enforced' }], deps(),
    );
    expect(errs).toEqual([]);
  });

  it('REJECTS an entry whose only cited path does not exist — the renamed/deleted-enforcer drift', () => {
    // This is the failure the gate exists for: the prose still claims a mechanism, the mechanism is gone, and
    // no reader of the statute would ever notice.
    const errs = validateInvariantEnforcers(
      [{ id: 'a', howChecked: 'enforced in scripts/lib/gone.mjs', status: 'enforced' }], deps(),
    );
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toMatch(/links no enforcer/);
    expect(errs[0].message).toMatch(/scripts\/lib\/gone\.mjs/);
  });

  it('REJECTS an entry whose howChecked names no code path at all', () => {
    const errs = validateInvariantEnforcers(
      [{ id: 'a', howChecked: 'everyone knows not to do that', status: 'judgment-only' }], deps(),
    );
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toMatch(/names no code path at all/);
  });

  it('REJECTS an empty howChecked outright, and says how to fix it', () => {
    const errs = validateInvariantEnforcers([{ id: 'a', howChecked: '  ', status: 'enforced' }], deps());
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toMatch(/empty howChecked/);
    expect(errs[0].message).toMatch(/owedTo/);
  });

  it('accepts an unbuilt invariant that owes its enforcement to an OPEN item — the honest escape', () => {
    const errs = validateInvariantEnforcers(
      [{ id: 'a', howChecked: 'prose discipline only', owedTo: '2785', status: 'judgment-only' }], deps(['2785']),
    );
    expect(errs).toEqual([]);
  });

  it('REJECTS an owedTo pointing at a RESOLVED/absent item — "we shipped the item and built nothing" is the drift', () => {
    const errs = validateInvariantEnforcers(
      [{ id: 'a', howChecked: 'prose discipline only', owedTo: '#1234', status: 'judgment-only' }], deps(['2785']),
    );
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toMatch(/not an OPEN backlog item/);
  });

  it('resolves a `.claude/skills/...` cite through its tracked `skills-src/...` source (the symlinked view)', () => {
    expect(enforcerPathCandidates('.claude/skills/drain/SKILL.md'))
      .toEqual(['.claude/skills/drain/SKILL.md', 'skills-src/drain/SKILL.md']);
    const errs = validateInvariantEnforcers(
      [{ id: 'a', howChecked: 'stated in .claude/skills/drain/SKILL.md', status: 'judgment-only' }], deps(),
    );
    expect(errs).toEqual([]);
  });

  it('collectEnforcerPaths lifts paths out of prose, including a `file.mjs:772-789` line cite', () => {
    const paths = collectEnforcerPaths('see `scripts/check-standards-rules.mjs:772-789` and scripts/lib/real.mjs, not foo.mjs');
    expect(paths).toContain('scripts/check-standards-rules.mjs');
    expect(paths).toContain('scripts/lib/real.mjs');
    expect(paths).not.toContain('foo.mjs'); // a bare basename names no location — not an enforcer link
  });

  it('validates an optional `anchor` back-link against the real anchor index', () => {
    const anchorIndex = { 'docs/agent/platform-decisions.md': new Set(['known']) };
    const ok = validateInvariantEnforcers(
      [{ id: 'a', howChecked: 'scripts/lib/real.mjs', anchor: 'docs/agent/platform-decisions.md#known' }],
      { ...deps(), anchorIndex },
    );
    expect(ok).toEqual([]);

    const rotted = validateInvariantEnforcers(
      [{ id: 'a', howChecked: 'scripts/lib/real.mjs', anchor: 'docs/agent/platform-decisions.md#renamed' }],
      { ...deps(), anchorIndex },
    );
    expect(rotted).toHaveLength(1);
    expect(rotted[0].message).toMatch(/does not resolve/);

    const malformed = validateInvariantEnforcers(
      [{ id: 'a', howChecked: 'scripts/lib/real.mjs', anchor: 'not-a-cite' }], { ...deps(), anchorIndex },
    );
    expect(malformed).toHaveLength(1);
    expect(malformed[0].message).toMatch(/not a well-formed/);
  });

  it('collectOpenItemIds reads live items by NNN and by bornAs hash, and excludes resolved ones', () => {
    // Fixture-backed, not read off the live backlog: an assertion about a real item's status would go red the
    // moment that item resolved, which is churn, not a proof of this function.
    const dir = mkdtempSync(join(tmpdir(), 'open-items-'));
    writeFileSync(join(dir, '111-live.md'), '---\nbornAs: xaaa111\nstatus: active\n---\n');
    writeFileSync(join(dir, '222-open.md'), '---\nbornAs: xbbb222\nstatus: open\n---\n');
    writeFileSync(join(dir, '333-done.md'), '---\nbornAs: xccc333\nstatus: resolved\n---\n');
    writeFileSync(join(dir, '444-gone.md'), '---\nbornAs: xddd444\nstatus: dropped\n---\n');
    writeFileSync(join(dir, 'not-an-item.txt'), 'ignored');
    try {
      const open = collectOpenItemIds(dir);
      expect([...open].sort()).toEqual(['111', '222', 'xaaa111', 'xbbb222']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('the REAL catalogue links a live enforcer for every entry (fs-backed, and it has subjects)', () => {
    // A gate with no subjects is theatre; assert the corpus it actually binds is non-trivial.
    const catalogue = require('../lib/invariant-catalogue.json');
    expect(catalogue.invariants.length).toBeGreaterThan(20);
    const { errors } = runStatuteCheck();
    expect(errors.map((e) => e.message)).toEqual([]);
  });
});

// ── #2842 · a status claim about a cited #NNN must match that item's real status ─────────────────────────────
// The statute annotates its cites with the cited item's settledness — `(#2398, resolved)`, "#2785 is
// `status: open`", "owed on the **OPEN** line (#2840/#2785)". Nothing held those true, and six sentences in
// platform-decisions.md asserted #2785/#2840 were OPEN months after both resolved. This block pins the gate that
// holds them, entirely on fixtures: an assertion about a REAL item's status would itself go red the day that item
// resolved, which is the very drift under test. The negative controls are the load-bearing half — the grammar was
// chosen because a LOOSER one measured ~75–95% false positives, so "does it decline the near-miss?" is the case
// that decides whether this gate is shippable at all.
describe('#2842 — validateCitedItemStatusClaims: a cited item\'s claimed status must be its real status', () => {
  const DOC = 'docs/agent/platform-decisions.md';
  const doc = (...lines) => ({ [DOC]: lines.join('\n') });
  const statuses = (map) => ({ statusOf: (n) => (n in map ? map[n] : null) });

  it('REJECTS `(#111, resolved)` when 111 is really open — naming doc, LINE, claimed and real status', () => {
    const errs = validateCitedItemStatusClaims(
      doc('intro line', 'ruled by the precedent (#111, resolved) this composes on'), statuses({ 111: 'open' }));
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toMatch(/^docs\/agent\/platform-decisions\.md:2: /); // the doc line to EDIT
    expect(errs[0].message).toMatch(/#111/);
    expect(errs[0].message).toMatch(/claims #111 is `resolved`/);       // the claimed status
    expect(errs[0].message).toMatch(/really `status: open`/);           // the real status
    // Blast radius: this rule reds the gate for authors who never touched the doc, so the message must point at
    // the exact line to edit WITHOUT them reading the card. Prefix + fix clause, twice.
    expect(errs[0].message).toMatch(/Edit docs\/agent\/platform-decisions\.md:2 —/);
  });

  it('ACCEPTS the same annotation when it is true', () => {
    expect(validateCitedItemStatusClaims(
      doc('ruled by the precedent (#111, resolved) this composes on'), statuses({ 111: 'resolved' }))).toEqual([]);
  });

  it('REJECTS an explicit `status:` token claim — pattern B', () => {
    const errs = validateCitedItemStatusClaims(
      doc('the split is ruled but #222 is `status: open` today'), statuses({ 222: 'resolved' }));
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toMatch(/claims #222 is `status: open`/);
    expect(errs[0].message).toMatch(/really `status: resolved`/);
  });

  it('REJECTS per-cite inside an uppercase OPEN run — pattern C flags only the resolved member', () => {
    const errs = validateCitedItemStatusClaims(
      doc('owed on the **OPEN** line (#333/#444)'), statuses({ 333: 'resolved', 444: 'active' }));
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toMatch(/#333/);
    expect(errs[0].message).not.toMatch(/#444/);
    expect(errs[0].message).toMatch(/uppercase "OPEN"/);
  });

  it('GUARD 1 — `#086 (open-core constellation)` is not a status claim (the `(?![-\\w])` stop)', () => {
    // Real corpus line. Without the guard, "open" matches inside "open-core" and the gate cries wolf on a
    // lineage list — the single fastest way to get a statute gate suppressed.
    expect(validateCitedItemStatusClaims(
      doc('**Lineage:** #098 #185 (licensing / GTM) · #089–#093 #086 (open-core constellation) · #182 #183'),
      statuses({ '086': 'resolved' }))).toEqual([]);
  });

  it('GUARD 2a — pattern C\'s run stops at the clause boundary, not a character budget', () => {
    // A flat 120-char window swept #555 in as if the OPEN claim governed it; it governs the slash-run only.
    const errs = validateCitedItemStatusClaims(
      doc('owed on the OPEN items #333/#444, tracked as preventions on #555'),
      statuses({ 333: 'open', 444: 'active', 555: 'resolved' }));
    expect(errs).toEqual([]);
  });

  it('GUARD 2b — an inner `;` does not truncate the run: the boundary is the PARENTHETICAL', () => {
    // The shape of the real platform-decisions.md:3422. A naive `[^,;.)]` stop drops the second cite and
    // silently UNDER-reports, which is the worse failure: a gate that reads green on live drift.
    const errs = validateCitedItemStatusClaims(
      doc('owed on the **OPEN** line (#333 — a reason; #444 — another)'),
      statuses({ 333: 'resolved', 444: 'resolved' }));
    expect(errs).toHaveLength(2);
    expect(errs.map((e) => e.message).join(' ')).toMatch(/#333/);
    expect(errs.map((e) => e.message).join(' ')).toMatch(/#444/);
  });

  it('GUARD 3 — pattern B binds the NEAREST preceding cite, not the leftmost', () => {
    // The real :3420 shape. A left-to-right scan starts at #333 and blames it; the claim is about #444. Getting
    // this wrong names the wrong item in the error AND goes silent on real drift once the two statuses differ.
    const errs = validateCitedItemStatusClaims(
      doc('#333\'s implementation #444 is `status: open`, so the split is ruled but not live'),
      statuses({ 333: 'open', 444: 'resolved' }));
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toMatch(/#444/);
    expect(errs[0].message).not.toMatch(/#333/);
  });

  it('REJECTS a claim about an item with no backlog file — the DANGLING cite', () => {
    const errs = validateCitedItemStatusClaims(doc('see (#999, resolved)'), statuses({}));
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toMatch(/DANGLING/);
    expect(errs[0].message).toMatch(/#999/);
  });

  it('DECLINES the loose-grammar near-misses that made proximity matching unshippable', () => {
    // All three are real corpus lines a proximity grammar fires on. Each has a status word near a cite, and in
    // none of them is the cite the subject of the claim — the word describes a MECHANISM or a STATE MACHINE.
    expect(validateCitedItemStatusClaims(doc(
      'scaffold `--session` so the item is born owned (#670).** Without `--session` a scaffolded item is born `status: open` — instantly claimable.',
      'Concurrency is owned by the `status: open → active` transition (and the `reserve` soft-holds, #083) — not by git. A racing agent is detected by the item reading `status: active`.',
      'lowercase is ordinary prose: owed on the open #333/#444 line, per Rule #105) … the `open→active→resolved` backlog flow',
      'soft precedent framing carries no status word: precedent #840/#844/#477, and #1163 (golden precedent)',
    ), statuses({ 670: 'resolved', '083': 'resolved', 333: 'resolved', 444: 'resolved', 105: 'resolved', 840: 'resolved', 844: 'resolved', 477: 'resolved', 1163: 'resolved' }))).toEqual([]);
  });

  it('is PURE — no filesystem, no live backlog: an empty corpus and an absent statusOf are both inert', () => {
    expect(validateCitedItemStatusClaims({}, statuses({}))).toEqual([]);
    expect(validateCitedItemStatusClaims(doc('nothing to see here'), {})).toEqual([]);
  });

  it('collectItemStatuses reports the real status value, and collectOpenItemIds derives over it unchanged', () => {
    const dir = mkdtempSync(join(tmpdir(), 'item-statuses-'));
    writeFileSync(join(dir, '111-live.md'), '---\nbornAs: xaaa111\nstatus: active\n---\n');
    writeFileSync(join(dir, '222-open.md'), '---\nbornAs: xbbb222\nstatus: open\n---\n');
    writeFileSync(join(dir, '333-done.md'), '---\nbornAs: xccc333\nstatus: resolved\n---\n');
    writeFileSync(join(dir, '444-parked.md'), '---\nstatus: parked\n---\n');
    writeFileSync(join(dir, '555-nostatus.md'), '---\nbornAs: xeee555\n---\n');
    try {
      const m = collectItemStatuses(dir);
      expect(m.get('111')).toBe('active');
      expect(m.get('xaaa111')).toBe('active');
      expect(m.get('333')).toBe('resolved');
      expect(m.get('444')).toBe('parked');
      expect(m.has('555')).toBe(false);            // no status → not an item this rule can judge
      expect([...collectOpenItemIds(dir)].sort()).toEqual(['111', '222', '444', 'xaaa111', 'xbbb222']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
