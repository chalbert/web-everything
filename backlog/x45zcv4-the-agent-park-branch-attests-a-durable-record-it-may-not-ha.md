---
kind: task
status: open
dateOpened: "2026-09-06"
tags: []
---

# The agent-park branch attests a durable record it may not have written

The agent-park branch in `we:scripts/merge-ai-prs.mjs` sets `durableRecorded = true` unconditionally,
ignoring what `postDrainReasonComment` returned. That function returns `false` BOTH when it deduped (the
record exists) and when `gh` threw (it does not). The clearance-revocation branch thirty lines above reads
`posted` and documents exactly why — *attest by effect, never by having tried*. A thrown comment therefore
leaves the pass asserting a record it never wrote, and suppresses the fallback stamp too.

## Done when

1. **Executable** — a test asserting `durableRecorded` stays `false` when `postDrainReasonComment` throws on
   the agent-park path, and that the fallback skip-stamp therefore still fires. Red before, green after.
2. The park branch reads `posted` exactly as the clearance-revocation branch above it already does.

The sibling branch is not just different — it documents the rule this one breaks, citing #2820 round 4 /
#2857: *attest by effect, never by having tried*. Both branches call the same function with the same
two-meanings-of-false return; only one of them accounts for it.
