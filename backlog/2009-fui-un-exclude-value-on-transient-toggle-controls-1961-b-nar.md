---
kind: story
size: 2
status: open
dateOpened: "2026-07-01"
tags: []
---

# FUI: un-exclude value on transient toggle controls (#1961 b-narrow) so identity survives un-renamed

Ratified in #1961 Fork 1 (b)-narrow: stop excluding the identity attribute on the two transient toggle controls (FilterChipElement value; ButtonTransientElement identity) so the base copies it verbatim onto the survivor and consumers read the same attribute name pre- and post-upgrade. Keep selected-to-aria-pressed as the one forced a11y state rename. Add the we:block-standard.md:271 carve-out cross-ref recording that single exception. Free, no sync burden, statute-honoring.

**#1962 context (2026-07-01, wrapper-first):** button and filter-chip are moving off transient to persistent light-DOM under the FUI transient→wrapper migration. Once those two blocks migrate, there is no transient survivor to preserve identity across, so this fix becomes **moot for them**. It stands as a near-term mitigation only until the migration lands; if the migration ships first, close this as superseded.
