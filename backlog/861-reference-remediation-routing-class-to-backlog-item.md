---
type: idea
workItem: story
size: 3
parent: "583"
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "scripts/route-reference-remediation.mjs (npm run route:references — sweep-class→backlog-item remediation router)"
tags: []
---

# Reference remediation routing — class to backlog item

When the liveness sweep classifies a reference as dead/moved, route the class to a remediation action that spawns a backlog item (bridges the #585 sweep to the #584 convention). Unblocked build — both prereqs resolved.

## Progress

- **Resolved 2026-06-17.** Built `scripts/route-reference-remediation.mjs` (`npm run route:references`):
  reads the #585 sweep report and maps each actionable health class to a #584-aligned remediation —
  `gone → retire-and-replace`, `moved → update-url`, `archived → rehome-from-archive`,
  `content-drift → re-verify-citation`, `superseded → swap-to-canonical`. Transient/judgement classes
  (`unreachable` / `server-error` / `paywall`) and healthy ones (`live` / `retired`) are reported but
  **not** auto-filed. Each spawned item is a `size:2` story under epic #583 with a self-describing
  digest and a `remediation-for: <url>` marker.
- **Dry-run by default**, `--file` scaffolds via `backlog.mjs scaffold`. **Idempotent**: a URL already
  carrying a `remediation-for:` marker anywhere in the backlog is skipped, so re-running after each
  sweep never double-files (the dedup is the whole point of "route once").
- **Tested + verified:** `routeRemediations()` is pure — 6-case offline suite
  (`scripts/__tests__/route-reference-remediation.test.mjs`, green) covers the full class→action map,
  the actionable/non-actionable split, the moved-target digest, and the second-run-files-nothing dedup.
  A live dry-run over the current 8-URL sweep correctly proposed 0 items (all `live`); a synthetic
  gone+moved report proposed exactly 2. Documented in `docs/agent/reference-retirement.md`
  (§ "Routing decay to the backlog").
