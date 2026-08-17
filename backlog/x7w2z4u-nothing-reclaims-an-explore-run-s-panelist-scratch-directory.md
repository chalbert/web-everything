---
kind: task
parent: "3029"
status: open
scope: ["we:scripts/operations/explore-io.mjs", "we:scripts/operations/wake.mjs"]
dateOpened: "2026-08-17"
tags: [operations, epic-3029, housekeeping]
relatedTo: ["3150"]
---

# Nothing reclaims an explore run's panelist scratch directory

The explore operation (#3150) creates a per-run scratch directory under the workspace root and writes one markdown report per committee panelist into it. Its own header calls that directory transient session scratch, and nothing makes it transient: no sink, observer, waker pass or CLI ever removes one. Every committee run leaves its reports behind forever. The reports are already folded onto the run record when the observer resolves each panelist, so the files are redundant the moment a run completes. Decide who reclaims them and when, and make the header's claim true.

## Why it is small but not nothing

A single run leaves three markdown files, so this is not a disk-pressure problem. It is a TRUTHFULNESS one: a
header that calls a location transient teaches the next reader that something reclaims it, and the next thing
written there will be sized on that belief.

## Two constraints on the answer

- **Never reclaim a directory whose run still has an in-flight panelist.** Deleting a report a running
  investigator is about to write is the one way to turn a slow committee into a lost one.
- **The report path carries the attempt's session id** (#3150's blocker-1 fix), so a re-dispatched seat writes a
  NEW file beside the old one. Reclamation therefore has to be per-run, not per-seat — a superseded attempt's
  report is evidence until its run is finished with.

## Done when

1. **Executable** — `npx vitest run scripts/operations/` passes with a test that reclaims a completed run's
   scratch directory and REFUSES to reclaim one whose run still holds an `in-flight` panelist entry.
2. `we:scripts/operations/explore-io.mjs`'s header says who reclaims and when, instead of asserting the
   directory is transient with nothing behind the word.
