/**
 * Tests for the Web Docs Doc Spec golden-vector suite (#1163).
 *
 * Two gates: (1) the suite passes the structural validator (the shape the conforming generator's driver
 * relies on); (2) every vector's `expect` is the **correct** default-mapping (+ declarative-strategy)
 * output. Gate (2) is checked against a test-local reference implementation of the ratified mapping — WE
 * ships NO runtime contract impl (that is FUI's per #817/#855), so this reference lives in the test only,
 * proving the golden values rather than re-asserting hand-written output. The reference mirrors
 * `fui:webdocs/generator.ts#generateDocsSite` plus the `docs.order`/`docs.sortBy` v1 vocabulary.
 */
import { describe, it, expect } from 'vitest';
import {
  assertDocSpecSuite,
  DocSpecSchemaError,
  webdocsDocSpecSuite,
} from '../index.js';
import type {
  DocsSite,
  WebCase,
  WebCases,
  WebManifest,
} from '../../webdocs/contract';

/** Test-local reference of the ratified default mapping + v1 declarative vocabulary (NOT shipped). */
function referenceGenerate(manifest: WebManifest, cases: WebCases): DocsSite {
  // Scope: non-empty `blocks` is the source of truth; else every block present, alphabetic.
  const scope =
    manifest.blocks && manifest.blocks.length > 0
      ? [...manifest.blocks]
      : Object.keys(cases).sort();

  // `docs.order`: pin listed (in-scope) ids first, remaining in default order (decoupled from scope).
  let order = scope;
  if (manifest.docs?.order) {
    const pinned = manifest.docs.order.filter((id) => scope.includes(id));
    const rest = scope.filter((id) => !pinned.includes(id));
    order = [...pinned, ...rest];
  }

  const sortBy = manifest.docs?.sortBy;
  const pages = order.map((blockId) => {
    let pageCases = [...(cases[blockId] ?? [])];
    if (sortBy && sortBy.length > 0) {
      pageCases = pageCases.sort((a, b) => {
        for (const key of sortBy) {
          const av = String(a[key.field as keyof WebCase]);
          const bv = String(b[key.field as keyof WebCase]);
          const cmp = av.localeCompare(bv) * (key.direction === 'desc' ? -1 : 1);
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }
    return { blockId, cases: pageCases };
  });

  return { id: manifest.id, name: manifest.name, description: manifest.description, pages };
}

describe('Web Docs Doc Spec golden vectors (#1163)', () => {
  it('the suite is well-formed', () => {
    expect(() => assertDocSpecSuite(webdocsDocSpecSuite)).not.toThrow();
    expect(webdocsDocSpecSuite.standard).toBe('webdocs');
    expect(webdocsDocSpecSuite.contract).toBe('@webeverything/contracts/webdocs');
    expect(webdocsDocSpecSuite.vectors.length).toBeGreaterThanOrEqual(6);
  });

  it('covers both the default path and the declarative vocabulary', () => {
    const ids = webdocsDocSpecSuite.vectors.map((v) => v.id);
    expect(ids.some((id) => id.startsWith('webdocs/default/'))).toBe(true);
    expect(ids.some((id) => id.startsWith('webdocs/declarative/'))).toBe(true);
  });

  it('every vector expect equals the ratified reference mapping', () => {
    for (const v of webdocsDocSpecSuite.vectors) {
      const actual = referenceGenerate(v.manifest, v.cases);
      expect(actual, v.id).toEqual(v.expect);
    }
  });

  it('the validator rejects a malformed suite (expect.id ≠ manifest.id)', () => {
    const bad = {
      standard: 'webdocs' as const,
      contract: '@webeverything/contracts/webdocs' as const,
      vectors: [
        {
          id: 'webdocs/bad/mismatch',
          manifest: { id: 'a', name: 'A' },
          cases: {},
          expect: { id: 'b', name: 'A', pages: [] },
        },
      ],
    };
    expect(() => assertDocSpecSuite(bad)).toThrow(DocSpecSchemaError);
  });
});
