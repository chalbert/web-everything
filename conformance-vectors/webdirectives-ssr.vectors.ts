/**
 * Web Directives **SSR wire-format** golden conformance-vector suite (ratified #2030, on the #899/#1016
 * kit; the load-bearing first slice of the SSR surface, #2063).
 *
 * The SSR output of a comment-anchor directive region is a *language-agnostic wire format*: given an input
 * directive tree + its resolved data, a conformant renderer — in ANY language (Node, Go, Rust, PHP, …) —
 * MUST emit these exact HTML bytes, so the single JS client hydrates every server's output identically
 * (`we:src/_includes/project-webdirectives.njk#ssr-wire-format`,
 * `docs/agent/platform-decisions.md#ssr-external-io-standard-renderers-conform`). The wire format is the swap
 * boundary — not the render code, which doesn't port. So — unlike the interaction-script behavioral vectors
 * (`schema.ts`) and like the `webdocs` Doc-Spec suite — each vector is a declarative
 * input + expected-output-bytes pair ({@link SsrWireVector}): a conforming renderer is conformant iff its
 * emitted string equals `expectedHtml` byte-for-byte for every vector.
 *
 * WE owns the vectors + the structural schema validator (this file); the runtime *renderer/oracle* that
 * produces the bytes is FUI's Node reference renderer (#2064) and, later, per-language natives (#2069) —
 * WE ships NO renderer (#6). The suite pins the four externally-observable axes #2063 codifies:
 *   1. the open/close marker grammar with **normative space-padding** (one ASCII space inside each delimiter);
 *   2. `data-key` keyed diffing on `for-each` items;
 *   3. the zero-JS progressive baseline (structural content fully expanded, live branch only);
 *   4. the bounded in-marker **state-token layout** (resume tokens as options; NEVER raw data in comment text).
 *
 * The published grammar is `control:`/`/control:` `open-close`; the FUI runtime's legacy `:start`/`:end`
 * spelling is a pre-existing conformance gap reconciled to this standard separately (#2068).
 */

/**
 * One SSR wire-format golden vector — a stable id, a human note, the input directive tree + data, and the
 * exact HTML bytes a conformant renderer emits. `expectedHtml` is compared **byte-for-byte** (marker
 * space-padding is normative); it is the oracle every language's renderer is graded against.
 */
export interface SsrWireVector {
  /** Stable, hierarchical id — `webdirectives-ssr/<directive>/<case>` (used in the conformance report). */
  readonly id: string;
  /** Human-facing note on what the vector proves. */
  readonly description: string;
  /**
   * The input directive tree, as authored (the `<template is>` / comment-directive source the server
   * expands). Source markup — NOT the emitted output.
   */
  readonly input: string;
  /** The resolved data the server evaluates the directives against (the render context). */
  readonly data: Record<string, unknown>;
  /** The exact HTML bytes a conformant renderer MUST emit. Compared byte-for-byte (space-padding normative). */
  readonly expectedHtml: string;
}

/** A per-standard SSR wire-format corpus — the unit every language's renderer is validated against. */
export interface SsrWireVectorSuite {
  /** The standard this suite covers. */
  readonly standard: 'webdirectives';
  /** The contract package the vectors judge. */
  readonly contract: string;
  /** The golden vectors. */
  readonly vectors: ReadonlyArray<SsrWireVector>;
}

// ── The normative marker grammar, spelled once as bytes (space-padding is normative) ──────────────
// open:  `<!-- <namespace>:<name><options> -->`   close: `<!-- /<namespace>:<name> -->`
// Exactly one ASCII space after `<!--` and exactly one before `-->` in every marker.

