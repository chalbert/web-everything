---
kind: story
size: 5
parent: "757"
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# FUI catalog data: auto-derive or drift-check blocks/plugs/traits from disk

`fui:blocks.json` (23), `we:plugs.json` (9), and `we:traits.json` (13) are hand-maintained lists. They are in sync with the on-disk artifacts *today*, but nothing enforces that — the same drift hazard that left `fui:adapters.njk` (#758) showing a hardcoded set. Close the gap so these catalogs can't silently rot: either auto-derive the data from disk (the `fui:src/_data/demos.js` glob pattern) or add a `check:standards`-style guard that fails when the JSON and the real `blocks/` / plug / trait files disagree.

## Recommended approach — derive vs. check

Go with a **drift-check guard**: keep the curated JSON (it carries human summaries/protocol links that aren't trivially derivable), but add a test that diffs the JSON's ids against the on-disk artifacts and fails on a mismatch (missing or phantom entry). Lower risk, preserves the hand-written prose, catches drift loudly. (Full auto-derivation by globbing the source tree is a larger follow-up — blocks/plugs carry summary/protocol/weSpecPath fields that would first need to move on-disk or into a sidecar.)

## Decision (recorded 2026-06-16): **B — drift-check guard**

Per the recommended approach: keep the curated JSON and add a `check:standards` guard that diffs each
catalog's ids against the real on-disk artifacts. Implemented in
`fui:frontierui/scripts/check-standards.mjs`:
- **plugs** — 1:1 with `plugs/<id>/`, bidirectional (phantom + missing both error).
- **traits** — globbed from `blocks/**/traits/*.ts` (filename = trait name, first char lower-cased),
  bidirectional against `we:traits.json` names.
- **blocks** — the grouped dirs don't map 1:1 (the caveat), so each `fui:blocks.json` entry now declares a
  `sourcePath` (the real id↔path map); the guard errors if a `sourcePath` is missing on disk (phantom /
  renamed). A genuinely new on-disk block surfaces when its entry + `sourcePath` are added.

## Acceptance

- Blocks, plugs, and traits catalogs are protected against silent drift (a missing or phantom entry is caught — by a guard, or made structurally impossible by derivation).
- Decision A or B recorded in the item before implementation.

## Notes

- Lowest-priority slice of #757 — the catalogs are correct now; this is rot-prevention.
- Reference: `fui:src/_data/demos.js` is the existing auto-derived catalog to mirror.
- Mapping caveat for a guard: `blocks/` dirs are grouped (e.g. `stores/`, `parsers/`) and don't 1:1 match `fui:blocks.json` ids — the check needs the real id↔path mapping, not a naive dir-name compare.
