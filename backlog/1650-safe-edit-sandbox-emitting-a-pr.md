---
kind: epic
parent: "142"
status: open
priority: low
relatedTo: ["2095"]
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-08-15"
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, safe-edit, pr, change-safety, ai-generated, accepted-on-merit, dissolved, epic]
---

# Safe-edit sandbox emitting a PR

> **DISSOLVED → accepted on merit** (batch-confirmed per [#2095](/backlog/2095-apply-the-2092-merit-conceded-dissolve-test-to-the-ten-142-v/), applying the [#2092](/backlog/2092-validation-gate-not-yet-verdicts-vs-the-not-a-prioritization/) merit-conceded dissolve test). The merit is **conceded** — the standard-based emit angle is genuinely differentiating — so this is **no longer an open go/no/not-yet decision**; it is an accepted build gated on its trigger. **Trigger — settled:** #2095's own analysis (2026-07-06) already confirmed the #095 standard-gated emit path is resolved (`we:scripts/autofix/engine.mjs` + `npm run autofix`), so the un-gate condition is met and this is ordered by normal burndown priority. Everything through "Recommendation" below is retained as the **settled** merit rationale (the concession), not an open question.

> **Umbrella (2026-08-15) — converted `story` (size 13) → `epic`, sliced into 3 children.** Prepared per `we:agent-memory-src/story-preparation-checklist.md`: size 13 is a should-split candidate (the checklist's own rule — "> 8 is not a size, it is an instruction to slice"), and a live-code audit of `plateau-app:packages/dev-browser/` found most of the supporting infrastructure this card originally scoped for **already shipped** since it was opened (element-resolver #1690, ide-bridge #576/#577, forge #598, pr-body #601, credential-source #600, declared-rules registry #1689 — all `status: resolved`, verified by opening each package, not assumed from title). The **remaining, genuinely new** work is exactly what the three slices below cover — the original size-13 estimate re-derives as 5+5+3=13 across them, so this is a real decomposition, not a shrink-to-dodge-the-scan.
>
> - **Slice 1 — [#3139](/backlog/3139-safe-edit-sandbox-live-edit-propose-apply-revert-buffer/)** (size 5): the in-memory propose/apply/revert buffer for one declared-form edit. No dependency — foundational.
> - **Slice 2 — [#3140](/backlog/3140-safe-edit-sandbox-verify-gate-wiring-over-declared-rules/)** (size 5, blocked by Slice 1): reuses `we:scripts/autofix/engine.mjs`'s pure `autofix()` loop **directly, by a new cross-repo tsconfig alias**, with a `verify` callback over the app's declared-rules registry + `ConformanceVectorOracle`, so a proposed edit is gated by the app's own declared rules.
> - **Slice 3 — [#3141](/backlog/3141-safe-edit-sandbox-discard-or-emit-pr-orchestration/)** (size 3, blocked by Slices 1 and 2): wires a gate-passed edit to the already-shipped ide-bridge/forge/pr-body/credential-source packages — discard reverts, emit writes the file + opens the PR.
>
> The three form a linear DAG (`1 → 2 → 3`), the split rubric's disfavored shape *unless* incremental delivery is genuinely valuable — it is here: each slice ships an independently testable, demoable capability (a working propose/revert buffer; then a working live conformance gate over a proposed edit; then a working discard-or-PR action), not a half-built registry with no consumer. **Out of scope for all three, named so it isn't silently assumed:** no dev-browser panel/UI exists yet to mount these behind clickable affordances — that is separate, unfiled work; these three slices ship the underlying *mechanism* library, not the panel.
>
> **Follow-up filed, not silently dropped (2026-08-15, #1355 review):** this Digest's own scope bullet
> promises the developer can "see the effect immediately" in the sandbox before choosing discard/emit —
> but none of the three slices ever applies the buffer's proposed content to a *running* instance (the
> buffer is fs/DOM-free, the gate only checks conformance, emit only writes the real file post-gate). That
> live-preview capability is real, separate, unscoped work, tracked at
> [#3138](/backlog/3138-safe-edit-sandbox-live-preview-against-a-running-instance/) rather than left
> implicit. **This epic resolving (once all 3 slices land) ships the propose→gate→emit mechanism, not
> live preview** — don't read epic-resolved as "the full Digest shipped" without checking 3138 too.

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

- **Leans on already-homed PR / auto-fix work.** The #142 triage flagged this candidate as resting on [#095 conformance auto-fix agent](/backlog/095-conformance-auto-fix-agent/) (the "gated by the standard" emit path) and the designer-to-PR thread. Decide/cite #095's shape before building a second PR-emit surface. **Resolved — #095 shipped 2026-06-08** (see the umbrella note above); the three slices reuse it directly rather than citing it as still-open.
- **Standard-gated emit.** The verify-gated check ("AI proposes, the standard verifies") is the same shared moat mechanism the verify/review children ride; the sandbox is one consumer of it.
- **Authoring rule.** Edits must be in the standard's own form (write the declared CSS/rule), never via a lowering engine — per the authoring-SoT-is-the-standard-form rule.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat rule (sandbox runs locally; PR emit is a git operation, no hosted editor backend).

## Recommendation

- **Verdict: not-yet (accept-and-gate), Confidence Low–Medium.** The candidate is real and its standard-based angle is genuinely differentiating, so don't drop it — but it's the heaviest build in the family and depends on the standard-gated emit path (#095) that isn't settled.
- **Un-gate trigger (concrete):** promote to a build story when **(1)** #095's standard-gated emit/verify path has shipped a usable form, AND **(2)** a flagship exercise-app workflow shows a real "tweak live → PR" loop that the framework-specific editors cannot serve because the app is multi-stack or relies on declared rules — evidence the stack-agnostic angle pays off. *(Superseded for burndown ordering by #2095's own trigger simplification — see the DISSOLVED note at top; part (2) here is the original decision's prior-art framing, not a live blocker.)*
- **Skeptic:** "Onlook and Builder.io already do live-edit-to-PR — this is a me-too." *Refuted on the delta, not novelty:* those tools emit *framework-specific generated code* with no conformance gate; the WE sandbox edits in the **standard's declared form**, is **gated by the standard**, and emits a **stack-agnostic** PR — which a React/Tailwind code generator structurally cannot do without the declared model. The residual the skeptic is right about is **cost/scope and prerequisite** — hence not-yet, and the lowest confidence in the set.

*~~If you'd rather decide go now (open a build story immediately) or no (drop the candidate), say so — the verdict is the thing on the table.~~ (Superseded: dissolved to accepted-on-merit per #2095 — the verdict is settled, not open.)*
