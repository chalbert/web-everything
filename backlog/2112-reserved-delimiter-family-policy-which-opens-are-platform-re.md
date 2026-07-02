---
kind: decision
status: open
dateOpened: "2026-07-02"
tags: []
---

# Reserved delimiter-family policy — which opens are platform-reserved for userland custom nodes

Deferred child of #2074: which static open delimiters are platform-reserved vs userland-legal (the Custom-Elements hyphen-rule analogue for the delimiter keyspace), plus the exact raw/verbatim escape-hatch + override grammar. Gates nothing today — DelimiterCollisionError is normative and buildable without it (#2104) — low urgency until a real collision or the framework-flavor bundles (#2094) force the call.
