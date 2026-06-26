/**
 * webrouting route-config schema — conformance vectors (#1732, slice of #1684).
 *
 * Statically-authored route configs, each paired with the schema invariant it proves. These lock the
 * shape of the serializable routing settings the #1687 ruling homes in WE — presentation-free, so any
 * conforming config generator (or a downstream plateau Configurator domain) must reproduce them. The two
 * load-bearing invariants the negative vectors pin are the schema's reason to exist:
 *
 *  - **Scope partition** — a per-route key (`lazy` / `scroll`) must not appear on the app-global config,
 *    and an app-global key (`history`, `base`, …) must not appear on a per-route policy.
 *  - **Serializable-only** — a code-shaped value (a `scrollBehavior` function, an `import()` lazy thunk)
 *    is authored on the `router` block, never in this schema; the validator rejects it here.
 *
 * `valid: true` cases must pass the matching validator; `valid: false` cases must each surface at least
 * one violation (negative vectors that pin the schema's rejections).
 */
import type { RouteConfig, RoutePolicy } from '../route-config';

export interface RouteConfigCase {
  id: string;
  title: string;
  /** Whether the config is expected to conform to the app-global schema. */
  valid: boolean;
  /** The route config under test (typed loosely on negative cases so they can carry malformed shapes). */
  config: RouteConfig | Record<string, unknown>;
  /** For `valid: false`, a substring expected in at least one reported violation. */
  expectViolation?: string;
}

export interface RoutePolicyCase {
  id: string;
  title: string;
  /** Whether the policy is expected to conform to the per-route schema. */
  valid: boolean;
  /** The per-route policy under test. */
  policy: RoutePolicy | Record<string, unknown>;
  /** For `valid: false`, a substring expected in at least one reported violation. */
  expectViolation?: string;
}

export const routeConfigCases: RouteConfigCase[] = [
  {
    id: 'empty-config',
    title: '1 · Empty config — default-less core, every native default in effect',
    valid: true,
    config: {},
  },
  {
    id: 'all-app-global-fields',
    title: '2 · Every app-global serializable setting present (the full #1687 surface)',
    valid: true,
    config: {
      base: '/app',
      history: 'browser',
      prerender: true,
      notFound: '/404',
      trailingSlash: 'never',
      redirects: [
        { from: '/old/:id', to: '/new/:id', permanent: true },
        { from: '/legacy', to: '/' },
      ],
      localePrefix: { strategy: 'except-default', defaultLocale: 'en' },
      caseSensitive: false,
    },
  },
  {
    id: 'hash-memory-modes',
    title: '3 · History transport accepts hash + memory (distinct from #1686 persistence)',
    valid: true,
    config: { history: 'memory' },
  },
  {
    id: 'locale-always-no-default',
    title: '4 · localePrefix `always` needs no defaultLocale',
    valid: true,
    config: { localePrefix: { strategy: 'always' } },
  },
  {
    id: 'leak-per-route-lazy',
    title: '5 · NEGATIVE — a per-route `lazy` key on the app-global config (scope partition)',
    valid: false,
    expectViolation: 'per-route setting',
    config: { base: '/app', lazy: true },
  },
  {
    id: 'leak-per-route-scroll',
    title: '6 · NEGATIVE — a per-route `scroll` key on the app-global config (scope partition)',
    valid: false,
    expectViolation: 'per-route setting',
    config: { scroll: 'manual' },
  },
  {
    id: 'bad-history-mode',
    title: '7 · NEGATIVE — an unknown history transport value',
    valid: false,
    expectViolation: '`history`',
    config: { history: 'html5' },
  },
  {
    id: 'bad-trailing-slash',
    title: '8 · NEGATIVE — an unknown trailing-slash policy',
    valid: false,
    expectViolation: '`trailingSlash`',
    config: { trailingSlash: 'strip' },
  },
  {
    id: 'redirect-missing-to',
    title: '9 · NEGATIVE — a redirect rule missing its `to`',
    valid: false,
    expectViolation: 'redirects[0].to',
    config: { redirects: [{ from: '/old' }] },
  },
  {
    id: 'bad-locale-strategy',
    title: '10 · NEGATIVE — an unknown localePrefix strategy',
    valid: false,
    expectViolation: '`localePrefix.strategy`',
    config: { localePrefix: { strategy: 'subdomain' } },
  },
  {
    id: 'unknown-key',
    title: '11 · NEGATIVE — a framework-idiosyncratic key not normalized into the vocabulary',
    valid: false,
    expectViolation: 'unknown key',
    config: { scrollRestoration: 'manual' },
  },
];

export const routePolicyCases: RoutePolicyCase[] = [
  {
    id: 'empty-policy',
    title: '1 · Empty policy — route inherits the app defaults',
    valid: true,
    policy: {},
  },
  {
    id: 'lazy-and-scroll',
    title: '2 · The serializable per-route forms — `lazy` flag + `scroll` enum',
    valid: true,
    policy: { lazy: true, scroll: 'none' },
  },
  {
    id: 'leak-app-global-history',
    title: '3 · NEGATIVE — an app-global `history` key on a per-route policy (scope partition)',
    valid: false,
    expectViolation: 'app-global setting',
    policy: { history: 'hash' },
  },
  {
    id: 'lazy-thunk-code-form',
    title: '4 · NEGATIVE — the `import()` thunk (code form) where the serializable flag is required',
    valid: false,
    expectViolation: 'block',
    policy: { lazy: () => Promise.resolve({ default: null }) },
  },
  {
    id: 'scroll-function-code-form',
    title: '5 · NEGATIVE — the `scrollBehavior` function (code form) where the enum is required',
    valid: false,
    expectViolation: 'block',
    policy: { scroll: () => ({ top: 0 }) },
  },
];
