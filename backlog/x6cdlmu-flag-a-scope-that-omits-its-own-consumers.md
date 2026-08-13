---
kind: story
size: 3
parent: xl2q1zt
status: open
dateOpened: "2026-08-13"
tags: [delivery, backlog, readiness, preparation]
scope:
  - we:scripts/readiness/scope-consumers.mjs
  - we:scripts/readiness/__tests__/scope-consumers.test.mjs
  - we:scripts/check-readiness.mjs
---

# Flag a scope that omits its own consumers

**The single highest-frequency predictor of a long review in this repo: a card names the file being changed
and says nothing about the modules that import it.** Three of the four surveyed disasters had exactly this
shape, and it is fully mechanical to detect before any work starts.

Given an item's `scope:`, find every module that imports a file in it, and report any importer the scope
does not already cover.

## The three cases this would have caught

- **[#3090]** declared `we:scripts/lib/gate-health.mjs`. Its one consumer,
  `we:scripts/operations/gate-health.mjs`, was NOT in scope — and that consumer's blocker sentence, not the
  library function, was what three review rounds were actually about. The check flags it immediately: one
  importer, not covered.
- **[#3091]** declared four files and the discipline they share. Four separate call sites each had to honour
  it independently, and reviewers found them one at a time across six rounds. Every one is an importer of
  `we:scripts/operations/effect-executor.mjs`.
- **[#3084]** declared three files and touched about twenty, because a new status vocabulary had to reach
  every hand-back in the run lifecycle. Those hand-backs are importers.

[#3071] is the honest counter-example and belongs here: its scope was **exactly right** and it still failed,
for an unrelated reason (nothing had measured whether the work would unblock anything). This check would
have said nothing about it, and the card should not pretend otherwise.

## Shape

A pure module, `we:scripts/readiness/scope-consumers.mjs`, plus a report surface. Io is injected so the pure
half is unit-testable with a stub file list — the house pattern.

- **Reuse `coversFile` and `normScope`** from `we:scripts/readiness/scope-lease.mjs`. They are
  granularity-aware — a subtree/glob entry covers by prefix, a FILE entry covers only its exact path — and a
  second matcher here would drift from the one the dispatcher uses.
- The import scan is **static and literal-only**. `we:scripts/operations/__tests__/import-graph.mjs` already
  does the forward direction (what does X import) and documents its blind spots honestly: a non-literal
  specifier is invisible, injected values are invisible, package specifiers are not followed. This needs the
  REVERSE direction, and inherits every one of those blind spots. Say so where the result is reported —
  under-reporting is the failure mode, and a check that claims completeness it does not have is the exact
  defect class this epic exists to reduce.

## Done when

- [ ] Given a scope list and a repo file index, the module returns each scope file's importers and which of
      them the scope does not cover.
- [ ] `coversFile`/`normScope` are imported, not reimplemented — a test asserts a subtree entry covers a file
      beneath it and a FILE entry does not cover its siblings.
- [ ] A report surface an operator can actually run for one item and for the whole open board. A check
      nothing can reach is a script with extra steps.
- [ ] Re-running it over [#3090], [#3091] and [#3084]'s cards as they were written reproduces the omissions
      above. This is the acceptance test that matters — the check has to earn its place on real history, not
      on a fixture invented to make it pass.
- [ ] The stated blind spots are in the OUTPUT, not only in a docblock, so a reader is never told the scan is
      exhaustive.

## Watch for

- **A missing importer is a QUESTION, not an error.** Plenty of consumers legitimately need no change. The
  useful output is "these importers exist and your scope does not mention them — deliberate?", and it should
  warn, never block. A gate that hard-fails here would train people to pad `scope:` until the check shuts up,
  which destroys the dispatcher's overlap arithmetic — `scope:` is load-bearing for lane contention, not
  documentation.
- Test files import the module under test constantly. A test importer is not a finding unless the scope names
  no test file at all.
