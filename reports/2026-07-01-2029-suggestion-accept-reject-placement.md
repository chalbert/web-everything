# Suggestion accept/reject — placement of the mutation transaction (#2029 prep)

**Date:** 2026-07-01 · **Item:** [we:backlog/2029-suggestion-accept-reject-handoff-annotation-vs-rich-text-pla.md](../backlog/2029-suggestion-accept-reject-handoff-annotation-vs-rich-text-pla.md)
· **Research topic:** [`/research/suggestion-accept-reject-ownership/`](/research/suggestion-accept-reject-ownership/)
· **Parent program:** [#1399](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/) (front-B ARIA-1.3 delta)

Prep pass bringing #2029 to Definition of Ready for fast human ratification. **The default flipped** from the
item's shipped "(default) rich-text editor-engine owns the mutation" to **(b) a standalone `suggested-edit`
contract**, on the skeptic's classification-collapse attack. This report records the grounding, the survey,
the classification, and the red-team.

## Standing test — genuine fork, placement-only

Fork 1 is a genuine either/or: a **mutation transaction has exactly one owner**, so annotation-owns-it,
engine-owns-it, and a-shared-contract-owns-it cannot coexist (fork-existence case (b), #819). The
composability probe *fails* — exactly one artifact must be the authoritative writer of the accepted mutation,
so you cannot build two of the branches as facades over one kernel. The go/no-go on the **pattern** is settled
(ARIA 1.3 mints `role=suggestion`; Google Docs / Notion / ProseMirror pervasiveness), so this is
**placement-only**, not a validation gate.

## Grounding (verified against the real tree)

- **annotation is UX-only.** `we:src/_data/intents/annotation.json` — summary (line 13) owns "no anchor
  machinery, no host mutation." The `motivation` dimension (line 20) includes `suggestion`; `surface` (lines
  33-38) is `overlay | in-model`. Its `researchGaps` (line 93) literally asks: *"Suggestion-motivation
  acceptance flow — is accept/reject … an annotation-intent concern (it mutates the host) or strictly the
  rich-text model's? Define the handoff."* — i.e. the item is answering annotation's own open question.
- **rich-text the intent is ALSO UX-only.** `we:src/_data/intents/rich-text.json` — the description's
  "UX-only -> the engine is a protocol" section (line 36) and summary (line 11): the engine that "maintains the
  content model, **applies operations**, and serializes — is the **Editor Engine protocol** / a Technical
  Configurator concern, **not part of this UX intent**." So "rich-text owns the mutation" resolves to "the
  Editor Engine protocol owns it," which is *already a separate composed contract*.
- **Statute `we:docs/agent/platform-decisions.md#intents-ux-only` — the corollary is on point.** Verbatim:
  *"When a UX intent needs durable/technical machinery (serialize/re-resolve/fuzzy/orphan, etc.), that
  machinery is its own contract the intent composes (referenced, not owned) … #1408 (annotation = UX intent
  composing a separate durable-range-anchor contract)."* A propose->accept/reject state machine that applies a
  mutation is exactly this durable/technical machinery.
