# Block a11y-composition compliance audit (#1835, rule #1795)

**Date:** 2026-06-27 · **Batch:** batch-2026-06-27-1842-1720 · **Scope:** every WE block interface
(`we:src/_data/blocks/*.json`, 81 blocks) audited against
[`#1795` composition-preserves-a11y-contract](../docs/agent/platform-decisions.md#composition-preserves-a11y-contract).

## The rule audited

A block's a11y contract (roles, focus order, keyboard model, aria surface) is single-sourced on the base
block. Every variation must be **add-only** — it may *add* roles/focus/keyboard/aria, never *override, remove,
reorder, or rebind* a base one. The developer test: does the variation **change** the contract (different
roles, focus order, keyboard)? **Yes → a new block** (the `as="menubar"` smell); **only adds → same block,
re-skinned by composition**. A purely-cosmetic prop matrix should be **theme tokens/CSS**, not a trait.

## Method

A Sonnet sub-agent scanned all 81 block JSONs' `traits` + attribute surface and proposed flags; **each flag
was then adversarially verified on the main loop against the actual file *and* the prior-decision record**
(the failure mode this guards against: a mechanical rule-match that re-opens a settled ruling — #1411 below).

## Verdict — interfaces are compliant

**No unaddressed interface-level a11y-contract violation found.** Of 79 clearly-compliant blocks, the
variation surface is behavioral or add-only (adds aria, adds keyboard, adds a slot/icon, busy/loading state,
data strategy). The one role-changing trait is an **explicitly-ruled projection exception**, and three traits
are **impl-dependent** (their compliance is a FUI-conformance question, which #1795 itself assigns downstream:
*"whether a given composed variant honors it is a FUI/Plateau conformance-run concern, not a WE-shipped proof
matrix"*).

### Ruled exception — NOT a violation (the audit's one false positive, refuted)

- **`data-grid` · `withHierarchyProjection`** — switches `role="grid"`→`role="treegrid"` and adds Right/Left
  expand-collapse arbitration. On the bare #1795 developer test this *looks* like a role+keyboard change → new
  block. **But [#1411](/backlog/1411-treegrid-hierarchical-data-grid-standard-placement/) (ratified
  2026-06-21, Fork 1a) already adjudicated exactly this case and ruled treegrid a *hierarchy projection on
  data-grid, not a new block*** — the rationale (recorded in the block JSON
  `we:src/_data/blocks/data-grid.json` `treegridIsAProjectionNotABlock`): APG's treegrid *is* the grid pattern
  with hierarchical rows (same `role=row`/`gridcell`, same roving tabindex, same cell-navigation); the only
  net-new behaviour is the Right/Left arbitration (additive), and a separate block would duplicate the whole
  movement engine for one rule. So this is a **documented, reasoned carve-out**, not an unaddressed violation.
  No remediation card.
  - **Rule-hygiene observation (no card, low value):** #1795's terse "role/keyboard change → new block"
    has a legitimate named exception in #1411 (a role-*projection* that stays add-only over the base movement
    model). The reconciliation already lives in the block JSON; #1795's prose could one day cite treegrid as
    the canonical "projection ≠ new-role" carve-out, but it is not contradictory in practice.

### Impl-dependent — a FUI-conformance check, not an interface fix → carved to one card

These three traits' #1795-compliance cannot be decided from the WE interface alone; it depends on the FUI
impl (DOM reorder vs CSS `order`; whether base `aria-disabled`/focus exclusion is retained). Per #1795 that is
a FUI/Plateau conformance concern. Filed together as **#1875** (FUI):

- **`action-button` · `withPlatformOrdering`** — *"Reorders action groups based on OS conventions (macOS:
  primary last, Windows: primary first)."* If implemented as a DOM reorder it changes focus/tab order (a
  contract change); if implemented as CSS `order` it is visual-only and compliant. **Constrain the impl to
  CSS `order`** (or model platform-ordered layouts as a distinct block).
- **`tabs` · `withReorderableTabs`** — *"Enables drag-to-reorder for tab triggers."* User-initiated reorder is
  arguably additive (the focus order correctly tracks the new DOM order); flag only if the reorder mutates the
  base tablist focus model in a non-user-initiated way. Verify.
- **`workflow` · `withNonLinearProgression`** — *"Steps can be visited in any order; all validated on final
  submit."* If the base workflow locks future steps via `aria-disabled` / focus exclusion, this trait likely
  *removes* that (a subtractive aria/focus change). Verify what it does to step `aria-disabled`.

No `visual-prop-matrix` flags: all cosmetic variation in the corpus is already expressed as add-only traits or
theme tokens, not prop-matrix config.

## Outcome

- WE block interfaces **pass** #1795 at the interface level (no remediation card against any block interface).
- Impl-level verification of the 3 ambiguous traits → **#1875 (FUI conformance)**.
- The single role-changing trait (treegrid) is a **ratified projection exception (#1411)**, correctly modeled.
