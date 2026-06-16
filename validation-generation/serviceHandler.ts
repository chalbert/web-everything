/**
 * Validation-generation **Mode-2** — the generation service **handler** (#309, slice #085-F).
 *
 * This is the *impl* half of the Mode-2 service: the in-memory core that resolves an adapter, emits
 * each declaration, and folds the results into the wire envelope, plus the JSON request boundary
 * around it. Per the #730 split (B1/C2) and the #804 ruling, the handler is **not** part of the
 * `@webeverything/*` standard surface — `service.ts` (the wire *types*) is exported; this file is
 * excluded by omission and ports to Frontier UI under #725. It is kept in WE for now so the local
 * tests and the `webvalidation` plug re-export keep working via relative paths.
 *
 * Mirrors the MaaS `serve()` precedent (#081): a thin delivery layer over a registry-resolved
 * provider, **lossy-but-visible** (an intent an adapter can't emit is reported in `unsupported`, never
 * dropped — the #085 rule), and **errors are data, not exceptions across the boundary**. A boundary a
 * caller reaches by URL must not throw a stack across it; an unknown adapter or malformed request comes
 * back as a structured `status: 'error'` envelope, exactly as the in-process path reports `unsupported`.
 *
 * Pure + dependency-free (no fs / no network / no transport): this defines the handler; a Node or
 * worker host wires the bytes.
 */
import {
  type ValidationDeclaration,
  type ValidationIntentId,
  type GeneratedValidation,
  VALIDATION_GENERATION_SPEC_VERSION,
} from './provider.js';
import { type CustomValidationAdapterRegistry, UnknownValidationAdapterError } from './registry.js';
import type {
  ValidationServiceRequest,
  ServedArtifact,
  ValidationServiceResponse,
} from './service.js';

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
