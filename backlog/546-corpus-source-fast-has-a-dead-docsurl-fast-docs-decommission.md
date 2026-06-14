---
type: issue
workItem: task
parent: "495"
status: open
dateOpened: "2026-06-14"
tags: []
---

# Corpus source 'fast' has a dead docsUrl — FAST docs decommissioned (review/replace/remove)

During #531 verification, every fast.design component doc page (/docs/{1.x,2.x,3.x}/components/<name>) returned HTTP 404 — Microsoft has decommissioned the FAST docs site; only landing pages resolve. So the benchmarkCorpus source 'fast' (docsUrl https://www.fast.design/) can no longer be walked for capability presence, and #531 added zero verified rows. Decide: point its docsUrl at an archived snapshot (web.archive.org) and re-run, or retire 'fast' from the corpus as a no-longer-maintained system. Surfaced honestly rather than fabricating presence.
