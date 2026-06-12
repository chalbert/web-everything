/**
 * Native-HTML validation adapter (#305, slice #085-B) — the reference emitter that materializes the
 * neutral validation intents (#304) as native HTML Constraint Validation attributes
 * (`required` / `minlength` / `pattern` / `type` / …). Native-first: this is the adapter that proves
 * the registry contract against the platform's own constraint API, no library required.
 *
 * Honest about its reach: native single-control attributes cannot express collection sizing
 * (`min-items` / `max-items`), set membership (`enum` — that is `<select>`/`radio` structure, not an
 * input attribute), or an arbitrary predicate (`custom` — needs `setCustomValidity` in JS). Those are
 * therefore **not** in `intents[]`, so `emit()` reports them via `unsupported[]` rather than dropping
 * them silently.
 */
import {
  type CustomValidationAdapter,
  type ValidationConstraint,
  type ValidationDeclaration,
  type ValidationIntentId,
  unsupportedIntents,
} from '../provider.js';

/** The intents expressible as native HTML constraint attributes. */
const SUPPORTED: readonly ValidationIntentId[] = [
  'validation.intent.required',
  'validation.intent.type',
  'validation.intent.format',
  'validation.intent.min-length',
  'validation.intent.max-length',
  'validation.intent.pattern',
  'validation.intent.min',
  'validation.intent.max',
  'validation.intent.step',
];

/** A named string `format` → the native input `type` that enforces it, where one exists. */
const FORMAT_TO_INPUT_TYPE: Record<string, string> = {
  email: 'email',
  url: 'url',
  tel: 'tel',
};

/** A neutral `type` value → the native input `type`. */
const TYPE_TO_INPUT_TYPE: Record<string, string> = {
  email: 'email',
  url: 'url',
  number: 'number',
  integer: 'number',
  date: 'date',
  string: 'text',
};

/** Escape a double-quoted HTML attribute value. */
function attrValue(value: unknown): string {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** The native attribute(s) for one constraint, or `null` when this adapter does not express it. */
function attrFor(constraint: ValidationConstraint): string | null {
  switch (constraint.intent) {
    case 'validation.intent.required':
      return 'required';
    case 'validation.intent.min-length':
      return `minlength="${attrValue(constraint.value)}"`;
    case 'validation.intent.max-length':
      return `maxlength="${attrValue(constraint.value)}"`;
    case 'validation.intent.pattern':
      return `pattern="${attrValue(constraint.value)}"`;
    case 'validation.intent.min':
      return `min="${attrValue(constraint.value)}"`;
    case 'validation.intent.max':
      return `max="${attrValue(constraint.value)}"`;
    case 'validation.intent.step':
      return `step="${attrValue(constraint.value)}"`;
    case 'validation.intent.type': {
      const t = TYPE_TO_INPUT_TYPE[String(constraint.value)];
      return t ? `type="${t}"` : null;
    }
    case 'validation.intent.format': {
      const t = FORMAT_TO_INPUT_TYPE[String(constraint.value)];
      return t ? `type="${t}"` : null;
    }
    default:
      return null;
  }
}

export const nativeHtmlAdapter: CustomValidationAdapter = {
  key: 'native-html',
  format: 'Native HTML constraints',
  language: 'html',
  intents: SUPPORTED,
  emit(declaration: ValidationDeclaration) {
    const attrs: string[] = [];
    for (const c of declaration.constraints) {
      const attr = attrFor(c);
      if (attr !== null) attrs.push(attr);
    }
    return {
      format: 'native-html',
      language: 'html',
      code: attrs.join(' '),
      unsupported: unsupportedIntents(nativeHtmlAdapter, declaration),
    };
  },
};
