/**
 * analytics conformance-vector suite (#1918, cascade #1294) — the analytics (CustomTracker) protocol's
 * behavioral corpus. Slice 2 of the analytics relocation: WE owns the build-agnostic vectors, FUI owns the
 * runtime (`fui:plugs/webanalytics`, relocated #1915) + the binding (`analyticsConformance.ts`) that drives
 * it; the neutral runner lives in `plateau:src/conformance-engine/conformanceVectors.ts`.
 *
 * analytics is a **synchronous** standard whose provider methods return **`void`** (identify/track/page/
 * group are fire-and-forget). Per the #1816 ruling its only observable is the **recorded-call log** the
 * binding accumulates, judged by the **`predicate`** matcher — routing (an event reaches the resolved
 * tracker), swap-reroute (re-`define`-ing the default reroutes; the old tracker goes quiet), arg-order
 * (`page(category, name)` lands in the Segment slot order), absence (an explicit-key route never touches a
 * sibling), and count (calls accumulate). The vectors judge only the observed log — never a backend internal.
 * The contract it judges stays WE's `@webeverything/contracts/analytics`.
 */
import type { ConformanceVectorSuite } from './schema.js';

const CONTRACT = '@webeverything/contracts/analytics';

export const analyticsSuite: ConformanceVectorSuite = {
  standard: 'analytics',
  contract: CONTRACT,
  vectors: [
    {
      // Routing: a track() through the resolved default tracker is recorded by it — the base routing proof.
      id: 'analytics/routing/track-reaches-default',
      contract: CONTRACT,
      description: 'track() routes to the resolved default tracker and is recorded.',
      steps: [
        { do: 'defineTracker', key: 'rec', asDefault: true },
        { do: 'track', event: 'signup-submitted' },
      ],
      expect: { events: ['signup-submitted'], matchers: { events: 'predicate' } },
      observeVia: ['events'],
    },
    {
      // Swap-reroute: re-define the default — the newer tracker receives the event, the older goes silent.
      id: 'analytics/routing/redefine-default-reroutes',
      contract: CONTRACT,
      description: 'Re-defining the default tracker reroutes subsequent events; the prior default goes quiet.',
      steps: [
        { do: 'defineTracker', key: 'a', asDefault: true },
        { do: 'defineTracker', key: 'b', asDefault: true },
        { do: 'track', event: 'cta-clicked' },
      ],
      expect: { 'events:a': [], 'events:b': ['cta-clicked'], matchers: { 'events:a': 'predicate', 'events:b': 'predicate' } },
      observeVia: ['events:a', 'events:b'],
    },
    {
      // Arg-order: page(category, name) — the Segment slot order is honored (category then name).
      id: 'analytics/page/category-then-name-arg-order',
      contract: CONTRACT,
      description: 'page(category, name) records the category and name in Segment slot order.',
      steps: [
        { do: 'defineTracker', key: 'rec', asDefault: true },
        { do: 'page', category: 'docs', name: 'home' },
      ],
      expect: { pageCategory: 'docs', pageName: 'home', matchers: { pageCategory: 'predicate', pageName: 'predicate' } },
      observeVia: ['pageCategory', 'pageName'],
    },
    {
      // Absence: an explicit-key route reaches only that tracker; a sibling registered tracker stays empty.
      id: 'analytics/routing/explicit-key-spares-siblings',
      contract: CONTRACT,
      description: 'Resolving an explicit tracker key routes only to it; sibling trackers record nothing.',
      steps: [
        { do: 'defineTracker', key: 'a', asDefault: true },
        { do: 'defineTracker', key: 'b' },
        { do: 'track', event: 'paid', viaKey: 'b' },
      ],
      expect: { 'events:a': [], 'events:b': ['paid'], matchers: { 'events:a': 'predicate', 'events:b': 'predicate' } },
      observeVia: ['events:a', 'events:b'],
    },
    {
      // Count: successive track() calls accumulate on the resolved tracker's log.
      id: 'analytics/routing/calls-accumulate',
      contract: CONTRACT,
      description: 'Successive track() calls accumulate in the recorded-call log (count predicate).',
      steps: [
        { do: 'defineTracker', key: 'rec', asDefault: true },
        { do: 'track', event: 'e1' },
        { do: 'track', event: 'e2' },
        { do: 'track', event: 'e3' },
      ],
      expect: { count: 3, matchers: { count: 'predicate' } },
      observeVia: ['count'],
    },
  ],
};

export default analyticsSuite;
