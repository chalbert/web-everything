/**
 * @file reproduction-parity/shadcn/reproduction.ts
 * @description The shadcn/ui reproduction **scaffold + first gap delta** — buckets 2 (intent set) and 3
 *   (gap list) for the first reproduction-conformance target (#1243, epic #1226, charter #1225).
 *
 * This is the WE-side foundational harness the #1243 split-analysis called for: it stands up the
 * declarative reproduction surface (the seed targets + the intent/token map that expresses them) and the
 * **ingestion loop** for the {@link ../contract Plateau→WE parity contract}, then emits the first
 * {@link ../contract.GapDelta gap delta} — what `theme + intents` could NOT express to reach shadcn parity.
 *
 * What lives here vs. what does not (the boundary the charter fixes):
 *  - **WE owns** the theme pack ({@link ./theme}), the intent set ({@link INTENT_MAP}), the gap list
 *    ({@link SHADCN_GAPS}), and the verdict **ingestion + conformance** loop ({@link buildShadcnReport},
 *    {@link assertVerdictGating}). All declarative/structured — no rendering.
 *  - **WE does NOT own** the rendered reproduction page (FUI primitives styled as shadcn — FUI/Plateau,
 *    we-fui-embed-boundary) nor the layered oracle that measures it (deterministic diff = FUI, VLM =
 *    Plateau; #475 no-leakage). WE *ingests verdicts only*. The oracle co-evolves (#1226 Fork 1), so for
 *    this seed run no measured readings exist yet — and the charter forbids a parity claim without a
 *    measurement. Hence the report ships **gaps now, verdicts when the oracle produces them** (the
 *    ingestion path is proven by test, never by a fabricated pass).
 *
 * Re-run `/split 1243` once the rendered surface + oracle co-evolve far enough to seam per-component
 * build slices against this scaffold.
 */
import type {
  GapDelta,
  ReproductionParityReport,
  ReproductionTarget,
  ReproductionVerdict,
} from '../contract';

const SYSTEM = 'shadcn';

/**
 * The seed set: 3 leaf components × the states/schemes shadcn varies them across. Leaf components first
 * (per the split analysis) — they exercise the theme pack + the simplest intent mappings, so a gap here
 * is unambiguously a `theme + intents` gap rather than a composition artifact.
 */
export const SHADCN_COMPONENTS = ['button', 'input', 'badge'] as const;
export type ShadcnComponent = (typeof SHADCN_COMPONENTS)[number];

const STATES_BY_COMPONENT: Record<ShadcnComponent, readonly string[]> = {
  button: ['default', 'hover', 'focus-visible', 'disabled'],
  input: ['default', 'focus-visible', 'disabled'],
  badge: ['default'],
};

const SCHEMES = ['light', 'dark'] as const;

/** The flat `component × state × scheme` target list one verdict each is judged against. */
export const SHADCN_TARGETS: readonly ReproductionTarget[] = SHADCN_COMPONENTS.flatMap((component) =>
  STATES_BY_COMPONENT[component].flatMap((state) =>
    SCHEMES.map((scheme): ReproductionTarget => ({ system: SYSTEM, component, state, scheme })),
  ),
);

/**
 * The **intent set** (bucket 2): each seed component mapped to the WE intent(s) that carry its
 * structure/behavior plus the webtheme token roles that carry its look. The hypothesis under test is that
 * this map + the theme pack is *all* that distinguishes shadcn — anything it can't cover is a gap below.
 */
export interface ComponentMapping {
  readonly component: ShadcnComponent;
  /** The WE intent slug(s) that express this component's semantics/behavior. */
  readonly intents: readonly string[];
  /** The webtheme token roles (DTCG dot-paths) that express its look. */
  readonly tokens: readonly string[];
  /** shadcn's own variant axis for this component — what a faithful reproduction must reproduce. */
  readonly variants: readonly string[];
}

export const INTENT_MAP: Record<ShadcnComponent, ComponentMapping> = {
  button: {
    component: 'button',
    // Action Intent: the semantic priority/level hierarchy (primary/secondary/destructive…).
    intents: ['action'],
    tokens: ['button.bg', 'button.radius', 'button.padding-x', 'button.padding-y', 'color.accent'],
    variants: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
  },
  input: {
    component: 'input',
    // Input Intent: text-entry affordances, masking, visual variants.
    intents: ['input'],
    tokens: ['radius.md', 'color.bg-light', 'color.text-light'],
    variants: ['default', 'file'],
  },
  badge: {
    component: 'badge',
    // Status Indicator Intent: the semantic status chip/badge (the visual member of Web Lifecycle).
    intents: ['status-indicator'],
    tokens: ['radius.sm', 'color.accent'],
    variants: ['default', 'secondary', 'destructive', 'outline'],
  },
};

/**
 * **The gap list (bucket 3) — the deliverable.** What `theme + intents` could NOT express to reproduce
 * shadcn's seed components, each attributed to the expressive layer that fell short and phrased as a
 * gap-sweep #315 intake line (not a fix). Discovered by attempting the {@link INTENT_MAP} + {@link ./theme}
 * mapping; every entry is a real expressive shortfall, not a missing render.
 */
