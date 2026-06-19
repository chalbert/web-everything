/**
 * Tests for the conformance-vector schema + validator (#1016) — the pattern's gate-check: the exemplar
 * suite must pass `assertConformanceSuite`, and the validator must reject the malformed shapes the
 * FUI/plateau driver relies on being absent.
 */
import { describe, it, expect } from 'vitest';
import {
  assertConformanceSuite,
  ConformanceSchemaError,
  conformanceSuites,
  validatorResolutionSuite,
  type ConformanceVectorSuite,
} from '../index.js';

describe('conformance-vectors schema (#1016)', () => {
  it('the exemplar validator-resolution suite is well-formed', () => {
    expect(() => assertConformanceSuite(validatorResolutionSuite)).not.toThrow();
    expect(validatorResolutionSuite.standard).toBe('validator-resolution');
    expect(validatorResolutionSuite.vectors.length).toBeGreaterThanOrEqual(1);
  });

  it('every shipped suite in the registry passes the schema', () => {
    for (const suite of conformanceSuites) {
      expect(() => assertConformanceSuite(suite), suite.standard).not.toThrow();
    }
  });

  it('the canonical #899 temporal vector is preserved verbatim', () => {
    const v = validatorResolutionSuite.vectors.find(
      (x) => x.id === 'validator-resolution/versioning/stale-async-dropped',
    );
    expect(v).toBeDefined();
    expect(v!.expect.neverObserved).toEqual([{ renderedMessage: 'taken' }]);
    expect(v!.expect.finalState).toBe('valid');
    expect(v!.observeVia).toContain('validity');
  });

  it('rejects a suite with no vectors', () => {
    const bad = { standard: 's', contract: '@x/s', vectors: [] } as ConformanceVectorSuite;
    expect(() => assertConformanceSuite(bad)).toThrow(ConformanceSchemaError);
  });

  it('rejects duplicate vector ids', () => {
    const dup = validatorResolutionSuite.vectors[0];
    const bad: ConformanceVectorSuite = {
      standard: 's',
      contract: '@x/s',
      vectors: [dup, dup],
    };
    expect(() => assertConformanceSuite(bad)).toThrow(/duplicate vector id/);
  });

  it('rejects a step with no `do` verb', () => {
    const bad: ConformanceVectorSuite = {
      standard: 's',
      contract: '@x/s',
      vectors: [
        {
          id: 's/x/y',
          contract: '@x/s',
          steps: [{ atMs: 0 } as unknown as { do: string }],
          expect: { finalState: 'valid' },
          observeVia: ['validity'],
        },
      ],
    };
    expect(() => assertConformanceSuite(bad)).toThrow(/no `do` verb/);
  });

  it('rejects a vector with no observeVia surface', () => {
    const bad: ConformanceVectorSuite = {
      standard: 's',
      contract: '@x/s',
      vectors: [
        { id: 's/x/y', contract: '@x/s', steps: [{ do: 'setInput' }], expect: { finalState: 'valid' }, observeVia: [] },
      ],
    };
    expect(() => assertConformanceSuite(bad)).toThrow(/observeVia/);
  });
});
