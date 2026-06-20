---
kind: story
size: 2
parent: "823"
status: resolved
blockedBy: ["835", "836"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: src/_data/demos.json (loan-origination + auto-insurance entries → fuiDemoFile iframe embed of the FUI-hosted apps; demo-pages.njk fuiDemo section)
tags: []
---

# WE iframe-embeds the two FUI-hosted exercise apps in the docs showcase + file residual standard-gaps

Once both apps are FUI-hosted (#835, #836), WE embeds them in the docs showcase via the fuiDemo iframe shortcode (we:.eleventy.js:38) — no import, FUI keeps provenance (project_docs_rendering_boundary_we_iframes_fui). Add the showcase entries and file any residual standard-gaps the apps surfaced upstream as backlog items. Closing slice of #823 (#812 Fork-1(a)); unblocks the app-coupled deletion #824.

## Progress

Done. Both flagship apps now embed in the docs showcase via the `fuiDemo` iframe shortcode (the boundary-correct path — WE never imports the app code; FUI hosts and keeps provenance, project_docs_rendering_boundary_we_iframes_fui):

- **demos.json** — the two existing entries (`loan-origination`, `auto-insurance`) had their stale `liveUrl` (`http://localhost:3000/demos/…` — the WE-local copy slated for deletion in #824) replaced with `fuiDemoFile` (`fui:loan-origination.html` / `fui:auto-insurance.html`, the #835/#836 flat FUI entries) + `fuiDemoHeight: 680`.
- **demo-pages.njk** — added a "Live demo" section that renders `{% raw %}{% fuiDemo demo.fuiDemoFile, demo.name, (demo.fuiDemoHeight or 640) %}{% endraw %}` when `fuiDemoFile` is set (with a note on the embed boundary), and generalized the metadata hero to render on `liveUrl OR fuiDemoFile` (the "Open Demo" button stays gated on `liveUrl`). No new field shape outside the existing data convention.
- **Verified:** live docs `:8080/demos/{loan-origination,auto-insurance}/` render the `fui-demo` figure + "Frontier UI demo" chrome; iframe `src` resolves to `http://localhost:3001/demos/<app>.html` (the FUI dev host). 11ty `--dryrun` clean; `check:standards` 0 errors.

**Residual standard-gaps: none to file.** #835 and #836 both reported the apps built/booted in FUI with zero console/page errors and `check:standards` clean — neither surfaced a new missing-standard candidate (the gap-driving roadmap, e.g. tree-select/configurator/file-handling/view-transitions, is already tracked under the app epics #317/#318 and their slices, not newly surfaced here).

Resolving this frees the app-coupled deletion **#824** (the WE-local app copies + their we:demos.json/blocks.json refs can now be removed) and closes the #823 slice set.
