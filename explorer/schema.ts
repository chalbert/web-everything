/**
 * Explorer interchange contract — the build-agnostic runtime: version, severity→SARIF-level mapping, a
 * structural validator, serialize/deserialize, a JSON schema, and the reference projector from the explorer's
 * native finding shape onto the interchange (#1769). The WE half of the format's "shape + verifier", exactly
 * like `repro-bundle/schema.ts` / `conformance-vectors/schema.ts`: a dependency-free structural validator so
 * any consumer (a CI gate, a third-party SARIF viewer, a future .NET/Go reader) can trust a document without
 * defensive parsing, plus a major-version compatibility gate. It validates *shape* and *version*, never the
 * explored app. The closed Plateau explorer EMITS via this projector; WE never depends on that engine (#1467).
 */
import type {
  ExplorerInterchange,
  ExplorerResult,
  ExplorerRun,
  ExplorerCoverage,
  ExplorerConformanceRef,
  ExplorerEvidence,
  SarifLevel,
} from './contract.js';

/** The SARIF core version this interchange conforms to (any SARIF 2.1.0 tool reads the core). */
export const SARIF_VERSION = '2.1.0' as const;

/** The canonical SARIF 2.1.0 schema URI emitted in `$schema`. */
export const SARIF_SCHEMA_URI =
  'https://json.schemastore.org/sarif-2.1.0.json' as const;

/** The WE extension-slot version (semver) — bumped when the `properties` bags change, independent of SARIF. */
export const EXPLORER_EXTENSION_VERSION = '1.0.0' as const;

/** The explorer's native finding severities — the closed input vocabulary the projector accepts. */
export const EXPLORER_SEVERITIES = ['error', 'warn', 'advisory'] as const;
export type ExplorerSeverity = (typeof EXPLORER_SEVERITIES)[number];

/** Map an explorer finding severity onto the SARIF level. An unknown severity degrades to `note`. */
export function severityToSarifLevel(severity: string): SarifLevel {
  switch (severity) {
    case 'error': return 'error';
    case 'warn': return 'warning';
    case 'advisory': return 'note';
    default: return 'note';
  }
}

