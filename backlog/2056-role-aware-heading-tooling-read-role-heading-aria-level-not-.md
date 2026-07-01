---
kind: task
status: open
dateOpened: "2026-07-01"
tags: []
---

# Role-aware heading tooling: read [role=heading]/aria-level, not h1-h6 tags

Host-is-node auto-headings (#2028) are role=heading custom elements, not real `<hN>`. Repoint heading scrapers from tag selectors to [role=heading]+aria-level so they're seen (correct regardless — also catches ARIA headings). Concrete consumer: we:src/_layouts/base.njk:319 (WE-website TOC extractor, h.querySelector('h1..h6')); plus any plateau-app equivalent.
