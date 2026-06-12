/**
 * JSON-Schema validation adapter (#308, slice #085-E) — emits a JSON Schema fragment (language-neutral
 * target) from the neutral validation intents (#304). Each constraint maps to a standard JSON Schema
 * keyword (`minLength` / `pattern` / `minimum` / `multipleOf` / `format` / `enum` / `minItems` / …);
 * `required` is expressed where JSON Schema actually carries it — on the enclosing object — so the
 * emitted fragment is `{ properties: { <field>: <schema> }, required: [<field>] }`.
 *
 * `custom` (an arbitrary predicate) has no standard JSON Schema keyword, so it is **not** in
 * `intents[]` and `emit()` reports it via `unsupported[]`.
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
];

const TYPE_TO_JSON: Record<string, string> = {
  string: 'string',
  number: 'number',
  integer: 'integer',
  boolean: 'boolean',
  date: 'string',
};

/** A named `format` → its JSON Schema `format` token (`url` is JSON Schema's `uri`). */
const FORMAT_TOKEN: Record<string, string> = {
  email: 'email',
  url: 'uri',
  uuid: 'uuid',
  'date-time': 'date-time',
};

const find = (decl: ValidationDeclaration, intent: ValidationIntentId): ValidationConstraint | undefined =>
  decl.constraints.find((c) => c.intent === intent);
const has = (decl: ValidationDeclaration, intent: ValidationIntentId) =>
  decl.constraints.some((c) => c.intent === intent);

/** Build the field's JSON Schema object (insertion order drives the serialized key order). */
function fieldSchema(decl: ValidationDeclaration): Record<string, unknown> {
  const schema: Record<string, unknown> = {};

  if (has(decl, 'validation.intent.min-items') || has(decl, 'validation.intent.max-items')) {
    schema.type = 'array';
  } else {
    const type = String(find(decl, 'validation.intent.type')?.value ?? 'string');
    schema.type = TYPE_TO_JSON[type] ?? 'string';
  }

  const fmt = find(decl, 'validation.intent.format');
  if (fmt && FORMAT_TOKEN[String(fmt.value)]) schema.format = FORMAT_TOKEN[String(fmt.value)];
  else if (String(find(decl, 'validation.intent.type')?.value) === 'date') schema.format = 'date';

  const minLen = find(decl, 'validation.intent.min-length');
  if (minLen) schema.minLength = Number(minLen.value);
  const maxLen = find(decl, 'validation.intent.max-length');
  if (maxLen) schema.maxLength = Number(maxLen.value);
  const pattern = find(decl, 'validation.intent.pattern');
  if (pattern) schema.pattern = String(pattern.value);

  const min = find(decl, 'validation.intent.min');
  if (min) schema.minimum = Number(min.value);
  const max = find(decl, 'validation.intent.max');
  if (max) schema.maximum = Number(max.value);
  const step = find(decl, 'validation.intent.step');
  if (step) schema.multipleOf = Number(step.value);

  const minItems = find(decl, 'validation.intent.min-items');
  if (minItems) schema.minItems = Number(minItems.value);
  const maxItems = find(decl, 'validation.intent.max-items');
  if (maxItems) schema.maxItems = Number(maxItems.value);

  const enumC = find(decl, 'validation.intent.enum');
  if (enumC && Array.isArray(enumC.value)) schema.enum = enumC.value;

  return schema;
}

export const jsonSchemaAdapter: CustomValidationAdapter = {
  key: 'json-schema',
  format: 'JSON Schema',
  language: 'json',
  intents: SUPPORTED,
  emit(declaration: ValidationDeclaration) {
    const fragment: Record<string, unknown> = {
      properties: { [declaration.field]: fieldSchema(declaration) },
    };
    if (has(declaration, 'validation.intent.required')) fragment.required = [declaration.field];

    return {
      format: 'json-schema',
      language: 'json',
      code: JSON.stringify(fragment, null, 2),
      unsupported: unsupportedIntents(jsonSchemaAdapter, declaration),
    };
  },
};
