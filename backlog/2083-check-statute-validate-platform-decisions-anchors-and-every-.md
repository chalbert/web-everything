---
kind: story
size: 2
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# check:statute — validate platform-decisions anchors and every codifiedIn link

The statute layer is load-bearing (99% of resolved decisions cite it) but has no link validation: a typoed codifiedIn anchor fails silently and an orphaned or duplicate anchor is never caught. Parse the named anchors in we:docs/agent/platform-decisions.md, error on duplicates/orphans, and verify every backlog codifiedIn reference resolves to a real anchor with substantive content.

## Progress

- Grounding found resolution was ALREADY gated (#1828, we:scripts/lib/validate-rules-anchors.cjs) — the real gaps were duplicates, orphans, and substance. Extended that lib (not a parallel validator) with pure rules: `findDuplicateAnchors` (every `{#id}` occurrence renders an HTML id, so a prose "see {#id}" is a duplicate), `findOrphanAnchors` (named `{#id}` anchors only — slug-derived structural headings are automatic, not "named"; reference corpus = backlog bodies + docs/agent + in-doc links), `validateAnchorSubstance` (cited anchor with <120 normalized chars before the next heading = a rule in name only; thinnest real cluster is >200), and `runStatuteCheck` composing all four.
- Wired: `npm run check:statute` (new we:scripts/check-statute.mjs CLI) + folded into the everyday gate (we:scripts/check-standards.mjs §9a-rules, replacing the resolution-only call). 8 new fixture tests + a real-data end-to-end pin in we:scripts/__tests__/rules-anchors.test.mjs (16 green).
- The probe caught 1 real live bug: `{#relocation-granularity}` was defined twice in we:docs/agent/platform-decisions.md (line 170's see-ref used definition syntax) — rewrote it as a markdown link. Gate green.
