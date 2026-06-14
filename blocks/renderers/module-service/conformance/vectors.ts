/**
 * @file blocks/renderers/module-service/conformance/vectors.ts
 * @description The MaaS conformance vector INPUTS — the hand-authored neutral cases (backlog #506).
 *
 * Each input pairs an origin state to seed (`fixture`) with a request to issue (`request`). The expected
 * response is NOT written here — it is generated from the reference implementation (`./generate.ts`) and
 * frozen into `golden.json`, so the golden bytes are computed once and reviewed in the diff, never
 * hand-guessed. A `{id}` token in a url or header is the artifact's content-hash id, substituted at
 * generation time (see `resolveVectorId`), because the id is itself part of the contract under test.
 *
 * Coverage mirrors every row of the serve-path IR's `responses` table (`../servePathIR.ts`) plus the
 * #088 identity invariants: the pin ladder (floating/tag/semver → 302; terminal hash → 200), conditional
 * requests (304), the provenance + lossy/diagnostic header contract, param-sensitivity of the id, and
 * each error shape (400 unknown form, 404 unknown component / non-MaaS path / stale pin).
 */

import type { VectorFixture } from './runner';

/** A vector input: seed + request, with `{id}` placeholders the generator resolves. */
export interface VectorInput {
  readonly name: string;
  readonly description: string;
  readonly fixture: VectorFixture;
  readonly request: {
    readonly url: string;
    readonly method?: string;
    readonly headers?: Readonly<Record<string, string>>;
  };
}

/** The canonical fixture most vectors share — a wc-class component with a fixed transform output. */
const USER_CARD: VectorFixture = {
  component: 'user-card',
  definition: '<component name="user-card"><span>{{label}}</span></component>',
  producer: 'webadapters/1.2.3; esbuild/0.21.5',
  transform: {
    code: 'export class UserCard extends HTMLElement { connectedCallback() { this.textContent = "card"; } }',
    language: 'javascript',
    lossy: false,
    diagnostics: [],
  },
};

/** A fixture whose transform reports a lossy form + a diagnostic — exercises the #081 wire headers. */
const LOSSY_CARD: VectorFixture = {
  ...USER_CARD,
  transform: {
    ...USER_CARD.transform,
    lossy: true,
    diagnostics: ['target — ignored by this form'],
  },
};

export const VECTOR_INPUTS: readonly VectorInput[] = Object.freeze([
  {
    name: 'floating-unpinned-redirects',
    description: 'An unpinned (floating) request 302-redirects to the terminal content-hash URL, never immutable.',
    fixture: USER_CARD,
    request: { url: '/_maas/user-card.js?form=wc-class' },
  },
  {
    name: 'tag-latest-redirects',
    description: 'A floating @latest tag 302-redirects to the same terminal content-hash URL.',
    fixture: USER_CARD,
    request: { url: '/_maas/user-card@latest.js?form=wc-class' },
  },
  {
    name: 'exact-semver-redirects',
    description: 'An exact semver pin 302-redirects to the terminal content-hash URL (the pin ladder).',
    fixture: USER_CARD,
    request: { url: '/_maas/user-card@1.4.2.js?form=wc-class' },
  },
  {
    name: 'hash-pin-served-immutable',
    description: 'A terminal content-hash pin is served directly: 200, body bytes, immutable cache, ETag, SRI integrity.',
    fixture: USER_CARD,
    request: { url: '/_maas/user-card@{id}.js?form=wc-class' },
  },
  {
    name: 'conditional-if-none-match-304',
    description: 'A hash-pinned request whose If-None-Match equals the ETag returns 304 with no body.',
    fixture: USER_CARD,
    request: {
      url: '/_maas/user-card@{id}.js?form=wc-class',
      headers: { 'If-None-Match': '"{id}"' },
    },
  },
  {
    name: 'param-target-changes-id',
    description: 'A byte-determining param (target) mints a different id; the artifact still serves 200 at its own pin.',
    fixture: USER_CARD,
    request: { url: '/_maas/user-card@{id}.js?form=wc-class&target=es2017' },
  },
  {
    name: 'lossy-diagnostic-headers',
    description: 'A lossy form surfaces X-MaaS-Lossy + a url-encoded X-MaaS-Diagnostic over the wire (#081).',
    fixture: LOSSY_CARD,
    request: { url: '/_maas/user-card@{id}.js?form=wc-class' },
  },
  {
    name: 'unknown-form-400',
    description: 'An unknown form query value is a 400 with the structured JSON error body.',
    fixture: USER_CARD,
    request: { url: '/_maas/user-card.js?form=bogus' },
  },
  {
    name: 'unknown-component-404',
    description: 'A request for a component the resolver does not know is a 404.',
    fixture: USER_CARD,
    request: { url: '/_maas/ghost.js?form=wc-class' },
  },
  {
    name: 'non-maas-path-404',
    description: 'A path outside the MaaS base path is a 404 (not this origin).',
    fixture: USER_CARD,
    request: { url: '/elsewhere.js' },
  },
  {
    name: 'stale-hash-pin-404',
    description: 'A terminal hash pin that does not match current state is a 404 (no historical store in v1).',
    fixture: USER_CARD,
    request: { url: '/_maas/user-card@sha256-0000000000000000000000000000000000000000000.js?form=wc-class' },
  },
]);
