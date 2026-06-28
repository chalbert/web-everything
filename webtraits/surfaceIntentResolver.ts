/**
 * @file webtraits/surfaceIntentResolver.ts
 * @description Surface-intent → CSS build-time resolver (#1911, the realize-a-declared-axis path #1884 ruled).
 *   `surface` is a ratified intent that OWNS the presentation axis (`we:src/_data/intents/surface.json`):
 *   `texture` (solid/glass/transparent), `interaction` (static/lift/scale), and — newly realized here —
 *   `elevation` (0–5) + `variant` (default/alt), all four of which its protocol already declares. This
 *   resolver maps a chosen surface profile to the CSS declarations that realize it, so a consumer never
 *   writes a raw-CSS surface blob (the anti-pattern #1884 forbids: *realize a declared axis; never stand up
 *   a second home* — `we:docs/agent/platform-decisions.md:1128`). The hovercard preset is its first
 *   consumer: its `.hovercard-card` surface properties are composed from `resolveSurface(...)` rather than
 *   hand-written CSS (`we:src/_data/assemblerPresets/hovercard.json`).
 *
 * WE-resident standard logic (a pure, dependency-free resolver over a WE registry — the same shape as
 * `webtraits/intentProfileResolver.ts` and `webcases/requirementValidator.ts`): it consumes the dimension
 * VALUES a surface profile selects and returns the resolved CSS. The FUI recipe engine and the Plateau
 * assembler are *consumers* of this resolver, not its home — standard logic → WE (memory rule #6: WE holds
 * definitions + validate scripts, no standard *implementation*; a pure value→CSS map is definition, not impl).
 *
 * Output prefers theme-token CSS custom properties (`var(--surface-*, <fallback>)`) so a design system can
 * re-theme the surface without touching the resolver — the fallback is the native-first default (#75).
 */

/** Material texture of the surface. */
export type SurfaceTexture = 'solid' | 'glass' | 'transparent';
/** Visual response to user interaction. */
export type SurfaceInteraction = 'static' | 'lift' | 'scale';
/** Z-axis depth relative to the parent (0 base → 5 floating). */
export type SurfaceElevation = 0 | 1 | 2 | 3 | 4 | 5;
/** Visual variation — default vs high-contrast alt. */
export type SurfaceVariant = 'default' | 'alt';

/**
 * A chosen surface profile — the dimension VALUES a consumer selects from the `surface` intent. Every field
 * is optional; an omitted dimension falls back to the native-first default (`texture:solid`, `interaction:
 * static`, `elevation:0`, `variant:default`).
 */
export interface SurfaceProfile {
  texture?: SurfaceTexture;
  interaction?: SurfaceInteraction;
  elevation?: SurfaceElevation;
  variant?: SurfaceVariant;
}

/** A single resolved CSS declaration. */
export interface CssDeclaration {
  property: string;
  value: string;
}

/**
 * The resolved surface, as both structured declarations (for a recipe engine to merge/dedupe) and an
 * `:hover` block when the interaction dimension needs one (lift/scale animate on hover).
 */
export interface ResolvedSurface {
  /** Base declarations applied to the surface element. */
  base: CssDeclaration[];
  /** Declarations applied on `:hover`/`:focus-visible` (empty for `interaction:static`). */
  hover: CssDeclaration[];
  /** Whether the surface declares a transition (true when interaction is lift/scale). */
  animated: boolean;
}

const DEFAULTS: Required<SurfaceProfile> = {
  texture: 'solid',
  interaction: 'static',
  elevation: 0,
  variant: 'default',
};

/** Elevation → box-shadow recipe (token-backed, native-first fallback). 0 = no shadow. */
function elevationShadow(elevation: SurfaceElevation): string {
  if (elevation <= 0) return 'none';
  // A monotonic ramp: deeper elevation ⇒ a larger, softer, more-offset shadow.
  const ramp: Record<number, string> = {
    1: '0 1px 2px 0 rgba(15, 23, 42, 0.08)',
    2: '0 4px 8px -2px rgba(15, 23, 42, 0.12)',
    3: '0 16px 40px -12px rgba(15, 23, 42, 0.25)',
    4: '0 24px 56px -16px rgba(15, 23, 42, 0.3)',
    5: '0 32px 72px -20px rgba(15, 23, 42, 0.35)',
  };
  return `var(--surface-shadow-${elevation}, ${ramp[elevation]})`;
}

