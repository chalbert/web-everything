---
bornAs: wcxssg1
kind: story
size: 2
status: resolved
priority: normal
dateOpened: "2026-07-17"
dateResolved: "2026-07-21"
tags: [plateau-app, backlog-view, webcases, security, footgun]
---

# Harden the /console-cases preview sandbox before the preview-runtime-injection slice

**Guardrail surfaced by the review of plateau-app#63** (the `/console-cases` webcases viewer). The live
preview runs user-editable markup as real DOM inside an `<iframe srcdoc sandbox="allow-same-origin">`
(`plateau-app:src/backlog-view/card-taxonomy-docs.ts`). Today that is **safe**: the sandbox has
`allow-same-origin` but **not** `allow-scripts`, so no JS in the edited markup can execute (`<script>`,
`onerror=`, `javascript:` are all inert).

The footgun is the **next slice**: #63's own follow-up list calls for **preview-runtime injection** (so a
case needing a runtime — Acme's `<auto-complete>`, the console's real card CSS — renders with full
fidelity). If that slice adds `allow-scripts` **alongside** the existing `allow-same-origin` while the
preview content stays user-editable, the combination is **full XSS with parent-origin access** — the
sandbox's own docs call `allow-scripts` + `allow-same-origin` the escape-the-sandbox pair.

## Do now (cheap, this item)
- Drop `allow-same-origin` from the preview iframe. It is **not needed** to render pure CSS/DOM from
  `srcdoc` — removing it now makes the future slice safe by default, so no one has to remember to.

## Constraint on the runtime-injection slice (whoever picks it up)
- Injecting a runtime must **not** re-introduce `allow-same-origin` next to `allow-scripts` on a frame
  carrying user-editable content. If scripts are genuinely needed, keep the frame cross-origin (no
  `allow-same-origin`) so a script in the preview cannot reach the parent.

## Acceptance
- The `/console-cases` preview iframe no longer carries `allow-same-origin`; previews still render
  (CSS/DOM only — no behavioural regression). The runtime-injection follow-up carries the constraint above
  in its acceptance.

## Delivered (plateau-app PR #101)
Dropped `allow-same-origin` from the preview iframe in `plateau-app:src/backlog-view/card-taxonomy-docs.ts`
(`sandbox="allow-scripts"`). **Note the footgun had already gone LIVE**: since this item was filed, the
runtime-injection slice landed and added `allow-scripts` **while keeping** `allow-same-origin` — the exact
escape pair on user-editable content — so this was a real vulnerability at fix time, not just a future guard.
Now the frame runs on an opaque origin: runtime scripts still upgrade a case, but a script in the edited markup
can never reach the parent. Sighted `/console-cases`: all 15 previews render (CSS/DOM + runtime) with zero
errors; a regression test asserts the sandbox never carries `allow-same-origin`. The constraint above is now
also enforced in code by that test. Unblocks [#2550] (the Webcases viewer's preview-runtime slice), which must
respect the constraint.
