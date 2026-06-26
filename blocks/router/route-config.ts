/**
 * @file blocks/router/route-config.ts
 * @description The webrouting **route-config schema** — the serializable routing settings the #1687
 * ruling homes in WE (codified at docs/agent/platform-decisions.md#configurability-partition).
 *
 * Per the project principle *allow every setting with merit and real-app use, place each by
 * serializability*, this schema is WE's own capability vocabulary for the deploy-shaped routing settings
 * the Navigation Intent punts as non-UX. It is **presentation-free** and **serializable-only**: a value a
 * tool can read without a running app. Two load-bearing invariants this schema exists to pin (mirroring
 * how {@link ./route-map} pins "no non-serializable field leak"):
 *
 *  1. **Serializable-only** — a *code-shaped* form (a `scrollBehavior` function, a per-route `import()`
 *     lazy thunk) is authored on the `router` block, never in this schema (#1687: "code form → the block,
 *     not dropped"). The validator rejects a function/thunk where a serializable value is required.
 *  2. **Scope partition** — an **app-global** setting (base, history mode, prerender, 404 fallback,
 *     trailing-slash, redirects/aliases, locale-prefix, case-sensitivity) is a field on {@link RouteConfig}
 *     (the `webeverything.config.routing` projection); a **per-route** setting (this route is lazy, that
 *     route's scroll policy) is a field on {@link RoutePolicy} (a route-map entry / `<we-route-view>`
 *     declaration), never the global file. The validator rejects a per-route key at the global scope and
 *     vice-versa, so the two surfaces can't be conflated.
 *
 * Defaults are **native-first / most-permissive** (config-extends-platform-default): the core is
 * default-less — the config object carries only the author's *overrides*; an absent field means the
 * platform-native value (browser history, no forced prerender, scroll `auto`, no forced case-sensitivity).
 *
 * The enumerated set is **open by design** (#1687) — a new serializable setting is added as real apps
 * surface it, vetted by merit + real-app use and normalized to WE's vocabulary, never by copying a
 * framework's idiosyncratic surface. One conforming router exists today (`@frontierui/blocks/router`), so
 * this is an internal schema + vectors; a `CustomRouteConfig` protocol is minted only on a second
 * independent impl (protocol temporal rule), exactly as {@link ./route-map} notes.
 *
 * History mode (browser/hash/memory) is the router **transport** and is *not* the #1686 URL-persistence
 * axis (url/session/memory) — both spend a "memory" token; see {@link RouteHistoryMode}.
 */

// ---------------------------------------------------------------------------
// App-global schema — `webeverything.config.routing.*`
// ---------------------------------------------------------------------------

/**
 * Router **transport** mode — how navigation state is carried in the URL. Distinct from the #1686
 * URL-persistence axis (url/session/memory): this is the address-bar grammar, persistence is per-navigation
 * state retention. Native-first default is `browser` (the History API).
 */
export type RouteHistoryMode = 'browser' | 'hash' | 'memory';

/**
 * Trailing-slash normalization policy for matching + generated URLs. `preserve` (the most-permissive
 * native default) matches the URL as authored; `always`/`never` canonicalize.
 */
export type TrailingSlashPolicy = 'preserve' | 'always' | 'never';

/**
 * Locale-prefix routing strategy — the *URL prefix* dimension of i18n routing only (the message catalog is a
 * separate concern, #1687 placement boundary). `never` = no locale segment; `always` = every locale prefixed;
 * `except-default` = the `defaultLocale` is served unprefixed, others prefixed.
 */
export interface LocalePrefixConfig {
  /** The prefix strategy. */
  strategy: 'always' | 'except-default' | 'never';
  /** The unprefixed locale under `except-default` (e.g. `en`); ignored by the other strategies. */
  defaultLocale?: string;
}

/** One redirect/alias rule — a deploy-shaped path rewrite. `permanent` selects 308 vs 307 (default temporary). */
export interface RouteRedirect {
  /** Source path or URLPattern template to redirect from (e.g. `/old/:id`). */
  from: string;
  /** Destination path the source rewrites to (e.g. `/new/:id`). */
  to: string;
  /** Whether the redirect is permanent (308) rather than temporary (307). Omitted = temporary. */
  permanent?: boolean;
}

