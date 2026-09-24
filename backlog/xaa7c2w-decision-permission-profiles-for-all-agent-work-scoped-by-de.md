---
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-23"
tags: []
---

# Decision: permission profiles for all agent work (scoped by default, wrapper-run requests)

Follow-up of #3922. Amend #agent-mutations-through-typed-operations so every agent session runs under a permission profile chosen by its kind of work. Default scoped: reserved files, declared operations only, request-run and request-scope handled by the wrapper, every call tracked. Some kinds get wider profiles (for example an unscoped investigation). Rules the profile list, who gets which, who may widen. Must weigh that 72.2% of agent commands are low-risk reads.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
