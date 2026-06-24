---
kind: story
size: 5
parent: "746"
status: open
blockedBy: ["1731"]
dateOpened: "2026-06-22"
tags: []
---

# Wire the WE author-mode-source artifact into the live FUI workbench (transport + declarative-component blocks)

Follow-up to #818 (the author-mode emit foundation, placement #954). The WE half ships: a `serve()`
build-emit (`we:scripts/gen-author-mode-source.mjs`) + committed, drift-tested `we:src/_data/authorModeSource.json`;
FUI ships the consuming output-tabs panel (`fui:workbench/authorMode.ts`, rendered by `fui:workbench/mount.ts`
when a `WorkbenchBlock` declares `authorSource`). Two residuals remain, both real wiring (no fork): **(1)
Transport** — feed the WE-committed artifact to the FUI registry without a hand-synced copy (a sibling
`../webeverything` build read or a published artifact) so the panel stays in sync with WE's `serve()` by
construction; **(2) Attachment** — the only workbench block today (`auto-complete`) is an imperative CEM
component with no declarative `<component>` definition, so nothing carries `authorSource` live yet; register
the `componentCases` declarative blocks (or attach author-source to blocks that have a definition). Only
rendered text + diagnostics cross the #700 seam (FUI never imports `serve()`).

> **Update 2026-06-24** — the Attachment fork is resolved: **#1701 ratified (a)**, relaxing the `WorkbenchBlock` contract so a block may be source-only (`authorSource`/`cem`, no `load`/`create`) — codified at `we:docs/agent/platform-decisions.md#source-only-workbench-block`. `blockedBy` repointed `1701 → 1731`: the *contract* is settled, but the **acquisition mechanism** (hardcode 9 source-only `WorkbenchBlock` literals vs resolve block shape from the FUI `/_maas/` serve URL) is decided by **#1731** — Attachment should align there first to avoid hardcode-then-rip. Transport (residual 1) stays flat and independent of #1731.

## Pre-flight (batch-2026-06-22-1615-1208) — Transport is flat, but Attachment hides a fork → not claimed

Traced the real tree before claiming. **(1) Transport** is flat as described — a sibling `../webeverything`
build-read of `we:src/_data/authorModeSource.json` into `fui:workbench/registry.ts`, clear default (the
published-artifact alternative is the #700/#907 end-state, separately tracked). **(2) Attachment is NOT
"flat wiring (no fork)"** as the body assumed: `we:src/_data/authorModeSource.json` carries 9 declarative
`<component>` **cases** (`user-card`, …) but they exist as **no `WorkbenchBlock`** — the workbench registers
only the imperative `auto-complete` (`fui:workbench/registry.ts`), which has never instantiated a declarative
`<component>`. To make a case carry `authorSource` *live*, the workbench needs **either** (a) the
declarative-component runtime (`fui:plugs/webregistries/declarativeRegistry.ts` /
`fui:compiler/src/component-transform/declarative.ts`) wired into `fui:workbench/registry.ts` so a `<component>` definition
becomes a live `create()`-able block, **or** (b) a new *source-only* `WorkbenchBlock` shape (the panel is
source-only — no live render — so a block could carry `authorSource` without a `create()`, but the current
`WorkbenchBlock` contract requires `load`/`create`). That's a genuine design call on how the workbench hosts
a declarative-component case — file it as a `kind: decision` (or pick the source-only-block default) before
landing. **Not claimed** in this batch — the batch had already hit a hard stop (the #1621 badge fork), and
this is the second buried fork, so no flat independent item remained. Transport-half stays ready; Attachment
needs the workbench-hosting decision first.
