---
name: stop-hardening-an-unachievable-guarantee
description: When a converge loop keeps finding the same finding-CLASS one layer down each round, the mechanism cannot deliver the claimed guarantee — narrow the claim instead of hardening the mechanism.
metadata:
  type: feedback
---

A bounded editor↔reviewer convergence is meant to terminate. After each round, classify the NEW findings.
New classes → keep going. **Same class, new variable → stop.** That recurrence is the signal that the
guarantee the code CLAIMS is not achievable by this mechanism at all; keep hardening and the loop never
converges, because each fix just moves the same overclaim one layer down.

**Why:** On PR #1056 / #2895 (the `review:human` gate-self clearance tool), the claim was that a terminal
check stops an AI agent from clearing its own PR. Round 1 found the tty gate overstated. Round 2 found the
same overclaim one layer down — `allowClearHuman` was an ordinary parameter of an exported function, and the
attribution named a free-text `--actor`. A third round would have found the next layer. Independently,
#2895 was RULED the same way: the unforgeable actor signal is **deferred**, because "there is no local
construct that is unforgeable against an agent with shell access on the same machine" — and it shipped the
narrowed version (an honesty tax: `--actor` + a stated reason required) instead. The loop was paying review
rounds to chase a guarantee that did not exist.

**How to apply:** Classify each round's findings by CLASS, not count. On a repeat class, stop the loop and
ask what claim is generating them, then propose narrowing the claim to the operator rather than opening
another fix round. The honest end state is often "this is a speed bump, and the code says so" plus a filed
item for the real answer. Note which findings are only defects *relative to the overclaim* — those go moot
when the claim narrows — and which are plain bugs that survive any framing; fix the latter regardless.

Distinct from [[record-verdict-before-launching-converge]], which is the procedural ordering rule for the
same loop (post the `changes` verdict BEFORE launching it), not a stopping criterion. Related:
[[review-parked-pr-diff-against-current-main]].
