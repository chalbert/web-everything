---
type: decision
status: open
dateOpened: '2026-06-02'
tags:
  - webtraits
  - lazy-loading
  - build-time
  - policy
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
---

# Default trait delivery: eager-bake vs split+lazy

When the Enforcer applies a declared trait at build time, does it bake the trait in eagerly (always applied, simplest) or emit a code-split chunk + a runtime defineLazy registration (on-demand load)? The richest option is build decides the split, runtime decides the load — automatic code-splitting + on-demand loading, exactly the 'Scale without Weight' mission. Decide the default and whether it is per-trait overridable.
