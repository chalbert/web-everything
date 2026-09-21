---
bornAs: x51jrak
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/conveyor/tick-once.mjs", "we:scripts/operations/host-sampler-install.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# tick hook wiring emitted as data: a settings fragment, orchestrator-only, never applied by the build

SLICE of the shared-state tick after tick-once. Run one throttled silent tick from SessionStart and UserPromptSubmit in orchestrator sessions only (the worker marker set at every spawn). The build must emit the Claude settings hook fragment as DATA (print, lint, status, uninstall commands modelled on the host sampler installer) and NEVER edit the operator settings or load anything; the operator applies it. Also a timer or completion wake source for the gap after the last prompt, since hooks give no tick then. DESIGN TO SETTLE: the fragment shape and where it merges, how a worker is told from an orchestrator when spawning inherits environment, and the idle-wake source. ACCEPTANCE: the fragment lints; a status command reports whether it is applied; a test proves a worker session never ticks.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
