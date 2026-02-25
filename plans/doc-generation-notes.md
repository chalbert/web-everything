# Doc Generation Notes — User-Facing Block Documentation

Notes on making the WE documentation site more accessible to users (not just implementers).

## The Problem

The current doc pages (`src/_includes/block-descriptions/*.njk`) are **implementer specs**: they document web standards alignment, framework research, design decisions, and API details. While valuable for contributors, they're not what a user looking to *use* a block needs.

Users need:
1. **Quick overview** — what does this block do?
2. **Live demo** — see it working, right now
3. **Copy-paste examples** — ready-to-use HTML snippets
4. **API table** — attributes, events, CSS properties
5. **Common patterns** — "how do I do X with this block?"

## Proposed: Two-Tier Documentation

### Tier 1: User Docs (auto-generated from blocks.json + live demos)

Each block page should have:

| Section | Source | Notes |
|---------|--------|-------|
| Overview | `blocks.json → summary` | 1-2 sentence description |
| Live Demo | `demos/{id}-demo.html` embedded in iframe | Interactive, shows real usage |
| Quick Start | Auto-generated from `designDecisions` + examples | Copy-paste HTML |
| API Reference | Auto-generated from `exports`, attributes, events | Table format |
| Related Blocks | `blocks.json → dependsOn` cross-links | Navigation aid |

### Tier 2: Spec Docs (existing njk pages)

Keep the current njk-based spec pages as "deep dive" documentation for contributors. Link from Tier 1 pages with a "View Implementation Spec" link.

## Generic Doc Generation Strategy

### Data-Driven from blocks.json

The `blocks.json` schema already contains most of what we need:

```json
{
  "id": "for-each",
  "name": "For Each",
  "type": "Directive",
  "summary": "...",
  "exports": ["ForEachBehavior", "registerForEach"],
  "extendsClass": "CustomAttribute",
  "sourcePath": "blocks/for-each/ForEachBehavior.ts",
  "dependsOn": ["handler-expression-parser"],
  "designDecisions": { ... }
}
```

### What's Missing from blocks.json for User Docs

To auto-generate user docs, we'd need to add:

```json
{
  "attributes": [
    {
      "name": "for-each",
      "element": "template",
      "type": "string",
      "description": "Expression defining the items to iterate: 'expression as alias'",
      "required": true
    },
    {
      "name": "key",
      "element": "template",
      "type": "string",
      "description": "Property name for key-based diffing (Phase 2)",
      "required": false
    }
  ],
  "events": [],
  "cssProperties": [],
  "examples": [
    {
      "title": "Basic list",
      "html": "<template for-each=\"@data as item\">...",
      "description": "Render a list of items from context"
    }
  ],
  "demoPath": "demos/for-each-demo.html"
}
```

### Eleventy Template for User Doc Pages

A new `src/block-user-pages.njk` template that generates user-friendly pages:

```nunjucks
---
pagination:
    data: blocks
    size: 1
    alias: block
    filter: blocks where status != "concept"
permalink: "docs/blocks/{{ block.id }}/"
---

{# Auto-generated user documentation #}
<h1>{{ block.name }}</h1>
<p>{{ block.summary }}</p>

{# Live demo embed #}
{% if block.demoPath %}
<iframe src="/{{ block.demoPath }}" style="width:100%; height:400px; border:none;"></iframe>
{% endif %}

{# API table from attributes array #}
{% if block.attributes %}
<h2>Attributes</h2>
<table>
  <tr><th>Name</th><th>Element</th><th>Type</th><th>Description</th></tr>
  {% for attr in block.attributes %}
  <tr>
    <td><code>{{ attr.name }}</code></td>
    <td><code>&lt;{{ attr.element }}&gt;</code></td>
    <td>{{ attr.type }}</td>
    <td>{{ attr.description }}</td>
  </tr>
  {% endfor %}
</table>
{% endif %}

{# Examples #}
{% if block.examples %}
<h2>Examples</h2>
{% for example in block.examples %}
<h3>{{ example.title }}</h3>
<pre><code>{{ example.html }}</code></pre>
{% endfor %}
{% endif %}
```

## Demo Embedding Strategy

Each demo page (`demos/{id}-demo.html`) should be:
1. **Standalone**: Works on its own at `/demos/{id}-demo.html`
2. **Embeddable**: Can be loaded in an iframe on the doc page
3. **Source-viewable**: Has a companion source panel (like the SPA demo's code viewer)

### Consideration: Demo Registry

Add a `demoPath` or `demoId` field to `blocks.json` to link blocks to their demos. The doc generator reads this to embed the right demo on each page.

## Incremental Adoption

1. **Phase 1** (now): Each new block gets a demo page + spec page
2. **Phase 2**: Add `attributes`, `events`, `examples` arrays to blocks.json for active blocks
3. **Phase 3**: Create `block-user-pages.njk` template that auto-generates user docs
4. **Phase 4**: Embed live demos in user doc pages

## Open Questions

- Should user docs and spec docs live at different URL paths? (e.g., `/docs/blocks/` vs `/blocks/`)
- How to handle blocks that don't have demos yet? Show a placeholder?
- Should the source code viewer be a block itself? (would be a nice dogfooding opportunity)
- How to handle blocks that are part of a "family" (e.g., router: route-view, route-outlet, route:link, route:prefetch)?
