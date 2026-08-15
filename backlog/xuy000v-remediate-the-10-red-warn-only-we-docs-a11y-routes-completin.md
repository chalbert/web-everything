---
kind: story
size: 5
parent: "777"
status: open
scope: ["we:tests/a11y/sitemap-routes.ts", "we:src/"]
scopeRationale: "The fix files are unknown until each of the 10 routes is triaged to root cause — mirrors #2376's shape (3 routes touched a layout front-matter key, a CSS theme file, and 25 unrelated data files depending on cause). we:src/ is a placeholder for whatever templates/CSS/data files the 10 routes' violations trace back to; narrow this once triage is done."
dateOpened: "2026-08-15"
tags: [dogfood, a11y, ratchet]
---

# Remediate the 10 red warn-only WE-docs a11y routes, completing the #867 ratchet drain

Ten of the 43 scope-C-derived a11y routes are still red, blocking the #867 Fork-2 enforce-by-default
flip (#2379). Fix each at root cause and promote all 10 into `ENFORCED_ROUTES`.

Measured 2026-08-15 via a live scope-C run against the running WE-docs origin (`:8080`): `/assets/visual-diff-surface-demo/` (color-contrast, html-has-lang, scrollable-region-focusable), `/backlog/001-resource-specs-and-plans/` (color-contrast, list, listitem), `/blocks/action-button/` (color-contrast), `/capabilities/adapters/base-select/` (select-name), `/cases/accordion/01-standard/` (document-title, html-has-lang), `/compat/` (color-contrast), `/demos/analytics-conformance-demo/` (color-contrast), `/module-resolution/` (document-title, html-has-lang), `/plugs/customattribute/` (color-contrast), `/semantics/` (select-name).

These are the same 10 routes the `we:tests/a11y/sitemap-routes.ts:34-37` comment named stale as of the 2026-07-28 `#2378` promotion pass — zero further remediation/promotion has landed since (`git log` shows no commits to that file since `#2378`). Fix each at root cause (mirror `#2376`/`#2377`'s per-route approach — both fixed the real markup/CSS defect, never suppressed the check), re-measure green, then append all 10 to `ENFORCED_ROUTES` (`we:tests/a11y/sitemap-routes.ts`) so the derived set fully equals the enforced set.

This is the genuine blocker on `#2379` (the Fork-2 enforce-by-default flip): `#2379`'s own precondition ("once `ENFORCED_ROUTES` equals the derived set and the lane is green") does not hold yet, and no open item was driving it there before this one was filed. Landing this item will make the self-announcing drain-trigger test (`we:tests/a11y/rendered-site-a11y.spec.ts:83-99`) FAIL by design ("drain complete — execute the #867 flip") — that is the intended signal, not a regression; `#2379` should land immediately after to clear it, ideally the same session/batch.
