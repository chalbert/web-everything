---
kind: story
size: 3
status: open
scope: ["we:scripts/audit-backlog-health.mjs"]
dateOpened: "2026-09-06"
tags: [backlog, audit, gates, health, refs]
---

# G1 and D2 cannot see a four-digit backlog id at all

`check:health`'s two ref-walking gates match a cited id with a **three-digit-maximum** bound:

```js
// we:scripts/audit-backlog-health.mjs lines 129–130
const PROSE_PREREQ = /\b(gated on|blocked on|…|builds on)\s+#?(\d{1,3})\b/gi;   // G1
const ANY_REF      = /(?:#|\/backlog\/)(\d{1,3})\b/g;                          // D2, and two other walks
```

`\d{1,3}\b` cannot match `#2209`. The engine takes `220`, finds no word boundary before `9`, backtracks to
`22` and `2`, fails the boundary each time, and reports **no match at all** — it does not truncate, it
misses. Verified by running the two literals against a case list rather than read off the pattern:

| citation | `ANY_REF` (G1/D2) | G8's own regex |
| --- | --- | --- |
| `#39` | `39` | *(nothing)* — the #1957 finding, fixed |
| `#607` | `607` | `607` |
| `#2209` | *(nothing)* | `2209` |
| `#3512` | *(nothing)* | `3512` |

The board runs to **#3512**, so the bound is blind to the majority of the corpus. Both regexes are live —
`ANY_REF` at lines 336, 365 and 522 (D2's dangling-ref walk), `PROSE_PREREQ` at line 425 (G1's
undeclared-prereq walk) — so this is not a dead definition. It is consistent with what the counts show:
**D2 = 1** across 3,495 items, which reads as a clean board and is instead a gate that stopped seeing.

## Why this is filed rather than fixed in place

It is the same defect class the #1957 review caught in the **new** G8 gate — a digit-count bound fitted to
the id shape that happened to be in front of the author — but it is **pre-existing** and lives in gates
this session did not touch. Widening it changes what G1 and D2 report across the whole board, which is a
measurement change that deserves its own diff and its own before/after count, not a rider on an unrelated
one.

## The trap to avoid when fixing it

Do **not** widen and land in one step. G8's fix was safe to land immediately because widening it moved the
count **9 → 9** — measured, not assumed. These two will not be inert: expect G1 and D2 to surface a backlog
of citations that were never visible. Measure first, then decide whether the new hits are findings to work
or noise the gate should scope down, exactly as the #1498 lesson prescribes — narrow the *subject*, not the
recency.

The `\b` on the right is also load-bearing for a different reason worth keeping: it is what stops `#2209`
from matching as `220`. A fix that reaches for `\d+` without it would start reading prefixes of ids as ids.

## Done when

1. **Executable** — `PROSE_PREREQ` and `ANY_REF` match a cited id of any length the board actually uses, and
   named tests pin **both** ends (a 1–2 digit id and a 4-digit id), so a future re-narrowing reddens rather
   than going quietly blind. Mirror the two cases added to `we:scripts/__tests__/audit-backlog-health.test.mjs`
   for G8.
2. The before/after G1 and D2 counts are recorded on this card — the point of the change is what the gates
   can now see, and a fix that does not state the delta has not demonstrated it works.
3. Any resulting hit surge is triaged as findings-to-work or as a scoping change to the gate's subject, and
   the choice is stated. Landing a gate that fires 400 times is not landing a gate.
