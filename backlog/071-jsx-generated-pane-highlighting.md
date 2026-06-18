---
type: idea
workItem: task
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-06"
graduatedTo: "src/_includes/source-toggle.njk — `highlightCode` Prism filter for autoToggle panes (filter added in .eleventy.js)"
tags: [jsx, adapters, docs, source-toggle]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Add build-time syntax highlighting to autoToggle-generated source panes

> **Resolved 2026-06-06.** `we:src/_includes/source-toggle.njk` now pipes both the authored HTML and the
> generated JSX through a `highlightCode` filter (the same Prism the syntax-highlight plugin uses, added in
> `we:.eleventy.js`), so autoToggle-generated panes are colored at build like the manual `{% highlight %}` panes.
> Original narrative preserved below.

The `autoToggle` macro in `we:src/_includes/source-toggle.njk` emits the authored HTML and the generated JSX in plain `<pre><code class="language-*">` with no build-time highlighting, unlike the manual `{% highlight %}` panes (which the `@11ty/eleventy-plugin-syntaxhighlight` plugin colors at build).

Add highlighting for the generated panes — e.g. an 11ty filter that runs the same Prism highlighter the plugin uses, applied to the `htmlToJsx` output and the HTML — so auto-generated and hand-authored toggles look consistent. Cosmetic, low risk.
