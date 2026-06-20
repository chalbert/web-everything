/**
 * Reproduction-parity protocol — the **pure-contract surface** (#1227, carved from the #1225 charter / epic
 * #1226). The deliberately-thin contract the **Plateau** vision-judgment service *emits* and the **Web
 * Everything** project *ingests* for reproduction-conformance: did a design system reproduced as theme +
 * intents over FUI primitives match the incumbent, and — where it didn't — *what the standard could not
 * express* (the gap delta that feeds gap-sweep #315).
 *
 * Type-only (fully compile-erased, zero runtime emit) so it becomes the `@webeverything/contracts/
 * reproduction-parity` entry (#872/#874) Plateau depends on. Two rulings are encoded here, not re-decided
 * downstream:
 *  - **No-leakage client (#475).** WE never renders FUI nor runs the judge — it consumes *outputs only*. So
 *    this contract carries only the verdict + the gap list; nothing about how the oracle measures, no
 *    screenshots, no renderer handles. The judge (fuzzy-pixel + structural DOM/ARIA diff + advisory VLM) is
 *    a Plateau service (#475/#091); only its reduced readings cross the seam.
 *  - **Thin, not fat (the charter Fork-2 rider).** pass/fail per `component × state × scheme` plus a
 *    structured gap list — NOT a rich diff schema. The advisory VLM leg is *advisory*: it annotates, it
 *    never flips a verdict on its own (the quantitative pixel + structural legs gate).
 *
 * This is the one genuine new cross-repo surface the reproduction-conformance charter mints; every other
 * artifact (the per-target reproduction slices, the AI-Playwright validator chain #1167/#1219/#1220/#1221)
 * lives behind it.
 */

/** The `component × state × scheme` coordinate one verdict judges (e.g. shadcn button, hover, dark). */
export interface ReproductionTarget {
  /** The incumbent design system being reproduced, e.g. `'shadcn'` | `'material'` | `'carbon'`. */
  readonly system: string;
  /** The component under test, e.g. `'button'`. */
  readonly component: string;
  /** The visual/interaction state, e.g. `'default'` | `'hover'` | `'disabled'` | `'focus-visible'`. */
  readonly state: string;
  /** The color scheme, e.g. `'light'` | `'dark'` (open string — a system may ship more). */
  readonly scheme: string;
}

/**
 * One leg of the layered oracle, reduced to its observable outcome. `score` is the quantitative reading for
 * the pixel/structural legs (0..1, 1 = identical); omitted for the advisory VLM leg, which carries only a
 * `note`. Never the judge's internals — just pass + an optional measured score + a diagnostic note.
 */
export interface OracleLeg {
  readonly pass: boolean;
  /** Measured similarity in [0,1] for the quantitative legs (1 = identical); omitted for the advisory leg. */
  readonly score?: number;
  /** A short diagnostic (the structural diff summary, or the advisory VLM observation). */
  readonly note?: string;
}

/**
 * The layered-oracle reading backing a verdict: a fuzzy-**pixel** comparison, a **structural** DOM/ARIA
 * diff, and an optional **advisory** VLM observation. The advisory leg never gates alone (it annotates the
 * quantitative legs); a verdict's `pass` is the AND of the present *gating* legs.
 */
export interface LayeredOracleReading {
  readonly pixel: OracleLeg;
  readonly structural: OracleLeg;
  /** Advisory only — observed differences a human/VLM flags; never flips `pass` by itself. */
  readonly vlm?: OracleLeg;
}

/** The minimal unit WE ingests: a per-target pass/fail backed by the layered-oracle reading. */
export interface ReproductionVerdict {
  readonly target: ReproductionTarget;
  /** The single gate — did the reproduction match the incumbent for this target? */
  readonly pass: boolean;
  /** The reading that backs `pass` (the advisory VLM leg, if present, did not flip it). */
  readonly oracle: LayeredOracleReading;
}

/**
 * A structured gap: what theme + intents could NOT express to reach parity — the *deliverable* of the
 * reproduction exercise (the GAP LIST, not the copy, per the #1226 charter). Each gap is a gap-sweep #315
 * backlog-intake line in WE vocabulary, attributed to the expressive layer that fell short.
 */
export interface GapDelta {
  /** The target whose reproduction surfaced the gap. */
  readonly target: ReproductionTarget;
  /** Which expressive layer was insufficient: a missing token, intent, behavior, or FUI primitive. */
  readonly kind: 'token' | 'intent' | 'behavior' | 'primitive';
  /** What was missing, in WE vocabulary — an intake line, not a fix. */
  readonly description: string;
  /** Optional suggested standard surface to add (an intent name, a token path, a primitive). */
  readonly suggested?: string;
}

/**
 * The whole report Plateau emits and WE ingests for one reproduction-target system: the per-target verdicts
 * and the gap deltas, with a roll-up. The complete, minimal payload that crosses the seam — pass/fail +
 * gaps, nothing more.
 */
export interface ReproductionParityReport {
  /** The incumbent design system this report covers. */
  readonly system: string;
  /** ISO-8601 timestamp the judgment ran (the seam carries data, the producer stamps the time). */
  readonly generatedAt: string;
  readonly verdicts: readonly ReproductionVerdict[];
  readonly gaps: readonly GapDelta[];
  /** Roll-up over `verdicts`/`gaps` — `passed`/`failed` verdict counts and the total gap count. */
  readonly summary: {
    readonly passed: number;
    readonly failed: number;
    readonly gaps: number;
  };
}
