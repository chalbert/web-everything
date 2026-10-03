---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/lib/__tests__/review-core.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "12a417eac5991fae383f5a80697bbb2880d52f54"
tags: []
---

# Prevention — Add a card-authoring check that every field a Done-when names is traceable to a fetched source, for exa… (from chalbert/web-everything#3226 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. The review of what is now `we:backlog/4687-pin-why-conflicting-pr-reads-queued-in-classifypr.md` requested a card-authoring check that every field named by Done-when criteria is traceable to a fetched source, for example by checking the actual PR query field list. The original request explicitly permits a review-lens fallback.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3226@9be15107d23e44229152ac35a852a2d84e4486a8

## Done when

1. **Executable — Musts 1–3:** the focused hunt-brief regression in `we:scripts/lib/__tests__/review-core.test.mjs` fails before the change and passes afterward, proving the generated claim-accuracy mandate includes field acquisition, forwarding, planned-work and unavailable-evidence instructions.
2. **Observed — Musts 1–3:** a review exercise identifies an unacquired field in a deliberately incomplete card, accepts an explicit acquisition-and-forwarding plan, and reports unavailable evidence as unverified. Save the card excerpts, supplied source excerpts and resulting findings as review evidence; a string assertion alone does not prove review quality.

## Progress

- Original premise/scope: the mechanically filed item scoped only the old alias card `we:backlog/xzv8r3e-pin-why-conflicting-pr-reads-queued-in-classifypr.md`, with a stale line-17 citation and no executable acceptance criterion or matching test path.
- Corrected location: `we:backlog/4687-pin-why-conflicting-pr-reads-queued-in-classifypr.md` has `bornAs: xzv8r3e`. Its current Design explicitly plans acquisition of `mergeable` and forwarding to the classifier. Editing that card again would not provide the reusable prevention requested here.
- Source evidence: `we:scripts/conveyor/reconcile-pass.mjs#PR_LIST_JSON_FIELDS` currently requests `mergeStateStatus` but not `mergeable`; `defaultReadPrs` uses that list for both shared reads and direct CLI reads. `we:scripts/progress-board.mjs#classifyPr` currently tests `DIRTY` and `BEHIND` before acceptance. These observations support the missing-acquisition failure class, not a historical diagnosis of particular PRs.
- Existing prevention is partial: `we:scripts/lib/review-core.mjs#LENS_HUNT_BRIEF` already tells claim-accuracy reviewers to inspect Done-when criteria and resolve claims against source. Its enumerated hunt shapes do not require tracing each input field through fetch and forwarding. `buildPanelMandate` already includes the brief. `we:scripts/lib/__tests__/review-core.test.mjs` already tests the brief and its panel wiring. The generic lens is delivered; this specific check is not.
- Corrected scope: extend that existing lens and its matching test, using the fallback expressly allowed by the originating request. No new lens, automatic prose parser, mandatory-review policy or PR-query change belongs to this prevention item. The runtime files above are evidence only.

## Design

Extend the existing claim-accuracy hunt brief in `we:scripts/lib/review-core.mjs`. When a changed card's Done-when criterion names input fields, require a per-field trace: criterion → consumer → acquisition source → any projection or normalization before the consumer. For a fetched PR field, check the actual query's field list, not a same-named constant in another reader. A fixture with an invented property is not acquisition evidence.

Distinguish existing behavior from planned work. An absent field is a defect in a card that promises behavior without acquiring it; a card explicitly planning query acquisition, forwarding and matching tests is a valid plan. Derived fields must identify their inputs and transformation, rather than being required literally in a remote query. Apply the check to criteria in documentation, configuration and data changes as well as source changes.

Use the existing evidence-grounded finding format and existing advisory claim-accuracy seat. With tools, resolve the cited source at the reviewed revision using the existing isolated-review rules; without tools or source excerpts, report the trace as unverified and name the missing evidence. Do not infer absence from unavailable evidence or claim a check passed. This addition does not alter verdict aggregation or seat selection.

## MVP

1. **Must 1:** add the field-by-field acquisition and forwarding check to the existing claim-accuracy brief in `we:scripts/lib/review-core.mjs`, with `PR_LIST_JSON_FIELDS` as an example rather than a universal schema.
2. **Must 2:** cover planned acquisition, derived fields and all card input kinds (source, docs, config and data); reject fixture-only evidence as proof of production acquisition.
3. **Must 3:** specify honest handling of unreadable or unavailable evidence, and extend `we:scripts/lib/__tests__/review-core.test.mjs` to pin these instructions and their presence in the generated panel mandate. Preserve existing lens membership and verdict policy.

## Test plan

Extend the existing hunt-brief test group in `we:scripts/lib/__tests__/review-core.test.mjs`. Assert the new acquisition/forwarding obligation, the fixture-only counterexample, planned/derived-field treatment and unavailable-evidence branch are present in the generated claim-accuracy mandate. Keep the existing frozen registry, other-lens and panel-wiring assertions. Removing the new brief paragraph must redden the targeted regression.

Run the focused hunt-brief tests, then the whole matching Vitest file and `npm run check:standards` during implementation. Exercise three small review inputs: an absent `mergeable` field with no acquisition plan; the same criterion with an explicit acquisition/projection/test plan; and the same criterion with source evidence unavailable. Include a derived-field example to ensure the rule does not require every computed value in a remote query. Preparation checks and stamping remain runner-owned.

## Proof plan

Capture red-before/green-after output for the targeted mandate regression and inspect the actual generated claim-accuracy mandate. Then run the three review exercises with the same evidence boundary, retaining the input and findings. The incomplete card should yield a concrete acquisition gap; the complete plan should not be rejected just because its implementation is future work; the evidence-starved case should disclose its limit. Do not use a successful prompt-string test as evidence that reviewers reliably catch every field omission. No live PR mutation is needed.

## Follow-ups

If observed reviews still miss field acquisition despite this explicit check, use those misses to specify a structured field-provenance contract and deterministic validator in a separate item. Do not introduce a repository-wide free-prose field parser here. Any proposal to make claim-accuracy mandatory is a separate review-policy decision. The runtime correction remains owned by #4687.
