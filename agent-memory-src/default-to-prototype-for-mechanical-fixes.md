---
name: default-to-prototype-for-mechanical-fixes
description: "Standing instruction — any request to fix/improve the mechanical dispatch system defaults to working in origin/lane/mechanical-dispatcher (the prototype), without the user needing to say so."
metadata:
  type: feedback
---

**Operator (2026-09-12): "make sure that if I asked to fix or improve something in the mechanical
system, the default is to do it in the prototype without me having to specify."**

[[prototype-is-source-of-truth-for-mechanical-work]] already says the prototype branch is the
current source of truth for reasoning about what's running. This extends it to WHERE new work
lands: a fix/improve/build request touching the mechanical/dispatch system defaults to the
prototype, not `main`, with no need to be told each time.

**How to apply:** When asked to fix, improve, or build something in the mechanical-delivery system
(dispatch-lane, the conveyor runner/supervisor, branch-sync/branch-drift, wake.mjs, dispatch-abort,
and similar `we:scripts/conveyor/*` / `we:scripts/operations/*` dispatch machinery under epic
#3383) with no branch specified, base the work on `origin/lane/mechanical-dispatcher` (a fresh
scratch clone of it, or a lane cut from it) — not `main`. Still normal lane-clone → PR workflow,
just targeting/based on the prototype branch instead of `main` by default. Only target `main`
directly when the user says so explicitly, or the specific piece has already been split out and
landed there for real.
