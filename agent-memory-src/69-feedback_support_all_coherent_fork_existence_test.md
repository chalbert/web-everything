---
name: feedback_support_all_coherent_fork_existence_test
description: "A fork is a real decision only if a branch is actually flawed; support all coherent options, mandate nothing; keep the decision crisp and separated from context"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f122dd5e-b35c-41eb-b32a-36ebe5618026
---

When framing or presenting a decision, run a **fork-existence test first**: WE supports *any coherent way
of building* and is **not in the business of mandating**. So a "fork" is only a real decision in two cases —
(a) a **forced invariant** (exactly one branch is correct, the alternative is *flawed / won't work*) →
that's a **ratify**, not a weigh; or (b) a **genuine either/or** (both branches coherent but can't coexist).
If the branches can coexist, they are **not a decision** — record them as "supported by default" and move
on. If you can't name a *broken* branch, there's no decision: support all of them.

Second half of the feedback — **keep the decision crisp and separated from context.** A prepared item that
lists five "forks" where four are really "support all of these" is *verbose, not thorough* — it buries the
actual call. Lead with the decision (forced invariants as one-line ratifies; only genuine either/ors as
`## Fork N`); demote framing tables / sequencing / relationship notes below a `## Context` divider. The
glance table + Fork sections should contain **only** what the human actually decides.

**Why:** the user (sole architect) decides fast when the screen shows exactly what they're choosing.
Presenting non-decisions as decisions wastes their judgment and reads as mandating.

**Flawed *for whom?* — the subtlest fork-existence trap.** When a card's fork-existence justification calls
a branch "flawed," interrogate **flawed relative to *whose* goal**. A branch flawed only against a posture
the project *optionally* adopts is **not** a forced exclusion — it's a legitimate end-state for projects not
holding that goal, i.e. a **project-selectable dimension** ([[feedback_dimension_vs_fixed_mechanic]]). The
"flaw" being real for the *recommended* posture doesn't make the branch globally broken. A *prepared,
skeptic-passed* card can still be over-pinned this way (the skeptic flips the default but leaves the
end-state forced). When it dissolves to a dimension, WE itself sets **no** default — the value lives in a
project config extending a platform-default flavor ([[feedback_config_extends_platform_default]]); a flavor
may *recommend* a value, WE never *mandates* it.

**How to apply:** sharpens [[feedback_most_flexible_default]] (most-permissive default) into a test of
whether a fork exists at all. Codified in `docs/agent/backlog-workflow.md` (per-fork classification pass →
the "Standing test before any of the above" paragraph + the prepared-fork-shape "Lead with the decision;
quarantine the context" bullet). Worked examples: #088 (served-module versioning) collapsed from five
bold-default forks to **one forced invariant (cache identity = hash of all byte-determining inputs) + one
genuine A/B (advertise-only vs optional validator)**, matrix/sequencing demoted to `## Context`. #798
(code-from-requirement SoT) — a prepared card pinned (a) requirement-only as the *forced* end-state and
excluded (b) AI-proposes as a mere "drift-prone" bootstrap; "flawed for whom?" showed drift is a defect
only against the project's *optional* #099 evergreen goal, so it dissolved to a **project-selectable
dimension** under config-extends-platform-default (WE default-less). Relates to
[[feedback_dimension_vs_fixed_mechanic]] and [[feedback_decision_mode_engage_real_fork]].
