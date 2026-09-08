---
bornAs: x27e4xs
kind: story
size: 3
status: resolved
blockedBy: ["3145"]
relatedTo: ["3028", "3050", "3057"]
dateOpened: "2026-08-17"
dateStarted: "2026-09-08"
dateResolved: "2026-09-08"
scope:
  - we:scripts/lib/judge-panel.mjs
  - we:scripts/lib/review-core.mjs
tags: [delivery, review, independence]
---

# Tool-free panel jurors cannot run the mutation probe their mandate demands

[#3145] moved the drain's panel reviewers and [#2439] validator jury off the `Agent` tool and onto
`judgePanel` (`we:scripts/lib/judge-panel.mjs`), which buys pairwise-distinct juror actors. It costs
something real, and this card is that cost written down rather than absorbed.

**`judgePanel` has no `allowedTools`.** `judgeSpawn` (`we:scripts/lib/judge-spawn.mjs`) does — a tool-bearing
juror is admitted when it is given a lane clone that is not the driver's own — but the panel layer never
forwards it, so **every** panel juror is `--tools ''`.

**The mandate asks a tool-free juror to do two things it cannot.** `buildMandate`'s body tells a reviewer
that if it must run the code it may do so in a throwaway `git clone`; `MUTATION_PROBE_RULE` tells it to
BREAK the line it says is wrong and report whether a NAMED test reddens. Neither is possible with no tools.
`we:scripts/lib/judge-spawn.mjs`'s own header is explicit that this is the trade: *"Nine PR reviews run by
hand … found
what they found BECAUSE they could act … A juror that can only read a diff finds none of those. The tools
ARE the finding mechanism."*

It fails in the safe direction — `MUTATION_PROBE_RULE` already says an assertion with no mutation result
behind it is *weaker*, not invalid, and `we:skills-src/jury/panel-fanout.mjs` tells each juror plainly that
it has no tools and
must not claim to have opened anything. So a juror reports honestly rather than fabricating. But the panel
that lands PRs is now strictly weaker at exactly the class of finding the probe exists to catch.

## Done when

1. A ruling is recorded on whether a panel seat may be tool-bearing at all: either `judgePanel` forwards
   `allowedTools` + a per-seat lane `cwd` (N seats needing N lanes is the cost to price), or the repo states
   that panel jurors are tool-free by design and the probe belongs elsewhere.
2. If panel seats stay tool-free, `buildMandate`/`MUTATION_PROBE_RULE` no longer instruct a juror to do
   something its transport forbids — the clause is conditioned on the transport rather than always emitted.
3. Whatever is ruled, the drain's auto-review documents which finding classes its panel can and cannot
   reach, so nobody reads a tool-free `accept` as a tool-backed one.
4. `npm run check:standards` — 0 new errors.

## Progress

- Read #3145 (blocker, resolved 2026-08-17) and the current we:scripts/lib/judge-panel.mjs /
  we:scripts/lib/judge-spawn.mjs / we:scripts/lib/review-core.mjs source: confirmed every real caller of
  buildPanelMandate/buildValidatorMandate today (the drain panel, the converge loop, the jury shim on a PR
  diff, the review-pr operation) runs through the panel/spawn judge machinery, which always spawns with no
  tools granted — no forwarding path exists anywhere in the repo.
- **Ruling (Done-when #1): panel jurors stay tool-free by design.** we:scripts/lib/judge-panel.mjs's own
  depth-refusal reasoning already treats the unconditional no-tools spawn as what makes juror-spawns-juror
  recursion structurally impossible; we:scripts/lib/judge-spawn.mjs's header names the identical trade as
  deliberate (#3035). Recorded in a #3158 RULING doc block in both files.
- **Done-when #2**: added toolsAvailable (default false) to buildMandate/buildPanelMandate/
  buildValidatorMandate. Default output now carries a plain no-tools disclosure instead of the throwaway-clone
  allowance, and a new MUTATION_PROBE_RULE_TOOL_FREE (reason from the diff and its tests, never claim to have
  run anything) instead of MUTATION_PROBE_RULE. toolsAvailable: true restores the original text byte for byte,
  for a future tool-bearing seat.
- **Done-when #3**: the capability boundary (what a tool-free panel can/cannot reach) is documented in both
  we:scripts/lib/review-core.mjs (beside MUTATION_PROBE_RULE_TOOL_FREE) and we:scripts/lib/judge-panel.mjs
  (beside REFUSAL 1's depth reasoning), so a tool-free accept is never read as a tool-backed one.
- Updated we:scripts/lib/__tests__/review-core.test.mjs: the pre-#3094 golden fixture is now asserted twice
  (tool-bearing byte-identical to the original fixture; tool-free with the execution clause and probe variant
  swapped, nothing else), and the unconditional describe block is re-asserted per-transport.
- Done-when #4 (the repo health gate, 0 new errors): queued through the standard request/poll seam, not run
  directly (per this brief).
- Ran the real converge loop (elevated care, 5-lens panel + red-team, both via judgePanel, never the Agent
  tool) against the lane diff. Round 1 landed: a non-author panel accepted and an independent red-team failed
  to break it. Carve-out findings surfaced two real gaps this ruling had missed on the first pass, both fixed
  before opening the PR even though the reducer scored them non-blocking:
  - GUARANTEE_NEEDS_A_TEST_RULE was still unconditionally telling a tool-free juror to BREAK a guarded line —
    the same defect class as MUTATION_PROBE_RULE, just missed on the first pass. Added
    GUARANTEE_NEEDS_A_TEST_RULE_TOOL_FREE and wired it through the same toolsAvailable condition.
  - buildValidatorMandate's toolsAvailable passthrough had no dedicated test; added one.
  - Softened the RULING comments' "no forwarding path exists anywhere in the repo" / "unconditionally, today"
    phrasing to be explicit that it is a fact checked by reading source at authoring time, not an invariant a
    test or lint rule in this diff enforces.
