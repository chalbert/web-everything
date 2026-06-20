/**
 * @file reproduction-parity/shadcn/theme.ts
 * @description The shadcn/ui **theme pack** — bucket 1 of 3 for the first reproduction-conformance target
 *   (#1243, under epic #1226, charter #1225 → {@link ../../docs/agent/platform-decisions.md#reproduction-conformance}).
 *
 * Reproduction-conformance asks: is the only difference between two top design systems `theme tokens +
 * intents` over shared structural/behavioral primitives? To test that against shadcn we first express
 * shadcn's design tokens in the **webtheme DTCG model** ({@link ../../webtheme/tokens}) as an `extends`
 * override over the platform default — *not* a from-scratch token set (config-extends-platform-default,
 * #403). What the model can express lands here; what it **can't** is recorded as a {@link ../contract.GapDelta}
 * in {@link ./reproduction} — the gap list is the deliverable, not the copy.
 *
 * shadcn ships its tokens in **oklch** (neutral/zinc base, the current default), so they drop straight into
 * webtheme's native-first model — no lossy hsl→oklch conversion. The literal values below are the upstream
 * shadcn `:root` / `.dark` custom properties (neutral base), transcribed verbatim.
 *
 * Two deliberate non-goals, both surfaced as gaps rather than papered over here:
 *  - **No semantic-role tier.** webtheme's semantic tier *is* the intents (#403) — it has no `border` /
 *    `muted` / `ring` token roles. shadcn leans on those heavily; expressing them is a recorded gap, not a
 *    token we invent here.
 *  - **No scheme-flipped accent.** webtheme's `color.accent` is a single seed; shadcn's `--primary` flips
 *    between light and dark. We seed the light value and record the flip as a gap.
 */
import type { DtcgDocument } from '../../webtheme/tokens';
import { extendTokens } from '../../webtheme/tokens';
import { defaultTokens } from '../../webtheme/defaultTokens';
import { deriveSchemeRuntime, type SchemeRuntime } from '../../webtheme/schemes';

/**
 * The upstream shadcn/ui (neutral base) token values, transcribed from its `:root` (light) and `.dark`
 * custom properties. Kept as a literal record — the documented reference the theme pack maps from and the
 * gap list cites. `border` / `input` / `ring` / `muted` / `secondary` have **no webtheme home** (semantic
 * tier = intents, #403); they live here as reference values backing `token`-kind gaps.
 */
export const SHADCN_TOKENS = {
  light: {
    background: 'oklch(1 0 0)',
    foreground: 'oklch(0.145 0 0)',
    primary: 'oklch(0.205 0 0)',
    'primary-foreground': 'oklch(0.985 0 0)',
    secondary: 'oklch(0.97 0 0)',
    'secondary-foreground': 'oklch(0.205 0 0)',
    muted: 'oklch(0.97 0 0)',
    'muted-foreground': 'oklch(0.556 0 0)',
    destructive: 'oklch(0.577 0.245 27.325)',
    border: 'oklch(0.922 0 0)',
    input: 'oklch(0.922 0 0)',
    ring: 'oklch(0.708 0 0)',
  },
  dark: {
    background: 'oklch(0.145 0 0)',
    foreground: 'oklch(0.985 0 0)',
    primary: 'oklch(0.985 0 0)',
    'primary-foreground': 'oklch(0.205 0 0)',
    secondary: 'oklch(0.269 0 0)',
    'secondary-foreground': 'oklch(0.985 0 0)',
    muted: 'oklch(0.269 0 0)',
    'muted-foreground': 'oklch(0.708 0 0)',
    destructive: 'oklch(0.704 0.191 22.216)',
    border: 'oklch(0.269 0 0)',
    input: 'oklch(0.269 0 0)',
    ring: 'oklch(0.556 0 0)',
  },
  /** shadcn's base radius (`--radius`); its sm/md/lg/xl are `calc()` offsets of this — itself a gap. */
  radius: '0.625rem',
} as const;

/**
 * The shadcn theme pack: a webtheme `extends` override carrying only what the DTCG model can express —
 * the scheme anchors (light/dark bg + text), the accent **seed** (shadcn's light `--primary`), and the
 * component-tier radius shadcn pins. Everything else shadcn needs (border/muted/ring/secondary roles, the
 * scheme-flipped primary, the calc-derived radius scale) is *absent on purpose* and recorded as a gap.
 */
export const shadcnTheme: DtcgDocument = {
  color: {
    $type: 'color',
    'bg-light': { $value: SHADCN_TOKENS.light.background },
    'bg-dark': { $value: SHADCN_TOKENS.dark.background },
    'text-light': { $value: SHADCN_TOKENS.light.foreground },
    'text-dark': { $value: SHADCN_TOKENS.dark.foreground },
    // Single seed — shadcn's LIGHT primary. The dark flip (`oklch(0.985 0 0)`) cannot be expressed by a
    // scheme-invariant seed; recorded as a `token` gap in ./reproduction.
    accent: { $value: SHADCN_TOKENS.light.primary },
  },
  radius: {
    $type: 'dimension',
    // shadcn pins one base radius; its scale is calc()-derived from it (a relationship the flat scale
    // can't encode — recorded as a `token` gap). We map the base onto `md`, shadcn's effective default.
    md: { $value: SHADCN_TOKENS.radius },
  },
  button: {
    $description: 'shadcn button — filled primary surface, base radius, snug padding.',
    radius: { $type: 'dimension', $value: '{radius.md}' },
    bg: { $type: 'color', $value: '{color.accent}' },
  },
} as const;

/** The fully-merged shadcn token document (platform default + the shadcn `extends` override). */
export const shadcnTokens: DtcgDocument = extendTokens(defaultTokens, shadcnTheme);

/**
 * Build the shadcn scheme runtime — the light/dark scheme roles + the native accent scale derived from
 * shadcn's primary seed, with every derived step run through the webtheme contrast gate. The accent seed
 * is near-neutral (chroma ~0, shadcn's zinc aesthetic), so the derived ramp is a grayscale ladder; the
 * returned `validation` records which steps clear the policy on which scheme background.
 */
export function buildShadcnScheme(): SchemeRuntime {
  return deriveSchemeRuntime(shadcnTokens);
}
