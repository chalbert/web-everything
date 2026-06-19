/**
 * Default wiring for the Self-Driven Project Artefact seam (#1026/#1071). Builds the OPEN meta-schema
 * registries seeded with the shipped default flavor (the `L0–L5` autonomy ladder, the
 * correctness/security/blast-radius/reversibility tolerance dimensions) and the **one fully-defined default
 * recipe** (`webprocess/default`) every project recipe `extends` (config-extends-platform-default). A
 * consumer gets a working, swappable seam — the registries + the recipe + the driving loop — with one call,
 * and `define()`s its own levels/dimensions and authors a recipe flavor on top.
 *
 * Per the ratified design (`project-webprocess.njk`): WE's own backlog is *one dogfooded recipe*, a
 * consumer of the standard, never the spec. The node ships the default; the Plateau configurator and any
 * concrete recipe are impl on top.
 */
import type { ProcessRecipe } from './contract.js';
import { AutonomyLevelRegistry, ToleranceDimensionRegistry } from './registry.js';

export * from './provider.js';
export * from './registry.js';
export * from './driver.js';

/** The canonical id of the shipped default recipe — the root every recipe flavor extends. */
export const DEFAULT_RECIPE_ID = 'webprocess/default';

/**
 * The shipped default recipe — fully-defined so a project recipe is a flavor *on top*, never authored from
 * nothing. It extends itself by convention only as the root marker (a flavor names it in `extends`); it
 * carries no overrides and no tolerance dial (steps run at their nominal ceiling until a recipe dials it
 * down). The default is the most-permissive base (most-flexible-default): the restriction is the project
 * recipe's opt-in via its tolerance dial.
 */
export const DEFAULT_RECIPE: ProcessRecipe = { extends: DEFAULT_RECIPE_ID };

/** The default meta-schema registries + the default recipe — a ready-to-drive seam in one call. */
export interface DefaultProcessSeam {
  autonomyLevels: AutonomyLevelRegistry;
  toleranceDimensions: ToleranceDimensionRegistry;
  recipe: ProcessRecipe;
}

/**
 * A fresh default process seam: the autonomy ladder + tolerance dimensions seeded with the default flavor,
 * and the `webprocess/default` recipe. A consumer `define()`s extra levels/dimensions and authors a recipe
 * flavor that `extends` `DEFAULT_RECIPE_ID`.
 */
export function createDefaultSeam(): DefaultProcessSeam {
  return {
    autonomyLevels: new AutonomyLevelRegistry(),
    toleranceDimensions: new ToleranceDimensionRegistry(),
    recipe: { ...DEFAULT_RECIPE },
  };
}
