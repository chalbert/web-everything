---
bornAs: xq5aks4
kind: epic
status: open
dateOpened: "2026-07-10"
tags: [drain, review, agent-meta, efficiency, tooling]
---

# Main loop as coordinator: delegate the review pipeline, script the glue, template the renders

Move recurrent drain/review work off the main loop so the session **coordinates** rather than **executes**. A `/drain` session (2026-07-10) that cleared three review-parked PRs spent ~26 min of active work, but the main loop carried work it should only orchestrate: it hand-fanned the multi-lens review panel, ran the deterministic `review-core` reductions inline (`node -e` ×5), and hand-authored three PR comments. The judgment (which finding is real, gate-self→escalate, merge-vs-rebase) belongs in the loop; the fan-out, the reductions, and the prose do not.

Target shape for a drain/review session: `acquire → drain --json → launch review Workflow → apply its structured results → re-drain → release`, plus the few human-judgment forks. Three levers — **delegate** the pipeline, **script** the glue, **template the renders** — plus a standing check so this keeps getting found.

## Candidate slices (`/slice` before batching)

1. **`review-parked-prs` Workflow** — encode the panel↔editor↔re-review loop as a `Workflow` script: `pipeline(parked, panelReview → reducePanelVerdict → editorRound → reReview)`, calling `we:scripts/lib/review-core.mjs` inside, returning `{pr, disposition, verdict, commentBody}` per PR. Collapses ~24 hand-run steps into one launch. Matches the drain skill's "fanned out via the Workflow orchestrator." *(highest leverage; consumes slice 2)*
2. **`review-core` CLI entrypoint** — `we:scripts/lib/review-core.mjs` exports the pure functions but has no command line. Add `reduce` (findings→verdict/outcome/disposition + table), `mandate` (`--lens` / `--editor`), `comment` (render the full PR comment) subcommands. Replaces 5× inline `node -e`; makes the reductions testable; unblocks slice 1.
3. **Single-source the outbound renderers** — the recurrent artifacts should render from structured data, not be hand-typed: the PR **review comment** (`renderPanelVerdictTable` already exists — extend to the whole comment), the **escalation / clearance notice**, the **drain end-of-run summary**, the **close-session report**. Principle: *template the render, not the prose* — a renderer over `{findings, verdict, disposition}` can't lie; a prose mad-lib can. Single-sourced so `/drain` and `/review` can't drift.
4. **Fetch/state helpers** — `fetch-parked <nums…>` (dump `{diff,title,body,files,state,checks}` per PR in one call, standardizing the paths reviewers read), `wait-green <pr>` (poll until required `test` is green/timeout), `pr-state <nums…>` (the one-line mergeable/state/checks view rerun ~6× by hand).
5. **`who-cleared <pr>` clearance-provenance checker** — the drain's #387 "incident" check (label-event timeline + `/review` clearance marker) was ad-hoc. That IS the #2416 gap ("honor `review:accepted` only from a real human clearance"). Make it a deterministic guard, not a one-off. Coordinate with #2416 (do not duplicate).
6. **`closing-session`: standing efficiency-introspection step (all session types)** — every close, after the safety/health audit, scan the session transcript for (a) main-loop steps that should have been delegated and (b) ad-hoc command sequences that should be scripted, and emit a bounded, evidence-based proposals table. Skips trivial sessions. This is the meta that keeps surfacing slices 1–5 for future session types.

## Out of scope / notes

- The **decisions** stay in the loop — automation removes the glue *between* decisions, never the judgment itself (which finding is real, gate-self→escalate, merge-vs-rebase strategy, the clearance call).
- Relates to #2416 (single-PAT clearance provenance) and the #2285/#2310/#2311 review-core engine — this epic is about *where the loop runs*, not changing the review policy.
- Source: the drain-session efficiency introspection (2026-07-10). This epic is itself the first output of slice 6.
