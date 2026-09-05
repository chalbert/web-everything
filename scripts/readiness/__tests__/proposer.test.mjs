/**
 * @file scripts/readiness/__tests__/proposer.test.mjs
 * @description Demo-first proof of the LLM spec-gap proposer (#252).
 *
 * Exercises the PURE proposer engine against in-memory item fixtures + a fake `readBody`, with a fake
 * provider standing in for the BYO-key model (the network lives at the CLI boundary, not here). The
 * three acceptance criteria map straight onto these tests:
 *   - proposes for a thin-but-decided item and WRITES NOTHING (returns a diff string, no fs);
 *   - never edits a `decision`/`review` item and never auto-applies prose;
 *   - with no provider registered, degrades gracefully — reports the gap, exits clean.
 */
import { describe, it, expect } from 'vitest';
import {
  selectProposalCandidates, CustomProposerRegistry, registerReferenceProposers,
  referenceProposer, propose, renderProposalDiff,
} from '../proposer.mjs';

/** Loader-shaped item; body is supplied separately via the fake readBody below. */
const item = (num, over = {}) => ({
  num: String(num), id: `${num}-slug`, kind: 'story', status: 'open',
  title: `Item ${num}`, summary: 'A decided thing.', tags: ['cli'], ...over,
});

/** A readBody that serves a per-id body from a map, defaulting to an empty (maximally-thin) body. */
const bodyMapReader = (bodies) => (file) => bodies[file] ?? '';

const THIN = ''; // no acceptance-criteria section, no file path, no edge cases, no integration test → 4 gaps
const FLESHED = '## Acceptance criteria\n- It works.\n\n'
  + 'Edge cases: rejects `__fixtures__` paths.\n\n'
  + 'Add an integration test exercising the real route wiring.\n\n'
  + 'Edits `scripts/foo.mjs`.';

describe('candidate selection (#252) — deterministic, decided-but-thin only', () => {
  it('selects an open issue/idea with a thin body and reports every gap', () => {
    const items = [item(10)];
    const cands = selectProposalCandidates(items, bodyMapReader({ 'backlog/10-slug.md': THIN }));
    expect(cands.map((c) => c.num)).toEqual(['10']);
    expect(cands[0].gaps).toEqual(['acceptance-criteria', 'file-paths', 'edge-cases', 'integration-tests']);
  });

  it('skips a fleshed-out item (criteria, a path, edge cases, and an integration test all present)', () => {
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': FLESHED }));
    expect(cands).toEqual([]);
  });

  it('reports only the missing gaps when some of the four are present', () => {
    const onlyPath = 'See `scripts/foo.mjs`.'; // has a path, nothing else
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': onlyPath }));
    expect(cands[0].gaps).toEqual(['acceptance-criteria', 'edge-cases', 'integration-tests']);
  });

  it('never selects a decision item — a fork is a human call, not a gap to fill', () => {
    const items = [item(10, { kind: 'decision' }), item(11, { kind: 'decision' })];
    const cands = selectProposalCandidates(items, bodyMapReader({})); // both have thin (empty) bodies
    expect(cands).toEqual([]);
  });

  it('never selects a non-open item (claimed/done/shelved are out of scope)', () => {
    const items = [item(10, { status: 'active' }), item(11, { status: 'resolved' })];
    expect(selectProposalCandidates(items, bodyMapReader({}))).toEqual([]);
  });
});

describe('build-brief-discipline gap detectors (#2819) — edge cases, integration tests, overclaim title', () => {
  it('flags edge-cases when the body never names one', () => {
    const body = '## Acceptance criteria\n- It works.\n\nAdd an integration test.\n\nEdits `scripts/foo.mjs`.';
    const [c] = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(c.gaps).toContain('edge-cases');
  });

  it('does not flag edge-cases once the body names one', () => {
    const body = '## Acceptance criteria\n- It works.\n\nEdge cases: an empty input list is rejected.\n\n'
      + 'Add an integration test.\n\nEdits `scripts/foo.mjs`.';
    const [c] = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body })) ?? [];
    expect(c?.gaps ?? []).not.toContain('edge-cases');
  });

  it('flags integration-tests when the body only asks for a unit test', () => {
    const body = '## Acceptance criteria\n- It works.\n\nEdge cases: rejects empty input.\n\n'
      + 'Covered by a unit test.\n\nEdits `scripts/foo.mjs`.';
    const [c] = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(c.gaps).toContain('integration-tests');
  });

  it('does not flag integration-tests once the body requires a wiring/e2e test', () => {
    const body = '## Acceptance criteria\n- It works.\n\nEdge cases: rejects empty input.\n\n'
      + 'Covered by a wiring test.\n\nEdits `scripts/foo.mjs`.';
    const [c] = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body })) ?? [];
    expect(c?.gaps ?? []).not.toContain('integration-tests');
  });

  it('flags overclaim-title on a slice (has a parent) whose title claims full closure', () => {
    const items = [item(10, { title: 'Closes the data-layer dodge', parent: '2527' })];
    const [c] = selectProposalCandidates(items, bodyMapReader({ 'backlog/10-slug.md': FLESHED }));
    expect(c.gaps).toEqual(['overclaim-title']); // fleshed body → only the title-level gap fires
  });

  it('does not flag overclaim-title on a standalone item (no parent) with the same title', () => {
    const items = [item(10, { title: 'Closes the data-layer dodge' })]; // no parent
    const cands = selectProposalCandidates(items, bodyMapReader({ 'backlog/10-slug.md': FLESHED }));
    expect(cands).toEqual([]); // fully fleshed, no parent → nothing to flag
  });

  it('does not flag overclaim-title on a slice whose title makes no closure claim', () => {
    const items = [item(10, { title: 'Add a retry to the fetch helper', parent: '2527' })];
    const cands = selectProposalCandidates(items, bodyMapReader({ 'backlog/10-slug.md': FLESHED }));
    expect(cands).toEqual([]);
  });
});

