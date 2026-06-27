---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: src/block-pages.njk
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

## Progress
Restructured `we:src/block-pages.njk` (the per-block doc template, paginated over the block registry) into two tiers, no per-block hand-authoring:
- **Tier 1 — "Using this block"** (generated, user-facing): **Overview** (`block.summary`), **Live example** (`block.fuiDemo`), **Quick start** (first Web Case's copy-paste HTML), **API reference** (the derived attributes/properties/events/slots/CSS-props/parts tables — same `we:src/_data/blocks/` source `gen:cem` projects), and **Common patterns** (the remaining Web Cases).
- **Tier 2 — "Implementer reference"** (kept, secondary, visually separated): the existing `we:src/_includes/block-descriptions/` prose + WE Standards overlay, Implements/Composes Intents, Traits, Accessibility & Web Standards, Component tokens, Anatomy — reordered under a labelled divider, every panel's graceful-absence guard preserved.
- Verified on representatives: `autocomplete` (demo+attrs → Overview/API/demo + Implementer reference) and `for-each`/`resource-loader` (5 cases each → Quick start + Common patterns). Full `eleventy` build clean; `check:standards` green.

_Converted from `we:plans/doc-generation-notes.md` (#1792 hidden-docs cleanup)._
