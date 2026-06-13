/**
 * Mock-vs-real drift check (#334). Proves the structural comparison: status, body shape (missing/extra
 * fields + type mismatches by JSON-Pointer), and content-type — value differences are NOT drift.
 */
import { describe, it, expect } from 'vitest';
import { detectDrift, type ContractResponse, type RecordedResponse } from '../driftCheck';

const contract = (over: Partial<ContractResponse> = {}): ContractResponse => ({
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  body: { id: 1, name: 'Ada', active: true },
  ...over,
});

describe('detectDrift (#334)', () => {
  it('no drift when the real response matches the contract shape (different values are fine)', () => {
    const actual: RecordedResponse = { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' }, body: { id: 99, name: 'Grace', active: false } };
    expect(detectDrift(contract(), actual)).toEqual({ drifted: false, findings: [] });
  });

  it('flags a status drift', () => {
    const r = detectDrift(contract(), { status: 404, body: { id: 1, name: 'x', active: true } });
    expect(r.drifted).toBe(true);
    expect(r.findings).toContainEqual({ kind: 'status', pointer: '', expected: '200', actual: '404' });
  });

  it('flags a missing field the contract promised, by JSON-Pointer', () => {
    const r = detectDrift(contract(), { status: 200, body: { id: 1, name: 'x' } }); // no `active`
    expect(r.findings).toContainEqual({ kind: 'missing-field', pointer: '/active', expected: 'boolean' });
  });

  it('flags an extra field the real service added', () => {
    const r = detectDrift(contract(), { status: 200, body: { id: 1, name: 'x', active: true, email: 'a@b.c' } });
    expect(r.findings).toContainEqual({ kind: 'extra-field', pointer: '/email', actual: 'string' });
  });

  it('flags a type mismatch (id became a string)', () => {
    const r = detectDrift(contract(), { status: 200, body: { id: '1', name: 'x', active: true } });
    expect(r.findings).toContainEqual({ kind: 'type-mismatch', pointer: '/id', expected: 'number', actual: 'string' });
  });

  it('walks nested objects and arrays against the first exemplar element', () => {
    const c = contract({ body: { items: [{ sku: 'A', qty: 1 }] } });
    const r = detectDrift(c, { status: 200, body: { items: [{ sku: 'A', qty: 2 }, { sku: 'B' }] } }); // 2nd item missing qty
    expect(r.findings).toContainEqual({ kind: 'missing-field', pointer: '/items/1/qty', expected: 'number' });
  });

  it('flags a content-type drift but ignores charset parameters', () => {
    const r = detectDrift(contract(), { status: 200, headers: { 'Content-Type': 'text/html' }, body: { id: 1, name: 'x', active: true } });
    expect(r.findings).toContainEqual({ kind: 'content-type', pointer: '', expected: 'application/json', actual: 'text/html' });
  });

  it('does not flag content-type when the contract declares none', () => {
    const c = contract({ headers: undefined });
    const r = detectDrift(c, { status: 200, headers: { 'content-type': 'text/plain' }, body: { id: 1, name: 'x', active: true } });
    expect(r.findings.some((f) => f.kind === 'content-type')).toBe(false);
  });
});
