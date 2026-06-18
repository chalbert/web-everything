---
type: decision
workItem: story
size: 2
status: resolved
codifiedIn: docs/agent/platform-decisions.md#tagname-naming
dateOpened: "2026-06-03"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-12"
tags: [terminology, gap-analysis, docs]
crossRef: { url: /research/collection-operations/, label: collection-operations research (local fix applied) }
---

# Decide whether to rename the "Native anchor" gap-analysis field repo-wide

**RATIFIED 2026-06-14 → A (rename repo-wide to `Native grounding`).** The discussion confirmed the
crux: "anchor" has one canonical owner — the **Anchor Intent** is literally CSS Anchor Positioning
(`anchor-positioning`, tethered tooltips/popovers/menus), the platform's own term, so renaming *it*
would coin away from the platform. The triage label was the metaphorical squatter ("the native API a
standard grounds in"). Freed the canonical owner by renaming the label. Executed as a mechanical prose
edit: `**Native anchor**` → `**Native grounding**` across the 10 gap files (006–013, 015, 016) plus
358's inline `Native anchor:`. Scope refinement vs. the original framing: 360 has no triage field (its
"anchor" uses are "edge-anchored", unrelated) and was left untouched; the camelCase `nativeAnchor` JSON
key is independent and untouched. This item retains its `**Native anchor**` mentions below as the
historical record of the old term.

**Prepared decision — ready to ratify.** A single binary terminology fork over existing repo state (no
greenfield design, so no web survey — the prepared shape here is the concrete-refs check). The
`**Native anchor**` triage label means "the native platform API the standard grounds in," and collides
with the positioning **Anchor Intent** ([we:intents.json:anchor](src/_data/intents.json)) — a real readability
snag on any page mentioning both. One fork, **bold** default below.

## The axis — what a rename actually touches (concrete scope)

The label is a **markdown-convention triage field**, not a parsed data key. It appears as `**Native
anchor**` in **12 backlog files**: the gap-* set —
[006](/backlog/006-gap-10-collection-ops-intent/),
[007](/backlog/007-gap-11-clipboard-dnd-files-intents/),
[008](/backlog/008-gap-12-disclosure-intent/),
[009](/backlog/009-gap-13-webpermissions-project/),
[010](/backlog/010-gap-3-theme-color-intent/),
[011](/backlog/011-gap-4-webpersistence-project/),
[012](/backlog/012-gap-5-webidentity-project/),
[013](/backlog/013-gap-6-focus-announcements/),
[015](/backlog/015-gap-8-view-transitions-protocol/),
[016](/backlog/016-gap-9-webcommands-project/) — plus the newer gap-derived blocks
[358](/backlog/358-toast-notification-block/) and [360](/backlog/360-drawer-sheet-block/).

**Key concrete finding (sharpens the call):** a repo-wide `grep` of `scripts/` shows **no tooling parses
the literal `Native anchor` string** — it is prose, not a field a generator/validator reads. The separate
`nativeAnchor` **camelCase JSON key** in [we:benchmarkCoverage.json](src/_data/benchmarkCoverage.json) /
[we:benchmarkCapabilities.json](src/_data/benchmarkCapabilities.json) is an *independent* coverage-matrix
field that a label rename would **not** touch and need not change. So the rename is a **bounded
prose-only edit of 12 markdown files** — cheaper and lower-risk than the original "13 files + any tooling"
framing implied. The collection-operations research page already renamed it *locally* to "Native
Grounding" / "native primitive" ([we:collection-operations.njk](src/_includes/research-descriptions/collection-operations.njk)),
establishing the preferred replacement term.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · Rename the field?** | **Rename repo-wide to `Native grounding`** (prose-only, 12 files) | Keep the label, rely on local disambiguation | High |

## Fork 1 — Rename the "Native anchor" field repo-wide, or keep it?

**Crux:** the collision with the Anchor Intent recurs on every gap page; a per-page disambiguating note
must be re-encountered by each future reader. The rename scope is now known to be prose-only (no tooling),
and a preferred term already exists from the local fix.

- **A. Rename repo-wide to `Native grounding`.** Touch the `**Native anchor**` label in the 12 files
  above to `**Native grounding**` (matching the already-applied collection-ops local rename). Removes the
  collision everywhere, one-time bounded cost, no tooling changes (the camelCase `nativeAnchor` JSON key
  is independent and stays).
- **B. Keep `Native anchor`, rely on local disambiguation.** Zero edits, but every gap page keeps the
  collision and each future reader re-encounters it; the local-note approach doesn't scale across 12 files.

**Recommended default: A — rename repo-wide to `Native grounding`.** The collision is a real, recurring
readability cost; the rename is now confirmed prose-only across 12 files (no generator/validator touched,
the `nativeAnchor` JSON key untouched); and the replacement term is already established by the
collection-ops local fix, so it's uniform rather than a fresh coinage. Trivial, bounded, high-confidence —
ratify and execute as one mechanical edit.

*Rejected:* B — defers a known recurring snag indefinitely for a near-zero saving.

*Graduation (on ratification):* a single agent-ready mechanical edit — `**Native anchor**` →
`**Native grounding**` across the 12 files — no `blockedBy` chain needed.
