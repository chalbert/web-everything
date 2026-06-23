/**
 * Repro-bundle contract (#1664) — the WE-owned, build-agnostic substrate: the serializable bundle SHAPE
 * + structural validator / serializer / JSON schema + the golden conformance corpus. Sibling of
 * `conformance-vectors/` (shape + verifier the FUI/plateau impl consumes). The capture mechanism (#1667,
 * plateau) produces a bundle; #1666 serializes a captured trace onto this shape; the FUI viewer reads it.
 */
export type * from './contract.js';
export * from './schema.js';
export { reproBundleGolden, invalidReproBundleCases } from './repro-bundle.vectors.js';
