/**
 * Exemplar conformance-vector suite (#1016) — `validator-resolution` (#224), the worked example #899 used
 * to specify the KIT. This is the **pattern-establishing** suite: the first standard to ship behavioral
 * vectors, demonstrating the shape every other standard's suite follows (`conformance-vectors/schema.ts`).
 *
 * The vectors judge only the **observable** outcome read through the platform surface (validity / ARIA /
 * rendered message) — never the impl's generation token / `AbortController` / debounce. A component is
 * conformant if it produces these observations, however it is built (the #506/#899 golden-vectors model).
 * The temporal vector (`stale-async-dropped`) is the one that *needs* the driver's controllable clock.
 */
import type { ConformanceVectorSuite } from './schema.js';

export const validatorResolutionSuite: ConformanceVectorSuite = {
  standard: 'validator-resolution',
  contract: '@webeverything/validator-resolution',
  vectors: [
    {
      // The #899 canonical vector, verbatim: a later input supersedes an in-flight async validation, so
      // the stale result that settles last must be dropped — checkable only by running time.
      id: 'validator-resolution/versioning/stale-async-dropped',
      contract: '@webeverything/validator-resolution',
      description:
        'A stale async generation that settles after a newer input must never reach the observable surface.',
      steps: [
        { do: 'setInput', atMs: 0, field: 'email', value: 'a@b.com' },
        { do: 'beginAsync', atMs: 0, token: 'v1', settlesInMs: 200, result: { state: 'invalid', message: 'taken' } },
        { do: 'setInput', atMs: 50, field: 'email', value: 'c@d.com' },
        { do: 'beginAsync', atMs: 50, token: 'v2', settlesInMs: 80, result: { state: 'valid' } },
      ],
      expect: {
        finalState: 'valid',
        neverObserved: [{ renderedMessage: 'taken' }],
        aria: { 'aria-invalid': 'false' },
      },
      observeVia: ['aria', 'renderedMessage', 'validity'],
    },
    {
      // The non-temporal baseline: a single async resolution surfaces its result.
      id: 'validator-resolution/versioning/single-async-applied',
      contract: '@webeverything/validator-resolution',
      description: 'A lone async validation that settles with no superseding input applies its result.',
      steps: [
        { do: 'setInput', atMs: 0, field: 'email', value: 'taken@b.com' },
        { do: 'beginAsync', atMs: 0, token: 'v1', settlesInMs: 100, result: { state: 'invalid', message: 'taken' } },
      ],
      expect: {
        finalState: 'invalid',
        aria: { 'aria-invalid': 'true' },
        renderedMessage: 'taken',
      },
      observeVia: ['aria', 'renderedMessage', 'validity'],
    },
    {
      // Cancellation strategy: a superseded generation is abandoned, not merely ordered — the newer
      // valid result stands and the older invalid one is never observed even though it began first.
      id: 'validator-resolution/cancellation/superseded-generation-abandoned',
      contract: '@webeverything/validator-resolution',
      description: 'Under the cancellation resolution, a superseded in-flight generation produces no observable.',
      steps: [
        { do: 'useResolution', atMs: 0, key: 'cancellation' },
        { do: 'setInput', atMs: 0, field: 'email', value: 'first@b.com' },
        { do: 'beginAsync', atMs: 0, token: 'g1', settlesInMs: 150, result: { state: 'invalid', message: 'first-bad' } },
        { do: 'setInput', atMs: 30, field: 'email', value: 'second@b.com' },
        { do: 'beginAsync', atMs: 30, token: 'g2', settlesInMs: 40, result: { state: 'valid' } },
      ],
      expect: {
        finalState: 'valid',
        neverObserved: [{ renderedMessage: 'first-bad' }],
        aria: { 'aria-invalid': 'false' },
      },
      observeVia: ['aria', 'renderedMessage', 'validity'],
    },
  ],
};

export default validatorResolutionSuite;
