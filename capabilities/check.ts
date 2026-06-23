/**
 * we:capabilities/check.ts — WE-side conformance vectors for the capability venues (#1624, the #699
 * neutrality amendment). This is the one runtime-ish thing that legitimately stays in the WE repo under
 * the constellation-placement carve-out: a **gate-consumed conformance vector** — not delivery impl, but
 * the enforceable guard that delivery/bundler coupling can never creep into the standard repo.
 *
 * The vector here pins the edge {@link BuildPlan} (`we:capabilities/edge-io.ts` → {@link emitBuildPlan})
 * **bundler-neutral**: it must expose ONLY the capability-class + cache-key + URL + the declarative,
 * web-standard response-header set, and contain ZERO esbuild / chunk-naming / bundler / delivery-impl
 * fields anywhere in its shape. Pure data assertions, no I/O — consumed by the `capabilities/__tests__`
 * vitest gate (and any future `check:standards` capability pass).
 */
import type { BuildPlan } from './edge-io.js';

/** The ONLY permitted top-level build-plan fields — capability-class + cache-key + url + the header set. */
export const BUILD_PLAN_FIELDS = ['capabilityClass', 'cacheKey', 'url', 'headers'] as const;

/** The ONLY permitted header groups — by the response each directive set applies to. */
export const BUILD_PLAN_HEADER_GROUPS = ['negotiation', 'chunk'] as const;

/** The ONLY permitted declarative, web-standard response-header directives — no bundler/chunk-naming fields. */
export const BUILD_PLAN_DIRECTIVES = ['Vary', 'Accept-CH', 'Critical-CH', 'Cache-Control'] as const;

/**
 * Case-insensitive substrings that signal bundler / chunk-naming / delivery-impl creep — forbidden
 * anywhere in a build plan's keys (the #699 neutrality boundary). A plan describes *what to cache and how
 * to negotiate it*, never *how to bundle it*. Note: bare `chunk` is intentionally NOT here — it names a
 * legitimate response group; the creep we forbid is chunk *naming* (`chunkName`/`chunkFileNames`).
 */
export const BUNDLER_NEUTRAL_FORBIDDEN = [
  'esbuild', 'rollup', 'webpack', 'vite', 'bundle', 'bundler',
  'chunkname', 'chunkfile', 'entryfile', 'filename', 'minify', 'sourcemap',
  'outdir', 'outfile', 'splitting',
] as const;

/** Recursively collect every object key in a value (for the forbidden-field scan). */
function allKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) allKeys(v, acc);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      acc.push(k);
      allKeys(v, acc);
    }
  }
  return acc;
}

/**
 * The bundler-neutrality conformance vector: assert a {@link BuildPlan} exposes ONLY the allowed
 * capability-class + cache-key + URL + declarative header directives, and carries NO bundler/chunk-naming
 * field anywhere. Returns the list of violations — empty means the plan is conformant (the gate asserts
 * `[]`). Data-only, deterministic.
 */
export function assertBuildPlanNeutral(plan: BuildPlan): string[] {
  const violations: string[] = [];
  const has = (allowed: readonly string[], key: string) => allowed.includes(key);

  // 1. top-level shape — only the four declared fields (an extra is where impl leaks).
  for (const key of Object.keys(plan)) {
    if (!has(BUILD_PLAN_FIELDS, key)) {
      violations.push(`unexpected top-level field "${key}" (allowed: ${BUILD_PLAN_FIELDS.join(', ')})`);
    }
  }

  // 2. header groups + their directives — only the declarative, web-standard set.
  for (const [group, directives] of Object.entries(plan.headers ?? {})) {
    if (!has(BUILD_PLAN_HEADER_GROUPS, group)) {
      violations.push(`unexpected header group "${group}" (allowed: ${BUILD_PLAN_HEADER_GROUPS.join(', ')})`);
    }
    for (const directive of Object.keys(directives ?? {})) {
      if (!has(BUILD_PLAN_DIRECTIVES, directive)) {
        violations.push(`unexpected directive "${directive}" in "${group}" (allowed: ${BUILD_PLAN_DIRECTIVES.join(', ')})`);
      }
    }
  }

  // 3. no bundler/chunk-naming/delivery-impl field anywhere in the plan's shape.
  for (const key of allKeys(plan)) {
    const lower = key.toLowerCase();
    const hit = BUNDLER_NEUTRAL_FORBIDDEN.find((forbidden) => lower.includes(forbidden));
    if (hit) violations.push(`forbidden bundler/delivery field "${key}" (matched "${hit}")`);
  }

  return violations;
}
