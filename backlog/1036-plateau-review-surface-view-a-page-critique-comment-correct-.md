---
type: decision
workItem: story
size: 8
parent: "1033"
blockedBy: ["1034"]
status: open
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-design-critique-correction-surface.md
tags: [design-reference, vision, design-critique, human-in-the-loop, plateau, training-data]
---

# Plateau review surface — view a page critique, comment, correct, persist as a labeled training pair

## Digest

The plateau-app surface that shows a page's auto-generated design critique (the #1034 rubric output), lets a
human comment + correct it, and persists the result as a labeled `{frame, critique}` pair — the
human-correction loop that **un-parks the on-device model (#513)**. **This is not greenfield:** the output
contract is ratified (#1034) and a structural twin already ships — `plateau:src/vision-review/` (#1084),
whose README calls itself *"the Tier-2 analogue of the design-critique review surface (#1036)."* **Prepared**
off the [`design-critique-correction-surface`](/research/design-critique-correction-surface/) topic (survey
of Label Studio / Prodigy / CVAT / Labelbox / SageMaker A2I + the active-learning / distillation literature):
**two forks**, each with a **bold** default, the rest collapsed to invariants below.

## Governing invariants inherited (not decided here)

- **No-leakage (#475):** vision is a Plateau service the surface consumes as a no-leakage client — only
  *outputs* cross (screenshots in, labels out); the surface never sees the model.
- **Output contract is fixed (#1034):** the critique is a **closed** set of 8 scored axes (1–5) + an
  **open** list of localized findings `{dimension, element-ref, problem, severity 0–4}`, versioned axis set
  ([we:docs/agent/vision-tiers.md](../docs/agent/vision-tiers.md) §Design-critique rubric). The surface
  corrects *values within* this contract; it never edits the contract.
- **Plateau phase rule:** Phase-1 is browser-only (no backend); a real corpus source / write-back is
  Phase-2 (#554). Mirrors `vision-review/` exactly.

## The axis being decided

Given the in-tree twin (`plateau:src/vision-review/`) and the ratified output contract, the only genuinely
open calls are **(1)** how much machinery #1036 *shares* with that twin, and **(2)** whether a correction
*overwrites* the model's proposal or *preserves both*. Everything else follows precedent (see *Supported by
default*).

## Recommended path at a glance

| Fork | Recommended default | Main (excluded) alternative | Confidence |
|---|---|---|---|
| 1 · Reuse boundary | **Shared review harness** — extract the queue / screenshot-canvas / persist / no-leakage shell; the critique editor composes it (and `vision-review/` is migrated onto it) | independent siblings (duplicate the shell, share only the pattern) · *fold into `vision-review/`* — **rejected** (conflates two distinct output contracts) | ~75% |
| 2 · Correction-record provenance | **Preserve-both** — the model's proposal is read-only; the human correction is a linked gold record, with provenance metadata | overwrite the proposal in place (the current `vision-review/` `ReviewRecord` shape) | ~85% |

## Fork 1 — Reuse boundary: shared harness vs independent siblings

**Fork-existence justification:** a genuine either/or with two coherent end-states that cannot both hold —
*one* shared shell, or *two* independent ones. (The third branch, *fold critique into `vision-review/`*, is
the flawed one: it conflates two distinct output contracts on one surface, and `vision-review/` is
explicitly the Tier-2 RichOutput surface — so it is rejected outright, not weighed.) The remaining A/B is a
real merit call: DRY/consistency vs. avoiding a premature shared abstraction.

The twin is concrete. `plateau:src/vision-review/data.ts` is a pure, framework-free data layer:
`QueueItem`/`ReviewStore`, `localStorage` persistence (`loadStore`/`saveRecord`, key
`plateau.vision-review.v1`), and the drag-to-draw coordinate helpers (`boxFromPixels`/`boxToPixels`).
`plateau:src/vision-review/vision-review.ts` is the mount/render shell wired at route `/vision-review`
(`plateau:src/main.ts`, `plateau:index.html`). The surface skeleton — *queue → proposed output over a
screenshot → human corrects (incl. drag-box regions) → save labeled pair → localStorage → corpus-sync
later → no-leakage* — is **identical** to what #1036 needs; the **only** part that differs is the
output-contract editor (RichOutput `{description, tags, regions}` vs critique `{axes, findings}`).

- **A — Shared review harness (recommended).** Extract the identical skeleton (review queue, screenshot
  canvas + region drag/edit, persistence, accept/fix/reject verbs, no-leakage boundary) into a shared
  module both surfaces compose; each supplies its own output-contract editor. `vision-review/` is migrated
  onto the harness so there is exactly one implementation of the shell. This is the separation-bias's own
  textbook case — a reusable axis (the review harness) that recurs across two consumers earns its own home,
  composed by the variant editors.
- **B — Independent siblings.** Build #1036 as its own surface mirroring `vision-review/`'s pattern but
  sharing no code; extract a harness only if/when a third consumer appears. *Merit case:* the two output
  editors are different enough (boxed regions vs scored axes + findings) that a shared shell could become a
  leaky abstraction forced too early. *Rejected as default:* the shell is genuinely identical and already
  written once; duplicating it invites drift (two persistence formats, two no-leakage boundaries to keep
  honest) for no merit gain — coupling here has a concrete benefit, which is exactly when the
  separation-bias permits combining.

**Recommended: A** (~75%; residual: *when* to extract — refactor the shipped `vision-review/` onto the
harness as part of this build vs build #1036 against a new shared module and migrate the twin in a
follow-up — is a build-sequencing call, not a branch; the end-state is one shared harness either way).

## Fork 2 — Correction-record provenance: overwrite vs preserve-both

**Fork-existence justification:** a genuine either/or — a saved record either *retains* the model's
proposal alongside the human correction or it *doesn't*; the two record shapes cannot coexist for the same
pair. It is a merit call (training-signal richness + cross-page comparability vs simplicity + matching the
sibling), not a cost call.

The survey is decisive and the precedent is the *loser*: every mature HITL system **preserves both** —
Label Studio holds predictions read-only and writes corrections as a separate coexisting annotation; A2I
stores the original inference plus the human output. The signal this unlocks is exactly what the downstream
consumers need: model-vs-human **disagreement** is the active-learning selector for the next hard examples
(#490/#1081), **edit-distance from the proposal** is a quality/effort/ambiguous-axis signal, and for
**#513's distillation** the KD literature is explicit that retaining teacher-prediction + human-gold is the
noise-correction signal that stops the hosted teacher's mistakes from propagating into the ≤10 MB student.
The item's own charter says *comment + correct* — a comment is annotation, not overwrite.

- **A — Preserve-both (recommended).** Persist each pair as
  `{ proposed (read-only: axes + findings + per-element confidence + provider/model version), corrected (the
  human gold), comment, annotator/timestamp/time-spent, per-element verdict (accept|fix|reject) }`. Derive
  an edit-distance / disagreement measure from the pair. Mirrors the universal annotation-tool convention
  and the #489 `{frame, verdict}` storage shape (extended, not broken).
- **B — Overwrite in place.** The current `vision-review/` shape: `ReviewRecord extends RichOutput`
  (`plateau:src/vision-review/data.ts`) saves only the corrected labels; the model's proposal is lost.
  *Rejected:* discards the disagreement/effort signal the corpus exists to capture; simpler but strictly
  less informative for distillation/eval.

**Note the coupling to Fork 1:** the twin currently uses overwrite (B). Adopting A here means either #1036
diverges from the sibling *or* — if Fork 1 lands on the shared harness — the harness standardizes on
preserve-both and `vision-review/`'s record is retrofitted (the harness is the natural place to make both
surfaces consistent).

**Recommended: A** (~85%; residual: whether to also feed the student teacher *soft*-labels — not just the
corrected gold — is a genuine but separate KD design fork that A keeps open and B forecloses).

---

## Supported by default (not decisions)

- **Correct values, not vocabulary.** The human edits the 8 closed axis scores (1–5) and does full CRUD on
  the open findings (add / edit / relocate via drag-box reusing `boxFromPixels` / delete). The **axis set
  itself** is versioned config, never per-pair editable — #1034 Fork 3's comparability invariant
  (axis drift kills the cross-page score comparability #489/#490 depend on).
- **Persistence:** Phase-1 `localStorage` (key `plateau.design-review.v1`); real `design-refs/` corpus read
  endpoint + corrected-pair write-back parked to Phase-2 (#554). Mirrors `vision-review/`.
- **Queue source:** a seed POC queue now; the WE `design-refs/items/` + `quarantine/` corpus via a read
  endpoint later (same deferral as the twin).
- **Scope = critique-only.** A unified "correct any vision output" surface spanning the QC verdict (#475),
  codification facets (#396), and this critique (#1034) is a coherent but larger, separate epic-level call —
  excluded here on the separation bias; revisit only if a multi-vocabulary correction need actually emerges.

## Relationships

- **parent #1033** — the interactive design-review loop; this is its human-correction surface.
- **blockedBy #1034** — the design-critique rubric (resolved); this surface corrects its output.
- **#1084 / #1073** — `plateau:src/vision-review/`, the Tier-2 structural twin this either shares a harness
  with (Fork 1) or mirrors.
- **#475 / #396** — sibling vision vocabularies under the same no-leakage invariant + `registerVisionProvider` seam.
- **#489 / #490 / #513 / #1081** — the distillation corpus + eval this surface accumulates labels for;
  preserve-both (Fork 2) is what makes the pairs useful to them.
- **#554** — the Phase-2 backend that turns localStorage pairs into a synced corpus.
