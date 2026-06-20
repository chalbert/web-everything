---
kind: task
parent: "167"
status: resolved
blockedBy: ["228"]
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
tags: []
---

# Scoped autonomous element: drive disconnectedCallback via a removal-path patch

Patch the DOM removal path (removeChild/remove, and the disconnect half of replaceChildren) so removing a scoped autonomous element fires disconnectedCallback — no listener/effect leak. Sibling of #228 (which makes scoped construction legal first). Flips the disconnect guard in we:plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts.

## Progress

**Resolved 2026-06-10 — no patch required; native drives it.** The anticipated removal-path patch
turned out to be unnecessary. Because #228 registers the real autonomous class **natively under a
private ctor tag** (`ensureNativelyConstructible`), an instance built with `new ScopedEl()` is a
genuinely native-upgraded custom element, so the browser drives its removal reactions itself —
`disconnectedCallback` fires natively on both `el.remove()` and the disconnect half of
`replaceChildren()` (verified empirically). No `removeChild`/`remove`/`replaceChildren` override was
added.

Changes: the shared "construction succeeds" probe for `disconnectedCallback` in
`we:autonomous-element-lifecycle.spec.ts` is replaced with a **driving** test that appends a scoped
`Probe` (with connected/disconnected callbacks), removes it, and asserts `disconnectedCallback` fired
— then repeats via `replaceChildren()` and asserts it fired again. The `beforeEach` now also applies
the **webinjectors** patch before the components patch (bootstrap order): `replaceChildren`/`remove`
route through `pathInsertionMethods`, which calls `this.getClosestInjector()`. `attributeChangedCallback`
(#262) and the form callbacks (#263) remain construction-only probes for their own items.
