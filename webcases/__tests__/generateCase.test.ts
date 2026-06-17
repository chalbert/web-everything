// Conformance-case generator (#868) — the AI-proposes/standard-verifies loop for webcases. Asserts the
// injected proposer is the only "AI" (the core imports no SDK), that the deterministic validator is the
// authority (an ungrounded proposal is rejected and never compiled), that verifier findings steer a
// bounded retry, and that a grounded record projects to webcase(s). Pure + offline — stub proposers only.
import { describe, it, expect, vi } from 'vitest';
import type { RequirementRecord, RequirementRegistries } from '../requirementValidator';
import { generateCase, heuristicProposer } from '../generateCase';

const registries: RequirementRegistries = {
  intents: [{ id: 'validation', dimensions: { execution: { values: ['blur', 'submit'] } } }],
  semantics: [{ term: 'Commit Policy' }],
  protocols: [{ id: 'validation' }],
  personas: ['end-user'],
};

const grounded: RequirementRecord = {
  description: 'validation errors surface immediately on blur',
  given: { intent: 'validation', dimension: 'execution', value: 'blur' },
  when: { event: 'Commit Policy' },
  then: { protocol: 'validation', observe: 'invalid-state-announced', tier: 'L1' },
};

describe('generateCase — AI proposes, standard verifies', () => {
  it('compiles a webcase when the proposed record grounds', async () => {
    const propose = vi.fn().mockReturnValue(grounded);
    const res = await generateCase('errors on blur', { propose, registries });
    expect(res.accepted).toBe(true);
    expect(res.validation.valid).toBe(true);
    expect(res.cases).toHaveLength(1);
    expect(res.cases[0].code).toContain('Given validation.execution = blur');
    expect(propose).toHaveBeenCalledTimes(1);
  });

  it('REJECTS an ungrounded proposal and never compiles it (the verify gate)', async () => {
    const ungrounded: RequirementRecord = {
      ...grounded,
      given: { intent: 'nonexistent', dimension: 'x', value: 'y' },
    };
    const res = await generateCase('bad', { propose: () => ungrounded, registries, maxAttempts: 1 });
    expect(res.accepted).toBe(false);
    expect(res.cases).toHaveLength(0);
    expect(res.validation.findings.some((f) => f.slot === 'given.intent' && f.severity === 'error')).toBe(true);
  });

  it('feeds findings back to the proposer and accepts on a corrected retry', async () => {
    const seen: number[] = [];
    const propose = (_nl: string, ctx: { previousFindings: readonly unknown[] }) => {
      seen.push(ctx.previousFindings.length);
      // first attempt ungrounded, second (once it has seen findings) grounded
      return ctx.previousFindings.length === 0
        ? { ...grounded, when: { event: 'No Such Term' } }
        : grounded;
    };
    const res = await generateCase('x', { propose, registries, maxAttempts: 3 });
    expect(res.accepted).toBe(true);
    expect(res.attempts).toHaveLength(2);
    // first round saw no findings; the second saw the prior round's (≥1 — the ungrounded when.event error)
    expect(seen[0]).toBe(0);
    expect(seen[1]).toBeGreaterThan(0);
  });

  it('stops after maxAttempts and returns the last rejected attempt', async () => {
    const propose = vi.fn().mockReturnValue({ ...grounded, then: { protocol: 'ghost', observe: 'x', tier: 'L9' } });
    const res = await generateCase('never grounds', { propose, registries, maxAttempts: 2 });
    expect(res.accepted).toBe(false);
    expect(res.attempts).toHaveLength(2);
    expect(propose).toHaveBeenCalledTimes(2);
  });

  it('awaits an async (Plateau-served) proposer', async () => {
    const propose = async () => grounded;
    const res = await generateCase('async', { propose, registries });
    expect(res.accepted).toBe(true);
  });
});

describe('heuristicProposer — dependency-free offline fallback (not the AI)', () => {
  it('grounds a description that names real registry ids', () => {
    const rec = heuristicProposer('validation on blur triggers Commit Policy', { registries });
    expect(rec.given).toEqual({ intent: 'validation', dimension: 'execution', value: 'blur' });
    expect(rec.when.event).toBe('Commit Policy');
    expect(rec.then.protocol).toBe('validation');
    // end-to-end: heuristic proposal grounds + compiles through the real validator
    return generateCase('validation on blur triggers Commit Policy', { propose: heuristicProposer, registries })
      .then((res) => expect(res.accepted).toBe(true));
  });

  it('falls back to first-entry slots when nothing is named (still a well-formed record)', () => {
    const rec = heuristicProposer('something vague', { registries });
    expect(rec.given.intent).toBe('validation');
    expect(rec.given.value).toBe('blur');
  });
});
