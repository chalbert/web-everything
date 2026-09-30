---
kind: story
size: 5
status: open
dateOpened: "2026-09-30"
tags: []
---

# Reject unbuildable scopes and already delivered cross-repo items before spawning builders

4295 stopped on missing enforcement scope and 4341 was dispatched after plateau-app PR 188 landed: 1.28 worker minutes and 312446 processed tokens combined, including cache reads. Validate scope closure and repo-qualified delivered identity before spawn. See we:reports/2026-09-30-builder-postmortem.md.

## Evidence and cost

T4295-blocked lines 27–65: enforcing call sites outside scope and TODO acceptance criteria; **1.07 minutes / 229,578 processed tokens**. T4341-redundant lines 25–43: plateau-app PR 188 already landed; **0.21 minutes / 82,868 processed tokens**. Combined **1.28 minutes / 312,446 processed tokens**, of which 251,141 are cache reads. The successful and redundant 4341 sessions share conveyor-4341b, proving slug-only identity is insufficient.

## Root cause and change

Preparation misses scope closure; delivered state is not authoritative across coordination and implementation repos. Validate enforcing call sites and executable acceptance criteria before readiness; link repo-qualified item→unique attempt→PR→landed state. Recheck delivered identity before spawning and resolve cross-repo delivery through existing reconciliation. Do not infer identity from slug or lane.

## Done when

Add preparation and build-dispatch tests for missing enforcement scope, missing executable acceptance criteria, duplicate event, reused slug and a plateau-app PR resolving a WE card. A landed mapping must refuse the next build without a worker; a distinct unresolved item remains dispatchable. Live isolated cross-repo replay of the PR-188 shape proves only one worker and one durable delivered mapping.
