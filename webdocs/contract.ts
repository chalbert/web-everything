// @webeverything/contracts/webdocs — the Web Docs **Doc Spec** pure-contract surface (ratified #1163).
//
// Type-only (zero runtime emit): the envelopes a docs site is generated from, the **default** manifest→site
// mapping signature, a MINIMAL v1 **declarative strategy vocabulary** (order / group / sort-by-field as
// *data*), and the golden-vector shape the conformance suite ships. ALL runtime — the generator itself, the
// resolver, the conformance *driver* — is FUI's (`fui:webdocs/generator.ts`), per the #817/#855 statute;
// this is the FUI→WE arrow over which the standard resolves. Imperative custom strategy functions are NOT
// here: they are a per-implementer escape hatch (inherently non-portable → graceful-degradation opt-out of
// cross-implementer reproducibility for that aspect), never WE contract.
//
// Configurability splits on the **declarative/imperative** line, not on FUI-vs-not (#1163 Fork 1A): the
// declarative vocabulary below is golden-vector-locked and byte-reproducible across *any* conforming
// generator (FUI, a future .NET/Go impl); the imperative escape hatch is each impl's own.

// ── Input envelopes ───────────────────────────────────────────────────────────────

/** One documented case — a worked example of a block, build-agnostic (matches the served `cases` data). */
export interface WebCase {
  /** Stable id (the source filename, e.g. `01-basic.html`). */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** The case source (HTML/TS), verbatim and trimmed. */
  readonly code: string;
}

/** Cases grouped by the block/standard id they document. */
export type WebCases = Readonly<Record<string, readonly WebCase[]>>;

/**
 * The customer-authored project manifest a docs site is generated from. `blocks` is the **scope source of
 * truth** (#091): a non-empty list both *orders* and *bounds* the documented surface; omitted ⇒ every block
 * present in the cases. `docs` is the open declarative-strategy extension (the v1 vocabulary).
 */
export interface WebManifest {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** Block/standard ids this docs site documents; omitted ⇒ every block present in the cases. */
  readonly blocks?: readonly string[];
  /** Optional declarative strategy vocabulary — see {@link DocsStrategy}. An OPEN `docs.*` extension. */
  readonly docs?: DocsStrategy;
}

// ── The declarative strategy vocabulary (minimal v1, #1163 Forks 1A · 3) ────────────

/** Sort direction for a {@link DocsSortKey}. Default `asc`. */
export type DocsSortDirection = 'asc' | 'desc';

/** One sort key — a case field and a direction. Multiple keys sort lexicographically in order. */
export interface DocsSortKey {
  /** The {@link WebCase} field to sort by (e.g. `id`, `title`). */
  readonly field: keyof WebCase;
  /** Sort direction; omitted = `asc`. */
  readonly direction?: DocsSortDirection;
}

/**
 * The minimal v1 declarative strategy vocabulary — *data*, not code, so it is portable and golden-vector
 * locked. Grown on demand (the promotion path in #1163); imperative custom functions stay an impl escape
 * hatch and are never added here.
 */
export interface DocsStrategy {
  /**
   * Explicit page order — a pin over `blocks`/derived order. Listed block ids come first in this order;
   * any remaining in-scope blocks follow in their default order. Does NOT change scope (use `blocks` for
   * that) — order and scope are decoupled (#1163 ratified sub-call).
   */
  readonly order?: readonly string[];
  /**
   * Group pages by a {@link WebCase} field shared across a page's cases (e.g. a `category`-like field). A
   * declarative grouping hint a conforming generator renders into sidebar sections; v1 is a single field.
   */
  readonly groupBy?: keyof WebCase;
  /** Sort the cases *within* each page by these keys (applied before the default id sort is relied on). */
  readonly sortBy?: readonly DocsSortKey[];
}

// ── Output model ────────────────────────────────────────────────────────────────────

/** One generated docs page — a documented block plus its (ordered) cases. */
export interface DocsPage {
  readonly blockId: string;
  readonly cases: readonly WebCase[];
}

/** The generated docs-site model — flat list of pages (the served-docs analogue of the 11ty `cases` data). */
export interface DocsSite {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly pages: readonly DocsPage[];
}

/**
 * The default mapping signature — `(manifest, cases) → DocsSite`, **pure and deterministic**. The WE
 * contract freezes the *behavior* (golden vectors below), not an implementation: pages follow
 * `manifest.blocks` order when non-empty (scope SoT), else every block present in the cases in stable id
 * order; a manifest block with no cases still yields an (empty) page (completeness); a case block outside a
 * non-empty `blocks` is omitted. The `docs` strategy, when present, refines order/grouping/within-page sort
 * declaratively over that default. The runtime that satisfies this type is FUI's.
 */
export type GenerateDocsSite = (manifest: WebManifest, cases: WebCases) => DocsSite;

// ── Golden conformance-vector shape (#899/#1016 kit) ─────────────────────────────────

/**
 * One Doc Spec golden vector — a declarative `(manifest, cases) → expected DocsSite` pair. Unlike the
 * interaction-script {@link ConformanceVector}s of the behavioral kit, the Doc Spec is a *pure transform*,
 * so its vector is input+expected-output data. A conforming generator is conformant iff
 * `generateDocsSite(manifest, cases)` deep-equals `expect` for every vector — build-agnostic, portable.
 */
export interface DocSpecVector {
  /** Stable, hierarchical id — `webdocs/<feature>/<case>`. */
  readonly id: string;
  /** Human-facing note on what the vector proves. */
  readonly description?: string;
  /** The input manifest (may carry a declarative `docs` strategy). */
  readonly manifest: WebManifest;
  /** The input cases. */
  readonly cases: WebCases;
  /** The expected default-mapped (and strategy-refined) site. */
  readonly expect: DocsSite;
}

/** The Doc Spec golden-vector suite — the unit WE ships and a conforming generator is checked against. */
export interface DocSpecVectorSuite {
  /** The standard this suite covers. */
  readonly standard: 'webdocs';
  /** The contract package every vector judges. */
  readonly contract: '@webeverything/contracts/webdocs';
  /** The vectors — covering the default path AND the declarative vocabulary. */
  readonly vectors: readonly DocSpecVector[];
}
