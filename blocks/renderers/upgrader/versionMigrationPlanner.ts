/**
 * @file blocks/renderers/upgrader/versionMigrationPlanner.ts
 * @description Version-migration **planner** — slice (a) of the ratified #191 version-migration upgrader,
 *   built on #094's {@link ./upgraderEngine}. It is the *across-versions* counterpart of the engine's
 *   *legacy→standard* upgrade: given a consumer's `installed` spec version and a `target`, it consumes
 *   the **changelog-manifest protocol** (#102) as the migration descriptor and produces an **ordered,
 *   intermediate-spanning migration plan** — the Angular `ng update` run loop, mapped onto #266's
 *   {@link compareSpecVersions}. The plan is data; the transform interpreter (slice b) executes it and
 *   the input-adapter/mode (slice c) feeds it through the engine's `verifyUpgrade` gate.
 *
 * **Consumes, does not redefine.** The migration descriptor is the resolved `changelog-manifest`
 * protocol verbatim (a per-module `entries[]` keyed to a semver `severity` + Keep-a-Changelog `type`,
 * with a `migration` linkage on breaking entries). The shapes below mirror that protocol so the planner
 * is self-contained and dependency-free; they are not a new schema.
 *
 * **Version-gated, intermediate-spanning.** The planner never jumps `installed → target` directly when
 * intervening manifests exist: at each step it takes the manifest whose `previous` matches the current
 * version and whose `release` is the *smallest* in `(current, target]`, so every intermediate breaking
 * change is applied in order (a major upgrade that skips a deprecation window is the bug this prevents).
 * If the manifest chain has a gap before reaching `target`, the plan reports `reachedTarget: false` with
 * the partial steps — it never silently claims to have planned a path it cannot.
 */

import { compareSpecVersions } from '../../../capability-manifest/provider.js';

// ── The changelog-manifest descriptor (#102), mirrored so the planner is self-contained ──────────

export type Severity = 'major' | 'minor' | 'patch';
export type ChangeType = 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';

// ── Declarative change-kind vocabulary (the #191 Fork-2 held-open sub-decision, resolved) ─────────
//
// #191 ratified Fork 2 = **declarative-first with an imperative escape hatch** (the OpenRewrite
// principle). What it left open is *which* change-kinds the engine interprets natively. The enumeration
// below is fixed by one rule: a kind earns a slot only if it maps to a **mechanically distinct** markup
// rewrite (not just distinct author intent — that lives in the changelog `summary`). Four qualify
// against the real WE breaking-change history; anything else drops to the imperative escape hatch
// (`ImperativeMigration`) rather than growing a fuzzy vocabulary:
//   • rename-attr     — an attribute's NAME changed, value preserved (the most common break).
//   • move-dimension  — a value relocates to another attribute, optionally REMAPPED through a value map
//                       (a configurator dimension whose value-space also changed) — the value remap is
//                       what makes it mechanically more than a rename.
//   • retire-provider — an attribute names a registry provider id that was retired; rewrite to its
//                       replacement, or FLAG when none exists (never silently drop).
//   • re-namespace    — a custom-element tag *prefix* was re-namespaced (a layer/scope move surfacing
//                       in markup as `<old-*>` → `<new-*>`).
export type DeclarativeChangeKind = 'rename-attr' | 'move-dimension' | 'retire-provider' | 're-namespace';

/** Rename an attribute's name on matching elements; the value is carried over verbatim. */
export interface RenameAttrTransform {
  readonly kind: 'rename-attr';
  /** Tag to scope to (e.g. `we-select`); omit or `*` for any element bearing the attribute. */
  readonly element?: string;
  readonly from: string;
  readonly to: string;
}

/** Move a value to another attribute, optionally remapping it through `valueMap` (dimension move). */
export interface MoveDimensionTransform {
  readonly kind: 'move-dimension';
  readonly element?: string;
  readonly from: string;
  readonly to: string;
  /** Old-value → new-value when the dimension's value-space also changed; absent ⇒ move verbatim. */
  readonly valueMap?: Readonly<Record<string, string>>;
}

/** A retired registry-provider id referenced by an attribute: rewrite to `replacement`, else flag. */
export interface RetireProviderTransform {
  readonly kind: 'retire-provider';
  readonly element?: string;
  readonly attribute: string;
  readonly retired: string;
  /** The replacement provider id; omit when there is none (the interpreter flags for manual fix). */
  readonly replacement?: string;
}

/** Re-namespace a custom-element tag prefix, e.g. `from: 'we-'`, `to: 'fui-'` (nested-safe). */
export interface ReNamespaceTransform {
  readonly kind: 're-namespace';
  readonly from: string;
  readonly to: string;
}

export type DeclarativeTransform =
  | RenameAttrTransform
  | MoveDimensionTransform
  | RetireProviderTransform
  | ReNamespaceTransform;

