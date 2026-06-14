/**
 * @file blocks/renderers/module-service/generation/corpus/fixtures.ts
 * @description The adapter dev-time regression corpus (backlog #551, slice 4 of #507) — the set of IR
 * INPUTS the deterministic generation adapter is exercised against.
 *
 * The canonical `SERVE_PATH` is golden-locked on its own ({@link file://../__goldens__}). This corpus adds
 * synthetic IR VARIANTS that exercise the emitters' branches a single canonical input can't — an empty
 * `headers` array, a `null` mediaType, a minimal one-param/one-response shape, an extra param. When an
 * improver edits a backend's rules/templates (a human now; explicitly NOT the full-AI cycle, which #463
 * scopes out), re-running the snapshot gate ({@link file://./snapshot.ts}) over this corpus surfaces every
 * output change across varied inputs — the regression signal a one-input golden would miss.
 *
 * Fixtures are pure data, hand-authored to be small and stable; adding one is a single array entry.
 */
import { SERVE_PATH, CACHE_POLICY, MAAS_HEADERS, type ServePathIR } from '../../servePathIR';

/** A named IR input the generator is run against. */
export interface CorpusFixture {
  readonly name: string;
  /** Why this shape is in the corpus — the emitter branch or edge it exercises. */
  readonly rationale: string;
  readonly ir: ServePathIR;
}

/** The smallest valid IR — one param, one (body-bearing) response. Exercises the single-entry path. */
const MINIMAL: ServePathIR = {
  version: '0.0.1',
  basePath: '/m/',
  route: '<name>.js',
  method: 'GET',
  hashAlgorithm: 'sha256',
  hashPinPattern: '^sha256-[A-Za-z0-9_-]+$',
  params: [{ name: 'form', required: false, description: 'The served form.' }],
  // cachePolicy/headers are literal-pinned by ServePathIR (the production vocabulary is the contract);
  // a fixture varies the free fields (route/params/responses) — that's where the emitter branches live.
  cachePolicy: CACHE_POLICY,
  headers: MAAS_HEADERS,
  responses: [{ status: 200, when: 'ok', headers: ['Content-Type'], mediaType: 'text/javascript; charset=utf-8' }],
};

/**
 * An IR whose responses include both an empty-`headers` response and a `null`-mediaType (empty-body)
 * response, plus an extra param — exercising the array-empty and null-body emit branches together.
 */
const EDGE_SHAPES: ServePathIR = {
  version: '2.0.0',
  basePath: '/edge/',
  route: '<name>[@<pin>].mjs',
  method: 'GET',
  hashAlgorithm: 'sha256',
  hashPinPattern: '^sha256-[A-Za-z0-9_-]+$',
  params: [
    { name: 'form', required: false, description: "Uses an apostrophe ' and a \"quote\" to test escaping." },
    { name: 'locale', required: true, description: 'A required param.' },
  ],
  cachePolicy: CACHE_POLICY,
  headers: MAAS_HEADERS,
  responses: [
    { status: 200, when: 'served', headers: ['Content-Type', 'ETag'], mediaType: 'text/javascript; charset=utf-8' },
    { status: 304, when: 'not modified', headers: [], mediaType: null },
    { status: 404, when: 'absent', headers: [], mediaType: 'application/json; charset=utf-8' },
  ],
};

/** The regression corpus — the canonical IR plus the variants. */
export const CORPUS: readonly CorpusFixture[] = [
  { name: 'canonical', rationale: 'the production SERVE_PATH (also golden-locked) — the baseline shape.', ir: SERVE_PATH },
  { name: 'minimal', rationale: 'smallest valid IR: one param, one body response.', ir: MINIMAL },
  { name: 'edge-shapes', rationale: 'empty-headers + null-mediaType responses, required param, escaping.', ir: EDGE_SHAPES },
];
