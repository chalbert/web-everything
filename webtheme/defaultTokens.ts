/**
 * @file webtheme/defaultTokens.ts
 * @description The Web Theme **platform default token set** — backlog #404.
 *
 * A *complete*, native-first default in DTCG 2025.10, shipped so a consuming project overrides via
 * {@link ./tokens.extendTokens `extends`} rather than authoring from scratch (config-extends-platform-
 * default, #403). Two of the three tiers live here:
 *   - **primitive** — `color` (oklch palette + scheme bg/fg + an accent seed), `space`, `radius`,
 *     `elevation` (shadow scale), `type` (font sizes + line heights). Raw scales, owned by webtheme.
 *   - **component** — per-component overrides authored as DTCG nodes that **alias** a primitive, so a
 *     component value provably tracks the scale it points into.
 * The **semantic** tier is intentionally absent — those role names are the intents (#403).
 *
 * Deliberately authored as **one DTCG document** (the open packaging question in #403): a single source
 * of truth that `extends` can still target by group, with per-`$type` splitting left as a future option.
 */
import type { DtcgDocument } from './tokens';

export const defaultTokens: DtcgDocument = {
  color: {
    $type: 'color',
    // A perceptual (oklch) primary scale — the steps a semantic role or component aliases into.
    blue: {
      $description: 'Primary blue scale (oklch, lightness-descending).',
      '1': { $value: 'oklch(0.98 0.01 256)' },
      '3': { $value: 'oklch(0.92 0.05 256)' },
      '6': { $value: 'oklch(0.74 0.13 256)' },
      '9': { $value: 'oklch(0.55 0.18 256)' },
      '11': { $value: 'oklch(0.45 0.16 256)' },
    },
    gray: {
      $description: 'Neutral gray scale.',
      '1': { $value: 'oklch(0.99 0 0)' },
      '6': { $value: 'oklch(0.70 0 0)' },
      '9': { $value: 'oklch(0.55 0 0)' },
      '12': { $value: 'oklch(0.20 0 0)' },
    },
    // Scheme anchors — light/dark surface + text. The `light-dark()` pairing happens at the role/CSS layer.
    'bg-light': { $value: 'oklch(1 0 0)' },
    'bg-dark': { $value: 'oklch(0.18 0.01 256)' },
    'text-light': { $value: 'oklch(0.20 0 0)' },
    'text-dark': { $value: 'oklch(0.96 0 0)' },
    // The single accent seed a derived accent scale (#405) is built from. A project may add an optional
    // `accent-dark` anchor (#1314) to make the scale scheme-paired — each accent step then flips between
    // the two seeds via light-dark(), expressing a distinct dark-mode primary from one theme. Omitted from
    // the platform default (the default scale stays single-seed, tracking this one seed across schemes).
    accent: { $value: '{color.blue.9}' },
  },

  space: {
    $type: 'dimension',
    $description: 'Spacing scale (rem, modular).',
    '0': { $value: '0' },
    '1': { $value: '0.25rem' },
    '2': { $value: '0.5rem' },
    '3': { $value: '0.75rem' },
    '4': { $value: '1rem' },
    '6': { $value: '1.5rem' },
    '8': { $value: '2rem' },
  },

  radius: {
    $type: 'dimension',
    $description:
      'Corner-radius scale — derived from a single `base` (#1315, shadcn-style): sm/md/lg are calc() ' +
      'offsets of `base`, so re-theming `base` shifts the whole scale instead of drifting. Computed ' +
      'values match the prior flat scale (base 0.5rem → sm 0.25rem, md 0.5rem, lg 1rem).',
    none: { $value: '0' },
    base: { $value: '0.5rem' },
    sm: { $value: 'calc({radius.base} - 0.25rem)' },
    md: { $value: '{radius.base}' },
    lg: { $value: 'calc({radius.base} + 0.5rem)' },
    full: { $value: '9999px' },
  },

  elevation: {
    $type: 'shadow',
    $description: 'Elevation/shadow scale (0–5).',
    '0': { $value: 'none' },
    '1': { $value: '0 1px 2px oklch(0 0 0 / 0.08)' },
    '3': { $value: '0 4px 12px oklch(0 0 0 / 0.12)' },
    '5': { $value: '0 16px 32px oklch(0 0 0 / 0.18)' },
  },

  type: {
    $description: 'Type ramp — font sizes and the base line height.',
    size: {
      $type: 'dimension',
      sm: { $value: '0.875rem' },
      md: { $value: '1rem' },
      lg: { $value: '1.25rem' },
      xl: { $value: '1.75rem' },
    },
    'line-height': { $type: 'number', base: { $value: 1.5 } },
  },

  // ── Component tier — per-component overrides that ALIAS a primitive ──────────────
  button: {
    $description: 'Button component tokens — each aliases a primitive so it can never drift from the scale.',
    radius: { $type: 'dimension', $value: '{radius.md}' },
    'padding-x': { $type: 'dimension', $value: '{space.4}' },
    'padding-y': { $type: 'dimension', $value: '{space.2}' },
    bg: { $type: 'color', $value: '{color.accent}' },
  },

  card: {
    $description: 'Card component tokens.',
    radius: { $type: 'dimension', $value: '{radius.lg}' },
    padding: { $type: 'dimension', $value: '{space.6}' },
    elevation: { $type: 'shadow', $value: '{elevation.1}' },
  },

  // ── Role tier — cross-cutting affordances (not per-component) ────────────────────
  ring: {
    $description:
      'Focus-ring affordance (#1316) — shadcn `--ring` / `--ring-offset` parity. The focus-visible ' +
      'outline a themed control draws; `color` aliases the accent so the ring tracks the theme. The ' +
      'focus affordance now has a token home (webtheme owns the role tokens; the interaction intent ' +
      'stays UX-only per #403).',
    color: { $type: 'color', $value: '{color.accent}' },
    width: { $type: 'dimension', $value: '2px' },
    offset: { $type: 'dimension', $value: '2px' },
  },
};
