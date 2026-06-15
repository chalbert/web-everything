/**
 * A `web-features`-backed {@link BaselineLookup} for the edge venue (#698, carved from #479).
 *
 * The edge I/O layer ({@link ./edge-io}) derives a client's Baseline epoch from an **injected** lookup so
 * the pure parser never depends on a data package. This module is that injection: it maps a browser
 * brand+version (from the structured `Sec-CH-UA*` hints) to the Baseline epoch (year) the version meets,
 * using the `web-features` dataset — a **data-only** dependency (no runtime, no lock-in; the contract is
 * the {@link BaselineLookup} function type, not this package).
 *
 * *Meets* is defined honestly against the dataset: a browser version V of brand B meets Baseline year Y
 * iff it supports **every** feature that reached Baseline (newly- or widely-available) on or before the
 * end of year Y. Because the Baseline-≤Y set only grows with Y, the per-browser required version is
 * monotonic in Y, so the epoch a version meets is the highest year whose required version is ≤ V. A
 * version too old to satisfy even the earliest year (or an unrecognised brand) yields `undefined` — the
 * parser then leaves `baselineYear` unset rather than fabricating support.
 */
import { features } from 'web-features';
import type { BaselineLookup, UaBrand } from './edge-io.js';

/** `web-features` `status.support` browser keys we resolve a Client-Hint brand onto. */
type BrowserKey =
  | 'chrome'
  | 'chrome_android'
  | 'edge'
  | 'firefox'
  | 'firefox_android'
  | 'safari'
  | 'safari_ios';

/** Brand string (lower-cased) → the desktop `web-features` browser key. */
const BRAND_TO_KEY: Record<string, BrowserKey> = {
  chromium: 'chrome',
  'google chrome': 'chrome',
  chrome: 'chrome',
  'microsoft edge': 'edge',
  edge: 'edge',
  firefox: 'firefox',
  'mozilla firefox': 'firefox',
  safari: 'safari',
};

/** Map a brand+platform to the mobile variant key when the platform is a phone OS. */
function resolveBrowserKey(brand: UaBrand, platform?: string): BrowserKey | undefined {
  const base = BRAND_TO_KEY[brand.brand.trim().toLowerCase()];
  if (!base) return undefined;
  const p = platform?.toLowerCase();
  if (p === 'android') {
    if (base === 'chrome') return 'chrome_android';
    if (base === 'firefox') return 'firefox_android';
  }
  if ((p === 'ios' || p === 'ipados') && base === 'safari') return 'safari_ios';
  return base;
}

/** Parse a `baseline_low_date` (`"2024-03-19"` or the `"≤2020-…"` floor form) to its year. */
function baselineYear(date: string | undefined): number | undefined {
  if (!date) return undefined;
  const m = /(\d{4})/.exec(date);
  return m ? Number(m[1]) : undefined;
}

/**
 * Parse a version (full `"130.0.x"`, major `"130"`, `"17.4"`, or the `"≤15"` available-at-or-before form)
 * to a comparable number. The `≤` prefix means the feature shipped *by* that version (and earlier), so the
 * leading number is a safe upper bound on the required version — extract it rather than dropping to `NaN`.
 */
function toVersionNumber(v: string | number | undefined): number {
  if (typeof v === 'number') return v;
  if (!v) return NaN;
  const m = /(\d+(?:\.\d+)?)/.exec(v);
  return m ? Number.parseFloat(m[1]) : NaN;
}

/**
 * Precompute, per browser key, the monotonic `requiredVersion[year]` — the minimum browser version that
 * supports the full Baseline-≤year feature set. `Infinity` means the browser is missing a feature in
 * that year's set (so it can never meet that year or any later one). Built once and closed over.
 */
function buildRequiredVersions(): { years: number[]; required: Record<BrowserKey, Map<number, number>> } {
  const KEYS: BrowserKey[] = [
    'chrome',
    'chrome_android',
    'edge',
    'firefox',
    'firefox_android',
    'safari',
    'safari_ios',
  ];
  // Per browser, the max support version required by features newly Baseline in each year.
  const perYearMax: Record<BrowserKey, Map<number, number>> = Object.fromEntries(
    KEYS.map((k) => [k, new Map<number, number>()]),
  ) as Record<BrowserKey, Map<number, number>>;
  const yearSet = new Set<number>();

  for (const feature of Object.values(features)) {
    const status = (feature as { status?: { baseline?: unknown; baseline_low_date?: string; support?: Record<string, string> } }).status;
    if (!status || (status.baseline !== 'low' && status.baseline !== 'high')) continue;
    const year = baselineYear(status.baseline_low_date);
    if (year === undefined) continue;
    yearSet.add(year);
    const support = status.support ?? {};
    for (const key of KEYS) {
      const v = toVersionNumber(support[key]);
      const bucket = perYearMax[key];
      // Missing support for a Baseline feature ⇒ this browser can never fully meet `year` ⇒ Infinity.
      const contribution = Number.isNaN(v) ? Infinity : v;
      bucket.set(year, Math.max(bucket.get(year) ?? 0, contribution));
    }
  }

  const years = [...yearSet].sort((a, b) => a - b);
  const required: Record<BrowserKey, Map<number, number>> = Object.fromEntries(
    KEYS.map((k) => [k, new Map<number, number>()]),
  ) as Record<BrowserKey, Map<number, number>>;
  for (const key of KEYS) {
    let running = 0;
    for (const year of years) {
      running = Math.max(running, perYearMax[key].get(year) ?? 0);
      required[key].set(year, running);
    }
  }
  return { years, required };
}

/**
 * Build a {@link BaselineLookup} closing over the precomputed `web-features` tables. Construct once
 * (e.g. at edge-venue startup) and inject into {@link parseClientHints}.
 */
export function createBaselineLookup(): BaselineLookup {
  const { years, required } = buildRequiredVersions();
  return (brand: UaBrand, platform?: string): number | undefined => {
    const key = resolveBrowserKey(brand, platform);
    if (!key) return undefined;
    const version = toVersionNumber(brand.version) || brand.major;
    if (Number.isNaN(version)) return undefined;
    const table = required[key];
    let met: number | undefined;
    // Years are ascending and required[] is monotonic — the highest year whose bar we clear is the epoch.
    for (const year of years) {
      const bar = table.get(year);
      if (bar !== undefined && version >= bar) met = year;
    }
    return met;
  };
}

/** A ready-to-inject default instance (the tables are immutable; one instance is enough). */
export const baselineLookup: BaselineLookup = createBaselineLookup();
