---
bornAs: xryfgpi
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/prepare-item-worker-brief.md", "we:skills-src/conveyor/prepare-item-agent-brief.md", "we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "e3fe612ec35a0730c269dbd1fe28012c1ea71f4e"
tags: []
---

# Prevention — verify existing headings in prepare-brief insertion instructions

The approval review of chalbert/web-everything#3444 requested a prepare-brief lens: any “add X at section Y” instruction must cite an existing heading verified by grep. This is an author/reviewer evidence requirement, not a deterministic gate for interpreting arbitrary prose.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3444@ec142e4efe53eabe0ba6c29d6b8173ca21a6ec32

## Progress

- **Original premise/scope:** the mechanically filed card scoped only `we:backlog/4496-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md` and cited its line 37 as the source of the owed heading-verification lens.
- **Corrected premise:** line 37 is now blank. The relevant instruction is in that card's MVP: “Add the checklist at the build-item Definition of Ready” in `we:docs/agent/backlog-workflow.md`. The workflow contains decision-specific Definition of Ready prose, but does not supply that exact named build-item heading. The historical line citation is therefore replaced by the section reference here; the prevention remains useful without changing #4496 in this item.
- **Source evidence:** `we:skills-src/conveyor/prepare-item-worker-brief.md` declares itself the entire worker task and requires premise checking and five authored sections, but has no heading-verification instruction. `we:skills-src/conveyor/prepare-item-agent-brief.md`, under “The method — premise check, scope check, then author the five sections”, likewise checks cited files and factual drift without requiring evidence for insertion headings. Searches of these briefs found no explicit heading-existence/grep requirement. History matching this item found its filing commit `9384012e8` and merge `f37cad669`, not a delivering implementation.
- **Corrected scope:** update both prepare briefs, with their matching existing test file `we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs`. That test already parameterizes worker/agent contracts and checks factual-drift authority and stop boundaries. It covers each scoped brief source entry; no new runtime or backlog-workflow change is needed. #4496 is evidence, not an edit target.

## Design

Add the same heading-verification lens to both scoped briefs. Whenever preparation instructs a builder to add or change content at a named existing section, require the repository-prefixed target file, the exact existing heading, and recorded grep/ripgrep evidence from the current checkout. Search the heading as a complete line and inspect the surrounding text to establish that it is a real heading in the intended location, rather than a quoted example or a duplicate under another parent.

A missing or renamed heading is factual drift: correct the insertion instruction to an observed heading while preserving the goal. If the design intentionally introduces a new section, say explicitly that the heading is new and verify the existing parent or adjacent heading used to place it. Do not represent a proposed heading as already present. If choosing the location changes policy or the goal, retain the existing genuine-judgment-fork stop.

Place the worker instruction beside its premise/factual-drift directions. Place the agent instruction in its existing “The method — premise check, scope check, then author the five sections” section. These headings/locations were read during preparation. The text contract only protects the presence of the lens; it cannot prove that every future heading citation is true.

## MVP

1. Must add the lens to `we:skills-src/conveyor/prepare-item-worker-brief.md` and `we:skills-src/conveyor/prepare-item-agent-brief.md`: exact target heading, repo-prefixed file, current grep evidence, and contextual verification.
2. Must distinguish missing/renamed existing headings from explicitly proposed new headings, requiring an observed placement anchor for the latter. Preserve factual-correction authority and existing stop boundaries.
3. Must extend `we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs` with parameterized assertions for both briefs covering these obligations. Keep existing authorization, already-done, judgment-fork, and frontmatter allow-list checks intact.

## Test plan

- Extend the existing worker/agent contract suite with focused assertions for exact heading verification, grep evidence, contextual inspection, and the proposed-new-heading exception with an existing placement anchor. These cases must fail against the current briefs because those obligations are absent; avoid whole-document snapshots.
- Remove each required instruction from one brief at a time in a temporary test mutation to show its corresponding assertion fails, then restore it. The same test file covers both source entries in scope.
- Manual negative case: ask for insertion at “build-item Definition of Ready” in `we:docs/agent/backlog-workflow.md`. Require an actual search and reject that phrase as a verified heading when no complete heading line matches; similar decision-specific prose is insufficient.
- Manual positive case: use “The method — premise check, scope check, then author the five sections” in `we:skills-src/conveyor/prepare-item-agent-brief.md`. Record its actual heading line and context and accept the insertion reference.
- Manual edge cases: an explicitly new subsection placed under that verified heading is acceptable; an absent purported existing heading, or a match only inside a quoted example, needs correction. Duplicate headings require parent/context evidence.

## Proof plan

- During implementation, run `npx vitest run we:skills-src/conveyor/__tests__/prepare-brief-contract.test.mjs` (remove the repository prefix for shell execution from WE) after adding the assertions and before editing the briefs; capture the targeted failures. Repeat after the brief changes and record the passing result.
- Apply the resulting brief lens to the negative and positive samples above. Record the exact search, its output or no-match result, contextual inspection, and corrected insertion instruction. Use fixed-string whole-line grep/ripgrep matching on the actual Markdown heading including its heading markers. A passing text-contract test alone is not proof that the lens was applied correctly.
- Run `npm run check:standards` for the implementation and inspect the diff for unchanged worker authority and repo-prefixed references. The probation runner owns checks and stamping for this preparation pass.

## Follow-ups

- A semantic review lens spanning other authoring workflows can be a separate item if the same failure recurs there. This MVP covers the two current prepare entry points.
- Do not add a generic natural-language heading-reference gate: the requested prevention is evidence-backed preparation, with deterministic tests only for the brief instructions.
- Revalidate #4496's insertion wording when that card is built; this item's scope does not authorize changing its separate attribution/failure-default design.

## Done when

1. Both prepare briefs explicitly require observed heading evidence for section-targeted instructions and distinguish new headings from existing placement anchors.
2. The scoped contract cases demonstrate red before the brief edits and green afterward, and the recorded sample reviews show missing and existing headings handled as specified.
