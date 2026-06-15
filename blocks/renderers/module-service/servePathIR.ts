/**
 * @file blocks/renderers/module-service/servePathIR.ts
 * @description The MaaS serve-path IR — the language-neutral source of truth for the HTTP origin
 * (backlog #505, ratified in #463 fork b).
 *
 * `protocols.json#maas-versioning` is the prose conformance reference for the *identity* of a served
 * artifact (content-hash rule, pin grammar, provenance header, runtime compat-range). This module is
 * its machine-readable companion: a small, frozen, **language-neutral** description of the *serve path*
 * — the URL grammar, query params, the pin-ladder routing, the cache policy, the response headers, the
 * status codes, and the media types. Together they are the authority every per-language MaaS origin
 * derives from.
 *
 * The split that #463 ratified: this IR is the **definition**; the #461 JS Fetch origin
 * ({@link file://./fetchHandler.ts}) is the **reference implementation**, not the definition. When the
 * two disagree the IR wins and the handler is fixed — which is enforceable precisely because the
 * handler imports its byte-determining constants ({@link SERVE_PATH}, {@link CACHE_POLICY},
 * {@link MAAS_HEADERS}, {@link HTTP_STATUS}, {@link HASH_PIN_PATTERN}) from here rather than declaring
 * its own. No language is privileged: this same IR is what the #506 conformance vectors assert against
 * and what the #507 generation-adapter reads to emit a .NET / Java / Go origin.
 *
 * Neutrality rules this file holds to: pure data + types, **no imports** (not even from the JS core —
 * the enumerated `form`/`target`/`strategy` *values* are an implementation's catalog, so the IR names
 * the params and their role, never their JS-specific value set), no Node / DOM / Web-Fetch API. It must
 * be readable by a code generator that has never seen TypeScript's runtime.
 */

/** Algorithm prefix for every content hash this contract mints (ids and SRI integrity alike). */
export const HASH_ALGORITHM = 'sha256' as const;

/**
 * A terminal content-hash pin — `sha256-<base64url>`. A pin matching this is served directly and
 * `immutable`; anything else (a floating tag or an exact semver) is a revalidatable redirect down to
 * it (the pin ladder, `maas-versioning` §2). This is the one regex both the handler and a generated
 * origin must share, so it lives here.
 */
export const HASH_PIN_PATTERN = '^sha256-[A-Za-z0-9_-]+$' as const;

/** The default URL prefix a MaaS origin serves under. An origin may remount it; the grammar is fixed. */
export const DEFAULT_BASE_PATH = '/_maas/' as const;

/**
 * Cache-Control policy by artifact resolution state (`maas-versioning` §1–2). A terminal content-hash
 * pin is immutable and cached forever; a floating/exact pin is a short-TTL revalidatable pointer that
 * `302`s to the immutable URL.
 */
export const CACHE_POLICY = {
  /** A resolved (hash-pinned) artifact — cache forever, never revalidate. */
  immutable: 'public, max-age=31536000, immutable',
  /** A floating tag / exact semver — a revalidatable redirect, never immutable. */
  floating: 'public, max-age=60, must-revalidate',
} as const;

/** The MaaS response-header vocabulary. Names are part of the wire contract, so a generator emits them verbatim. */
export const MAAS_HEADERS = {
  /** The producing core/compiler version, folded into the identity hash (`maas-versioning` §3). */
  producer: 'X-MaaS-Producer',
  /** Present (`1`) when the served form lost information vs the authored definition (#081). */
  lossy: 'X-MaaS-Lossy',
  /** URL-encoded, ` | `-joined transform diagnostics. */
  diagnostic: 'X-MaaS-Diagnostic',
  /** The SRI integrity (`sha256-<base64>`) over the served bytes — an import-map/`<script>` can pin it. */
  integrity: 'X-MaaS-Integrity',
} as const;

/** The HTTP status codes the serve path emits, each with the condition that produces it. */
export const HTTP_STATUS = {
  ok: 200,
  redirect: 302,
  notModified: 304,
  badRequest: 400,
  notFound: 404,
  serverError: 500,
} as const;

/** Media types the origin serves, keyed by the abstract served-language class. */
export const MEDIA_TYPES = {
  javascript: 'text/javascript; charset=utf-8',
  html: 'text/html; charset=utf-8',
  /** The structured error body shape every 4xx/5xx uses. */
  error: 'application/json; charset=utf-8',
} as const;

