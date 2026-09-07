---
bornAs: x27e4xs
kind: story
size: 3
status: resolved
blockedBy: ["3145"]
relatedTo: ["3028", "3050", "3057"]
dateOpened: "2026-08-17"
dateStarted: "2026-09-07"
dateResolved: "2026-09-07"
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
- **Ruling recorded (1):** panel seats stay **tool-free by design**, permanently — not the "forward
  `allowedTools` + a per-seat lane" branch. Documented in `we:scripts/lib/judge-panel.mjs`'s header, backed by
  the operator's own #3313 ratification (*"judgePanel's tool-free jurors are a cost for a deep reviewer and
  the specification for a diff-only one"*). Priced honestly: a mutation probe EDITS the file it checks, so N
  tool-bearing seats would each need their own lane (two seats sharing one `cwd` would race each other's
  edits) — a cost `judgePanel` declines to provision. The existing alternative for a genuinely tool-bearing
  lens is `we:scripts/operations/review-pr.mjs`'s two sequential `judgeSpawn`-direct calls (own `allowedTools`,
  own lane each), now documented as the ratified pattern rather than a workaround for this open item.
  `judgePanel` also gained a fifth REFUSAL (`assertPanelToolFree`): a seat or panel-wide option that declares
  `allowedTools` is refused loud, before anything spawns, instead of the field being silently dropped.
- **Transport-conditioned mandate (2):** `buildMandate` / `buildPanelMandate` / `buildValidatorMandate`
  (`we:scripts/lib/review-core.mjs`) take an explicit `toolsAvailable` param (default `true` — byte-for-byte
  unchanged for every existing caller, all of which are tool-bearing today). `toolsAvailable: false` drops the
  throwaway-clone offer and swaps `MUTATION_PROBE_RULE` for a new `MUTATION_PROBE_RULE_TOOL_FREE`, which tells
  the juror plainly it has no tools, forbids it from claiming a mutation attempt it didn't make, and states
  that a finding with no mutation result behind it is weaker, not invalid (echoing the card's own framing).
- **Finding-class documentation (3):** recorded in `we:scripts/lib/judge-panel.mjs`'s header — a tool-free
  panel seat reaches anything legible from the diff text alone (logic errors, missing/weakened coverage
  visible in the diff, an unhandled case, a scope mismatch) but not a claim only firing the code disproves (a
  flag bypass, a guard hole reproduced against a real checkout, a decorative test proven decorative by
  mutation) — so a panel `accept` is a diff-only floor, never a tool-backed one, and the juror itself now says
  so via `MUTATION_PROBE_RULE_TOOL_FREE`.
- **Not done here, scaffolded instead:** wiring `toolsAvailable: false` into the actual `judgePanel`-fed
  callers (`we:scripts/converge-cli.mjs`, `we:scripts/review-core-cli.mjs`) is real follow-up work outside this
  card's declared scope (2 files) — filed as `#xh6xnhd` (blockedBy this item).
- **Gate (4):** unit tests added/passing in `we:scripts/lib/__tests__/judge-panel.test.mjs` (REFUSAL 5) and
  `we:scripts/lib/__tests__/review-core.test.mjs` (`toolsAvailable` for all three mandate builders);
  `npm run check:standards` requested via the standard verify-lane flow.
- **Converged (`/converge`, care=elevated):** panel accept (unanimous, 5 lenses) + independent red-team
  ratified (0/5 lenses broke it) → `land`. Two real rounds of adversarial review caught, and this build fixed
  for real, TWO further instances of the exact bug class this card names: `GUARANTEE_NEEDS_A_TEST_RULE` (the
  same "break the line, check a NAMED test" demand as `MUTATION_PROBE_RULE`, scoped to prose guarantees) and
  `buildValidatorMandate`'s own inline ANTI-TEST-GAMING clause — both now conditioned on `toolsAvailable` the
  same way, with `GUARANTEE_NEEDS_A_TEST_RULE_TOOL_FREE` added alongside `MUTATION_PROBE_RULE_TOOL_FREE`. Also
  fixed: two citation-accuracy nits in `we:scripts/lib/judge-panel.mjs`'s header (tightened to verbatim,
  line-anchored quotes) and a vacuous test assertion (denylisted a phrase unreachable from the function under
  test — fixed to assert the actual constant instead) — all caught by the review process itself. Remaining
  findings (6, all `cosmetic`/`degraded` impact, none `worseThanBase`) are disclosed carve-outs: repeating the
  "not wired into real callers" gap already captured by `#xh6xnhd`, a DRY/duplication observation on the three
  `_TOOL_FREE` constants (accepted as a deliberate, size-appropriate tradeoff — a future 4th instance would be
  the trigger to extract a shared template), and a style note on this session's own verbose test comments.
