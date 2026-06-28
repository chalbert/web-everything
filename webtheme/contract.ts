/**
 * Web Theme — the **pure-contract half** (the #404 token model schema + the #405 scheme/accent result
 * types + the #1252/#1274 palette-source ingest contract). Slice T1 of the #1294 relocation cascade
 * ([[project_contract_ts_is_separate_slice]]).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it is the
 * `@webeverything/contracts/webtheme` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `webcompliance/contract.ts` (#1808) and `webpolicy/contract.ts`
 * (#1077). The runtime half — the token operations (`flattenTokens`/`resolveTokens`/`extendTokens`), the
 * DTCG→CSS compile (`compileToCss`), the scheme/accent derivation (`deriveSchemeRuntime`/`compileSchemeCss`),
 * and the palette-source ingest registry — is impl and relocates to FUI (`fui:webtheme/`, #1294 T2, per
 * #1282 — WE holds zero executable). The runtime modules `import type` from here and re-export this surface
 * so importers reach types + runtime from one site (mirroring `webcompliance/gate.ts`).
 *
 * Web Theme fixes the **token meta-schema**: how a design system's concrete-value layer is authored +
 * interchanged (DTCG 2025.10 `{ $type, $value }` nodes with `{group.token}` aliasing — the one adopted-not-
 * coined Protocol, #403) across the 3-tier taxonomy (primitive · semantic-is-the-intents · component), and
 * the shape of the resolved/compiled token, the derived scheme+accent runtime (native-CSS-first with an
 * accessibility gate), and the palette-source ingest pivot. It standardizes the schema, not the token list
 * (a project `extends` a platform-default baseline and authors only its deltas).
 */

// ── #404 token model (DTCG schema) ───────────────────────────────────────────────

/** The DTCG `$type`s Web Theme's primitive + component tiers use. A group's `$type` is inherited by its tokens. */
export type DtcgType = 'color' | 'dimension' | 'number' | 'duration' | 'fontFamily' | 'fontWeight' | 'shadow';

/** A DTCG token leaf: a concrete `$value` (or a `{group.token}` alias string) and an optional own `$type`. */
export interface DtcgToken {
  $value: string | number;
  $type?: DtcgType;
  $description?: string;
}

/** A DTCG group: an optional `$type` (inherited by descendants) plus child groups/tokens, keyed by name. */
export interface DtcgGroup {
  $type?: DtcgType;
  $description?: string;
  [name: string]: DtcgGroup | DtcgToken | DtcgType | string | undefined;
}

/** A whole DTCG token document — the root group. */
export type DtcgDocument = DtcgGroup;

/** A token flattened out of the tree: its dot-path segments, resolved `$type`, raw value, description. */
export interface FlatToken {
  readonly path: readonly string[];
  readonly type: DtcgType | undefined;
  readonly value: string | number;
  readonly description?: string;
}

/** A flat token plus its resolved-to-literal value and the path it aliases (if any). */
export interface ResolvedToken extends FlatToken {
  /** The final non-alias literal this token resolves to (alias chains followed to the end). */
  readonly resolved: string | number;
  /** When this token is an alias, the dot-path it points at (for `var(--ref)` compilation); else null. */
  readonly aliasOf: string | null;
}

// ── #404 DTCG → CSS compile (result shape) ───────────────────────────────────────

export interface CompileOptions {
  /** The selector the custom properties are emitted under. Defaults to `:root`. */
  readonly selector?: string;
  /** Emit `@property` registrations for typed numerics (default true). */
  readonly registerProperties?: boolean;
}

export interface CompileResult {
  readonly css: string;
  /** Tokens whose `$type` has no CSS `@property` syntax (e.g. fontFamily/shadow) — registered as a plain var only. */
  readonly diagnostics: readonly string[];
}

// ── #405 scheme + accent runtime (derivation result shape) ───────────────────────

/** An sRGB color, each channel gamma-encoded in [0, 1]. Alpha dropped (contrast is opaque). */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** A derived tonal step: the native CSS the runtime uses, plus its literal (for the contrast gate only). */
export interface AccentStep {
  /** Step id, e.g. `'accent-9'`. */
  readonly id: string;
  /** Target oklch lightness for this step (0–1) — the tonal ramp position. */
  readonly lightness: number;
  /** The native relative-color CSS expression the runtime emits (tracks the seed at runtime). */
  readonly css: string;
  /** The literal sRGB this resolves to, computed here ONLY to validate contrast. */
  readonly value: Rgb;
  /**
   * When the theme is **scheme-paired** (#1314 — a `color.accent-dark` anchor present), the dark-scheme
   * literal this step resolves to (derived from the dark seed), validated against the dark background.
   * Absent on single-seed themes, where `value` serves both schemes.
   */
  readonly valueDark?: Rgb;
}

export interface SchemeRoles {
  /** `light-dark(...)` background — switches with `color-scheme`. */
  readonly bg: string;
  /** `light-dark(...)` foreground/text. */
  readonly fg: string;
}

/** Accessibility thresholds a derived step must clear. Defaults: WCAG AA body + APCA Lc 60. */
export interface ContrastPolicy {
  /** Minimum WCAG ratio (default 4.5 — AA normal text). */
  readonly wcagMin?: number;
  /** Minimum |APCA Lc| (default 60 — readable body text on the APCA scale). */
  readonly apcaMin?: number;
}

/** One step's contrast verdict against the scheme background it is meant to read on. */
export interface StepValidation {
  readonly step: string;
  readonly against: 'bg-light' | 'bg-dark';
  readonly wcag: number;
  readonly apca: number;
  readonly passes: boolean;
  readonly reason: 'ok' | 'wcag-below-min' | 'apca-below-min';
}

export interface SchemeRuntime {
  readonly scheme: SchemeRoles;
  /** High-contrast scheme — pure white/black extremes for the `prefers-contrast: more` path. */
  readonly highContrast: SchemeRoles;
  readonly accent: AccentStep[];
  readonly validation: StepValidation[];
  /** True iff every accent step cleared the policy on at least one scheme background. */
  readonly accessible: boolean;
  /**
   * True when a `color.accent-dark` anchor is present (#1314): the accent scale flips per scheme via
   * `light-dark(...)` so a system's dark-mode primary surface is expressible from one theme. False for a
   * single scheme-invariant `color.accent` seed (the scale then tracks that one seed across both schemes).
   */
  readonly schemePaired: boolean;
}

export interface DeriveOptions {
  /** Per-step oklch lightness ramp (default the platform tonal ramp). */
  readonly ramp?: Record<string, number>;
  /** Contrast thresholds (default WCAG AA + APCA 60). */
  readonly policy?: ContrastPolicy;
  /**
   * Curated override (brand precision): explicit literal values for named steps that bypass derivation.
   * Still validated against the policy — brand cannot silently ship an inaccessible step.
   */
  readonly curated?: Record<string, string>;
}

// ── #1252/#1274 palette-source ingest (parser contract) ──────────────────────────

/**
 * A palette-source parser: normalizes one external palette `raw` shape into a DTCG color {@link DtcgGroup}
 * (a `$type: color` group of `{ $value }` leaves) in webtheme's pivot. Pure; throws on a malformed shape
 * (lossy-but-loud, never a silent bad token).
 */
export type PaletteSourceParser = (raw: unknown) => DtcgGroup;
