---
kind: story
size: 5
parent: "1783"
status: resolved
locus: plateau-app
dateOpened: "2026-06-26"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: plateau-app/src/conformance-engine/conformanceVectors.ts (synchronous runner)
tags: [conformance, conformance-vectors, plateau, surface]
---

# Plateau-origin conformance-runner docs surface + end-to-end smoke proof

Re-scoped per #1788 (ratified (b)): the runner **stays in plateau** (shared multi-surface tool), so this builds the **plateau-origin** docs surface — **not** a FUI-origin bundle, and **no** engine re-home / `Finding` move. Stand up the headless-logic surface by which the WE docs site runs a synchronous vector suite against a binding and displays pass/fail, via one of #1788's two mechanisms (pick here): **widen mode-C's #765 trust allowlist to admit the plateau origin** (`fui:embed/in-document.ts` `setTrustedOrigins`), or **embed a plateau-hosted conformance iframe** (cross-origin, no #765 issue). Includes an end-to-end smoke proof with a trivial synchronous example vector + reference binding (NOT webpolicy — that arrives with #1294, consuming the #1789 synchronous binding variant). **Also carries the #1784 amendment**: update #1784's superseded "FUI-origin only" surface note to plateau-origin.

## Progress (resolved 2026-06-26)

**Delivered the runner-side foundation + end-to-end smoke proof** (the gating, testable core):
- **`plateau:src/conformance-engine/conformanceVectors.ts`** — `runConformanceVector` accessed `binding.clock` unconditionally, so the #1789 `SynchronousConformanceBinding` (facts→verdict, no clock) would crash. Made the clock **optional**: feature-detect it, skip tick/`runAll` for synchronous vectors, sample at t=0; typed the oracle factory `ConformanceBindingFactory<SynchronousConformanceBinding>` (accepts temporal **and** synchronous). The temporal deck path still passes — backward-compatible.
- **`plateau:src/conformance-engine/synchronous-conformance.smoke.test.ts`** — end-to-end proof: the plateau oracle runs a synchronous loan-policy (facts→verdict) suite against a clock-free binding, judges a conforming binding **clean**, and **catches** a wrong verdict. 4 cases; full `plateau:src/conformance-engine/` suite 21/21 green; clean tsc for the dir.

**Surface mechanism picked: the plateau-hosted iframe** (cross-origin runtime boundary — no #765 trust-surface expansion, no edge), over widening #765.

**Folded into #1294 (the visible docs page needs a real subject):** the actual eleventy docs page that *renders* a relocated runtime's conformance via the plateau iframe lands with #1294 — it brings the real subject (webpolicy), its binding, and its vectors; a throwaway demo page here would have no real subject. The mechanism is proven (this smoke run); #1294 wires the visible page.

**#1784 amendment** was applied at #1788 ratification (its "FUI-origin only" surface note is superseded).
