---
name: verify-ratified-citation-against-live-status
description: "A backlog item's \"per ratified"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5f47eed9-6fa1-4b7d-9f5b-df5e54106dfc
---

An item body that says *"per ratified #NNNN"* / *"#NNNN ratified that …"* is a **prose claim, not a fact** — the cited item may still be `status: active` (a decision being prepared, not yet ruled). Before building on such a premise, **open #NNNN and check its `status`/`kind`**; if it's `active`/`open`, the premise isn't ratified and the work is on contested ground.

Worked example (batch 2026-07-01): #2027 shipped *"per ratified #1964"* and targeted a `we-data-table` `rows` binding + enhancer swap — but **#1964 (and the #2007 governance it turns on) were both `active`**, i.e. the exact feed-identity direction was still undecided. The sibling #2008 even said the direction *"does not pre-judge — the #2007 ruling decides."* Correct move: don't claim it; encode the real dependency as a `blockedBy` edge (the buried-dep-as-blockedBy skill rule) so the selector stops surfacing it as agent-ready. (#1964 then ratified later that same day and #2027 was re-authored to the ruled outcome — the edge was right *at the time*.)

**Why:** the readiness ranker trusts frontmatter (`blockedBy`, tier), not prose — a false "ratified" citation makes an item look agent-ready when its premise is still a live fork. Same family as [[naming-fork-precedent-discipline]] (an audit listing a keyword ≠ a ratified shape) and the [[index-verif]] "verify real state, don't trust the label" discipline, but the sharp, recurring axis here is **the ratification-status of a cited item**. **How to apply:** during batch/next pre-flight, treat every "per ratified #NNNN" as a status check; if the citation is false, file/encode the `blockedBy` edge rather than claiming — never build on a prose-asserted ratification you didn't verify.
