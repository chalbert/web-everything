---
bornAs: xhqljee
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# the operations gate family is documented only in code comments

#3224 and #3253 both gate how skills and docs invoke operations, and neither is described in any .md — grep for 3224 across `we:docs/` and `we:skills-src/` returns nothing. Someone hitting a finding has only the message and the source to go on, and the limit the #3253 gate deliberately states in its finding text (it proves a call is well-formed, never that a rewire preserved the raw home behaviour) exists nowhere a reader would look before starting a rewire. Give the family one short section, and name there which operations are structurally unverifiable and why.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after (see the parent #3253 for the shape).