/**
 * The serializable **app-global** route configuration — the `webeverything.config.routing` projection of the
 * route-config schema. Every field is optional (default-less core): an absent field means the native default.
 * This object is the schema's app-global projection, *not* the whole schema — per-route settings live on
 * {@link RoutePolicy}.
 */
export interface RouteConfig {
  /** Base path prepended to all route patterns (mirrors the router block's `base` attribute, single-SoT). */
  base?: string;
  /** Router transport mode (browser/hash/memory). Native default: `browser`. */
  history?: RouteHistoryMode;
  /** Pre-render the static route set at build time. Native default: `false` (no forced prerender). */
  prerender?: boolean;
  /** Path of the 404 fallback route served when no entry matches (e.g. `/404`). */
  notFound?: string;
  /** Trailing-slash policy. Native default: `preserve`. */
  trailingSlash?: TrailingSlashPolicy;
  /** Ordered redirect/alias rules; first match wins, mirroring route order. */
  redirects?: RouteRedirect[];
  /** Locale-prefix routing strategy (the URL-prefix dimension of i18n only). */
  localePrefix?: LocalePrefixConfig;
  /** Case-sensitive path matching. Native default: `false` (case-insensitive, the most-permissive form). */
  caseSensitive?: boolean;
}

// ---------------------------------------------------------------------------
// Per-route schema — fields on a route-map entry / `<we-route-view>` declaration
// ---------------------------------------------------------------------------

/** Per-route scroll-restoration policy (the serializable enum; the `scrollBehavior` *function* form stays on the block). */
export type RouteScrollPolicy = 'auto' | 'manual' | 'none';

/**
 * The serializable **per-route** settings — the route-scoped half of the schema, attached to a single route
 * entry (not the global config file). The code-shaped forms of these settings (`scrollBehavior` function,
 * per-route `import()` lazy thunk) are authored on the block and are deliberately absent here.
 */
export interface RoutePolicy {
  /** This route is lazily loaded. The serializable flag form; the `import()` thunk form stays on the block. */
  lazy?: boolean;
  /** This route's scroll-restoration policy (the serializable enum form). */
  scroll?: RouteScrollPolicy;
}

// ---------------------------------------------------------------------------
// Structural validators — dependency-free, return a list of violations
// ---------------------------------------------------------------------------

const HISTORY_MODES = new Set<string>(['browser', 'hash', 'memory']);
const TRAILING_SLASH = new Set<string>(['preserve', 'always', 'never']);
const LOCALE_STRATEGIES = new Set<string>(['always', 'except-default', 'never']);
const SCROLL_POLICIES = new Set<string>(['auto', 'manual', 'none']);

/** Keys the app-global {@link RouteConfig} admits. */
const CONFIG_KEYS = new Set<string>([
  'base',
  'history',
  'prerender',
  'notFound',
  'trailingSlash',
  'redirects',
  'localePrefix',
  'caseSensitive',
]);

/** Keys the per-route {@link RoutePolicy} admits. */
const POLICY_KEYS = new Set<string>(['lazy', 'scroll']);

/**
 * Structurally validate an **app-global** {@link RouteConfig}, returning a list of human-readable
 * violations (empty = conformant). Pins the two load-bearing invariants: no per-route key at global scope
 * (scope partition), and no code-shaped value where a serializable one is required (serializable-only).
 */
