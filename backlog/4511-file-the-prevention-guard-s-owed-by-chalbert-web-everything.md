---
bornAs: xkqiewd
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards.test.mjs", "we:scripts/__tests__/check-standards-inline-commands.test.mjs", "we:scripts/__tests__/check-standards-rules*.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "40b096c74de9da9974cc52a46a1a85d26e7baa9a"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2957's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the review's goal: detect undeclared deliverables, non-runnable documented command entrypoints, and invalid backlog schema through `check:standards`. The original four requests included two copies of the schema guard; current schema and existing coverage are reconciled below.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2957@8f7683496ea60ad42bdbcb8fb7bdad66f4a7df92

## Progress

- Original premise/scope: four missing guards, implemented by touching only we:backlog/4499-real-soak-break-for-4293-s-drain-rebase-push-fix-waived-in-2.md. Historical citations to that card's lines 2, 4, and 17 no longer identify the claimed omissions. Its current frontmatter uses `kind: task` and scopes runtime sources, their tests, and a break directory. Its Done-when section still contains a locus-prefixed Node entrypoint and bare deliverable references.
- Corrected premise: we:scripts/check-standards-rules.mjs already exports `bodyDeliverablesMissingFromScope`; we:scripts/check-standards.mjs invokes it with warning severity. It scans only standalone backticked file tokens under MVP / Done when, so bare deliverables in the motivating card escape it. Existing tests live in we:scripts/__tests__/check-standards.test.mjs. Extend this rule rather than add a duplicate. A direct import probe of that helper returned no findings for a bare we:scripts/missing.mjs reference under Done when, but reported the identical path when backticked; this confirms the extraction gap independently of the prose review.
- Schema requests 3 and 4 are one already-covered concern, expressed in obsolete vocabulary. `BACKLOG_KINDS` and `validateBacklogItem` in we:scripts/check-standards-rules.mjs enforce the merged `kind` axis and Fibonacci size constraints. Stories require size; tasks must have none. The governing sizing rules are in we:docs/agent/backlog-workflow.md, with regression coverage in we:scripts/__tests__/check-standards.test.mjs and we:scripts/__tests__/check-standards-frontmatter-parse.test.mjs. Do not restore `workItem` or require every item to have size.
- Corrected scope: the two standards-gate sources and their existing/planned matching tests. The motivating card is evidence, not an implementation file for these guards. Reading the gate and rule module found no general inline Node/npm entrypoint-resolvability check. This remaining work means the goal is not already delivered.

## Design

Extend `bodyDeliverablesMissingFromScope` in we:scripts/check-standards-rules.mjs to recognize repository-qualified file references in bare prose, inline code, and Markdown link labels under MVP / Done when. Normalize terminal punctuation and line citations before comparing with scope. Retain directory/glob coverage, deduplication, existing scope escapes, and warning severity; ignore fenced examples and other sections. Cover at least WE backlog and script paths from the original review without treating link targets as duplicate deliverables.

Add a pure inline-command checker in we:scripts/check-standards-rules.mjs and wire its findings into the backlog-body scan in we:scripts/check-standards.mjs. Pass repository root, filesystem lookup, and package scripts as inputs rather than executing commands. Inspect complete inline code spans beginning with `node ` or `npm `. For a literal Node file entrypoint, report a missing file or any abstract repository prefix; never strip such a prefix and falsely certify the command as executable. For `npm run <name>` and npm lifecycle aliases, resolve the name through we:package.json and check literal Node entrypoints in its script value. Ordinary npm management commands have no local entrypoint to validate.

Bound parsing explicitly: recognize quoted literal paths and conventional Node flags; skip eval/print, stdin, dynamic substitutions, and unsupported shell forms without claiming they resolved. Do not interpret command arguments as entrypoints or recursively execute npm scripts. Emit actionable file/line diagnostics. Use warning severity consistently with the existing backlog content guard; fixture assertions, rather than global corpus cleanliness, prove detection.

Repository prefixes remain mandatory on prose references. Runnable path-bearing examples belong in fenced command blocks under the existing convention; inline commands containing abstract prefixes must be diagnosed rather than made executable by changing the locus rule. Do not migrate the backlog corpus or change schema policy in this item.

## MVP

1. **Must 1:** Extend the existing deliverable detector in `we:scripts/check-standards-rules.mjs` and pin bare, backticked, and linked references in `we:scripts/__tests__/check-standards.test.mjs`.
2. **Must 2:** Implement the inline command checker and its gate wiring in `we:scripts/check-standards.mjs`; add `we:scripts/__tests__/check-standards-inline-commands.test.mjs` for both the pure rule and caller wiring. The existing schema validator remains authoritative.
3. **Must 3:** Demonstrate the motivating defects through isolated fixture bodies, preserving the current valid task-without-size and story-with-Fibonacci-size behavior. No runtime push code or original soak card changes are required.

## Test plan

- Source/test mapping: we:scripts/check-standards-rules.mjs → existing we:scripts/__tests__/check-standards.test.mjs plus planned we:scripts/__tests__/check-standards-inline-commands.test.mjs; we:scripts/check-standards.mjs → planned we:scripts/__tests__/check-standards-inline-commands.test.mjs (caller integration).
- Deliverables: uncovered bare/backticked/link-label references report once; exact, directory, and supported glob scopes cover them; line suffixes and punctuation normalize; fences, background sections, and explicit scope rationale retain their intended exclusions. Reproduce the motivating card's bare Done-when reference shape.
- Commands: existing/missing Node entrypoints, quoted paths, repository-prefixed paths, valid/unknown npm run names, existing/missing Node entrypoints in npm script values, lifecycle aliases, argument paths, multiple inline spans, fences, and the documented unsupported forms. Use temporary files and a synthetic package manifest; no command execution or mutation of real cards.
- Caller integration: assert findings actually reach the gate's warning reporter with owning card and line; prove that valid fixtures produce no command findings. Guard against a helper that is tested but never invoked.
- Run the focused suites with Vitest and run `npm run check:standards`. Preserve baseline findings separately from findings introduced by this change.

## Proof plan

First add the negative regression fixtures and run the focused tests against the pre-change rule implementation: they must fail because bare deliverables and invalid inline entrypoints are not diagnosed. Apply the implementation and rerun the same tests: they must pass with named findings for each invalid fixture and silence for valid fixtures. Record exact commands, exit statuses, and diagnostic output in the implementation review. Run the actual standards gate to verify integration; a zero gate exit alone is insufficient because these are warnings. No daemon soak or live push is needed for a read-only Markdown validator.

## Done when

1. **Must 1:** The focused test suite in `we:scripts/__tests__/check-standards.test.mjs` fails before and passes after the deliverable extraction change, including the motivating bare-reference case.
2. **Must 2:** The focused test suite in `we:scripts/__tests__/check-standards-inline-commands.test.mjs` fails before and passes after the command checker and gate wiring, with diagnostic evidence from the caller.
3. **Must 3:** Existing kind/size regressions remain green, valid tasks need no size or legacy field, and `npm run check:standards` has no new errors attributable to this implementation.

## Follow-ups

Corpus remediation, broader shell parsing, and any promotion of content warnings to errors are separate work; this item does not silently enable them. The underlying soak exercise remains owned by #4499. No new schema guard is owed for the duplicated historical `workItem` requests.
