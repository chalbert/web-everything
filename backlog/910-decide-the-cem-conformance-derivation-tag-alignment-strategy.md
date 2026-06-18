---
type: decision
workItem: story
size: 3
status: resolved
codifiedIn: docs/agent/platform-decisions.md#tagname-naming
dateOpened: "2026-06-18"
dateResolved: "2026-06-18"
tags: []
---

# Decide the CEM-conformance derivation + tag-alignment strategy for the #840 FUI drift gate

The #840 CEM-conformance gate (analyzer over FUI source vs WE's authored CEM) hit two design walls at claim (batch-2026-06-18). **(a) Derivation:** the stock `@custom-elements-manifest/analyzer` detects ZERO of FUI's elements — FUI uses split + parameterized registration — so deriving FUI's CEM needs a custom analyzer plugin or another source. **(b) Alignment:** #841 set WE's tag to `we-<id>`, but FUI's 7 real tags are legacy bare kebab differing even in stem (we-transient-component↔auto-heading). So tagName-drift red-fails all 7 unless FUI migrates to the ruled tags first — or the gate compares member-surface only. Blocks #840.

See [#840](/backlog/840-cem-conformance-gate-run-the-analyzer-over-fui-source-and-fa/) for the full probe (empirical analyzer run, the 7 tag mismatches). The two walls were verified against the tree, not assumed.

## Resolution — ratified 2026-06-18 (provisional)

(a) Derive FUI's CEM via a **custom analyzer plugin** that understands FUI's split/parameterized registration (the stock analyzer detects 0 of those elements; no alternate source is cleaner). (b) The #840 drift gate compares **member-surface only** at first cut, **deferring tag-equality** until #908's `we-` migration lands (don't couple the gate's first cut to a 7-tag rename). Unblocks #840. **Provisional** — both seams carry real unknowns; revisit (a) if the plugin proves brittle, (b) once the #908 migration completes. Reversible.
