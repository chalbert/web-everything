---
type: idea
workItem: story
size: 2
parent: "604"
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: src/_includes/block-descriptions/autocomplete.njk
tags: []
---

# Embed FUI droplist demo on /blocks/autocomplete/ + establish the fuiDemo rollout pattern & demo→block mapping

POC + repeatable pattern for #604: add a one-line {% fuiDemo "autocomplete-unplugged.html" %} embed to the autocomplete block description partial (the droplist-family demo FUI already hosts), mirroring component.njk:235; document the per-block demo→block mapping convention (demoFile in blocks.json or the partial) so remaining blocks roll out as one-liners. Additive — static code sample retained.

## Progress (2026-06-15, batch-2026-06-15)

- **Embedded the demo:** added a `<h3 id="try-it-live">Try it live</h3>` section + the one-line
  `{% fuiDemo "autocomplete-unplugged.html", "Autocomplete — editable, filterable droplist", 520 %}` to
  [src/_includes/block-descriptions/autocomplete.njk](../src/_includes/block-descriptions/autocomplete.njk),
  near the top after the intro (mirrors `component.njk:235`). Verified `autocomplete-unplugged.html` exists
  in `frontierui/demos/`; the static code samples are untouched (additive). The embed is a sandboxed iframe
  at `${FUI_DEMO_BASE}/demos/…` — **no cross-repo import** (the #700/#604 docs-rendering boundary).
- **Documented the rollout convention:** new section in
  [docs/agent/demo-workflow.md](../docs/agent/demo-workflow.md) — "Embedding a Frontier UI demo on a block
  page — the `fuiDemo` convention (#701/#604)": the mapping is **declared in the block's `.njk` partial**
  (a single `fuiDemo` line under `Try it live`), **not** in `blocks.json` (which stays a pure registry);
  demo file naming = `<concept>-unplugged.html` (the #606 public surface); additive, never a replacement.
  So remaining blocks roll out as one-liners.
- **Verified:** `npx @11ty/eleventy --dryrun` builds clean (no Nunjucks render error from the new shortcode
  call); `check:standards` 0 errors.
