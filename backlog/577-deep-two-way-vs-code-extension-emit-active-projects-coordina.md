---
type: idea
workItem: story
size: 8
status: open
blockedBy: ["576"]
dateOpened: "2026-06-14"
locus: plateau-app
tags: [dev-browser, ide-bridge, vscode-extension, plateau, two-way-sync]
---

# Deep two-way VS Code extension — emit active projects + coordinate patch work (carved from #562 Fork 2)

Carved from [#562](562-dev-browser-source-awareness-ide-bridge-map-deployed-dom-bac.md) Fork 2 (ruling **A**,
separation bias): the **richest IDE-bridge provider**, kept out of the must-have substrate
([#576](576-ide-bridge-provider-registry-passive-file-line-jump-file-sys.md)) and given its own home so the
foundation stays shippable and this layer is independently prioritized.

A VS Code extension running a **localhost HTTP/WS server** the dev-browser tab talks to, providing the
two-way capabilities the passive/FS-Access providers can't:

- **Apply patches** into the live workspace via `WorkspaceEdit` / `workspace.applyEdit` (undoable, event-firing)
  rather than a raw file write.
- **Emit which projects are open / active** (`workspace.workspaceFolders`, per-window) so the browser knows
  where a deployed app's source lives.
- **Two-way coordination** — conflict with unsaved edits, concurrent-fix arbitration, editor↔browser sync,
  custom `vscode://publisher.ext/…` URI routing (`registerUriHandler`).

Precedent: **Stagewise** (Express+WS in the extension host). Registers as the top-precedence provider in
#576's bridge registry when installed. **Constellation:** Plateau dev-browser product (#475/#091). Grounded in
[`source-awareness-substrate`](/research/source-awareness-substrate/). Size 8 — candidate for a `/split` pass
(server+protocol / patch-apply / active-project model / conflict handling are natural slices).
