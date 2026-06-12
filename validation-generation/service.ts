/**
 * Validation-generation **Mode-2** — the generation *service* (#309, slice #085-F).
 *
 * #085 promises validation generation is offered **two ways, not one enforced way**:
 *
 *  - **Mode-1 — in-process emit.** Import an adapter and call `adapter.emit(declaration)` →
 *    `GeneratedValidation`. Object in, object out, same address space. This is `provider.ts` +
 *    `adapters/*` (#305–#308).
 *  - **Mode-2 — the generation service (this file).** Serialize a request, cross a **request
 *    boundary**, get the emitted artifact back serialized. **String in, string out, one concrete wire
 *    format (JSON).** The same adapters do the work; only the *delivery* differs — so the service can
 *    sit behind HTTP, a worker, or `postMessage` with no change to the emitters.
 *
 * Mirrors the MaaS `serve()` precedent (#081): a thin delivery layer over a registry-resolved
 * provider, **lossy-but-visible** (an intent an adapter can't emit is reported in `unsupported`, never
 * dropped — the #085 rule), and **errors are data, not exceptions across the boundary**. A boundary a
 * caller reaches by URL must not throw a stack across it; an unknown adapter or malformed request comes
 * back as a structured `status: 'error'` envelope, exactly as the in-process path reports `unsupported`.
 *
 * Pure + dependency-free (no fs / no network / no transport), like the rest of `validation-generation/`:
 * this defines the request/response *contract* and the handler; a Node or worker host wires the bytes.
 */
import {
  type ValidationDeclaration,
  type ValidationIntentId,
  type GeneratedValidation,
  VALIDATION_GENERATION_SPEC_VERSION,
} from './provider.js';
import { type CustomValidationAdapterRegistry, UnknownValidationAdapterError } from './registry.js';

/**
 * A Mode-2 request — the JSON-serializable input crossing the boundary. `format` is the adapter key
 * (`'native-html'` | `'zod'` | `'pydantic'` | `'json-schema'`); omit it to take the registry default.
 * `declarations` are the neutral, language-agnostic field declarations to materialize.
 */
export interface ValidationServiceRequest {
  /** Adapter/format key; omitted → the registry's native-first default. */
  readonly format?: string;
  /** The fields to generate validation for — the same neutral input Mode-1 takes, just serialized. */
  readonly declarations: readonly ValidationDeclaration[];
}

/** One field's served artifact — `GeneratedValidation` minus the per-call `format`/`language` (hoisted to the envelope). */
export interface ServedArtifact {
  readonly field: string;
  readonly code: string;
  /** Intents declared for this field that the chosen adapter does not comply with — reported, never dropped. */
  readonly unsupported: readonly ValidationIntentId[];
}

/**
 * A Mode-2 response — the JSON-serializable envelope returned across the boundary. `status` is `'ok'`
 * for a served artifact set or `'error'` for a request the service refused (unknown adapter, malformed
 * body) — the boundary never throws. `lossy` is true when any field had an unsupported intent; the
 * union is in `unsupported` and the human-readable lines in `diagnostics` (the MaaS convention).
 */
export interface ValidationServiceResponse {
  readonly status: 'ok' | 'error';
  readonly specVersion: string;
  readonly format?: string;
  readonly language?: string;
  readonly artifacts: readonly ServedArtifact[];
  /** Union of every field's unsupported intents — `lossy` is `unsupported.length > 0`. */
  readonly unsupported: readonly ValidationIntentId[];
  readonly lossy: boolean;
  readonly diagnostics: readonly string[];
  /** Present only when `status === 'error'` — the structured reason the request was refused. */
  readonly error?: string;
}

/** Build the structured error envelope returned (never thrown) when the service refuses a request. */
function errorResponse(error: string): ValidationServiceResponse {
  return {
    status: 'error',
    specVersion: VALIDATION_GENERATION_SPEC_VERSION,
    artifacts: [],
    unsupported: [],
    lossy: false,
    diagnostics: [error],
    error,
  };
}

/** Structurally validate a parsed request body — the boundary trusts no shape it was handed. */
function requestError(req: unknown): string | null {
  if (typeof req !== 'object' || req === null) return 'request must be an object';
  const r = req as Partial<ValidationServiceRequest>;
  if (r.format !== undefined && typeof r.format !== 'string') return '"format" must be a string when present';
  if (!Array.isArray(r.declarations)) return '"declarations" must be an array';
  for (const [i, d] of r.declarations.entries()) {
    if (typeof d !== 'object' || d === null) return `declarations[${i}] must be an object`;
    const dec = d as Partial<ValidationDeclaration>;
    if (typeof dec.field !== 'string' || dec.field.length === 0) return `declarations[${i}] needs a non-empty "field"`;
    if (!Array.isArray(dec.constraints)) return `declarations[${i}].constraints must be an array`;
  }
  return null;
}

/**
 * The Mode-2 handler — the in-memory core of the service, decoupled from any wire format. Resolves the
 * requested adapter from `registry`, emits each declaration, and folds the results into one envelope:
 * the union of unsupported intents (→ `lossy`), per-field artifacts, and a diagnostic line per lossy
 * field. An unknown adapter is returned as a `status: 'error'` envelope — never thrown — so every
 * transport (HTTP/worker/`postMessage`) gets a body it can serialize.
 */
export function handleValidationRequest(
  request: ValidationServiceRequest,
  registry: CustomValidationAdapterRegistry,
): ValidationServiceResponse {
  const shapeError = requestError(request);
  if (shapeError) return errorResponse(shapeError);

  let adapter;
  try {
    adapter = registry.resolve(request.format);
  } catch (e) {
    // The registry's own structured error (`UnknownValidationAdapterError`) carries the known-keys list.
    return errorResponse(e instanceof UnknownValidationAdapterError ? e.message : (e as Error).message);
  }

  const artifacts: ServedArtifact[] = [];
  const unsupportedUnion = new Set<ValidationIntentId>();
  const diagnostics: string[] = [];
  for (const declaration of request.declarations) {
    const generated: GeneratedValidation = adapter.emit(declaration);
    artifacts.push({ field: declaration.field, code: generated.code, unsupported: generated.unsupported });
    for (const intent of generated.unsupported) {
      unsupportedUnion.add(intent);
      diagnostics.push(`field "${declaration.field}": adapter "${adapter.key}" does not emit ${intent}`);
    }
  }

  const unsupported = [...unsupportedUnion];
  return {
    status: 'ok',
    specVersion: VALIDATION_GENERATION_SPEC_VERSION,
    format: adapter.key,
    language: adapter.language,
    artifacts,
    unsupported,
    lossy: unsupported.length > 0,
    diagnostics,
  };
}

/**
 * The **request boundary** — Mode-2's one concrete delivery format. Parse a JSON request string, run
 * {@link handleValidationRequest}, and return a JSON response string. This is the byte-level contract a
 * host (HTTP handler, worker, `postMessage` bridge) plugs into: `serveValidation(await req.text(), reg)`
 * → the response body. A JSON parse failure is caught and returned as a `status: 'error'` envelope —
 * the boundary returns a well-formed body for a malformed request, it does not throw across the wire.
 */
export function serveValidation(rawRequest: string, registry: CustomValidationAdapterRegistry): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawRequest);
  } catch (e) {
    return JSON.stringify(errorResponse(`invalid JSON request: ${(e as Error).message}`));
  }
  return JSON.stringify(handleValidationRequest(parsed as ValidationServiceRequest, registry));
}
