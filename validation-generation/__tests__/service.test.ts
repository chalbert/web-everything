/**
 * Validation-generation Mode-2 service (#309, slice #085-F) — the request-boundary delivery mode.
 *
 * Proves the second delivery mode is real and equivalent to Mode-1 (in-process `emit`): the same
 * adapters, reached through a JSON string boundary, produce the same artifacts — plus the boundary
 * contract (errors are a structured envelope, never thrown across the wire) and the #085 lossy-visible
 * rule (an unsupported intent is reported in `unsupported`, never dropped).
 */
import { describe, it, expect } from 'vitest';
import { handleValidationRequest, serveValidation } from '../service.js';
import { createDefaultValidationAdapterRegistry } from '../adapters/index.js';
import { createValidationAdapterRegistry } from '../registry.js';
import type { ValidationDeclaration, ValidationServiceResponse } from '../service.js';

const emailField: ValidationDeclaration = {
  field: 'email',
  constraints: [
    { intent: 'validation.intent.required' },
    { intent: 'validation.intent.format', value: 'email' },
    { intent: 'validation.intent.max-length', value: 254 },
  ],
};

describe('validation-generation Mode-2 service (#309)', () => {
  it('serves an artifact for the default (native-first) adapter', () => {
    const registry = createDefaultValidationAdapterRegistry();
    const res = handleValidationRequest({ declarations: [emailField] }, registry);

    expect(res.status).toBe('ok');
    expect(res.format).toBe('native-html'); // native-first default
    expect(res.artifacts).toHaveLength(1);
    expect(res.artifacts[0].field).toBe('email');
    expect(res.artifacts[0].code.length).toBeGreaterThan(0);
    expect(res.lossy).toBe(false);
  });

  it('routes to a named adapter (format key)', () => {
    const registry = createDefaultValidationAdapterRegistry();
    const res = handleValidationRequest({ format: 'json-schema', declarations: [emailField] }, registry);

    expect(res.status).toBe('ok');
    expect(res.format).toBe('json-schema');
    // The served code is the same the adapter emits in Mode-1 — the service is a delivery layer, not a re-impl.
    const mode1 = registry.resolve('json-schema').emit(emailField);
    expect(res.artifacts[0].code).toBe(mode1.code);
  });

  it('Mode-2 (boundary) and Mode-1 (in-process) produce identical artifacts', () => {
    const registry = createDefaultValidationAdapterRegistry();
    for (const key of registry.keys()) {
      const mode1 = registry.resolve(key).emit(emailField);
      const mode2 = handleValidationRequest({ format: key, declarations: [emailField] }, registry);
      expect(mode2.artifacts[0].code).toBe(mode1.code);
      expect(mode2.artifacts[0].unsupported).toEqual(mode1.unsupported);
    }
  });

  it('reports an unsupported intent as lossy, never drops it', () => {
    const registry = createDefaultValidationAdapterRegistry();
    // `custom` (arbitrary predicate) has no JSON-Schema keyword → the json-schema adapter can't emit it.
    const decl: ValidationDeclaration = { field: 'token', constraints: [{ intent: 'validation.intent.custom', value: 'isUnique' }] };
    const res = handleValidationRequest({ format: 'json-schema', declarations: [decl] }, registry);

    expect(res.status).toBe('ok');
    expect(res.lossy).toBe(true);
    expect(res.unsupported).toContain('validation.intent.custom');
    expect(res.diagnostics.join('\n')).toMatch(/does not emit validation\.intent\.custom/);
  });

  it('returns a structured error (never throws) for an unknown adapter', () => {
    const registry = createDefaultValidationAdapterRegistry();
    const res = handleValidationRequest({ format: 'does-not-exist', declarations: [emailField] }, registry);

    expect(res.status).toBe('error');
    expect(res.error).toMatch(/Unknown validation adapter "does-not-exist"/);
    expect(res.artifacts).toEqual([]);
  });

  it('returns a structured error for an empty registry (no default)', () => {
    const res = handleValidationRequest({ declarations: [emailField] }, createValidationAdapterRegistry());
    expect(res.status).toBe('error');
    expect(res.error).toMatch(/Unknown validation adapter/);
  });

  it('rejects a malformed request shape as a structured error', () => {
    const registry = createDefaultValidationAdapterRegistry();
    // @ts-expect-error — declarations missing on purpose.
    expect(handleValidationRequest({ format: 'zod' }, registry).error).toMatch(/"declarations" must be an array/);
    const badDecl = handleValidationRequest({ declarations: [{ field: '', constraints: [] }] }, registry);
    expect(badDecl.error).toMatch(/needs a non-empty "field"/);
  });

  describe('serveValidation — the JSON request boundary', () => {
    it('round-trips a request string to a response string', () => {
      const registry = createDefaultValidationAdapterRegistry();
      const out = serveValidation(JSON.stringify({ format: 'zod', declarations: [emailField] }), registry);
      const res = JSON.parse(out) as ValidationServiceResponse;
      expect(res.status).toBe('ok');
      expect(res.format).toBe('zod');
      expect(res.artifacts[0].code).toBe(registry.resolve('zod').emit(emailField).code);
    });

    it('returns a well-formed error envelope for invalid JSON (does not throw across the boundary)', () => {
      const registry = createDefaultValidationAdapterRegistry();
      const out = serveValidation('{ not json', registry);
      const res = JSON.parse(out) as ValidationServiceResponse;
      expect(res.status).toBe('error');
      expect(res.error).toMatch(/invalid JSON request/);
    });
  });
});
