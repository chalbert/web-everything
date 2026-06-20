---
kind: story
size: 3
parent: "1257"
status: open
dateOpened: "2026-06-20"
tags: []
---

# Register native Popover API as resolver for WE overlay/disclosure/dialog behaviors

The Popover API reached Baseline Widely Available (Apr 2025) — the strongest native-first trigger (#031). Audit the overlay-shaped intents and blocks (disclosure, dialog, tooltip and menu surfaces) and register the native popover attributes as the capabilityMatrix resolver impl, demoting any hand-rolled or polyfilled overlay path to opt-in. Surfaced by the 2026-06-20 platform-standards watch (#1257). Per the native-first floor, a now-widely-available native capability becomes the default impl and the library path an enhancement.