/** A document failed the structural schema or a version check — malformed output a reader would mis-read. */
export class ExplorerInterchangeSchemaError extends Error {
  constructor(why: string) {
    super(`Explorer interchange is malformed: ${why}`);
    this.name = 'ExplorerInterchangeSchemaError';
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Structurally validate an unknown value as an {@link ExplorerInterchange}, or throw. Returns it typed. */
export function assertExplorerInterchange(value: unknown): ExplorerInterchange {
  if (!isObj(value)) throw new ExplorerInterchangeSchemaError('not an object');
  if (value.version !== SARIF_VERSION) {
    throw new ExplorerInterchangeSchemaError(`version must be "${SARIF_VERSION}" (got ${JSON.stringify(value.version)})`);
  }
  if (typeof value.$schema !== 'string') throw new ExplorerInterchangeSchemaError('$schema must be a string');
  if (!Array.isArray(value.runs)) throw new ExplorerInterchangeSchemaError('runs must be an array');

  for (const [i, run] of (value.runs as unknown[]).entries()) {
    if (!isObj(run)) throw new ExplorerInterchangeSchemaError(`runs[${i}] is not an object`);
    const driver = isObj(run.tool) && isObj((run.tool as Record<string, unknown>).driver)
      ? ((run.tool as Record<string, unknown>).driver as Record<string, unknown>)
      : undefined;
    if (!driver || typeof driver.name !== 'string') throw new ExplorerInterchangeSchemaError(`runs[${i}].tool.driver.name must be a string`);
    if (!Array.isArray(run.results)) throw new ExplorerInterchangeSchemaError(`runs[${i}].results must be an array`);
    const props = run.properties;
    if (!isObj(props) || typeof props.url !== 'string' || !isObj(props.coverage)) {
      throw new ExplorerInterchangeSchemaError(`runs[${i}].properties must carry { url, coverage } (the WE run summary)`);
    }
    for (const [j, res] of (run.results as unknown[]).entries()) {
      if (!isObj(res)) throw new ExplorerInterchangeSchemaError(`runs[${i}].results[${j}] is not an object`);
      if (typeof res.ruleId !== 'string') throw new ExplorerInterchangeSchemaError(`runs[${i}].results[${j}].ruleId must be a string`);
      if (!isObj(res.message) || typeof (res.message as Record<string, unknown>).text !== 'string') {
        throw new ExplorerInterchangeSchemaError(`runs[${i}].results[${j}].message.text must be a string`);
      }
      const rp = res.properties;
      if (!isObj(rp) || typeof rp.oracle !== 'string') {
        throw new ExplorerInterchangeSchemaError(`runs[${i}].results[${j}].properties.oracle must be a string (the WE extension slot)`);
      }
    }
  }
  return value as unknown as ExplorerInterchange;
}

/** Serialize an interchange to stable JSON (validated first). */
export function serializeExplorerInterchange(doc: ExplorerInterchange): string {
  return JSON.stringify(assertExplorerInterchange(doc), null, 2);
}

/** Parse + validate JSON into an {@link ExplorerInterchange}. */
export function deserializeExplorerInterchange(json: string): ExplorerInterchange {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new ExplorerInterchangeSchemaError(`invalid JSON: ${(e as Error).message}`);
  }
  return assertExplorerInterchange(parsed);
}

// ── Reference projector — the explorer's native finding shape → the interchange ───────────────────────

/** One finding in the explorer's native `findings.json` shape (the projector's input). */
export interface ExplorerFindingInput {
  readonly oracle: string;
  readonly severity: string;
  readonly stateId?: string;
  readonly detail: string;
  readonly confidence?: number;
  readonly conformance?: ExplorerConformanceRef;
  readonly evidence?: readonly ExplorerEvidence[];
  readonly location?: { readonly uri: string; readonly startLine?: number };
}

/** The explorer's native per-run report shape (the projector's input). */
export interface ExplorerReportInput {
  readonly url: string;
  readonly coverage: ExplorerCoverage;
  readonly findings: readonly ExplorerFindingInput[];
  readonly toolName?: string;
  readonly generatedAt?: string;
}

/**
 * The reference projection (#1769): map the explorer's native report shape onto the SARIF-compatible
 * interchange — the documented, canonical mapping a producer (the Plateau reportBundle) and a consumer agree
 * on. One run; each finding → a SARIF result with its WE fields in `properties`; the oracle id is BOTH the
 * SARIF `ruleId` (so generic tools group by rule) and `properties.oracle` (so WE-aware tools read it directly).
 */
export function findingsToInterchange(report: ExplorerReportInput): ExplorerInterchange {
  const ruleIds = [...new Set(report.findings.map((f) => f.oracle))];
  const results: ExplorerResult[] = report.findings.map((f) => ({
    ruleId: f.oracle,
    level: severityToSarifLevel(f.severity),
    message: { text: f.detail },
    ...(f.location
      ? {
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.location.uri },
                ...(f.location.startLine !== undefined ? { region: { startLine: f.location.startLine } } : {}),
              },
            },
          ],
        }
      : {}),
    properties: {
      oracle: f.oracle,
      ...(f.stateId !== undefined ? { stateId: f.stateId } : {}),
      ...(f.evidence ? { evidence: f.evidence } : {}),
      ...(f.conformance ? { conformance: f.conformance } : {}),
      ...(f.confidence !== undefined ? { confidence: f.confidence } : {}),
    },
  }));

  const run: ExplorerRun = {
    tool: { driver: { name: report.toolName ?? 'web-everything-explorer', rules: ruleIds.map((id) => ({ id })) } },
    results,
    properties: {
      url: report.url,
      coverage: report.coverage,
      ...(report.generatedAt !== undefined ? { generatedAt: report.generatedAt } : {}),
      extensionVersion: EXPLORER_EXTENSION_VERSION,
    },
  };

  return { $schema: SARIF_SCHEMA_URI, version: SARIF_VERSION, runs: [run] };
}

/** A minimal JSON-schema description (draft-07 subset) of the interchange, for non-TS consumers / tooling. */
export const explorerInterchangeJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://webeverything.dev/schemas/explorer-interchange.json',
  title: 'Web Everything Explorer Interchange (SARIF 2.1.0 + WE extension)',
  type: 'object',
  required: ['$schema', 'version', 'runs'],
  properties: {
    $schema: { type: 'string' },
    version: { const: '2.1.0' },
    runs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['tool', 'results', 'properties'],
        properties: {
          tool: { type: 'object' },
          results: {
            type: 'array',
            items: {
              type: 'object',
              required: ['ruleId', 'level', 'message', 'properties'],
              properties: {
                ruleId: { type: 'string' },
                level: { enum: ['error', 'warning', 'note', 'none'] },
                message: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } },
                properties: {
                  type: 'object',
                  required: ['oracle'],
                  properties: {
                    oracle: { type: 'string' },
                    stateId: { type: 'string' },
                    confidence: { type: 'number' },
                    conformance: {
                      type: 'object',
                      required: ['contract', 'vectorIds'],
                      properties: { contract: { type: 'string' }, vectorIds: { type: 'array', items: { type: 'string' } } },
                    },
                  },
                },
              },
            },
          },
          properties: {
            type: 'object',
            required: ['url', 'coverage', 'extensionVersion'],
            properties: {
              url: { type: 'string' },
              coverage: {
                type: 'object',
                required: ['states', 'edges', 'coverage'],
                properties: { states: { type: 'number' }, edges: { type: 'number' }, coverage: { type: 'number' } },
              },
              generatedAt: { type: 'string' },
              extensionVersion: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;
