---
bornAs: xvj8sj0
kind: story
size: 3
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateResolved: "2026-08-21"
tags: []
---

# verify has no gate input, so it cannot replace the call sites that choose one

The `verify` operation shells `we:scripts/verify-lane.mjs` but forwards no gate, while that home takes a gate command and `we:skills-src/conveyor/delivery-agent-brief.md` passes the item locus gate. So every call site choosing a gate cannot be rewired to the operation without silently dropping it — the #3224 scan flags the line and the honest answer today is an exemption marker. Add a gate input that passes through, and the exemption goes away.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/verify.test.mjs` passes, covering the
   pass-through at BOTH layers, because each can drop the value independently: the declaration's `run` step
   calls the injected runner WITH the gate and declares `input.gate` in its reads, and `verifyArgv` forwards a
   non-empty gate as one argv element while omitting the flag entirely when it is empty or the mode is `check`.
2. **Executable** — `npm run check:standards` reports no #3224 finding for
   `we:skills-src/conveyor/delivery-agent-brief.md`, and that line names the operation with no
   `@operation-home-ok` marker — the exemption is gone because the gap is closed, not because it was excused.
3. **Observable** — the brief's prose no longer promises the home's `exit 2 = red` contract, which the
   operation does not honour (#3243).
