---
kind: story
size: 5
parent: "x54akv4"
status: open
relatedTo: ["3629", "3628"]
scope: ["we:scripts/operations/fix-dispatch-wrapper.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:skills-src/conveyor/fix-agent-brief.md", "we:scripts/guard-bash.mjs"]
dateOpened: "2026-09-12"
tags: []
---

# Wire fix dispatch to the fix-dispatch wrapper, after resolving the WE_DISPATCH_KIND=fix two-spawner conflict

Per the 2026-09-12 delegation audit on we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md, fix is one of six unwired dispatch launch kinds: the dispatched fixer agent still runs its own lifecycle (reconstitute-by-ref, gh pr view, adversarial self-review subagent, we:scripts/conveyor/rearm-review.mjs / we:scripts/conveyor/stand-down.mjs) out of we:skills-src/conveyor/fix-agent-brief.md, a full prose brief still self-labeled PROTOTYPE, instead of a mechanical harness. we:scripts/operations/fix-dispatch-wrapper.mjs already EXISTS as unwired code -- nothing calls it on the dispatch path. KNOWN BLOCKER, named in the same audit and must be resolved as part of this item, not worked around: WE_DISPATCH_KIND=fix is currently stamped by TWO DIFFERENT SPAWNERS with incompatible contracts (the live we:scripts/operations/dispatch-lane-io.mjs path vs. this unwired wrapper) -- wiring the wrapper behind that single shared env value today would mis-harness whichever spawner is not the one being wired, so the conflict must be diagnosed and resolved (a real design/naming fix, e.g. distinguishing the two spawn shapes on a different key) before the wrapper can be turned on at all. This is NOT a just-flip-the-flag item, unlike some of its siblings. Cites #3629 (the design proposing this exact wrapper shape for fix -- reuse we:scripts/operations/deliver-item-wrapper.mjs own CLAUDE_RESTRICTED_PROVIDER, foreground/blocking, per #3629 own reasoning that fix performs real code-editing judgment the same way build does) as context, not superseded. Per we:docs/agent/prototype-based-dev.md, park until genuinely exercised via a real driver+observer live test before this replaces the production fix path. Restart-survival note: see the parent epics own cross-cutting acceptance criterion -- like build, the proposed wrapper foreground-blocks on its agent spawn rather than using todays detached --bg shape every other kind relies on to survive a runner restart; this item must resolve whether that blocking call is restart-safe before it is considered done.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
2. **Restart-survival preserved** — a runner restart mid-dispatch must not lose or corrupt work this wrapper
   is mid-executing (see the parent epic's own cross-cutting acceptance criterion, 2026-09-12).
