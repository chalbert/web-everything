/**
 * Pydantic validation adapter (#307). Pins the intent → Pydantic-v2 field-line lowering, optionality,
 * format/enum/collection type selection, and the `custom`-is-unsupported (needs a `@field_validator`)
 * reporting.
 */
import { describe, it, expect } from 'vitest';
import { pydanticAdapter } from '../../adapters/pydantic.js';
import { assertValidationAdapter, type ValidationDeclaration } from '../../provider.js';

describe('pydanticAdapter', () => {
  it('satisfies the contract; declares everything except custom', () => {
    expect(() => assertValidationAdapter(pydanticAdapter)).not.toThrow();
    expect(pydanticAdapter.language).toBe('python');
    expect(pydanticAdapter.intents).not.toContain('validation.intent.custom');
  });

  it('emits a required field with Field(...) constraints', () => {
    const decl: ValidationDeclaration = {
      field: 'username',
      constraints: [
        { intent: 'validation.intent.required' },
        { intent: 'validation.intent.min-length', value: 2 },
        { intent: 'validation.intent.max-length', value: 40 },
        { intent: 'validation.intent.pattern', value: '[a-z]+' },
      ],
    };
    const out = pydanticAdapter.emit(decl);
    expect(out.code).toBe('username: str = Field(min_length=2, max_length=40, pattern=r"[a-z]+")');
    expect(out.unsupported).toEqual([]);
  });

  it('wraps a non-required field as Optional with a None default', () => {
    const bare: ValidationDeclaration = { field: 'nickname', constraints: [{ intent: 'validation.intent.type', value: 'string' }] };
    expect(pydanticAdapter.emit(bare).code).toBe('nickname: Optional[str] = None');

    const withArgs: ValidationDeclaration = { field: 'age', constraints: [{ intent: 'validation.intent.type', value: 'integer' }, { intent: 'validation.intent.min', value: 0 }] };
    expect(pydanticAdapter.emit(withArgs).code).toBe('age: Optional[int] = Field(None, ge=0)');
  });

  it('selects EmailStr / Literal / list types from format / enum / collection intents', () => {
    const email: ValidationDeclaration = { field: 'contact', constraints: [{ intent: 'validation.intent.required' }, { intent: 'validation.intent.format', value: 'email' }] };
    expect(pydanticAdapter.emit(email).code).toBe('contact: EmailStr');

    const role: ValidationDeclaration = { field: 'role', constraints: [{ intent: 'validation.intent.required' }, { intent: 'validation.intent.enum', value: ['admin', 'user'] }] };
    expect(pydanticAdapter.emit(role).code).toBe('role: Literal["admin", "user"]');

    const tags: ValidationDeclaration = { field: 'tags', constraints: [{ intent: 'validation.intent.required' }, { intent: 'validation.intent.min-items', value: 1 }] };
    expect(pydanticAdapter.emit(tags).code).toBe('tags: list = Field(min_length=1)');
  });

  it('reports custom as unsupported (it needs a @field_validator)', () => {
    const decl: ValidationDeclaration = {
      field: 'slug',
      constraints: [{ intent: 'validation.intent.required' }, { intent: 'validation.intent.custom', value: 'is_unique' }],
    };
    const out = pydanticAdapter.emit(decl);
    expect(out.code).toBe('slug: str');
    expect(out.unsupported).toEqual(['validation.intent.custom']);
  });
});
