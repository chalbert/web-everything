---
name: project_technical_configurator
description: plateau-app Technical Configurator — data-driven multi-domain decision tool; add a domain via a seed + provider entry
metadata: 
  node_type: memory
  type: project
  originSessionId: e9b193dc-18f8-47b4-980f-d8025dab497b
---

The **Technical Configurator** lives in plateau-app (`src/technical-configurator/`, SPA route `/technical-configurator`), NOT in webeverything. It is a data-driven decision-support tool: a developer states OUTCOME requirements (per-axis acceptable value sets) and a pure engine (`compat.ts`) ranks strategies as Fits / Compromise / Won't-work. The concrete API/encoding is the *strategy* (the answer), never a requirement the user picks.

Structure: `types.ts` (Axis/Strategy/Domain), `seed-<domain>.ts` (the data), `presets.ts` (use-case → requirements), `provider.ts` (registers domains in a `DOMAINS` array — the swap seam), `configurator.ts` (vanilla-TS DOM, full re-render, localStorage), `compat.ts` (engine). `ordered` on an axis is **display-only** — the engine is pure set-membership; `policy` (correctness=fail-fast / fidelity=degrade) drives the verdict.

**To add a decision area:** author `seed-<x>.ts`, add presets to `presets.ts`, add one line to `DOMAINS` in provider.ts. Code touches needed beyond data: `PRESETS_BY_DOMAIN` + `REQUIREMENT_AXES_BY_DOMAIN` maps and `CONFIG_STUBS` in configurator.ts are keyed by domain id; a domain switcher renders only when >1 domain exists.

Domains so far: `change-tracking` (original) and `file-upload` (File Upload & Update — operationalizes the [[feedback_backlog_is_tracker]] file-update-component backlog item's transfer-strategy trait in webeverything). Part of the [[reference_repo_constellation]]: standard in WE, tool in plateau-app.
