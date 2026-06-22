/**
 * Trainable-judge feedback corpus — the **pure-contract half** (#1580, epic #1552, ruled by #1553).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it can become the
 * `@webeverything/contracts/trainable-judge` entry (#872/#874) that the impl side depends on. Per
 * we:docs/agent/platform-decisions.md#trainable-judge ruling 4, **WE owns only this contract**; the corpus
 * store (#1581), learning mechanism (#1583), regression benchmark (#1582), and #490 distillation are
 * **Plateau impl** (#1282 — WE holds zero executable). The explorer dev-tool produces the signal and hosts
 * the seam from its Plateau-side tier; only outputs and this schema cross the boundary.
 *
 * This schema is the **never-lose asset**: a model-agnostic corpus of `{frozen frame, domSnapshot, stateId,
 * verdict, anchor, label vocab}`. Embeddings are a **re-derivable cache** keyed `(encoder-id, frame)`, never
 * stored as the asset — swapping the judge agent ⇒ re-embed + retrain, **zero data loss** (the zero-lock-in
 * seam extended from inference to training, #1553 ruling 3). It seeds the #489 frame/verdict pairs and is the
 * **train/benchmark split point** (#1582's held-out benchmark is train-disjoint).
 *
 * Two rulings are encoded here, not redecided downstream (#1553 ruling 1):
 *  - **Two composable feedback channels, both captured.** A {@link VerdictLabel} on a candidate trains
 *    precision + severity; a {@link MissedIssueLabel} (a human authors a finding the judge never flagged) is
 *    the **only** channel that trains **recall**. Verdict-only is a strict subset that caps the perceptual
 *    ceiling — so the corpus captures both as a discriminated union ({@link FeedbackLabel}).
 *  - **Composite label anchor.** The frozen-frame corpus is keyed on `stateId` for eval/training (no spatial
 *    replay); missed-issue authoring additionally carries a {@link SpatialAnchor} — `stateId` gates the match,
 *    then **bbox primary, a11y-role/text tiebreak, DOM-path debug-only**.
 *
 * Signal shapes mirror the explorer's own (the FUI→WE arrow): `stateId` is the #1168 DOM signature
 * (`domSignature`), `domSnapshot` mirrors `AdvisoryJudgeInput.domSnapshot`, {@link BBox} mirrors the Tier-2
 * `VisionRegion.box`, and {@link JudgeSeverity} extends the explorer's `Severity` with the advisory tier.
 */

/** Issue severity — the explorer's `'error' | 'warn'` gate vocab plus the judge's non-gating `'advisory'`. */
export type JudgeSeverity = 'error' | 'warn' | 'advisory';

/** A train/benchmark split tag — the corpus *is* the split point; the #1582 benchmark must be train-disjoint. */
export type CorpusSplit = 'train' | 'benchmark';

/** One entry in the controlled label vocabulary — the issue categories a verdict/missed-issue draws from. */
export interface CorpusLabelDef {
  /** Stable machine id (referenced by {@link FeedbackLabel.labels}); never renumbered once published. */
  readonly id: string;
  /** Human-facing title. */
  readonly title: string;
  readonly description?: string;
}

/**
 * The label vocabulary — versioned and **open** (intents-open-design): a custom vocabulary must coexist, so
 * the meta-schema is standardized, not a frozen list. Each {@link CorpusRecord} pins the `version` it labeled
 * against so a vocab evolution never silently re-interprets old labels.
 */
export interface LabelVocabulary {
  readonly version: string;
  readonly labels: readonly CorpusLabelDef[];
}

