/**
 * Repro-bundle contract — the build-agnostic runtime: version, structural validator, serializer, JSON
 * schema (#1664). The WE half of the bundle's "shape + verifier", exactly like `conformance-vectors/
 * schema.ts`: a dependency-free structural validator so any consumer (the FUI viewer, the plateau tool, a
 * future .NET/Go reader) can trust a bundle without defensive parsing, plus stable serialize/deserialize
 * with a major-version compatibility gate. It validates *shape* and *version*, never the captured app.
 */
import type {
  ReproBundle,
  ReproDeclaredRule,
  ReproOwnershipEntry,
  ReproStateSnapshot,
  ReproTraceEvent,
} from './contract.js';

/** The current repro-bundle contract version (semver). A reader accepts any bundle with the same MAJOR. */
export const REPRO_BUNDLE_VERSION = '1.0.0' as const;

/** The accepted rule kinds — the closed vocabulary the validator enforces on `rules[].kind`. */
export const REPRO_RULE_KINDS = ['conformance', 'visibility', 'validation'] as const;

/** A bundle failed the structural schema or a version check — a malformed bundle a reader would mis-read. */
export class ReproBundleSchemaError extends Error {
  constructor(why: string) {
    super(`Repro-bundle is malformed: ${why}`);
    this.name = 'ReproBundleSchemaError';
  }
}

