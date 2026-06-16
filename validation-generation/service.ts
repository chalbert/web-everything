/**
 * Validation-generation **Mode-2** — the generation *service* **wire contract** (#309, slice #085-F).
 *
 * This file is the **WE-resident contract half** of the Mode-2 service: the JSON-serializable
 * request/response *types* that cross the boundary, and nothing that runs. Per the #730 split
 * (B1/C2) and the #804 ruling, the *handler* (`handleValidationRequest`/`serveValidation`) is
 * **impl** and lives next door in `serviceHandler.ts` — excluded from the `@webeverything/*` export
 * surface by omission so the standard↔impl boundary is enforced mechanically (it ports to Frontier
 * UI under #725). The `@webeverything/validation-generation/service` subpath exports *only* these
 * wire types.
 *
 * #085 promises validation generation is offered **two ways, not one enforced way**:
 *
 *  - **Mode-1 — in-process emit.** Import an adapter and call `adapter.emit(declaration)` →
 *    `GeneratedValidation`. Object in, object out, same address space. This is `provider.ts` +
 *    `adapters/*` (#305–#308).
 *  - **Mode-2 — the generation service.** Serialize a request, cross a **request boundary**, get the
 *    emitted artifact back serialized. **String in, string out, one concrete wire format (JSON).**
 *    The same adapters do the work; only the *delivery* differs — so the service can sit behind HTTP,
 *    a worker, or `postMessage` with no change to the emitters. These types define that boundary.
 *
 * Pure + dependency-free (no fs / no network / no transport), like the rest of `validation-generation/`.
 */
import { type ValidationDeclaration, type ValidationIntentId } from './provider.js';

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
