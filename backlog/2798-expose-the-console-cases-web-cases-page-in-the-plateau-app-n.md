---
bornAs: xhrms8z
kind: story
size: 2
parent: "2505"
status: resolved
locus: plateau-app
dateOpened: "2026-08-01"
dateStarted: "2026-08-01"
dateResolved: "2026-08-01"
graduatedTo: none
tags: []
scope:
  - plateau-app:index.html
  - plateau-app:src/main.ts
---

# Expose the /console-cases web-cases page in the plateau-app nav

The card-state webcases viewer (plateau-app:src/backlog-view/card-taxonomy-docs.ts, mountCardTaxonomyDocs, route /console-cases in plateau-app:index.html ~511) is built and works but is UNLINKED — reachable only by typing the URL. Add a sidebar nav entry (plateau-app:index.html ~56-113, under the 'Plateau Loop' group near the /console-board 'Lane board' link ~95) with a clear label (e.g. 'Card-state cases' or 'Web cases') and a proper breadcrumb/title in plateau-app:main.ts, so the web-cases page documenting the console card-state cases is discoverable in-product. This is the 'expose the cases as a web-cases page inside plateau' deliverable; the page itself already exists (#2550 shipped).

## Resolution (2026-08-01) — plateau-app PR #129

Added a "Card-state cases" sidebar link under the Plateau Loop group, next to Lane board, pointing at the
already-built `/console-cases` route (`mountCardTaxonomyDocs`, shipped in #2550). Added the matching breadcrumb
label (`Plateau / Card-state cases`) to `plateau-app:src/main.ts`'s route-label map, mirroring how sibling
routes like `/backlog` are labelled. Verified by screenshot: the nav link renders under Plateau Loop and
clicking it navigates to the working page with the correct breadcrumb. Landed as **plateau-app PR #129**
(`ready-to-merge`); this WE change is the status splice — no epic rollup (parent #2505 stays open for its
other slices).
