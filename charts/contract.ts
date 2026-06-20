/**
 * Web Charts protocol — the **pure-contract half** (#1004, slice #1334; spec settled by #1290/#1291).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become
 * the `@webeverything/contracts/charts` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `positioning/contract.ts`. The runtime half — the
 * native-first SVG renderer, every library adapter (Vega, Plotly, ECharts), and the
 * `customChartRenderers` swap registry — is impl and lives in FUI (`fui:charts/`, statute #1282/#1290);
 * only the contract crosses the seam (npm scope mirrors layer). #1292 (the FUI SVG renderer) imports
 * these types.
 *
 * The standard is the **spec, not the renderer**. A `ChartSpec` is a portable Vega-Lite **L1** profile
 * carrying the **semantic** plane only — what the data *means* (field → visual channel, measurement
 * type) — never concrete pixels. A swappable `CustomChartRenderer` consumes that spec plus the
 * already-resolved `ResolvedTheme` tokens and decides *how* to draw; swapping the SVG default for an
 * adapter never touches the `ChartSpec` (the spec is the only lock). Selections, transforms, and view
 * composition are additive **L2+** tiers — a conformant L1 renderer ignores higher-tier fields
 * gracefully — so they are not part of this L1 contract.
 *
 * Transcribed verbatim from the ratified spec (`we:src/_includes/project-webcharts.njk:71-162`); no
 * design fork.
 */

/**
 * The portable webcharts artifact — a Vega-Lite L1 profile. SEMANTIC plane ONLY: what the data means.
 * The presentation/theme plane (concrete palettes, animation, alignment) is resolved from webtheme
 * tokens and never appears here. Borrows Vega-Lite's vocabulary; standardizes the L1 subset.
 */
export interface ChartSpec {
  /** The rows, or a named dataset. */
  data: DataSource;
  /** The geometric primitive the data becomes. */
  mark: Mark;
  /** Data field → visual channel (the semantic mapping). */
  encoding: Encoding;
}

/** L1 marks — the basic primitives. Layered/composite marks are L2+. */
export type Mark = 'bar' | 'line' | 'point' | 'area' | 'arc';

export interface DataSource {
  /** Inline rows. */
  values?: Record<string, unknown>[];
  /** A named dataset (resolved by the host). */
  name?: string;
}

/**
 * Each channel binds a data field to a meaning. `color`/`size` are SEMANTIC: which field drives the
 * channel — the concrete hue/scale is resolved from webtheme, so the same spec re-themes for free.
 * `tooltip` / `selection` / `facet` / `detail` are L2+ tiers (additive), not part of L1.
 */
export interface Encoding {
  x?: PositionChannel;
  y?: PositionChannel;
  /** Semantic: which field drives hue; resolved palette = theme. */
  color?: FieldChannel;
  /** Semantic: which field drives magnitude; resolved range = theme. */
  size?: FieldChannel;
}

export interface PositionChannel {
  field: string;
  /** Drives the default scale + the a11y-derivable axis label. */
  type: MeasurementType;
  /** L1 scales only. */
  scale?: Scale;
  /** title / grid — the labels a screen-reader description derives from. */
  axis?: Axis;
}

export interface FieldChannel {
  field: string;
  type: MeasurementType;
  /** title — also a11y-derivable. */
  legend?: Legend;
}

/** The four Vega-Lite measurement types — the semantic kind of a field, NOT its presentation. */
export type MeasurementType = 'quantitative' | 'temporal' | 'ordinal' | 'nominal';

/** L1 scales; more are L2+. */
export interface Scale {
  type: 'linear' | 'log' | 'time' | 'band' | 'point';
}

export interface Axis {
  title?: string;
  grid?: boolean;
}

export interface Legend {
  title?: string;
}

/**
 * The renderer-swap contract — the only lock. A renderer consumes the SEMANTIC spec + resolved theme
 * tokens; swapping the SVG default for a Vega/Plotly/ECharts adapter never touches the `ChartSpec`. The
 * native-first default is the SVG renderer FUI ships as the standard's canonical impl behind this
 * contract; adapters register as alternative impls through the `customChartRenderers` swap registry,
 * resolved through the injector chain — the same impl-swap shape as `PositioningStrategy`.
 */
export interface CustomChartRenderer {
  /**
   * Which profile tier this renderer supports. L1 is required; L2+ is additive
   * (selections/transforms/composition) — an L1 renderer ignores higher-tier fields gracefully.
   */
  readonly tier: 'L1' | 'L2' | 'L3';

  /**
   * Draw a semantic spec into `target`, resolving presentation from theme tokens. The renderer never
   * reads literal palettes from the spec — `color`/`size` are semantic, the values are theme.
   */
  render(spec: ChartSpec, theme: ResolvedTheme, target: Element): ChartHandle;
}

/** webtheme tokens already resolved for this chart — the presentation plane the spec defers to. */
export interface ResolvedTheme {
  /** Categorical hues, in order. */
  palette: string[];
  /** size/magnitude range. */
  scaleRange?: [number, number];
  // typography / spacing / animation tokens flow through here too (webtheme).
}

export interface ChartHandle {
  /** Re-render on data/encoding change. */
  update(spec: ChartSpec): void;
  destroy(): void;
  /**
   * The a11y description derivable from the spec's encodings + measurement types — the conformance
   * suite scores accessibility as a first-class axis (slice d).
   */
  describe(): string;
}
