---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
blockedBy: ["3115"]
dateOpened: "2026-06-23"
tags: []
---

> **Pre-flight (batch-2026-06-26-1732-1696):** Slice B over Slice A's declared-rule reader (#1693) — re-pointed `blockedBy: ["1693"]`. #1693 is itself deferred (no app declares rules; the gate has no consumer yet), so this live lens has nothing to surface until that lands. It is also a **live dev-browser surface** whose acceptance is interactive verification in the running app (not headlessly verifiable in a serial batch). Released unbuilt.

> **Preparation pass (2026-08-15, story-prep on #1694) — re-pointed `blockedBy` from #1693 to [#3115](/backlog/3115-declared-conformance-drift-signal-for-the-standard-aware-rev/); still not build-ready.** Re-verified live in `plateau-app`: the June "no app declares rules" fact still holds (`registry.register(` fires nowhere outside `plateau:packages/dev-browser/src/element-resolver/element-resolver.test.ts:52`; no app declares an `L1` `CapabilityManifest`). But blocking on that alone is now governance-questionable — `we:docs/agent/backlog-workflow.md`'s "no consumer yet is not a hold" rule (added 2026-06-28, *after* this card's park, commit `8e2f5197`) bans "no production consumer" as a standalone defer reason once a mechanism's contract is codified, and #1689 (`DeclaredRuleRegistry`) is codified and resolved — a fixture app would be a valid consumer.
>
> Two other candidate blockers turned out to be **red herrings**, ruled out by inspecting the actual delivery pattern this epic-142 cluster uses: this does **not** need the Electron dev-browser shell (`#1391`/`#1753`, human-gated, several layers away) or the Chrome DevTools-panel extension (`#1656` lineage, still only a conformance-detected/not status slot). Sibling story **#1696** (same cluster, resolved 2026-07-26) proves the real shape: a plain, framework-free DOM panel (`mountScenarioLoader(root, library, options)`) that "mounts anywhere a WE app runs," verified by a Playwright spec against a synthetic fixture app — no shell or extension host required. #1694 should follow the identical shape once mounted.
>
> The genuine, still-open gap is **the judging half**: `DeclaredRule` (#1689) links a rule to conformance-vector ids or a contract/tier, but carries no executable check, and no mechanism today produces a `SynchronousConformanceBinding` (the input the proven `ConformanceVectorOracle` judge needs, `plateau:packages/core/src/conformance-engine/conformanceVectors.ts`) generically from an arbitrary live app's mounted DOM — every existing binding factory is hand-authored per WE-owned framework-level standard against a relocated FUI engine, not per declaring app. This is a real, un-picked fork (reuse the vector/binding engine with a per-app binding, vs. a lighter declared-rule-native `liveCheck` predicate) — per the story-prep checklist ("a real fork must be NAMED as an open decision, never picked silently"), it is spun out as **#3115** (prepared, `preparedDate: 2026-08-15`, ready to ratify) rather than invented here. Once that ratifies, #1694 has a decided design and can be prepared to build-ready with real interfaces (`mountDeclaredRuleLens`), a fixture-registry `## Done when` list, and ordered tasks — the same shape #1696 shipped.

# In-browser standard-aware review lens (dev browser)

Slice B of the standard-aware review assistant (#1640, ratified go): the live dev-browser surface that flags declared-conformance drift pre-human as you view a change. Same declared-rule reader as the PR gate (Slice A) and #1689; surfaced in the running app. Home plateau:dev-browser.
