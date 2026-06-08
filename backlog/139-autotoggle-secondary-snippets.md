---
type: idea
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-07"
graduatedTo: "autoToggle on 5 secondary snippets across broadcast.njk, resource-action.njk, prefetch-behavior.njk, background-task-surface.njk"
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

- **Status:** resolved 2026-06-07 — swept all block-description pages; 5 secondary snippets converted to `autoToggle`, generated JSX panes verified well-formed, 11ty build green (491 files), `check:standards` 0 errors.
- **Branch:** docs/standard-authoring-workflow
- **Done (5 conversions):**
  - `broadcast.njk` — "With a different trigger event" (`broadcast-trigger`) and "With dynamic detail from a store" (`broadcast-from`).
  - `resource-action.njk` — "Delete with Confirmation" (`resource-action-confirm`); JSON-valued `resource-action-detail` attr — escaping confirmed byte-identical to the #069-shipped `broadcast-detail` pane (post-073 fix), so consistent, not a regression.
  - `prefetch-behavior.njk` — "Hover Prefetch with Router" nav (`prefetch-nav`).
  - `background-task-surface.njk` — usage snippet (`background-tasks-surface`); added the `source-toggle.njk` `autoToggle` import (page had none).
  - Verified via real `htmlToJsx` run (shared transform) + `build:check`: all 5 generated JSX panes well-formed; single leading comments drop in the JSX pane as expected (matches the `broadcast.njk:50-54` "Basic" precedent).
- **Deliberately skipped (correct end-state, not leftover work — they fall under the item's stated constraint):**
  - `action-button.njk` (3 snippets) — each carries a **load-bearing** comment (mutation behavior, `macOS/Windows` ordering, `<!-- form fields -->` placeholder) that silently drops in the JSX pane; converting would degrade that pane. Stays on manual `{% highlight %}`.
  - `multi-select-dropdown.njk`, `autocomplete.njk` — comments **inside** start tags (annotated pseudo-HTML); stay on manual.
  - `workflow`, `router`, `component`, `dropdown`, `interpolation-text-node` — already excluded by #069 (comment-heavy / reactive `{{ }}`/`[[ ]]` / own track).
- **Next:** _(done)_
- **Notes:** No follow-up backlog item filed — every un-converted snippet is excluded by the documented constraint, not blocked. The single-leading-comment convention (drops in JSX) is now used on broadcast (×3 incl. Basic), background-task-surface.
