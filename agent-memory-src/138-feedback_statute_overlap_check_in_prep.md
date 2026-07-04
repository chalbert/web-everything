---
name: feedback_statute_overlap_check_in_prep
description: "a codifying decision's statute-conflict check belongs in PREP; ratified=immutable, late finding→new item;"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7956a599-a784-4f7e-9fe2-2f2f20374330
---

A `kind: decision` that will set `codifiedIn` must have its **statute-overlap check** run during
`/prepare` (folded into the pass-4 skeptic), NOT at resolve. Draft the rule-to-codify, grep
`platform-decisions.md` for anchors on the same turf, reconcile any overlap in the item BEFORE
`preparedDate`. The merit-skeptic (is the default wrong?) is a different axis from statute-overlap
(does the codified rule collide with an existing anchor by a different test?) — prep historically ran
only the first.

**Why:** the human's ratification time is the scarce resource; prep's whole job is to make ratification
cheap. A statute conflict discovered at *resolve* arrives AFTER the human ratified — too late to act on
without breaking the next rule. In #1886, a prepared card codifying "card root = intrinsic-vs-extrinsic"
reached ratification before anyone noticed [[reference_repo_constellation]]'s statute file already judged
author-set `as=` by an a11y-contract test (#1832 `composition-preserves-a11y-contract`). The user: making
them spend a ratify turn on a story that might conflict is "totally unacceptable."

**Ratified = immutable.** Once the ratification utterance lands, never reshape the decided forks. Codify
faithfully; route any late finding to a NEW reconciliation item (`blockedBy`/`parent` the original),
never a retro-edit. A statute *cross-reference* added when codifying (lineage) is fine; *changing the
ruling's framing/discriminator* post-ratification is forbidden. Relates to [[feedback_skeptic_finding_is_a_hypothesis]]
(verify a skeptic hit vs data first) and [[feedback_red_team_discussion_born_flips]].

**How to apply:** prepping a codifying decision → run the statute-overlap grep + skeptic axis, reconcile
in-item pre-stamp. At resolve → red-team is confirmation only; if it finds a conflict, the prep was
under-done — codify as ruled, file a follow-up, don't amend. Edits landed in
`docs/agent/backlog-workflow.md` (Red-team the default → Statute-overlap check; ratification gate →
immutable clause) + `prepare-decision-item` skill pass 4.
