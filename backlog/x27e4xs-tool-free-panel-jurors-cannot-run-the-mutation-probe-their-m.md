---
kind: story
size: 3
status: open
blockedBy: ["3145"]
relatedTo: ["3028", "3050", "3057"]
dateOpened: "2026-08-17"
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
