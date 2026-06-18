---
type: issue
workItem: task
parent: "167"
status: resolved
blockedBy: ["228"]
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
tags: []
---

# Scoped autonomous element: drive attributeChangedCallback via a setAttribute/MutationObserver patch

Add the missing setAttribute patch / MutationObserver and honour the real class's observedAttributes so a scoped autonomous element reacts to attribute changes. Sibling of #228 (legal construction first). Flips the attributeChanged guard in we:plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts.

## Progress

**Resolved 2026-06-10 — no patch required; native drives it** (same finding as #261). The #228
private-tag native registration carries the real class's `static observedAttributes`, so the browser
natively observes those attributes and fires `attributeChangedCallback` on `setAttribute`, honouring
the observed list — no `setAttribute` override or MutationObserver was added.

Changes: the shared construction-only `attributeChangedCallback` probe in
`we:autonomous-element-lifecycle.spec.ts` is replaced with a **driving** test that defines a scoped
`Probe` with `observedAttributes = ['value']` and an `attributeChangedCallback`, sets `value` twice
and a non-observed `ignored` attribute, and asserts exactly the two observed transitions fired
(`[value, null, 'x']`, `[value, 'x', 'y']`) with the non-observed change ignored. The form-callbacks
probe (#263) remains construction-only.
