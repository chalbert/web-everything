---
kind: epic
size: 13
status: open
dateOpened: "2026-07-10"
relatedReport: reports/2026-07-10-ai-code-review-best-practices.md
relatedTo: ["2285", "2398"]
tags: [drain, review, convergence, subagents]
---

# Unified drain convergence loop — peer co-negotiation + independent hardened validator (option B)

Successor to epic #2285. Extend the shipped editor↔reviewer loop (#2311/#2310) into one convergence loop: two peer agents agree on approach BEFORE writing code, then implement, and a DISTINCT fresh validator (adversarial, rubric-anchored, fresh-context — ideally a diverse panel/different model, never shown the peers' self-assessment) accepts the final diff. Land only when the full bar holds — approach agreed · validator accept · check:standards green · required test green · NO test-tampering (coverage not dropped, no tests removed/skipped, logic fixes carry a test that fails on pre-change behavior). CI-green folds in as a deterministic clause of the bar (the retired red-CI residue), not a separate path. Preserves the non-author-accepts invariant; the whole invariant rests on the third validator's independence, so hardening it is load-bearing. Ratified in #2398 (option B), grounded by we:reports/2026-07-10-ai-code-review-best-practices.md. Ship behind an off-by-default flag, scoped to small/non-security diffs first, graduating per-repo on a clean track record.

## Why (the ratified decision)

#2398 asked whether the drain should converge review/fix in-process vs. bounce `review:changes` to the author.
That fork is settled (the editor↔reviewer loop shipped under #2285). The merit review + a survey of AI-code-review
best practice (we:reports/2026-07-10-ai-code-review-best-practices.md) reframed it into **one** convergence loop
with a single completion bar, choosing **option B** — two peers co-negotiate, a distinct fresh agent validates —
over **A** (fresh reviewer every round). B reaches approach-agreement faster while keeping the non-author-accepts
invariant, *provided the third validator is genuinely independent and the CI gate is protected from gaming*.

## Slices (to cut when picked up)

1. **Approach handshake** — the two peer agents agree on the fix approach *before* any code is written (a plan
   phase ahead of the diff), so rounds aren't burned on wrong-target fixes.
2. **Independent hardened validator** — a distinct, fresh-context validator judges the final diff: adversarial
   "find the reason to reject" persona, rubric-anchored verdict, given diff+tests+rubric only (never the peers'
   self-assessment). Stronger form: a small diverse **panel/jury** (different model/provider) to dilute
   self-preference/position/verbosity bias. This is where the whole invariant lives. The validator's accept is
   persisted as a deterministic acceptance label (e.g. `redteam:accepted`, per #2281's total label function) so
   the merge gate can *require* it — the enforcement (no land on a high-value surface without that label, and no
   merge-anyway timeout escape around it) is owned by the gate-integrity story, not this slice.
3. **Anti-test-gaming gates on the CI-green clause** — tests read-only to the author peers (or diff-gate any test
   change); fail the land if coverage drops or tests are removed/skipped; require a test that fails on pre-change
   behavior for logic fixes; validator explicitly inspects for test tampering.
4. **CI-green land clause + off-by-default flag** — fold "required `test` green" into `deriveNegotiationOutcome`'s
   land condition (retire the separate `lane-resume` `test-red` strand); wire the whole loop behind an
   off-by-default flag, scoped to small/non-security diffs first.

**Invariant preserved throughout:** a landed PR is accepted by an agent that did not author the fix. The editor
writes in an isolated throwaway clone and pushes to the same PR branch (#2336); CI re-runs on GitHub, not in the
drain's serial-writer tree. Round cap + escalate-to-`review:human` on non-convergence, unchanged.
