---
kind: story
size: 5
parent: "2162"
status: resolved
blockedBy: ["2172"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# Producer stop-at-push: lanes stop at pushed+queued+manifest instead of integrating inline

The other half of the #2162 relocation. Wire the /workflow orchestrator (we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js Phase 4) and solo #2123 lanes to STOP at 'lane pushed + we:scripts/backlog.mjs queue + we:.lane-manifest.json written' rather than merging inline — so the deferred drain (#2173) owns all landing. Gated behind the drain core being proven.

## Progress

Behind a **`DEFERRED_DRAIN` flag (`args.deferredDrain`, default OFF)** — the inline integrate (Phase 4b–4h) stays the proven fallback until the drain is proven end-to-end.

- **Manifest writer** — new we:scripts/lane-manifest-write.mjs (the producer-side WRITE call-site): builds via the pure we:scripts/readiness/lane-manifest.mjs primitive (#2163), validates BEFORE writing (refuses an invalid manifest, exit 3), writes we:.lane-manifest.json impl-first/WE-last with WE carrying the resolve. Test: we:scripts/__tests__/lane-manifest-write.test.mjs (+3).
- **/workflow Phase 4** — when the flag is ON, `laneItemPrompt` gains step **3c**: each concurrent lane writes its manifest (via the CLI) into the WE lane commit (amended onto the resolve commit — a one-sided ADD) before pushing. Phase 4 then **early-returns** a deferred branch that QUEUEs each pushed lane (we:scripts/backlog.mjs `queue <n> --lane=<weRef>`), REOPENs any unpushed item (active→open, the #2072 reconcile), commits the queue token, and publishes main — **without integrating**. Lane refs are PRESERVED for the drain. The inline path below is byte-for-byte the OFF path (early return, no wrapping).
- **Scope** — the item title is "**LANES** stop at pushed": deferral covers the concurrent lane producers. Serial (non-lane, in-place) items still land inline and are logged when they occur under the flag. The **solo #2123** landing uses the SAME two primitives (we:scripts/lane-manifest-write.mjs + we:scripts/backlog.mjs `queue --lane`) instead of we:scripts/pr-land.mjs; the /pr skill (an untracked, regenerated file) is not edited here — the durable wiring is the two CLIs.

Land the queued couples with the #2173 monitor loop (we:scripts/lane-drain.mjs `drain`/`watch`).