export const webdirectivesSsrSuite: SsrWireVectorSuite = {
  standard: 'webdirectives',
  contract: '@webeverything/contracts/webdirectives',
  vectors: [
    {
      id: 'webdirectives-ssr/for-each/keyed-items-expanded',
      description:
        'A keyed `for-each` expands every item between paired markers; each item carries `data-key` (the ' +
        'only key channel). Marker space-padding is byte-exact.',
      input:
        '<template is="for-each" items="users" key="id">' +
        '<div class="user-row">{{name}}</div>' +
        '</template>',
      data: { users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
      expectedHtml:
        '<!-- control:for-each items="users" key="id" -->\n' +
        '<div class="user-row" data-key="1">Alice</div>\n' +
        '<div class="user-row" data-key="2">Bob</div>\n' +
        '<!-- /control:for-each -->',
    },
    {
      id: 'webdirectives-ssr/for-each/empty-list-markers-only',
      description:
        'A keyed `for-each` over an empty list emits the paired markers with no item content between them ' +
        '(the region is still delimited so the client can hydrate an empty keyed region).',
      input:
        '<template is="for-each" items="users" key="id">' +
        '<div class="user-row">{{name}}</div>' +
        '</template>',
      data: { users: [] },
      expectedHtml:
        '<!-- control:for-each items="users" key="id" -->\n' +
        '<!-- /control:for-each -->',
    },
    {
      id: 'webdirectives-ssr/if/true-branch-emitted',
      description:
        'A live `if` emits only the matching branch inside its markers; the `condition` resume token rides ' +
        'the open marker (state-token layout).',
      input:
        '<template is="if" condition="isAdmin">' +
        '<button class="admin-action">Delete</button>' +
        '</template>',
      data: { isAdmin: true },
      expectedHtml:
        '<!-- control:if condition="isAdmin" -->\n' +
        '<button class="admin-action">Delete</button>\n' +
        '<!-- /control:if -->',
    },
    {
      id: 'webdirectives-ssr/if/false-branch-empty-markers',
      description:
        'A false `if` emits empty markers only — zero-JS baseline shows nothing, and the client can toggle ' +
        'the region on without re-parsing structure.',
      input:
        '<template is="if" condition="isAdmin">' +
        '<button class="admin-action">Delete</button>' +
        '</template>',
      data: { isAdmin: false },
      expectedHtml:
        '<!-- control:if condition="isAdmin" -->\n' +
        '<!-- /control:if -->',
    },
    {
      id: 'webdirectives-ssr/switch/active-case-only',
      description:
        'A `switch` emits only the active case branch; the `value` resume token rides the open marker so the ' +
        'client resolves the same case on hydration (bounded in-marker state).',
      input:
        '<template is="switch" value="status">' +
        '<case when="active"><span class="badge success">Active</span></case>' +
        '<case when="idle"><span class="badge muted">Idle</span></case>' +
        '</template>',
      data: { status: 'active' },
      expectedHtml:
        '<!-- control:switch value="status" -->\n' +
        '<span class="badge success">Active</span>\n' +
        '<!-- /control:switch -->',
    },
    {
      id: 'webdirectives-ssr/resource-loader/resolved-data-inline',
      description:
        'A `resource:loader` emits the success template with resolved data inline (zero-JS baseline shows the ' +
        'resolved content); the non-`control` namespace still obeys the same space-padded marker grammar.',
      input:
        '<template is="resource:loader" name="user-profile">' +
        '<user-card>{{profile.name}}</user-card>' +
        '</template>',
      data: { profile: { name: 'Alice' } },
      expectedHtml:
        '<!-- resource:loader name="user-profile" -->\n' +
        '<user-card>Alice</user-card>\n' +
        '<!-- /resource:loader -->',
    },
    {
      id: 'webdirectives-ssr/defer/placeholder-branch-emitted',
      description:
        'A `defer` emits the placeholder (pre-trigger) branch plus its markers; the content branch is stamped ' +
        'client-side when the trigger fires, so the server bytes carry only the placeholder.',
      input:
        '<template is="defer" on="visible">' +
        '<placeholder><div class="skeleton"></div></placeholder>' +
        '<content><article>Loaded</article></content>' +
        '</template>',
      data: {},
      expectedHtml:
        '<!-- defer on="visible" -->\n' +
        '<div class="skeleton"></div>\n' +
        '<!-- /defer -->',
    },
  ],
};

/** An SSR wire-format golden-vector suite failed the structural schema (a malformed corpus a renderer would mis-run). */
export class SsrWireSchemaError extends Error {
  constructor(suite: string, why: string) {
    super(`Web Directives SSR wire-format vector suite "${suite}" is malformed: ${why}`);
    this.name = 'SsrWireSchemaError';
  }
}

/** Bytes that MUST NOT appear inside an HTML comment (parser breakout / injection guard, per the standard). */
const COMMENT_UNSAFE = /--/;

/**
 * Dependency-free structural validator — the WE half of the kit's "schema + verifier" for the SSR wire
 * format. Asserts the suite is well-formed AND that each golden's `expectedHtml` obeys the normative marker
 * grammar (so a conforming renderer's oracle can trust the corpus without defensive parsing):
 *
 *   - a `standard` of `webdirectives`, a `contract`, ≥1 vector, unique ids;
 *   - each vector has a non-empty `id`/`input`, a `data` object, and a non-empty `expectedHtml`;
 *   - `expectedHtml` opens with a space-padded `<!-- ns:name … -->` marker and closes with a matching
 *     space-padded `<!-- /ns:name -->` marker (the open/close grammar, byte-exact padding);
 *   - no HTML-comment carries a `--` breakout sequence in its body (raw-data-in-comment guard);
 *   - the source `input` is NOT itself already-expanded output (must contain a `<template is=` authoring form),
 *     so a vector can't accidentally pin output-as-input.
 *
 * Validates *shape + grammar*, never renders — grading a renderer's emitted bytes against `expectedHtml` is
 * the renderer/oracle's job (#2064).
 */
export function assertSsrWireSuite(suite: SsrWireVectorSuite): SsrWireVectorSuite {
  const label = suite?.standard ?? '(unknown)';
  if (!suite || typeof suite !== 'object') throw new SsrWireSchemaError(label, 'not an object');
  if (suite.standard !== 'webdirectives') throw new SsrWireSchemaError(label, '`standard` must be "webdirectives"');
  if (!suite.contract) throw new SsrWireSchemaError(label, '`contract` is required');
  if (!Array.isArray(suite.vectors) || suite.vectors.length === 0)
    throw new SsrWireSchemaError(label, '`vectors` must be a non-empty array');

  // The normative markers: one ASCII space inside each delimiter. Open carries the directive token
  // (`ns:name` for namespaced directives like `control:if`, or a bare `name` like `defer`) + optional
  // options; close carries `/<token>` only. We require exactly one ` ` of padding on each side.
  const openMarker = /^<!-- ([a-z]+(?::[a-z-]+)?)(?: [^\n]*?)? -->/;
  const closeMarker = /<!-- \/([a-z]+(?::[a-z-]+)?) -->$/;

  const seen = new Set<string>();
  for (const v of suite.vectors) {
    if (!v.id) throw new SsrWireSchemaError(label, 'a vector is missing `id`');
    if (seen.has(v.id)) throw new SsrWireSchemaError(label, `duplicate vector id "${v.id}"`);
    seen.add(v.id);
    if (!v.input || typeof v.input !== 'string')
      throw new SsrWireSchemaError(label, `vector "${v.id}" needs a non-empty \`input\``);
    if (!/<template\s+is=/.test(v.input))
      throw new SsrWireSchemaError(label, `vector "${v.id}" \`input\` must be authoring source (a \`<template is=…>\`), not expanded output`);
    if (!v.data || typeof v.data !== 'object' || Array.isArray(v.data))
      throw new SsrWireSchemaError(label, `vector "${v.id}" needs a \`data\` object`);
    if (typeof v.expectedHtml !== 'string' || v.expectedHtml.length === 0)
      throw new SsrWireSchemaError(label, `vector "${v.id}" needs a non-empty \`expectedHtml\``);

    const open = openMarker.exec(v.expectedHtml);
    if (!open)
      throw new SsrWireSchemaError(label, `vector "${v.id}" \`expectedHtml\` must open with a space-padded \`<!-- ns:name … -->\` marker`);
    const close = closeMarker.exec(v.expectedHtml);
    if (!close)
      throw new SsrWireSchemaError(label, `vector "${v.id}" \`expectedHtml\` must close with a space-padded \`<!-- /ns:name -->\` marker`);
    if (open[1] !== close[1])
      throw new SsrWireSchemaError(label, `vector "${v.id}" open/close marker names differ ("${open[1]}" vs "${close[1]}")`);

    // Raw-data-in-comment guard: no `--` breakout inside any comment body.
    for (const body of v.expectedHtml.matchAll(/<!--([\s\S]*?)-->/g)) {
      if (COMMENT_UNSAFE.test(body[1]))
        throw new SsrWireSchemaError(label, `vector "${v.id}" has a \`--\` breakout sequence inside a comment marker`);
    }
  }
  return suite;
}
