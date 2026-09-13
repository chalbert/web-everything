---
bornAs: x1o71ec
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/operations/dispatch-provider-registry.mjs", "we:scripts/operations/dispatch-providers/build.mjs", "we:scripts/operations/dispatch-providers/fix.mjs", "we:scripts/operations/dispatch-providers/ci-heal.mjs", "we:scripts/operations/dispatch-providers/prepare.mjs", "we:scripts/operations/dispatch-providers/prepare-decision.mjs"]
dateOpened: "2026-09-13"
tags: []
---

# Self-registering provider descriptors for DISPATCH_PROVIDER_REGISTRY, not a shared hand-edited table

we:scripts/operations/dispatch-provider-registry.mjs's DISPATCH_PROVIDER_REGISTRY is a single frozen object literal every new mechanical-dispatch provider must be hand-edited into (its own docblock already names the cost: five copies of the same conditional branch and five env reads all land on the same handful of lines in the same 2000-line file, so unrelated lanes serialize on a textual conflict that has nothing to do with the work). Propose replacing the shared-object-literal shape with a self-registering descriptor pattern: each provider module (we:scripts/operations/dispatch-providers/*.mjs) exports its own {kind, provider, modeEnv, defaultMode} descriptor, and the registry discovers/imports them rather than being centrally hand-edited -- the same registry shape this repo already uses at we:scripts/lib/poc-branches.mjs (a frozen table plus pure fail-closed lookups, written via a declared registration step rather than hand-edited) and at we:scripts/lib/constellation-repos.mjs.

Evidence this is a live collision surface, not speculative: two independent sessions were both touching provider/judge-dispatch-related files concurrently tonight (2026-09-13) -- this session modifying we:scripts/lib/codex-judge-spawn.mjs twice (a model-pinning fix and a tool-free mislabeling fix) on lane/mechanical-dispatcher, and a peer session (webeverything-85, PR #2115) independently adding the same file as new work targeting main. One real file overlap was found on we:scripts/lib/codex-judge-spawn.mjs itself. A self-registering descriptor pattern for DISPATCH_PROVIDER_REGISTRY would reduce exactly this class of concurrent-provider-integration collision for the dispatch-provider registry specifically.

Raised jointly: webeverything-85 (a peer session working PR #2115) independently proposed this same restructuring and agreed it is structurally right, but flagged -- correctly, per this repo's never-take-an-unprepared-decision doctrine (no ruling without a preparedDate) -- that it should be prepared and ratified as a decision, not built ad hoc. This card is filed jointly on that basis: webeverything-85 raised/agreed the direction, this session (epic #3383) is filing it through the declared operation. Needs a prepare pass before it is ready to ratify; not built here.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