export function validateRouteConfig(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['route config must be an object of shape { base?, history?, prerender?, … }'];
  }
  const config = value as Record<string, unknown>;
  for (const key of Object.keys(config)) {
    if (!CONFIG_KEYS.has(key)) {
      // A per-route key leaking into the global config is the headline scope-partition failure.
      const scope = POLICY_KEYS.has(key)
        ? ` (per-route setting — belongs on a route entry / RoutePolicy, not the app-global config)`
        : '';
      errors.push(`unknown key \`${key}\`${scope}`);
    }
  }
  if ('base' in config && typeof config.base !== 'string') {
    errors.push('`base` must be a string when present');
  }
  if ('history' in config && !HISTORY_MODES.has(config.history as string)) {
    errors.push("`history` must be one of 'browser' | 'hash' | 'memory'");
  }
  if ('prerender' in config && typeof config.prerender !== 'boolean') {
    errors.push('`prerender` must be a boolean when present');
  }
  if ('notFound' in config && typeof config.notFound !== 'string') {
    errors.push('`notFound` must be a string when present');
  }
  if ('trailingSlash' in config && !TRAILING_SLASH.has(config.trailingSlash as string)) {
    errors.push("`trailingSlash` must be one of 'preserve' | 'always' | 'never'");
  }
  if ('caseSensitive' in config && typeof config.caseSensitive !== 'boolean') {
    errors.push('`caseSensitive` must be a boolean when present');
  }
  if ('redirects' in config) {
    if (!Array.isArray(config.redirects)) {
      errors.push('`redirects` must be an array of { from, to, permanent? } when present');
    } else {
      config.redirects.forEach((raw, i) => {
        const at = `redirects[${i}]`;
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
          errors.push(`${at} must be a { from, to, permanent? } object`);
          return;
        }
        const rule = raw as Record<string, unknown>;
        for (const key of Object.keys(rule)) {
          if (key !== 'from' && key !== 'to' && key !== 'permanent') {
            errors.push(`${at} has unknown key \`${key}\``);
          }
        }
        if (typeof rule.from !== 'string' || rule.from.length === 0) {
          errors.push(`${at}.from must be a non-empty string`);
        }
        if (typeof rule.to !== 'string' || rule.to.length === 0) {
          errors.push(`${at}.to must be a non-empty string`);
        }
        if ('permanent' in rule && typeof rule.permanent !== 'boolean') {
          errors.push(`${at}.permanent must be a boolean when present`);
        }
      });
    }
  }
  if ('localePrefix' in config) {
    const lp = config.localePrefix;
    if (typeof lp !== 'object' || lp === null || Array.isArray(lp)) {
      errors.push('`localePrefix` must be a { strategy, defaultLocale? } object when present');
    } else {
      const cfg = lp as Record<string, unknown>;
      for (const key of Object.keys(cfg)) {
        if (key !== 'strategy' && key !== 'defaultLocale') {
          errors.push(`\`localePrefix\` has unknown key \`${key}\``);
        }
      }
      if (!LOCALE_STRATEGIES.has(cfg.strategy as string)) {
        errors.push("`localePrefix.strategy` must be one of 'always' | 'except-default' | 'never'");
      }
      if ('defaultLocale' in cfg && typeof cfg.defaultLocale !== 'string') {
        errors.push('`localePrefix.defaultLocale` must be a string when present');
      }
    }
  }
  return errors;
}

/** Convenience boolean form of {@link validateRouteConfig}. */
export function isRouteConfig(value: unknown): value is RouteConfig {
  return validateRouteConfig(value).length === 0;
}

/**
 * Structurally validate a **per-route** {@link RoutePolicy}, returning a list of violations. Pins the
 * mirror scope-partition guard (no app-global key on a route entry) and the serializable-only guard (a
 * `scroll` *function* or `lazy` *thunk* — the code-shaped forms — must not appear here).
 */
export function validateRoutePolicy(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['route policy must be an object of shape { lazy?, scroll? }'];
  }
  const policy = value as Record<string, unknown>;
  for (const key of Object.keys(policy)) {
    if (!POLICY_KEYS.has(key)) {
      const scope = CONFIG_KEYS.has(key)
        ? ` (app-global setting — belongs on the route config, not a per-route entry)`
        : '';
      errors.push(`unknown key \`${key}\`${scope}`);
    }
  }
  if ('lazy' in policy && typeof policy.lazy !== 'boolean') {
    // The serializable form is a boolean flag; a function/thunk is the code form (block-authored).
    const codeForm = typeof policy.lazy === 'function' ? ' (the import() thunk form is authored on the block)' : '';
    errors.push(`\`lazy\` must be a boolean when present${codeForm}`);
  }
  if ('scroll' in policy && !SCROLL_POLICIES.has(policy.scroll as string)) {
    const codeForm =
      typeof policy.scroll === 'function' ? ' (the scrollBehavior function form is authored on the block)' : '';
    errors.push(`\`scroll\` must be one of 'auto' | 'manual' | 'none'${codeForm}`);
  }
  return errors;
}

/** Convenience boolean form of {@link validateRoutePolicy}. */
export function isRoutePolicy(value: unknown): value is RoutePolicy {
  return validateRoutePolicy(value).length === 0;
}
