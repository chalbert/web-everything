---
kind: story
size: 5
status: open
dateOpened: "2026-06-26"
tags: [docs, website, blocks, dx]
---

# Two-tier block docs: a user-facing layer over the implementer spec

The current block doc pages (`we:src/_includes/block-descriptions/*.njk`) are **implementer specs** — standards alignment, framework research, design decisions, API internals. Valuable for contributors, but not what someone who just wants to *use* a block needs. A user wants: a quick overview, a live demo, copy-paste HTML examples, an attributes/events/CSS-props table, and common patterns ("how do I do X?"). The fix is a **two-tier** structure: a generated user-facing tier on top of the existing implementer tier.

Most of the user tier can auto-generate from data we already have — the block registry (`we:src/_data/blocks/`, summary + API) plus the existing demos — so this is largely wiring, not hand-authoring. Builds on the per-block live-demo work (#971).

## Build
- **Tier 1 (user):** overview (from the block summary), embedded live demo (from the block's demo), copy-paste snippet, an auto-built API table (attributes/events/CSS props), and a "common patterns" area.
- **Tier 2 (implementer):** the existing description page content, kept but clearly separated/secondary.
- Auto-generate Tier 1 from the block registry + demos wherever possible; minimize hand-authored per-block prose.

## Acceptance
- A representative block renders both tiers; the user tier needs no manual authoring beyond what's in the registry/demos.
- API table is derived, not hand-typed.
- `check:standards` green.

_Converted from `we:plans/doc-generation-notes.md` (#1792 hidden-docs cleanup)._
