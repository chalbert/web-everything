---
name: keep-prototype-branch-synced-after-each-merge
description: "Standing instruction — sync the mechanical-dispatcher prototype branch (origin/lane/mechanical-dispatcher) against main proactively, after each merge that touches shared files, not only when a livelock forces it."
metadata:
  type: feedback
---

**The operator's own instruction (2026-09-03): "we have to keep prototype better up to date after
each merge."** Epic #3383's prototype checkout (`origin/lane/mechanical-dispatcher`, run from
`/Users/nicolasgilbert/workspace/wev-scratch-dispatcher-4` or an equivalent live checkout) must be
synced against `main` proactively — not left to drift until something breaks.

**Why this is a standing instruction, not a one-off:** it happened TWICE in one overnight session.
First, an ~8-hour silent drift (a stray uncommitted local diff blocked the auto-sync cron, which
nobody noticed until a livelock forced investigation) caused real dispatch capacity to burn on
already-resolved items for hours. Fixed by hand. Roughly 10 hours later, the SAME checkout had
drifted 86 commits behind `main` again — this time with a much bigger, riskier diff (`main` had
fully DELETED several files the prototype branch still referenced: `supervisor.mjs`,
`route-pr-outcome*.mjs`, a test file, a `.plist.example`). Each time the sync is deferred, the
eventual reconciliation gets larger and riskier, not smaller.

**How to apply, until the real mechanical fix ships:** `we:backlog/3464-a-long-lived-diverged-
prototype-branch-has-no-reconciliation.md` is the filed proposal for an actual reconciliation
cadence independent of a live session — that's the intended end state, not yet built. Until it
ships, whoever is driving a session against this prototype should proactively check
`git fetch origin main && git rev-list --count HEAD..origin/main` on the live checkout at natural
checkpoints (session start, after a batch of PRs land on `main`, or at minimum before leaning on the
checkout for anything load-bearing) — not just when a livelock or a stale-status symptom forces the
question. Do the sync in a SEPARATE clone, never directly in the live checkout while its runner
process is active (see [[verify-session-liveness-before-archiving]] and the #3383 standing doctrine
for why direct edits to a live-read checkout are risky), then push the resolved merge back to
`origin/lane/mechanical-dispatcher` and only then bring the live checkout forward.

**Supersede this note once #3464 ships** — proactive manual checking is a stopgap, not the intended
end state.
