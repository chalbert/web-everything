/**
 * @file webanalytics/index.ts
 * @description Runtime analytics plug (#1012): the live `customTrackers` registry and the native-first
 *   no-op default backend that backs the Analytics protocol seam (#1003). The application tracks against
 *   the `CustomTracker` contract; a concrete backend (Segment / Mixpanel / GA4 — #1013) is swapped in
 *   via DI, so neither the app nor any member intent owns a vendor.
 */
if (typeof window !== 'undefined') {
  console.log('[webanalytics] Module loaded');
}

export { default as CustomTrackerRegistry } from './CustomTrackerRegistry';
export { createDefaultTrackerRegistry, UnknownTrackerError } from './CustomTrackerRegistry';

// The `data-track` declarative emission seam (#1475) — author-facing binding over the tracker sink.
export { default as TrackAttribute, type TrackInteraction } from './TrackAttribute';

// Re-export the analytics-protocol vocabulary (#1003) from one entry point, mirroring the guard
// re-exports: the tracker contract, the event/identity/options surface, and the native-first no-op default.
export {
  type CustomTracker,
  type CustomAnalyticsEvent,
  type CustomAnalyticsIdentity,
  type CustomAnalyticsOptions,
  type AnalyticsTraits,
  type AnalyticsProperties,
  NoopTracker,
} from '../../analytics/provider.js';
