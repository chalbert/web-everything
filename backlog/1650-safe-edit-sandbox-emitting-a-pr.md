---
kind: story
size: 13
parent: "142"
status: open
priority: low
relatedTo: ["2095"]
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, safe-edit, pr, change-safety, ai-generated, accepted-on-merit, dissolved]
---

# Safe-edit sandbox emitting a PR

> **DISSOLVED → accepted on merit** (batch-confirmed per [#2095](/backlog/2095-apply-the-2092-merit-conceded-dissolve-test-to-the-ten-142-v/), applying the [#2092](/backlog/2092-validation-gate-not-yet-verdicts-vs-the-not-a-prioritization/) merit-conceded dissolve test). The merit is **conceded** — the standard-based emit angle is genuinely differentiating — so this is **no longer an open go/no/not-yet decision**; it is an accepted build gated on its trigger. **Trigger:** the #095 standard-gated emit path is settled (already resolved → `we:scripts/autofix/engine.mjs` + `npm run autofix`); this is the heaviest build in the family, so it is ordered by normal burndown priority. Everything below is retained as the **settled** merit rationale (the concession), not an open question.

## Digest

**AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/) — this card validates whether it earns a roadmap slot, not which of two designs wins.** The idea: tweak the live running app in the dev browser, see the effect immediately in a throwaway sandbox that never touches prod, then either discard the change or emit it as a PR. The key differentiator from the existing visual-editor crowd: the edit is expressed in the **standard's own declared form** and is **gated by the standard** (the same conformance/contracts the app already declares), so the emitted PR is stack-agnostic and verifiable — not framework-specific generated code. The decision is a **go / not-yet / no** validation gate, not a merit fork.

**Recommended verdict: not-yet — accept the candidate as real, gate the build on prerequisites.** **Confidence: Low–Medium.** The standard-based / stack-agnostic angle is genuinely differentiating, but this is the heaviest candidate in the family (live-edit + sandbox + code-emit + gate) and leans on already-homed PR/auto-fix work — so the gate is real and the build is non-trivial.

## What you're deciding

Does Web Everything commit to a **safe-edit sandbox that emits a PR** as a dev-browser feature — and if so, on what trigger? Concretely it would provide:

- **Live edit in the declared form** — change a declared rule / intent / token / state in place, authored in the standard's own form (no lowering engine; per the authoring-SoT rule).
- **A throwaway sandbox** — the change applies to an isolated run, never to prod state.
- **Discard or emit-PR** — drop the experiment, or serialize the declarative delta into a stack-agnostic PR.
- **Gated by the standard** — the proposed change is verified against the app's declared contracts/intents/rules before it can be emitted ("AI/human proposes, the standard verifies").

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card — resolving to a **go/no/not-yet verdict**. The real sub-question with tension is the **trigger and scope** (this is the heaviest candidate; what must exist first), handled below.

## Context & prior-art delta

The visual-editor-to-code category is hot — the delta is *standard-based, stack-agnostic, standard-gated vs framework-specific code generation*:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Onlook** | Edit the live app visually, emit code | React/Tailwind-specific; emits framework code, not a **declared-form** delta, no standard gate |
| **Builder.io Visual Copilot** | Visual edits compiled to component code | Targets specific frameworks (React/Vue/etc.); generated-code-shaped, no conformance gate over a declared model |
| **Webflow / Framer** | WYSIWYG editing of a live site | Proprietary project format / their own runtime — lock-in; not the project's own standard, not PR-to-repo |
| **Figma Dev Mode** | Bridges design edits toward code | Hands off *specs/snippets*; doesn't edit the running app or emit a verified PR |
| **Utopia** | Live-edit React with two-way code sync | React-only, experimental; tied to one framework, no declared-rule gate |

The moat (per #142): a WE app is **self-describing**, so the edit and its emitted PR are *semantic, portable, verifiable* — expressed in the standard's declared form, gated by the standard, and therefore stack-agnostic. That is precisely what the framework-bound editors above cannot offer.

## Dependencies & lineage

- **Leans on already-homed PR / auto-fix work.** The #142 triage flagged this candidate as resting on [#095 conformance auto-fix agent](/backlog/095-conformance-auto-fix-agent/) (the "gated by the standard" emit path) and the designer-to-PR thread. Decide/cite #095's shape before building a second PR-emit surface.
- **Standard-gated emit.** The verify-gated check ("AI proposes, the standard verifies") is the same shared moat mechanism the verify/review children ride; the sandbox is one consumer of it.
- **Authoring rule.** Edits must be in the standard's own form (write the declared CSS/rule), never via a lowering engine — per the authoring-SoT-is-the-standard-form rule.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat rule (sandbox runs locally; PR emit is a git operation, no hosted editor backend).

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Low–Medium.** The candidate is real and its standard-based angle is genuinely differentiating, so don't drop it — but it's the heaviest build in the family and depends on the standard-gated emit path (#095) that isn't settled.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** #095's standard-gated emit/verify path has shipped a usable form, AND **(2)** a flagship exercise-app workflow shows a real "tweak live → PR" loop that the framework-specific editors cannot serve because the app is multi-stack or relies on declared rules — evidence the stack-agnostic angle pays off.
- **Skeptic:** "Onlook and Builder.io already do live-edit-to-PR — this is a me-too." *Refuted on the delta, not novelty:* those tools emit *framework-specific generated code* with no conformance gate; the WE sandbox edits in the **standard's declared form**, is **gated by the standard**, and emits a **stack-agnostic** PR — which a React/Tailwind code generator structurally cannot do without the declared model. The residual the skeptic is right about is **cost/scope and prerequisite** — hence not-yet, and the lowest confidence in the set.

*~~If you'd rather decide go now (open a build story immediately) or no (drop the candidate), say so — the verdict is the thing on the table.~~ (Superseded: dissolved to accepted-on-merit per #2095 — the verdict is settled, not open.)*