/**
 * Resolve a surface profile to CSS. Pure and deterministic: same profile ⇒ same declarations. Omitted
 * dimensions fall back to the native-first defaults.
 */
export function resolveSurface(profile: SurfaceProfile = {}): ResolvedSurface {
  const p: Required<SurfaceProfile> = { ...DEFAULTS, ...stripUndefined(profile) };
  const base: CssDeclaration[] = [];
  const hover: CssDeclaration[] = [];

  // ── texture ──
  if (p.texture === 'solid') {
    base.push({ property: 'background', value: 'var(--surface-bg, #fff)' });
  } else if (p.texture === 'glass') {
    base.push({ property: 'background', value: 'var(--surface-bg-glass, rgba(255, 255, 255, 0.72))' });
    base.push({ property: 'backdrop-filter', value: 'var(--surface-blur, blur(12px))' });
    base.push({ property: '-webkit-backdrop-filter', value: 'var(--surface-blur, blur(12px))' });
  } else {
    // transparent — layout-only containment, no fill.
    base.push({ property: 'background', value: 'transparent' });
  }

  // ── variant ── (default vs high-contrast alt — picks border + text-color tokens)
  if (p.variant === 'alt') {
    base.push({ property: 'border', value: '1px solid var(--surface-border-alt, #0f172a)' });
    base.push({ property: 'color', value: 'var(--surface-text-alt, #0f172a)' });
  } else if (p.texture !== 'transparent') {
    base.push({ property: 'border', value: '1px solid var(--surface-border, var(--color-border, #e2e8f0))' });
  }

  // ── elevation ──
  const shadow = elevationShadow(p.elevation);
  if (shadow !== 'none') base.push({ property: 'box-shadow', value: shadow });

  // ── interaction ── (static = no motion; lift = translateY; scale = transform scale)
  let animated = false;
  if (p.interaction === 'lift') {
    animated = true;
    base.push({ property: 'transition', value: 'transform 0.2s ease, box-shadow 0.2s ease' });
    hover.push({ property: 'transform', value: 'translateY(-2px)' });
    if (shadow !== 'none') hover.push({ property: 'box-shadow', value: elevationShadow(bump(p.elevation)) });
  } else if (p.interaction === 'scale') {
    animated = true;
    base.push({ property: 'transition', value: 'transform 0.2s ease' });
    hover.push({ property: 'transform', value: 'scale(1.02)' });
  }

  return { base, hover, animated };
}

/** Clamp an elevation one step deeper (for the hover state of a `lift` interaction), capped at 5. */
function bump(e: SurfaceElevation): SurfaceElevation {
  return Math.min(5, e + 1) as SurfaceElevation;
}

function stripUndefined(profile: SurfaceProfile): SurfaceProfile {
  const out: SurfaceProfile = {};
  for (const k of Object.keys(profile) as (keyof SurfaceProfile)[]) {
    if (profile[k] !== undefined) (out as Record<string, unknown>)[k] = profile[k];
  }
  return out;
}

/** Serialize a declaration list into a CSS block body (`prop: value;` lines), one per declaration. */
export function declarationsToCss(decls: readonly CssDeclaration[]): string {
  return decls.map((d) => `${d.property}: ${d.value};`).join(' ');
}

/**
 * Render a resolved surface to a full CSS ruleset string for a given selector — the build-time emit a recipe
 * engine / assembler uses to compose a consumer's surface (e.g. the hovercard card). Emits a `:hover,
 * :focus-visible` block only when the interaction dimension needs one. Reduced-motion safe: animated surfaces
 * drop their transform under `prefers-reduced-motion: reduce`.
 */
export function surfaceCss(selector: string, profile: SurfaceProfile = {}): string {
  const resolved = resolveSurface(profile);
  const blocks: string[] = [`${selector} { ${declarationsToCss(resolved.base)} }`];
  if (resolved.hover.length) {
    blocks.push(`${selector}:hover, ${selector}:focus-visible { ${declarationsToCss(resolved.hover)} }`);
    if (resolved.animated) {
      blocks.push(
        `@media (prefers-reduced-motion: reduce) { ${selector} { transition: none; } ${selector}:hover, ${selector}:focus-visible { transform: none; } }`,
      );
    }
  }
  return blocks.join('\n');
}
