/**
 * @file blocks/renderers/module-service/generation/generate.ts
 * @description The deterministic generation-adapter engine (backlog #547, slice 1 of #507).
 *
 * Drives a {@link LanguageBackend} over the neutral serve-path IR ({@link file://../servePathIR.ts}) to
 * produce a {@link GeneratedOrigin}, and **enforces** the property #463 fork a ratified: generation is
 * deterministic — same source always yields byte-identical code, NO AI in the path. The enforcement is
 * not a comment: {@link generateOrigin} emits twice and throws {@link NonDeterministicBackendError} if the
 * two outputs disagree, so a backend that accidentally reaches for the clock, a random source, or
 * unordered iteration fails loudly at generation time rather than silently drifting a golden.
 *
 * This is the same projection discipline as the OpenAPI projector ({@link file://../servePathOpenAPI.ts})
 * — a pure function of the IR whose output is committed and drift-gated — lifted from "project to a data
 * document" to "project to source code, per language."
 */
import { SERVE_PATH, type ServePathIR } from '../servePathIR';
import type { GeneratedModule, GeneratedOrigin, LanguageBackend } from './languageBackend';

/** Thrown when a backend's `emit` is not a pure function of the IR (its two runs differ). */
export class NonDeterministicBackendError extends Error {
  constructor(backendId: string, where: string) {
    super(
      `Generation backend "${backendId}" is non-deterministic: ${where} differs between two emits of ` +
        `the same IR. A backend must be a pure function of the IR — no clock, no randomness, no ` +
        `unordered iteration (backlog #463 fork a: NO AI / no nondeterminism in the generation path).`,
    );
    this.name = 'NonDeterministicBackendError';
  }
}

const sameModule = (a: GeneratedModule, b: GeneratedModule): boolean =>
  a.filename === b.filename && a.language === b.language && a.source === b.source;

/**
 * Generate a language origin from the IR, enforcing determinism. Pure: for a given `(backend, ir)` the
 * result is stable, so the caller can commit it and diff it as a drift gate (#506, and the JS golden in
 * {@link file://../../../../../scripts/gen-maas-origin.mjs}).
 *
 * @throws {NonDeterministicBackendError} if `backend.emit(ir)` is not byte-stable across two calls.
 */
export function generateOrigin(
  backend: LanguageBackend,
  ir: ServePathIR = SERVE_PATH,
): GeneratedOrigin {
  const first = backend.emit(ir);
  const second = backend.emit(ir);
  if (!sameModule(first.core, second.core)) throw new NonDeterministicBackendError(backend.id, 'core');
  if (!sameModule(first.shell, second.shell)) throw new NonDeterministicBackendError(backend.id, 'shell');
  return first;
}

/** Generate origins for several backends at once — each enforced deterministic independently. */
export function generateOrigins(
  backends: readonly LanguageBackend[],
  ir: ServePathIR = SERVE_PATH,
): GeneratedOrigin[] {
  return backends.map((b) => generateOrigin(b, ir));
}
