---
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# the 3224 exemption walk does not recognise a multi-line HTML comment

`COMMENT_LINE` in `we:scripts/lib/skill-operation-wiring.mjs` matches a line that STARTS with a comment token, so a multi-line HTML comment block exempts nothing: its continuation lines begin with prose, the upward walk stops at the first of them, and the marker on the opening line is never reached. Hit while exempting three real sites — the markers silently did nothing until rewritten as single long lines. The failure is quiet in the wrong direction (a marker that looks present and is inert), so either recognise a line inside an open comment block, or refuse a marker the walk cannot reach, rather than leaving it to do nothing.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