/** Parse a semver into `[major, minor, patch]`, or throw for a non-`x.y.z` string. */
function parseSemver(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new ReproBundleSchemaError(`\`version\` "${v}" is not a valid semver`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Whether a bundle written at `version` is readable by this contract (same major version). */
export function isCompatibleVersion(version: string): boolean {
  try {
    return parseSemver(version)[0] === parseSemver(REPRO_BUNDLE_VERSION)[0];
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertSeqStamp(entry: Record<string, unknown>, where: string): void {
  if (typeof entry.seq !== 'number' || !Number.isInteger(entry.seq) || entry.seq < 0)
    throw new ReproBundleSchemaError(`${where} needs an integer \`seq\` ≥ 0`);
  if (typeof entry.atMs !== 'number') throw new ReproBundleSchemaError(`${where} needs a numeric \`atMs\``);
}

function assertSnapshot(value: unknown, i: number): asserts value is ReproStateSnapshot {
  if (!isPlainObject(value)) throw new ReproBundleSchemaError(`state[${i}] is not an object`);
  assertSeqStamp(value, `state[${i}]`);
  if (!isPlainObject(value.state)) throw new ReproBundleSchemaError(`state[${i}].state must be an object`);
  for (const [scopeId, scope] of Object.entries(value.state)) {
    if (!isPlainObject(scope))
      throw new ReproBundleSchemaError(`state[${i}].state["${scopeId}"] must be an object of key→value`);
  }
}

function assertTraceEvent(value: unknown, i: number): asserts value is ReproTraceEvent {
  if (!isPlainObject(value)) throw new ReproBundleSchemaError(`trace[${i}] is not an object`);
  assertSeqStamp(value, `trace[${i}]`);
  if (value.kind === 'intent') {
    if (typeof value.intent !== 'string' || value.intent.length === 0)
      throw new ReproBundleSchemaError(`trace[${i}] (intent) needs a non-empty \`intent\``);
  } else if (value.kind === 'transition') {
    if (typeof value.from !== 'string' || typeof value.to !== 'string')
      throw new ReproBundleSchemaError(`trace[${i}] (transition) needs string \`from\` and \`to\``);
  } else {
    throw new ReproBundleSchemaError(`trace[${i}].kind must be "intent" or "transition"`);
  }
}

function assertRule(value: unknown, i: number): asserts value is ReproDeclaredRule {
  if (!isPlainObject(value)) throw new ReproBundleSchemaError(`rules[${i}] is not an object`);
  if (typeof value.id !== 'string' || value.id.length === 0)
    throw new ReproBundleSchemaError(`rules[${i}] needs a non-empty \`id\``);
  if (!REPRO_RULE_KINDS.includes(value.kind as never))
    throw new ReproBundleSchemaError(`rules[${i}].kind must be one of ${REPRO_RULE_KINDS.join('/')}`);
  if (typeof value.contract !== 'string' || value.contract.length === 0)
    throw new ReproBundleSchemaError(`rules[${i}] needs a non-empty \`contract\``);
}

function assertOwnership(value: unknown, i: number): asserts value is ReproOwnershipEntry {
  if (!isPlainObject(value)) throw new ReproBundleSchemaError(`ownership[${i}] is not an object`);
  if (typeof value.nodeId !== 'string' || value.nodeId.length === 0)
    throw new ReproBundleSchemaError(`ownership[${i}] needs a non-empty \`nodeId\``);
  if (typeof value.owner !== 'string' || value.owner.length === 0)
    throw new ReproBundleSchemaError(`ownership[${i}] needs a non-empty \`owner\``);
}

/**
 * Validate an unknown value as a {@link ReproBundle}: a compatible-major `version`, a numeric
 * `capturedAtMs`, and four arrays whose every entry is well-formed (ordered `seq`, valid kinds, required
 * fields). Returns the value typed when valid; throws {@link ReproBundleSchemaError} otherwise.
 */
export function assertReproBundle(value: unknown): ReproBundle {
  if (!isPlainObject(value)) throw new ReproBundleSchemaError('not an object');
  if (typeof value.version !== 'string') throw new ReproBundleSchemaError('`version` is required');
  if (!isCompatibleVersion(value.version))
    throw new ReproBundleSchemaError(
      `incompatible major version "${value.version}" (reader is ${REPRO_BUNDLE_VERSION})`,
    );
  if (typeof value.capturedAtMs !== 'number')
    throw new ReproBundleSchemaError('`capturedAtMs` must be a number');

  for (const part of ['state', 'trace', 'rules', 'ownership'] as const) {
    if (!Array.isArray(value[part])) throw new ReproBundleSchemaError(`\`${part}\` must be an array`);
  }

  (value.state as unknown[]).forEach(assertSnapshot);
  (value.trace as unknown[]).forEach(assertTraceEvent);
  (value.rules as unknown[]).forEach(assertRule);
  (value.ownership as unknown[]).forEach(assertOwnership);

  return value as unknown as ReproBundle;
}

/** Serialize a bundle to a stable JSON string (validated first, so a malformed bundle never ships). */
export function serializeReproBundle(bundle: ReproBundle): string {
  return JSON.stringify(assertReproBundle(bundle));
}

/** Parse + validate + version-check a serialized bundle. Throws {@link ReproBundleSchemaError} on any fault. */
export function deserializeReproBundle(json: string): ReproBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new ReproBundleSchemaError(`invalid JSON — ${err instanceof Error ? err.message : String(err)}`);
  }
  return assertReproBundle(parsed);
}

/**
 * A JSON Schema (draft 2020-12) describing a repro-bundle, for external/non-TS consumers (the FUI viewer's
 * validation, a .NET/Go reader). Kept in lock-step with {@link assertReproBundle} — the validator is the
 * source of truth; this is its declarative projection.
 */
export const reproBundleJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://webeverything.dev/schema/repro-bundle.json',
  title: 'ReproBundle',
  type: 'object',
  required: ['version', 'capturedAtMs', 'state', 'trace', 'rules', 'ownership'],
  additionalProperties: false,
  properties: {
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    capturedAtMs: { type: 'number' },
    state: {
      type: 'array',
      items: {
        type: 'object',
        required: ['seq', 'atMs', 'state'],
        properties: {
          seq: { type: 'integer', minimum: 0 },
          atMs: { type: 'number' },
          label: { type: 'string' },
          state: { type: 'object', additionalProperties: { type: 'object' } },
        },
      },
    },
    trace: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kind', 'seq', 'atMs'],
        properties: {
          kind: { enum: ['intent', 'transition'] },
          seq: { type: 'integer', minimum: 0 },
          atMs: { type: 'number' },
          intent: { type: 'string' },
          target: { type: 'string' },
          detail: { type: 'object' },
          from: { type: 'string' },
          to: { type: 'string' },
          via: { type: 'string' },
        },
      },
    },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'kind', 'contract'],
        properties: {
          id: { type: 'string', minLength: 1 },
          kind: { enum: [...REPRO_RULE_KINDS] },
          contract: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          vectorIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    ownership: {
      type: 'array',
      items: {
        type: 'object',
        required: ['nodeId', 'owner'],
        properties: {
          nodeId: { type: 'string', minLength: 1 },
          owner: { type: 'string', minLength: 1 },
          ownerKind: { type: 'string' },
        },
      },
    },
  },
} as const;
