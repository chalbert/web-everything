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

# Scoped autonomous element: drive form-associated callbacks

Carry static formAssociated=true onto the natively-registered class so the browser associates a scoped element and fires formResetCallback/formStateRestoreCallback/formDisabledCallback. Sibling of #228 (legal construction first). Flips the form-reset guard in we:plugs/__tests__/e2e/autonomous-element-lifecycle.spec.ts.

## Progress

**Resolved 2026-06-10 — no extra wiring; native drives it** (same finding as #261/#262). #228's
`ensureNativelyConstructible` registers the **real class** natively under a private ctor tag, and the
real class already carries `static formAssociated = true` — so the "carry formAssociated onto the
natively-registered class" step is satisfied for free. The browser associates a scoped instance with
its owning form and drives the form callbacks natively: `formResetCallback` on `form.reset()` and
`formDisabledCallback(disabled)` when an ancestor `<fieldset>` toggles `disabled`. `attachInternals()`
works on the instance.

Changes: the shared construction-only form probe in `we:autonomous-element-lifecycle.spec.ts` is
replaced with a **driving** test that places a scoped form-associated `Probe` inside a
`form > fieldset`, calls `form.reset()` (asserts `formResetCallback` fired) and toggles
`fieldset.disabled` (asserts `formDisabledCallback(true)` then `(false)`).
`formStateRestoreCallback` is invoked only by browser-initiated state restoration (bfcache/autofill)
and is therefore not synchronously triggerable in a test; the two driven callbacks prove genuine
form association. This was the last of the three #167 lifecycle follow-ups (#261/#262/#263) — all
resolved to "native already drives it via the #228 private-tag registration", no per-callback patch.
