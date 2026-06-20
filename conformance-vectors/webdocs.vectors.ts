/**
 * Web Docs **Doc Spec** golden conformance-vector suite (ratified #1163, on the #899/#1016 kit).
 *
 * The Doc Spec is a *pure transform* (`(manifest, cases) → DocsSite`), so — unlike the interaction-script
 * behavioral vectors (`schema.ts`) — each vector is a declarative input + expected-output pair
 * ({@link DocSpecVector}). A conforming generator (FUI's reference impl, or any future .NET/Go generator) is
 * conformant iff `generateDocsSite(manifest, cases)` deep-equals `expect` for every vector. WE owns the
 * vectors + the structural validator (this file); the runtime *driver/generator* that runs them is FUI's
 * (#817/#855). The suite covers the **default path** (scope = `blocks` SoT, alphabetic fallback, empty-page
 * completeness, scope-omission) AND the **declarative strategy vocabulary** (`docs.order` pin, `docs.sortBy`
 * within-page sort) — the two output-locked v1 knobs. `docs.groupBy` is a forward-declared rendering hint
 * (it does not alter the flat `DocsSite`), grown on demand per #1163's promotion path.
 */

import type {
  DocSpecVector,
  DocSpecVectorSuite,
  WebCase,
} from '../webdocs/contract';

// ── Case fixtures (the WebCases pivot is id-sorted, per parseWebCases) ───────────────

const aBasic: WebCase = { id: '01-basic.html', title: 'Basic', description: 'The basic case.', code: '<x-a></x-a>' };
const aAdv: WebCase = { id: '02-advanced.html', title: 'Advanced', description: 'The advanced case.', code: '<x-a adv></x-a>' };
const bOnly: WebCase = { id: '01-only.html', title: 'Only', description: 'The only case.', code: '<x-b></x-b>' };
// For the sort-by vector: id-sorted input whose titles sort differently.
const sZebra: WebCase = { id: '01-zebra.html', title: 'Zebra', description: 'z', code: '<z/>' };
const sApple: WebCase = { id: '02-apple.html', title: 'Apple', description: 'a', code: '<a/>' };

export const webdocsDocSpecSuite: DocSpecVectorSuite = {
  standard: 'webdocs',
  contract: '@webeverything/contracts/webdocs',
  vectors: [
    {
      id: 'webdocs/default/blocks-order-is-scope',
      description:
        'A non-empty `blocks` is both the order and the scope source of truth: pages follow it exactly.',
      manifest: { id: 'demo', name: 'Demo', blocks: ['button', 'alert'] },
      cases: { alert: [bOnly], button: [aBasic, aAdv] },
      expect: {
        id: 'demo',
        name: 'Demo',
        pages: [
          { blockId: 'button', cases: [aBasic, aAdv] },
          { blockId: 'alert', cases: [bOnly] },
        ],
      },
    },
    {
      id: 'webdocs/default/derived-alphabetic-when-blocks-omitted',
      description: 'Omitted `blocks` ⇒ every block present in the cases, in stable (alphabetic) id order.',
      manifest: { id: 'demo', name: 'Demo' },
      cases: { button: [aBasic], alert: [bOnly] },
      expect: {
        id: 'demo',
        name: 'Demo',
        pages: [
          { blockId: 'alert', cases: [bOnly] },
          { blockId: 'button', cases: [aBasic] },
        ],
      },
    },
    {
      id: 'webdocs/default/empty-page-completeness',
      description: 'A manifest block with no cases still yields an (empty) page — the surface is complete.',
      manifest: { id: 'demo', name: 'Demo', description: 'desc', blocks: ['button', 'tooltip'] },
      cases: { button: [aBasic] },
      expect: {
        id: 'demo',
        name: 'Demo',
        description: 'desc',
        pages: [
          { blockId: 'button', cases: [aBasic] },
          { blockId: 'tooltip', cases: [] },
        ],
      },
    },
    {
      id: 'webdocs/default/scope-omits-unlisted-block',
      description: 'A case block not named by a non-empty `blocks` is omitted — `blocks` bounds the scope.',
      manifest: { id: 'demo', name: 'Demo', blocks: ['button'] },
      cases: { button: [aBasic], internal: [bOnly] },
      expect: {
        id: 'demo',
        name: 'Demo',
        pages: [{ blockId: 'button', cases: [aBasic] }],
      },
    },
    {
      id: 'webdocs/declarative/order-pin-decoupled-from-scope',
      description:
        'A `docs.order` pin reorders within scope without changing it: pinned ids first, remaining in default order.',
      manifest: { id: 'demo', name: 'Demo', docs: { order: ['button'] } },
      cases: { alert: [bOnly], button: [aBasic] },
      expect: {
        id: 'demo',
        name: 'Demo',
        // scope derived alphabetic = [alert, button]; pin moves button first → [button, alert].
        pages: [
          { blockId: 'button', cases: [aBasic] },
          { blockId: 'alert', cases: [bOnly] },
        ],
      },
    },
    {
      id: 'webdocs/declarative/sort-by-field-within-page',
      description: 'A `docs.sortBy` key sorts the cases *within* each page declaratively (here: title asc).',
      manifest: { id: 'demo', name: 'Demo', blocks: ['button'], docs: { sortBy: [{ field: 'title' }] } },
      cases: { button: [sZebra, sApple] },
      expect: {
        id: 'demo',
        name: 'Demo',
        // input is id-sorted [Zebra(01), Apple(02)]; sortBy title asc → [Apple, Zebra].
        pages: [{ blockId: 'button', cases: [sApple, sZebra] }],
      },
    },
  ],
};

