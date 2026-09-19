---
name: default-to-prototype-for-mechanical-fixes
description: "Standing instruction — any request to fix/improve the mechanical dispatch system defaults to working in origin/lane/mechanical-dispatcher (the prototype), without the user needing to say so. Do not let doctrine rule 10's 'fix the runner, not a POC branch' carve-out override this by citation alone — that carve-out is for already-relied-upon production infra, not for finishing the still-being-built prototype."
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

**2026-09-12, later the same day — the rule-10 confusion this note exists to head off.** A
subagent (and the orchestrating session, initially agreeing) was asked to finish wiring the
not-yet-complete mechanical delegation for the build/prepare/fix/ci-heal dispatch kinds —
ordinary "fix/improve the mechanical system" work, exactly this note's own trigger. Instead of
defaulting to the prototype, it invoked doctrine rule 10
(`we:skills-src/mechanical-delivery-doctrine/SKILL.md`, amended via decision `#3637`): "a
mechanical fix to the delivery machinery itself still takes a SHORT-LIVED scratch lane cut fresh
off *current* `main`... 'I need a POC branch' is never the answer to 'I need to fix the runner'"
— and concluded from this that the harness-wiring work should land on `main` via the normal
PR/review flow, not the prototype. The operator corrected this: **"rule 10's carve-out... is meant
for genuine production-safety fixes to shared infrastructure already relied upon — NOT for
finishing an unfinished prototype-stage feature. The prototype is currently the ONLY functional
version of this machinery (main's conveyor can't even spawn agents autonomously yet), so 'quickly
iterate on the prototype' is the actual standing goal."**

**The real test — apply this, not surface pattern-matching on the words "fix" or "the runner":**
rule 10's "fix the runner, don't reach for a POC branch" carve-out fires ONLY when the capability
being touched is ALREADY relied upon in production — genuinely shared, already-functional
infrastructure that has a real bug in it right now. It does NOT fire merely because the work
touches dispatch/conveyor/mechanical-delivery code, and it does NOT fire because the request is
phrased as a "fix" or because the touched code lives in files also used by working paths. It
specifically does not cover completing, wiring up, or extending a capability that is still being
built for the first time — even when a plausible-sounding argument citing rule 10 (or any other
ratified rule) seems to apply. Since the prototype is presently the only functional version of
most of this machinery, "finish/wire an unfinished dispatch kind" is the COMMON case right now,
not the exception, and it stays on the prototype under this note's default. **When it is genuinely
ambiguous** which case applies, default to the prototype and ASK — never resolve the ambiguity by
defaulting to `main`.
