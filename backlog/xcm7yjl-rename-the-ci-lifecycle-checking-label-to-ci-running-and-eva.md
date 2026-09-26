---
kind: decision
parent: "4075"
status: open
dateOpened: "2026-09-26"
tags: []
---

# Rename the ci-lifecycle checking label to ci:running (and evaluate ci:passed for ready-to-merge)

The operator finds we:scripts/conveyor/review-status-tag.mjs / we:scripts/merge-ai-prs.mjs's ci-lifecycle checking label vague -- proposes a consistent family: ci:running / ci:failed / ci:passed for the CI axis, review-status:* stays as-is for the review/fix/ci-heal axis. The #2281-ratified statute (we:docs/agent/platform-decisions.md, Fork 2) ALREADY blesses checking -> ci:running as an explicit option ("ci:failed ... opens a ci:* state family (checking may namespace as ci:running)") -- that half needs no new ruling, only a migration (rename the constant + every reader: we:scripts/merge-ai-prs.mjs CI_LIFECYCLE_LABELS/CI_LIFECYCLE_LABEL_META, the drain's own gh label create mint loop, any Plateau/status-tag reader of the literal string, then relabel every open PR currently carrying checking to ci:running so no PR goes unlabelled mid-migration). Renaming ready-to-merge -> ci:passed is DIFFERENT: the SAME ratified Fork 2 text explicitly keeps ready-to-merge and its bare sibling blocked UN-namespaced as deliberate precedent ("the lifecycle family's precedent is no namespace"), and ready-to-merge is read directly by the drain's own --label=ready-to-merge collection query (we:scripts/merge-ai-prs.mjs, we:scripts/lane-drain.mjs) plus the review gate and Plateau -- renaming it would contradict the existing ruling and touch the landing-gate contract, not just a display label. Fork for the ruling: (a) rename checking->ci:running only, leave ready-to-merge bare as ratified; (b) rename checking->ci:running AND file a SEPARATE amendment to also rename ready-to-merge->ci:passed (bigger blast radius, more readers, needs its own migration plan); (c) leave checking as-is (name is already inside the ratified family, just not the namespaced spelling). No code changed by this card -- it is the ruling + migration plan only.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
