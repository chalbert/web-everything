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
 *
 * Also covers the build-brief-discipline extension (#2819,
 * docs/agent/platform-decisions.md#build-brief-discipline): three more gap proxies — no named
 * edge-case, no integration/wiring test, an unearned "closes X" claim — on the same deterministic,
 * propose-and-verify engine.
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

const THIN = ''; // no acceptance-criteria section, no file path, no edge-case, no integration test → 4 gaps
// Fleshed out on ALL five build-brief-discipline axes: criteria, path, edge-case, integration test, no overclaim.
const FLESHED = '## Acceptance criteria\n- It works.\n\nEdits `scripts/foo.mjs`.'
  + '\n\n## Edge cases\n- Rejects empty input.\n\nCovered by an integration test that wires the real caller.';
// Fleshed on edge-cases/integration-tests but missing acceptance-criteria/file-paths — isolates those two.
const NO_CRITERIA_NO_PATH = 'Handles the reject-empty-input edge case.\n\nCovered by a wiring test.';

describe('candidate selection (#252) — deterministic, decided-but-thin only', () => {
  it('selects an open issue/idea with a thin body and reports every gap', () => {
    const items = [item(10)];
    const cands = selectProposalCandidates(items, bodyMapReader({ 'backlog/10-slug.md': THIN }));
    expect(cands.map((c) => c.num)).toEqual(['10']);
    expect(cands[0].gaps).toEqual(['acceptance-criteria', 'file-paths', 'edge-cases', 'integration-tests']);
  });

  it('skips a fleshed-out item (criteria, path, edge-case, integration test, no overclaim)', () => {
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': FLESHED }));
    expect(cands).toEqual([]);
  });

  it('reports only the missing gaps when edge-cases/integration-tests are already named', () => {
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': NO_CRITERIA_NO_PATH }));
    expect(cands[0].gaps).toEqual(['acceptance-criteria', 'file-paths']);
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
    // path + edge-case + integration test present; acceptance-criteria is the one gap left.
    const onlyMissingCriteria = 'See `scripts/foo.mjs`. Handles the empty-input edge case. Covered by a wiring test.';
    const [r] = await propose([item(10)], { readBody: bodyMapReader({ 'backlog/10-slug.md': onlyMissingCriteria }), registry });
    expect(r.proposal.criteria).toBeTruthy();   // the missing one (acceptance-criteria) is drafted
    expect(r.proposal.paths).toBeUndefined();   // the satisfied one (file-paths) is left alone
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
});

describe('build-brief discipline (#2819) — edge-cases / integration-tests / overclaim-scope', () => {
  it('flags a missing edge-cases mention', () => {
    const body = '## Acceptance criteria\n- It works.\n\nEdits `scripts/foo.mjs`.\n\nCovered by an integration test.';
    const [c] = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(c.gaps).toEqual(['edge-cases']);
  });

  it('recognizes the hyphenated "edge-case(s)" spelling too, not only whitespace-separated', () => {
    // Regression: an earlier regex only tolerated whitespace between the words and missed the
    // hyphenated form this very statute's own prose uses throughout.
    const body = '## Acceptance criteria\n- It works.\n\nEdits `scripts/foo.mjs`.\n\nHandles the empty-input edge-case.\n\nCovered by an integration test.';
    const [c] = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(c).toBeUndefined();
  });

  it('a negated "no edge cases" disclaimer does not satisfy the check — it is still a gap', () => {
    // Regression for a red-team catch: a bare keyword-presence check is satisfied by its own denial.
    const body = '## Acceptance criteria\n- It works.\n\nEdits `scripts/foo.mjs`.\n\nNo edge cases apply here.\n\nCovered by an integration test.';
    const [c] = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(c.gaps).toEqual(['edge-cases']);
  });

  it('a negated "no integration test needed" disclaimer does not satisfy the check — it is still a gap', () => {
    const body = '## Acceptance criteria\n- It works.\n\nEdits `scripts/foo.mjs`.\n\n## Edge cases\n- Rejects empty input.\n\nNo integration test needed for this.';
    const [c] = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(c.gaps).toEqual(['integration-tests']);
  });

  it('flags a missing integration/wiring test (a unit-test mention alone does not satisfy it)', () => {
    const body = '## Acceptance criteria\n- It works.\n\nEdits `scripts/foo.mjs`.\n\n## Edge cases\n- Rejects empty input.\n\nCovered by a unit test.';
    const [c] = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(c.gaps).toEqual(['integration-tests']);
  });

  it('accepts "end-to-end test" as a synonym for integration/wiring — the phrase overclaim-scope nudges toward', () => {
    const body = '## Acceptance criteria\n- It works.\n\nEdits `scripts/foo.mjs`.\n\n## Edge cases\n- Rejects empty input.\n\nCovered by an end-to-end test.';
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(cands).toEqual([]);
  });

  it('flags overclaim-scope when the body claims to "close" something with no end-to-end demonstration', () => {
    const body = '## Acceptance criteria\n- It works.\n\nEdits `scripts/foo.mjs`.\n\n## Edge cases\n- Rejects empty input.'
      + '\n\nCovered by an integration test.\n\nThis closes the data-layer dodge.';
    const [c] = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(c.gaps).toEqual(['overclaim-scope']);
  });

  it('an ordinary `## Relation` cross-reference ("Fixes [#N]") never contains the word "closes" at all', () => {
    // Documents the shape, not a distinct exclusion: overclaimsScope only ever matches "closes", so a
    // "Fixes [#N]" relation line was never going to trip it — there is no "Fixes"-vs-"closes" special case.
    const body = FLESHED + '\n\n## Relation\nFixes [#2563].';
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(cands).toEqual([]); // every axis fleshed, and no "closes" token anywhere in the body
  });

  it('does not flag overclaim-scope when the claim is backed by "end-to-end"', () => {
    const body = FLESHED + '\n\nThis closes the gap end-to-end.';
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(cands).toEqual([]);
  });

  it('does not flag the bare verb "close" — only third-person "closes" reads as a scope claim', () => {
    // Regression for a red-team catch: "close attention", "close to done" are ordinary English, not a
    // scope-completion claim, and must not spuriously nudge overclaim-scope.
    const body = FLESHED + '\n\nWe pay close attention to this and are close to done.';
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(cands).toEqual([]);
  });

  it('does not flag the "closes over" JS-closure idiom as a scope claim', () => {
    const body = FLESHED + '\n\nThe callback closes over the loop variable, so each iteration captures its own copy.';
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(cands).toEqual([]);
  });

  it('does not flag a GitHub-style "closes #123" / "closes [#123]" issue auto-link as a scope claim', () => {
    // Regression for a red-team catch: this is a mechanical cross-reference (GitHub's own auto-close
    // convention), not a prose claim that the slice closes something end-to-end.
    const body = FLESHED + '\n\ncloses #123\n\ncloses [#456]';
    const cands = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(cands).toEqual([]);
  });

  it('an unrelated "end-to-end" mention in a DIFFERENT paragraph does not back an unearned "closes" claim', () => {
    // Regression for the co-occurrence gap a converge-loop juror caught: the check must not pass just
    // because "end-to-end" appears SOMEWHERE in the body — it must back the specific claim's paragraph.
    const body = FLESHED + '\n\nCovered by an end-to-end smoke test of the CLI wrapper.'
      + '\n\nThis closes the data-layer dodge.';
    const [c] = selectProposalCandidates([item(10)], bodyMapReader({ 'backlog/10-slug.md': body }));
    expect(c.gaps).toEqual(['overclaim-scope']);
  });

  it('reference proposer drafts an edge-case bullet, an integration-test nudge, and an overclaim warning', () => {
    const c = { gaps: ['edge-cases', 'integration-tests', 'overclaim-scope'], id: '10-slug', tags: [] };
    const p = referenceProposer.propose(c);
    expect(p.edgeCases).toBeTruthy();
    expect(p.integrationNote).toMatch(/integration|wiring/i);
    expect(p.overclaimWarning).toMatch(/end-to-end/i);
  });

  it('renders the new gaps as additional diff blocks, still `+`-prefixed only', async () => {
    const registry = registerReferenceProposers();
    const body = 'This closes the data-layer dodge.'; // every axis thin, plus an unearned "closes" claim
    const [r] = await propose([item(10)], { readBody: bodyMapReader({ 'backlog/10-slug.md': body }), registry });
    const diff = renderProposalDiff(r);
    expect(diff).toContain('## Edge cases');
    expect(diff).toContain('Integration-test note');
    expect(diff).toContain('Overclaim check');
    expect(diff.split('\n').every((l) => l.startsWith('+') || l.startsWith('---'))).toBe(true);
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
