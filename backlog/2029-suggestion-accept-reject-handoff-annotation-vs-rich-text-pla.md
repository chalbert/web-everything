---
kind: decision
parent: "1399"
status: resolved
preparedDate: "2026-07-01"
dateOpened: "2026-07-01"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#intents-ux-only"
tags: [decision, annotation, rich-text, suggestion, collaborative-editing, aria-1.3, book-candidate, placement]
relatedReport: reports/2026-07-01-2029-suggestion-accept-reject-placement.md
---

# Suggestion accept/reject handoff: annotation vs rich-text (placement)

WAI-ARIA **1.3** (editor's draft Feb 2026) mints `role=suggestion` (alongside `comment` / `mark`), giving the
collaborative suggested-edit lifecycle native grounding. It lands on an open question the shipped
[annotation intent](../src/_data/intents/annotation.json) already flagged and nobody tracks: the `suggestion`
motivation is the only one whose accept/reject **mutates the host document**, so it can't sit in a UX-only
annotation intent that "owns no host mutation." Where does it live? **Ruled 2026-07-02: (b) a standalone
`suggested-edit` contract**, composed by both annotation (suggestion body) and the rich-text Editor Engine
protocol (apply; record-only over read-only hosts). Build filed as
[#2145](2145-author-the-suggested-edit-contract-propose-accept-reject-com.md); rule codified to
[we:docs/agent/platform-decisions.md#intents-ux-only](../docs/agent/platform-decisions.md). The fork was
grounded in a prior-art survey ([`/research/suggestion-accept-reject-ownership/`](/research/suggestion-accept-reject-ownership/)
— who owns the mutation transaction; whether suggestions work over read-only hosts).

The other two new roles are **covered** and file nothing here: `comment` -> annotation `commenting`
motivation; `mark` -> annotation `highlight` disposition (Custom Highlight API). Only `suggestion` exposes an
unowned residual. This is a **placement-only** call — the go/no-go on the *pattern* is settled (ARIA 1.3 mints
the role + Google-Docs/Notion/ProseMirror pervasiveness), so what's open is ownership, not whether it's in
scope.

## Axis framing — the mutation transaction has one owner

The concern decomposes into a **marker/payload** axis (already UX, already owned) and a **mutation-transaction**
axis (technical, unowned):

- The **marker + proposed payload** is the `suggestion` value of annotation's `motivation` dimension
  ([we:src/_data/intents/annotation.json:20](../src/_data/intents/annotation.json) — `motivation.values`
  includes `suggestion`) riding its `surface` dimension (`overlay` | `in-model`,
  [we:src/_data/intents/annotation.json:33-38](../src/_data/intents/annotation.json)). This is settled UX and
  stays on the intent.
- The **accept/reject mutation transaction** is the open residual. annotation is UX-only — its summary owns
  "no anchor machinery, no host mutation" ([we:src/_data/intents/annotation.json:13](../src/_data/intents/annotation.json))
  and its `researchGaps` literally asks whether accept/reject is "an annotation-intent concern (it mutates the
  host) **or strictly the rich-text model's**? Define the handoff."
  ([we:src/_data/intents/annotation.json:93](../src/_data/intents/annotation.json)).
- But the rich-text **intent** is *also* UX-only: its description's "UX-only -> the engine is a protocol"
  section states the engine that "maintains the content model, **applies operations**, and serializes — is the
  **Editor Engine protocol** / a Technical Configurator concern, **not part of this UX intent**"
  ([we:src/_data/intents/rich-text.json:36](../src/_data/intents/rich-text.json), summary
  [we:src/_data/intents/rich-text.json:11](../src/_data/intents/rich-text.json)). So "rich-text owns the
  mutation" resolves to "the **Editor Engine protocol** owns it" — which is *already a separate composed
  contract*, not the rich-text intent.

A mutation transaction has exactly **one** owner, so the homes below genuinely cannot coexist (fork-existence,
case (b) — #819). The prior-art survey pins the discriminator: **who owns the transaction, and does the pattern
work over a read-only host** (the one case with no engine to delegate to).

## Ruling at a glance — ratified 2026-07-02

Ratified as recommended (the row below). **Confidence** says where judgment was actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · where the accept/reject lifecycle lives** | **(b) a standalone `suggested-edit` contract** — the propose->accept/reject state machine, composed by *both* annotation (suggestion body) and the rich-text Editor Engine protocol; apply delegated to the engine when editable, inert proposal-record when read-only | *(rejected)* rich-text/Editor-Engine owns it directly — collapses into (b) since rich-text is itself UX-only; *(rejected)* annotation owns it end-to-end — breaks its UX-only invariant | **~85%** — the #1408 corollary + rich-text's own UX-only disclaimer mandate the split |

## Fork 1 — where the accept/reject lifecycle lives

*Fork-existence:* a mutation transaction has exactly **one** owner, so the three homes are a genuine either/or
— they cannot coexist (#819, case (b)). The excluded-branch composability probe *failed*: you cannot make
annotation-owns-it and engine-owns-it both facades over one kernel, because exactly one artifact must be the
authoritative writer of the accepted mutation. What the probe *did* reveal is that "rich-text owns it" and "(b)
standalone contract" are the **same** home wearing two names (see (default->rejected) below) — so the real fork
is (b) vs (c), and (b) wins.

- **(b) a standalone `suggested-edit` contract (recommended, ~85%).** The propose->accept/reject state machine
  is its own small contract that **both** annotation and the rich-text Editor Engine protocol *compose*
  (reference, don't own) — the same seam #1408 used to split the durable-range-anchor out of annotation
  ([we:backlog/1408-content-annotation-highlight-comment-on-selection-standard-p.md](1408-content-annotation-highlight-comment-on-selection-standard-p.md),
  codified in we:docs/agent/platform-decisions.md#intents-ux-only). annotation references it as the
  `suggestion` motivation's **body**; the Editor Engine protocol references it as the transaction to
  **apply**. The *apply* step is the engine's existing "applies operations" op — present when the host is
  editable, **absent (record-only)** when the host is read-only (PDF / foreign HTML). Directly satisfies the
  `#intents-ux-only` corollary: "durable/technical machinery … is its own contract the intent composes."
  *Tradeoff: one more named contract in the catalog — a merit gain (clean seam, works over read-only hosts, no
  technical code on a UX intent), not a cost objection.*
- **(default->rejected) rich-text/Editor-Engine owns the mutation directly.** *Rejected — it collapses into
  (b).* The rich-text *intent* is itself UX-only and disclaims the engine
  ([we:src/_data/intents/rich-text.json:36](../src/_data/intents/rich-text.json)); the mutation therefore
  lives in the **Editor Engine protocol**, which is already a separate composed contract. So "rich-text owns
  it" *is* (b) with the shared contract mislabeled "rich-text" instead of "suggested-edit." It also has no
  referent over a read-only host (no engine), where (b) still models the proposal-record. The item's original
  ~70% "cleanest seam" framing over-read annotation's boundary (which *forbids* annotation ownership but never
  *endorses* the rich-text home).
- **(c) annotation owns it end-to-end.** *Rejected.* Breaks annotation's UX-only invariant
  ([we:src/_data/intents/annotation.json:13](../src/_data/intents/annotation.json)) by parking
  document-mutation machinery inside a UX intent — the exact anti-pattern #1408 ruled out for the anchor
  machinery. Weakest; rejected unless the split proves over-engineered, which the corollary forecloses ("even
  with zero external reuse, the unified default would still park technical code on a UX intent").

The `suggested-edit` contract shape the split yields (illustrative — a concrete propose->accept/reject seam,
not code to ship here):

```ts
// A read-only proposal record + a delegated apply. annotation composes it as the
// `suggestion` motivation's body; the Editor Engine protocol composes it to apply.
interface SuggestedEdit {
  state: 'proposed' | 'accepted' | 'rejected';
  target: RangeAnchor;               // the #1471 durable range-anchor contract (composed, not owned)
  proposed: { insert?: string; delete?: boolean };  // the ARIA insertion+deletion wrap
}
// Apply is the engine's existing operation — present iff the host is editable.
type ApplyEdit = (e: SuggestedEdit, engine?: EditorEngine) => 'applied' | 'record-only';
```

*Skeptic:* `REFUTED -> flipped default from "(default) rich-text owns it" to "(b) standalone
suggested-edit contract".* The refute-only sub-agent's kill was the **classification collapse** (dispositive on
its own): rich-text the intent is UX-only and its engine is *already* a separate protocol/contract
([we:src/_data/intents/rich-text.json:36](../src/_data/intents/rich-text.json)), so "(default) rich-text owns
it" was never a real third home — it *is* (b) with the shared contract misnamed. The `#intents-ux-only`
corollary + #1408 precedent independently mandate the split (burden of proof on *combining*). The
read-only-host attack **reinforced** (b) but wasn't needed to win — the classification collapse settles it.
Amendment folded in: the shared contract's *apply* step is the Editor Engine protocol's existing operation,
present when editable and **record-only** for read-only hosts. The citation-scope check confirmed annotation's
boundary *forbids* annotation ownership but does **not** authorize the rich-text home (the item over-read it) —
corrected above.

*Ratify skeptic (2026-07-02):* `CONFIRMED — no refutation; ratified as (b).` A fresh refute-only pass at
ratification grounded every prep-era premise against the live tree: the UX-only summary, `suggestion`
motivation value, `surface` dimension, and researchGaps handoff question on
[we:src/_data/intents/annotation.json](../src/_data/intents/annotation.json); the engine-is-a-protocol
disclaimer on [we:src/_data/intents/rich-text.json](../src/_data/intents/rich-text.json); the
`#intents-ux-only` corollary + #1408 lineage in
[we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md); #1471 resolved and graduated to
`we:range-anchor/contract.ts` (the composed `target` is real, not a phantom citation); no competing
ownership claim anywhere in `we:src/_data/`; no post-2026-07-01 ruling reshapes the fork.

## Context

### Boundaries / lineage

- **Not** the comment-thread product UI (reply chains, mentions, resolution workflow) — stays app-level, per
  annotation's scope boundary ([we:src/_data/intents/annotation.json:48](../src/_data/intents/annotation.json)).
- **Prepared** 2026-07-01 (`/prepare`). Prior-art survey published as
  [`/research/suggestion-accept-reject-ownership/`](/research/suggestion-accept-reject-ownership/);
  session report [we:reports/2026-07-01-2029-suggestion-accept-reject-placement.md](../reports/2026-07-01-2029-suggestion-accept-reject-placement.md).
  Surveyed: ARIA 1.3 `role=suggestion` (scoped to *editable* documents; wraps insertion+deletion), Google Docs
  / Notion suggested edits (editor owns accept/reject, gated on edit permission), ProseMirror suggestion-mode +
  y-prosemirror/Yjs 14 track-changes (accept/reject dispatch **editor transactions**), CRDT-native BlockSuite
  (data/logic split, still an engine), and the read-only/PDF/Hypothesis case (**no engine -> proposal-record
  only**). No `preparedDate` set yet — pending the DoR gate.
- **Codified** (2026-07-02): suggestion accept/reject = technical machinery -> its own composed
  `suggested-edit` contract, a fresh application of `#intents-ux-only` — recorded in that rule's precedent +
  lineage. Successor build: [#2145](2145-author-the-suggested-edit-contract-propose-accept-reject-com.md).
- Surfaced 2026-07-01 in the **first** [#1399](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
  watch run (front B — ARIA 1.3 spec-role delta since the 2026-06-21 APG / OpenUI lens run).
  Program report: [we:reports/2026-07-01-program-latent-standard-discovery.md](../reports/2026-07-01-program-latent-standard-discovery.md).
