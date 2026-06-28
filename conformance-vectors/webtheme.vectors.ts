/**
 * webtheme conformance-vector suite (#1908, cascade #1294) — the Web Theme token-resolution standard's
 * behavioral corpus. T3 of the webtheme relocation: WE owns the build-agnostic vectors, FUI owns the runtime
 * (`fui:webtheme`, relocated #1907) + the binding (`webthemeConformance.ts`) that drives it; the neutral
 * runner lives in `plateau:src/conformance-engine/conformanceVectors.ts`.
 *
 * webtheme is a **non-verdict** standard: the conformance subject is the **resolved token map** that
 * `resolveTokens` projects a DTCG document onto (NOT the `compileToCss` string — per the #1816 ruling the
 * compiled CSS is a *rendering* downstream of resolution, while the resolved map is the canonical observable).
 * Per #1816 / #1847 that object observable is judged by the **`deep-equal`** matcher (the structural-equality
 * member of the closed matcher vocabulary), not strict `===`.
 *
 * The vectors judge only the observable resolved map read through the binding — never an internal of the
 * walk (the alias-cycle guard, the `extends` deep-merge recursion). A component is conformant if it produces
 * this resolved map however it is built (the #506/#899 golden-vectors model). The runtime impl is FUI's
 * (#1907, statute #1282); the contract it judges stays WE's `@webeverything/contracts/webtheme`.
 *
 * The binding exposes two object surfaces, both deep-equal:
 *   - `resolvedMap` — every token's `dot.path → resolved literal` (alias chains followed to the end,
 *     templated `calc(...)` refs substituted), the projection `resolveTokens` exists to produce.
 *   - `aliasMap`    — every aliasing token's `dot.path → aliasOf` (the path it points at), the `var(--ref)`
 *     compilation hook `resolveTokens` keeps alongside the literal.
 */
import type { ConformanceVectorSuite } from './schema.js';

const CONTRACT = '@webeverything/contracts/webtheme';