describe('propose — never applies, only drafts (#252)', () => {
  it('returns a proposal + a diff string and touches no filesystem', async () => {
    const registry = registerReferenceProposers();
    const results = await propose([item(10)], { readBody: bodyMapReader({ 'backlog/10-slug.md': THIN }), registry });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('proposed');
    const diff = renderProposalDiff(results[0]);
    expect(diff).toContain('## Acceptance criteria');     // criteria gap drafted
    expect(diff).toContain('Likely files');               // path gap drafted
    expect(diff).toMatch(/NOT written/);                  // explicitly a preview, not a write
    expect(diff.split('\n').every((l) => l.startsWith('+') || l.startsWith('---'))).toBe(true); // diff-only
  });

  it('drafts only the missing gap (path present → no criteria proposed)', async () => {
    const registry = registerReferenceProposers();
    const onlyPath = 'See `scripts/foo.mjs`.';
    const [r] = await propose([item(10)], { readBody: bodyMapReader({ 'backlog/10-slug.md': onlyPath }), registry });
    expect(r.proposal.criteria).toBeTruthy();   // the missing one (acceptance-criteria) is drafted
    expect(r.proposal.paths).toBeUndefined();   // the satisfied one is left alone
  });

  it('reference proposer marks its output as scaffolding, not authoritative', () => {
    const c = { gaps: ['acceptance-criteria'], id: '10-slug', tags: [] };
    expect(referenceProposer.propose(c).rationale).toMatch(/scaffolding/i);
  });

  it('drafts a note (never a criterion or path) for overclaim-title, and is not refused', async () => {
    const registry = registerReferenceProposers();
    const items = [item(10, { title: 'Closes the data-layer dodge', parent: '2527' })];
    const [r] = await propose(items, { readBody: bodyMapReader({ 'backlog/10-slug.md': FLESHED }), registry });
    expect(r.status).toBe('proposed');
    expect(r.proposal.notes).toBeTruthy();
    expect(r.proposal.criteria).toBeUndefined();
    expect(r.proposal.paths).toBeUndefined();
    const diff = renderProposalDiff(r);
    expect(diff).toMatch(/<!-- Notes/);
    expect(diff.split('\n').every((l) => l.startsWith('+') || l.startsWith('---'))).toBe(true);
  });
});

describe('graceful degradation — no provider registered (#252)', () => {
  it('reports the gap as no-provider and never throws or fakes a draft', async () => {
    const registry = new CustomProposerRegistry(); // empty
    expect(registry.has()).toBe(false);
    const results = await propose([item(10)], { readBody: bodyMapReader({ 'backlog/10-slug.md': THIN }), registry });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('no-provider');
    expect(results[0].proposal).toBeNull();
    expect(results[0].candidate.gaps).toEqual(['acceptance-criteria', 'file-paths', 'edge-cases', 'integration-tests']); // gaps still reported
    expect(renderProposalDiff(results[0])).toBe('');                                   // nothing to render
  });
});

describe('provider failure is recorded, never thrown (#252)', () => {
  it('a throwing provider becomes an error result, not an exception', async () => {
    const registry = new CustomProposerRegistry();
    registry.register({ id: 'boom', handles: () => true, propose: () => { throw new Error('kaboom'); } });
    const [r] = await propose([item(10)], { readBody: bodyMapReader({ 'backlog/10-slug.md': THIN }), registry });
    expect(r.status).toBe('error');
    expect(r.reason).toBe('kaboom');
  });

  it('a provider that returns an empty draft is recorded as refused', async () => {
    const registry = new CustomProposerRegistry();
    registry.register({ id: 'empty', handles: () => true, propose: () => ({ criteria: [], paths: [] }) });
    const [r] = await propose([item(10)], { readBody: bodyMapReader({ 'backlog/10-slug.md': THIN }), registry });
    expect(r.status).toBe('refused');
  });

  it('a provider that returns only notes is proposed, not refused — notes alone are a real draft', async () => {
    const registry = new CustomProposerRegistry();
    registry.register({ id: 'notes-only', handles: () => true, propose: () => ({ notes: ['review by hand'] }) });
    const [r] = await propose([item(10)], { readBody: bodyMapReader({ 'backlog/10-slug.md': THIN }), registry });
    expect(r.status).toBe('proposed');
  });
});

describe('quarantine from the deterministic core (#252/#250)', () => {
  it('the proposer module imports nothing from the #250 engine', async () => {
    // A structural guard: the pure engine must not pull in engine.mjs (and vice-versa), so
    // check:readiness stays byte-deterministic with no model in the loop.
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const here = dirname(fileURLToPath(import.meta.url));
    const proposerSrc = readFileSync(join(here, '..', 'proposer.mjs'), 'utf8');
    const engineSrc = readFileSync(join(here, '..', 'engine.mjs'), 'utf8');
    expect(proposerSrc).not.toMatch(/from '\.\/engine\.mjs'|require\(.*engine\.mjs/);
    expect(engineSrc).not.toMatch(/from '\.\/proposer\.mjs'|require\(.*proposer\.mjs/);
  });
});
