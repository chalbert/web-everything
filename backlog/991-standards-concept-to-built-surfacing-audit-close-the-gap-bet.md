---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-19"
tags: []
---

# Standards concept-to-built surfacing audit — close the gap between written specs and tracked work

Audit of all 40 concept/draft/poc standards for implementation state vs backlog coverage (we:audits/standards-surfacing-audit.md). Found 5 implemented-but-mislabeled (status fixed), 3 contract-stub partials, 12 designed-not-built with no owner, 1 resolved-epic-yet-unbuilt (webcharts), 3 GAPs (webevents/webportals/webanalytics), and 1 open epic needing coverage review (webediting). Reports/research swept clean. This epic parents the review/triage children that surface the un-tracked implementation work.

## What this audit found

Full detail + per-standard tables: `we:audits/standards-surfacing-audit.md`.

Origin: `/next 140` surfaced that webtraces/webevents are `concept` projects with no owning item. Rather
than fix two, this audit checked **every** `concept`/`draft`/`poc` standard for (a) real impl state
(`plugs/` + `blocks/` + `webtheme/`, ts files + tests) and (b) whether an open backlog item owns its
design/implementation, via a four-agent verification fan-out.

**Done in this pass (no item needed):**
- **Status corrected** — 5 implemented-but-mislabeled `concept` standards flipped to `poc`: webcontexts,
  webstates, webguards (real plugs), webworkflows (`we:blocks/workflow-engine`), webtheme (`we:webtheme/`).
- **Reports/research swept clean** — 172 reports + 126 topics; the `relatedReport:` discipline means every
  actionable proposal is already owned. No items needed.

## Review / triage children

- [#992](/backlog/992-design-the-trace-replay-substrate-webtraces-webevents-the-14/) — design the trace/replay
  substrate (webtraces + webevents), the [#140](/backlog/140-dev-surface-product-feature-matrix/) keystone
- [#993](/backlog/993-review-the-webportals-spec-and-surface-its-design-build-work/) — review webportals spec
  (1322-line page, no item) and surface design+build
- [#994](/backlog/994-surface-webanalytics-draft-design-build-work/) — surface webanalytics (draft) design+build
- [#995](/backlog/995-verify-webcharts-epic-570-delivered-vs-its-spec-surface-rema/) — verify webcharts epic #570
  delivered vs spec; surface remaining build
- [#996](/backlog/996-verify-webediting-epics-940-open-618-resolved-child-coverage/) — verify webediting epics'
  child coverage vs the spec
- [#997](/backlog/997-reconcile-partial-impl-standards-status-weblifecycle-webaudi/) — reconcile partial-impl
  status (weblifecycle / webaudit / webdecisions)
- [#998](/backlog/998-triage-the-12-designed-not-built-standards-into-implementati/) — triage the 12
  designed-not-built standards into implementation epics

Granularity: review items for genuine doubt (coverage / delivery / partial status / GAPs); one triage item
(#998) for the clear-but-unfunded designed-not-built standards, to avoid 12 thin siblings — each graduates
to its own implementation epic when picked up.
