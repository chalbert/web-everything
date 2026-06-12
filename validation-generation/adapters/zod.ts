/**
 * Zod validation adapter (#306, slice #085-C) — emits a Zod schema expression (TypeScript
 * runtime-validation target) from the neutral validation intents (#304). Zod is expressive enough to
 * carry the whole vocabulary, so every intent is in `intents[]`; the escape hatch (`custom`) lowers to
 * `.refine(<predicate>)` referencing a named predicate the consumer supplies.
 *
 * The emitter produces *source text* (a `z.…` chain), not a live schema — generation is the job, not
 * running validation (that is the consumer's, against the emitted schema).
 */
import {
  type CustomValidationAdapter,
  type ValidationConstraint,
  type ValidationDeclaration,
  type ValidationIntentId,
  unsupportedIntents,
} from '../provider.js';

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
  'validation.intent.min-items',
  'validation.intent.max-items',
  'validation.intent.enum',
  'validation.intent.custom',
];

/** A named string `format` → its Zod string refinement. */
const FORMAT_METHOD: Record<string, string> = {
  email: '.email()',
  url: '.url()',
  uuid: '.uuid()',
  'date-time': '.datetime()',
};

const has = (decl: ValidationDeclaration, intent: ValidationIntentId) =>
  decl.constraints.some((c) => c.intent === intent);

const find = (decl: ValidationDeclaration, intent: ValidationIntentId): ValidationConstraint | undefined =>
  decl.constraints.find((c) => c.intent === intent);

/** The Zod base expression — `enum` and collection sizing pick a non-string base. */
function base(decl: ValidationDeclaration): string {
  const enumC = find(decl, 'validation.intent.enum');
  if (enumC && Array.isArray(enumC.value)) {
    return `z.enum([${enumC.value.map((v) => JSON.stringify(v)).join(', ')}])`;
  }
  if (has(decl, 'validation.intent.min-items') || has(decl, 'validation.intent.max-items')) {
    return 'z.array(z.unknown())';
  }
  const type = String(find(decl, 'validation.intent.type')?.value ?? 'string');
  switch (type) {
    case 'number':
      return 'z.number()';
    case 'integer':
      return 'z.number().int()';
    case 'boolean':
      return 'z.boolean()';
    case 'date':
      return 'z.date()';
    default:
      return 'z.string()';
  }
}

export const zodAdapter: CustomValidationAdapter = {
  key: 'zod',
  format: 'Zod schema',
  language: 'typescript',
  intents: SUPPORTED,
  emit(declaration: ValidationDeclaration) {
    let expr = base(declaration);
    const enumChosen = expr.startsWith('z.enum');

    // String/format refinements (skipped when the base is an enum, which already constrains membership).
    if (!enumChosen) {
      const fmt = find(declaration, 'validation.intent.format');
      if (fmt) expr += FORMAT_METHOD[String(fmt.value)] ?? '';
      const minLen = find(declaration, 'validation.intent.min-length');
      if (minLen) expr += `.min(${Number(minLen.value)})`;
      const maxLen = find(declaration, 'validation.intent.max-length');
      if (maxLen) expr += `.max(${Number(maxLen.value)})`;
      const pattern = find(declaration, 'validation.intent.pattern');
      if (pattern) expr += `.regex(/${String(pattern.value)}/)`;

      // Numeric range (Zod's .min/.max mean value on number, length on string — base disambiguates).
      const min = find(declaration, 'validation.intent.min');
      if (min) expr += `.min(${Number(min.value)})`;
      const max = find(declaration, 'validation.intent.max');
      if (max) expr += `.max(${Number(max.value)})`;
      const step = find(declaration, 'validation.intent.step');
      if (step) expr += `.multipleOf(${Number(step.value)})`;

      // Collection sizing (on an array base).
      const minItems = find(declaration, 'validation.intent.min-items');
      if (minItems) expr += `.min(${Number(minItems.value)})`;
      const maxItems = find(declaration, 'validation.intent.max-items');
      if (maxItems) expr += `.max(${Number(maxItems.value)})`;
    }

    // Arbitrary predicate — the escape hatch lowers to a refinement referencing a named predicate.
    const custom = find(declaration, 'validation.intent.custom');
    if (custom) {
      const msg = custom.message ? `, ${JSON.stringify(custom.message)}` : '';
      expr += `.refine(${String(custom.value)}${msg})`;
    }

    // Optionality: a field with no `required` intent is optional in Zod.
    if (!has(declaration, 'validation.intent.required')) expr += '.optional()';

    return {
      format: 'zod',
      language: 'typescript',
      code: `const ${declaration.field} = ${expr};`,
      unsupported: unsupportedIntents(zodAdapter, declaration),
    };
  },
};
