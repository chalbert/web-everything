---
bornAs: xf70ecs
kind: story
size: 3
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Run resolveListedChecks after filterOpenPrsByLabel and filterOpenPrsByBase, and add a test that an unla… (from chalbert/web-everything#3604 review)

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3604's review (reviewed head `f715b33d8e6942f693c8924657da8e08d02b01cb`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/merge-ai-prs.mjs:4264` — Run resolveListedChecks after filterOpenPrsByLabel and filterOpenPrsByBase, and add a test that an unlabeled PR with no `test` check triggers no `gh api` call.
2. `we:scripts/merge-ai-prs.mjs:3850` — Add a test of `fetchFreshPrForRevalidation` (or a non-dry-run CLI harness with a fake `gh`) asserting that a capped fresh rollup with a stale green and a newer REST failure yields `skip`.
3. `we:scripts/merge-ai-prs.mjs:4264` — Move resolution after `filterOpenPrsByLabel`/`filterOpenPrsByBase`, or gate it on the `ready-to-merge` label. Add a test that an unlabeled PR with no `test` row triggers zero `gh api` calls.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
