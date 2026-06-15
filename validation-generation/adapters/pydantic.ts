/**
 * Pydantic validation adapter (#307, slice #085-E) — emits a Pydantic v2 model field (Python target)
 * from the neutral validation intents (#304). A constraint maps to a `Field(...)` argument
 * (`min_length` / `pattern` / `ge` / `le` / `multiple_of` / …) or to the field's type
 * (`EmailStr` / `HttpUrl` / `Literal[…]` / `list[…]`); optionality is `Optional[T] = None`.
 *
 * One intent does not fit a single field line: `custom` (an arbitrary predicate) needs a separate
 * `@field_validator` method in Pydantic, so it is **not** in `intents[]` — `emit()` reports it via
 * `unsupported[]` rather than pretending the field line carries it.
 */
import {
  type CustomValidationAdapter,
  type ValidationConstraint,
  type ValidationDeclaration,
  type ValidationIntentId,
  type GeneratedCrossField,
  unsupportedIntents,
} from '../provider.js';
import { transpileRules, PY_DIALECT } from '../cel.js';

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

const TYPE_TO_PY: Record<string, string> = {
  string: 'str',
  number: 'float',
  integer: 'int',
  boolean: 'bool',
  date: 'date',
};

const FORMAT_TO_PY_TYPE: Record<string, string> = {
  email: 'EmailStr',
  url: 'HttpUrl',
};

const find = (decl: ValidationDeclaration, intent: ValidationIntentId): ValidationConstraint | undefined =>
  decl.constraints.find((c) => c.intent === intent);
const has = (decl: ValidationDeclaration, intent: ValidationIntentId) =>
  decl.constraints.some((c) => c.intent === intent);

/** The Python type annotation — enum/format/collection override the plain scalar `type`. */
function pyType(decl: ValidationDeclaration): string {
  const enumC = find(decl, 'validation.intent.enum');
  if (enumC && Array.isArray(enumC.value)) {
    return `Literal[${enumC.value.map((v) => JSON.stringify(v)).join(', ')}]`;
  }
  if (has(decl, 'validation.intent.min-items') || has(decl, 'validation.intent.max-items')) return 'list';
  const fmt = find(decl, 'validation.intent.format');
  if (fmt && FORMAT_TO_PY_TYPE[String(fmt.value)]) return FORMAT_TO_PY_TYPE[String(fmt.value)];
  return TYPE_TO_PY[String(find(decl, 'validation.intent.type')?.value ?? 'string')] ?? 'str';
}

/** The `Field(...)` keyword arguments for the numeric/string/collection constraints. */
function fieldArgs(decl: ValidationDeclaration): string[] {
  const args: string[] = [];
  const minLen = find(decl, 'validation.intent.min-length') ?? find(decl, 'validation.intent.min-items');
  if (minLen) args.push(`min_length=${Number(minLen.value)}`);
  const maxLen = find(decl, 'validation.intent.max-length') ?? find(decl, 'validation.intent.max-items');
  if (maxLen) args.push(`max_length=${Number(maxLen.value)}`);
  const pattern = find(decl, 'validation.intent.pattern');
  if (pattern) args.push(`pattern=r${JSON.stringify(String(pattern.value))}`);
  const min = find(decl, 'validation.intent.min');
  if (min) args.push(`ge=${Number(min.value)}`);
  const max = find(decl, 'validation.intent.max');
  if (max) args.push(`le=${Number(max.value)}`);
  const step = find(decl, 'validation.intent.step');
  if (step) args.push(`multiple_of=${Number(step.value)}`);
  return args;
}

export const pydanticAdapter: CustomValidationAdapter = {
  key: 'pydantic',
  format: 'Pydantic model field',
  language: 'python',
  intents: SUPPORTED,
  emit(declaration: ValidationDeclaration) {
    const required = has(declaration, 'validation.intent.required');
    const args = fieldArgs(declaration);
    let annotation = pyType(declaration);
    if (!required) annotation = `Optional[${annotation}]`;

    let rhs: string;
    if (args.length > 0) {
      rhs = ` = Field(${required ? '' : 'None, '}${args.join(', ')})`;
    } else {
      rhs = required ? '' : ' = None';
    }

    return {
      format: 'pydantic',
      language: 'python',
      code: `${declaration.field}: ${annotation}${rhs}`,
      unsupported: unsupportedIntents(pydanticAdapter, declaration),
    };
  },

  // Cross-field (#504): CEL → a Pydantic v2 `@model_validator(mode='after')` method that raises on each
  // failing rule. Model-scoped (`self.<field>`), the idiomatic home for a multi-field constraint.
  emitCrossField(declaration: ValidationDeclaration): GeneratedCrossField {
    const rules = declaration.crossField ?? [];
    const { transpiled, unsupported } = transpileRules(rules, PY_DIALECT);
    const checks = transpiled
      .map((t) => `        if not ${t.code}:\n            raise ValueError(${JSON.stringify(t.message ?? `cross-field rule failed: ${t.rule}`)})`)
      .join('\n');
    const code = transpiled.length
      ? `    @model_validator(mode='after')\n    def _cross_field(self):\n${checks}\n        return self`
      : `    # no cross-field rules emitted for "${declaration.field}"`;
    return { format: 'pydantic', language: 'python', code, unsupportedRules: unsupported };
  },
};
