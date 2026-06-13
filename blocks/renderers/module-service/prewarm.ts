/**
 * @file blocks/renderers/module-service/prewarm.ts
 * @description MaaS eager hot-set pre-warming + lazy-default distribution policy — backlog #462,
 * phase (c) of the #087 distribution ruling, built on the #461 origin.
 *
 * Distribution mode is a **per-artifact policy**, default **lazy-with-cache-fill**: an artifact's
 * `(form × target × strategy × version)` matrix is combinatorial and mostly wasted, so nothing is
 * pre-built — each tuple resolves on its first request and is cached from then on (the
 * {@link ServedArtifactCache} the origin already uses). An author/consumer **opts into eager
 * pre-warming for a declared hot set** — the handful of tuples they actually ship (e.g.
 * `wc-class@es2020` for prod, `declarative` for docs) — which is resolved + cache-filled up front so
 * the first real request is already warm.
 *
 * The one hard rule: **coverage is never silently partial.** Pre-warming a hot set leaves the rest of
 * the matrix lazy; this module always reports the **lazy remainder** (count + identities) so a thin
 * hot-set declaration can't quietly mean "most forms 404 on a cold request and nobody noticed."
 *
 * Framework-agnostic: operates on an injected {@link ServedArtifactCache} and an injected `log` sink —
 * no Node/Vite imports, same portability contract as the origin handler (#461).
 */
import { FORMS, type ServeForm, type ServeOptions } from './moduleService';
import type { ServedArtifactCache } from './definitionRegistry';

/** One point in the distribution matrix — a servable shape of an artifact. */
export interface DistributionTuple {
  form: ServeForm;
  target?: string;
  strategy?: string;
}

/**
 * The candidate distribution space for the lazy-remainder accounting. Defaults to every form at the
 * baseline `esnext` target and `declarative-static` strategy — widen `targets`/`strategies` to the set
 * a project actually compiles for, so the remainder log reflects the real matrix, not a toy one.
 */
export interface MatrixSpace {
  forms?: ServeForm[];
  targets?: string[];
  strategies?: string[];
}

export interface PrewarmPolicy {
  /** Artifact ids (element names) this policy covers. */
  ids: string[];
  /** The tuples to eagerly pre-resolve. Applied to every id in {@link ids}. Everything else stays lazy. */
  hotSet: DistributionTuple[];
  /** The full candidate matrix, for the lazy-remainder accounting (see {@link MatrixSpace}). */
  matrix?: MatrixSpace;
}

export interface PrewarmReport {
  /** Tuple-identities actually resolved + cached up front. */
  warmed: string[];
  /** The slice of the matrix left lazy — NEVER silently dropped (#462). */
  lazyRemainder: { count: number; identities: string[] };
  /** Hot-set tuples that referenced an unknown id (resolver returned null) — surfaced, not swallowed. */
  unresolved: string[];
}

const DEFAULT_TARGET = 'esnext';
const DEFAULT_STRATEGY = 'declarative-static';

/** A stable, human-readable identity for a `(id, form, target, strategy)` point — the log key. */
export function tupleIdentity(id: string, t: DistributionTuple): string {
  return `${id}|${t.form}|${t.target ?? DEFAULT_TARGET}|${t.strategy ?? DEFAULT_STRATEGY}`;
}

const toServeOptions = (t: DistributionTuple): ServeOptions => ({
  form: t.form,
  transpileTarget: t.target,
  strategy: t.strategy,
});

/** Expand the full candidate matrix (ids × forms × targets × strategies) as tuple identities. */
function matrixIdentities(ids: string[], space: MatrixSpace | undefined): Set<string> {
  const forms = space?.forms ?? FORMS.map((f) => f.id);
  const targets = space?.targets ?? [DEFAULT_TARGET];
  const strategies = space?.strategies ?? [DEFAULT_STRATEGY];
  const out = new Set<string>();
  for (const id of ids)
    for (const form of forms)
      for (const target of targets)
        for (const strategy of strategies) out.add(tupleIdentity(id, { form, target, strategy }));
  return out;
}

/**
 * Apply a {@link PrewarmPolicy} against a {@link ServedArtifactCache}: eagerly resolve + cache-fill the
 * declared hot set, then account for the lazy remainder. Returns a {@link PrewarmReport} and (when a
 * `log` sink is given) emits a one-line warmed/lazy summary plus the lazy identities — so partial
 * coverage is always visible.
 *
 * Eager warming goes through the SAME `cache.serve` path a real request uses, so a warmed tuple is a
 * genuine cache hit later (not a parallel pre-render). A hot-set tuple for an unknown id is reported in
 * `unresolved` rather than throwing — one bad declaration never aborts the whole warm.
 */
export function prewarmHotSet(
  cache: ServedArtifactCache,
  policy: PrewarmPolicy,
  log?: (message: string) => void,
): PrewarmReport {
  const warmed: string[] = [];
  const unresolved: string[] = [];

  for (const id of policy.ids) {
    for (const tuple of policy.hotSet) {
      const identity = tupleIdentity(id, tuple);
      const result = cache.serve(id, toServeOptions(tuple));
      if (result === null) unresolved.push(identity);
      else warmed.push(identity);
    }
  }

  // The lazy remainder = the full candidate matrix minus what we warmed. Never silently partial.
  const warmedSet = new Set(warmed);
  const lazyIdentities = [...matrixIdentities(policy.ids, policy.matrix)].filter((m) => !warmedSet.has(m));

  const report: PrewarmReport = {
    warmed,
    lazyRemainder: { count: lazyIdentities.length, identities: lazyIdentities },
    unresolved,
  };

  if (log) {
    log(`[MaaS prewarm] eager-warmed ${warmed.length} tuple(s); ${report.lazyRemainder.count} left lazy.`);
    if (lazyIdentities.length) log(`[MaaS prewarm] lazy remainder: ${lazyIdentities.join(', ')}`);
    if (unresolved.length) log(`[MaaS prewarm] unresolved hot-set tuple(s) (unknown id): ${unresolved.join(', ')}`);
  }

  return report;
}
