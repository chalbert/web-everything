/**
 * @file sessionReplayEnvelope.ts
 * @description Web Traces — the **session-replay envelope** protocol contract (#992 build, #1155).
 *
 * Type-only contract (no runtime / no impl — `@webeverything` ships contracts only; npm scope mirrors
 * layer). The envelope is the thin **binding/ordering** artifact webtraces owns per the #992 ratification
 * (Fork 2 = webtraces): an ordered session of webtraces spans plus **correlated references** to three
 * artifacts whose schemas it redefines NONE of —
 *   - the webcontexts snapshot (`<script type="context">` JSON, the replay starting state);
 *   - the webstates `ChangeRecord` journal (the determinism anchor — Fork 1 = A, state-diff re-application);
 *   - the webevents-identified actions (correlation/comprehension only — NOT load-bearing for
 *     journaled-state determinism).
 *
 * Per the #992 amendment the envelope MUST carry:
 *   1. a **snapshot↔journal consistency precondition** — the snapshot ref includes a version/hash that the
 *      journal asserts it applies onto; a replayer refuses (or flags) a drifted snapshot rather than
 *      applying diffs blindly (see {@link SnapshotRef.version} / {@link SessionReplayEnvelope.appliesOntoVersion});
 *   2. an explicit **off-journal-state-out-of-scope boundary** ({@link SessionReplayEnvelope.offJournalBoundary})
 *      — non-journaled state (imperative DOM focus/scroll, refs, non-store locals) is out of replay scope by
 *      contract; the optional behavioral-replay mode (B — re-fold actions through handlers) is the documented
 *      escape hatch, and there webevents identity IS load-bearing ({@link ReplayMode}).
 *
 * The journal PAYLOAD schema stays owned by webstates and is referenced, not absorbed — these are reference
 * shapes (id + version), never re-declarations of `ChangeRecord` / the context snapshot format.
 */

/**
 * Determinism mode for a replay run (#992 Fork 1).
 *   - `journaled-state` (default, anchor A) — re-apply recorded `ChangeRecord`s to the snapshot, executing
 *     NO application JavaScript; deterministic over journaled state only. Event identity is correlation-only.
 *   - `behavioral` (optional B, escape hatch) — re-fold recorded actions through their handlers; webevents
 *     injector-scoped identity is load-bearing, and determinism holds only if handlers are pure/timing-free.
 */
export type ReplayMode = 'journaled-state' | 'behavioral';

/**
 * A reference to the webcontexts snapshot the session starts from. Carries the consistency precondition:
 * `version` (and optional `hash`) is the token the journal asserts it applies ONTO (mirrors the existing
 * `ChangeRecord.version` causal/optimistic-concurrency token). Never inlines the snapshot JSON — the format
 * stays owned by webcontexts.
 */
export interface SnapshotRef {
  /** Opaque id of the serialized webcontexts snapshot (e.g. a content-addressed key or `<script>` id). */
  readonly snapshotId: string;
  /**
   * The snapshot version/hash the journal applies onto — the consistency precondition (#992 amendment §1).
   * A replayer compares this against {@link SessionReplayEnvelope.appliesOntoVersion} and refuses/flags drift.
   */
  readonly version: string | number;
  /** Optional stronger integrity hash of the snapshot bytes (belt-and-braces over `version`). */
  readonly hash?: string;
}

/**
 * A reference to the webstates `ChangeRecord` journal segment that drives deterministic replay. The journal
 * payload schema is webstates-owned; this is a pointer + the count/range the envelope orders, never a copy.
 */
export interface JournalRef {
  /** Opaque id of the webstates change-journal this envelope replays. */
  readonly journalId: string;
  /**
   * The snapshot version this journal segment asserts it applies onto — MUST equal {@link SnapshotRef.version}
   * for a consistent envelope (the precondition a replayer enforces).
   */
  readonly appliesOntoVersion: string | number;
  /** Number of `ChangeRecord`s in the referenced segment (ordering/length sanity, not the payload). */
  readonly recordCount: number;
}

/**
 * One ordered entry in the replay timeline: a webtraces span, optionally correlated to a webevents-identified
 * action (the comprehension layer) and to the journal records it caused. References only — no payload copies.
 */
export interface ReplayTimelineEntry {
  /** The webtraces span id (W3C/OTel-aligned) — the ordering key of the timeline. */
  readonly spanId: string;
  /** Monotonic sequence index within the session (the canonical replay order). */
  readonly seq: number;
  /**
   * The webevents-identified action that opened this span, if any — `traceparent`-correlated. Correlation
   * only (Fork 1 = A): present for comprehension and for the optional behavioral mode, not for determinism.
   */
  readonly action?: {
    /** The webevents typed-event identity (injector-resolved class name / token). */
    readonly eventType: string;
    /** The `traceparent` linking this action to its span (already wired in webstates `ChangeSource`). */
    readonly traceparent: string;
  };
  /** Ids of the journal `ChangeRecord`s correlated to this span (which action caused which diffs). */
  readonly journalRecordIds?: ReadonlyArray<string>;
}

/**
 * The session-replay envelope (#992). A thin, ordered binding over a snapshot, a journal, and a span
 * timeline — the only NEW substance is the ordering/correlation; every referenced schema stays with its
 * owning project.
 */
