---
description: Run a program's watch — refresh with later data, review done-vs-goal, brainstorm next, file newly-surfaced items (routes to the review-program skill)
---

Invoke the `review-program` skill to run a standing/ongoing program's **watch**: refresh its
front-B discovery with later data, review **what's been done** against the program's goal,
**brainstorm what could be done**, and file the newly-surfaced items under the program. The run is
**idempotent** — an unchanged landscape opens 0 items — and each run is a **new dated review**
(`reports/<date>-program-<slug>.md`, plus a `## Review log` entry; history preserved). Discovery
proposes; you dispose — nothing is auto-filed without your go.

A bare `/review-program` lists the programs (the `childlessReason: program` / `ongoing: true` epics),
ranked by staleness. A `NNN` or `NNN-slug` (e.g. `1257` for the platform-standards watch) focuses one
and goes straight in.

$ARGUMENTS
