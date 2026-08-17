---
kind: story
size: 5
status: open
dateOpened: "2026-08-17"
tags: []
---

# Declare a file-backlog-gap operation; prove it for one use case before generalizing to skills

Surfaced by tonight's (2026-08-17) operations audit: filing a backlog gap (acquire lane, scaffold, author real Done-when criteria, commit, land via pr-land, dispatch a review, fix on bounce, re-review, merge) was done by hand roughly 10 times this session alone, with zero declared-operation support -- unlike review-pr/dispatch-lane/claim/gate-health/suggest-next, all already registered in we:scripts/operations/run.mjs. Two-phase shape per operator direction (2026-08-17): Phase 1 -- build and prove this as ONE concrete operation (compute the scaffold content, effect the write+commit+land, judge/confirm the Done-when quality bar before landing rather than relying on a human reviewer catching the unfilled-template placeholder after the fact, which recurred as a real bounce reason on #1447/#1449/#1450 tonight) for the single use case of filing a backlog item. Phase 2, explicitly NOT started until phase 1 is proven -- generalize so operations become callable from skills, not just the CLI/HTTP calling-axis we:scripts/operations/run.mjs already serves: skills like we:skills-src/next-backlog-item, we:skills-src/batch-backlog-items, we:skills-src/prepare-decision-item currently carry their own logic in parallel to the operations engine rather than invoking a declared operation as their implementation. Skills becoming a third calling-axis (alongside CLI/HTTP, mirroring the already-established declare-once-generate-every-caller thesis from #3029) is the payoff, but only once a real operation exists to plug in -- do not build the generic skill-plug mechanism speculatively ahead of a proven concrete case.

## Done when

1. **Executable (Phase 1 only)** — a `file-backlog-gap` operation is registered in we:scripts/operations/run.mjs (same registry as `review-pr`/`dispatch-lane`/`claim`), callable as `node we:scripts/operations/run.mjs file-backlog-gap --title=... --digest=...`, and its own step chain rejects an unfilled scaffold Done-when placeholder before landing (a `judge` or `confirm` step, not left for a human reviewer to catch after the fact) — a test asserts a placeholder-carrying draft is rejected and a real one passes through to a PR.
2. A test dispatches the operation end-to-end against a fixture item and asserts the resulting PR's backlog file has correct frontmatter, we:-prefixed paths, and no scaffold placeholder — mirroring `dispatch-lane`'s existing fixture-based test shape.
3. **Phase 2 is explicitly NOT done-when here** — no skill is wired to call this operation yet; that is the deferred, separate step per the two-phase shape above, only started once Phase 1 is proven in real use (not just tests).
4. `npm run check:standards` is 0 errors and the new operation's test suite is green.
