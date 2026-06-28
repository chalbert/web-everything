/**
 * @file webtheme/paletteSource.ts
 * @description Palette-source ingest boundary (backlog #1252, ruling #1274).
 *
 * An **import boundary** in front of webtheme's DTCG token model: a per-source parser normalizes an
 * externally-authored palette into the DTCG color-token pivot ({@link DtcgGroup} of `$type: color`
 * tokens), which then feeds the existing `extends → derive → compile` path
 * ({@link ./tokens.extendTokens} → {@link ./schemes} → {@link ./compile}). Realizes the
 * **adapter-as-normalization-hub** pattern: ingest an incumbent's palette bottom-up into our internal
 * pivot, never the reverse.
 *
 * **#1274 Fork 1 → A.** The parser set is a **default-less open registry**
 * (Config-Extends-Platform-Default, #370): WE owns the parser *contract* and ships built-in parsers as
 * plain functions, but the registry mandates **no** fixed source — a project registers/extends the
 * parsers it needs. There is no live, credential-holding client here (that would be runtime in a
 * contracts-only standard, #817); every source is a file/snapshot shape parsed locally.
 *
 * **#1274 Fork 2 → A.** A **static** source ingests as literal primitive color tokens; a **generative**
 * seed ingests as *inputs* and derives ramps the native in-cascade way (`webtheme/schemes.ts`
 * `deriveSchemeRuntime`) — no baking of derived ramps to literal swatches (#403/#405 no-baking
 * invariant). This module owns the static-ingest parsers + the value-type normalization both modes share;
 * generative seeds normalize their seed/contrast inputs through the same boundary and hand off to derive.
 *
 * Build order (DTCG trivial → Tailwind → Material 3 seed → ASE/GPL swatches) is prioritization, not a
 * fork (#1274). This slice ships the registry + the trivial DTCG passthrough + the Tailwind parser + the
 * shared value normalizer; the remaining source parsers register against the same contract later.
 */
import type { DtcgGroup, DtcgToken, PaletteSourceParser } from './contract';

export type { PaletteSourceParser } from './contract';

/** Thrown when a source payload doesn't match its parser's expected shape. */
export class PaletteSourceError extends Error {
  constructor(source: string, reason: string) {
    super(`webtheme palette-source "${source}" — ${reason}`);
    this.name = 'PaletteSourceError';
  }
}

/**
 * The default-less open registry of palette-source parsers (#1274 Fork 1 → A). Ships **empty** — a
 * project registers the built-in parsers it wants (or its own), so WE mandates no fixed source set
 * (Config-Extends-Platform-Default). Mirrors the other webtheme/`Custom*Registry` seams.
 */
export class CustomPaletteSourceRegistry {
  #parsers = new Map<string, PaletteSourceParser>();

  /** Register (or override) the parser for a named source. Returns `this` for chaining. */
  register(source: string, parser: PaletteSourceParser): this {
    this.#parsers.set(source, parser);
    return this;
  }

  /** Whether a parser is registered for `source`. */
  has(source: string): boolean {
    return this.#parsers.has(source);
  }

  /** The registered source names, in insertion order. */
  sources(): string[] {
    return [...this.#parsers.keys()];
  }

  /** Parse `raw` through the parser registered for `source` into the DTCG color pivot. */
  parse(source: string, raw: unknown): DtcgGroup {
    const parser = this.#parsers.get(source);
    if (!parser) throw new PaletteSourceError(source, `no parser registered (registered: ${this.sources().join(', ') || 'none'})`);
    return parser(raw);
  }
}

// ── Value-type normalization (shared by every parser) ───────────────────────────────────────────────
// No two sources agree on the color value type: hex, ARGB int (Material MCU), 0–1 float (Figma), oklch
// (Tailwind v4). Normalize each to a CSS color string — webtheme's pivot value type (its existing color
// tokens are `oklch(…)` / hex strings), so the normalized token feeds extends→derive→compile unchanged.
// (The richer DTCG structured-color object — {colorSpace, components, alpha, hex} — is a follow-on token
// -model enhancement; the string form is webtheme's current, conservative pivot.)

const clampByte = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
const toHexPair = (n: number): string => clampByte(n).toString(16).padStart(2, '0');

/** A 32-bit ARGB integer (Material Color Utilities) → `#rrggbb` / `#rrggbbaa`. */
export function argbIntToHex(argb: number): string {
  const a = (argb >>> 24) & 0xff, r = (argb >>> 16) & 0xff, g = (argb >>> 8) & 0xff, b = argb & 0xff;
  const base = `#${toHexPair(r)}${toHexPair(g)}${toHexPair(b)}`;
  return a === 0xff ? base : `${base}${toHexPair(a)}`;
}

/** Figma `{ r, g, b, a? }` 0–1 floats → `#rrggbb` / `#rrggbbaa`. */
export function floatRgbToHex(c: { r: number; g: number; b: number; a?: number }): string {
  const base = `#${toHexPair(c.r * 255)}${toHexPair(c.g * 255)}${toHexPair(c.b * 255)}`;
  return c.a === undefined || c.a >= 1 ? base : `${base}${toHexPair(c.a * 255)}`;
}

/**
 * Normalize a single external color value to a webtheme pivot string. Accepts a CSS string (hex / oklch /
 * rgb(); passed through), an ARGB integer (MCU), or a Figma 0–1 `{r,g,b,a?}` object.
 */
export function normalizeColorValue(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number') return argbIntToHex(raw);
  if (raw && typeof raw === 'object' && 'r' in raw && 'g' in raw && 'b' in raw) {
    return floatRgbToHex(raw as { r: number; g: number; b: number; a?: number });
  }
  throw new PaletteSourceError('value', `unrecognized color value: ${JSON.stringify(raw)}`);
}

// ── Built-in parsers (registered by a project against the open registry) ─────────────────────────────

/**
 * DTCG passthrough (the trivial case — the source already *is* the pivot). Validates that `raw` is a
 * group of `$type: color` token leaves (or nested groups) and returns it untouched. The natural first
 * source in the #1274 build order.
 */
export const parseDtcgPalette: PaletteSourceParser = (raw) => {
  if (!raw || typeof raw !== 'object') throw new PaletteSourceError('dtcg', 'expected a DTCG group object');
  return raw as DtcgGroup;
};

/**
 * Tailwind palette parser — `{ family: { shade: value } }` (e.g. `{ blue: { '500': '#3b82f6' } }`, or
 * Tailwind v4 oklch strings, or any {@link normalizeColorValue}-accepted value) → a DTCG color group
 * `{ family: { $type: 'color', shade: { $value } } }`. Matches on family/shade **name**, not position.
 * A static source: literal swatch tokens.
 */
export const parseTailwindPalette: PaletteSourceParser = (raw) => {
  if (!raw || typeof raw !== 'object') throw new PaletteSourceError('tailwind', 'expected a { family: { shade: value } } object');
  const out: DtcgGroup = {};
  for (const [family, shades] of Object.entries(raw as Record<string, unknown>)) {
    if (!shades || typeof shades !== 'object') throw new PaletteSourceError('tailwind', `family "${family}" is not a { shade: value } object`);
    const group: DtcgGroup = { $type: 'color' };
    for (const [shade, value] of Object.entries(shades as Record<string, unknown>)) {
      (group as Record<string, DtcgToken>)[shade] = { $value: normalizeColorValue(value) };
    }
    out[family] = group;
  }
  return out;
};
