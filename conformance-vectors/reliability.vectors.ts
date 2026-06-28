/**
 * reliability conformance-vector suite (#1919, cascade #1294) — the reliability (error-recovery) protocol's
 * behavioral corpus. Slice 2 of the reliability relocation: WE owns the build-agnostic vectors, FUI owns the
 * runtime (`fui:reliability`, relocated #1916) + the binding (`reliabilityConformance.ts`) that drives it;
 * the neutral runner lives in `plateau:src/conformance-engine/conformanceVectors.ts`.
 *
 * reliability is a **synchronous-from-the-vector's-view** standard whose recovery handler returns a
 * structured **`RecoveryResult`** object (the registry walks handlers first-accept-wins and returns the first
 * non-null result, or `null` when all decline). Per the #1816 ruling its observable is judged by the
 * **`deep-equal`** matcher over that returned object — outcome + disposition + phase + delay/reason — and the
 * `null` no-recovery case. The vectors judge only the returned `RecoveryResult` read through the binding —
 * never a handler internal. The contract it judges stays WE's `@webeverything/contracts/reliability`.
 */
import type { ConformanceVectorSuite } from './schema.js';

const CONTRACT = '@webeverything/contracts/reliability';

export const reliabilitySuite: ConformanceVectorSuite = {
  standard: 'reliability',
  contract: CONTRACT,
  vectors: [
    {
      // First-accept-wins: a declining handler (returns null) is skipped; the next handler owns the recovery.
      id: 'reliability/registry/first-accept-wins-after-decline',
      contract: CONTRACT,
      description: 'A handler returning null declines; the registry delegates to the next accepting handler.',
      steps: [
        { do: 'defineHandler', key: 'decliner', result: null },
        { do: 'defineHandler', key: 'retrier', result: { outcome: 'retry', disposition: 'transient', phase: 'retrying', delay: 1000 } },
        { do: 'recover', error: 'net-timeout', attempt: 1 },
      ],
      expect: {
        result: { outcome: 'retry', disposition: 'transient', phase: 'retrying', delay: 1000 },
        matchers: { result: 'deep-equal' },
      },
      observeVia: ['result'],
    },
    {
      // Priority order: two handlers both accept; the earlier-registered one wins (short-circuits the walk).
      id: 'reliability/registry/priority-first-registered-wins',
      contract: CONTRACT,
      description: 'When two handlers both accept, the first registered (priority order) owns the recovery.',
      steps: [
        { do: 'defineHandler', key: 'first', result: { outcome: 'fallback', disposition: 'terminal' } },
        { do: 'defineHandler', key: 'second', result: { outcome: 'retry', disposition: 'transient' } },
        { do: 'recover', error: 'server-500', attempt: 2 },
      ],
      expect: {
        result: { outcome: 'fallback', disposition: 'terminal' },
        matchers: { result: 'deep-equal' },
      },
      observeVia: ['result'],
    },
    {
      // Queued/deferred recovery: the handler takes ownership to replay later (offline queue).
      id: 'reliability/outcome/queued-deferred',
      contract: CONTRACT,
      description: 'A queued recovery returns outcome:queued with deferred disposition and a queued phase.',
      steps: [
        { do: 'defineHandler', key: 'offline-queue', result: { outcome: 'queued', disposition: 'deferred', phase: 'queued' } },
        { do: 'recover', error: 'offline', attempt: 1 },
      ],
      expect: {
        result: { outcome: 'queued', disposition: 'deferred', phase: 'queued' },
        matchers: { result: 'deep-equal' },
      },
      observeVia: ['result'],
    },
    {
      // Abort: an unrecoverable failure — the handler owns it but gives up, carrying a reason.
      id: 'reliability/outcome/abort-terminal',
      contract: CONTRACT,
      description: 'An abort outcome carries a terminal disposition and a reason.',
      steps: [
        { do: 'defineHandler', key: 'giver-upper', result: { outcome: 'abort', disposition: 'terminal', reason: 'unrecoverable' } },
        { do: 'recover', error: 'fatal', attempt: 5 },
      ],
      expect: {
        result: { outcome: 'abort', disposition: 'terminal', reason: 'unrecoverable' },
        matchers: { result: 'deep-equal' },
      },
      observeVia: ['result'],
    },
    {
      // No handler registered (or all decline) → the registry returns null, the unrecovered signal.
      id: 'reliability/registry/no-handler-returns-null',
      contract: CONTRACT,
      description: 'An empty registry recovers nothing — recover() returns null.',
      steps: [
        { do: 'recover', error: 'whatever', attempt: 1 },
      ],
      expect: { result: null, matchers: { result: 'deep-equal' } },
      observeVia: ['result'],
    },
  ],
};

export default reliabilitySuite;
