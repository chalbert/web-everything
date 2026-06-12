---
description: Re-run the competitive coverage gap sweep (benchmark design systems & UI libraries, find what Web Everything is missing) and report the delta (routes to the gap-sweep-rerun skill)
---

Invoke the `gap-sweep-rerun` skill to re-run the competitive coverage gap analysis (epic #315):
snapshot the current state, refresh the corpus (`benchmarkCorpus.json`), re-extract the capability
matrix (`benchmarkCapabilities.json`), re-map coverage against the current Web Everything inventory and
re-dedup against the live backlog (`benchmarkCoverage.json`), then **report the delta** via
`node scripts/gap-sweep-status.mjs --baseline=…` and file **only the newly-appeared** fileable gaps as
candidate stories under #315. The sweep is **idempotent** — a re-run over an unchanged landscape must
produce a no-op delta and open **0** new items — and each run is a **new dated revision** (history
preserved), as decided in #349. Manual-first; the scheduled version is #367 (gated on #192).

$ARGUMENTS
