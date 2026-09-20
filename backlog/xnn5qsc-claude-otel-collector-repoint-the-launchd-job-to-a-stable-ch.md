---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/operations/claude-otel-collector.mjs", "we:scripts/operations/host-sampler-install.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Claude OTel collector: repoint the launchd job to a stable checkout and keep its data in one shared root

PROBLEM (verified 2026-09-20): the collector launchd job points at the script path inside the primary checkout, where the file no longer exists (that checkout is far behind the prototype branch). The running process (started 2026-09-13) works only because it loaded the code earlier; any restart or reboot fails to start it. Its data goes to a checkout-local directory (claude-otel under that checkout dot-operations), so each lane clone can write a different root and a rollup silently misses lane-local data (known unfixed, noted in the collector code comments). DESIGN TO SETTLE BEFORE BUILD (strong design required): (1) WHERE THE CODE LIVES: the collector (we:scripts/operations/claude-otel-collector.mjs) exists on the prototype branch only; either graduate it to main (epic 3443 slice) or install from a dedicated stable clone that tracks the branch, as the host sampler does (we:scripts/operations/host-sampler-install.mjs is the pattern: install, uninstall, status, print-plist, plutil lint, never auto-load). (2) DATA ROOT: one shared root under the operator workspace operations directory beside the telemetry files, never per checkout; one-time merge of the existing day files with a verified line-count match and no deletion of the originals until the operator confirms. (3) NO-GAP SWAP: load the new job, confirm fresh records, then unload the old process; the exporter retries, so the swap must not drop more than one export interval; the operator approves the swap, the build never stops the running collector. (4) SAFETY: receiver stays on localhost, numeric counters only, never persist the logs channel or prompt content (existing guard); the missing authentication on the local receiver is an accepted single-operator risk, re-open it if this ever serves more than one operator. ACCEPTANCE: a status command reports script exists, process matches the plist, newest record age under a stated bound and the data root; a test lints the plist and fails when the script path is absent; after the swap new records land in the shared root.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
