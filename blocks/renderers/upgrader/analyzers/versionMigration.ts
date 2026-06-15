/**
 * @file blocks/renderers/upgrader/analyzers/versionMigration.ts
 * @description Version-migration input adapter — slice (c) of the ratified #191 upgrader (Fork 1A).
 *   The SECOND provider on `upgraderEngine`'s devtools analyzer seam, beside #094's legacy→standard
 *   reference analyzer. Its input is not legacy code but an **already-conformant `<component>`** plus a
 *   **changelog-manifest delta**; it drives slice (a) {@link planVersionMigration} → slice (b)
 *   {@link applyMigrationPlan} → the existing `verifyUpgrade` gate, so a migrated component is *offered*
 *   only when it re-parses, round-trips, and conforms. One engine, two input adapters, no second tool.
 *
 * **Where transforms apply.** The migration rewrites the component's **template markup** (its child
 * usage) — that is where the declarative vocabulary (rename-attr / move-dimension / retire-provider /
 * re-namespace) and codemods land. The `<component>` wrapper's own `name`/`shadow` are carried through
 * unchanged, so the upgraded entity is provably the same component, one version newer.
 *
 * **Flag, don't fake (the pipeline's rule).** A migration that cannot be applied *cleanly* — the plan
 * can't reach the target, an imperative codemod is untrusted/missing, or a `retire-provider` has no
 * replacement — throws, which the orchestrator surfaces as a diagnostic with `offered: false`. It never
 * presents a half-migrated component as verified. A benign no-match (a transform whose attribute this
 * component simply doesn't use) is not a failure; a soft warning (a value moved verbatim) surfaces as a
 * note but still offers.
 */
import type { CustomAnalyzer, ComponentIR, SourceInput, CustomAnalyzerRegistry } from '../upgraderEngine';
import { parseDefinition } from '../../component/declarativeComponent';
import { planVersionMigration, type ChangelogManifest } from '../versionMigrationPlanner';
import { applyMigrationPlan, type CustomCodemodRegistry, type InterpretResult } from '../transformInterpreter';

/** The changelog delta + trust providers this adapter is configured with (devtools provider config). */
export interface VersionMigrationConfig {
  /** Consumer's installed spec version. */
  readonly installed: string;
  /** Version to migrate to. */
  readonly target: string;
  /** The changelog manifests describing the breaking changes between versions (#102). */
  readonly manifests: readonly ChangelogManifest[];
  /** Disambiguating package when `manifests` span more than one. */
  readonly pkg?: string;
  /** Trusted codemods for any imperative escape-hatch steps; omit for a purely declarative chain. */
  readonly codemods?: CustomCodemodRegistry;
}

/** A step that blocks a clean migration (vs a benign no-match): deferred, or a flagged declarative gap. */
const isBlocking = (r: InterpretResult): boolean => r.mode === 'deferred' || (!r.applied && r.diagnostics.length > 0);

/**
 * Build the version-migration analyzer bound to a changelog delta. `handles()` claims input tagged
 * `language: 'version-migration'`; `analyze()` parses the conformant `<component>`, migrates its
 * template across versions, and returns the neutral IR the engine re-generates + verifies.
 */
export function makeVersionMigrationAnalyzer(config: VersionMigrationConfig): CustomAnalyzer {
  return {
    id: 'version-migration',
    handles: (input: SourceInput) => input.language === 'version-migration',
    analyze(input: SourceInput): ComponentIR {
      // The source is itself a conformant <component>; parse it to lift name/shadow/template.
      const def = parseDefinition(input.code ?? '');

      const plan = planVersionMigration(config.installed, config.target, config.manifests, config.pkg);
      const run = applyMigrationPlan(def.templateHTML, plan, { codemods: config.codemods });

      const blocking = run.results.filter(isBlocking);
      if (!plan.reachedTarget) {
        throw new Error(
          `cannot fully migrate ${def.name} ${config.installed}→${config.target}: the manifest chain stops at ` +
            `${plan.spannedVersions.at(-1) ?? config.installed} (no manifest bridges the rest).`,
        );
      }
      if (blocking.length) {
        throw new Error(
          `migration of ${def.name} could not be applied cleanly: ${blocking.flatMap((r) => r.diagnostics).join('; ')}`,
        );
      }

      const span = plan.spannedVersions.length ? `${config.installed}→${plan.spannedVersions.join('→')}` : '(no-op)';
      const notes = [
        `migrated <${def.name}> ${span} — ${run.applied} transform(s) applied across ${plan.steps.length} step(s).`,
        // Soft warnings (a value moved verbatim) still offer, but surface so they're never silent.
        ...run.results.filter((r) => r.applied).flatMap((r) => r.diagnostics),
      ];

      return { name: def.name, shadow: def.shadow, template: run.output.trim(), notes };
    },
  };
}

/**
 * Register the version-migration adapter into a caller-owned registry — the second input adapter on the
 * engine's devtools seam. The core imports no analyzer; callers (a CLI, the demo, the suite) call this
 * with their changelog delta, exactly as #094 callers call `registerReferenceAnalyzers`.
 */
export function registerVersionMigrationAnalyzer(registry: CustomAnalyzerRegistry, config: VersionMigrationConfig): void {
  registry.register(makeVersionMigrationAnalyzer(config));
}
