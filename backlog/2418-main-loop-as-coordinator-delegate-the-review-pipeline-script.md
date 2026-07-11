---
bornAs: xq5aks4
kind: epic
status: open
dateOpened: "2026-07-10"
relatedReport: reports/2026-07-11-backlog-split-analysis.md
tags: [drain, review, agent-meta, efficiency, tooling]
---

# Main loop as coordinator: delegate the review pipeline, script the glue, template the renders

Move recurrent drain/review work off the main loop so the session **coordinates** rather than **executes**. A `/drain` session (2026-07-10) that cleared three review-parked PRs spent ~26 min of active work, but the main loop carried work it should only orchestrate: it hand-fanned the multi-lens review panel, ran the deterministic `review-core` reductions inline (`node -e` ×5), and hand-authored three PR comments. The judgment (which finding is real, gate-self→escalate, merge-vs-rebase) belongs in the loop; the fan-out, the reductions, and the prose do not.

Target shape for a drain/review session: `acquire → drain --json → launch review Workflow → apply its structured results → re-drain → release`, plus the few human-judgment forks. Three levers — **delegate** the pipeline, **script** the glue, **template the renders** — plus a standing check so this keeps getting found.

## Slices

**Sliced 2026-07-11** (`/slice`; report `we:reports/2026-07-11-backlog-split-analysis.md`). Six child slices scaffolded; original candidate 3 split into two (the PR-comment renderer C needs, plus the rest), candidate 2's `comment` subcommand folded into that renderer to remove the overlap. Candidate 5 stays here as could-not-split (below).

- **A — review-core CLI: `reduce` + `mandate`** (`#xjtogd2`, story·3) — command line over `we:scripts/lib/review-core.mjs`'s pure fns; `reduce` (findings→verdict/outcome/disposition + table), `mandate` (`--lens`/`--editor`). Replaces 5× inline `node -e`. *Foundational.*
- **B — PR review-comment renderer** (`#x5xxhr7`, story·3) — `renderPanelComment({findings, verdict, disposition})` (extends `renderPanelVerdictTable`) + the `comment` CLI subcommand. *Feeds C.*
- **C — `review-parked-prs` Workflow** (`#xxzv5jw`, story·3, blocked-by A+B) — `pipeline(parked, panelReview → reducePanelVerdict → editorRound → reReview)`; ~24 hand-run steps → one launch.
- **D — Session/notice renderers** (`#xja00k1`, task·2) — drain end-of-run summary, close-session report, escalation/clearance notice, all from structured data.
- **E — Fetch/state helpers** (`#xjmwxw5`, task·3) — `fetch-parked`, `wait-green`, `pr-state`.
- **F — `closing-session` standing efficiency-introspection step** (`#xla8zta`, story·3) — the meta that keeps surfacing A–E.

### Could not split — `who-cleared <pr>` clearance-provenance checker

The drain's #387 "incident" check (label-event timeline + `/review` clearance marker) was ad-hoc. That **IS the #2416 gap** ("honor `review:accepted` only from a real human clearance"). Whether `who-cleared` is a distinct diagnostic CLI or is subsumed by #2416's in-gate enforcement (`decideReviewGate` reading actor provenance) is an unresolved scope boundary — scaffolding it now risks duplicating open #2416. **Unblock:** work #2416 first, then decide (thin CLI over its provenance fn, or drop). Tracked by #2416; not scaffolded here to avoid the duplicate.

## Out of scope / notes

- The **decisions** stay in the loop — automation removes the glue *between* decisions, never the judgment itself (which finding is real, gate-self→escalate, merge-vs-rebase strategy, the clearance call).
- Relates to #2416 (single-PAT clearance provenance) and the #2285/#2310/#2311 review-core engine — this epic is about *where the loop runs*, not changing the review policy.
- Source: the drain-session efficiency introspection (2026-07-10). This epic is itself the first output of slice 6.
