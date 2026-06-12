/**
 * Runtime dev-mode capability guard (#268). Verifies the runtime diff against the active manifest:
 * in-capability use is silent, out-of-capability use warns once (dev), the prod path is stripped, and
 * a malformed manifest is flagged. Exercised against the shared #270 fixtures.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CORE_FEATURES, type CapabilityManifest } from '../provider.js';
import { CAPABILITY_FIXTURES } from '../fixtures.js';
import { guardCapability, guardCapabilities, __resetCapabilityGuardWarnings } from '../guard.js';

const validManifest = (): CapabilityManifest => ({
  specVersion: '1.0.0',
  conformanceLevel: 'L1',
  features: [...CORE_FEATURES],
  concerns: {},
});

describe('guardCapability (dev)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    __resetCapabilityGuardWarnings();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    process.env.NODE_ENV = prevEnv;
  });

  it('is silent and returns false for an in-capability feature', () => {
    const out = guardCapability(validManifest(), 'validation.feature.control-validity');
    expect(out).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns and returns true for an out-of-capability feature', () => {
    const out = guardCapability(validManifest(), 'validation.feature.async');
    expect(out).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('validation.feature.async');
  });

  it('warns only once for the same out-of-capability feature', () => {
    const m = validManifest();
    guardCapability(m, 'validation.feature.async');
    guardCapability(m, 'validation.feature.async');
    guardCapability(m, 'validation.feature.async');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('flags a malformed manifest as supporting nothing', () => {
    const out = guardCapability({ not: 'a manifest' } as unknown as CapabilityManifest, 'validation.feature.display');
    expect(out).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('no valid capability manifest');
  });
});

describe('guardCapabilities (bulk) against the #270 fixtures', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    __resetCapabilityGuardWarnings();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    process.env.NODE_ENV = prevEnv;
  });

  it('returns exactly each fixture’s expected out-of-capability set', () => {
    for (const f of CAPABILITY_FIXTURES) {
      __resetCapabilityGuardWarnings();
      const out = guardCapabilities(f.manifest, f.usedFeatures);
      expect(out, f.name).toEqual(f.expectedOutOfCapability);
    }
  });
});

describe('guardCapability (prod strip)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    __resetCapabilityGuardWarnings();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
    process.env.NODE_ENV = prevEnv;
  });

  it('still reports the diff but emits no warning in production', () => {
    const out = guardCapability(validManifest(), 'validation.feature.async');
    expect(out).toBe(true); // diff still computed
    expect(warn).not.toHaveBeenCalled(); // warning stripped
  });
});
