---
kind: task
status: resolved
blockedBy: ["170"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# Document @frontierui/plugs — unplugged-first usage, plugged-as-POC, per-plug API reference

Write proper documentation for the plugs runtime in its new home (@frontierui/plugs): lead with the unplugged, non-invasive library API (register/upgrade/downgrade) as the supported real-app surface; present the plugged bootstrap mode as a POC/demo only; and give a per-plug API reference. Reflects the [Constellation placement](docs/agent/platform-decisions.md#constellation-placement) rule (origin #606) that plugs is implementation owned by Frontier UI and that unplugged is the canonical way to consume it.

## Progress

- Rewrote `fui:plugs/README.md` (the doc's home is the FUI plugs runtime):
  - **Corrected the package identity** — `@frontierui/plugs` throughout (the old README used the stale `@web-everything/plugs` name) — and added the constellation-placement framing (plugs is FUI-owned impl, not a WE standard; WE holds the contracts/conformance), linking `we:docs/agent/platform-decisions.md#constellation-placement`.
  - **Leads with Unplugged** as the supported real-app surface: the `register` / `upgrade` / `downgrade` library API (non-invasive, no global mutation), a worked example, the `Plug` contract (`localName` + `upgrade` + optional `downgrade`, validated by `isPlug`), upgrade-in-registration-order / downgrade-in-reverse semantics, and the full unplugged API table.
  - **Demotes Plugged bootstrap to POC/demo only**: the `fui:plugs/bootstrap` global-patch entry + the per-family `applyPatches`/`removePatches`, explicitly flagged as global-mutating proof-of-concept, not the app path (the inversion #638 asked for — the old README led with plugged mode).
  - **Per-plug API reference**: a table of all 18 families with what each provides + its `@frontierui/plugs/<family>` entry; dropped the stale migration-status tables.
- Doc-only; no source/gate impact. WE `check:standards --scope=batch-0622` shows no error from this changeset (one concurrent-session error on the unrelated #1548 stepped over).
