---
kind: story
locus: frontierui
size: 3
parent: "398"
status: resolved
dateOpened: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: frontierui/webdocs
tags: [webdocs, frontier-ui, migration, generator, adapters, layering]
relatedProject: webdocs
crossRef: { url: /backlog/426-incumbent-ingestion-adapters-storybook-mintlify-to-the-webca/, label: "Adapter home ruling (#426, Fork 1 = C)" }
---

# Migrate webdocs impl cluster (generator + coverage + adapters) from webeverything to FUI

Corrective migration ruled by #426 (Fork 1 = C): move fui:webdocs/generator.ts + fui:coverage.ts + the new adapters/ from the webeverything repo into frontierui, carrying the WebCase/WebCases types. The generator was filed by #424 as a FUI slice yet landed in WE, with zero WE imports and no WE consumer (WE docs still use the original we:cases.js) — so the move is mechanical and creates no cross-repo dependency.

After this, WE holds nothing webdocs-specific and the ingestion adapters co-locate with the generator in FUI, satisfying both co-location and the impl/adapters-to-FUI layering line (#091). Chain head for the Storybook (#426 successor) and Mintlify (#429) adapter builds.
