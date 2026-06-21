---
kind: decision
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#decompose-overloaded-vocabulary-by-semantic-source"
preparedDate: "2026-06-21"
tags: [decision, book-candidate, gestures, pointer, touch, interaction, gap]
relatedReport: reports/2026-06-21-pointer-gestures-placement.md
relatedProject: webintents
---

# Pointer gestures — swipe / long-press / pinch / pull-to-refresh: placement

**Prepared** (no design exists yet) — a recognized-**gesture** vocabulary (swipe, long-press, pinch,
rotate, pull-to-refresh, two-finger pan) is the unhomed layer between raw Pointer Events and the UX
action a gesture triggers. The one fork below is grounded in a prior-art survey published as the
[/research/ topic](/research/pointer-gesture-vocabulary-placement/) (session report linked via
`relatedReport`); the recommended default is in **bold**. Surfaced by the verb-axis lens
([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)).

## Ruling (ratified 2026-06-21)

**Fork 1 → (a): a separate `gesture` intent that composes `interaction`** (gated to pointer/touch
modality), mirroring `focus-delegation` and `hover-intent`. *(~85%.)* The decisive crux is
scope/cardinality: `interaction.modality` is **ambient / document-level / singular** (one
`pointer|touch|gamepad` value per page), whereas a gesture binding is **per-element / plural** (this card
swipes, that image pinches). Folding plural per-element bindings into a singular ambient intent is a
genuine category error, not just untidy — it is exactly the "never widen one intent to absorb a foreign
family" rule ([we:docs/agent/platform-decisions.md#decompose-overloaded-vocabulary-by-semantic-source](../docs/agent/platform-decisions.md#decompose-overloaded-vocabulary-by-semantic-source);
the "tell" matches — a gesture binding supplies *none* of modality's defining inputs). The precedent is
doubled and exact: WE already gave two interaction-adjacent concerns their own homes composing
`interaction` (`focus-delegation`, `hover-intent` — the latter exists *because hover has no touch
equivalent*, the same "platform ships raw input, not the recognized layer" shape). Consistent with the
#1393 zoom/pan prep, which rejects the same dilution.

**(b) — a `gestures` dimension on `interaction` — rejected.** Coherent but inferior on merit: its sole
upside is "one fewer intent," an effort argument, not a fork branch (fork-is-not-prioritization). It
conflates two scopes and breaks the established separation precedent.

*Residual (~15%):* once authored the `gesture` intent may itself want a further split (discrete
tap/long-press vs continuous pan/pinch) or a recognizer **protocol** sooner than "deferred" — both are
*downstream* of (a), not arguments against it.

**Ratified ride-alongs (settled at prep, blessed here):**

- **Forced invariant — a11y parity.** Every gesture binding declares a single-pointer / keyboard
  equivalent; a gesture is never the only path. **WCAG 2.1 SC 2.5.1** (+ 2.5.2 cancellation, 2.5.4
  motion-actuation), borrowed verbatim. Mirrors `hover-intent`'s `touch` fallback.
- **Open gesture vocabulary** — standardize the convergent core (`tap · double-tap · long-press · pan ·
  swipe · pinch · rotate · two-finger-pan · edge-swipe · pull-to-refresh`), authors extend
  (intents-are-open-design).
- **Recognizer engine = native-first + DI override + Configurator card**, *not* a protocol minted now
  (minimize-lock-in). A full Gesture Recognizer Protocol is a deferred, separately-prioritized candidate.
- **Recognition / effect seams stay separate** (pinch → #1393 viewport; swipe → carousel paging;
  long-press → `contextmenu`/`command`; pan/drag → `data-transfer`/`reorder`).

