/**
 * @file webdocs/generator.ts
 * @description Web Docs generator — backlog #424 (FUI slice of #398). Generalizes this repo's build-time
 *   `src/_data/cases.js` loader (which scans `src/cases/<block>/*` at 11ty build time) into a hostable,
 *   SERVE-time generator: given a customer's webmanifest + webcases, produce a normalized docs-site model
 *   any renderer can turn into pages. Docs-as-code per the #091 ruling (Fork 1).
 *
 * Three pieces:
 *   - The **webcases pivot** ({@link WebCase}, {@link WebCases}) — the normalized case shape the
 *     incumbent-ingestion adapters target. {@link parseWebCase} is the generalized header parser lifted
 *     from `cases.js` (the `<!-- WEB CASE N: Title -->` convention), now a pure string→case function with
 *     no filesystem coupling, so it runs at serve time over content from any source.
 *   - The **resolver contract** ({@link resolveWebcasesInput}) — ONE contract over the three input kinds
 *     (#091 default: git repo / bundle / registry URL). The `bundle` kind (content already in hand) is
 *     fully resolved here, dependency-free; `git`/`registry` are recognized behind the same contract and
 *     delegate to an injected `fetchSource` (so the pure core stays I/O-free and testable).
 *   - The **generator** ({@link generateDocsSite}) — assembles a {@link WebManifest} + {@link WebCases}
 *     into a {@link DocsSite} model (the served-docs analogue of the 11ty `cases` data).
 *
 * Pure + dependency-free: no `fs`, no network. The local/git/registry I/O is injected, so this same core
 * runs in the 11ty build, a server, or a test. Mirrors `cases.js`'s output shape so the two converge.
 */

// ── The webcases pivot — the normalized shape adapters target ─────────────────────

/** One documentation case — a titled, described code sample for a block/standard. */
export interface WebCase {
  /** Stable id (the source filename, e.g. `01-basic.html`). */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** The case source (HTML/TS), verbatim and trimmed. */
  readonly code: string;
}

/** The cases for a docs site, keyed by block/standard id — the pivot `cases.js` already emits. */
export type WebCases = Record<string, WebCase[]>;

/** A raw case file before parsing — content plus the id (filename) it came from. */
export interface RawCaseFile {
  readonly id: string;
  readonly content: string;
}

/** A raw block of case files, keyed by block id — the resolver's normalized output before parsing. */
export type RawCases = Record<string, RawCaseFile[]>;

/**
 * Parse one raw case file into a {@link WebCase}. Generalized from `cases.js`: reads the first
 * `<!-- … -->` header, finds the `WEB CASE N: Title` line, and treats the rest of the comment as the
 * description. With no recognizable header the filename is the title and the description is empty — the
 * same graceful fallback the build-time loader uses.
 */
export function parseWebCase(file: RawCaseFile): WebCase {
  const match = file.content.match(/^\s*<!--([\s\S]*?)-->/);
  let title = file.id;
  let description = '';
  if (match) {
    const lines = match[1].split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const titleIndex = lines.findIndex((l) => l.toUpperCase().includes('WEB CASE'));
    if (titleIndex !== -1) {
      title = lines[titleIndex].replace(/^WEB CASE \d+:\s*/i, '').trim();
      description = lines.slice(titleIndex + 1).join(' ');
    }
  }
  return { id: file.id, title, description, code: file.content.trim() };
}

/** Parse a whole {@link RawCases} block into the {@link WebCases} pivot (cases sorted by id per block). */
export function parseWebCases(raw: RawCases): WebCases {
  const out: WebCases = {};
  for (const blockId of Object.keys(raw)) {
    out[blockId] = [...raw[blockId]]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(parseWebCase);
  }
  return out;
}

// ── The webmanifest + the generated docs-site model ───────────────────────────────

/** The customer-authored project manifest a docs site is generated from. */
export interface WebManifest {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** Block/standard ids this docs site documents; omitted ⇒ every block present in the cases. */
  readonly blocks?: readonly string[];
}

/** One generated docs page — a documented block plus its cases. */
export interface DocsPage {
  readonly blockId: string;
  readonly cases: WebCase[];
}

/** The generated docs-site model — the served-docs analogue of the 11ty `cases` data. */
export interface DocsSite {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly pages: DocsPage[];
}

/**
 * Generate a {@link DocsSite} from a resolved manifest + cases. Pages follow `manifest.blocks` order when
 * given (so the author controls the table of contents), else every block present in the cases in stable
 * id order. A manifest block with no cases still produces an (empty) page so the documented surface is
 * complete; a case block not named by a non-empty `manifest.blocks` is omitted (the manifest is the
 * source of truth for scope).
 */
export function generateDocsSite(manifest: WebManifest, cases: WebCases): DocsSite {
  const blockIds = manifest.blocks && manifest.blocks.length > 0
    ? [...manifest.blocks]
    : Object.keys(cases).sort();
  const pages: DocsPage[] = blockIds.map((blockId) => ({ blockId, cases: cases[blockId] ?? [] }));
  return { id: manifest.id, name: manifest.name, description: manifest.description, pages };
}

// ── The resolver contract — one shape over the three input kinds (#091 default) ────

/** Where the webmanifest + webcases come from — the #091 default: all three behind one contract. */
export type WebcasesInput =
  | { readonly kind: 'bundle'; readonly cases: RawCases }
  | { readonly kind: 'git'; readonly repo: string; readonly ref?: string }
  | { readonly kind: 'registry'; readonly url: string };

/**
 * Fetch the raw cases for a remote input kind (`git`/`registry`). Injected so the generator core stays
 * I/O-free — a server passes a real implementation (clone/checkout, or HTTP GET + unpack); a test passes a
 * stub. Resolving a `bundle` never calls this (its content is already in hand).
 */
export type FetchSource = (input: Extract<WebcasesInput, { kind: 'git' | 'registry' }>) => Promise<RawCases>;

/**
 * Resolve any {@link WebcasesInput} to the {@link WebCases} pivot — the one contract the three input kinds
 * share. `bundle` is resolved inline (parse the in-hand content); `git`/`registry` delegate to
 * `fetchSource` then parse. Throws if a remote kind is given without a `fetchSource` — the contract is
 * recognized, the transport is the caller's to supply.
 */
export async function resolveWebcasesInput(
  input: WebcasesInput,
  fetchSource?: FetchSource,
): Promise<WebCases> {
  if (input.kind === 'bundle') return parseWebCases(input.cases);
  if (!fetchSource) {
    throw new Error(`resolveWebcasesInput: '${input.kind}' input needs a fetchSource (no transport supplied)`);
  }
  const raw = await fetchSource(input);
  return parseWebCases(raw);
}
