---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
tags: [decision, book-candidate, inline-edit, edit-in-place, editing, gap]
relatedReport: reports/2026-06-21-edit-in-place-lifecycle-placement.md
preparedDate: "2026-06-21"
---

# In-place / inline edit — edit-in-place + editable cell standard: placement

Candidate latent standard surfaced by the verb-axis lens
([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)): turn a displayed
value into an editor **in place** — click-to-edit field, editable table cell, rename-in-tree — with the
display ⇄ edit mode swap, commit (blur / Enter) / cancel (Esc reverts to baseline), validation, and
keyboard + a11y semantics. WE owns the editor (`input`), the gate (`validation`), flowed-content editing
(`rich-text`) and a `data-grid` block — but **none owns the display→edit→commit/cancel lifecycle** as a
reusable concern ([prior-art survey](/research/edit-in-place-lifecycle/)).

The concern decomposes into orthogonal axes the survey pins to the real tree. The **lifecycle** —
*activate* (a gesture swaps display→editor), *edit*, *commit* (write back) *or cancel* (revert to the
baseline) — is a **named cross-component primitive that recurs without a grid**: Atlassian
`@atlaskit/inline-edit` (`readView`/`editView`/`onConfirm`), PrimeReact `Inplace`
(`InplaceDisplay`/`InplaceContent`), Ant `Typography editable`, plus rename-in-tree. Its **keyboard +
a11y model is already platform-standard** — WAI-ARIA APG Grid editing specifies Enter/F2 to enter the
editor, F2 again to restore navigation, **Escape to undo edits (revert-to-baseline)**, and `aria-readonly`
for disabled cells — so the intent *adopts* that vocabulary, it does not re-mint it. Decomposed against
the existing intents, the only **unowned residual** is *the activation gesture* + *the
display-renderer ⇄ editor-renderer swap for one atomic value* + *cancel-reverts-to-baseline*; the editor
([we:src/_data/intents/input.json](../src/_data/intents/input.json)), the commit gate
([we:src/_data/intents/validation.json](../src/_data/intents/validation.json) — `commitment` full/deferred,
`execution` change/blur/submit) and cell focus (`focus-delegation`) are already owned and only **composed**.
`data-grid` defines **no** edit lifecycle of its own — its `contractsOnly` decision names the movement
engine + active-cell projection as its seams and lists editing as an external impl that "registers against
them without changing the contract" ([we:src/_data/blocks/data-grid.json](../src/_data/blocks/data-grid.json)) —
so it is the *first consumer* of the intent, not its home (the card's prep question, answered: **no**,
data-grid does not already cover editable cells as a lifecycle).

### Triage context

- **Kind**: Intent (cross-cutting) · **Native grounding**: WAI-ARIA APG Grid editing (Enter/F2/Esc, `aria-readonly`), `contenteditable`
- **Native-first**: ▽ low (adopts the APG model) · **Gap**: ◆ medium · **Effort**: ◆ medium · **Surfaced by**: #1390 (verb-axis lens)

### Recommended path at a glance

Ratify both rows, or override just the one you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · placement of the lifecycle** | mint a dedicated **`edit-in-place` intent** | fold into `data-grid` (editable-cell feature) *(rejected — recurs without a grid)* | **~80%** — standalone primitive in 3 systems + rename-in-tree |
| **2 · what the intent owns vs composes** | own only the **thin residual** (activation + dual-renderer swap + commit/cancel-revert); **compose** `input`/`validation`/`focus-delegation`/(opt) `rich-text` | own a fuller spec incl. editor variants + validation policy *(rejected — duplicates shipped intents)* | **~85%** — native-first; #596 accessible-name precedent |

## Fork 1 — where does the display→edit→commit lifecycle live?

*Fork-existence:* the excluded branch is **"data-grid feature only"**, and it is **broken** — the
lifecycle provably recurs *outside* any grid (a standalone click-to-edit field, a tree-node rename), so
folding it into `data-grid` forces those consumers to depend on a grid block. That is a real either/or: a
home that excludes the non-grid loci cannot serve them.

