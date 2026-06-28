---
name: project_crossorigin_import_keeps_devserver_clean
description: Live-test/workbench loads framework wrapper modules cross-origin so the running dev server never resolves the vendor dep —
metadata: 
  node_type: memory
  type: project
  originSessionId: 85821b29-1b68-4252-9b8f-2599c1d09d4e
---

Statute-restating body collapsed to a pointer (#1896) — the full rule (serve heavy/vendor deps from a **second origin** and cross-origin-import them; the imported module still mounts same-document; never restart the running dev server for a vendor dep) lives in the statute, which subsumes this body verbatim including the #1499 lineage and the #1030 human-gate removal.

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#cross-origin-dev-server-hygiene` (the statute is source-of-truth; any `#NNN` is provenance, not the reference). Related: [[project_fui_vendor_deps_quarantined_subpackage]].