- **#1408 precedent.** `we:backlog/1408-content-annotation-highlight-comment-on-selection-standard-p.md`
  (resolved 2026-06-21, codified in we:docs/agent/platform-decisions.md#intents-ux-only) SPLIT the
  durable-range-anchor out of annotation into its own composed contract, because the
  serialize/re-resolve/fuzzy/orphan machinery is technical, not UX — *"even with zero external reuse, the
  unified default would still park technical code on a UX intent."* Standing bias: separate-and-decouple,
  burden of proof on **combining**. This is the exact shape candidate (b) mirrors.
- **Program report.** Surfaced in `we:reports/2026-07-01-program-latent-standard-discovery.md` Run 1 (the ARIA
  1.3 spec-role diff against annotation: `comment`->`commenting` covered, `mark`->`highlight` covered,
  `suggestion` host-mutation lifecycle = unowned residual).

## Prior-art survey — who owns the mutation transaction, and does it work over read-only hosts?

The load-bearing discriminator. Findings:

| System | Who owns the accept/reject mutation | Works over a read-only host? |
|---|---|---|
| **WAI-ARIA 1.3 `role=suggestion`** | Spec scopes it to *"a proposed change to an **editable** document"*; element wraps an `insertion` + a `deletion` role. The native semantic ties suggestion to an editable surface. | No — the role's own framing is an editable document. |
| **Google Docs suggestion mode** | The editor. Only "can edit" permission can accept/reject; "can view" users can't even *see* suggestions until accepted. | No — you enter "Suggesting" on an editable doc; viewers can't act. |
| **Notion suggested edits** | The editor (a live editable page; "can comment" and above). | No — needs an editable page. |
| **ProseMirror suggestion-mode + y-prosemirror / Yjs 14 track-changes** | The **editor engine** — `acceptSuggestionsInRange` / `rejectSuggestionsInRange` dispatch **ProseMirror transactions**; accept integrates into the doc, reject reverts. | No — bound to the editor's content model. |
| **CRDT-native (BlockSuite)** | The engine — data layer (CRDT doc) is split from editor logic, but the suggestion resolves *into* the content model; the CRDT doc is the mutation target. | No — still an engine. |
| **Read-only / PDF / foreign HTML (Hypothesis, RecogitoJS)** | **No engine.** A "suggestion" is a proposal *record* (marker + proposed replacement text) that **cannot be applied to the host** — you cannot mutate a PDF. | This IS the read-only case — apply is impossible; the suggestion is record-only. |

**Two conclusions.** (1) In *every* system with an editable target, the mutation transaction is owned by the
**editor engine**, never by a separate annotation/marker layer — accept/reject is the engine applying (or
reverting) an operation. (2) The read-only host is the one case with **no engine**: there a suggestion is an
inert proposal-record, degenerate relative to the ARIA-role mainline (you cannot accept-and-apply to a PDF).

## Per-fork classification (7-question sequence)

- **Q1 which layer?** Not a Block (no runnable code shipped from WE). Not a bare Intent dimension — it's
  technical mutation machinery, which intents don't carry (`#intents-ux-only`). It is a **contract/protocol
  seam** two UX intents compose.
- **Q2 protocol or intent dimension?** The *apply* step already belongs to the **Editor Engine protocol**
  (rich-text's disclaimed engine — a swappable-vendor story exists: ProseMirror <-> CodeMirror <-> a CRDT doc).
  The propose->accept/reject *state machine* over a durable anchor is a small **contract** both surfaces
  reference. So: a standalone contract that *composes* the Editor Engine protocol's apply op — not a new
  intent dimension.
- **Q3 expose the whole axis?** The suggestion `state` (proposed/accepted/rejected) is exposed as the
  contract's model; the *marker* stays annotation's `suggestion` motivation. No axis is baked into one intent.
- **Q4 fixed mechanic or dimension?** Not a config dimension — it's a structural ownership seam, not a
  multi-value knob.
- **Q5 DI-injectable?** The *apply* delegate (which engine) is resolvable via the ambient Editor Engine
  protocol / Technical Configurator — behavioral, DI-injectable; not hardcoded on the contract.
- **Q6 most-permissive default?** The contract works over *both* editable (apply via engine) and read-only
  (record-only) hosts — the most-permissive default is "apply if an engine is present, else record."
- **Q7 seam between intents?** **Yes — this is squarely the seam question.** The suggestion transaction
  propagates *across* two intents' structures (annotation's marker/payload and rich-text's editable surface).
  Per Q7, put the shared machinery on **neither** intent: it's a composed contract both reference, *gated to*
  the host's editable/read-only value. Honours the separate-and-decouple bias — the reason (b) beats (c).

## Red-team (skeptic sub-agent — refute-only, "the rich-text-owns-mutation default is wrong")

**Verdict: `REFUTED -> flip to (b)`.** Findings by axis:

- **(0) classification — the kill (dispositive alone).** "(default) rich-text owns the mutation" is not a real
  third home. rich-text the *intent* is UX-only and disclaims the engine (we:src/_data/intents/rich-text.json
  line 36); the mutation therefore lives in the **Editor Engine protocol**, which is *already a separate
  composed contract*. So the default's real content — *a standalone mutation contract that both annotation and
  rich-text reference* — **is verbatim candidate (b)**. The "(default) vs (b)" distinction was an illusion
  created by naming the shared contract "rich-text" instead of "suggested-edit." The item mislabeled its own
  default.
- **(1) merit — read-only-host attack lands as reinforcement.** A PDF/foreign host has no engine, so "rich-text
  owns it" has no referent there; (b) still cleanly models the proposal-record whose *application* is
  engine-provided-or-absent. Even without this, the classification collapse already wins — so the read-only
  attack **reinforces** (b) but is not the primary blade.
- **(2) statute-overlap — closes it.** The `#intents-ux-only` corollary is controlling, not advisory: technical
  machinery = its own composed contract; #1408 sets the burden of proof on combining. No collision with the
  #1319 Status/Tag/Marker split (that split *separated* intents; (b) likewise separates the machinery — same
  direction, not a re-merge).
- **(3) citation-scope — the item over-read the boundary.** annotation's "owns no host mutation" boundary only
  *forbids* annotation ownership; it does **not** endorse the rich-text home. The researchGap's "annotation vs
  the rich-text model's" is a false binary, because rich-text the intent disclaims the engine too. Corrected in
  the item.

**Amendment folded into (b):** the shared contract's *apply* step is the Editor Engine protocol's existing
"applies operations" op — present when the host is editable, **record-only** when it is read-only.

## Ruling shape for ratification (not yet ratified)

**Fork 1 -> (b) a standalone `suggested-edit` contract (~85%).** The propose->accept/reject state machine is
its own small contract, composed by **both** annotation (as the `suggestion` motivation's body) and the
rich-text Editor Engine protocol (as the transaction to apply). Apply delegates to the engine when the host is
editable; it is an inert proposal-record when the host is read-only. (c) annotation-owns-it-all is rejected
(UX-only violation); the shipped "(default) rich-text owns it" is rejected as (b) mislabeled.

On resolve this **codifies a rule** — suggestion accept/reject = technical mutation machinery -> its own
composed contract, a fresh application of `#intents-ux-only` — so `--codified-to` is required.

## Residual / not-yet-at-DoR

- `preparedDate` intentionally **not** set (per the prep instructions — the human sets it / a later gate does).
  The fork itself is at DoR: options + bold default + fork-existence line + `Skeptic:` line + grounded refs.
- The `suggested-edit` contract's exact wire shape (the `SuggestedEdit` interface sketched in the item) is
  **illustrative**, not ratified — it's a build-time detail for the post-ratification `/new-standard` slice,
  not part of this placement call. No open sub-choice hides in it.
- Realizing work (post-ratification, separately prioritized): a `suggested-edit` contract slice + wiring the
  annotation `suggestion` motivation body + the Editor Engine protocol apply delegate — filed after the call,
  not here.
