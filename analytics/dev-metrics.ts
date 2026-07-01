/**
 * Dev-metrics vocabulary — the **pure-contract half** of the anonymized dev-action metrics channel
 * (#1849, ratified in #1797).
 *
 * A **sibling vocabulary over the analytics contract** (`./contract.ts`), *not* a second transport: it
 * reuses the same shape #1415/#1003 already ship — a **void, fire-and-forget** call whose backend is a
 * **swappable sink resolved through DI** — but narrows it to a closed, privacy-first dev-metrics event.
 * The channel is **platform-owned**: unlike the product-analytics `CustomTracker` (which a consumer may
 * point at Segment / GA4 / Mixpanel), a dev-metrics stream can only ever route to a **dedicated platform
 * sink**, never a consumer's product-analytics vendor (#1797 Fork-1 forced invariant). The runtime impl —
 * the reference emitter (salted install-id, opt-in consent, the platform sink) — is **FUI's**
 * (`fui:plugs/webanalytics/devMetrics.ts`), reached through `@webeverything/contracts/dev-metrics`; this
 * module is type-only (zero runtime emit), exactly like `./contract.ts`.
 *
 * Three #1797 rulings are encoded here, not redecided downstream:
 *  - **Fork-1 (a):** reuse the analytics contract *shape* + a sibling vocabulary with a **dedicated
 *    platform sink** — hence `DevMetricsSink.record()` returns `void` (fire-and-forget, never a gate),
 *    mirroring `CustomTracker.track()`.
 *  - **Fork-2 (a):** anonymization is a **salted, rotating-daily install-id** — `SaltedDailyInstallId` is
 *    per-day-stable and cross-day-rotating, so it dedupes distinct developers *within* a day without
 *    leaving a persistent fingerprint *across* days. **Fixed, not configurable** (a knob would fragment
 *    the aggregate) — so there is no id-model option in this contract.
 *  - **Fork-3 (a):** consent is **opt-IN** — `DevMetricsConsent` defaults to `'unset'`, which resolves to
 *    "do not emit" until the developer affirmatively grants. (The enterprise-policy precedence layer and
 *    the hosted aggregation endpoint are out of #1849's scope — decoupled to their own items.)
 */

/**
 * The **closed** dev-command vocabulary — the *What* of a dev-metric, the counterpart to the analytics
 * `track()` event name but drawn from a fixed set (never a free-form string), so the aggregate cannot leak
 * a project-specific or PII-bearing command name. The definitional source of truth for the set is the WE
 * registry (`src/_data/analytics/dev-metrics.json`); this union is the compile-time lock a reference
 * emitter's runtime list must satisfy.
 */
export type DevCommand =
  | 'install'
  | 'build'
  | 'test'
  | 'dev'
  | 'lint'
  | 'check'
  | 'generate'
  | 'publish';

/**
 * A per-day-distinct, cross-day-rotating install identifier (#1797 Fork-2). Stable within a single day so
 * distinct-developer counts dedupe; different every day (a daily salt rotates) so it is **not** a
 * persistent fingerprint. An opaque hash string — the derivation lives in the reference emitter, the shape
 * is fixed here. Never a stable machine id, never reversible to a device.
 */
export type SaltedDailyInstallId = string;

/**
 * One anonymized dev-action metric — the fixed, closed metric set (#1797 / #1849). **No free-form
 * property bag** (unlike `AnalyticsProperties`) precisely so the channel cannot carry PII: every field is
 * a low-cardinality, non-identifying dimension.
 */
export interface DevMetricEvent {
  /** The command run, from the closed vocabulary. */
  readonly command: DevCommand;
  /** Process exit code (`0` = success). */
  readonly exitCode: number;
  /** CLI / platform version string, e.g. `'1.4.2'`. */
  readonly version: string;
  /** OS platform, e.g. `'darwin'` / `'linux'` / `'win32'`. */
  readonly os: string;
  /** CPU architecture, e.g. `'arm64'` / `'x64'`. */
  readonly arch: string;
  /** Whether the run was in CI (a bare boolean — never the CI vendor or repo). */
  readonly ci: boolean;
  /** ISO-8601 timestamp of the action. */
  readonly timestamp: string;
  /** The salted rotating-daily install-id (#1797 Fork-2) attached by the emitter. */
  readonly installId: SaltedDailyInstallId;
}

/**
 * The dedicated **platform sink** contract (#1797 Fork-1 forced invariant). Mirrors the analytics
 * fire-and-forget ruling: `record()` returns `void` — emitting a metric is advisory, never a decision the
 * caller awaits — so there is no `assert*` and no answer to validate. A concrete platform sink (the
 * hosted aggregation endpoint, a later maturity-gated item) is swapped in through DI; absent one the
 * native-first floor drops silently.
 */
export interface DevMetricsSink {
  /** Name the sink for registration/diagnostics (mirrors `CustomTracker.key`). */
  readonly key: string;
  /** *What* — record one anonymized dev-action metric. Fire-and-forget; never throws on "no backend". */
  record(event: DevMetricEvent): void;
}

/**
 * The tri-state consent value (#1797 Fork-3, opt-IN). `'unset'` is the default and resolves to **do not
 * emit** — no data flows until the developer affirmatively `'granted'`. A single env-var/flag escape and
 * a first-run prompt drive the transition (both in the reference emitter). The enterprise-policy
 * precedence layer is intentionally absent — it is a separate, out-of-scope item.
 */
export type DevMetricsConsent = 'unset' | 'granted' | 'denied';
