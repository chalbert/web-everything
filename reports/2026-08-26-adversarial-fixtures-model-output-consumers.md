# Adversarial fixtures for machinery that consumes model output

**Date**: 2026-08-26
**Point**: Every defect the review pipeline's new fixtures found was structurally valid JSON, so schema
validation — the field's standard mitigation — would have caught none of them; the durable rule must bind on
*semantic* wrongness, and this repo already ships every mechanism needed to enforce it.
**Research page**: `/research/adversarial-fixtures-model-output-consumers/`

---

## Question

PR #1607 (landed as card [#3351](/backlog/3351-validate-a-juror-s-cited-file-against-the-net-diff-and-cover/))
added 25 adversarial fixtures to the review pipeline. Six found real defects. **Not one was a parse failure.**
Should Web Everything carry a durable, cite-able acceptance criterion requiring adversarial fixtures for
machinery that consumes model output — and if so, what is the bound class, how is membership established, and
what qualifies a fixture set?

## Recommendation

**Yes — but as an amendment to an existing anchor, not a new one.** The rule belongs in this repo as
agent-machinery governance (Rule 6 does not bite: `we:scripts/` is the delivery machine's own tooling, not a
WE standard's implementation), and it is codified as one sentence on
`#agent-convergence-independent-validation` clause 2 plus a second qualifier beside the #3264 note in
`we:docs/agent/backlog-workflow.md`. Concretely: the **class** is defined by the trust boundary, never by
failure shape; **membership in the enforced set is declared**, widened by import-graph reachability from the
single model-entry seam, and ratcheted; the **trigger** is the consumer *existing*, not a change touching a
guard; and **what qualifies a fixture** is already settled by clause 2, restated in the form that works with
no change in flight (a named guard whose removal reddens it). Every mechanism reuses something already in
this tree.

**Two corrections the prep passes forced, recorded because they were nearly shipped as findings.** (1) A
first draft proposed a *new* statute anchor and claimed no collision; it had under-quoted
`#agent-convergence-independent-validation` clause 2, which already ratifies *"require a test that fails on
pre-change behavior for logic fixes"* scoped to *"any AI-review/convergence surface in the constellation."*
The genuine gap is not the qualifying test but the **trigger** — clause 2 fires on a fix, and none of the six
defects had one. (2) A first draft recommended **detection** over declaration; run against the tree, both
proposed detector arms miss `we:scripts/review-core-cli.mjs` and `we:scripts/lib/jury-core.mjs` (the two
motivating files) while false-positiving on `we:scripts/operations/step-kinds.mjs`, a documented pure leaf —
and `we:scripts/lib/operation-io-fidelity.mjs:320-327` had already recorded this repo's own finding that a
source scan for a semantic property *"gets it wrong in both directions (it did, three times)."*

## Key findings

### 1. The six defects share one shape, and it is not "malformed input"

| # | Defect | Input was | Would a JSON-schema check have caught it? |
|---|---|---|---|
| 1 | A juror cited a file not in the diff; the verdict acted on it and bounced the PR | valid | **No** — `file` is a string |
| 2 | `line: 0`, `-12`, `3.7` passed `Number.isFinite` and rendered into the posted comment | valid | **No** — `line` is a number |
| 3 | `normalizeFindings` coerced a non-array `findings` to `[]`; a juror narrating blockers in prose recorded an **accept** | valid | **No** — prose is a string |
| 4 | Same coercion for an object-valued `findings` | valid | **No** — an object is an object |
| 5 | A forged `citationScope` would have let a juror withhold its own finding | valid | **No** — it is a valid enum member |
| 6 | An off-scope downgrade was undone one gate later by `prevention-outstanding` | valid | **No** — no field was wrong at all |

The class is *semantically wrong but structurally valid* output. That is precisely what a real model produces
when it is confidently wrong, and it is precisely what the field's dominant mitigation does not address.

### 2. The field's standard mitigation is schema validation, and it is the wrong instrument here

The structured-output tooling ecosystem (Instructor, Outlines, Pydantic AI, OpenAI structured outputs, GBNF
grammars) has converged on *constrained decoding* — making schema-invalid output impossible by construction.
That closes the whole "parse failure" family and closes **none** of the six above. Practitioner writing on the
gap is explicit: a sentiment classifier can emit perfectly valid JSON with correct types and enums while
returning `confidence: 0.99` on gibberish — "valid structure, meaningless data" — and the fix named is
*semantic* validators plus **evidence spans the model must quote verbatim**, because a quote is hard to
hallucinate. Defect 1 above is that finding rediscovered from the consumer side: a cited `file` is an evidence
span, and validating it against the net diff is exactly the verbatim-quote check.

### 3. OWASP already names the class — from the security side

**LLM05:2025 Improper Output Handling** (LLM02 in the 2023/2024 revision) is the named vulnerability: an
application trusts model responses without validation, and the mitigation is *treat LLM output as untrusted
data and apply the same sanitization you would apply to any external input* — the LLM is an interpreter of
untrusted input. The published mitigations, however, are almost entirely about **injection sinks** (escaping
SQL/HTML, stripping command patterns) because the assumed harm is code execution. The six defects here have a
different harm: **the machinery reaches a wrong verdict and acts on it.** So OWASP supplies the correct
*posture* (untrusted) and the wrong *threat model* (injection). The delta is real.

### 4. The coercion is Postel's law applied at a trust boundary — a known anti-pattern

`we:scripts/lib/jury-core.mjs:445` reads `Array.isArray(rawList) ? rawList : []`. That is "be liberal in what
you accept" at the exact seam where liberality is harmful. The standing critique of the robustness principle
is that *liberal acceptance removes the feedback that would correct bad behavior* — a receiver that silently
accepts malformed input means the sender never learns. Here the "sender" is a model that cannot learn at all
within the run, so the feedback is not merely delayed, it is destroyed: a juror that wrote "I would not merge
this" recorded an accept, and the prose sat unread in the summary. The fix that landed refuses the type at the
**call site** (`we:scripts/operations/review-pr.mjs:884-892`) rather than at the coercion, so the same hole is
still open on every other path through `normalizeFindings`.

### 5. Golden-set practice is about the model; nobody tests the machinery

The LLM-evaluation literature has a mature fixture discipline — a version-controlled golden set of 50-200
cases, stratified, with an explicit *adversarial* bucket and a *replay of failures that already shipped*
bucket, run as a CI gate on every build. Its subject is invariably **the model or the prompt**: does the model
still answer well. The subject here is the **consumer** — does the pipeline behave correctly when the model
answers badly. The two need opposite fixtures: an eval golden set holds *good* answers to compare against; an
adversarial consumer fixture holds *bad* answers the pipeline must survive. This is the clean delta, and it is
why "we already have evals" is not an answer.

### 6. Mutation testing supplies the only non-stale definition of "adversarial"

Mutation testing's premise — *put the bug back and see whether anything goes red* — is the only qualifying
test for a fixture set that does not go stale and cannot be gamed. A taxonomy checklist ("must include a
hallucinated-reference case") is checkable but ages with the model failure landscape and admits a fixture that
asserts nothing. Discrimination does not age: a fixture counts iff some named line of guard code, removed,
makes it fail.

**This repo has already reached that conclusion twice, independently:**

- `we:docs/agent/backlog-workflow.md:270-306` (#3264) — the tier-1 determinism qualifier, whose blunt test is
  *"if the criterion would still pass against a double that returns `''` for everything, it is not proving the
  mechanism."*
- `we:scripts/operations/mutation-check.mjs` — a **shipped operation** that does exactly this, with a
  three-valued outcome (`killed` / `survived` / `unrun`) where `unrun` is load-bearing: the find-text was
  absent, so nothing was mutated and reporting `killed` "would certify a guard as sound on the strength of a
  test run that examined the unmodified code."

### 7. The complement is already carved out of the existing fidelity gate — by name

`we:scripts/lib/operation-io-fidelity.mjs` enforces the #3264 qualifier over every
`we:scripts/operations/` IO module with a shrinking allowlist. Its debt register `UNCONVERTED_IO_MODULES`
(`:135`) carries six entries, and two of them are:

```js
'review-pr',    // declares a `judge` step: the real mechanism needs a model, not a repo
'review-prep',  // declares a `judge` step, same
```

The existing gate **permanently exempts exactly the modules this rule would govern, and states the reason.**
The proposed anchor is not a rival to that gate; it is the discharge of a documented hole in it.

### 8. Every mechanism the ruling needs already exists in this tree

| Needed | Already shipped | Ref |
|---|---|---|
| A mechanical "consumes model output" predicate | `(declaration?.steps ?? []).some((s) => s?.step?.kind === 'judge')` | `we:scripts/operations/cli-adapter.mjs:107` |
| A closed step vocabulary that makes `judge` load-bearing | `STEP_KINDS = ['compute','judge','confirm','effect']`, refused at registration | `we:scripts/operations/step-kinds.mjs:36` |
| A model-side test harness | `withFakeClaude()` — a real `claude` on `PATH` | `we:scripts/operations/__tests__/helpers/fake-claude.mjs:134` |
| The discrimination proof | `mutation-check`, three-valued | `we:scripts/operations/mutation-check.mjs` |
| The rollout shape (detect + shrinking allowlist, closed to new modules) | `RATCHET_BASELINE` / `UNCONVERTED_IO_MODULES` | `we:scripts/lib/operation-io-fidelity.mjs:86,135,371` |
| The register-a-rule shape | scan in the lib, three lines at the call site, outside any try/catch | `we:scripts/check-standards.mjs:2270-2274` |

The fake-model harness's own header (`:28-29`) already names the gap and leaves the hook: *"It does not run a
model... The quality of what an agent produces is a different test and a different budget — this is the
harness that makes that test a swap of one binding rather than a new build."*

### 9. The hole is live today, outside the operations tree

The same un-refused coercion the fix closed in `we:scripts/operations/review-pr.mjs` is still open at:

- `we:scripts/operations/review-prep.mjs:465` — `normalizeFindings(answer.findings)`, no array refusal; and
  `:462-464` silently `[]`s a non-array `corrections`; `:474` has no silent-juror refusal
- `we:scripts/operations/explore.mjs:674` — `Array.isArray(answer.findings) ? answer.findings : []` inline
- `we:scripts/review-core-cli.mjs:178` and `:273` — **outside the operations tree entirely**

Plus a distinct fail-open: `we:scripts/lib/jury-core.mjs:480` — `admitsCitation` returns permissively on an
*unknown* scope value.

**None of those has a bug report or a fix in flight.** That is the decisive fact, and it points at the
*trigger*, not at the scope: a rule that fires on a change touching a guard is structurally blind to every
one of them.

**Boundary caveat, stated because a first draft got it wrong.** "Consumes model output" is *not* reliably
decidable from a single file. `we:scripts/lib/jury-ledger.mjs:252` and
`we:scripts/lib/verdict-ledger.mjs:430` parse our own JSONL ledger and
`we:scripts/conveyor/tick-core.mjs:932` parses orchestrator bookkeeping from stdin — none is model output,
though all three look alike. Conversely `we:scripts/review-core-cli.mjs:178` takes `findings` from
`input || {}` read from `--file`/stdin, so whether it is model output is a property of the *caller*, and
`we:scripts/lib/jury-core.mjs:444` is an exported helper taking `@param {*}`. The statute can state the class
by the trust boundary; the *gate* has to work from a declared set.

## Files created/modified

| File | Action |
|---|---|
| `we:reports/2026-08-26-adversarial-fixtures-model-output-consumers.md` | created (this report) |
| `we:src/_data/researchTopics/adversarial-fixtures-model-output-consumers.json` | created |
| `we:src/_includes/research-descriptions/adversarial-fixtures-model-output-consumers.njk` | created |
| `we:backlog/xuhxkqz-require-adversarial-fixtures-for-machinery-that-consumes-mod.md` | created (the prepared decision) |

## Sources

- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) · [LLM05 Improper Output Handling](https://auth0.com/blog/owasp-llm05-improper-output-handling/) · [Insecure output handling](https://coralogix.com/ai-blog/llms-insecure-output-handling-best-practices-and-prevention/)
- [Robustness principle](https://en.wikipedia.org/wiki/Robustness_principle) · [Postel's law reconsidered](https://devopedia.org/postel-s-law)
- [LLM structured outputs: schema validation for real pipelines](https://collinwilkins.com/articles/structured-output) · [Instructor](https://python.useinstructor.com/) · [Pydantic for LLMs](https://pydantic.dev/articles/llm-intro)
- [LLM eval golden set design](https://futureagi.com/blog/llm-eval-golden-set-design-2026/) · [Metamorphic and adversarial strategies for testing AI systems](https://www.ministryoftesting.com/insights/metamorphic-and-adversarial-strategies-for-testing-ai-systems) · [MORTAR: multi-turn metamorphic testing](https://arxiv.org/html/2412.15557v3)
- [What is mutation testing? (Stryker)](https://stryker-mutator.io/docs/) · [Mutation testing: when 100% coverage still tests nothing](https://loiane.com/2026/08/mutation-testing-angular-stryker/)
