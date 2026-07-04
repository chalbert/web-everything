---
name: project_fui_vendor_deps_quarantined_subpackage
description: "FUI vendor framework deps (react/vue) go in the consuming sub-package's own package.json — never root fui:package.json, never the shipped bundle"
metadata: 
  node_type: memory
  type: project
  originSessionId: 85821b29-1b68-4252-9b8f-2599c1d09d4e
---

FUI is a granular npm-workspace of sub-packages (`@frontierui/blocks`, `@frontierui/plugs`, workbench, …; #658/#693). **Vendor framework deps (react/react-dom/vue) belong in the OWN `package.json` of the single sub-package that consumes them** (e.g. `fui:workbench/package.json` for the wrapper live-test) — never the root `fui:package.json`, and never the shipped `@frontierui` bundle (framework-free invariant, #955-B).

**Why:** quarantining vendor deps to one sub-package keeps the shipped bundle framework-free and stops heavy framework deps leaking into the root manifest / every consumer. "in the repo" ≠ "in the root package.json" — they're orthogonal.

**How to apply:** when an item says "add X as devDeps," resolve WHICH sub-package's manifest, never default to root. The wrapper generator itself is FUI-owned tooling, not a WE standard ([[project_generator_is_tool_not_we_standard]]). Caught on #1030 where the notes wrongly tracked react/vue against root `fui:package.json`. Constellation context: [[reference_repo_constellation]].

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#framework-free-core-vendor-segregation` (the statute is source-of-truth; the `#NNN` above is provenance, not the reference).
