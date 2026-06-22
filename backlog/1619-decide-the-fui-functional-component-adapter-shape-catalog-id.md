---
kind: decision
parent: "081"
status: open
dateOpened: "2026-06-22"
tags: []
---

# Decide the FUI functional-component adapter shape: catalog identity vs the #977 functional retirement + #700 emit placement

Blocks #1602 (land the FUI functional-component adapter) → #313 (add it as a MaaS FORMS entry). Surfaced
during batch-2026-06-22-764-1602 pre-flight/work: the card reads as a mechanical "register a FORMS entry,"
but landing it forces three unprepared design calls that touch a ratified decision, so it cannot be built
without a ruling.

## What you have to decide

1. **Catalog identity vs the #977 retirement.** #974/#977 (both **resolved/ratified**) made `functional` a
   **retired alias** in the FUI MaaS form catalog (`fui:tools/gen-wrapper/wrapperFormCatalog.mjs`), folded
   into `react-wrapper` because the legacy WE `functional` form is "accidentally React-only and predates the
   polyglot generator." But that catalog is **consume-mode only** (genWrapper: wrap a WC *for* a framework).
   The #1602 adapter is the **opposite direction** — an **authoring** form (author a component as a
   functional component that **lowers to** a standard WC). Decide: does the authoring form get a **new
   first-class id** (e.g. `functional-authoring`), **un-retire `functional`** as authoring (re-opening #977),
   or live in a **separate authoring catalog** distinct from `WRAPPER_FORMS`?

2. **#700 emit placement.** WE's `serve()` **already emits** the functional authoring source
   (`generateFunctionalSource`, the `functional` `ServeForm`), but per #974/#977 the **FUI MaaS endpoint is
   its own runtime and never imports WE's `serve()`/`moduleService`**. So either FUI grows its **own**
   functional emitter (parallel to genWrapper — a real build), or it **consumes WE's data-emit** (the #954
   author-mode precedent: WE commits the source as data, FUI serves it). Decide which — it determines whether
   #1602 is "build a FUI emitter" or "wire a WE artifact."

3. **Adapter input/output contract.** The plan (`we:plans/functional-component-adapter.md`) is a brain-dump
   ("first version very simple, just a simple render"), not a spec. Pin the v1 input (CEM? `<component>`
   definition? functional source string?) and output (a servable WC artifact via `@frontierui/jsx-runtime`'s
   `defineElement`), so #1602 has a buildable contract.

Once ruled, #1602 builds the adapter and #313 registers it. The `@frontierui/jsx-runtime` runtime already
exists (JSXRenderer + auto-define) — this decides the *adapter/emit* layer around it, not the runtime.
