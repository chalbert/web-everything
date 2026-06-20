---
kind: story
size: 1
status: resolved
dateOpened: '2026-06-02'
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags:
  - browser-support
  - verification
  - reference
relatedReport: reports/2026-06-02-native-platform-substrate.md
---

# Verify bleeding-edge browser versions in the substrate table

The native-substrate support table marks several rows approximate against a Jan 2026 cutoff — Safari command/commandfor, dialog closedby, and anchor positioning in Safari/Firefox. Verify against current caniuse/MDN so the table is citable.

## Progress (2026-06-13) — resolved

Verified the bleeding-edge rows of [we:reports/2026-06-02-native-platform-substrate.md](../reports/2026-06-02-native-platform-substrate.md) against caniuse/MDN (the version table lives only in that report — grep-confirmed no duplicate). Corrections:

- **CSS Anchor Positioning** — Safari `❌`→**26.0**, Firefox `🚩`→**147** (Jan 2026). Now interoperable → **Baseline 2026** (`❌`→`✅ '26`).
- **`command`/`commandfor` (invokers)** — Safari `26`→**26.2**, Firefox `🚩`→**144**. Now interoperable → **Baseline 2026**.
- **`<dialog closedby>`** — **the Jan-2026 "Safari 18.4" was wrong** (that's the `requestClose()` method, not the `closedby` attribute): Safari does **not** support `closedby` through Safari 27 (Interop 2026 item) — corrected to `❌`. Firefox `🚩`→**141**. Stays non-baseline (Safari gap).

Re-titled the caption (verified date) and rewrote footnote ²; added footnote ⁴ for the `closedby` Safari correction. Gate green; no other surface carries the version table.
