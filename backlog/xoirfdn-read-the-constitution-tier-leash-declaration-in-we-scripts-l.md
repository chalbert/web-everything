---
kind: task
parent: "3144"
status: open
dateOpened: "2026-09-21"
tags: []
---

# Read the constitution-tier leash declaration in we:scripts/lib/review-escalation.mjs (#3144 clause 1)

Make we:scripts/lib/review-escalation.mjs's isPrincipleSurface predicate read the constitution block declared on the POLICY_SPEC leash (the follow-on to #3144's leash-declaration item) and raise its verdict from human to entrenched for a listed anchor. Never a second hunk-to-anchor attributor — reads the leash declaration only. Committee-cleared (ratified agent-clearable, #2771 clause 1) — must not ride in the same PR as the leash declaration.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
