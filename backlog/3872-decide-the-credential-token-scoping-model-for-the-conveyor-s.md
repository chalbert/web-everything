---
bornAs: x5ljiz4
kind: decision
parent: "3383"
status: open
scope: ["we:skills-src/conveyor/", "we:scripts/conveyor/"]
dateOpened: "2026-09-22"
tags: []
---

# Decide the credential/token scoping model for the conveyor's daemonized processes

Daemonizing the conveyor runner (epic #3383, see #3860 and its sibling slices) splits one process into several long-lived ones. Today every mechanical pass inherits the SAME operator environment and GH credential; no mechanism exists to give one daemon (e.g. a read-only watcher) a narrower credential than another (e.g. the Fix-dispatch or Review daemon, which can spawn agents and post to PRs). This is an open design fork, not a code gap: options include a GH App with per-daemon-role installation tokens, fine-grained personal-access tokens scoped per role, or accepting today's full-environment inheritance as the status quo (unchanged, not worsened, by the split itself) until a real incident forces the question. Explicitly carved out of #3860's build slices per this repo's split-safety rubric (a slice cannot bury an unresolved decision) -- filed here as its own decision so it can be prepared and ratified on its own timeline without blocking any of #3860's sibling build slices, none of which depend on it landing first.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
