---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:scripts/check-standards.mjs"
tags: []
---

# Gate the render-time description-partial requirement (missing partial silently crashes the Eleventy build)

Adding a plug or research-topic requires a hand-authored we:src/_includes/plug-descriptions/<id>.njk (or we:src/_includes/research-descriptions/<id>.njk); the include in we:src/plug-pages.njk / we:src/research-topic-pages.njk is NOT 'ignore missing', so a missing partial crashes the WHOLE Eleventy build — while we:scripts/check-standards.mjs stays green (it is a data gate, blind to njk render). Hit during #1374 (the new graph plugs froze the site until partials landed). Fix: add a check:standards rule 'every plug / research-topic / (any include-by-id registry) has its description partial', OR make the includes 'ignore missing' with a placeholder. Shift the failure left from build-crash to gate-error.

## Progress (2026-06-21, batch-2026-06-21-1385-1392)

Audited the **five** dynamic include-by-id surfaces in `we:src/*.njk`:
`plug-pages` → plug-descriptions, `block-pages` → block-descriptions, `research-topic-pages` →
research-descriptions, `capability-adapter-pages` → capability-adapter-descriptions, `adapter-pages` →
adapter-descriptions. **Four were already gated** (block/plug/research in `we:scripts/check-standards.mjs`
§1 since 2026-06-10; capability-adapter via `hasAdapterDesc`). The premise that the named plug/research
crash-class is ungated was stale — those error today. **The one genuine gap was `adapter-descriptions`:**
`we:src/adapter-pages.njk` paginates `collections.flatAdapters` (= `adapters.flatMap(c => c.items)`) and
`include`s `adapter-descriptions/<id>.njk` by id, but no rule required the partial — a new adapter would
crash the build with the data gate green.

**Fix:** added the adapter coverage rule to §1 of `we:scripts/check-standards.mjs`, iterating the same
flat item set the page does and erroring (with a `dMissingDescription('Adapter', …)` diagnostic) on a
missing partial. Verified: gate green with all partials present (0 errors); removing one partial yields
exactly `error Adapter "…" has no src/_includes/adapter-descriptions/….njk` (1 error), restored to green.
Chose the gate-rule arm over `ignore missing` deliberately — a missing partial is an authoring omission to
surface, not silently placeholder. The failure now shifts left from a build crash to a gate error for all
five include-by-id surfaces.
