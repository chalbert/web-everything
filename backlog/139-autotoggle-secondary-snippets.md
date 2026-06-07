---
type: idea
status: active
dateOpened: "2026-06-06"
tags: [jsx, adapters, source-toggle, docs]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Extend autoToggle to clean *secondary* example snippets on block pages

Item #069 rolled `autoToggle` onto the **primary** usage example of each clean-HTML block page (6 pages) and graduated `jsx-adapter` to `implemented`. Scope there was deliberately one primary example per page.

Now that #073 (htmlToJsx attribute quote-escaping) is resolved, JSON-valued attributes are safe to convert — which unblocks many **secondary** snippets that were left on the manual `{% highlight "html" %}` macro. Sweep block-description pages for additional clean, parseable HTML snippets and convert them to `autoToggle`.

Known candidates (not exhaustive):

- `broadcast.njk` — "With a different trigger event" (`broadcast.njk:76`, the `<form broadcast=… broadcast-on="submit">` snippet) and "With dynamic detail from a store" (`broadcast.njk:86`, the `broadcast-from="filterStore"` button). Both are clean parseable HTML.

Constraint (unchanged from #069): skip pseudo-HTML, reactive `{{ }}`/`[[ ]]` interpolation (Axis-2 unmapped), and comment-heavy snippets where comments would drop in JSX (e.g. broadcast's "Complete Example" with `<script>` + comments). Those correctly stay on the manual `sourceToggle`.

Verify each conversion the same way #069 did: real `htmlToJsx` run / build-smoke confirming the generated JSX pane is well-formed, plus `check:standards` green.

## Progress

- **Status:** active 2026-06-07 — claimed, starting.
- **Branch:** docs/standard-authoring-workflow
- **Done:** _(none yet)_
- **Next:** Convert `broadcast.njk` lines 77-85 ("With a different trigger event") and 87-94 ("With dynamic detail from a store") from `{% highlight "html" %}` to `autoToggle`; verify generated JSX panes well-formed + build/`check:standards` green. Then sweep other block-description pages for additional now-unblocked (post-073) secondary snippets.
- **Notes:** Both broadcast candidates have a single leading HTML comment — within precedent (the "Basic" example at `broadcast.njk:50-54` already uses `autoToggle` with a leading comment).
