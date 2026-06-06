---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [jsx, adapters, docs, source-toggle]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Add build-time syntax highlighting to autoToggle-generated source panes

The `autoToggle` macro in `src/_includes/source-toggle.njk` emits the authored HTML and the generated JSX in plain `<pre><code class="language-*">` with no build-time highlighting, unlike the manual `{% highlight %}` panes (which the `@11ty/eleventy-plugin-syntaxhighlight` plugin colors at build).

Add highlighting for the generated panes — e.g. an 11ty filter that runs the same Prism highlighter the plugin uses, applied to the `htmlToJsx` output and the HTML — so auto-generated and hand-authored toggles look consistent. Cosmetic, low risk.
