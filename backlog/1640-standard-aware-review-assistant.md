---
kind: decision
parent: "142"
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: 1693
codifiedIn: one-off
preparedDate: "2026-06-23"
relatedTo: ["1641"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, review-assistant, conformance, ai-generated, validation, decision]
---

# Standard-aware review assistant

## Digest

AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — a go/not-yet/no validation gate, not a merit fork. The idea: before a human reviews a diff, an assistant checks it **against the project's own declared contracts, intents, and rules** and flags conformance drift — a violated schema, a broken intent, a tripped rule — so the reviewer spends attention on judgment, not mechanical drift. Generic tools (linters, AI reviewers) reason about style and best-practice; none reason against *this project's declarations*. WE ships those declarations, giving the assistant a ground truth.

**Recommended verdict: not-yet — accept the candidate, gate on the declared-rule surface and coordinate with the existing conformance line.** Confidence: Medium. The declaration-aware delta is real, but the conformance/auto-fix capability is already partly homed (#095), so this must be scoped as the *review-time, pre-human* surface of that line, not a parallel engine.

## What you're deciding

Does Web Everything commit to a **standard-aware review assistant** as a dev-browser / review-surface feature — and on what trigger does it become a build? Concretely it would, given a diff:

- **Check against declared contracts** — flag a change that violates a schema/contract the project declares.
- **Check against declared intents** — flag a change that breaks a declared UX intent (density/motion/role).
- **Check against declared rules** — flag a change that trips the project's own conformance/visibility/validation rules.
- **Pre-empt the human** — surface that drift *before* a person reviews, so review attention goes to judgment, not mechanical conformance.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "design A vs design B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card, resolving to a **go/no/not-yet verdict**. The genuine open sub-questions are the **trigger** and the **scoping against the already-homed conformance line (#095)**, handled below.

## Context & prior art delta

The category — automated pre-human review — is crowded; the delta is *declaration-aware* vs *generic*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **ESLint / Biome** | Static rules flagged on a diff before review | Generic + author-configured lint rules; no awareness of the project's *declared contracts/intents*, only syntactic/style rules |
| **Danger JS** | Custom checks that run on a PR before humans look | A scripting framework for bespoke PR checks; you must hand-write any declaration-awareness, it has no model of declared contracts |
| **CodeRabbit / GitHub Copilot review** | AI summarizes a diff + flags likely issues pre-review | Reasons from general code patterns and prose; not grounded in *this* project's declared contracts/intents/rules as ground truth |
| **SonarQube** | Quality/security gate over a codebase change | Generic quality + vulnerability rules; no notion of a project-declared intent/contract to check conformance against |

The moat (per #142): a WE app declares its contracts/intents/rules, so the assistant checks a diff against a *project-specific ground truth*, not generic best-practice. Flagging "this change breaks your declared intent/contract" before a human looks is exactly what generic reviewers — with no declared model to consult — structurally cannot do.

## Dependencies & lineage

- **Rides the declared-rule + introspection substrate.** #142 names the declared rules / verify-gated check; this assistant reads contracts/intents/rules to evaluate a diff and can't ship before that surface is queryable from a diff — the natural trigger.
- **Scope against the already-homed conformance line.** [#095](/backlog/095-conformance-auto-fix-agent/) (conformance auto-fix agent) is the existing home for "the standard verifies / auto-fixes." This card is the **review-time, pre-human** surface of that same capability — scope it as #095's review lens, not a second engine, to avoid duplicating the conformance core.
- **Adjacent:** [#1641](/backlog/1641-declared-rule-to-test-coverage-gap-surfacer/) (declared-rule ↔ test-coverage gap surfacer) is the sibling verify-surface — both consume the declared-rule model; one flags drift in a diff, the other flags rules with no test. Coordinate their rule-reading layer.
- **Home:** `locus: plateau-app` — the review surface lives with the dev-browser / plateau product ([#141](/backlog/141-dev-browser-vision/)); the conformance check itself is local-first per the cost-flat rule (an AI summarization layer over it is the optional paid enhancement, not a required per-call backend).

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Medium.** The declaration-aware delta is real, so don't drop it — but don't open a build until the declared-rule surface is queryable from a diff AND the relationship to #095 is settled so this is a lens, not a fork of the engine.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** the #142 declared-rule/contract model is queryable against a diff, AND **(2)** #095's conformance core exists to host this as its review-time surface, AND **(3)** a flagship exercise-app PR shows real declared-conformance drift that a generic reviewer (ESLint/CodeRabbit) missed — evidence, not speculation.
- **Skeptic:** "CodeRabbit / SonarQube already do AI/automated review — this is reinventing it." *Refuted on the delta, not on novelty:* those reason from generic code patterns and configured rules; none check a diff against *this project's declared contracts/intents*, because they have no such declared model to read. Declaration-aware drift detection is the structural gap. The residual the skeptic is right about is that the conformance core is partly built (#095) — hence scope-as-lens and not-yet, not a fresh go.

## Resolution — ratified go (sliced) 2026-06-23

Resolved **go**, carved into two slices (the declared-conformance check has two delivery surfaces, one buildable sooner):

- **Slice A — declared-conformance PR gate** → [#1693](/backlog/1693-declared-conformance-pr-gate-standard-aware-review-ci-surfac/) (`graduatedTo`). A diff-aware CI gate over the example apps; mirrors `plateau:scripts/check-render-conformance.mjs`; scoped as the review-time lens over the #095 conformance core, not a second engine. Blocked by the declared-rule registry [#1689](/backlog/1689-per-app-declared-rule-registry-rule-to-conformance-vector-li/).
- **Slice B — in-browser review lens** → [#1694](/backlog/1694-in-browser-standard-aware-review-lens-dev-browser/). The live dev-browser surface; same declared-rule reader; blocked by #1689.

Shares its declared-rule reader with #1641 (build once, via #1689).
