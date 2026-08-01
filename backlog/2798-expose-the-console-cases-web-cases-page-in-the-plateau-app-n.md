---
bornAs: xhrms8z
kind: story
size: 2
parent: "2505"
status: open
dateOpened: "2026-08-01"
tags: []
---

# Expose the /console-cases web-cases page in the plateau-app nav

The card-state webcases viewer (plateau-app:src/backlog-view/card-taxonomy-docs.ts, mountCardTaxonomyDocs, route /console-cases in plateau-app:index.html ~511) is built and works but is UNLINKED — reachable only by typing the URL. Add a sidebar nav entry (plateau-app:index.html ~56-113, under the 'Plateau Loop' group near the /console-board 'Lane board' link ~95) with a clear label (e.g. 'Card-state cases' or 'Web cases') and a proper breadcrumb/title in plateau-app:main.ts, so the web-cases page documenting the console card-state cases is discoverable in-product. This is the 'expose the cases as a web-cases page inside plateau' deliverable; the page itself already exists (#2550 shipped).
