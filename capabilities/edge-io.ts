/**
 * Edge venue — the I/O + caching shell (#219), wrapped around the pure resolution layer in
 * {@link ./edge} (the provider, resolver, equivalence-class key and URL, all done in #208). #208 took an
 * already-resolved {@link ClientHints} profile and ran in a unit test; production has to *derive* that
 * profile from real request headers and emit the right cache directives. This module is exactly that
 * translation layer — and nothing more: it is **pure and dependency-free** (no HTTP runtime, no bundler),
 * so it stays testable in this logic-only package and a real edge runtime calls into it.
 *
 *   - {@link parseClientHints} — map the structured `Sec-CH-UA*` request headers onto the `ClientHints`
 *     declared-profile shape {@link clientHintsSupport} already consumes. This is **not** UA sniffing: it
 *     reads the high-entropy Client-Hint headers the browser sends, never parses a UA string.
 *   - {@link ACCEPT_CH} / {@link negotiationHeaders} — what the entry response advertises so the browser
 *     sends those hints (`Accept-CH`), which are critical for the first paint (`Critical-CH`), and that the
 *     response varies by them (`Vary`).
 *   - {@link chunkCacheHeaders} — the cache directives for a served chunk. The chunk URL is content-addressed
 *     by its `caps` (#204/#088), so the chunk is immutable and cacheable forever; the negotiation response
 *     that *chose* the URL is the one that varies by hints.
 *
 * The Baseline mapping (a browser version → the Baseline epoch it meets) is **injected**, not invented:
 * production backs {@link BaselineLookup} with `web-features` / Baseline data. Absent a lookup,
 * `baselineYear` is left undefined (honest — the parser never fabricates support).
 */
import type { ClientHints } from './edge.js';

/** A case-insensitive header bag — a `Headers` instance or a plain object (as a server framework exposes). */
export type HeaderBag = Headers | Record<string, string | undefined>;

function getHeader(headers: HeaderBag, name: string): string | undefined {
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name) ?? undefined;
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers as Record<string, string | undefined>)) {
    if (k.toLowerCase() === lower) return v ?? undefined;
  }
  return undefined;
}

/** One branded entry from `Sec-CH-UA` / `Sec-CH-UA-Full-Version-List`. */
export interface UaBrand {
  readonly brand: string;
  readonly version: string;
  /** The leading integer of `version` (e.g. `130` from `130.0.6723.58`); `NaN` if unparseable. */
  readonly major: number;
}

/** GREASE brands the spec injects to keep parsers honest (e.g. `"Not?A_Brand"`); ignored. */
const isGrease = (brand: string): boolean => /not[\W_]*a[\W_]*brand/i.test(brand);

/**
 * Parse a structured `Sec-CH-UA` / `...-Full-Version-List` header value into its branded entries, dropping
 * GREASE. The grammar is the Structured-Headers brand list: `"Brand";v="version", "Brand2";v="version2"`.
 */
export function parseBrandList(value: string | undefined): UaBrand[] {
  if (!value) return [];
  const out: UaBrand[] = [];
  // Split on top-level commas separating `"brand";v="ver"` members.
  for (const member of value.split(/,(?=\s*")/)) {
    const brandMatch = /"([^"]*)"/.exec(member);
    const verMatch = /;\s*v="([^"]*)"/.exec(member);
    if (!brandMatch) continue;
    const brand = brandMatch[1];
    if (isGrease(brand)) continue;
    const version = verMatch ? verMatch[1] : '';
    out.push({ brand, version, major: Number.parseInt(version, 10) });
  }
  return out;
}

/** Resolve a browser+version to the Baseline epoch (year) it meets; production backs this with `web-features`. */
export type BaselineLookup = (brand: UaBrand, platform?: string) => number | undefined;

export interface ParseClientHintsOptions {
  /** Inject a real Baseline mapping (web-features-backed). Omitted ⇒ `baselineYear` is left undefined. */
  readonly baselineLookup?: BaselineLookup;
  /** Capability ids the caller knows the client has/lacks (e.g. an origin trial) — pass-through overrides. */
  readonly supports?: string[];
  readonly lacks?: string[];
}

/**
 * Derive a {@link ClientHints} declared profile from the structured `Sec-CH-UA*` request headers. Prefers
 * `Sec-CH-UA-Full-Version-List` (full versions) and falls back to `Sec-CH-UA` (major-only). The chosen
 * brand is the first non-GREASE entry; its Baseline epoch comes from the injected {@link BaselineLookup}.
 * `Sec-CH-UA-Platform` and `Sec-CH-UA-Mobile` are read so a lookup can be platform-aware. Never sniffs a UA.
 */
export function parseClientHints(headers: HeaderBag, opts: ParseClientHintsOptions = {}): ClientHints {
  const platformRaw = getHeader(headers, 'Sec-CH-UA-Platform');
  const platform = platformRaw ? platformRaw.replace(/^"|"$/g, '') : undefined;
  const brands = parseBrandList(
    getHeader(headers, 'Sec-CH-UA-Full-Version-List') ?? getHeader(headers, 'Sec-CH-UA'),
  );
  const primary = brands[0];
  const baselineYear = primary && opts.baselineLookup ? opts.baselineLookup(primary, platform) : undefined;

  const hints: ClientHints = {};
  if (baselineYear !== undefined) hints.baselineYear = baselineYear;
  if (opts.supports?.length) hints.supports = opts.supports;
  if (opts.lacks?.length) hints.lacks = opts.lacks;
  return hints;
}

/** The Client-Hint headers the edge venue depends on — requested via `Accept-CH`, flagged via `Critical-CH`. */
export const CLIENT_HINT_HEADERS = [
  'Sec-CH-UA',
  'Sec-CH-UA-Full-Version-List',
  'Sec-CH-UA-Platform',
  'Sec-CH-UA-Mobile',
] as const;

/** The `Accept-CH` value the entry response advertises so the browser starts sending the hints. */
export const ACCEPT_CH = CLIENT_HINT_HEADERS.join(', ');

/**
 * Headers for the **negotiation** (entry / HTML) response — the one that reads the hints and chooses a
 * chunk URL. It advertises the hints (`Accept-CH`), marks them critical so they arrive on the first
 * navigation (`Critical-CH`), and declares that the response varies by them (`Vary`).
 */
export function negotiationHeaders(): Record<string, string> {
  return {
    'Accept-CH': ACCEPT_CH,
    'Critical-CH': ACCEPT_CH,
    Vary: ACCEPT_CH,
  };
}

export interface ChunkCacheOptions {
  /** Cache lifetime in seconds (default one year — the immutable-asset convention). */
  readonly maxAge?: number;
  /** Mark the chunk privately cacheable (default `false` ⇒ `public`, shareable by a CDN/edge). */
  readonly private?: boolean;
}

/**
 * Cache directives for a **served chunk**. Its URL is content-addressed by the `caps` query (#204/#088),
 * so the bytes for a given URL never change — the chunk is `immutable` and cacheable for a year. No `Vary`
 * on Client Hints here: the capability set is already in the URL (the cache key), so the same URL is the
 * same chunk regardless of which client requested it — the hint-varying happens on the negotiation
 * response, not the chunk.
 */
export function chunkCacheHeaders(opts: ChunkCacheOptions = {}): Record<string, string> {
  const maxAge = opts.maxAge ?? 31536000; // 1 year
  const scope = opts.private ? 'private' : 'public';
  return { 'Cache-Control': `${scope}, max-age=${maxAge}, immutable` };
}