**Fork 1 (a) — mint a dedicated `edit-in-place` intent (recommended, ~80%).** The lifecycle is a named,
first-class, *standalone* primitive in three major systems — Atlassian
[`@atlaskit/inline-edit`](https://atlassian.design/components/inline-edit/) (`readView`/`editView`,
`onConfirm`, commit on blur/Enter, cancel on Esc), PrimeReact [`Inplace`](https://primereact.org/inplace/)
(`InplaceDisplay`/`InplaceContent`), Ant [`Typography editable`](https://ant.design/components/typography/)
— and recurs again in rename-in-tree. A concept that recurs without its neighbour earns its own home
(separate-and-decouple). It composes onto `data-grid` (editable cells), a future tree block (rename), and
a standalone field alike.

**Fork 1 (b) — fold into `data-grid` as an editable-cell feature (rejected).** Matches the grid prior art
([MUI X DataGrid](https://mui.com/x/react-data-grid/editing/persistence/) edit modes + `processRowUpdate`;
AG Grid `editable`), but strands the standalone-field and tree-rename loci — the broken branch above.

*The residual (~20%):* if WE never grows a non-grid editable surface, (a) is mild over-minting. The survey
refutes that — the standalone field is already the single most common occurrence — but a skeptic pass at
ratify should confirm WE intends to serve click-to-edit fields outside tables.

## Fork 2 — what does the intent own, and what does it compose?

*Fork-existence:* the excluded branch is **"own a fuller spec"** (the intent re-specifies the editor
variants and the validation/commit policy), and it is **broken** by native-first + separate-and-decouple —
text entry is `input`'s and commit-gating is `validation`'s; re-owning them duplicates shipped standards
and invites drift. The coherent branches genuinely diverge on the **ownership line**, so this is a real
scope either/or, not a "support both."

**Fork 2 (a) — own only the thin residual; compose the rest (recommended, ~85%).** The intent owns
exactly what nothing else does: the **activation gesture** (`click` / `dblclick` / `F2` / explicit
affordance / programmatic), the **display ⇄ editor renderer swap** for one atomic value, and the
**commit/cancel-revert** lifecycle — adopting the APG `Enter`/`F2`/`Esc` vocabulary rather than re-minting
it. It **composes** [`input`](../src/_data/intents/input.json) (the editor),
[`validation`](../src/_data/intents/validation.json) (the commit gate — `commitment` full/deferred already
covers buffer-until-commit), `focus-delegation` (cell focus in the grid case), and optionally `rich-text`
(when the editor is a flowed surface). This mirrors the
[accessible-name precedent](/intents/accessible-name/) (#596): own the thin recurring policy, defer
everything the platform or a neighbour already standardizes.

**Fork 2 (b) — own a fuller spec incl. editor variants + validation policy (rejected).** Re-owns
`input`/`validation` territory; duplication and drift; the broken branch above.

*The residual (~15%):* the boundary between this intent's `commitOn` and `validation`'s `execution` /
`commitment` needs one crisp sentence at build time so the two don't both claim "commit on blur." That is
a realization detail for the carved build item, not a second placement fork.

---

### Supported by default (not forks)

- **Intent vs behavior block is not an either/or.** The WE *intent* (the contract) and a Frontier UI
  *behavior block* (the realization) coexist at different layers — precedent: `data-transfer`, `reorder`
  and `selection` each ship an intent *and* a realizing block. The original card's "own intent vs a
  behavior composing `input`+`validation`+mode-swap" collapses: mint the intent **and** the FUI behavior
  block realizes it by composing those intents. (Pass-0 dissolve.)
- **Seam vs `rich-text`.** `rich-text` keeps its `mode: editable | read-only` axis for a **flowed,
  formatted content surface**; `edit-in-place` governs an **atomic scalar value**. They compose (an
  edit-in-place field may pick a rich-text editor), so the seam is *content shape* — no overlap to resolve.
- **`data-grid` composition.** Editable cells become a `data-grid` consumer of the intent, exactly as its
  `contractsOnly` decision already anticipates; no change to the grid contract.

### Realizing work (post-ratification, separately prioritized)

Authoring the `edit-in-place` intent JSON (dimensions draft: `activation`, `commitOn`, `cancelOn=escape`,
`editor` pointer) + the FUI behavior block + a demo; wiring `data-grid` to compose it. Not part of this
placement call — file via `/new-standard` once Fork 1/2 ratify.
