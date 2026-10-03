---
bornAs: xcpqn6h
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/prepare-item-worker-brief.md", "we:skills-src/conveyor/prepare-item-agent-brief.md", "we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "bcac3340b064457ceea5df2d3e9321ba0a3ac82f"
tags: []
---

# Prevention — Add a prepare-time check that, when a card proposes a new hard check:standards error, requires a record… (from chalbert/web-everything#3435 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4495-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md:55` — Add a prepare-time check that, when a card proposes a new hard `check:standards` error, requires a recorded corpus-hit count and a rollout choice (warn-first or baseline) in Design. A review lens would also work.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3435@fdc85d1ac1678e7d0bbe2dbfc1f5f88b3f9b0956

## Progress

- Original premise/scope: the approval finding cited `we:backlog/4495-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md:55` and scoped only that historical card. The goal was a prepare-time check or review lens requiring measured corpus impact and a rollout choice before introducing a hard standards error.
- Corrected premise: the cited card's current Design proposes a status-independent hard placeholder error; its Proof plan defers corpus measurement until implementation. The old line number is historical, not the implementation location. The current preparation entry points are `we:skills-src/conveyor/prepare-item-worker-brief.md` and `we:skills-src/conveyor/prepare-item-agent-brief.md`. Both lack this explicit requirement. Their shared contract tests already live in `we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs`.
- Observed during preparation: importing `prepareCardStatus` from `we:scripts/conveyor/prepare-result.mjs` and passing the current #4495 card returned `hasSections: true`. This helper checks nonempty sections, not measured impact. Inspection of `we:scripts/operations/probation-build-run.mjs` confirms the worker brief is loaded by `readPrepareBrief` and preparation validation checks test scope and section shape before stamping. Searching both brief texts for corpus-hit, warn-first, or rollout-choice requirements found none. History search found the filing commit `02f086a9b` and its merge, not a delivery of the guard.
- Corrected scope: implement the explicitly permitted preparation/review lens in both full-item briefs, with their existing shared contract test covering each. The historical #4495 card and runtime stamping code are evidence, not edit targets. Scope-only preparation and decision preparation do not author this story Design and are outside this cut.

## Design

Add a named **Hard standards error rollout check** to both `we:skills-src/conveyor/prepare-item-worker-brief.md` and `we:skills-src/conveyor/prepare-item-agent-brief.md`. It is a mandatory preparation lens, using the review-lens alternative explicitly allowed by the original finding. Apply it when the proposed implementation introduces a new hard `check:standards` error or promotes an existing warning to an error. Merely mentioning the command, retaining an existing error, or adding a warning does not trigger it.

Before treating such a card as prepared, require its Design to record: (1) the proposed predicate and population, (2) a reproducible read-only probe and checkout SHA, (3) the exact corpus-hit count, including zero, with affected paths or a reproducible listing, and (4) an explicit rollout choice of warn-first or baseline with its rationale. Count findings and affected files separately where a file can produce multiple findings. Measure the population the proposed rule will actually inspect, including applicable documentation, configuration, and data; do not silently substitute source-code-only results or a sample. A failed probe or an unmeasured population is not zero.

For warn-first, describe how existing hits are repaired and what observation permits hard enforcement. For baseline, describe how existing hits are represented and how newly introduced violations are rejected without silently ignoring the entire existing population. This lens requires the target card to specify its rollout; it does not choose a rollout for #4495 or authorize changing any existing gate policy. If measurement cannot be completed, preparation is incomplete. If rollout requires a genuinely unresolved policy choice, preserve the brief's existing could-not-prepare boundary and report that choice instead of inventing it.

Place the worker requirement before its completion/stop instructions. Place the same requirement in the agent's Design authoring method and explicitly include it in review of the preparation. Preserve both briefs' existing ownership, no-delivery exits, and frontmatter constraints. This is an instruction/review requirement, not a claim that the section-shape validator can infer arbitrary proposed lint semantics.

## MVP

1. Add the conditional lens and Design evidence requirements to both scoped briefs, including warning-to-error promotions, zero-hit evidence, and incomplete-measurement behavior.
2. Extend `we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs` for both briefs so removal of the trigger, corpus evidence, rollout alternatives, or refusal boundary fails the contract suite.
3. Demonstrate the lens against a hard-error proposal and a non-triggering preparation fixture, retaining existing preparation ownership checks. No corpus migration or runtime validator change is included.

## Test plan

- Red before implementation: shared brief contract tests require the named lens, new-hard-error and warning-promotion triggers, a corpus-hit count in Design, probe/SHA evidence, and both supported rollout alternatives. Both current briefs lack these requirements.
- Preservation: existing factual-drift, already-done, genuine-fork, and frontmatter-ownership assertions in `we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs` remain green. Add assertions that the lens distinguishes warnings/command mentions from new hard enforcement and treats unsuccessful measurement as incomplete, not zero.
- Mutation: remove the lens from either brief independently; that brief's contract cases must fail. Remove only the corpus count or rollout requirement and verify the corresponding assertion fails.
- Behavioral proof is separate from text contracts: exercise fixtures with missing count, failed probe, zero hits with valid evidence, nonzero hits with warn-first, nonzero hits with baseline, and a warning-only proposal. Review the produced Design and any refusal against the expected requirements rather than treating keyword matches as proof of agent compliance.

## Proof plan

Run the targeted Vitest suite for `we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs` before and after the brief change; record failing new assertions on the base and passing assertions after the change. Run the named mutations and restore the implementation. Run `npm run check:standards` and report its actual result separately from the targeted proof.

In an isolated scratch fixture checkout, supply the updated worker brief to a preparation session against a small synthetic corpus with known matching and nonmatching cards. Include a #4495-shaped hard-error proposal whose Design lacks measurement and rollout. Verify the session measures the whole fixture population and writes its exact count and explicit rollout in Design, or reports the specific unresolved choice; it must not present the incomplete card as prepared. Repeat the behavioral cases from Test plan, including a documentation-only match that a source-only scan would miss. Use no lifecycle commands, stamping, commits, pushes, or PRs for these proof sessions. Record the rendered brief, fixture SHA, corpus, output card, and observed outcome so review can distinguish actual behavior from a prompt-text contract passing.

## Done when

- Must 1: the targeted brief contract suite fails on the old briefs and passes on both updated briefs, while all existing ownership and stop-boundary checks remain green.
- Must 2: fixture preparation produces verifiable Design evidence and a rollout for applicable proposals; failed measurement never becomes a zero-hit claim, and an unresolved policy choice retains the existing stop behavior.
- Must 3: warning-only and incidental-command cases do not acquire the new requirement; the full standards gate result and behavioral proof artifacts are recorded honestly.

## Follow-ups

A deterministic structured rollout schema and stamp-time validator would be separate work if the instruction/review lens proves insufficient; natural-language keyword detection is not part of this MVP. Extending the lens to other preparation modes requires tracing their real authoring consumers first. Repairing #4495's rollout or any corpus violations belongs to those cards and is not silently bundled here.
