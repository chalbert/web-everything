---
kind: decision
parent: "3383"
status: open
relatedTo: ["3717", "3690", "3443", "3730"]
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/dispatch-task-type.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Decision: review the five choices the #3717 dispatch-routing build made (forks A to E)

Review the five choices the #3717 build made on the prototype branch (commit `0f1d0fb8f`, pushed to `lane/mechanical-dispatcher`, no pull request) where the card left a call open. The worker chose the smallest reading at each fork and recorded the alternatives; nothing here is ratified. One card, not five: all five sit in one small area (`we:scripts/lib/dispatch-contracts.mjs`, `we:scripts/lib/dispatch-task-type.mjs`) and are ruled together. Relates #3717, #3690 (the router's graduation model, unratified), #3443 and #3730.

*Not prepared:* no skeptic pass has run and there is no `preparedDate`. **The bold default in each fork is the choice the build made**, copied from the build-3717 result (section Forks); the operator's review is what turns it into a ruling. Each was re-read in the code on the prototype tip on 2026-09-21.

## FOUND (re-verified 2026-09-21)

- **Built and contained in the branch.** `git merge-base --is-ancestor 0f1d0fb8f origin/lane/mechanical-dispatcher` succeeds. There is one entry point, not two: the `routeDispatch` function in `we:scripts/lib/dispatch-contracts.mjs` already composed `selectProvider` and `selectSupervisionLevel`, so the build added only the missing `taskType` derivation (`we:scripts/lib/dispatch-task-type.mjs`) and the wiring.
- **Every route resolves to Claude today, and that is not caused by any fork below.** The 18 scorecard records on the branch carry no `taskType` and no `outcome`, so the router's `{provider, model, taskType}` trust unit can never accumulate a clean trial. Recorded here so it is not mistaken for a fork; it needs its own card (trial data, not wiring).

## Fork A — which `routeDispatch` stage a code-change launch is

`routeDispatch` has two stages. At `story` it never calls `selectProvider` and forces Claude; only `task` runs the provider cascade. The card says a non-Claude decision must be recordable as `routed: codex, executed: claude`, which the story stage cannot do.

- **(a) [default, built] `task` for `build`, `fix` and `ci-heal`** (`we:scripts/lib/dispatch-contracts.mjs`, the `routeDispatch(..., { stage: 'task' })` call in `decideDispatchRoute`). The card's own taskType table would be pointless if `bugfix` and `build-new-feature` never reached the cascade.
- **(b) `story` for a `build` launch.** Rejected by the build: it is the G1 contract's own reading (a `build` launch is a story-stage supervisor), but it forces Claude and makes the routing table unreachable. Reversing is one argument in `decideDispatchRoute`.

## Fork B — the three task types no dispatch kind produces (`self-fix`, `other`, `conflict-resolution` only by cause)

- **(a) [default, built] None is ever produced.** `self-fix` and `other` are unreachable; `conflict-resolution` comes only from a `fix` whose cause is a conflict. Stated as data (`TASK_TYPES_WITHOUT_PRODUCING_KIND`) and asserted as a negative across every kind, cause and scope combination, so a later kind cannot reach a provider without a table row.
- **(b) Add a `self-fix` dispatch kind.** Rejected: invents a kind nobody dispatches. Viable later if a real self-fix dispatch appears.
- **(c) Map `other` to a default type.** Rejected: 10 of the 26 scorecard records are `other`; a default would silently route the catch-all, which is the router's `bugfix` default the card said must be unreachable.

## Fork C — role dispatches (`prepare`, `prepare-decision`, `investigate`, `review`) never call the router

`routeDispatch` cannot be called without a `taskType`, and the card says those roles have none.

- **(a) [default, built] A role dispatch records `outcome: 'role', routed: null` and keeps its existing Claude spawn.** The route is still recorded, and it is still mechanical: the kind decided it.
- **(b) Map `prepare` and `review` onto `triage-research` or `architectural-decision`.** Rejected: a guess; those task types have their own trust history and forced-Claude rules.
- **(c) Give the router a role stage.** Rejected for now: widens the router (#3690's module) beyond this build; reasonable if roles are ever to leave Claude.

## Fork D — an unsized card reads as 900 lines of code

`buildDispatchProfile` needs an estimated size in lines. A card with no `size:` reads as the LARGEST band (13, that is 900 lines, `SIZE_TO_ESTIMATED_LOC`), which sits outside every proven envelope, and the record carries `sized: false` plus an audit entry. About 1,150 of the 3,661 cards in this checkout have no `size:` line in their frontmatter (1,147 counted on 2026-09-21; the build reported 1,148); that count includes decisions and epics, which are unsized by design, so the share of buildable cards affected was not measured.

- **(a) [default, built] Unknown size reads as 900 lines (outside every envelope).** Understating is the dangerous direction: it is what would put a task inside a proven envelope and hand it to a non-Claude provider.
- **(b) Refuse an unsized dispatch.** Rejected: would stop a large share of the conveyor.
- **(c) Derive a size from the card's declared scope.** Not built; reasonable follow-up, but it adds a heuristic to a path meant to have none.

## Fork E — the provider override is environment variables, not a command-line flag

The card asks for `--provider-override=<p> --override-reason=<text>` at the call site. `we:scripts/operations/__tests__/dispatch-lane.test.mjs` pins the operation's declared input set (three names), and the brief forbade breaking it.

- **(a) [default, built] `WE_DISPATCH_PROVIDER_OVERRIDE` plus `WE_DISPATCH_OVERRIDE_REASON`, both required,** read at the IO edge (`we:scripts/operations/dispatch-lane-io.mjs`) with the file's own precedent (`WE_BUILD_DISPATCH_MODE`). An override with no reason, a reason with no override, and an unknown provider are each refused, and both land in the run record. `decideDispatchRoute` takes them as ordinary arguments, so a flag can be added later with no change to the decision logic.
- **(b) Add the two flags as declared operation inputs.** What the card asked for. Rejected by the build only because it breaks a pinned test; it is a small follow-up if the operator wants the flag form (the test's pin is updated in the same change).
- **(c) No override at all.** Rejected: the card requires an explicit, recorded override so a route is never a sentence in a brief.

## Not in this decision

- `dispatch-task` (#3730) is not wired: its `kind` is a free label, so its `taskType` is not derivable and wiring it as-is would refuse every brief-file worker launch. Named as the follow-up.
- Supervision enforcement is computed and recorded but OFF by default (`WE_DISPATCH_SUPERVISION_ENFORCE`); #3690 is unratified.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*review-the-five-choices-the-3717-dispatch-routing*.md` lists this card (it fails until the operator has reviewed and a `## Ruling` section names the outcome for each of forks A to E).
2. A ruling that reverses a fork names the one-line change: fork A is the stage argument in `decideDispatchRoute`; fork E adds two declared inputs and updates the pinned input set in `we:scripts/operations/__tests__/dispatch-lane.test.mjs`.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
