---
kind: story
size: 3
status: open
dateOpened: "2026-06-21"
tags: []
---

# Gate the render-time description-partial requirement (missing partial silently crashes the Eleventy build)

Adding a plug or research-topic requires a hand-authored we:src/_includes/plug-descriptions/<id>.njk (or we:src/_includes/research-descriptions/<id>.njk); the include in we:src/plug-pages.njk / we:src/research-topic-pages.njk is NOT 'ignore missing', so a missing partial crashes the WHOLE Eleventy build — while we:scripts/check-standards.mjs stays green (it is a data gate, blind to njk render). Hit during #1374 (the new graph plugs froze the site until partials landed). Fix: add a check:standards rule 'every plug / research-topic / (any include-by-id registry) has its description partial', OR make the includes 'ignore missing' with a placeholder. Shift the failure left from build-crash to gate-error.
