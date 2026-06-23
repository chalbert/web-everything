/**
 * Renderer golden SCHEMA — the declarative contract WE keeps (#1660, #1566 Fork 1a; epic #1576).
 *
 * #1566 ruled: WE owns ONLY the declarative renderer-conformance contract — the golden corpus + its
 * **schema as data** — while Plateau owns the verifier impl + the run (`plateau:src/conformance-engine/
 * renderer-audit/`). The goldens themselves ship as frozen JSON next to each renderer
 * (`{data-table,pagination}/__fixtures__/*-goldens.json`); this module is the missing piece #1566 Fork 1a
 * names — the structural validator WE's own **data-only** suite runs to assert *golden schema-validity*
 * (each committed golden is well-formed) and *corpus completeness* (non-empty, ids unique). Dependency-free
 * and build-agnostic: it validates the golden DATA shape, never renders, exactly like
 * `conformance-vectors/schema.ts` validates a vector suite.
 */

/** A golden corpus failed the schema — a malformed golden the Plateau verifier would mis-read. */
export class GoldenSchemaError extends Error {
  constructor(corpus: string, why: string) {
    super(`Renderer golden corpus "${corpus}" is malformed: ${why}`);
    this.name = 'GoldenSchemaError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArrayArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((c) => typeof c === 'string'));
}

/** Validate one data-table golden's shape (id, native rootTag, headers, rows, rowCount, groups). */
function assertDataTableGoldenShape(g: unknown, corpus: string, i: number): void {
  if (!isObject(g)) throw new GoldenSchemaError(corpus, `[${i}] is not an object`);
  if (typeof g.id !== 'string' || g.id.length === 0) throw new GoldenSchemaError(corpus, `[${i}] needs a non-empty \`id\``);
  if (typeof g.rootTag !== 'string') throw new GoldenSchemaError(corpus, `[${i}] needs a string \`rootTag\``);
  if (!Array.isArray(g.headers)) throw new GoldenSchemaError(corpus, `[${i}] \`headers\` must be an array`);
  for (const h of g.headers as unknown[]) {
    if (!isObject(h) || typeof h.label !== 'string' || typeof h.scope !== 'string' || typeof h.hasButton !== 'boolean')
      throw new GoldenSchemaError(corpus, `[${i}] a header is missing label/scope/hasButton`);
    if (!(h.ariaSort === null || typeof h.ariaSort === 'string'))
      throw new GoldenSchemaError(corpus, `[${i}] a header \`ariaSort\` must be string or null`);
  }
  if (!isStringArrayArray(g.rows)) throw new GoldenSchemaError(corpus, `[${i}] \`rows\` must be string[][]`);
  if (typeof g.rowCount !== 'number' || g.rowCount !== (g.rows as unknown[]).length)
    throw new GoldenSchemaError(corpus, `[${i}] \`rowCount\` must equal rows.length`);
  if (!Array.isArray(g.groups)) throw new GoldenSchemaError(corpus, `[${i}] \`groups\` must be an array`);
  for (const grp of g.groups as unknown[]) {
    if (!isObject(grp) || !(grp.key === null || typeof grp.key === 'string') || !(grp.summaryText === null || typeof grp.summaryText === 'string'))
      throw new GoldenSchemaError(corpus, `[${i}] a group needs nullable string \`key\`/\`summaryText\``);
  }
}

/** Validate one pagination golden's shape (the contract axes + projection fields). */
function assertPaginationGoldenShape(g: unknown, corpus: string, i: number): void {
  if (!isObject(g)) throw new GoldenSchemaError(corpus, `[${i}] is not an object`);
  if (typeof g.id !== 'string' || g.id.length === 0) throw new GoldenSchemaError(corpus, `[${i}] needs a non-empty \`id\``);
  for (const k of ['rootTag', 'mode', 'advance'] as const) {
    if (typeof g[k] !== 'string') throw new GoldenSchemaError(corpus, `[${i}] needs a string \`${k}\``);
  }
  for (const k of ['hasNav', 'hasSentinel', 'sentinelAriaHidden', 'hasRelLink'] as const) {
    if (typeof g[k] !== 'boolean') throw new GoldenSchemaError(corpus, `[${i}] needs a boolean \`${k}\``);
  }
  if (!(g.navLabel === null || typeof g.navLabel === 'string')) throw new GoldenSchemaError(corpus, `[${i}] \`navLabel\` must be string or null`);
  if (!(g.rangeText === null || typeof g.rangeText === 'string')) throw new GoldenSchemaError(corpus, `[${i}] \`rangeText\` must be string or null`);
  if (typeof g.gotoCount !== 'number') throw new GoldenSchemaError(corpus, `[${i}] \`gotoCount\` must be a number`);
  if (!Array.isArray(g.current)) throw new GoldenSchemaError(corpus, `[${i}] \`current\` must be an array`);
  for (const c of g.current as unknown[]) {
    if (!isObject(c) || typeof c.tag !== 'string' || typeof c.text !== 'string' || !(c.href === null || typeof c.href === 'string'))
      throw new GoldenSchemaError(corpus, `[${i}] a current control needs tag/text and nullable \`href\``);
  }
}

/** Assert corpus-level invariants shared by every renderer golden set: non-empty + unique ids. */
function assertCorpus(goldens: unknown, corpus: string): readonly Record<string, unknown>[] {
  if (!Array.isArray(goldens) || goldens.length === 0)
    throw new GoldenSchemaError(corpus, 'must be a non-empty array (corpus completeness)');
  const ids = new Set<string>();
  for (const g of goldens) {
    const id = isObject(g) ? g.id : undefined;
    if (typeof id === 'string') {
      if (ids.has(id)) throw new GoldenSchemaError(corpus, `duplicate golden id "${id}"`);
      ids.add(id);
    }
  }
  return goldens as readonly Record<string, unknown>[];
}

/** Validate a whole data-table golden corpus (schema-validity + completeness). Throws on the first fault. */
export function assertDataTableGoldens(goldens: unknown, corpus = 'data-table'): void {
  assertCorpus(goldens, corpus).forEach((g, i) => assertDataTableGoldenShape(g, corpus, i));
}

/** Validate a whole pagination golden corpus (schema-validity + completeness). Throws on the first fault. */
export function assertPaginationGoldens(goldens: unknown, corpus = 'pagination'): void {
  assertCorpus(goldens, corpus).forEach((g, i) => assertPaginationGoldenShape(g, corpus, i));
}
