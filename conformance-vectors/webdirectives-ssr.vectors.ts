/**
 * Web Directives **SSR wire-format** golden conformance-vector suite (ratified #2030, on the #899/#1016
 * kit; the load-bearing first slice of the SSR surface, #2063; state-serialization slice, #2065).
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
 * **State-serialization (this slice, #2065) — the bounded in-marker framework tokens:**
 *   - `for-each` markers carry `count="N"` (item count, so the client knows the region size without scanning)
 *     and `key-hash="<hex8>"` for non-empty keyed lists (DJB2 of the comma-joined projected key strings, so
 *     the client can detect key-set changes with a single comparison — the raw key values stay on `data-key`
 *     attributes, NEVER in comment text, per the raw-data-in-comment guard).
 *   - `if` markers carry `condition="<attr>"` (chosen branch, already in the open marker per #2063).
 *   - `switch` markers carry `value="<attr>"` (chosen branch, already in the open marker per #2063).
 *   These tokens are bounded: they are framework-owned attribute names with non-user-data values (attr names,
 *   counts, compact hashes). Renderers MUST NOT emit unbounded user-data strings into comment text.
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
        'only key channel). The open marker carries `count` (item count) and `key-hash` (DJB2 of the ' +
        'comma-joined projected key strings) as bounded resume tokens — raw key values stay on `data-key`, ' +
        'never in comment text. Marker space-padding is byte-exact.',
      input:
        '<template is="for-each" items="users" key="id">' +
        '<div class="user-row">{{name}}</div>' +
        '</template>',
      data: { users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
      // key-hash: DJB2 of "1,2" = 0b866f0a
      expectedHtml:
        '<!-- control:for-each items="users" key="id" count="2" key-hash="0b866f0a" -->\n' +
        '<div class="user-row" data-key="1">Alice</div>\n' +
        '<div class="user-row" data-key="2">Bob</div>\n' +
        '<!-- /control:for-each -->',
    },
    {
      id: 'webdirectives-ssr/for-each/empty-list-markers-only',
      description:
        'A keyed `for-each` over an empty list emits the paired markers with `count="0"` and no item ' +
        'content (the region is still delimited so the client can hydrate an empty keyed region; no ' +
        '`key-hash` is emitted when the list is empty — nothing to hash).',
      input:
        '<template is="for-each" items="users" key="id">' +
        '<div class="user-row">{{name}}</div>' +
        '</template>',
      data: { users: [] },
      expectedHtml:
        '<!-- control:for-each items="users" key="id" count="0" -->\n' +
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
    // #2065 — directive-state serialization: vectors whose focus is the bounded resume-token layout
    {
      id: 'webdirectives-ssr/for-each/state-tokens-three-items',
      description:
        'A keyed `for-each` over three items carries `count="3"` and the DJB2 `key-hash` of the ' +
        'comma-joined projected keys as bounded resume tokens in the open marker. This is the canonical ' +
        'state-serialization test for `for-each` (independent of the existing two-item keyed vector).',
      input:
        '<template is="for-each" items="products" key="sku">' +
        '<li class="product">{{name}}</li>' +
        '</template>',
      data: {
        products: [
          { sku: 'A1', name: 'Alpha' },
          { sku: 'B2', name: 'Beta' },
          { sku: 'C3', name: 'Gamma' },
        ],
      },
      // key-hash: DJB2 of "A1,B2,C3" = d792ea35
      expectedHtml:
        '<!-- control:for-each items="products" key="sku" count="3" key-hash="d792ea35" -->\n' +
        '<li class="product" data-key="A1">Alpha</li>\n' +
        '<li class="product" data-key="B2">Beta</li>\n' +
        '<li class="product" data-key="C3">Gamma</li>\n' +
        '<!-- /control:for-each -->',
    },
    {
      id: 'webdirectives-ssr/state-tokens/if-condition-resume-token',
      description:
        '`if` open marker carries `condition="<attr-name>"` as the bounded resume token (so the client ' +
        'resolves the same branch on hydration without re-evaluating the data). The token is the attribute ' +
        'name, not the resolved value — a non-user-data string, safe in comment text.',
      input:
        '<template is="if" condition="showBanner">' +
        '<div class="banner">Welcome</div>' +
        '</template>',
      data: { showBanner: true },
      expectedHtml:
        '<!-- control:if condition="showBanner" -->\n' +
        '<div class="banner">Welcome</div>\n' +
        '<!-- /control:if -->',
    },
    {
      id: 'webdirectives-ssr/state-tokens/switch-value-resume-token',
      description:
        '`switch` open marker carries `value="<attr-name>"` as the bounded resume token (so the client ' +
        'resolves the same case on hydration without re-evaluating the data). The token is the attribute ' +
        'name, not the resolved user-data value.',
      input:
        '<template is="switch" value="theme">' +
        '<case when="dark"><body class="dark"></body></case>' +
        '<case when="light"><body class="light"></body></case>' +
        '</template>',
      data: { theme: 'dark' },
      expectedHtml:
        '<!-- control:switch value="theme" -->\n' +
        '<body class="dark"></body>\n' +
        '<!-- /control:switch -->',
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
 * DJB2 hash of a string (unsigned 32-bit, hex-padded to 8 chars). Used by the state-token validator to
 * assert that `key-hash` values in `for-each` golden markers match the expected hash of their key sequence.
 * This is the canonical hash function for `key-hash`; renderers MUST use the same algorithm (#2065).
 *
 * The hash input is the comma-joined list of projected key strings (e.g. `"1,2"` for keys [1, 2]).
 */
export function djb2KeyHash(keySequence: string): string {
  let h = 5381;
  for (let i = 0; i < keySequence.length; i++) {
    h = (((h << 5) + h) ^ keySequence.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

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
 *     so a vector can't accidentally pin output-as-input;
 *   - **state-token layout (#2065):** a `control:for-each` open marker MUST carry a `count="N"` token (item
 *     count), and when the list is non-empty MUST carry a `key-hash="<hex8>"` token (DJB2 of the
 *     comma-joined `data-key` values extracted from the golden's `expectedHtml`).
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

    // #2065 state-token validation: `control:for-each` open markers must carry `count` and (when non-empty)
    // `key-hash`, so the golden suite itself enforces the bounded-resume-token contract.
    if (open[1] === 'control:for-each') {
      const openLine = v.expectedHtml.split('\n')[0];
      const countMatch = /\bcount="(\d+)"/.exec(openLine);
      if (!countMatch)
        throw new SsrWireSchemaError(label, `vector "${v.id}" \`control:for-each\` open marker missing \`count\` state token`);
      const count = Number(countMatch[1]);
      const dataKeys = [...v.expectedHtml.matchAll(/\bdata-key="([^"]*)"/g)].map((m) => m[1]);
      if (count !== dataKeys.length)
        throw new SsrWireSchemaError(label, `vector "${v.id}" \`count\` state token (${count}) does not match data-key count (${dataKeys.length})`);
      if (count > 0) {
        const keyHashMatch = /\bkey-hash="([0-9a-f]{8})"/.exec(openLine);
        if (!keyHashMatch)
          throw new SsrWireSchemaError(label, `vector "${v.id}" non-empty \`control:for-each\` open marker missing \`key-hash\` state token`);
        const expected = djb2KeyHash(dataKeys.join(','));
        if (keyHashMatch[1] !== expected)
          throw new SsrWireSchemaError(label, `vector "${v.id}" \`key-hash\` "${keyHashMatch[1]}" does not match DJB2("${dataKeys.join(',')}") = "${expected}"`);
      }
    }
  }
  return suite;
}
