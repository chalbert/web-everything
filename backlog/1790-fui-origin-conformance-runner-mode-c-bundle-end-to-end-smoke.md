---
kind: story
size: 5
parent: "1783"
status: open
locus: plateau-app
dateOpened: "2026-06-26"
tags: [conformance, conformance-vectors, plateau, surface]
---

# Plateau-origin conformance-runner docs surface + end-to-end smoke proof

Re-scoped per #1788 (ratified (b)): the runner **stays in plateau** (shared multi-surface tool), so this builds the **plateau-origin** docs surface — **not** a FUI-origin bundle, and **no** engine re-home / `Finding` move. Stand up the headless-logic surface by which the WE docs site runs a synchronous vector suite against a binding and displays pass/fail, via one of #1788's two mechanisms (pick here): **widen mode-C's #765 trust allowlist to admit the plateau origin** (`fui:embed/in-document.ts` `setTrustedOrigins`), or **embed a plateau-hosted conformance iframe** (cross-origin, no #765 issue). Includes an end-to-end smoke proof with a trivial synchronous example vector + reference binding (NOT webpolicy — that arrives with #1294, consuming the #1789 synchronous binding variant). **Also carries the #1784 amendment**: update #1784's superseded "FUI-origin only" surface note to plateau-origin.
