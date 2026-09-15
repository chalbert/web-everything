---
kind: decision
status: open
scope: ["we:scripts/conveyor/fix-autofix-gate.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# Auto-fix gate hard denylist is stricter than the ratified merge gate (isStrictDenyPath over-broad)

isStrictDenyPath, the auto-fix gate hard denylist in we:scripts/conveyor/fix-autofix-gate.mjs, calls isGateSelfPath (an alias for isPolicyCorePath in we:scripts/lib/gate-config.mjs) for the whole policy-code tier, plus isBlastRadiusPath more generally. An automated fixer therefore refuses to even attempt drafting a fix for advisory review findings on any file in that tier (about 40 files), or on any PR that only trips the generic blast-radius size or path heuristic.

As verified tonight: we:scripts/conveyor/fix-autofix-gate.mjs currently exists only on the not-yet-merged origin/lane/3635-pin-codex-model-every-call-site lane (commit 9d55b18ef, "Part 3: blacklist-first auto-fix gate for review:human advisory findings"); it is not yet on main. Re-confirm the file location at prepare time, once that lane lands.

Why this is provably over-broad, not just conservative: this repo already ratified a split of the policy-code tier into two halves (#2771/#2785/#2840, codified at we:docs/agent/platform-decisions.md#review-human-declarative-leash-only). A narrow declarative leash of about nine files (we:scripts/lib/review-policy.contract.json, we:scripts/lib/gate-config.mjs, we:scripts/lib/__tests__/gate-invariants.test.mjs, we:scripts/lib/__tests__/review-policy.conformance.test.mjs, we:scripts/lib/review-runner-core.mjs, we:scripts/review-runner.mjs, we:scripts/check-standards.contract.json, we:scripts/lib/__tests__/check-standards.conformance.test.mjs, we:scripts/lib/review-independence.mjs) is the encoded policy itself; #2840 established there is no behaviour-preserving edit to these files, so they must always force review:human on merge. Everything else in the tier, derivation code such as we:scripts/lib/review-escalation.mjs, we:scripts/lib/review-core.mjs, we:scripts/lib/review-policy.mjs, we:scripts/lib/disposition-land-seam.mjs and we:scripts/lib/auto-land-seam.mjs, is already ratified as agent-committee-clearable, with no human required, ever, for merge. Separately, #2563 already ratified that blast-radius alone is advisory care-level, not a park gate: it does not force human review on its own.

So the auto-fix gate current denylist is stricter than the actual merge gate for the derivation-code subset and for plain blast-radius hits: it refuses to even draft a fix in cases this repo own ratified rules already allow to clear to merge fully automated. Confirmed concretely tonight: GitHub PR #2117 ("WE #xqa9ttq: seat Codex as a real, opt-in third judge on review-pr advisory lens", state OPEN) touches only files under scripts/lib, scripts/operations and skills-src, none of them in the declarative-leash set or even the full policy-core roster. It tripped only the blast-radius or size heuristic, not gate-self at all, yet the auto-fixer refused to attempt any fix on its two real advisory findings.

What is NOT a gap, and should stay as-is: the narrow declarative-leash set of about nine files should remain hard-denied to auto-fix regardless of any later human review. Per #2840 own reasoning, there is no behaviour-preserving edit to those files: any change to them is inherently a policy decision, not a mechanical fix, independent of who reviews the diff afterward.

The real, first-time decision this item should pose (NOT decided in this filing): should isStrictDenyPath in we:scripts/conveyor/fix-autofix-gate.mjs be narrowed to use isPolicySpecPath (the declarative-leash set) instead of isGateSelfPath (the full policy-core tier), and should isBlastRadiusPath be dropped from the hard-deny list entirely, letting it flow through the normal escalation and committee review that already runs on any auto-generated fix, rather than blocking auto-fix attempts outright?

Cite #2771/#2785/#2840 (precedent that the policy-code tier is split and derivation code is agent-clearable), #2563 (precedent that blast-radius is advisory, not a park gate), and #2895/#2946 (precedent that the human-clearance signal is procedural, not cryptographically enforced; relevant context for whether a human reviewing the final PR anyway is a sufficient backstop on its own, since this router only ever fires on PRs already parked for mandatory human review regardless of what the fixer touches).

This item captures the gap, the evidence and the ratified precedents only; it does not resolve the fork. Do not set a preparedDate until a future prepare-decision-item pass researches and authors the fork options.

## Done when

- The fork is ruled: whether `isStrictDenyPath` narrows to `isPolicySpecPath` and whether `isBlastRadiusPath` drops out of the hard-deny list, with the rejected option stated and why.
- The ruling is codified (statute or `we:docs/agent/*.md`) and, if it changes behaviour, followed by a build item against `we:scripts/conveyor/fix-autofix-gate.mjs` to implement it.
- This item is not ratified until a `/prepare-decision-item` pass has researched and authored both fork options with a bold default — do not set `preparedDate` here.