/** A Doc Spec golden-vector suite failed the structural schema. */
export class DocSpecSchemaError extends Error {
  constructor(suite: string, why: string) {
    super(`Doc Spec vector suite "${suite}" is malformed: ${why}`);
    this.name = 'DocSpecSchemaError';
  }
}

/**
 * Dependency-free structural validator — the WE half of the kit's "schema + verifier" for the Doc Spec.
 * Asserts the suite is well-formed (so a conforming generator's driver can run it without defensive
 * parsing): a `standard`/`contract`, ≥1 vector, each with a non-empty `id`, a `manifest` (with `id`/`name`),
 * a `cases` object, and an `expect` site whose `id` matches the manifest; unique ids. Validates *shape*,
 * never the generated output — judging `generateDocsSite` against `expect` is the generator/driver's job.
 */
export function assertDocSpecSuite(suite: DocSpecVectorSuite): DocSpecVectorSuite {
  const label = suite?.standard ?? '(unknown)';
  if (!suite || typeof suite !== 'object') throw new DocSpecSchemaError(label, 'not an object');
  if (suite.standard !== 'webdocs') throw new DocSpecSchemaError(label, '`standard` must be "webdocs"');
  if (!suite.contract) throw new DocSpecSchemaError(label, '`contract` is required');
  if (!Array.isArray(suite.vectors) || suite.vectors.length === 0)
    throw new DocSpecSchemaError(label, '`vectors` must be a non-empty array');

  const seen = new Set<string>();
  for (const v of suite.vectors as DocSpecVector[]) {
    if (!v.id) throw new DocSpecSchemaError(label, 'a vector is missing `id`');
    if (seen.has(v.id)) throw new DocSpecSchemaError(label, `duplicate vector id "${v.id}"`);
    seen.add(v.id);
    if (!v.manifest || !v.manifest.id || !v.manifest.name)
      throw new DocSpecSchemaError(label, `vector "${v.id}" needs a \`manifest\` with id + name`);
    if (!v.cases || typeof v.cases !== 'object')
      throw new DocSpecSchemaError(label, `vector "${v.id}" needs a \`cases\` object`);
    if (!v.expect || typeof v.expect !== 'object' || !Array.isArray(v.expect.pages))
      throw new DocSpecSchemaError(label, `vector "${v.id}" needs an \`expect\` site with \`pages\``);
    if (v.expect.id !== v.manifest.id)
      throw new DocSpecSchemaError(label, `vector "${v.id}" expect.id must match manifest.id`);
  }
  return suite;
}
