/**
 * Zod validation adapter (#306). Pins the intent → `z.…` chain lowering, optionality, enum/array
 * bases, and the `custom` → `.refine()` escape hatch.
 */
import { describe, it, expect } from 'vitest';
import { zodAdapter } from '../../adapters/zod.js';
import { assertValidationAdapter, type ValidationDeclaration } from '../../provider.js';

describe('zodAdapter', () => {
  it('satisfies the contract and declares full intent compliance', () => {
    expect(() => assertValidationAdapter(zodAdapter)).not.toThrow();
    expect(zodAdapter.key).toBe('zod');
    expect(zodAdapter.intents).toContain('validation.intent.custom');
  });

  it('emits a required string schema with length, pattern and format refinements', () => {
    const decl: ValidationDeclaration = {
      field: 'email',
      constraints: [
        { intent: 'validation.intent.required' },
        { intent: 'validation.intent.format', value: 'email' },
        { intent: 'validation.intent.max-length', value: 80 },
      ],
    };
    const out = zodAdapter.emit(decl);
    expect(out.code).toBe('const email = z.string().email().max(80);');
    expect(out.language).toBe('typescript');
    expect(out.unsupported).toEqual([]);
  });

  it('marks a field with no required intent as .optional()', () => {
    const decl: ValidationDeclaration = { field: 'nickname', constraints: [{ intent: 'validation.intent.min-length', value: 2 }] };
    expect(zodAdapter.emit(decl).code).toBe('const nickname = z.string().min(2).optional();');
  });

  it('uses a numeric base with range + step', () => {
    const decl: ValidationDeclaration = {
      field: 'age',
      constraints: [
        { intent: 'validation.intent.required' },
        { intent: 'validation.intent.type', value: 'integer' },
        { intent: 'validation.intent.min', value: 0 },
        { intent: 'validation.intent.max', value: 120 },
        { intent: 'validation.intent.step', value: 2 },
      ],
    };
    expect(zodAdapter.emit(decl).code).toBe('const age = z.number().int().min(0).max(120).multipleOf(2);');
  });

  it('lowers enum to z.enum and collection sizing to an array base', () => {
    const enumDecl: ValidationDeclaration = {
      field: 'role',
      constraints: [{ intent: 'validation.intent.required' }, { intent: 'validation.intent.enum', value: ['admin', 'user'] }],
    };
    expect(zodAdapter.emit(enumDecl).code).toBe('const role = z.enum(["admin", "user"]);');

    const arrDecl: ValidationDeclaration = {
      field: 'tags',
      constraints: [{ intent: 'validation.intent.required' }, { intent: 'validation.intent.min-items', value: 1 }],
    };
    expect(zodAdapter.emit(arrDecl).code).toBe('const tags = z.array(z.unknown()).min(1);');
  });

  it('lowers custom to .refine(predicate, message)', () => {
    const decl: ValidationDeclaration = {
      field: 'slug',
      constraints: [
        { intent: 'validation.intent.required' },
        { intent: 'validation.intent.custom', value: 'isUniqueSlug', message: 'must be unique' },
      ],
    };
    expect(zodAdapter.emit(decl).code).toBe('const slug = z.string().refine(isUniqueSlug, "must be unique");');
  });
});