export const SHADCN_GAPS: readonly GapDelta[] = [
  {
    target: { system: SYSTEM, component: 'button', state: 'default', scheme: 'dark' },
    kind: 'token',
    description:
      'shadcn flips --primary between schemes (light oklch(0.205 0 0) → dark oklch(0.985 0 0)); webtheme color.accent is a single scheme-invariant seed, so the dark-mode primary surface cannot be expressed without a second theme. Need a scheme-paired accent role (light-dark() on the seed).',
    suggested: 'color.accent as a scheme-paired (light-dark) role',
  },
  {
    target: { system: SYSTEM, component: 'button', state: 'default', scheme: 'light' },
    kind: 'token',
    description:
      'shadcn derives its radius scale by calc() offsets of one base (--radius-md = calc(--radius - 2px)); webtheme radius is a flat, independent scale with no way to encode the derived relationship, so the scale drifts from the base when re-themed.',
    suggested: 'radius scale as calc-derived offsets of a base radius token',
  },
  {
    target: { system: SYSTEM, component: 'button', state: 'default', scheme: 'light' },
    kind: 'intent',
    description:
      'Action Intent expresses semantic priority levels, but shadcn buttons also vary on an orthogonal emphasis-STYLE axis (filled vs outline vs ghost vs link) at the same priority. The fill-style axis is not expressible as an action level.',
    suggested: 'an emphasis-style dimension on Action Intent (fill | outline | ghost | link)',
  },
  {
    target: { system: SYSTEM, component: 'input', state: 'focus-visible', scheme: 'light' },
    kind: 'token',
    description:
      'shadcn focus-visible uses a --ring color + --ring-offset; webtheme has no focus-ring token role (its semantic tier is the intents, #403), so the focus affordance has no token home.',
    suggested: 'a focus-ring role (color + offset), likely on the Interaction/focus intent layer',
  },
  {
    target: { system: SYSTEM, component: 'input', state: 'default', scheme: 'light' },
    kind: 'token',
    description:
      'shadcn leans on neutral surface roles --border / --input / --muted / --muted-foreground / --secondary; webtheme exposes only bg/fg/accent and delegates the rest to intents, but no intent currently supplies neutral border/muted surface roles, so input borders and muted text have no token home.',
    suggested: 'neutral surface roles (border, muted, muted-foreground) on the surface intent',
  },
  {
    target: { system: SYSTEM, component: 'badge', state: 'default', scheme: 'light' },
    kind: 'intent',
    description:
      'Status Indicator Intent is lifecycle-state-driven (an entity\'s current state + next transitions); shadcn\'s badge is a decorative/standalone label with tone variants and no lifecycle semantics. Mapping a decorative badge onto a lifecycle chip over-constrains it.',
    suggested: 'a decorative label/tag intent distinct from the lifecycle Status Indicator',
  },
];

/**
 * Conformance check on an **ingested** verdict (the WE-side consumer of the thin contract that justifies
 * the contract living in WE): the thin-contract rule is that a verdict's `pass` is the AND of its present
 * *gating* legs (pixel + structural) and the advisory VLM leg **never flips it**. Throws if a producer
 * emitted a verdict that violates that — WE ingests outputs, but it does not ingest a malformed verdict.
 */
export function assertVerdictGating(verdict: ReproductionVerdict): void {
  const { pixel, structural, vlm } = verdict.oracle;
  const gating = pixel.pass && structural.pass;
  if (verdict.pass !== gating) {
    throw new Error(
      `reproduction-parity: verdict for ${targetKey(verdict.target)} has pass=${verdict.pass} but its gating legs (pixel=${pixel.pass}, structural=${structural.pass}) AND to ${gating} — the advisory VLM leg must not flip pass.`,
    );
  }
  if (vlm && vlm.score !== undefined) {
    throw new Error(
      `reproduction-parity: advisory VLM leg for ${targetKey(verdict.target)} carries a score; the advisory leg annotates (note only), it never scores/gates.`,
    );
  }
}

/** A stable string key for a target — `system/component/state/scheme`. */
export function targetKey(t: ReproductionTarget): string {
  return `${t.system}/${t.component}/${t.state}/${t.scheme}`;
}

/**
 * Build the shadcn parity report WE ingests + emits onward to gap-sweep #315. It rolls up whatever
 * measured verdicts the co-evolving oracle has produced (each conformance-checked via
 * {@link assertVerdictGating}) and always attaches the WE-side {@link SHADCN_GAPS gap list}. For the seed
 * run `ingested` is empty (no oracle readings yet) — the report ships the gap list with zero parity
 * claims, honouring "no claim without measurement". The ingestion + roll-up path is exercised by test.
 *
 * @param generatedAt ISO-8601 timestamp (the producer stamps the time — scripts can't call Date here).
 */
export function buildShadcnReport(
  ingested: readonly ReproductionVerdict[] = [],
  generatedAt = '',
): ReproductionParityReport {
  for (const v of ingested) assertVerdictGating(v);
  const passed = ingested.filter((v) => v.pass).length;
  return {
    system: SYSTEM,
    generatedAt,
    verdicts: ingested,
    gaps: SHADCN_GAPS,
    summary: {
      passed,
      failed: ingested.length - passed,
      gaps: SHADCN_GAPS.length,
    },
  };
}
