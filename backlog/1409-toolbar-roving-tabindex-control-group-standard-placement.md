---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
tags: [decision, book-candidate, toolbar, roving-tabindex, apg, accessibility, gap]
relatedReport: reports/2026-06-21-toolbar-composite-focus-placement.md
preparedDate: "2026-06-21"
---

# Toolbar — roving-tabindex control group standard: placement

Surfaced by the ARIA-APG lens ([#1400](/backlog/1400-discovery-lens-aria-authoring-practices-apg-pattern-diff-aga/)):
a **toolbar** groups related controls (buttons, toggles, menu-buttons, separators) under one tab stop with
**roving tabindex** + arrow-key navigation between members — the APG Toolbar pattern
([prior-art survey](/research/toolbar-composite-focus-placement/)).

The prep finding reframes the card: **the focus mechanic already exists, and so does a toolbar recipe.**
[we:src/_data/intents/focus-delegation.json](../src/_data/intents/focus-delegation.json) (status `draft`)
already owns the entire roving-tabindex / managed-focus contract (`strategy: roving | virtual | native`,
`orientation`, `selectionFollowsFocus`, `wrap?`) and *explicitly lists toolbar as a consumer*;
[we:src/_data/blocks/composite-widget.json](../src/_data/blocks/composite-widget.json) (status `concept`)
is its behavior twin ("implementing the Roving Tabindex pattern"); and a
[we:src/_data/assemblerPresets/toolbar.json](../src/_data/assemblerPresets/toolbar.json)
(`ownedByProject: webdocs`, status `active`) already wires it — `composesIntents:
["action","command","focus-delegation","navigation"]`, `intentStrategies: { "focus-delegation":
"roving-tabindex" }`. Every benchmark factored roving focus into **one shared primitive** (Radix
`RovingFocusGroup` powering Toolbar/Tabs/RadioGroup/Menu/ToggleGroup; Ariakit `Composite`; React Aria
`useFocusManager` + a thin `useToolbar`) — toolbar is a thin role wrapper, never the home of the focus
algorithm. So the decision is **placement/promotion, not greenfield.**

### Triage context

- **Kind**: Promotion + thin container (focus mechanic already owned) · **Native grounding**: WAI-ARIA APG Toolbar (`role="toolbar"`, `aria-orientation`, separators); the two APG focus techniques (roving tabindex / `aria-activedescendant`)
- **Native-first**: ▽ low (adopt APG vocabulary) · **Gap**: ▽ low (mechanic + preset exist) · **Effort**: ▽ low · **Surfaced by**: #1400 (ARIA-APG lens)

### Recommended path at a glance

Ratify both rows, or override just the one you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **A · the roving unit** | it **is** the existing `focus-delegation` intent + `composite-widget` block; toolbar is a consumer | a toolbar-specific roving standard *(rejected — duplicates a shipped intent)* | **~95%** — Radix/Ariakit/React Aria all factored it shared |
| **B · toolbar container semantics** | **no new intent**; toolbar = the existing `toolbar` assemblerPreset over `focus-delegation`; promote `composite-widget` | a thin `toolbar` *block* (low-regret hedge) · a `toolbar` *intent* *(rejected — no UX dimension)* | **~70%** — graduate to a block when a 2nd container consumer appears |

## Fork A — is the unit a shared managed-focus behavior, or a toolbar-specific thing?

*Fork-existence:* this is **not a real fork** — the "new toolbar-specific roving control-group standard"
branch is **broken/redundant**. `focus-delegation` already owns roving/virtual/native + orientation + wrap
+ selectionFollowsFocus and already names toolbar as a consumer; `composite-widget` is its behavior twin;
16 blocks already delegate to it; a `toolbar` preset already wires it. A toolbar-owned roving standard would
duplicate a shipped intent and violate separate-and-decouple — the exact factoring Radix / Ariakit / React
Aria all rejected. Recorded as a resolved invariant, not an open fork.

**Fork A (a) — the roving unit IS `focus-delegation` (+ `composite-widget`); toolbar is a consumer
(recommended, ~95%).**

**Fork A (b) — a new toolbar-specific roving standard (rejected).** Duplicates `focus-delegation`.

**Fork A (c) — extend `segmented-control` (rejected).** That's one member, not the container.

*The residual (~5%):* `focus-delegation` is still `draft` and 2D-grid mechanics are flagged as a research
gap — but that is maturation of the existing intent, not a reason to re-home.

## Fork B — where do the toolbar *container* semantics live?

*Fork-existence:* genuine — two coherent branches that cannot both be the home. (a) treats container
semantics as nothing new (covered by `focus-delegation`'s orientation + the existing preset); (b) says the
container adds real non-focus semantics (role=toolbar, separators, "independent controls each individually
operable" — what distinguishes a toolbar from a radiogroup/segmented-control) that deserve a first-class
contract. They diverge on whether a `toolbar` artifact should exist beyond the preset.

**Fork B (a) — no new intent; toolbar = the existing `toolbar` assemblerPreset consuming `focus-delegation`
(strategy=roving) + `action`/`command`; promote `composite-widget` to capture shared container behavior
(recommended, ~70%).** Container "semantics" are the preset's APG conformance, not a new contract.

**Fork B (b) — a thin `toolbar` block (Component) implementing no new intent, composing
`focus-delegation` + `action`, owning only role=toolbar + separators + orientation grouping — first-class
so menubar / future consumers can reference it.** The low-regret hedge.

**Fork B (c) — a `toolbar` intent (rejected).** A toolbar carries no UX dimension of its own (orientation
belongs to focus-delegation, grouping is layout), so an intent would be empty.

*The residual (~30%):* if a near-future menubar / `tabs` container wants shared container concerns
(separators, overflow), (b)'s thin block becomes the cleaner reuse home and (a) would need promoting to a
block anyway. Recommend (a) now, with an explicit trigger: the moment a *second* container consumer
appears, graduate the preset into the thin `toolbar` block per (b). Matches Radix/Ariakit (thin toolbar over
the shared focus group).

---

### Supported by default (not forks)

- **Intent contract (`focus-delegation`) + behavior-block realization (`composite-widget`) coexist** at
  different layers — already the shape on disk.
- **Both focus techniques (roving + virtual / `aria-activedescendant`) coexist** as the `strategy` axis —
  APG documents both; Ariakit's Composite supports both behind one flag; `focus-delegation` already encodes
  both.
- **Toolbar preset + member blocks coexist** — `button` / `segmented-control` / `menu` / `toggle-switch`
  are members the toolbar composes; already wired in the assemblerPreset.

### Seams

- **vs `focus-delegation`:** it owns *focus movement within a widget*; toolbar owns *container identity*
  only (role=toolbar, label, separators). Arrow-nav is delegated wholesale (`strategy=roving;
  orientation=horizontal`).
- **vs `segmented-control`:** a single-select *value* widget (`role=radiogroup`, exactly one pressed);
  toolbar is a group of *independent* controls. Shared only the focus mechanic. Keep separate.
- **vs `keyboard-shortcuts`:** orthogonal — global chord normalization across shadow boundaries, not
  within-widget arrow nav.
- **vs future menu/menubar/tabs:** fellow consumers of `focus-delegation` / `composite-widget`; a
  container-level shared concern is the trigger to graduate the toolbar preset into the thin block (Fork B
  (b)), not to re-home the focus mechanic.

### Realizing work (post-ratification, separately prioritized)

If Fork B (a) ratifies: promote `focus-delegation` from `draft` and `composite-widget` from `concept`;
keep the `toolbar` assemblerPreset as the recipe. If/when a 2nd container consumer lands, file the thin
`toolbar` block per Fork B (b). Not part of this placement call.
