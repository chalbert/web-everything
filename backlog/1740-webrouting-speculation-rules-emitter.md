---
kind: task
parent: "1684"
status: open
blockedBy: ["1736"]
dateOpened: "2026-06-24"
tags: []
---

# webrouting Speculation-Rules emitter

we:webrouting — derive a native Speculation Rules manifest (<script type=speculationrules>) from the route-map projection for declarative prefetch/prerender. Native-first per #1688: the Speculation Rules API is the committed substrate (we:src/_data/blocks/router.json:192), inventing no prefetch format. Pattern-preserving via document rules (where: { href_matches: /users/* }) that match in-DOM links by pattern — needs no URL enumeration; a URL-list variant honors Fork-1 exclude-by-default for concrete entries. Ships derivation + conformance vectors. Blocked by #1736. Codified in #faithful-derivation-exclude-not-fabricate.
