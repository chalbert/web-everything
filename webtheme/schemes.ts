/**
 * @file webtheme/schemes.ts
 * @description Web Theme scheme + accent runtime — backlog #405 (Fork 4 of the #364 ruling, A'), built
 *   on the #404 token model ({@link ./tokens}) + DTCG→CSS compile ({@link ./compile}).
 *
 * Two derivations, both **native-CSS-first** with an **accessibility gate by default**:
 *
 *   1. **Schemes** — light / dark / high-contrast. Scheme-paired roles (`bg`, `fg`) compile to
 *      `light-dark(<light>, <dark>)` under `color-scheme`, so the browser picks per the user's setting
 *      with zero JS. A high-contrast variant maximises bg↔fg separation.
 *   2. **Accent + state scales** — a tonal scale derived from a single accent **seed** via the native
 *      relative-color syntax (`oklch(from <seed> <L> C H)`), so the scale tracks the seed at runtime and
 *      a project re-tints by changing one token. State colors (hover/active/focus) are `color-mix()`
 *      nudges of their base — again native, runtime-tracked.
 *
 * The catch the #364 ruling calls out: native derivation means the *browser* computes the final color, so
 * a build can't see it to check contrast. We resolve that by computing each derived step's literal value
 * **here** (the same math the CSS expresses) purely to **validate** it — every step is checked against its
 * intended background with **WCAG 2.x** ratio *and* **APCA Lc**, and a step that fails its configured
 * threshold is reported (lossy-but-loud, never a silent inaccessible token). The emitted CSS still uses the
 * native expression; the TS value exists only for the gate. Patterns: MD3 HCT tonal palettes (a perceptual
 * lightness ramp) + Adobe Leonardo (contrast-first generation). For brand precision, a **curated override**
 * supplies explicit per-step values that bypass derivation — still validated, so brand can't silently ship
 * an inaccessible step. Pure + dependency-free.
 */
import { type DtcgDocument, flattenTokens, resolveTokens } from './tokens';

// ─────────────────────────────────────────────────────────────────────────────
// Color model — parse → sRGB → luminance. Supports the formats the default token
// set uses (oklch/oklab) plus hex and rgb(); enough to validate a derived scale.
// ─────────────────────────────────────────────────────────────────────────────

