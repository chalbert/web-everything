---
kind: decision
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1640"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, coverage, conformance, testing, ai-generated, validation, decision]
---

# Declared-rule to test-coverage gap surfacer

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether the idea earns a roadmap slot, not which of two designs wins.** The idea: the dev browser surfaces "**this page has a declared rule with no covering test**" — it cross-references the app's own declared rules (conformance / visibility / validation rules in the self-describing model) against the test suite, and flags every rule no test exercises. That's a bridge from *declared intent* to *test coverage* — a semantic link generic coverage tools structurally cannot draw, because they only see code lines, never declared rules.

**Recommended verdict: not-yet — accept the candidate as real, gate the build on a concrete trigger.** **Confidence: Medium-high.** The declared-rule-coverage delta is the cleanest in this batch (no incumbent measures rule coverage at all), but it needs the declared-rule model populated and a way to map a test back to the rule it exercises.

## What you're deciding

Does Web Everything commit to a **declared-rule ↔ test-coverage gap surfacer**, and on what trigger? Concretely:

- **Enumerate declared rules** — read the page's own conformance / visibility / validation rules from the self-describing model (the same declared rules #1631-class features bundle).
- **Map tests to rules** — determine which declared rule(s) each test exercises, so coverage is measured *per rule*, not per line.
- **Surface the gap** — flag every declared rule with no covering test, in context, in the dev browser — the inverse of "lines covered," reframed as "rules unverified."

## Why this isn't a classic fork (and is still a decision)

No contested either/or — no rival "shape A vs shape B" where one branch is flawed (the *fork-existence* test). It's a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop — still a `decision` card per the user directive, resolving to a **go / no / not-yet verdict**. The genuine tension is the **trigger**: the rule→test mapping needs declared rules populated and a way to attribute a test to the rule it covers.

## Context & prior art delta

The coverage category is mature — and the delta is total: *declared-rule coverage vs code-line/mutation coverage*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Istanbul / c8** | Measures what the tests exercised | Counts **code lines / branches / functions**; has no concept of a declared rule, so can't say a rule is uncovered |
| **Codecov / Coveralls** | Reports and gates on coverage trends | Aggregates the same **line/branch** numbers; a fully line-covered page can still have an untested declared rule |
| **Stryker / mutation testing** | Tests the strength of the test suite | Mutates **source code** and checks tests catch it; still code-anchored — never asks whether a *declared* rule is verified |
| **axe / a11y linters** | Checks rules against the rendered page | Checks a fixed built-in ruleset *directly*; doesn't measure whether the *app's own declared* rules have covering tests |

The moat (per #142): a WE app **declares its own rules**, so coverage can be measured against *intent* — "is this declared rule verified?" — a question no code-line or mutation tool can even ask, because the rule isn't visible to them; it lives in the declared model.

## Dependencies & lineage

- **Needs declared rules + a rule→test mapping.** The surfacer only works once the declared-rule model is populated and there's a way to attribute a test to the rule it exercises. That mapping mechanism is the prerequisite and the natural trigger.
- **Adjacent to [#1640](/backlog/1640-standard-aware-review-assistant/)** (standard-aware review assistant) — both read the declared contracts/rules to judge reality against intent; the review assistant flags a diff *against* declared rules, this surfacer flags *unverified* declared rules. Coordinate on the shared declared-rule reader.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule.

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium-high.** The candidate is real and the delta is uncontested (no tool measures declared-rule coverage), so don't drop it — but don't open a build yet: it needs declared rules populated and a test→rule mapping to compute the gap.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the declared-rule model is populated for at least one flagship app, **AND (2)** a mechanism exists (or is being built for [#1640](/backlog/1640-standard-aware-review-assistant/)) to attribute a test to the declared rule it exercises — so the rule↔test gap is computable, not guessed.
- **Skeptic:** "Codecov already gates coverage and Stryker already proves test strength — coverage is solved." *Refuted on the delta, not on novelty:* both measure **code** (lines, mutations); a page can be 100% line-covered and mutation-strong while a declared rule has *zero* covering tests — they can't see the rule. WE measures coverage against the declared rule itself, which is exactly the gap they're blind to. The residual the skeptic is right about is **readiness** (the rule→test mapping doesn't exist yet) — hence not-yet, not go.

*If you'd rather decide go now or no (drop it), say so — the verdict is the thing on the table.*
