/**
 * Behavioral conformance-vector suite — `session-replay-envelope` (#1155, the #992 build).
 *
 * Judges only the **observable** outcome a conformant replayer must produce against the webtraces
 * session-replay envelope contract (`we:plugs/webtraces/sessionReplayEnvelope.ts`) — never impl internals.
 * The two #992-amendment invariants are the load-bearing cases:
 *   1. the **snapshot↔journal consistency precondition** — a drifted envelope (version mismatch) must be
 *      REFUSED or FLAGGED, never applied blind (the `replayOutcome: refused-drift` observable);
 *   2. the **off-journal-state boundary** — off-journal state (focus/scroll/refs) must be observably
 *      DISCLOSED-as-unreproduced under `journaled-state` mode, with `behavioral` as the escape hatch.
 *
 * The driver (downstream — #899/#091) feeds an envelope to a candidate replayer and reads the outcome
 * through the replayer's disclosure surface; these vectors describe the setup + the observable verdict.
 */
import type { ConformanceVectorSuite } from './schema.js';

export const sessionReplayEnvelopeSuite: ConformanceVectorSuite = {
  standard: 'session-replay-envelope',
  contract: '@webeverything/session-replay-envelope',
  vectors: [
    {
      // #992 amendment §1 — the consistency precondition. A journal that asserts it applies onto a different
      // snapshot version than the snapshot carries is DRIFT: a conformant replayer refuses (or flags), it
      // never applies the diffs blindly.
      id: 'session-replay-envelope/precondition/drift-refused',
      contract: '@webeverything/session-replay-envelope',
      description:
        'A snapshot↔journal version mismatch is refused/flagged as drift — the replayer never applies diffs blindly.',
      steps: [
        { do: 'loadSnapshot', token: 'snap-A', version: 7 },
        { do: 'loadJournal', token: 'jour-A', appliesOntoVersion: 9 },
        { do: 'replay', mode: 'journaled-state' },
      ],
      expect: {
        finalState: 'refused-drift',
        replayOutcome: 'refused-drift',
        neverObserved: [{ replayOutcome: 'applied' }],
      },
      observeVia: ['replayOutcome', 'diagnostics'],
    },
    {
      // The consistent baseline: matching versions → the journaled-state replay applies deterministically,
      // executing no application JS.
      id: 'session-replay-envelope/precondition/consistent-applied',
      contract: '@webeverything/session-replay-envelope',
      description: 'Matching snapshot/journal versions replay deterministically by re-applying ChangeRecords.',
      steps: [
        { do: 'loadSnapshot', token: 'snap-A', version: 7 },
        { do: 'loadJournal', token: 'jour-A', appliesOntoVersion: 7 },
        { do: 'replay', mode: 'journaled-state' },
      ],
      expect: {
        finalState: 'applied',
        replayOutcome: 'applied',
        executedApplicationJs: false,
      },
      observeVia: ['replayOutcome', 'finalContextState'],
    },
    {
      // #992 amendment §2 — the off-journal boundary. Under journaled-state mode, off-journal state (DOM
      // focus/scroll/refs) is OUT OF SCOPE by contract: the replayer must observably disclose it as
      // not-reproduced rather than silently appearing to restore it.
      id: 'session-replay-envelope/boundary/off-journal-disclosed',
      contract: '@webeverything/session-replay-envelope',
      description:
        'journaled-state replay discloses off-journal state (focus/scroll) as out-of-scope, not silently reproduced.',
      steps: [
        { do: 'loadSnapshot', token: 'snap-B', version: 1 },
        { do: 'loadJournal', token: 'jour-B', appliesOntoVersion: 1 },
        { do: 'recordOffJournal', kind: 'dom-focus' },
        { do: 'replay', mode: 'journaled-state' },
      ],
      expect: {
        finalState: 'applied',
        offJournalReproduced: false,
        disclosedExclusions: ['dom-focus'],
      },
      observeVia: ['diagnostics', 'disclosedExclusions'],
    },
    {
      // The escape hatch (Fork 1 = B as optional mode): behavioral replay re-folds actions through handlers,
      // where webevents action-identity IS load-bearing — so off-journal effects can be reproduced.
      id: 'session-replay-envelope/mode/behavioral-escape-hatch',
      contract: '@webeverything/session-replay-envelope',
      description:
        'behavioral mode re-folds webevents-identified actions through handlers (identity load-bearing), reproducing off-journal effects.',
      steps: [
        { do: 'loadSnapshot', token: 'snap-B', version: 1 },
        { do: 'loadJournal', token: 'jour-B', appliesOntoVersion: 1 },
        { do: 'recordOffJournal', kind: 'dom-focus' },
        { do: 'replay', mode: 'behavioral' },
      ],
      expect: {
        finalState: 'applied',
        offJournalReproduced: true,
        eventIdentityLoadBearing: true,
      },
      observeVia: ['diagnostics', 'finalContextState'],
    },
  ],
};

export default sessionReplayEnvelopeSuite;
