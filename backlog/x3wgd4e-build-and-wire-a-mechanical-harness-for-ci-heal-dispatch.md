---
kind: story
size: 5
parent: "x54akv4"
status: open
relatedTo: ["3628"]
scope: ["we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/guard-bash.mjs"]
dateOpened: "2026-09-12"
tags: []
---

# Build and wire a mechanical harness for ci-heal dispatch

Per the 2026-09-12 delegation audit on we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md, ci-heal is one of six unwired dispatch launch kinds, with NO existing wrapper at all -- no we:scripts/operations equivalent of we:scripts/operations/deliver-item-wrapper.mjs has been written for this kind. The dispatched ci-heal agent still runs its own full lifecycle (reconstitute the PRs lane by ref, diagnose the CI failure, fix it, push, rearm) out of its own prose brief, we:skills-src/conveyor/fix-agent-ci-brief.md. No prior design/decision card exists specifically proposing a ci-heal wrapper shape (unlike build -> #3627 and fix -> #3629, though ci-heal is closely related to fix -- both are PR-keyed repair dispatches per we:scripts/operations/dispatch-lane.mjs own BRIEF_REQUIRED_BY_KIND grouping); this item may need a small design decision of its own during build (whether ci-heal reuses the fix wrapper this epics own fix child produces near-verbatim, given the two kinds already share a brief-shape grouping in dispatch-lane, or needs its own wrapper), or may simply follow the same pattern build/fix/review already established -- use judgment during build rather than treating this as a prerequisite design task. Sequencing note: building this AFTER the fix child (this epics own sibling item) lands is likely lower-cost, since ci-heal and fix are the two PR-keyed repair kinds and may share most of a wrapper, but this item does not block on that -- use judgment. Per we:docs/agent/prototype-based-dev.md, park until genuinely exercised via a real driver+observer live test before this replaces the production ci-heal path. Restart-survival note: see the parent epics own cross-cutting acceptance criterion -- whichever shape this wrapper takes, it must not introduce a long synchronous/blocking step inside the long-lived runner process that a runner restart would lose or corrupt; verify this explicitly before considering the item done.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
2. **Restart-survival preserved** — a runner restart mid-dispatch must not lose or corrupt work this wrapper
   is mid-executing (see the parent epic's own cross-cutting acceptance criterion, 2026-09-12).
