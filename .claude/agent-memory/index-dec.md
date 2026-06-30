---
name: index-dec
description: "Making and ratifying design decisions and forks: fork-existence test, never decide unprepared, prepared=DoR, go vs ratified (2nd go), wait for explicit ratification, decision-mode engages the real fork, confidence on recommendations, concrete code refs before deciding, contrast examples, residual cards, reversibility, judge on pure merit, statute-overlap check at prep, decisions are work-items not plan-mode. Recall when running a decision, evaluating a fork, or preparing/ratifying a design call."
metadata: 
  node_type: memory
  type: reference
  originSessionId: eb2b0a8e-8136-44bb-a1e9-d9e03bb0c5d3
---

Decisions & Forks cluster — open a leaf with `node scripts/memory-resolve.mjs <N>` (or `--cat`):

- 10. Skeptic Finding Is A Hypothesis — a refutation is a CLAIM to test vs data before reshaping a ruling; #1505
- 15. Judge On Pure Merit, Never Demand — "useful to a dev anywhere?"=go; never gate on demand; #1631
- 18. Decouple Build From Release Timing — build now, release later; recurring cost=solo-dev risk; #1590
- 25. Platform Decisions = Statute Layer — platform-decisions.md = cite-able cluster rules; codifiedIn on resolve; #911
- 36. Ratified Decisions Are Reversible — push back FIRST (cite #NNN); reverse freely when warranted; lineage
- 38. Composability Probe + Strip-Effort — prove "cannot coexist" by FAILING to build B as facade over A's kernel; #756
- 39. Never Take An Unprepared Decision — never rule w/o preparedDate; screen→/prepare or pick a prepared item; #1457
- 40. Decision "go" Is Not The Whole Arc — a pick/go = claim+present trigger only; ratify on a 2nd go; #1160
- 41. Wait For Explicit Ratification — a mid-discussion principle is INPUT not the call; hold PENDING until "ratify"
- 42. State Confidence On Recommendations — confidence on every rec + EACH fork sub-call + 1-line residual; #811
- 54. Decisions Are Work Items, Not Plan Mode — design forks→a type:decision item; never plan mode/ExitPlanMode
- 67. Decision-Mode: Engage the Real Fork — don't pre-settle sub-calls; surface the tension + take a stance
- 68. Red-Team Discussion-Born Flips — a mid-discussion flip clears the SAME merit gate; mechanism-vs-UX check; #1407
- 69. Support All Coherent; Fork-Existence — real fork only if a branch is flawed; else support all; #088/#798
- 70. Fork Is Not A Prioritization Tool — fork decides BEST on merit; cost/effort isn't a branch; file build apart
- 71. Decision: Concrete Code Refs — cite file:line from the real tree before a decision; authored snippets never substitute
- 72. Examples Go In The Story — examples requested on a decision→update the item, not chat-only; #1621
- 110. Prepared = DoR, Not Ratified — preparedDate=forks at DoR; exempts NOTHING; re-run fork-existence at CLAIM; #803
- 130. Rule Residual Now If Default Is Worse — deferred residual=silently taking build default; rule now if wrong; #1427
- 131. Collect Decision Residual As A Card — live residual→PARKED card (reason+trigger+lineage); #1406
- 132. Separate Canonicity From Content-Freeze — split held-til-release: ratify structure now, hold content; #569
- 133. Decision Card States The Human Action — needs crisp "What you decide" + un-park trigger; #1590
- 136. Contrast Example Demos The Fork — a decision's rejected example must trip the ACTUAL fork test; name the attr; #1795
- 138. Statute-Overlap Check In Prep — codifying decision: grep platform-decisions at PREP; ratified=immutable, late finding→new item; #1886
- 139. Fork-vs-Config Classification Gate — classify KIND before framing a fork; config-dimension & contract-derived = dispositive non-forks; skeptic attacks the kind first; [fork-vs-config-classification-gate.md](fork-vs-config-classification-gate.md) #1892
- 140. Red-Team Each Decision Update — attack every discussion-born flip/reframe at write-time, not once at the end; banked reframes let a terminal skeptic reverse the whole session; #1437 one level out; [red-team-each-decision-update.md](red-team-each-decision-update.md) #1892
- 141. Plug Decision = Contract, Not Impl — ratify the WE contract (a web-platform proposal); impl mechanism (patch/out-of-band/residue/polyfill shape) is FUI-local, secondary, swappable (another lib could supply it); never elevate a mechanism question to a WE ratification; [plug-decision-ratifies-contract-not-impl.md](plug-decision-ratifies-contract-not-impl.md) #1892
- 142. Decision Default Mirrors The Story — voice the item's bold default, never a chat-formed stance; prepare+decider can't legitimately diverge — divergence ⇒ a choice left un-prepared (a prose "open residue/TBD" outside a Fork N); scan whole body at prep, re-prepare stale prep before first read; gate warns on resolved/prepared decision w/ deferral prose; [decision-default-mirrors-story-no-divergence.md](decision-default-mirrors-story-no-divergence.md) #1935
