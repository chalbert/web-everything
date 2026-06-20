/**
 * Self-Driven Project Artefact protocol — the **meta-schema registries** (#1026, slice #1071).
 *
 * The two NEW + OWNED meta-schemas (autonomy ladder, value/risk-ODD dimension dial) are OPEN registries:
 * the contract ships a **default flavor** (`DefaultAutonomyLevel`, `DefaultToleranceDimension`) and a
 * project recipe may register more. This is the runtime that holds those open vocabularies — the swap
 * point a recipe extends, mirroring the standalone-model registries of the sibling planes
 * (`CustomRecoveryHandlerRegistry`, `CustomIntlProviderRegistry`) and the core `CustomRegistry` surface
 * (`localName` + ordered `define`/`has`/`keys`/`values`).
 *
 * Two rulings from `project-webprocess.njk` are pinned here, not redecided:
 *  - **Standardize the shape, not a fixed process (the Web Intents lesson):** the vocabulary stays OPEN.
 *    The default ladder is the shipped flavor, never a closed list; `define()` widens it conflict-free.
 *  - **Config-extends-platform-default:** the node ships **one fully-defined default recipe**
 *    (`webprocess/default`), so a project recipe is a flavor *on top* (`extends`), never authored from
 *    nothing. The registries seed the default flavor on construction.
 *
 * Pure, dependency-free model of the contract: the runtime fulfils the same surface a foreign PM/CI tool
 * would, so the autonomy/tolerance vocabulary has one home and cannot drift from the contract.
 */
import type { AutonomyLevel, ToleranceDimension } from './contract.js';

/** The shipped default autonomy ladder, in ascending-permission order (the `webprocess/default` flavor). */
export const DEFAULT_AUTONOMY_LADDER: readonly AutonomyLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];

/** The shipped default tolerance dimensions (the `webprocess/default` flavor). */
export const DEFAULT_TOLERANCE_DIMENSIONS: readonly ToleranceDimension[] = [
  'correctness',
  'security',
  'blast-radius',
  'reversibility',
];

/** A run referenced a meta-schema member that was never registered (an unknown level / dimension). */
export class UnknownMetaSchemaMemberError extends Error {
  constructor(kind: 'autonomy level' | 'tolerance dimension', value: string, known: readonly string[]) {
    super(`Unknown ${kind} "${value}" — registered: ${known.join(', ') || 'none'}`);
    this.name = 'UnknownMetaSchemaMemberError';
  }
}

/**
 * The OPEN autonomy-level registry. Members are held in **registration order**, which *is* the ascending
 * permission order the tolerance dial throttles against (index 0 = least permission). Seeded with the
 * default `L0–L5` ladder; a recipe `define()`s additional levels (appended as higher permission, or
 * `insertAfter` to splice mid-ladder). Re-registering an existing level is a no-op (preserves its slot).
 */
export class AutonomyLevelRegistry {
  readonly localName = 'autonomyLevels';
  readonly #levels: AutonomyLevel[] = [...DEFAULT_AUTONOMY_LADDER];

  /** Append a level as the highest permission (end of the ladder). No-op if already registered. */
  define(level: AutonomyLevel): void {
    if (!this.#levels.includes(level)) this.#levels.push(level);
  }

  /** Splice `level` into the ladder immediately after `after` — for a recipe-defined mid-ladder rung. */
  insertAfter(after: AutonomyLevel, level: AutonomyLevel): void {
    const at = this.#levels.indexOf(after);
    if (at < 0) throw new UnknownMetaSchemaMemberError('autonomy level', after, this.#levels);
    if (!this.#levels.includes(level)) this.#levels.splice(at + 1, 0, level);
  }

  has(level: AutonomyLevel): boolean {
    return this.#levels.includes(level);
  }

  /** The ladder in ascending-permission order. */
  values(): AutonomyLevel[] {
    return [...this.#levels];
  }

  /** The 0-based rung index (ascending permission) of `level`, or throw if unregistered. */
  rank(level: AutonomyLevel): number {
    const at = this.#levels.indexOf(level);
    if (at < 0) throw new UnknownMetaSchemaMemberError('autonomy level', level, this.#levels);
    return at;
  }

  /** The lower-permission of two levels (the throttle picks the more conservative ceiling). */
  min(a: AutonomyLevel, b: AutonomyLevel): AutonomyLevel {
    return this.rank(a) <= this.rank(b) ? a : b;
  }
}

/**
 * The OPEN tolerance-dimension registry — the value/risk-ODD dial's vocabulary. Seeded with the default
 * dimension set; a recipe `define()`s its own. Order is registration order; unlike the autonomy ladder
 * the dimensions are an unordered set (a `ToleranceProfile` is keyed by dimension), so there is no rank.
 */
export class ToleranceDimensionRegistry {
  readonly localName = 'toleranceDimensions';
  readonly #dimensions: ToleranceDimension[] = [...DEFAULT_TOLERANCE_DIMENSIONS];

  /** Register a dimension. No-op if already registered. */
  define(dimension: ToleranceDimension): void {
    if (!this.#dimensions.includes(dimension)) this.#dimensions.push(dimension);
  }

  has(dimension: ToleranceDimension): boolean {
    return this.#dimensions.includes(dimension);
  }

  /** The registered dimensions in registration order. */
  values(): ToleranceDimension[] {
    return [...this.#dimensions];
  }
}