/** A single query parameter of the serve path. */
export interface ServePathParam {
  readonly name: string;
  readonly required: boolean;
  readonly description: string;
  /**
   * Catalog-gated param (#662): when set, this param defaults to the origin's default value and is
   * validated against an injected catalog seam — an unknown value mints the {@link HTTP_STATUS.badRequest}.
   * The default value + the legal set are an *implementation catalog* (injected), never the neutral
   * contract; the IR only names that the seam exists. `form` is the one such param.
   */
  readonly catalogGated?: boolean;
}

/** One response the serve path can produce, tied to the {@link HTTP_STATUS} it carries. */
export interface ServePathResponse {
  readonly status: number;
  readonly when: string;
  /** Response headers this outcome sets (by their {@link MAAS_HEADERS}/standard name). */
  readonly headers: readonly string[];
  /** The body media type, or `null` for an empty body (302 / 304). */
  readonly mediaType: string | null;
}

/**
 * The neutral serve-path IR. A frozen description of the single `GET` route the MaaS origin exposes —
 * enough for the OpenAPI projection ({@link file://./servePathOpenAPI.ts}), the conformance vectors
 * (#506), and the generation adapter (#507) to all derive from one authority.
 */
export interface ServePathIR {
  readonly version: string;
  readonly basePath: string;
  /** The path template a request matches, relative to {@link basePath}. */
  readonly route: string;
  readonly method: 'GET';
  readonly hashAlgorithm: string;
  readonly hashPinPattern: string;
  /** Query params (`form`/`target`/`strategy`) — names + roles, never a JS value set (neutrality). */
  readonly params: readonly ServePathParam[];
  readonly cachePolicy: typeof CACHE_POLICY;
  readonly headers: typeof MAAS_HEADERS;
  readonly responses: readonly ServePathResponse[];
}

/**
 * THE serve-path IR instance — the source of truth. Frozen so neither the reference handler nor a test
 * can mutate the contract at runtime.
 */
export const SERVE_PATH: ServePathIR = Object.freeze({
  version: '1.0.0',
  basePath: DEFAULT_BASE_PATH,
  route: '<name>[@<pin>].js',
  method: 'GET',
  hashAlgorithm: HASH_ALGORITHM,
  hashPinPattern: HASH_PIN_PATTERN,
  params: Object.freeze([
    {
      name: 'form',
      required: false,
      catalogGated: true,
      description:
        'The served form (e.g. wc-class). Defaults to the origin\'s default form. The value set is an implementation catalog, not part of the neutral contract.',
    },
    {
      name: 'target',
      required: false,
      description: 'The transpile target passed to the transform (e.g. an ES version). Byte-determining.',
    },
    {
      name: 'strategy',
      required: false,
      description: 'The define/delivery strategy passed to the transform. Byte-determining.',
    },
  ]),
  cachePolicy: CACHE_POLICY,
  headers: MAAS_HEADERS,
  responses: Object.freeze([
    {
      status: HTTP_STATUS.ok,
      when: 'A terminal content-hash pin matching the current artifact id.',
      headers: ['Content-Type', 'Cache-Control', 'ETag', MAAS_HEADERS.integrity, MAAS_HEADERS.producer],
      mediaType: MEDIA_TYPES.javascript,
    },
    {
      status: HTTP_STATUS.redirect,
      when: 'A floating tag or exact semver — redirected to the terminal content-hash URL.',
      headers: ['Location', 'Cache-Control', MAAS_HEADERS.producer],
      mediaType: null,
    },
    {
      status: HTTP_STATUS.notModified,
      when: 'A hash-pinned request whose If-None-Match equals the current ETag.',
      headers: ['ETag', 'Cache-Control', MAAS_HEADERS.producer],
      mediaType: null,
    },
    {
      status: HTTP_STATUS.badRequest,
      when: 'An unknown form query value.',
      headers: [],
      mediaType: MEDIA_TYPES.error,
    },
    {
      status: HTTP_STATUS.notFound,
      when: 'No such component, a non-MaaS path, or a hash pin that does not match current state.',
      headers: [],
      mediaType: MEDIA_TYPES.error,
    },
    {
      status: HTTP_STATUS.serverError,
      when: 'The injected transform threw.',
      headers: [],
      mediaType: MEDIA_TYPES.error,
    },
  ]),
});