/** An axis-aligned pixel box (origin top-left), mirroring the Tier-2 `VisionRegion.box` shape. */
export interface BBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * A content-addressed reference to the frozen-frame PNG bytes — portable + dedupable. The bytes are the
 * asset; the store (#1581) owns on-disk layout, so `path` is store-relative and optional. `hash` is also the
 * `frame` half of the re-derivable embedding cache key ({@link EmbeddingCacheKey}).
 */
export interface FrameRef {
  /** Content hash of the PNG bytes — the portable identity, decoupled from any store path. */
  readonly hash: string;
  readonly mediaType: 'image/png';
  /** Store-relative path, if materialized; the store owns its layout (#1581). */
  readonly path?: string;
}

/**
 * The frozen capture for one labeled state — the model-agnostic, replay-free unit keyed by `stateId`. Holds
 * the PNG ({@link FrameRef}) and the serialized DOM text (no spatial replay needed for eval/training).
 */
export interface FrozenFrame {
  /** The #1168 DOM signature of the state — gates label matching; equal `stateId` means "the same state". */
  readonly stateId: string;
  /** The frozen-frame PNG (primary perceptual modality). */
  readonly frame: FrameRef;
  /** Serialized DOM snapshot (text fallback modality; mirrors `AdvisoryJudgeInput.domSnapshot`). */
  readonly domSnapshot: string;
  /** The page URL the state was captured at (provenance). */
  readonly url?: string;
  /** Capture viewport in CSS pixels — the coordinate frame {@link BBox} anchors resolve against. */
  readonly viewport?: { readonly w: number; readonly h: number };
  /** ISO-8601 capture timestamp (provenance only; never a match key). */
  readonly capturedAt?: string;
}

/**
 * The composite spatial anchor for missed-issue authoring. `stateId` (on the {@link FrozenFrame}) gates the
 * match; within a state the anchor resolves **bbox primary, a11y-role/text tiebreak, DOM-path debug-only** —
 * the precedence is the contract, not the consumer's choice.
 */
export interface SpatialAnchor {
  /** Primary anchor: the offending region, in the {@link FrozenFrame.viewport} coordinate frame. */
  readonly bbox: BBox;
  /** Tiebreak: the accessible role + name of the anchored element. */
  readonly a11y?: { readonly role?: string; readonly name?: string };
  /** Debug-only: a DOM path to the element. Brittle across renders — never the primary match key. */
  readonly domPath?: string;
}

/**
 * Channel 1 — a verdict on a candidate the judge flagged. Trains **precision + severity**. Keyed by `stateId`
 * on the enclosing {@link CorpusRecord.frame}; no spatial anchor (the candidate already carries its locus).
 */
export interface VerdictLabel {
  readonly channel: 'verdict';
  /** The judge candidate this verdict is about (a stable ref into the run's flagged findings). */
  readonly candidateRef: string;
  /** Whether the flagged candidate was a real issue (precision signal). */
  readonly verdict: 'true-positive' | 'false-positive';
  /** The corrected severity for a true positive (severity signal); omitted for a false positive. */
  readonly severity?: JudgeSeverity;
  /** Label ids ({@link CorpusLabelDef.id}) refining the category. */
  readonly labels?: readonly string[];
  readonly note?: string;
}

/**
 * Channel 2 — a human-authored issue the judge **never flagged**. The **only** channel that trains **recall**
 * (#1553 ruling 1). Carries the composite {@link SpatialAnchor} so the missed region is locatable.
 */
export interface MissedIssueLabel {
  readonly channel: 'missed-issue';
  /** Where in the state the missed issue lives. */
  readonly anchor: SpatialAnchor;
  readonly severity: JudgeSeverity;
  /** Label ids ({@link CorpusLabelDef.id}) categorizing the issue. */
  readonly labels: readonly string[];
  /** The authored description of the missed issue. */
  readonly detail: string;
}

/** The two composable feedback channels as a discriminated union (discriminant: `channel`). */
export type FeedbackLabel = VerdictLabel | MissedIssueLabel;

/**
 * One durable corpus record — a unit of the never-lose asset. **Model-agnostic by construction**: it carries
 * no embeddings and no model id (those live only in the re-derivable cache, {@link EmbeddingCacheKey}).
 */
export interface CorpusRecord {
  /** Stable record id. */
  readonly id: string;
  /** The frozen state this label is about. */
  readonly frame: FrozenFrame;
  /** The feedback — a verdict on a candidate or an authored missed issue. */
  readonly label: FeedbackLabel;
  /** The {@link LabelVocabulary.version} this record was labeled against. */
  readonly vocabularyVersion: string;
  /** Which split this record belongs to; the benchmark split must stay train-disjoint (#1582). */
  readonly split?: CorpusSplit;
  /** Who authored the label (provenance). */
  readonly author?: string;
  /** ISO-8601 authoring timestamp (provenance). */
  readonly createdAt?: string;
}

/**
 * The re-derivable embedding cache key — **NEVER stored as the asset** (#1553 ruling 3). Keyed
 * `(encoder-id, frame)`: a cache entry is reconstructable from the corpus at any time, so swapping the
 * encoder/judge agent invalidates the cache without touching the {@link CorpusRecord} asset (zero data loss).
 */
export interface EmbeddingCacheKey {
  /** The vision-encoder identity (e.g. a DaViT build id); swapping it ⇒ re-embed, never re-label. */
  readonly encoderId: string;
  /** The {@link FrameRef.hash} of the frozen frame the embedding was derived from. */
  readonly frameHash: string;
}
