/**
 * The portable Mode-1 cross-field layer (#504, ratified end-state of #465).
 *
 * Cross-field is an **optional, advertised, flag-lossy** capability — **Mode-2 (the server) stays the
 * authoritative default**, so this is an offline/static-emission enhancement, not a replacement. Two
 * boundary-open seams around the CEL pivot ({@link ./cel}):
 *
 *  - **Forward** ({@link emitCrossFieldOrFallback}): an adapter that advertises
 *    `validation.feature.cross-field` (implements `emitCrossField`) transpiles the CEL rules to its
 *    idiom; one that does not advertises **absence**, and the rules degrade to the Mode-2 service —
 *    reported, never silently dropped.
 *  - **Ingest** ({@link jsonLogicToCel}): normalize a non-CEL boundary source (here JSONLogic) *into* the
 *    CEL pivot, so a project's generator can speak any format and still produce WE-compliant components.
 */
import {
  type CustomValidationAdapter,
  type ValidationDeclaration,
  type GeneratedCrossField,
  CROSS_FIELD_FEATURE,
  supportsCrossField,
} from './provider.js';

/** The result of attempting cross-field emit through an adapter — Mode-1 when supported, Mode-2 fallback otherwise. */
export type CrossFieldOutcome =
  | { readonly mode: 1; readonly feature: typeof CROSS_FIELD_FEATURE; readonly generated: GeneratedCrossField }
  | {
      readonly mode: 2;
      readonly feature: typeof CROSS_FIELD_FEATURE;
      readonly supported: false;
      readonly rules: readonly string[];
      readonly reason: string;
    };

/**
 * Emit a declaration's cross-field rules through `adapter`, or fall back to Mode-2. A cross-field-capable
 * adapter (one advertising `validation.feature.cross-field`) emits Mode-1; otherwise the rules are
 * reported as degrading to the authoritative Mode-2 service (the capability is absent, never a silent
 * no-op). A declaration with no cross-field rules is Mode-1 with empty output.
 */
export function emitCrossFieldOrFallback(
  adapter: CustomValidationAdapter,
  declaration: ValidationDeclaration,
): CrossFieldOutcome {
  if (supportsCrossField(adapter)) {
    return { mode: 1, feature: CROSS_FIELD_FEATURE, generated: adapter.emitCrossField!(declaration) };
  }
  return {
    mode: 2,
    feature: CROSS_FIELD_FEATURE,
    supported: false,
    rules: (declaration.crossField ?? []).map((r) => r.rule),
    reason: `adapter "${adapter.key}" does not advertise ${CROSS_FIELD_FEATURE}; cross-field degrades to the authoritative Mode-2 service`,
  };
}

// ---- ingest: JSONLogic → CEL (boundary-open) -------------------------------
const JSONLOGIC_BINARY: Record<string, string> = {
  '>': '>', '>=': '>=', '<': '<', '<=': '<=', '==': '==', '===': '==', '!=': '!=', '!==': '!=',
  '+': '+', '-': '-', '*': '*', '/': '/', '%': '%',
};
const JSONLOGIC_VARIADIC: Record<string, string> = { and: '&&', or: '||' };

/** Thrown by {@link jsonLogicToCel} for a JSONLogic operator outside the ingestable subset. */
export class JsonLogicIngestError extends Error {
  constructor(reason: string) {
    super(`JSONLogic ingest error — ${reason}`);
    this.name = 'JsonLogicIngestError';
  }
}

function celLiteral(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  throw new JsonLogicIngestError(`unsupported literal: ${JSON.stringify(value)}`);
}

/**
 * Normalize a JSONLogic rule into the canonical CEL pivot string. Supports `var`, the binary
 * comparison/arithmetic operators, the variadic `and`/`or`, and unary `!` — the cross-field subset.
 * An operator outside it raises {@link JsonLogicIngestError} (the boundary stays explicit, not lossy-silent).
 */
export function jsonLogicToCel(node: unknown): string {
  if (node === null || typeof node !== 'object') return celLiteral(node);
  if (Array.isArray(node)) throw new JsonLogicIngestError('bare arrays are not a JSONLogic rule');

  const keys = Object.keys(node as Record<string, unknown>);
  if (keys.length !== 1) throw new JsonLogicIngestError(`a rule must have exactly one operator (got ${keys.length})`);
  const op = keys[0];
  const arg = (node as Record<string, unknown>)[op];

  if (op === 'var') {
    const path = Array.isArray(arg) ? arg[0] : arg;
    if (typeof path !== 'string') throw new JsonLogicIngestError('"var" needs a string path');
    return path;
  }
  if (op === '!') {
    const operand = Array.isArray(arg) ? arg[0] : arg;
    return `!(${jsonLogicToCel(operand)})`;
  }
  if (JSONLOGIC_VARIADIC[op]) {
    if (!Array.isArray(arg) || arg.length < 2) throw new JsonLogicIngestError(`"${op}" needs ≥2 operands`);
    return `(${arg.map(jsonLogicToCel).join(` ${JSONLOGIC_VARIADIC[op]} `)})`;
  }
  if (JSONLOGIC_BINARY[op]) {
    if (!Array.isArray(arg) || arg.length !== 2) throw new JsonLogicIngestError(`"${op}" needs exactly 2 operands`);
    return `(${jsonLogicToCel(arg[0])} ${JSONLOGIC_BINARY[op]} ${jsonLogicToCel(arg[1])})`;
  }
  throw new JsonLogicIngestError(`unsupported operator "${op}"`);
}
