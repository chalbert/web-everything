/**
 * The portable Mode-1 cross-field layer (#504, ratified end-state of #465) — the acceptance:
 *  - a CEL cross-field rule emits to ≥2 Mode-1 targets via forward adapters (Zod + Pydantic);
 *  - an adapter that doesn't advertise the capability reports absence → degrades to the Mode-2 service;
 *  - a non-CEL boundary source (JSONLogic) normalizes *into* the CEL pivot (ingest).
 */
import { describe, it, expect } from 'vitest';
import { zodAdapter } from '../adapters/zod';
import { pydanticAdapter } from '../adapters/pydantic';
import { nativeHtmlAdapter } from '../adapters/nativeHtml';
import {
  supportsCrossField, crossFieldFeatureFor, CROSS_FIELD_FEATURE, type ValidationDeclaration,
} from '../provider';
import { emitCrossFieldOrFallback, jsonLogicToCel, JsonLogicIngestError } from '../crossField';

const decl: ValidationDeclaration = {
  field: 'booking',
  constraints: [],
  crossField: [
    { rule: 'endDate > startDate', message: 'End date must be after start date' },
    { rule: "category == 'gift' ? giftLetter != null : true", message: 'A gift needs a gift letter' },
  ],
};

describe('advertisement (the manifest feature)', () => {
  it('Zod + Pydantic advertise cross-field; native-HTML + others do not', () => {
    expect(supportsCrossField(zodAdapter)).toBe(true);
    expect(supportsCrossField(pydanticAdapter)).toBe(true);
    expect(supportsCrossField(nativeHtmlAdapter)).toBe(false);
    expect(crossFieldFeatureFor(zodAdapter)).toBe(CROSS_FIELD_FEATURE);
    expect(crossFieldFeatureFor(nativeHtmlAdapter)).toBeNull();
  });
});

describe('forward emit — ≥2 Mode-1 targets (acceptance)', () => {
  it('Zod transpiles CEL → a .refine() chain', () => {
    const g = zodAdapter.emitCrossField!(decl);
    expect(g.format).toBe('zod');
    expect(g.unsupportedRules).toEqual([]);
    expect(g.code).toContain('.refine((data) => (data.endDate > data.startDate), { message: "End date must be after start date" })');
    expect(g.code).toContain('(data.category === "gift") ? (data.giftLetter !== null) : true');
  });

  it('Pydantic transpiles CEL → a model_validator method', () => {
    const g = pydanticAdapter.emitCrossField!(decl);
    expect(g.format).toBe('pydantic');
    expect(g.unsupportedRules).toEqual([]);
    expect(g.code).toContain("@model_validator(mode='after')");
    expect(g.code).toContain('if not (self.endDate > self.startDate):');
    expect(g.code).toContain('raise ValueError("End date must be after start date")');
  });

  it('reports a rule outside the CEL subset rather than mis-transpiling it', () => {
    const g = zodAdapter.emitCrossField!({ field: 'f', constraints: [], crossField: [{ rule: 'has(x)' }] });
    expect(g.unsupportedRules).toEqual(['has(x)']);
    expect(g.code).toContain('no cross-field rules emitted');
  });
});

describe('fallback — Mode-2 is the authoritative default', () => {
  it('a supporting adapter emits Mode-1', () => {
    const out = emitCrossFieldOrFallback(zodAdapter, decl);
    expect(out.mode).toBe(1);
    if (out.mode === 1) expect(out.generated.code).toContain('.refine');
  });

  it('a non-supporting adapter advertises absence → degrades to Mode-2', () => {
    const out = emitCrossFieldOrFallback(nativeHtmlAdapter, decl);
    expect(out.mode).toBe(2);
    if (out.mode === 2) {
      expect(out.supported).toBe(false);
      expect(out.feature).toBe(CROSS_FIELD_FEATURE);
      expect(out.rules).toEqual(['endDate > startDate', "category == 'gift' ? giftLetter != null : true"]);
      expect(out.reason).toContain('Mode-2');
    }
  });
});

describe('ingest — JSONLogic → CEL pivot (boundary-open)', () => {
  it('normalizes comparison + var into CEL', () => {
    expect(jsonLogicToCel({ '>': [{ var: 'endDate' }, { var: 'startDate' }] })).toBe('(endDate > startDate)');
  });

  it('normalizes variadic and/or + literals', () => {
    expect(jsonLogicToCel({ and: [{ '==': [{ var: 'a' }, 'x'] }, { '!=': [{ var: 'b' }, null] }] }))
      .toBe('((a == "x") && (b != null))');
  });

  it('round-trips JSONLogic → CEL → a Zod refine', () => {
    const cel = jsonLogicToCel({ '>': [{ var: 'endDate' }, { var: 'startDate' }] });
    const g = zodAdapter.emitCrossField!({ field: 'f', constraints: [], crossField: [{ rule: cel }] });
    expect(g.unsupportedRules).toEqual([]);
    expect(g.code).toContain('(data.endDate > data.startDate)');
  });

  it('raises on an operator outside the ingest subset', () => {
    expect(() => jsonLogicToCel({ cat: ['a', 'b'] })).toThrow(JsonLogicIngestError);
  });
});
