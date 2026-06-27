---
kind: story
size: 5
parent: "746"
status: open
blockedBy: ["1865"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-27"
tags: []
---

> **Pre-flight (batch-2026-06-26-1732-1696) — transport premise is dead; re-pointed `blockedBy: ["1752"]`.**
> Two later rulings invalidated this item's "the WE half ships a committed artifact; just wire transport"
> framing: **(1)** #1730 **deleted** the WE MaaS serving runtime per the #1282 zero-impl rule — both
> `we:scripts/gen-author-mode-source.mjs` and the committed `we:src/_data/authorModeSource.json` are **gone**,
> so the residual-1 "sibling read of WE's committed artifact" no longer has an artifact to read. **(2)** #1731
> ruled (Fork 1a) the source/CEM bytes now cross via **FUI's own `/_maas/` HTTP data route** (dev:
> live-generated in the FUI MaaS middleware in-memory; prod: a build-emitted FUI-deployable copy), **not** a
> read of WE's tree. That makes the generator a FUI concern and routes both residuals through the FUI MaaS
> loader + thin-descriptor registry that #1731 spun out as **#1752** (open, size 8). Per this item's own
> "align there first to avoid hardcode-then-rip" note, the consumption wiring must follow #1752's loader/route
> — so this is `blockedBy: ["1752"]` (was `[]`). Released unbuilt; re-scope the body to the FUI-served model
> when #1752 lands.
>
> **Update (batch-20260626-1811-1817-1819 close):** #1752 has **landed** (resolved, graduatedTo 746), so the
> blocker is cleared (`blockedBy: []`). This is now ready to **rescope + build** — not blocked, just stale-bodied:
> re-scope both residuals onto #1752's FUI `/_maas/` loader + thin-descriptor registry (the WE artifact is gone
> per #1730), then wire the workbench panel to read block descriptors from the served URL. A focused FUI session.
>
> **Claimed + released unbuilt (batch-2026-06-26-1813-1208-1618) — it's not clean wiring; two small design sub-calls block the build.** Traced the FUI tree: the 9 `<component>` case definitions relocated into FUI as `fui:blocks/renderers/component/__fixtures__/component-cases.ts` (the SoT), and FUI can lower a def to **3 of the 5** author-mode forms — `declarative` (the def text), `wc-class` (`fui:blocks/renderers/component/declarativeComponent.ts`), `functional` (`fui:blocks/renderers/functional/functionalComponent.ts` `generateFunctionalSource`) — but there is **no `html`/`jsx` source-text emitter and no `lossy`/`diagnostics` computation** in the tree. So generating `AuthorModeSource` for source-only blocks needs **(a)** a form-set decision (build the missing `html`/`jsx` emitters + lossy signal, or scope the panel to the 3 forms FUI faithfully emits) and **(b)** a generation-home decision (build-emit JSON the registry carries vs a live `/_maas/` author-source endpoint — note the `/_maas/` route in `fui:vite.maas.config.mts` today serves only consume-mode *wrapper* bytes, not author-mode *source*). Both are small but real calls — `/prepare` or a focused FUI session pins them, then builds. Released `active → open`; FUI-locus.

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
