---
name: Native-first principle for Web Everything defaults
description: Built-in defaults should align with web platform standards; third-party libs are opt-in enhancements
type: feedback
originSessionId: 632552c1-a19a-44e5-89e5-307b251ba792
---
**For Web Everything, the built-in/default implementation should align to and lean on web-platform standards (CSS Anchor Positioning, Popover API, etc.) wherever Baseline support allows; third-party libs are opt-in enhancements via adapters, not the baseline.**

**Why:** Web Everything exists to standardize web components and common patterns. The web platform itself is evolving (CSS Anchor Positioning hit Baseline 2026, Popover API hit Baseline 2024). Using platform features by default means: (1) zero extra JS in many cases, (2) automatic native performance + accessibility, (3) synergy with browser dev tools, (4) libraries remain *optional* opt-ins for advanced use cases (e.g. Floating UI's autoPlacement middleware for older browsers or niche scenarios). This builds a healthy dependency hierarchy: platform → optional libs, not platform → custom reimplementation → optional libs.

**How to apply:**
- In **Step 1 (Research)** of design-first.md, adopt native-first as the standing default for every standard, not just positioning. If the platform has a standard (CSS, Popover API, etc.), research it first.
- In the **feature-inventory table**, tier Tier-1 features should lean on platform standards. Tier 2+ features can be "basic built-in / better via adapter."
- In **Step 4 (Plan)**, set the default provider to use platform standards; adapters are for Tier 3 or older-browser fallback.
- When designing plugs and adapters, the minimal built-in provider should use platform features; adapters are thin bridges to libraries, not ground-up reimplementations.
