---
type: issue
workItem: epic
status: resolved
blockedBy: ["706"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-17"
graduatedTo: "frontierui/scripts/check-standards.mjs (catalog completeness + registered-name gates, #784/#783); #785 doc"
tags: []
---

# Epic: FUI block-catalog completeness — gate, mapping rule, derivation-source doc

Umbrella for executing the #706 ruling (authored manifest + completeness gate) on FUI's `/blocks/`
catalog. Sliced from a `size·13` story on 2026-06-16 (`/split 731`, report
`reports/2026-06-16-backlog-split-analysis.md`) — investigation found **two of the original four
deliverables already landed**: #737 (resolved) filled the authored `blocks.json` entries (23 entries),
and the render is already manifest-driven (`frontierui/src/blocks.njk` iterates `blocks.json`). What
remains is the completeness **gate**, which is blocked on a real definitional **fork** about the gate's
denominator, plus a separable WE-side doc. WE never renders these blocks; the #701 `fuiDemo` iframe owns
demo embedding.

## Slices

- **#783** *(decision)* — define the catalog-block-family **denominator + dir→WE-spec mapping** rule
  (which `blocks/` dirs are catalog families vs infra; name-mismatched + multi-block dir mappings;
  no-WE-spec dirs). *This is the fork that was buried in the original body* — now its own card.
- **#784** *(story·3, blocked-by #783)* — add the completeness gate to
  `frontierui/scripts/check-standards.mjs` (`readdirSync(blocks/)` family check) + reconcile any residual
  entries.
- **#785** *(story·2, independent)* — document derivation-source as a Web-Docs standard dimension
  (authored=default/reference; impl-scan=opt-in).
