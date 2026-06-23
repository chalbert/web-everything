/**
 * Tests for the repro-bundle contract (#1664) — the shape's gate-check: the golden bundle round-trips
 * through serialize/deserialize, the validator rejects every malformed case the FUI viewer / plateau tool
 * rely on being absent, and the major-version gate is enforced. Mirrors `conformance-vectors/schema.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import {
  REPRO_BUNDLE_VERSION,
  ReproBundleSchemaError,
  assertReproBundle,
  deserializeReproBundle,
  isCompatibleVersion,
  reproBundleGolden,
  reproBundleJsonSchema,
  serializeReproBundle,
  invalidReproBundleCases,
} from '../index.js';

describe('repro-bundle contract (#1664)', () => {
  it('accepts the golden bundle and round-trips it byte-stable', () => {
    expect(() => assertReproBundle(reproBundleGolden)).not.toThrow();
    const json = serializeReproBundle(reproBundleGolden);
    const back = deserializeReproBundle(json);
    expect(back).toEqual(reproBundleGolden);
    // serialize(deserialize(x)) is a fixed point — the byte-stability a conforming writer must hold.
    expect(serializeReproBundle(back)).toBe(json);
  });

  it('exposes all four parts on the golden', () => {
    expect(reproBundleGolden.state.length).toBeGreaterThan(0);
    expect(reproBundleGolden.trace.length).toBeGreaterThan(0);
    expect(reproBundleGolden.rules.length).toBeGreaterThan(0);
    expect(reproBundleGolden.ownership.length).toBeGreaterThan(0);
  });

  it('rejects every malformed case with its declared error substring', () => {
    for (const c of invalidReproBundleCases) {
      let thrown: unknown;
      try {
        assertReproBundle(c.value);
      } catch (err) {
        thrown = err;
      }
      expect(thrown, `case "${c.label}" should throw`).toBeInstanceOf(ReproBundleSchemaError);
      expect((thrown as Error).message, `case "${c.label}"`).toContain(c.errorIncludes);
    }
  });

  it('enforces the major-version compatibility gate', () => {
    expect(isCompatibleVersion(REPRO_BUNDLE_VERSION)).toBe(true);
    expect(isCompatibleVersion('1.9.9')).toBe(true); // same major
    expect(isCompatibleVersion('2.0.0')).toBe(false);
    expect(isCompatibleVersion('nonsense')).toBe(false);
  });

  it('rejects invalid JSON on deserialize with a schema error', () => {
    expect(() => deserializeReproBundle('{not json')).toThrow(ReproBundleSchemaError);
  });

  it('ships a JSON schema whose required parts match the validator', () => {
    expect(reproBundleJsonSchema.required).toEqual(['version', 'capturedAtMs', 'state', 'trace', 'rules', 'ownership']);
    expect(reproBundleJsonSchema.properties.rules.items.properties.kind.enum).toEqual(['conformance', 'visibility', 'validation']);
  });
});
