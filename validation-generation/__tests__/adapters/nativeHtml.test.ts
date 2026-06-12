/**
 * Native-HTML validation adapter (#305). Pins the intent → constraint-attribute mapping and the
 * honest `unsupported[]` reporting for intents native attributes cannot express.
 */
import { describe, it, expect } from 'vitest';
import { nativeHtmlAdapter } from '../../adapters/nativeHtml.js';
import { assertValidationAdapter, type ValidationDeclaration } from '../../provider.js';

describe('nativeHtmlAdapter', () => {
  it('satisfies the CustomValidationAdapter contract', () => {
    expect(() => assertValidationAdapter(nativeHtmlAdapter)).not.toThrow();
    expect(nativeHtmlAdapter.key).toBe('native-html');
    expect(nativeHtmlAdapter.language).toBe('html');
  });

  it('emits native constraint attributes for the supported intents', () => {
    const decl: ValidationDeclaration = {
      field: 'username',
      constraints: [
        { intent: 'validation.intent.required' },
        { intent: 'validation.intent.min-length', value: 2 },
        { intent: 'validation.intent.max-length', value: 40 },
        { intent: 'validation.intent.pattern', value: '[a-z]+' },
      ],
    };
    const out = nativeHtmlAdapter.emit(decl);
    expect(out.code).toBe('required minlength="2" maxlength="40" pattern="[a-z]+"');
    expect(out.format).toBe('native-html');
    expect(out.unsupported).toEqual([]);
  });

  it('maps numeric range + type/format intents to the right attributes', () => {
    const decl: ValidationDeclaration = {
      field: 'age',
      constraints: [
        { intent: 'validation.intent.type', value: 'integer' },
        { intent: 'validation.intent.min', value: 0 },
        { intent: 'validation.intent.max', value: 120 },
        { intent: 'validation.intent.step', value: 1 },
      ],
    };
    expect(nativeHtmlAdapter.emit(decl).code).toBe('type="number" min="0" max="120" step="1"');

    const email: ValidationDeclaration = { field: 'contact', constraints: [{ intent: 'validation.intent.format', value: 'email' }] };
    expect(nativeHtmlAdapter.emit(email).code).toBe('type="email"');
  });

  it('reports collection/enum/custom intents as unsupported rather than dropping them silently', () => {
    const decl: ValidationDeclaration = {
      field: 'tags',
      constraints: [
        { intent: 'validation.intent.required' },
        { intent: 'validation.intent.min-items', value: 1 },
        { intent: 'validation.intent.enum', value: ['a', 'b'] },
        { intent: 'validation.intent.custom', value: 'isFoo' },
      ],
    };
    const out = nativeHtmlAdapter.emit(decl);
    expect(out.code).toBe('required');
    expect(out.unsupported).toEqual([
      'validation.intent.min-items',
      'validation.intent.enum',
      'validation.intent.custom',
    ]);
  });

  it('escapes attribute values', () => {
    const decl: ValidationDeclaration = { field: 'q', constraints: [{ intent: 'validation.intent.pattern', value: 'a"b&c' }] };
    expect(nativeHtmlAdapter.emit(decl).code).toBe('pattern="a&quot;b&amp;c"');
  });
});
