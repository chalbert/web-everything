---
kind: decision
parent: "3383"
status: open
scope: ["we:docs/agent/platform-decisions.md", "we:scripts/lib/poc-branches.json", "we:scripts/lib/daemon-self-sync.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# Amend clause 4(a) of #poc-branch-declared-delivery-mode: daemons may track a POC branch as steady state

we:docs/agent/platform-decisions.md#poc-branch-declared-delivery-mode clause 4(a) says the runner's own steady state is still tracking main -- a POC branch is a delivery TARGET for items that declare it, never the default tracking ref. we:scripts/lib/poc-branches.json now registers lane/daemon-poc with conveyor daemons (review/merge/drain) running FROM it, not just landing into it, on the operator's own ruling (2026-09-23, in conversation, verbatim): I'd thought we would first fix the deamon in protoytpe to go quick and then graduat to main once perfect -- followed by yes to: a POC branch holding daemon fixes that land without review wait, daemons run from it, and each fix also graduates to main through the normal PR. This item proposes ratifying that ruling as an explicit amendment to clause 4(a): a POC branch MAY be a daemon's tracking ref when the branch is registered, autoSync-mechanically-kept-current with its graduation target (we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync), and every fix still graduates through its own PR. Filed rather than silently edited into the statute -- the statute is not touched pending ratification. See backlog/xii6vye-*.md (the registered branch's own graduation tracking item) for the concrete instance this ruling authorized.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