export interface SessionReplayEnvelope {
  /** Stable id of this replay session. */
  readonly sessionId: string;
  /** Schema/contract version of the envelope itself (not the snapshot's). */
  readonly envelopeVersion: 1;
  /** Determinism mode (#992 Fork 1). Defaults to `journaled-state` (anchor A). */
  readonly mode: ReplayMode;
  /** The starting webcontexts snapshot + its consistency precondition (#992 amendment §1). */
  readonly snapshot: SnapshotRef;
  /** The webstates change-journal that deterministically drives replay. */
  readonly journal: JournalRef;
  /**
   * The snapshot version this envelope's journal applies onto. MUST equal `snapshot.version` and
   * `journal.appliesOntoVersion`; a replayer treats any mismatch as drift (refuse or flag — never apply blind).
   */
  readonly appliesOntoVersion: string | number;
  /** The ordered span timeline with action/journal correlation. */
  readonly timeline: ReadonlyArray<ReplayTimelineEntry>;
  /**
   * The explicit off-journal-state boundary (#992 amendment §2): the named state classes this envelope
   * does NOT capture or replay (imperative DOM focus/scroll, refs, non-store locals). Documentation +
   * contract boundary, surfaced to the replayer so it can disclose what it cannot reproduce.
   */
  readonly offJournalBoundary: OffJournalBoundary;
}

/** The contractual statement of what a `journaled-state` replay deliberately does NOT reproduce. */
export interface OffJournalBoundary {
  /** Human-facing note describing the off-journal scope exclusion. */
  readonly note: string;
  /** Named off-journal state classes excluded from replay (e.g. `dom-focus`, `scroll`, `refs`). */
  readonly excludes: ReadonlyArray<string>;
  /** The escape hatch for faithful off-journal repro — the optional behavioral mode (B). */
  readonly escapeHatch: 'behavioral-replay';
}

/** A malformed/inconsistent envelope a replayer would mis-run (drift, ordering, or boundary violations). */
export class SessionReplayEnvelopeError extends Error {
  constructor(why: string) {
    super(`Session-replay envelope is invalid: ${why}`);
    this.name = 'SessionReplayEnvelopeError';
  }
}

/**
 * Dependency-free structural validator for a {@link SessionReplayEnvelope} — the WE-owned half (mirrors
 * `conformance-vectors/schema.ts:assertConformanceSuite`). Asserts the two #992-amendment invariants a
 * replayer relies on:
 *   - the **consistency precondition** — `snapshot.version`, `journal.appliesOntoVersion`, and the envelope's
 *     `appliesOntoVersion` all agree (the drift refusal the amendment mandates);
 *   - a well-formed, strictly-ordered timeline and a present off-journal boundary with the documented hatch.
 * It validates SHAPE + the cross-reference preconditions only — it never executes the journal (that is a
 * replayer's job, owned downstream per #899/#091).
 */
export function assertSessionReplayEnvelope(env: SessionReplayEnvelope): SessionReplayEnvelope {
  if (!env || typeof env !== 'object') throw new SessionReplayEnvelopeError('not an object');
  if (!env.sessionId) throw new SessionReplayEnvelopeError('`sessionId` is required');
  if (env.envelopeVersion !== 1) throw new SessionReplayEnvelopeError('unsupported `envelopeVersion`');
  if (env.mode !== 'journaled-state' && env.mode !== 'behavioral')
    throw new SessionReplayEnvelopeError(`unknown replay \`mode\` "${env.mode}"`);
  if (!env.snapshot?.snapshotId) throw new SessionReplayEnvelopeError('`snapshot.snapshotId` is required');
  if (env.snapshot.version === undefined || env.snapshot.version === null)
    throw new SessionReplayEnvelopeError('`snapshot.version` is required (the consistency precondition)');
  if (!env.journal?.journalId) throw new SessionReplayEnvelopeError('`journal.journalId` is required');

  // #992 amendment §1 — snapshot↔journal consistency precondition: all three version tokens MUST agree.
  if (
    env.snapshot.version !== env.journal.appliesOntoVersion ||
    env.snapshot.version !== env.appliesOntoVersion
  ) {
    throw new SessionReplayEnvelopeError(
      `snapshot↔journal drift: snapshot.version=${String(env.snapshot.version)}, ` +
        `journal.appliesOntoVersion=${String(env.journal.appliesOntoVersion)}, ` +
        `appliesOntoVersion=${String(env.appliesOntoVersion)} — a replayer must refuse or flag, never apply blind`,
    );
  }

  if (!Array.isArray(env.timeline)) throw new SessionReplayEnvelopeError('`timeline` must be an array');
  const seqs = new Set<number>();
  let prevSeq = -Infinity;
  for (const entry of env.timeline) {
    if (!entry.spanId) throw new SessionReplayEnvelopeError('a timeline entry is missing `spanId`');
    if (typeof entry.seq !== 'number') throw new SessionReplayEnvelopeError(`span "${entry.spanId}" has a non-numeric \`seq\``);
    if (seqs.has(entry.seq)) throw new SessionReplayEnvelopeError(`duplicate timeline \`seq\` ${entry.seq}`);
    if (entry.seq < prevSeq) throw new SessionReplayEnvelopeError(`timeline is not in ascending \`seq\` order at ${entry.seq}`);
    seqs.add(entry.seq);
    prevSeq = entry.seq;
  }

  // #992 amendment §2 — explicit off-journal boundary with the documented behavioral escape hatch.
  if (!env.offJournalBoundary || typeof env.offJournalBoundary !== 'object')
    throw new SessionReplayEnvelopeError('`offJournalBoundary` is required (the off-journal-state-out-of-scope boundary)');
  if (!Array.isArray(env.offJournalBoundary.excludes))
    throw new SessionReplayEnvelopeError('`offJournalBoundary.excludes` must be an array');
  if (env.offJournalBoundary.escapeHatch !== 'behavioral-replay')
    throw new SessionReplayEnvelopeError('`offJournalBoundary.escapeHatch` must be "behavioral-replay"');

  return env;
}
