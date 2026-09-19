---
kind: decision
status: open
dateOpened: "2026-09-18"
preparedDate: "2026-09-18"
tags: [github, rate-limit, polling, architecture, event-driven]
---

# Shift from polling to event-driven GitHub state push — decision point on rate-limit recurrence

Tonight (2026-09-18) the account hit a real GitHub GraphQL secondary-throttle. Two architectural levers exist: **(1) consolidate redundant polling** — already landed as PR #2303 — and **(2) event-driven state push using GitHub Actions** (proven feasible via dormant `we:ops/pr-views`). **Defer Lever (2) preemptively.** Treat the next real rate-limit hit — after Lever (1) and #3670's consolidation have helped — as the trigger to build the event-driven alternative, keeping scope tightly bounded and design informed by fresh evidence.

## The levers

### Lever (1): Consolidate and throttle redundant polling — already in progress

Migrating ~78 remaining unthrottled `gh` call sites to use `we:scripts/lib/gh-throttle.mjs` (the throttling wrapper), with focus on the highest-cadence sites (`we:scripts/conveyor/pr-watch.mjs` at 20s, `we:scripts/wait-green.mjs` at 15s, `we:scripts/conveyor/tick-core.mjs` per-tick). This is the scope of #3670. PR #2303 already shipped the 4-way per-tick fetch dedup (consolidating redundant polling within a single tick). This lever trades latency for quota sustainability and requires no new infrastructure.

### Lever (2): Event-driven state push via GitHub Actions — hold until triggered

Shift from "many processes polling on a timer" to "GitHub Actions workflow pushes state changes to a shared local file only when something actually happens," using a separate GitHub token/quota (already proven feasible via the dormant `we:scripts/stage-pr-view.mjs` / `we:ops/pr-views` infrastructure). This lever requires new infrastructure — a GitHub Actions workflow to watch specific events (PR state changes, CI completion, etc.) and write to a shared artifact or webhook target — and upfront design cost. It solves the root problem (event-driven reactivity) but is only needed if Lever (1) + #3670's consolidation do not provide breathing room.

## Decision

**Do not build Lever (2) preemptively.** Treat the **next real GitHub rate-limit or secondary-throttle hit** — occurring after Lever (1) and #3670's consolidation have had a chance to help — **as the decision trigger to actually build the event-driven alternative.** This keeps scope tightly bounded: if consolidation suffices, the work is unnecessary; if throttling recurs, the decision is immediately actionable, with full context, audit findings, and a known design surface (the dormant `we:ops/pr-views` precedent).

## Grounding

- **Tonight's audit:** ~78 of ~84 `gh`-calling sites in the repo remain unthrottled despite #3631 marking the throttling migration as resolved; the high-cadence sites are `we:scripts/conveyor/pr-watch.mjs` (20s poll), `we:scripts/wait-green.mjs` (15s poll), and per-tick calls in `we:scripts/conveyor/tick-core.mjs`. PR #2303 consolidated 4-way per-tick dedup and is already landed. #3670 tracks the remaining migration to wrap all sites with `we:scripts/lib/gh-throttle.mjs`.
- **Dormant precedent:** `we:scripts/stage-pr-view.mjs` and `we:ops/pr-views/` already demonstrate a working pattern for GitHub Actions workflow + local state file handoff, proving feasibility at near-zero risk.
- **Rationale for deferral:** Lever (1) may be sufficient to prevent recurrence; if not, the next hit will come with fresh evidence of which cadences matter most, allowing the event-driven design to target the real bottleneck instead of guessing.
- **Filing history:** this decision was first drafted and committed in a lane clone (lane-58, commit `aea2e38c0`) earlier tonight, but that lane's local `main` branch was never pushed or landed via PR, so the item never reached `origin/main` and a later verification pass found it missing. Re-filed here with the same content, this time landed through the standard lane → PR flow.

## Done when

- [x] This decision is filed and prepared (ready to act on when the trigger — the next real rate-limit hit — occurs).
- [ ] After the next real rate-limit or secondary-throttle hit occurs (if it occurs), with Lever (1) + #3670 consolidation in place, this decision is reopened and Lever (2) immediately moves to active design / build as a story.

## Done only after (blockers)

#3670 should be complete or well advanced before the rate-limit trigger would meaningfully inform a Lever (2) design.