export const webthemeSuite: ConformanceVectorSuite = {
  standard: 'webtheme',
  contract: CONTRACT,
  vectors: [
    {
      // A flat primitive scale resolves each token to its own literal — no aliasing, no derivation.
      id: 'webtheme/resolve/literals-pass-through',
      contract: CONTRACT,
      description: 'Non-alias token values resolve to themselves; the resolved map mirrors the source literals.',
      steps: [
        { do: 'setBase', doc: {
          radius: { $type: 'dimension', sm: { $value: '0.25rem' }, md: { $value: '0.5rem' } },
          space: { $type: 'dimension', '4': { $value: '1rem' } },
        } },
        { do: 'resolve' },
      ],
      expect: {
        resolvedMap: { 'radius.sm': '0.25rem', 'radius.md': '0.5rem', 'space.4': '1rem' },
        aliasMap: {},
        matchers: { resolvedMap: 'deep-equal', aliasMap: 'deep-equal' },
      },
      observeVia: ['resolvedMap', 'aliasMap'],
    },
    {
      // A {group.token} alias resolves to its target's literal AND records aliasOf for var(--ref) compilation.
      id: 'webtheme/resolve/alias-follows-to-literal',
      contract: CONTRACT,
      description: 'A bare {group.token} alias resolves to the target literal; aliasOf carries the pointed-at path.',
      steps: [
        { do: 'setBase', doc: {
          radius: { $type: 'dimension', md: { $value: '0.5rem' } },
          button: { $type: 'dimension', radius: { $value: '{radius.md}' } },
        } },
        { do: 'resolve' },
      ],
      expect: {
        resolvedMap: { 'radius.md': '0.5rem', 'button.radius': '0.5rem' },
        aliasMap: { 'button.radius': 'radius.md' },
        matchers: { resolvedMap: 'deep-equal', aliasMap: 'deep-equal' },
      },
      observeVia: ['resolvedMap', 'aliasMap'],
    },
    {
      // A multi-hop alias chain follows to the end; every link resolves to the same terminal literal.
      id: 'webtheme/resolve/alias-chain-follows-to-end',
      contract: CONTRACT,
      description: 'An alias pointing at another alias follows the chain to the terminal literal.',
      steps: [
        { do: 'setBase', doc: {
          radius: {
            $type: 'dimension',
            base: { $value: '0.5rem' },
            md: { $value: '{radius.base}' },
            button: { $value: '{radius.md}' },
          },
        } },
        { do: 'resolve' },
      ],
      expect: {
        resolvedMap: { 'radius.base': '0.5rem', 'radius.md': '0.5rem', 'radius.button': '0.5rem' },
        aliasMap: { 'radius.md': 'radius.base', 'radius.button': 'radius.md' },
        matchers: { resolvedMap: 'deep-equal', aliasMap: 'deep-equal' },
      },
      observeVia: ['resolvedMap', 'aliasMap'],
    },
    {
      // A templated calc() value (#1315) substitutes each embedded {ref} with its resolved literal in place.
      // It is NOT a bare alias, so it carries no aliasOf — the resolved value is the concrete calc() literal.
      id: 'webtheme/resolve/templated-calc-substitutes-refs',
      contract: CONTRACT,
      description: 'A calc({ref} - 2px) templated value substitutes the resolved literal; it is not an alias.',
      steps: [
        { do: 'setBase', doc: {
          radius: {
            $type: 'dimension',
            base: { $value: '0.5rem' },
            sm: { $value: 'calc({radius.base} - 2px)' },
          },
        } },
        { do: 'resolve' },
      ],
      expect: {
        resolvedMap: { 'radius.base': '0.5rem', 'radius.sm': 'calc(0.5rem - 2px)' },
        aliasMap: {},
        matchers: { resolvedMap: 'deep-equal', aliasMap: 'deep-equal' },
      },
      observeVia: ['resolvedMap', 'aliasMap'],
    },
    {
      // `extends` deep-merges a project override over the base: an overridden token wins wholesale, an
      // untouched sibling is inherited, and a brand-new token is added — then the merged doc resolves.
      id: 'webtheme/extends/override-merges-then-resolves',
      contract: CONTRACT,
      description: 'extends() deep-merges the override over the base (override-wins + inherit-untouched + add-new); the merged map resolves.',
      steps: [
        { do: 'setBase', doc: {
          radius: { $type: 'dimension', sm: { $value: '0.25rem' }, md: { $value: '0.5rem' } },
        } },
        { do: 'extend', override: {
          radius: { $type: 'dimension', md: { $value: '0.75rem' }, lg: { $value: '1rem' } },
        } },
        { do: 'resolve' },
      ],
      expect: {
        // sm inherited from base; md overridden to 0.75rem; lg added by the override.
        resolvedMap: { 'radius.sm': '0.25rem', 'radius.md': '0.75rem', 'radius.lg': '1rem' },
        aliasMap: {},
        matchers: { resolvedMap: 'deep-equal', aliasMap: 'deep-equal' },
      },
      observeVia: ['resolvedMap', 'aliasMap'],
    },
    {
      // An override may repoint a token at an alias; after the merge the alias resolves against the merged
      // document (proving extends-then-resolve composes, not a stale pre-merge resolution).
      id: 'webtheme/extends/override-introduces-alias-resolved-post-merge',
      contract: CONTRACT,
      description: 'An override that repoints a token at an alias resolves against the merged document.',
      steps: [
        { do: 'setBase', doc: {
          radius: { $type: 'dimension', md: { $value: '0.5rem' }, button: { $value: '0.25rem' } },
        } },
        { do: 'extend', override: {
          radius: { $type: 'dimension', button: { $value: '{radius.md}' } },
        } },
        { do: 'resolve' },
      ],
      expect: {
        resolvedMap: { 'radius.md': '0.5rem', 'radius.button': '0.5rem' },
        aliasMap: { 'radius.button': 'radius.md' },
        matchers: { resolvedMap: 'deep-equal', aliasMap: 'deep-equal' },
      },
      observeVia: ['resolvedMap', 'aliasMap'],
    },
  ],
};

export default webthemeSuite;
