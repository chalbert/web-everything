---
name: feedback-prepared-means-dor-not-ratified-directly
description: "preparedDate = forks at Definition of Ready (resolved / prepared / delegated-to-a-prepared-child), NOT \"ratified directly\"; a parent whose only open fork is carved out to a prepared child is itself prepared"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 307a076a-9cd4-4bbb-92cb-39838b5b963b
---

`preparedDate` means **the research + authoring is done and every fork is at the Definition of
Ready** — it does NOT mean "this item gets ratified directly." A fork reaches DoR three ways:
**resolved**, stated in the **prepared-fork shape**, or **delegated** to a child item that is
itself prepared. So a **parent/epic decision whose only open fork was spun out to a child is
prepared once that child reaches prepared shape** — stamp the parent `preparedDate` and rewrite
the carved-out fork from "Open decisions" to "→ delegated to #NNN (prepared)" so the flag is
truthful. Don't leave it tagged `○ needs prep` just because the call happens on the child.

**Why:** I wrongly told the user #382 "can't be prepared" because I read prepared as
"ratified-directly"; the user's definition (correct) is "in the right shape, research done."

**How to apply:** in `/prepare`, when an item's only open fork is delegated to a prepared child,
stamp the parent prepared rather than skipping it. Codified in
[docs/agent/backlog-workflow.md](backlog-workflow.md) prepared-fork section (worked example
#382 → #394). Relates to [[feedback_support_all_coherent_fork_existence_test]] and
[[feedback_authoring_standard_workflow]].

**A `preparedDate` stamp exempts NOTHING — re-verify forks at claim, don't trust the stamp
(2026-06-17, #803).** The stamp asserts each fork passed DoR, but DoR *includes* the
fork-existence + fork-is-not-prioritization test. A prep pass can false-stamp by filling the
N-fork template without running that test first (the doc literally says "run the fork-existence
test first and let it shrink the item"). #803 shipped prepared with three "forks"; the claim-time
re-run collapsed all three (two forced invariants — a broken branch each; one
prioritization-in-fork's-clothing — "premature / no second consumer / sequencing not exclusion")
to a single #088-shape ruling. I presented the forks at face value and only ran the checklist
after the user pushed *twice* — prep and my claim-time pass shared one blind spot (exactly what
the separate-skeptic escalation exists to break). **Treat a prepared decision's forks as claims to
re-verify, not settled; collapse any false fork BEFORE presenting.** Deterministic backstop now
exists: **`check:health` G4 false-prepared-fork** scans `## Fork` sections of prepared decisions
for prioritization tells and flags them (caught #775 too). Relates to
[[feedback_fork_not_a_prioritization_tool]] and [[feedback_verify_grounding_claims_before_ratifying]].

**A bare "go" on a prepared decision item means PRESENT for ratification, never auto-resolve
(2026-06-17, #855).** I claimed #855 (prepared, default A2), the user said "go", and I ratified +
`resolve`d it in one turn without ever presenting the call. The user pushed back ("you resolved
without my ratification, how is that possible?"). Decision-mode is *present the call → discuss →
user ratifies → resolve* (per next-backlog-item step 0b / planning-as-discussion). "go" = begin the
work, and for a decision item the work is the *discussion*, not the close-out. Never collapse
present + ratify into one turn. (And the prepared default did NOT survive contact — the user's
"WE = contracts/protocols only" push dissolved the A1/A2 framing entirely; see
[[project_generator_is_tool_not_we_standard]].)
