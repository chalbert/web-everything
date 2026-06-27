---
name: adapter-as-normalization-hub-lossy-internal-pivot-never-project-facing
description: "A second adapter direction beyond lowering — ingest incumbents' configs bottom-up into a lossy internal pivot the project never sees; treat lossiness as comparative value, not a defect."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5680caac-1c91-4fd9-b9c1-0670abaa6c18
---

**There are two adapter directions. Beyond the familiar *lowering* adapter (lower a WE declaration down into a tool's native config), there is the *normalization-hub* adapter: ingest incumbents' own configs bottom-up into an internal pivot model, where the pivot is the tool's private memory and the project never references it.**

Shape (from the dev-authoring-preferences decision, backlog #150 — the "validation devtool"):
- One adapter per incumbent tool (eslint / oxlint / Sheriff / dependency-cruiser / custom), translating *into and out of* a normalized internal rule-model.
- The project authors nothing in the pivot format — it's internal memory only. This is exactly what gives it **zero lock-in** (see [[feedback_minimize_lock_in_protocol_only_lock]]).
- Capabilities it unlocks: **see** (one unified list of every rule you have, each with an example of what it catches), **re-export** (emit the equivalent config for a different tool), **shop** (browse which tools cover which rules, and pick tools by the validation you want).

**The lossiness is the product, not the liability.** Cross-tool rule semantics are not 1:1 (eslint's rule ≠ biome's exactly; Sheriff's boundary model has no eslint twin). Reframe that as a **comparative view** — "here's how each tool takes on the same concern, here's where they diverge, here's what only Sheriff can express." Tag each mapping with a confidence/coverage level; the "no equivalent" cells are the *most* valuable for shopping, not the embarrassing ones.

**Why:** It dodges the "yet another standard" objection entirely — the direction is bottom-up (adapt to tools you already use), so nothing is imposed on the project. Fits the repo's registry+adapter pattern and auto-rendered catalogs ([[feedback_catalog_auto_render]]); the "shop for tools" capability maps to a Technical Configurator domain ([[project_technical_configurator]]), gated on the configurator maturing past POC. Extends the dev-surface thesis (backlog #140) from runtime to authoring-time.

**How to apply:** When a concern is already well-served by incumbents, don't reinvent or impose a format — write a normalization hub that adapts to them and stays disposable. Use a lossy, confidence-tagged pivot and surface the differences as insight. Reserve the lowering-adapter direction for when WE genuinely owns the declaration.
