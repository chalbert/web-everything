---
bornAs: xxk0h1r
kind: story
size: 8
parent: "2472"
status: open
priority: low
dateOpened: "2026-07-13"
blockedBy: ["x22ecxe"]
tags: []
---

# Per-repo backlog files — each constellation repo owns its own backlog/*.md

Today the backlog lives only in Web Everything; multi-repo orchestration needs each repo (WE, Frontier UI, plateau-app) to own its own backlog/*.md with build status. The data-model prerequisite for the registry and the multi-repo Loop console. Built over the WE tracker, not copied; WE is not deleted.

## Preparation finding (2026-08-15) — NOT build-ready

Attempted to prepare this story to build-ready per `we:agent-memory-src/story-preparation-checklist.md`.
**Verdict: not viable as a story in its current form.** The one-paragraph body above carries no decided
design, no interfaces, no acceptance criteria, and no tasks — because it turns out to **be** an unnamed
design fork rather than a scoped build: "each repo owns its own backlog/*.md" is ambiguous between a cheap,
additive change (a locus-filtered view over WE's existing, already-working cross-repo tracker) and a very
large one (forking WE's entire numbering/scaffold/drain/audit tooling suite, independently, into two more
repos) — and the card silently assumes the expensive branch without naming the cheap one or the tradeoff.

Per the carve rule in `we:docs/agent/backlog-workflow.md` ("a fork lives in a `kind: decision` item, never
inline in a story body"), the fork is carved out to
[a new decision item, x22ecxe](/backlog/x22ecxe-per-repo-backlog-data-model-distributed-backlog-md-tooling-p/),
parented under this item and blocking it. That item also flags a headline finding worth reading in full: the
premise this card and its parent epic (#2472) were framed on — that per-repo files are *the* way to get
cross-repo orchestration — may already be moot, since
[#500](/backlog/500-build-cross-locus-batch-locus-gate-registry-per-item-in-repo/) (resolved 2026-06-13,
before this card was opened) shipped a working, centralized alternative that is already running in
production (`we:agent-memory-src/conveyor-main-drive-cross-repo-playbook.md` documents 8 cross-repo items
landed this way in one session).

**Do not hand this card to a builder until x22ecxe is ratified.** Once it is, re-derive this story's design
(interfaces, tasks, acceptance) from the ruling — the resulting build may look nothing like "each repo gets
its own backlog/*.md," depending on which branch wins.
