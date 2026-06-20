---
kind: story
size: 3
parent: "1257"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/capabilities/popover.json
tags: []
---

# Register native Popover API as resolver for WE overlay/disclosure/dialog behaviors

The Popover API reached Baseline Widely Available (Apr 2025) — the strongest native-first trigger (#031). Audit the overlay-shaped intents and blocks (disclosure, dialog, tooltip and menu surfaces) and register the native popover attributes as the capabilityMatrix resolver impl, demoting any hand-rolled or polyfilled overlay path to opt-in. Surfaced by the 2026-06-20 platform-standards watch (#1257). Per the native-first floor, a now-widely-available native capability becomes the default impl and the library path an enhancement.

## Progress

Resolved 2026-06-20. **Audit of the overlay-shaped intents:**
- `popover` capability (we:src/_data/capabilities/popover.json) is already registered native-first
  (`baseline: "2024"`, `polyfill: "polyfillable"` = native default + fallback). Recorded its native-first
  resolver role for the overlay surfaces (dialog/tooltip/menu via the anchor intent) in its summary.
- `anchor` intent (we:src/_data/intents/anchor.json) — the overlay-positioning intent — already declares
  `requiresCapabilities: ["anchor-positioning", "popover"]`, so the overlay surfaces already resolve
  through native popover.
- `disclosure` intent correctly composes the `details`/`details-name`/`hidden-until-found` substrate (not
  popover) — its native-first resolver is `<details>`, already registered; no change.

So the WE-side standard already defers to native popover. The remaining "demote any hand-rolled/polyfilled
overlay path to opt-in" is a FUI **impl** concern (the overlay block impls live in `@frontierui/blocks`),
outside this WE-locus standards item — the contract here just affirms native-first as the default. Flipped
the front-A watch ledger (we:src/_data/nativeFirstWatch.json) `popover` → `registered: true` (metric 2/6).
Gate: no new errors from my files (2 pre-existing reds are concurrent sessions' untracked #1283 / #1254
report, not my changeset).
