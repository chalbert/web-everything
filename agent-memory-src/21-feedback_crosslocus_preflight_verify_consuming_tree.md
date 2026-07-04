---
name: feedback_crosslocus_preflight_verify_consuming_tree
description: "a cross-locus migration's \"flat/no fork\" claim must be verified in the CONSUMING repo's real tree before claiming — the fork lives downstream where the frontmatter can't reach"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7606bdf3-284b-4aad-ba82-df76a96410bd
---

A cross-locus item (WE story whose impl lands in FUI/plateau) labelled "flat application / no fork" by its
author can still hide a real design fork — and the frontmatter pre-flight **cannot see it**, because the
fork lives in the *consuming* repo's tree. Before claiming such an item, read the real downstream tree
(`fui:embed/`, `fui:workbench/`, `fui:blocks/<x>/`), not just the WE card.

**Why:** in batch-2026-06-22-1615-1208 all three badge/workbench migration items read as flat 3–5-pointers
in WE frontmatter, but reading the FUI tree surfaced forks every time: #1598/#1208 (no `fui:embed/badge-in-document.ts`;
FUI's 5-tone `we-badge` has no equivalent for the bespoke backlog palette/link-pills → filed #1621) and
#1618 (the 9 declarative author-mode cases have no `WorkbenchBlock`; the workbench has never instantiated a
declarative `<component>` → a workbench-hosting design call). The author's "no fork" was optimistic because
they hadn't traced the consuming side. By contrast the wave-3 trio (#1615/#1616/#1617) was genuinely flat —
because the FUI pattern (`DeckElement`/`StepperElement`) already shipped and was verified.

**How to apply:** during batch pre-flight, treat a cross-locus migration's "flat/no fork" framing as a
*hypothesis*, not a fact. `grep`/read the consuming repo for (a) the prerequisite mechanism the migration
assumes exists (an embed module, a registry hook, a runtime), and (b) whether the source vocabulary actually
maps onto the target component's surface. Zero callers / missing module / unmapped vocabulary flips it to a
fork → file a `kind: decision`, repoint `blockedBy`, release unbuilt; don't quietly make the design call to
force batchability. Extends [[feedback_prep_verify_mechanism_has_consumer]] (grep the consumer graph) and
[[feedback_test_before_asserting_cause]] (run the real probe) to the cross-locus pre-flight case; see also
[[feedback_misflagged_batchable_fix_real_state]] and [[feedback_decision_concrete_code_refs]].
