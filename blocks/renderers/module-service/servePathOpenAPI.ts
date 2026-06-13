/**
 * @file blocks/renderers/module-service/servePathOpenAPI.ts
 * @description Project the neutral serve-path IR ({@link file://./servePathIR.ts}) to an OpenAPI 3.1
 * document for the HTTP-GET shape (backlog #505, ratified in #463 fork b).
 *
 * OpenAPI is the *projection*, not the source: the IR is the authority, and this is a pure,
 * deterministic function over it — `servePathToOpenAPI(SERVE_PATH)` is stable for a given IR, so the
 * committed `maas-servepath.openapi.json` can be regenerated and diffed as a drift gate. The document
 * describes the verbs, the path + query params, the `Cache-Control` / `ETag` / SRI response shape, and
 * the status-code set — the HTTP contract an enterprise consumer (.NET / Java / Go, via #507) generates
 * a client or a server stub against. The identity *rule* (the content-hash) stays in
 * `protocols.json#maas-versioning`; OpenAPI only carries its HTTP surface.
 *
 * Pure data in, pure data out — no Node / DOM. Emit it with {@link scripts/gen-maas-openapi.mjs}.
 */
import { SERVE_PATH, MEDIA_TYPES, type ServePathIR, type ServePathResponse } from './servePathIR';

/** A minimal structural subset of OpenAPI 3.1 — only what the serve path needs. */
export interface OpenAPIDocument {
  readonly openapi: '3.1.0';
  readonly info: { readonly title: string; readonly version: string; readonly description: string };
  readonly paths: Record<string, { readonly get: OpenAPIOperation }>;
  readonly components: { readonly schemas: Record<string, unknown> };
}

interface OpenAPIOperation {
  readonly operationId: string;
  readonly summary: string;
  readonly parameters: readonly OpenAPIParameter[];
  readonly responses: Record<string, OpenAPIResponse>;
}

interface OpenAPIParameter {
  readonly name: string;
  readonly in: 'path' | 'query';
  readonly required: boolean;
  readonly description: string;
  readonly schema: { readonly type: 'string' };
}

interface OpenAPIResponse {
  readonly description: string;
  readonly headers?: Record<string, { readonly schema: { readonly type: 'string' }; readonly description: string }>;
  readonly content?: Record<string, { readonly schema: Record<string, unknown> }>;
}

/** Map an IR response's header names to an OpenAPI `headers` object (omitted when empty). */
function projectHeaders(headers: readonly string[]): OpenAPIResponse['headers'] | undefined {
  if (headers.length === 0) return undefined;
  const out: Record<string, { schema: { type: 'string' }; description: string }> = {};
  for (const name of headers) out[name] = { schema: { type: 'string' }, description: `${name} response header.` };
  return out;
}

/** Map an IR response's media type to an OpenAPI `content` object (omitted for an empty body). */
function projectContent(response: ServePathResponse): OpenAPIResponse['content'] | undefined {
  if (response.mediaType === null) return undefined;
  const schema =
    response.mediaType === MEDIA_TYPES.error
      ? { $ref: '#/components/schemas/MaaSError' }
      : { type: 'string' };
  return { [response.mediaType.split(';')[0].trim()]: { schema } };
}

/**
 * Project the serve-path IR to an OpenAPI 3.1 document. Deterministic: same IR ⇒ byte-identical output
 * (modulo `JSON.stringify` key order, which follows insertion order here).
 */
export function servePathToOpenAPI(ir: ServePathIR = SERVE_PATH): OpenAPIDocument {
  const responses: Record<string, OpenAPIResponse> = {};
  for (const r of ir.responses) {
    responses[String(r.status)] = {
      description: r.when,
      ...(projectHeaders(r.headers) ? { headers: projectHeaders(r.headers) } : {}),
      ...(projectContent(r) ? { content: projectContent(r) } : {}),
    };
  }

  const parameters: OpenAPIParameter[] = [
    {
      name: 'spec',
      in: 'path',
      required: true,
      description: `The component spec \`${ir.route}\` — a name, an optional \`@<pin>\` (a floating tag, exact semver, or terminal \`${ir.hashAlgorithm}-…\` content hash matching \`${ir.hashPinPattern}\`), and the \`.js\` extension.`,
      schema: { type: 'string' },
    },
    ...ir.params.map(
      (p): OpenAPIParameter => ({
        name: p.name,
        in: 'query',
        required: p.required,
        description: p.description,
        schema: { type: 'string' },
      }),
    ),
  ];

  return {
    openapi: '3.1.0',
    info: {
      title: 'MaaS Served-Artifact Origin',
      version: ir.version,
      description:
        'HTTP projection of the neutral MaaS serve-path IR (backlog #505). The content-hash identity rule, pin grammar, and provenance semantics are defined by protocols.json#maas-versioning; this document carries only their HTTP-GET surface.',
    },
    paths: {
      [`${ir.basePath}{spec}`]: {
        get: {
          operationId: 'serveArtifact',
          summary: 'Resolve and serve a content-addressed MaaS artifact (or redirect a floating pin to it).',
          parameters,
          responses,
        },
      },
    },
    components: {
      schemas: {
        MaaSError: {
          type: 'object',
          required: ['error'],
          properties: { error: { type: 'string', description: 'Human-readable failure reason.' } },
        },
      },
    },
  };
}
