/**
 * JSON-Schema validation adapter (#308). Pins the intent → JSON Schema keyword lowering, the
 * object-level `required` placement, and the `custom`-is-unsupported reporting.
 */
import { describe, it, expect } from 'vitest';
import { jsonSchemaAdapter } from '../../adapters/jsonSchema.js';
import { assertValidationAdapter, type ValidationDeclaration } from '../../provider.js';

describe('jsonSchemaAdapter', () => {
  it('satisfies the contract; declares everything except custom', () => {
    expect(() => assertValidationAdapter(jsonSchemaAdapter)).not.toThrow();
    expect(jsonSchemaAdapter.language).toBe('json');
    expect(jsonSchemaAdapter.intents).not.toContain('validation.intent.custom');
  });

  it('emits properties + object-level required with the constraint keywords', () => {
    const decl: ValidationDeclaration = {
      field: 'email',
      constraints: [
        { intent: 'validation.intent.required' },
        { intent: 'validation.intent.format', value: 'email' },
        { intent: 'validation.intent.max-length', value: 80 },
      ],
    };
    const out = jsonSchemaAdapter.emit(decl);
    expect(JSON.parse(out.code)).toEqual({
      properties: { email: { type: 'string', format: 'email', maxLength: 80 } },
      required: ['email'],
    });
    expect(out.unsupported).toEqual([]);
  });

  it('omits required for an optional field and maps numeric range + step', () => {
    const decl: ValidationDeclaration = {
      field: 'age',
      constraints: [
        { intent: 'validation.intent.type', value: 'integer' },
        { intent: 'validation.intent.min', value: 0 },
        { intent: 'validation.intent.max', value: 120 },
        { intent: 'validation.intent.step', value: 2 },
      ],
    };
    const parsed = JSON.parse(jsonSchemaAdapter.emit(decl).code);
    expect(parsed).toEqual({ properties: { age: { type: 'integer', minimum: 0, maximum: 120, multipleOf: 2 } } });
    expect(parsed.required).toBeUndefined();
  });

  it('maps url→uri format, enum, and collection sizing (array type)', () => {
    const url: ValidationDeclaration = { field: 'site', constraints: [{ intent: 'validation.intent.required' }, { intent: 'validation.intent.format', value: 'url' }] };
    expect(JSON.parse(jsonSchemaAdapter.emit(url).code).properties.site).toEqual({ type: 'string', format: 'uri' });

    const role: ValidationDeclaration = { field: 'role', constraints: [{ intent: 'validation.intent.required' }, { intent: 'validation.intent.enum', value: ['a', 'b'] }] };
    expect(JSON.parse(jsonSchemaAdapter.emit(role).code).properties.role).toEqual({ type: 'string', enum: ['a', 'b'] });

    const tags: ValidationDeclaration = { field: 'tags', constraints: [{ intent: 'validation.intent.min-items', value: 1 }, { intent: 'validation.intent.max-items', value: 5 }] };
    expect(JSON.parse(jsonSchemaAdapter.emit(tags).code).properties.tags).toEqual({ type: 'array', minItems: 1, maxItems: 5 });
  });

  it('reports custom as unsupported (no standard JSON Schema keyword)', () => {
    const decl: ValidationDeclaration = { field: 'slug', constraints: [{ intent: 'validation.intent.required' }, { intent: 'validation.intent.custom', value: 'isUnique' }] };
    expect(jsonSchemaAdapter.emit(decl).unsupported).toEqual(['validation.intent.custom']);
  });
});
