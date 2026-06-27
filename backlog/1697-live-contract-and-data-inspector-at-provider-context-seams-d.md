---
kind: story
size: 8
parent: "142"
status: open
locus: plateau-app
humanGate:
  kind: review
  what: >-
    Acceptance is a LIVE dev-browser surface — "at each provider/context seam show the declared contract
    beside the live value and validate continuously, flagging the offending path on drift" — whose
    verification is hands-on interaction in the running app (observe live seam values, trigger drift, confirm
    the flagged path), not a headless unit check a serial batch can perform. Same bucket as siblings #1695/#1696.
    Two substrate residuals a focused session must also close: (1) the body's "Registers against the #1636 lens
    primitive" is stale — #1636 (role-scoped lenses) resolved with graduatedTo:none (a concept ruling, no built
    primitive), so the inspector must define its own dev-browser registration or that primitive must be built
    first; (2) #1700's per-seam value-contract lives in we:webcontexts/contract.ts and is NOT yet wired into
    plateau's SeamContract (plateau:src/platform-manager/types.ts carries only protocol/providerTier/
    consumerRequires) — wire it so "declared contract beside live value" has a declared shape to read.
    Needs a focused session driving the running app.
dateOpened: "2026-06-23"
tags: [dev-browser, inspector, seams, contract-validation]
---

# Live contract and data inspector at provider/context seams (dev browser)

> **Pre-flight (batch-2026-06-26-1793-1697) — `humanGate: review` added.** A live dev-browser inspector whose acceptance is hands-on verification in the running app (not headless), exactly like #1695/#1696. Pre-flight also found two stale-foundation residuals (folded into the gate's `what`): #1636's "lens primitive" graduatedTo:none (never built), and #1700's value-contract (in `we:webcontexts/contract.ts`) is not yet wired into plateau's `SeamContract` (`plateau:src/platform-manager/types.ts`). A focused dev-browser session owns this.

Build story for the live contract/data inspector (#1632, ratified go — cluster's cleanest delta). At each provider/context seam show the declared contract beside the live value and validate continuously, flagging the offending path on drift. Seam topology is introspectable (#400 resolved); the over-time/snapshot half is blocked by #1667 (trace/replay), and the point-in-time half is blocked by the declared per-seam value-contract [#1700](/backlog/1700-webcontexts-contract-declared-per-seam-value-contract-for-li/) (webcontexts ships the runtime but declares no per-seam value shape yet). Registers against the #1636 lens primitive. Home plateau:dev-browser.
