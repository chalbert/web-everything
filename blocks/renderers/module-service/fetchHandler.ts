/**
 * @file blocks/renderers/module-service/fetchHandler.ts
 * @description MaaS distribution origin — framework-agnostic Web-standard Fetch handler (backlog #461).
 *
 * The serve-path realization of the MaaS versioning contract (#088/#389, authored as the
 * `maas-versioning` Protocol on webadapters). It wraps the standalone resolver core
 * ({@link serveCompiled} in `moduleService.ts`) in a pure `(Request) => Promise<Response>` so
 * self-hosting is **not** locked to Node.js: the same handler runs on Node, Deno, and Workers/edge,
 * and the Vite middleware (`tools/maas/vite-plugin.ts`) becomes one caller via a thin Fetch↔Node-stream
 * adapter. This module imports NO Node/Vite/11ty/esbuild API — only Web standards (`Request`,
 * `Response`, `URL`, `URLSearchParams`, `crypto.subtle`, `btoa`, `TextEncoder`), all of which exist on
 * every target runtime.
 *
 * What the handler owns (the HTTP + identity layer):
 *   1. URL + pin parsing — `/_maas/<name>[@<pin>].js?form=…&target=…&strategy=…`.
 *   2. The #088 identity invariant — a content-addressed id = hash(definitionHash + compilerVersion +
 *      params + provenance). Surfaced as the artifact URL component and the `ETag`.
 *   3. The pin ladder (#088 §2) — a floating tag / exact semver `302`-redirects (short-TTL) to the
 *      terminal content-hash URL; a `sha256-…` pin is terminal and served `immutable`.
 *   4. Cache headers — resolved (hash-pinned) artifacts → `public, max-age=31536000, immutable` + a
 *      stable `ETag` + an `X-MaaS-Integrity` SRI hash a native `import`/import-map entry can pin.
 *   5. The provenance header (#088 §3) — `X-MaaS-Producer`, folded into the identity hash.
 *   6. Conditional requests — `If-None-Match` against the id → `304`.
 *
 * What it does NOT own: the transform itself (DOM-dependent in the JS core — `parseDefinition` builds
 * elements), so the resolve step is **injected** ({@link MaaSHandlerOptions.resolve}, default
 * {@link serveCompiled}). A Node/Vite caller wraps it in a transient linkedom document; a Worker
 * deployment injects its own DOM or a DOM-free resolve. That injection is the seam that keeps this
 * handler framework-free.
 */
import {
  serveCompiled,
  FORMS,
  type ServeForm,
  type ServeOptions,
  type ServeResult,
} from './moduleService';
import type { DefinitionResolver } from './definitionRegistry';

/** Content-type by served language — the over-the-wire half of the FORMS catalog. */
const MIME: Record<ServeResult['language'], string> = {
  javascript: 'text/javascript; charset=utf-8',
  jsx: 'text/javascript; charset=utf-8',
  html: 'text/html; charset=utf-8',
};

/** `immutable`, cache-forever — only a terminal content-hash pin earns this (#088 §2). */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
/** A floating/exact pin is a revalidatable redirect, never `immutable` (#088 §2). */
const FLOATING_CACHE = 'public, max-age=60, must-revalidate';

// ── Content-addressed identity (#088 §1) ──────────────────────────────────────────
//
// An opaque digest, not a parse target. All inputs are canonicalized (stable key order) before
// hashing so equal inputs ⇒ equal id. The id folds in the compiler/provenance version, so a
// compiler bump alone mints a new id even when the authored source is untouched (#088 §3).

/** An algorithm-prefixed digest, e.g. `sha256-9f86d08…` (base64url for ids, base64 for SRI). */
export type ContentAddressedId = string;

