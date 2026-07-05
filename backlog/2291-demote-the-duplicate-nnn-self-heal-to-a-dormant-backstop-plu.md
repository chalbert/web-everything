---
kind: story
size: 5
parent: "2289"
status: open
blockedBy: ["2288"]
dateOpened: "2026-07-05"
tags: []
---

# Demote the duplicate-NNN self-heal to a dormant backstop plus a tripwire

Once JIT numbering makes duplicate-NNN unrepresentable, the self-heal stops being the primary mechanism but is KEPT as defense-in-depth. Retain the shared collision-heal helper at the drain (the sole writer) as a dormant backstop; prune only the now-dead heal wiring on the deprecated /pr and /merge routes. Turn the pre-merge duplicate-NNN check (#2248) into a tripwire: an assertion that should never fire post-JIT, and if it ever does, it signals a JIT allocation bug and alerts rather than silently healing. Net: prevention is primary, heal is the safety net, nothing is thrown away.
