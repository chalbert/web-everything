# Auto-update pipeline — change-management prior-art survey

**Date**: 2026-06-11
**Point**: Industry prior art for an evergreen-app auto-update pipeline, grounding backlog #101's two open forks (where the pipeline lives — protocol vs service; the gate model — manual approval vs automated-with-gates vs staged rollout) and relating them to the machinery WE already has (the changelog-manifest protocol #102, the upgrader engine #094).
**Backlog item**: `/backlog/101-auto-update-pipeline/`
---

## Question

The evergreen app ([#099](/backlog/099-evergreen-app-vision/)) wants an app to stay current on deps/standards automatically and safely. #101 asks two things no design has yet settled: **where the orchestration lives** (a declared protocol an app/lib conforms to, vs. a runnable Plateau service) and **the gate model** (who or what decides an update is safe to merge/deploy). Both forks must reuse the vocabulary the change-management ecosystem already standardized (Dependabot/Renovate config knobs, semantic-release/changesets release flow, progressive-delivery gates, codemod migration delivery) rather than coin terms.

## Key findings

### 1. The ecosystem already splits "policy declaration" from "the runner" — two homes, not one

Every automated-update tool separates a **declarative policy file** (committed to the consumer repo) from the **engine that executes it**. Renovate reads `renovate.json` / `renovate.config.js`; Dependabot reads `.github/dependabot.yml`; changesets reads `.changeset/config.json`; semantic-release reads `.releaserc`. The policy is the portable, version-controlled contract; the bot/CI runner is swappable infrastructure (Mend-hosted Renovate, self-hosted Renovate CLI, GitHub-native Dependabot — same config grammar, different runner) ([Renovate Bot comparison](https://docs.renovatebot.com/bot-comparison/), [Mend Renovate](https://www.mend.io/renovate/)).

**Implication for fork #1:** this is exactly the WE shape — the **declared policy is the protocol (the only lock)**, the **orchestration runner is a disposable/leverage service**. It is the same split the existing Guard protocol uses (a predicate/policy attached to a region, resolved by a swappable provider — [protocols.json:94](../src/_data/protocols.json#L94)) and that render-strategy uses (a declared strategy, a swappable resolver — [protocols.json:70](../src/_data/protocols.json#L70)). The runner belongs in the reliability/Plateau-service lane ([projects.json:159](../src/_data/projects.json#L159)), not in the conformance contract.

### 2. The gate model is a spectrum the tools expose as graded config — not one fixed mechanic

No surveyed tool hardcodes a single gate. They expose a **graded policy** keyed to update severity and signal strength:

- **Stability / cool-off buffer.** Renovate's `minimumReleaseAge` (and Dependabot reviewer friction) holds a release for N days before it is eligible — "don't chase every whim" baked as a knob. By 2026 the bot defaults are safer (a multi-week age is the recommended default) ([Renovate](https://github.com/renovatebot/renovate), [oneuptime: dependency update automation](https://oneuptime.com/blog/post/2026-01-25-dependency-update-automation/view)).
- **Merge confidence.** Renovate's Merge Confidence scores age / adoption / pass-rate / test-pass signals into a confidence level used to decide whether an update is safe to auto-merge without manual review ([Mend Renovate](https://www.mend.io/renovate/)).
- **Auto-merge boundaries.** The consensus default is **auto-merge low-risk-green (patch / pinned dev-deps) when tests pass; human-gate the rest**. Major bumps and anything with a visual/behavioral diff stay human-gated ([Renovate/Dependabot security config](https://www.systemshardening.com/articles/cicd/renovate-dependabot-security/)).

**Implication for fork #2:** the gate is a **configurable policy with a default flavor**, never a constant. "Visual-diff and major = human; patch/minor-green = auto" is the *default a project config extends*, mirroring how every tool ships safe defaults the consumer overrides.

### 3. Release flow ranges from fully-automated to human-checkpoint — both are legitimate end-states

- **semantic-release** is the fully-automated pole: it reads Conventional-Commits, derives the next semver, generates the changelog, and publishes — **no human intervention** ([semantic-release](https://github.com/semantic-release/semantic-release)).
- **changesets** inserts a deliberate human checkpoint: instead of publishing instantly, CI opens a "Version Packages" PR that **acts as the final gateway** grouping everything since the last release; a human merges to ship ([Changesets over semantic-release](https://xnok.github.io/infra-bootstrap-tools/blog/intentional-releases-changesets/), [Liran Tal: changesets](https://lirantal.com/blog/introducing-changesets-simplify-project-versioning-with-semantic-releases)).

**Implication:** "automated" and "human-gated" are both valid configured modes of the *same* pipeline — confirming the gate is a dimension (full-auto ↔ checkpoint-PR ↔ staged), not a fork between two products.

### 4. Progressive delivery makes the gate a *runtime metric gate*, not just a pre-merge gate

Beyond merge-time, progressive delivery (Argo Rollouts, Flagger, Spinnaker) graduates traffic to the new version incrementally and lets **metric analysis drive automated promote-or-rollback** — Kayenta/Datadog/Prometheus feed the analysis step ([Argo Rollouts concepts](https://argo-rollouts.readthedocs.io/en/stable/concepts/), [progressive delivery canary guide](https://calmops.com/architecture/progressive-delivery-canary-argo-rollouts-flagger/)). The risk model shifts from a binary cut-over to "graduate and let data decide."

**Implication for fork #2:** the gate model is really **two gates on one axis** — a *pre-merge* gate (confidence/severity → auto vs human) and a *post-deploy* staged-rollout gate (metric analysis → promote vs auto-rollback). Both are the same "configurable policy with safe defaults" shape; staged rollout is the third point on the gate spectrum, not a separate concern.

### 5. Codemod migration delivery is a *consumer* of the manifest, already homed in WE

Breaking-change migration is delivered as **codemods shipped alongside the release** (jscodeshift / Codemod.com / Hypermod; TypeORM's `@typeorm/codemod`, Next.js / Storybook upgrade transforms) ([Fowler: codemods for API refactoring](https://martinfowler.com/articles/codemods-api-refactoring.html), [Hypermod](https://www.hypermod.io/blog/7-automating-design-system-evolution)). In WE this is **already built**: the upgrader engine #094 (`upgraderEngine.ts`, analyze → generate → verify-gate) runs the codemods, and the changelog-manifest protocol #102 ([protocols.json:86](../src/_data/protocols.json#L86)) is the per-module change descriptor that links a breaking entry to its migration script with author + integrity-hash trust. The pipeline **consumes** these; it does not re-own migration. That is why #101 is `blockedBy` #102/#094 — the descriptors and the codemod runner are upstream of the orchestration.

### 6. Platform-side pre-testing is WE's net-new edge (no industry analogue surveyed)

Renovate/Dependabot test an update *after* a release lands, against the consumer's suite. WE's relationship graph (#092) lets a Platform-side update be **pre-tested against its consumers' suites before release** — known-compatible up front rather than hoped-safe. This is a genuine differentiator, not borrowed prior art; it rides on top of the same pipeline.

## Verdict (feeds #101's forks)

- **Fork 1 (home):** a thin **protocol declares update policy + capability** (the escapable lock); the **orchestration is a Plateau/reliability service** (disposable leverage). Same registry+provider shape as Guard/render-strategy. *Not* a monolithic project, *not* a hardcoded runner.
- **Fork 2 (gate model):** a **graded, configurable gate policy with safe defaults**, spanning one axis: pre-merge (stability buffer → confidence/severity → auto-merge-low-risk-green / human-gate-major+visual-diff) and post-deploy (staged rollout → metric analysis → auto-rollback). The default flavor is what a project config extends; nothing is a constant in the tool.

## Cross-references

- Decision: [#101 — auto-update pipeline](/backlog/101-auto-update-pipeline/)
- Blocked by / consumes: [#102 — changelog manifest](/backlog/102-changelog-manifest-standard/) · [#094 — AI upgrader tools](/backlog/094-ai-upgrader-tools/)
- Shape precedents: Guard protocol · render-strategy protocol ([protocols.json](../src/_data/protocols.json))
- Vision: [#099 — evergreen app](/backlog/099-evergreen-app-vision/) · pre-testing edge: #092 relationship graph

## Sources

- [Renovate (renovatebot/renovate)](https://github.com/renovatebot/renovate)
- [Renovate Bot comparison — Renovate Docs](https://docs.renovatebot.com/bot-comparison/)
- [Mend Renovate — automated dependency updates](https://www.mend.io/renovate/)
- [Renovate/Dependabot security configuration — auto-merge boundaries](https://www.systemshardening.com/articles/cicd/renovate-dependabot-security/)
- [How to configure dependency update automation — oneuptime](https://oneuptime.com/blog/post/2026-01-25-dependency-update-automation/view)
- [semantic-release (semantic-release/semantic-release)](https://github.com/semantic-release/semantic-release)
- [Intentional releases: why I chose changesets over semantic-release](https://xnok.github.io/infra-bootstrap-tools/blog/intentional-releases-changesets/)
- [Introducing changesets — Liran Tal](https://lirantal.com/blog/introducing-changesets-simplify-project-versioning-with-semantic-releases)
- [Argo Rollouts concepts — progressive delivery](https://argo-rollouts.readthedocs.io/en/stable/concepts/)
- [Progressive delivery: canary with Argo Rollouts and Flagger](https://calmops.com/architecture/progressive-delivery-canary-argo-rollouts-flagger/)
- [Refactoring with codemods to automate API changes — Martin Fowler](https://martinfowler.com/articles/codemods-api-refactoring.html)
- [Automating design system evolution with codemods — Hypermod](https://www.hypermod.io/blog/7-automating-design-system-evolution)