export interface ArtifactIdentity {
  /** hash(definitionHash + compilerVersion + params + provenance) — base64url, the URL + ETag id. */
  id: ContentAddressedId;
  /** SRI integrity over the *served bytes* (standard base64) — what a browser/import-map verifies. */
  integrity: ContentAddressedId;
  inputs: {
    definitionHash: ContentAddressedId;
    compilerVersion: string;
    params: { form: ServeForm; target?: string; strategy?: string };
  };
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
const toBase64url = (bytes: Uint8Array): string =>
  toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sha256Bytes(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return new Uint8Array(digest);
}

/** `sha256-<base64url>` over `input` — used for ids (URL-safe, no padding). */
export async function sha256Id(input: string): Promise<ContentAddressedId> {
  return `sha256-${toBase64url(await sha256Bytes(input))}`;
}
/** `sha256-<base64>` over `input` — standard base64, valid as an SRI `integrity` value. */
export async function sha256Integrity(input: string): Promise<ContentAddressedId> {
  return `sha256-${toBase64(await sha256Bytes(input))}`;
}

/**
 * Derive the {@link ArtifactIdentity} for a served result. The `id` hashes the byte-determining
 * *inputs* (so a compiler bump with identical output still mints a new id, per #088 §3); `integrity`
 * hashes the served *bytes* (so it verifies against the actual response body, per SRI semantics).
 */
export async function computeArtifactIdentity(
  definition: string,
  result: ServeResult,
  opts: ServeOptions,
  compilerVersion: string,
): Promise<ArtifactIdentity> {
  const definitionHash = await sha256Id(definition);
  const params = { form: opts.form, target: opts.transpileTarget, strategy: opts.strategy };
  // Canonical, stable-key-order serialization of every byte-determining input.
  const canonical = JSON.stringify({ definitionHash, compilerVersion, params });
  const [id, integrity] = await Promise.all([sha256Id(canonical), sha256Integrity(result.code)]);
  return { id, integrity, inputs: { definitionHash, compilerVersion, params } };
}

// ── Pin grammar (#088 §2) ──────────────────────────────────────────────────────────

interface ParsedRequest {
  name: string;
  /** The raw pin after `@`, or null for an unpinned (floating) request. */
  pin: string | null;
  form: ServeForm;
  target?: string;
  strategy?: string;
}

/** A pin that is itself a terminal content hash — served `immutable`, never redirected. */
const isHashPin = (pin: string | null): boolean => !!pin && /^sha256-[A-Za-z0-9_-]+$/.test(pin);

/**
 * Parse `/_maas/<name>[@<pin>].js?form=…`. The name may contain `-`/`.`; the pin (if any) is the
 * segment after the LAST `@` before the `.js` extension, so `user-card@1.4.2.js` splits cleanly.
 */
function parseRequest(url: URL, basePath: string): ParsedRequest | null {
  if (!url.pathname.startsWith(basePath)) return null;
  let spec = decodeURIComponent(url.pathname.slice(basePath.length));
  spec = spec.replace(/\.js$/, '');
  if (!spec) return null;
  const at = spec.lastIndexOf('@');
  const name = at >= 0 ? spec.slice(0, at) : spec;
  const pin = at >= 0 ? spec.slice(at + 1) : null;
  if (!name) return null;
  const p = url.searchParams;
  return {
    name,
    pin,
    form: (p.get('form') || 'wc-class') as ServeForm,
    target: p.get('target') || undefined,
    strategy: p.get('strategy') || undefined,
  };
}

/** Rebuild the terminal content-hash URL a floating/exact pin resolves down to. */
function immutableUrl(url: URL, basePath: string, name: string, id: ContentAddressedId): string {
  const search = url.search; // preserve form/target/strategy
  return `${basePath}${encodeURIComponent(name)}@${id}.js${search}`;
}

export interface MaaSHandlerOptions {
  /** id → authored `<component>` source. */
  resolver: DefinitionResolver;
  /** The transform step. Default {@link serveCompiled}; a caller injects a DOM-wrapped variant. */
  resolve?: (definition: string, opts: ServeOptions) => Promise<ServeResult>;
  /** `X-MaaS-Producer` value, folded into the identity hash (#088 §3). */
  producer?: string;
  /** URL prefix this origin serves under. Default `/_maas/`. */
  basePath?: string;
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

/**
 * Build a framework-agnostic `(Request) => Promise<Response>` MaaS distribution origin. Pure Fetch
 * standard in and out — unit-testable with `Request`/`Response` fixtures, no Vite/Node server needed.
 */
export function createMaaSFetchHandler(
  options: MaaSHandlerOptions,
): (request: Request) => Promise<Response> {
  const resolver = options.resolver;
  const resolve = options.resolve ?? serveCompiled;
  const producer = options.producer ?? 'webadapters/0.0.0';
  const basePath = options.basePath ?? '/_maas/';

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const parsed = parseRequest(url, basePath);
    if (!parsed) return json(404, { error: `Not a MaaS request (expected ${basePath}<name>.js).` });

    if (!FORMS.some((f) => f.id === parsed.form))
      return json(400, {
        error: `Unknown form "${parsed.form}". Known: ${FORMS.map((f) => f.id).join(', ')}.`,
      });

    const definition = resolver.resolve(parsed.name);
    if (definition === null)
      return json(404, { error: `No component "${parsed.name}".` });

    const serveOpts: ServeOptions = {
      form: parsed.form,
      transpileTarget: parsed.target,
      strategy: parsed.strategy,
    };

    let result: ServeResult;
    try {
      result = await resolve(definition, serveOpts);
    } catch (e) {
      return json(500, { error: `serve failed: ${(e as Error).message}` });
    }

    const identity = await computeArtifactIdentity(definition, result, serveOpts, producer);

    // The diagnostic/lossy + provenance headers ride every response shape (#081 + #088 §3).
    const baseHeaders = (): Headers => {
      const h = new Headers();
      h.set('X-MaaS-Producer', producer);
      if (result.lossy) h.set('X-MaaS-Lossy', '1');
      if (result.diagnostics.length)
        h.set('X-MaaS-Diagnostic', encodeURIComponent(result.diagnostics.join(' | ')));
      return h;
    };

    // A floating tag or exact semver is a revalidatable redirect down to the immutable hash URL
    // (#088 §2). Only a terminal content-hash pin is served directly.
    if (!isHashPin(parsed.pin)) {
      const h = baseHeaders();
      h.set('Location', immutableUrl(url, basePath, parsed.name, identity.id));
      h.set('Cache-Control', FLOATING_CACHE);
      return new Response(null, { status: 302, headers: h });
    }

    // Terminal content-hash pin. If it doesn't match the current artifact's id, this origin's
    // current state can't honour it (no historical artifact store in v1 — a hosted origin (#451)
    // persists past builds). 404 rather than serve drifted bytes under `immutable`.
    if (parsed.pin !== identity.id)
      return json(404, {
        error: `No artifact "${parsed.name}@${parsed.pin}" — current id is ${identity.id} (this origin serves only current state).`,
      });

    // Conditional request: the id is the ETag, so a match is unconditionally fresh.
    const etag = `"${identity.id}"`;
    if (request.headers.get('If-None-Match') === etag) {
      const h = baseHeaders();
      h.set('ETag', etag);
      h.set('Cache-Control', IMMUTABLE_CACHE);
      return new Response(null, { status: 304, headers: h });
    }

    const h = baseHeaders();
    h.set('Content-Type', MIME[result.language] ?? 'text/plain; charset=utf-8');
    h.set('Cache-Control', IMMUTABLE_CACHE);
    h.set('ETag', etag);
    h.set('X-MaaS-Integrity', identity.integrity);
    return new Response(result.code, { status: 200, headers: h });
  };
}
