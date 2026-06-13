/**
 * @file webdocs/coverage.ts
 * @description Doc-coverage metric (#469, webdocs follow-on of #091/#424). Generation — turning code +
 *   cases into a docs site — is {@link ./generator.generateDocsSite}; this is the complementary
 *   *measurement*: of the surface that should be documented, what fraction actually is. The "% of
 *   exports documented/extracted" tool #111 triaged.
 *
 * Coverage is computed over the generated {@link ./generator.DocsSite}: a block/standard is **documented**
 * when its page carries at least one extracted case, **undocumented** when its page is empty or absent.
 * The surface measured against is, by default, the site's own pages; pass `expected` (e.g. every block
 * a manifest *claims*, or a full export list) to measure the documented fraction of a larger surface —
 * surfacing the gaps a bare page count hides. Pure + dependency-free, like the generator it measures.
 */

import type { DocsSite } from './generator.js';

/** The doc-coverage result for a {@link DocsSite} against an expected surface. */
export interface DocCoverageReport {
  /** The size of the surface measured (expected ids, or the site's pages when none given). */
  readonly total: number;
  /** How many of the surface ids carry ≥1 extracted case. */
  readonly documented: number;
  /** `documented / total`, in `[0, 1]`; `1` for an empty surface (vacuously complete). */
  readonly coverage: number;
  /** Surface ids with no page or an empty page — the gaps, sorted for stable output. */
  readonly undocumented: string[];
  /** Total extracted cases across the measured surface (the documentation volume). */
  readonly totalCases: number;
}

/**
 * Compute {@link DocCoverageReport} for a generated docs site. With no `expected`, the surface is the
 * site's own pages (does every generated page actually carry cases?); with `expected`, it is that id
 * list (what fraction of the *claimed* surface is documented — an id absent from the site counts as
 * undocumented). `coverage` is a ratio; format it as a percentage at the call site.
 */
export function computeDocCoverage(site: DocsSite, expected?: readonly string[]): DocCoverageReport {
  const caseCountByBlock = new Map<string, number>();
  for (const page of site.pages) caseCountByBlock.set(page.blockId, page.cases.length);

  const surface =
    expected && expected.length > 0 ? [...expected] : [...caseCountByBlock.keys()];

  const undocumented: string[] = [];
  let documented = 0;
  let totalCases = 0;
  for (const id of surface) {
    const count = caseCountByBlock.get(id) ?? 0;
    totalCases += count;
    if (count > 0) documented++;
    else undocumented.push(id);
  }

  const total = surface.length;
  return {
    total,
    documented,
    coverage: total === 0 ? 1 : documented / total,
    undocumented: undocumented.sort(),
    totalCases,
  };
}
