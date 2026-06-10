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
  num: String(num), id: `${num}-slug`, type: 'idea', status: 'open',
  title: `Item ${num}`, summary: 'A decided thing.', tags: ['cli'], ...over,
});

/** A readBody that serves a per-id body from a map, defaulting to an empty (maximally-thin) body. */
const bodyMapReader = (bodies) => (file) => bodies[file] ?? '';

const THIN = ''; // no acceptance-criteria section, no file path → both gaps
const FLESHED = '## Acceptance criteria\n- It works.\n\nEdits `scripts/foo.mjs`.';

describe('candidate selection (#252) — deterministic, decided-but-thin only', () => {
  it('selects an open issue/idea with a thin body and reports both gaps', () => {
    const items = [item(10)];
    const cands = selectProposalCandidates(items, bodyMapReader({ 'backlog/10-slug.md': THIN }));
    expect(cands.map((c) => c.num)).toEqual(['10']);
    expect(cands[0].gaps).toEqual(['acceptance-criteria', 'file-paths']);
  });

  it('skips a fleshed-out item (has acceptance criteria AND a concrete path)', () => {
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': FLESHED }));
    expect(cands).toEqual([]);
  });

  it('reports only the missing gap when one of the two is present', () => {
    const onlyPath = 'See `scripts/foo.mjs`.'; // has a path, no acceptance criteria
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': onlyPath }));
    expect(cands[0].gaps).toEqual(['acceptance-criteria']);
  });

  it('never selects a decision or review item — a fork is a human call, not a gap to fill', () => {
    const items = [item(10, { type: 'decision' }), item(11, { type: 'review' })];
    const cands = selectProposalCandidates(items, bodyMapReader({})); // both have thin (empty) bodies
    expect(cands).toEqual([]);
  });

  it('never selects a non-open item (claimed/done/shelved are out of scope)', () => {
    const items = [item(10, { status: 'active' }), item(11, { status: 'resolved' })];
    expect(selectProposalCandidates(items, bodyMapReader({}))).toEqual([]);
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
});

describe('graceful degradation — no provider registered (#252)', () => {
  it('reports the gap as no-provider and never throws or fakes a draft', async () => {
    const registry = new CustomProposerRegistry(); // empty
    expect(registry.has()).toBe(false);
    const results = await propose([item(10)], { readBody: bodyMapReader({ 'backlog/10-slug.md': THIN }), registry });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('no-provider');
    expect(results[0].proposal).toBeNull();
    expect(results[0].candidate.gaps).toEqual(['acceptance-criteria', 'file-paths']); // gap still reported
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
