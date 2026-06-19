/**
 * Behavioral conformance vectors (#1016) — the WE-owned substrate for the #899 conformance KIT. Ships the
 * vector **schema** + dependency-free structural **validator**, and the per-standard vector **suites**.
 * The runtime driver that executes a suite against a candidate component lives in plateau/FUI per #899
 * (#817 split · #091 hosted→plateau); WE owns only the build-agnostic contract — the vectors and the shape.
 *
 * Pattern: each implemented standard ships a `<standard>.vectors.ts` exporting a `ConformanceVectorSuite`
 * that passes `assertConformanceSuite`. `validator-resolution` is the pattern-establishing exemplar; the
 * remaining standards are the #1042 L3-completion backfill.
 */
export * from './schema.js';
export { validatorResolutionSuite } from './validator-resolution.vectors.js';

import type { ConformanceVectorSuite } from './schema.js';
import { validatorResolutionSuite } from './validator-resolution.vectors.js';

/** The registry of shipped per-standard suites — what the #899 driver enumerates. */
export const conformanceSuites: ReadonlyArray<ConformanceVectorSuite> = [validatorResolutionSuite];