/** Declarative-first path: the engine interprets `transform` natively — no codemod to write or trust. */
export interface DeclarativeMigration {
  readonly mode: 'declarative';
  readonly transform: DeclarativeTransform;
}

/** Imperative escape hatch: a codemod reference + #102 author/integrity-hash trust metadata. */
export interface ImperativeMigration {
  readonly mode: 'imperative';
  readonly ref: string;
  readonly author: string;
  readonly integrity: string;
  readonly rewrites: string;
}

/**
 * The migration linkage on a breaking, mechanically-applicable entry — declarative-first
 * ({@link DeclarativeMigration}) with an imperative codemod escape hatch ({@link ImperativeMigration}).
 * Discriminated by `mode`. Slice (b)'s `transformInterpreter` executes either.
 */
export type MigrationRef = DeclarativeMigration | ImperativeMigration;

/** One per-module changelog entry. `migration` is present iff the change is breaking + mechanical. */
export interface ChangelogEntry {
  readonly module: string;
  readonly severity: Severity;
  readonly type: ChangeType;
  readonly summary: string;
  readonly migration?: MigrationRef;
}

/** A changelog manifest migrating one package from `previous` to `release`. */
export interface ChangelogManifest {
  readonly manifestVersion: string;
  readonly package: string;
  readonly release: string;
  readonly previous: string;
  readonly entries: readonly ChangelogEntry[];
}

// ── The ordered migration plan the interpreter (slice b) executes ────────────────────────────────

/** One migration to apply — a breaking entry plus the version hop it belongs to. */
export interface MigrationStep {
  readonly package: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly module: string;
  readonly summary: string;
  readonly migration: MigrationRef;
}

export interface MigrationPlan {
  readonly package: string;
  readonly installed: string;
  readonly target: string;
  /** The ordered migrations, installed→target — only breaking entries that carry a `migration` ref. */
  readonly steps: MigrationStep[];
  /** The chain of `release` versions the plan spans, in order. */
  readonly spannedVersions: string[];
  /** True when the manifest chain reaches `target`; false when a gap stops it short (steps are partial). */
  readonly reachedTarget: boolean;
}

/** Thrown for an incoherent request — a downgrade, or manifests spanning more than one package. */
export class MigrationPlanError extends Error {
  constructor(message: string) {
    super(`Version-migration planner: ${message}`);
    this.name = 'MigrationPlanError';
  }
}

/**
 * Plan the ordered, intermediate-spanning migration from `installed` to `target`, selecting from
 * `manifests` the contiguous changelog chain (`previous → release`) within `(installed, target]`.
 *
 * Returns an empty plan (no steps, `reachedTarget: true`) when `installed === target`. Throws
 * {@link MigrationPlanError} on a downgrade or a mixed-package manifest set. When the chain cannot reach
 * `target` (a missing manifest), the plan carries the steps it *could* span and `reachedTarget: false`.
 *
 * @param pkg Restrict to this package; required only when `manifests` mix packages (else inferred).
 */
export function planVersionMigration(
  installed: string,
  target: string,
  manifests: readonly ChangelogManifest[],
  pkg?: string,
): MigrationPlan {
  const cmp = compareSpecVersions(installed, target);
  if (cmp > 0) throw new MigrationPlanError(`cannot downgrade (${installed} > ${target})`);

  const packages = new Set(manifests.map((m) => m.package));
  const targetPackage = pkg ?? (packages.size === 1 ? [...packages][0] : undefined);
  if (targetPackage === undefined) {
    throw new MigrationPlanError(`manifests span multiple packages (${[...packages].join(', ')}); pass a package to disambiguate`);
  }
  const pool = manifests.filter((m) => m.package === targetPackage);

  const steps: MigrationStep[] = [];
  const spannedVersions: string[] = [];

  // Walk the chain: from `current`, take the manifest whose previous === current with the smallest
  // release in (current, target], so intermediate versions are never skipped.
  let current = installed;
  while (compareSpecVersions(current, target) < 0) {
    const candidates = pool
      .filter((m) => m.previous === current && compareSpecVersions(m.release, current) > 0 && compareSpecVersions(m.release, target) <= 0)
      .sort((a, b) => compareSpecVersions(a.release, b.release));
    const next = candidates[0];
    if (!next) break; // gap — cannot reach target from here
    spannedVersions.push(next.release);
    for (const entry of next.entries) {
      if (entry.migration) {
        steps.push({
          package: targetPackage,
          fromVersion: next.previous,
          toVersion: next.release,
          module: entry.module,
          summary: entry.summary,
          migration: entry.migration,
        });
      }
    }
    current = next.release;
  }

  return {
    package: targetPackage,
    installed,
    target,
    steps,
    spannedVersions,
    reachedTarget: compareSpecVersions(current, target) === 0,
  };
}
