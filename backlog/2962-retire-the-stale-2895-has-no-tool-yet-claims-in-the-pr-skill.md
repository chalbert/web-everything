---
bornAs: xtbr6ez
kind: task
status: resolved
dateResolved: "2026-08-06"
relatedTo: ["2895"]
dateOpened: "2026-08-06"
graduatedTo: none
scope:
  - we:skills-src/pr/SKILL.md
  - we:agent-memory-src/pr-land-dogfood-mechanics.md
  - we:scripts/lib/review-skill-guard.mjs
tags: [review, gate-self, docs, skill]
---

# Retire the stale "#2895 has no tool yet" claims in the /pr skill, agent memory, and the review-skill guard

Three places still say the gate-self clearance has no tool and route behaviour off that, so an agent running /pr downgrades a genuinely gate-self change to review:pending.

Carved out of the round-1 review of **PR #1056** (#2895's implementation), finding **m4**. The operator scoped
that PR to its own file set, and these three files are outside it — but the claim they carry is now false, and
one of them changes agent behaviour because of it.

## The three sites

1. [`we:skills-src/pr/SKILL.md`](skills-src/pr/SKILL.md), lines ~92–97 — states that `review:human` "has no tool
   yet (#2895, `status: open`)" **and routes the park-label choice off that**. This is the one with teeth: an
   agent running `/pr` on a genuinely gate-self change follows this sentence and parks it `review:pending`
   instead of `review:human`, which is a real weakening of the gate, not just stale prose.
2. [`we:agent-memory-src/pr-land-dogfood-mechanics.md`](agent-memory-src/pr-land-dogfood-mechanics.md), line ~15
   — the same claim, in memory that loads into sessions.
3. [`we:scripts/lib/review-skill-guard.mjs`](scripts/lib/review-skill-guard.mjs), line ~102 — still advertises
   `--to=accepted|changes` in its operator-facing notice, so the third target is invisible where an operator is
   most likely to be reading.

## Done when

- None of the three asserts that the gate-self clearance has no tool, and `/pr`'s park-label choice no longer
  keys off #2895's status.
- The guard's notice lists `clear-human` alongside the other targets.
- No site claims the clearance is something an agent cannot do. #2895 ruled the unforgeable actor signal
  DEFERRED, so what holds the tier is the explicit-instruction rule plus the honesty tax — say that, in the one
  or two lines it takes, and do not paraphrase a guarantee that does not exist. Adding a fourth over-claim is
  the failure this item must not repeat.

## Resolved 2026-08-06 — folded into #2895's own PR (#1056)

The operator originally scoped #1056 to its own file set, which is why these three were carved out. On the fix
pass they were done there instead: leaving them would have shipped #2895's tool while `/pr` still routed
gate-self diffs to `review:pending` on the strength of "#2895 is open" — a live weakening of the gate, not just
stale prose. All three sites now describe `clear-human` as it actually is: it exists, it requires `--actor` and
`--reason`, and nothing in it verifies that a human ran it.