**Graduation chain filed at resolution** (`blockedBy`):
[#1428](/backlog/1428-gesture-intent-spec-mint-we-src-data-intents-gesture-json-co/) gesture intent spec
→ [#1429](/backlog/1429-native-first-gesture-recognizer-behavior-compute-recognition/) native-first
recognizer behavior → [#1430](/backlog/1430-gesture-recognizer-engine-technical-configurator-card-native/)
Technical Configurator card for the engine choice.

## The axis

The concern decomposes into one **placement** axis plus settled ride-alongs. WE already owns input
**modality** — `pointer | touch | gamepad` — on the Interaction Intent
([we:src/_data/intents/interaction.json:6-15](../src/_data/intents/interaction.json)), an **ambient,
document-level, singular** value; its description already says "**Swipe actions** replace hover menus"
([we:src/_data/intents/interaction.json:16](../src/_data/intents/interaction.json)) but models **no
gesture binding**. A gesture binding is the opposite shape: **per-element and plural** (this card
swipes, that image pinches). The platform ships the raw input (**Pointer Events**, multi-pointer for
pinch) and the opt-outs (`touch-action: none`, `overscroll-behavior` for native pull-to-refresh) but
**no native gesture recognizer and no gesture event** (Safari's `GestureEvent` is non-standard /
deprecated) — so the recognize-a-named-gesture middle is unhomed. The decisive in-tree precedent: WE
already carves interaction-adjacent concerns into their **own** intents that *compose* `interaction` —
**Focus Delegation** ([we:src/_data/intents/focus-delegation.json](../src/_data/intents/focus-delegation.json))
and **Hover Intent** ([we:src/_data/intents/hover-intent.json:22-28](../src/_data/intents/hover-intent.json),
whose `touch` dimension exists *because hover has no touch equivalent*).

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — placement | **(a) a separate `gesture` intent composing `interaction`** | (b) a `gestures` dimension on `interaction` | med-high |

## Fork 1 — where does the gesture vocabulary live?

*Fork-existence:* both branches are coherent (you genuinely could add a `gestures` dimension to
`interaction`, **or** mint a separate intent) and the concern has exactly one home — a real either/or
(case (b)). Neither branch is broken; (b) is coherent but inferior on merit, so this is a genuine fork
with a strong default, not a forced invariant.

**Crux:** `interaction`'s `modality` is ambient/document-level/singular
([we:src/_data/intents/interaction.json:6-15](../src/_data/intents/interaction.json)); a gesture
binding is per-element/plural. Folding plural per-element bindings into the ambient-singular modality
intent conflates two scopes and dilutes modality with a verb — the same dilution the #1393 zoom/pan prep
rejects. WE's standing bias is separate-and-decouple, and the precedent already chose separation twice
for interaction-adjacent concerns (focus-delegation, hover-intent).

- **(a) A separate `gesture` intent that composes `interaction`** (gated to pointer/touch modality),
  mirroring `focus-delegation` / `hover-intent`. *Tradeoffs:* keeps `interaction` a clean ambient-modality
  intent; matches the established interaction-adjacent pattern; correct scope/cardinality (per-element,
  plural); composes cleanly with the effect consumers (#1393 pinch, carousel swipe, `data-transfer`
  drag). **← recommended default.**
- (b) A `gestures` dimension on `interaction`. *Tradeoffs:* one fewer intent, but mixes a per-element
  plural binding into a document-level singular intent (scope conflation), and breaks the precedent that
  put focus-delegation and hover-intent in their own homes. *Rejected* — coherent but inferior on merit
  (its only upside, fewer entries, is an effort argument, not a fork branch).

---

## Context — settled at prep (not the call)

**Forced invariant (ratify, not a fork): a11y parity.** Every gesture binding must declare a
single-pointer / keyboard equivalent — a gesture is never the only path. This is **WCAG 2.1 SC 2.5.1
Pointer Gestures (Level A)** (+ 2.5.2 cancellation, 2.5.4 motion-actuation), borrowed verbatim. The
"gesture-only" branch is the broken one. Mirrors `hover-intent`'s `touch` fallback dimension.

**Supported by default (not decisions):**

- **Open gesture vocabulary** — standardize the convergent core (`tap · double-tap · long-press · pan ·
  swipe · pinch · rotate · two-finger-pan · edge-swipe · pull-to-refresh`) + let authors extend, per the
  intents-are-open-design rule. The set converges across Hammer.js, @use-gesture, Interact.js, and the
  native frameworks (RN Gesture Handler, SwiftUI, Flutter, Compose, UIGestureRecognizer).
- **Recognizer engine = native-first + DI override + Configurator card.** Default recognition is computed
  on Pointer Events + `touch-action`; the engine (native math vs Hammer vs @use-gesture) is a
  **behavioral DI / Ambient-Intent** seam and a **Technical Configurator** card — *not* a protocol minted
  now (minimize-lock-in: no interop need today). Mirrors `hover-intent` keeping its *mechanic* in a
  Configurator card, not the intent. A full **Gesture Recognizer Protocol** is a deferred,
  separately-prioritized candidate (prioritization, not a fork branch).
- **Recognition/effect seams** (gesture recognizes; the effect lives elsewhere): pinch →
  [#1393](/backlog/1393-zoom-pan-a-surface-viewport-scale-translate-standard-placeme/) viewport
  transform; swipe → carousel paging; long-press → `contextmenu` / `command`; pan/drag →
  `data-transfer` / `reorder`. Each is a composition, not a conflict.

**On graduation** (after the call), spin out the builds via a `blockedBy` chain: the `gesture` intent
spec, then the native-first recognizer behavior, then a Technical Configurator card for the engine
choice.
