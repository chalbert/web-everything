---
type: issue
workItem: story
parent: "583"
size: 5
status: resolved
blockedBy: ["597"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "scripts/sweep-reference-liveness.mjs (npm run sweep:references — multi-modal liveness classifier over referenceIndex.json)"
relatedProject: webdocs
tags: [monitoring, references, liveness, link-rot, detection, sweep]
---

# Reference liveness detection sweep (multi-modal: 404 / moved / archived / content-drift / superseded)

Build the active sweep that fetches every external reference the project cites and classifies its health, rather than waiting to trip over a dead link (as #531 did with FAST). Classification is multi-modal, not binary: gone (404), moved (301/302), archived/frozen, content-drift (URL alive but no longer says what we cited — the silent killer), paywall, and superseded-by-newer-canonical (FAST→Fluent). Each class routes to a remediation that can spawn a backlog item; an axis-vacancy check flags when a retirement drops a corpus category below N live sources. Fetches what [#597](/backlog/597-reference-registry-substrate-index-the-structured-reference-/) (the reference-registry substrate) indexes — a blocking prerequisite, carved out so it's no longer buried scope.

## Progress

- **Resolved 2026-06-17.** Built `we:scripts/sweep-reference-liveness.mjs` (`npm run sweep:references`):
  reads the #597 `we:referenceIndex.json` (1182 URLs) and classifies each into one multi-modal class —
  `live / gone / moved / archived / paywall / server-error / unreachable / content-drift / superseded /
  retired`. Curated #584 markers (`supersededBy` / `retired`) take precedence over the live probe and
  skip the network entirely; `moved` vs `archived` is decided by whether the redirect's final host is a
  known archive host; `content-drift` is asserted **only** against a pinned baseline hash (supplied
  later by #862 — without one a 200 stays `live` + "no drift baseline"). The runner uses a fixed
  concurrency pool with per-URL timeouts and never throws on a dead host (→ `unreachable`).
- **Boundaries kept clean:** this slice only **detects** — class→backlog-item routing is #861,
  axis-vacancy alerting is #863, snapshot pinning is #862. The point-in-time report is written to
  `we:reports/reference-liveness-latest.json` (**gitignored** — it changes every run, no committed drift).
- **Tested + verified:** `classify()` is a pure, clock-free function and `runSweep()` takes an
  injectable fetch — 16-case offline unit suite (`we:scripts/__tests__/sweep-reference-liveness.test.mjs`,
  green) covers every class, marker precedence, the same-host-redirect-≠-moved edge, and the
  no-throw-on-error path. A live `--limit=8` run classified 8/8 `live`. Documented in
  `we:docs/agent/reference-retirement.md` (§ "Detecting decay").
