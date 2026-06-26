/**
 * @file blocks/router/speculation-rules-emitter.ts
 * @description The webrouting **Speculation Rules emitter** (#1740, epic #1684) — a concrete
 * {@link RouteMapEmitter} that derives a native Speculation Rules manifest (the JSON that becomes a
 * `<script type="speculationrules">`) from the canonical {@link RouteMap} projection (#1721) for
 * declarative prefetch / prerender.
 *
 * Native-first (#1688): the Speculation Rules API is the committed substrate
 * (we:src/_data/blocks/router.json `webStandards.speculationRulesAPI`) — this invents no prefetch format,
 * it emits the platform one. Two source kinds, chosen by route shape:
 *
 *  - **document rules** (pattern-preserving) for a **parametric** route — `{ where: { href_matches:
 *    "/users/:id" } }` matches in-DOM links by URLPattern, so NO URL enumeration is needed and no concrete
 *    URL is fabricated (faithful derivation, #faithful-derivation-exclude-not-fabricate). `href_matches`
 *    takes URL Pattern syntax, so the route's own template is passed through unchanged.
 *  - **list rules** for a **static** route — `{ urls: ["/about"] }`, the concrete entries. This is the
 *    URL-list variant; it honors #1688 Fork 1's exclude-by-default by only ever listing routes that already
 *    have a concrete URL (a parametric route never enters the list — it becomes a document rule instead).
 *
 * Error-boundary routes are excluded (a catch-all boundary is not a speculation target). Pure data
 * (RouteMap → rules object); WE owns the emitter + its conformance vectors.
 */
import type { RouteMap } from './route-map';
import type { RouteMapEmitter } from './route-emitters';
import { isParametricPath } from './sitemap-emitter';

/** The speculation action — prefetch (fetch the response) or prerender (fully render in the background). */
export type SpeculationAction = 'prefetch' | 'prerender';

/** The speculation eagerness hint (the native vocabulary). */
export type SpeculationEagerness = 'immediate' | 'eager' | 'moderate' | 'conservative';

/** A single href-matches predicate (URL Pattern syntax). */
interface HrefMatches {
  readonly href_matches: string;
}

/** One speculation rule — a concrete URL list, or a document rule matching links by pattern. */
export interface SpeculationRule {
  readonly source: 'list' | 'document';
  readonly eagerness: SpeculationEagerness;
  /** Present on `source: 'list'` — the concrete URLs to speculate. */
  readonly urls?: readonly string[];
  /** Present on `source: 'document'` — the link predicate (a single match or an `or` of matches). */
  readonly where?: HrefMatches | { readonly or: readonly HrefMatches[] };
}

/** The Speculation Rules document — keyed by action, the shape of `<script type="speculationrules">`. */
export type SpeculationRules = Partial<Record<SpeculationAction, SpeculationRule[]>>;

/** The emitter's artifact — the rules object, its serialization, and the route split. */
export interface SpeculationRulesResult {
  /** The Speculation Rules object (becomes the `<script type="speculationrules">` body). */
  readonly rules: SpeculationRules;
  /** The pretty-printed JSON for the `<script>` element. */
  readonly json: string;
  /** Static routes emitted as concrete list URLs, in route order. */
  readonly listed: readonly string[];
  /** Parametric routes emitted as document-rule `href_matches` patterns (pattern-preserving). */
  readonly patterns: readonly string[];
  /** Error-boundary routes excluded — surfaced, never fabricated. */
  readonly skipped: readonly string[];
}

export interface SpeculationRulesEmitterOptions {
  /** prefetch (default) or prerender. */
  readonly action?: SpeculationAction;
  /** Eagerness hint (default `moderate`). */
  readonly eagerness?: SpeculationEagerness;
}

/**
 * Build the Speculation Rules emitter. Static routes become a `list` rule of concrete URLs; parametric
 * routes become a `document` rule whose `where` matches them by URLPattern (no enumeration); error-boundary
 * routes are excluded (surfaced in `skipped`).
 */
export function createSpeculationRulesEmitter(
  options: SpeculationRulesEmitterOptions = {},
): RouteMapEmitter<SpeculationRulesResult> {
  const action: SpeculationAction = options.action ?? 'prefetch';
  const eagerness: SpeculationEagerness = options.eagerness ?? 'moderate';
  return {
    id: 'speculation-rules',
    emit(map: RouteMap): SpeculationRulesResult {
      const listed: string[] = [];
      const patterns: string[] = [];
      const skipped: string[] = [];
      for (const route of map.routes) {
        if (route.isErrorBoundary) skipped.push(route.path);
        else if (isParametricPath(route.path)) patterns.push(route.path);
        else listed.push(route.path);
      }
      const ruleSet: SpeculationRule[] = [];
      if (listed.length) ruleSet.push({ source: 'list', eagerness, urls: listed });
      if (patterns.length) {
        const matches = patterns.map((p) => ({ href_matches: p }));
        ruleSet.push({
          source: 'document',
          eagerness,
          where: matches.length === 1 ? matches[0] : { or: matches },
        });
      }
      const rules: SpeculationRules = ruleSet.length ? { [action]: ruleSet } : {};
      return { rules, json: JSON.stringify(rules, null, 2), listed, patterns, skipped };
    },
  };
}