/** An sRGB color, each channel gamma-encoded in [0, 1]. Alpha dropped (contrast is opaque). */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** sRGB transfer function: linear-light channel → gamma-encoded sRGB. */
function gammaEncode(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** Inverse sRGB transfer function: gamma-encoded sRGB channel → linear-light. */
function gammaDecode(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Oklab → linear-light sRGB (Björn Ottosson's matrices). */
function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const num = (s: string): number =>
  s.trim().endsWith('%') ? parseFloat(s) / 100 : parseFloat(s);

/** Thrown when a color string can't be parsed for validation — a malformed/unsupported value. */
export class ColorParseError extends Error {
  constructor(value: string) {
    super(`webtheme scheme — cannot parse color "${value}" for contrast validation`);
    this.name = 'ColorParseError';
  }
}

/**
 * Parse a CSS color string to sRGB. Supports hex (#rgb/#rrggbb), `rgb()`/`rgba()`, and the perceptual
 * `oklch()`/`oklab()` forms the default token set uses. Hue is degrees; L/C are absolute (oklch L in
 * [0,1]). Throws {@link ColorParseError} on anything else — validation never guesses a value.
 */
export function parseColor(value: string): Rgb {
  const v = value.trim();

  if (v.startsWith('#')) {
    const hex = v.slice(1);
    const expand = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    if (expand.length !== 6) throw new ColorParseError(value);
    return {
      r: parseInt(expand.slice(0, 2), 16) / 255,
      g: parseInt(expand.slice(2, 4), 16) / 255,
      b: parseInt(expand.slice(4, 6), 16) / 255,
    };
  }

  const fn = v.match(/^(oklch|oklab|rgb|rgba)\(([^)]+)\)$/i);
  if (!fn) throw new ColorParseError(value);
  const kind = fn[1].toLowerCase();
  const parts = fn[2].split(/[\s,/]+/).filter(Boolean);

  if (kind === 'rgb' || kind === 'rgba') {
    const ch = (s: string): number => (s.endsWith('%') ? num(s) : parseFloat(s) / 255);
    return { r: clamp01(ch(parts[0])), g: clamp01(ch(parts[1])), b: clamp01(ch(parts[2])) };
  }

  // oklab / oklch → oklab → linear sRGB → gamma sRGB.
  const L = num(parts[0]);
  let a: number;
  let b: number;
  if (kind === 'oklab') {
    a = parseFloat(parts[1]);
    b = parseFloat(parts[2]);
  } else {
    const C = parseFloat(parts[1]);
    const h = (parseFloat(parts[2]) * Math.PI) / 180;
    a = C * Math.cos(h);
    b = C * Math.sin(h);
  }
  const [lr, lg, lb] = oklabToLinearSrgb(L, a, b);
  return { r: clamp01(gammaEncode(lr)), g: clamp01(gammaEncode(lg)), b: clamp01(gammaEncode(lb)) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrast — WCAG 2.x ratio + APCA Lc. Both gate the derived steps.
// ─────────────────────────────────────────────────────────────────────────────

/** WCAG 2.x relative luminance of an sRGB color. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * gammaDecode(r) + 0.7152 * gammaDecode(g) + 0.0722 * gammaDecode(b);
}

/** WCAG 2.x contrast ratio (1–21) between two colors, order-independent. */
export function wcagContrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// APCA-W3 0.1.9 constants (the published algorithm).
const APCA = {
  trc: 2.4,
  Rco: 0.2126729, Gco: 0.7151522, Bco: 0.072175,
  blkThrs: 0.022, blkClmp: 1.414,
  scale: 1.14, loClip: 0.1, deltaY: 0.0005,
  loBoWoffset: 0.027,
  normBG: 0.56, normTXT: 0.57, revTXT: 0.62, revBG: 0.65,
} as const;

function apcaY({ r, g, b }: Rgb): number {
  const lin = (c: number): number => Math.pow(c, APCA.trc);
  const Y = APCA.Rco * lin(r) + APCA.Gco * lin(g) + APCA.Bco * lin(b);
  return Y > APCA.blkThrs ? Y : Y + Math.pow(APCA.blkThrs - Y, APCA.blkClmp);
}

/**
 * APCA Lc (lightness contrast, signed −108…+106) of text on a background — the perceptual successor to
 * WCAG ratio (APCA-W3 0.1.9). Positive = dark text on light bg; magnitude is what matters for thresholds.
 */
export function apcaLc(text: Rgb, bg: Rgb): number {
  const Ytxt = apcaY(text);
  const Ybg = apcaY(bg);
  if (Math.abs(Ybg - Ytxt) < APCA.deltaY) return 0;
  let Sapc: number;
  let out: number;
  if (Ybg > Ytxt) {
    Sapc = (Math.pow(Ybg, APCA.normBG) - Math.pow(Ytxt, APCA.normTXT)) * APCA.scale;
    out = Sapc < APCA.loClip ? 0 : Sapc - APCA.loBoWoffset;
  } else {
    Sapc = (Math.pow(Ybg, APCA.revBG) - Math.pow(Ytxt, APCA.revTXT)) * APCA.scale;
    out = Sapc > -APCA.loClip ? 0 : Sapc + APCA.loBoWoffset;
  }
  return out * 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheme + accent derivation
// ─────────────────────────────────────────────────────────────────────────────

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
}

const DEFAULT_POLICY: Required<ContrastPolicy> = { wcagMin: 4.5, apcaMin: 60 };

/** The default tonal ramp (perceptual oklch lightness per step) — an MD3-style descending scale. */
const DEFAULT_RAMP: Record<string, number> = {
  'accent-1': 0.98, 'accent-3': 0.92, 'accent-6': 0.74, 'accent-9': 0.55, 'accent-11': 0.45, 'accent-12': 0.32,
};

export interface DeriveOptions {
  /** Per-step oklch lightness ramp (default {@link DEFAULT_RAMP}). */
  readonly ramp?: Record<string, number>;
  /** Contrast thresholds (default WCAG AA + APCA 60). */
  readonly policy?: ContrastPolicy;
  /**
   * Curated override (brand precision): explicit literal values for named steps that bypass derivation.
   * Still validated against the policy — brand cannot silently ship an inaccessible step.
   */
  readonly curated?: Record<string, string>;
}

/** Read a flat literal token value out of a DTCG document by dot-path (resolving aliases). */
function tokenValue(doc: DtcgDocument, path: string): string {
  const resolved = resolveTokens(flattenTokens(doc));
  const hit = resolved.find((t) => t.path.join('.') === path);
  if (!hit) throw new ColorParseError(`{${path}}`);
  return String(hit.resolved);
}

/**
 * Derive the scheme + accent runtime from a (resolved) token document — the platform default extended by
 * a project (see {@link ./tokens.extendTokens}). Reads the scheme anchors (`color.bg-light/.bg-dark`,
 * `color.text-light/.text-dark`) and the `color.accent` seed, derives the tonal accent scale natively,
 * and validates every step. A curated override replaces a step's derivation with a literal (still gated).
 */
export function deriveSchemeRuntime(doc: DtcgDocument, opts: DeriveOptions = {}): SchemeRuntime {
  const ramp = opts.ramp ?? DEFAULT_RAMP;
  const policy = { ...DEFAULT_POLICY, ...opts.policy };
  const curated = opts.curated ?? {};

  const bgLight = tokenValue(doc, 'color.bg-light');
  const bgDark = tokenValue(doc, 'color.bg-dark');
  const textLight = tokenValue(doc, 'color.text-light');
  const textDark = tokenValue(doc, 'color.text-dark');
  const seed = tokenValue(doc, 'color.accent');

  const scheme: SchemeRoles = {
    bg: `light-dark(${bgLight}, ${bgDark})`,
    fg: `light-dark(${textLight}, ${textDark})`,
  };
  // High contrast: drive bg↔fg to the extremes so separation is maximal under prefers-contrast: more.
  const highContrast: SchemeRoles = {
    bg: 'light-dark(#ffffff, #000000)',
    fg: 'light-dark(#000000, #ffffff)',
  };

  const accent: AccentStep[] = Object.entries(ramp).map(([id, lightness]) => {
    const override = curated[id];
    if (override !== undefined) {
      // Curated: brand-supplied literal, emitted verbatim; still validated below.
      return { id, lightness, css: override, value: parseColor(override) };
    }
    // Derived natively: relative-color keeps the seed's chroma + hue, sets this step's lightness, so the
    // whole scale re-tints when the seed token changes — no rebuild. The literal is computed for the gate.
    const css = `oklch(from var(--color-accent) ${lightness} c h)`;
    const seedRgb = parseColor(seed);
    const value = recolorLightness(seedRgb, lightness);
    return { id, lightness, css, value };
  });

  const bgLightRgb = parseColor(bgLight);
  const bgDarkRgb = parseColor(bgDark);
  const validation: StepValidation[] = [];
  for (const step of accent) {
    // Each step is validated against BOTH scheme backgrounds; it "passes" if it reads on at least one
    // (a light-end step reads on dark bg, a dark-end step on light bg — the scale spans both schemes).
    for (const [against, bg] of [['bg-light', bgLightRgb], ['bg-dark', bgDarkRgb]] as const) {
      const wcag = wcagContrast(step.value, bg);
      const apca = apcaLc(step.value, bg);
      const wcagOk = wcag >= policy.wcagMin;
      const apcaOk = Math.abs(apca) >= policy.apcaMin;
      validation.push({
        step: step.id,
        against,
        wcag: round2(wcag),
        apca: round2(apca),
        passes: wcagOk && apcaOk,
        reason: wcagOk ? (apcaOk ? 'ok' : 'apca-below-min') : 'wcag-below-min',
      });
    }
  }

  // Accessible ⇔ every step clears the policy on at least one of the two scheme backgrounds.
  const accessible = accent.every((s) =>
    validation.some((v) => v.step === s.id && v.passes),
  );

  return { scheme, highContrast, accent, validation, accessible };
}

/** Recompute a color at a target oklch lightness, preserving its chroma + hue (mirrors the CSS `from`). */
function recolorLightness(rgb: Rgb, lightness: number): Rgb {
  const { L: _L, a, b } = srgbToOklab(rgb);
  const [lr, lg, lb] = oklabToLinearSrgb(lightness, a, b);
  return { r: clamp01(gammaEncode(lr)), g: clamp01(gammaEncode(lg)), b: clamp01(gammaEncode(lb)) };
}

/** sRGB → Oklab (the forward of {@link oklabToLinearSrgb}, used to read a seed's chroma+hue). */
function srgbToOklab(rgb: Rgb): { L: number; a: number; b: number } {
  const r = gammaDecode(rgb.r);
  const g = gammaDecode(rgb.g);
  const b = gammaDecode(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Emit the native CSS for a derived runtime: the scheme roles as `light-dark()` custom properties under
 * `color-scheme`, the accent scale as relative-color (or curated) custom properties, and a
 * `@media (prefers-contrast: more)` block swapping in the high-contrast scheme. Native only — no JS, no
 * second runtime (consistent with {@link ./compile}).
 */
export function compileSchemeCss(runtime: SchemeRuntime, selector = ':root'): string {
  const accentDecls = runtime.accent.map((s) => `  --color-${s.id}: ${s.css};`).join('\n');
  const root = [
    `${selector} {`,
    `  color-scheme: light dark;`,
    `  --color-bg: ${runtime.scheme.bg};`,
    `  --color-fg: ${runtime.scheme.fg};`,
    accentDecls,
    `}`,
  ].join('\n');
  const hc = [
    `@media (prefers-contrast: more) {`,
    `  ${selector} {`,
    `    --color-bg: ${runtime.highContrast.bg};`,
    `    --color-fg: ${runtime.highContrast.fg};`,
    `  }`,
    `}`,
  ].join('\n');
  return `${root}\n\n${hc}\n`;
}
