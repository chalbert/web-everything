---
kind: decision
size: 2
status: resolved
dateOpened: '2026-06-02'
dateStarted: '2026-06-07'
dateResolved: '2026-06-07'
codifiedIn: "docs/agent/platform-decisions.md#native-first-baseline"
tags:
  - polyfill
  - baseline
  - browser-support
  - policy
relatedReport: reports/2026-06-02-native-platform-substrate.md
---

# Set the polyfill baseline floor for the standards

Require a polyfill baseline (which legacy browsers?) or declare Baseline-2024 the floor and treat everything below as out of scope. Determines whether FACE / popover / :state() / :user-invalid are assumed or shimmed.

## Ruling (2026-06-07)

**Baseline-2024 is the floor.** Standards assume the modern platform primitives are present — FACE / `ElementInternals`, popover, `:state()` / `CustomStateSet`, `:user-invalid`, anchor positioning — and treat anything below Baseline-2024 as **out of scope**. We do **not** shim legacy browsers by default.

Polyfills become an **opt-in enhancement layer**: a consumer who needs older-browser reach adds a polyfill plug/trait themselves; the specs never carry a dual "native vs shimmed" contract. This keeps every substrate-dependent spec single-substrate and is consistent with the repo's native-first default (built-ins track the platform; libraries are opt-in).

Chosen over (a) requiring a global polyfill baseline — taxes every spec with a dual-substrate contract, contradicts native-first; and (b) per-feature floors — distributes the uncertainty instead of removing it. We can name a sub-Baseline exception later for a specific consumer if one ever needs it; that's cheaper than slowing every spec down now.

Recorded as **Hard rule #6** in [we:AGENTS.md](../AGENTS.md) so every author/agent inherits it; substrate detail stays in the related report.

This unblocks the substrate-dependent items, which can now drop their "...but what if the browser lacks X" branches: #024, #025, #030, #032, and all anchor-positioning / popover / `:state()`-based block work.
