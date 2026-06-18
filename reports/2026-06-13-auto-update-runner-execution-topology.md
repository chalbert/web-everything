# Prior-art survey — auto-update runner execution topology (backlog #497)

**Date:** 2026-06-13 · **For:** decision item [#497](../backlog/497-auto-update-orchestration-runner-plateau-service-execute-the.md)
· **Published as:** `/research/auto-update-runner-topology/`

/ prep pass (`/prepare 497`) — autonomous research half of the decision. The `update-policy` protocol
(the *lock*) already shipped via [#101](../backlog/101-auto-update-pipeline.md); this surveys **how the
runner that executes it should be built and where it executes**, so #497's one genuine fork
(build-a-bespoke-runner vs. compose-existing-engines) is grounded before the human call. No ruling made;
the item stays `open + preparedDate`.

## The gap

#101 resolved the *policy* and *gate model* and graduated to the `update-policy` protocol
([we:protocols.json:110-115](../src/_data/protocols.json#L110-L115)), explicitly leaving the **runner** as
"the deferred build" — *"the orchestration runner that executes it is a swappable Plateau/reliability
service"* ([we:protocols.json:112](../src/_data/protocols.json#L112), which names #497 as the build). The
batch pre-flight that opened #497 flagged two blockers: **(1)** no build home for "disposable infra, not a
WE artifact," and **(2)** epic-scope with zero existing scaffold. This survey targets the part #101's
[auto-update-pipeline survey](../src/_includes/research-descriptions/auto-update-pipeline.njk) did *not*
cover: the **execution topology** of update runners — self-hosted vs. hosted vs. CI-native, and how much
of the pipeline is commoditized vs. genuinely net-new for WE.

## What the survey found

### 1 · The ecosystem has converged on CI-native execution — the bespoke central service is the legacy shape

Both dominant dependency-update runners now execute *inside the consumer's CI*, not as a bespoke
standalone service the vendor operates:

- **Dependabot consolidated its compute platform onto GitHub Actions.** Update jobs that generate PRs run
  as GitHub Actions workflows, on GitHub-hosted *or* self-hosted runners (including Kubernetes via the
  Actions Runner Controller, GA May 2025). GitHub's stated motivation: the old bespoke compute "wasn't
  able to access on-premises resources… wasn't as flexible." The direction of travel is *away* from a
  vendor-operated black box, *toward* the consumer's own CI substrate.
  ([about Dependabot on GitHub Actions runners](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/about-dependabot-on-github-actions-runners),
  [vNet + ARC GA changelog](https://github.blog/changelog/2025-05-27-dependabot-support-for-virtual-network-vnet-and-actions-runner-controller-arc-is-generally-available/))
- **Renovate ships the same runner three ways from one codebase:** the Mend-hosted GitHub App (the
  convenience tier most users start on), the self-hosted Mend Renovate App (a stateful app you operate),
  and a **self-hosted GitHub Action** ("little configuration, no additional resources… runs on a
  schedule"). Same `we:renovate.json` grammar; the runner is swappable infrastructure.
  ([Running Renovate](https://docs.renovatebot.com/getting-started/running/),
  [renovatebot/github-action](https://github.com/renovatebot/github-action),
  [Mend deployment guide](https://docs.mend.io/wsk/renovate-deployment-guide-self-hosted-integrations))

**Implication (the reframe):** the pre-flight's "no build home" worry rests on an outdated premise — that
a runner *must* be a standalone operated service needing its own constellation node. It needn't. The
commoditized shape is **a portable orchestration package + committed CI workflow templates that run in the
consumer's own CI**, with a hosted-app convenience tier layered on top from the *same* package (Renovate's
exact model). That maps cleanly onto open-core-by-usage (self-run floor free, hosted tier paid) and the
solo-founder operational ranking (self-run tool > operated service), and needs **no new repo**.

### 2 · Pre-merge and post-deploy execute in *different* homes by nature — they were never one runner

The pre-merge gate (#101 Fork 2's first half) and the post-deploy staged-rollout gate (its second half)
do not share an execution environment:

- **Pre-merge** (trigger → scan → cool-off → test → severity → merge) is a **CI-time** concern — it runs
  in the version-control/CI plane, exactly where Renovate/Dependabot live.
- **Post-deploy staged rollout** (metrics → auto-rollback) is a **deploy-time, in-cluster** concern,
  solved by progressive-delivery *controllers* that run as Kubernetes operators watching live traffic —
  **Argo Rollouts** (a controller + `Rollout` CRD that queries metric providers to drive automated
  promotion/rollback) and **Flagger** (wraps existing Deployments, webhook hooks pre/post/during
  rollout). These are not CI steps; they live in the runtime cluster.
  ([argoproj/argo-rollouts](https://github.com/argoproj/argo-rollouts),
  [ArgoCD Rollouts vs Flagger](https://oneuptime.com/blog/post/2026-02-26-argocd-rollouts-vs-flagger/view))

**Implication:** "where does the runner live" has no single answer because there is no single runner. The
pre-merge engine and the post-deploy controller are *different commoditized substrates*. WE should declare
the policy for both and **emit config into each existing substrate**, not build either.

### 3 · The commoditized core is solved; the net-new WE edge is the cross-consumer pre-test

Triggering, cool-off, security scan, test-in-branch, auto-merge boundaries, and metric-gated rollback are
all **off-the-shelf** (Renovate/Dependabot + Argo/Flagger). The one capability **no incumbent offers** is
the WE-specific edge #101 named: **pre-testing a new provider version against its *consumers'* suites
before release**, using the provider↔consumer graph ([#092](../backlog/092-provider-consumer-graph-platform-manager.md),
graduated to `webregistries`). That requires cross-repo knowledge a single-repo CI runner does not have —
it is a *provider-side, graph-aware* step, the genuinely novel orchestration WE would author.

**Implication:** a from-scratch end-to-end runner would re-implement a large pile of commoditized infra to
get to the one part that is actually new. Native-first + minimize-lock-in both point at **composing the
incumbents as swappable execution primitives and authoring only the WE-net-new policy evaluation + the
#092 pre-test edge.**

### 4 · A pure compile-to-`we:renovate.json` adapter is lossy — the WE policy semantics don't fully map

The `update-policy` protocol carries semantics incumbents don't model: severity read from #102's
**changelog-manifest** with *strictest-wins* derivation ([we:protocols.json:94-99](../src/_data/protocols.json#L94-L99)),
migration linkage run by the **upgrader engine** ([we:blocks/renderers/upgrader/upgraderEngine.ts](../blocks/renderers/upgrader/upgraderEngine.ts), #094),
a *unified* gate axis spanning pre-merge **and** post-deploy, and the #092 pre-test edge. Renovate's
`minimumReleaseAge` + Merge Confidence cover the cool-off + auto-merge-boundary slice, but not the
manifest-driven severity, the migration linkage, or the cross-consumer pre-test. So a *thin* adapter that
only compiles `update-policy` → `we:renovate.json` would silently drop the WE-specific half — the
normalization-hub lossiness pattern, but here the lost cells are the whole point of the standard.

**Implication:** the runner can't be *only* a config emitter. It needs a thin WE orchestrator that **owns
the `update-policy` gate evaluation** (manifest severity, migration routing, the #092 pre-test) and drives
incumbent engines as **swappable execution primitives** for the commoditized mechanics — compose for the
solved parts, own the WE-specific parts. That is the recommended synthesis.

## Mapping to WE architecture

| Element | Classification | Home (per constellation-layering precedent #091/#092) |
|---|---|---|
| `update-policy` protocol (the lock) | Protocol — **already shipped** | WE ([we:protocols.json:110](../src/_data/protocols.json#L110)) |
| Pre-merge orchestration (gate eval + drive engine) | Reusable impl | Frontier UI package (next to the upgrader engine) |
| Engine execution primitive (fetch/test/PR) | Composed incumbent | consumer CI: Renovate / Dependabot |
| Post-deploy staged rollout | Composed incumbent | deploy cluster: Argo Rollouts / Flagger |
| Cross-consumer pre-test edge | Net-new WE capability | Frontier UI package, reads #092 graph (`webregistries`) |
| Operated runner + dashboard (paid tier) | Served product | plateau-app (open-core by usage) |

The **no-leakage invariant** holds throughout: no published `@webeverything` artifact imports the runner;
the standard ships only the `update-policy` protocol + `changelog-manifest`, and the runner consumes those
(see [[project_vision_is_plateau_service_no_leakage]]).

## Recommendation (prepared for #497)

1. **One genuine fork — build vs. compose: a thin WE orchestrator that owns the `update-policy` gate
   semantics and drives incumbent engines as swappable execution primitives** (Renovate/Dependabot for
   pre-merge fetch+test+PR; Argo/Flagger for post-deploy rollout), authoring only the WE-net-new policy
   evaluation + the #092 cross-consumer pre-test. *Rejected:* a bespoke end-to-end runner that
   re-implements the commoditized pipeline (re-invents solved infra, no interop gain, violates
   native-first + minimize-lock-in).
2. **Ratify by precedent (no fresh call):** the runner decomposes across the constellation rather than
   needing a "home" decision or a new repo (constellation-layering #091/#092 Fork 3); execution is
   CI-native self-run by construction (the floor), with a hosted plateau-app tier deferred as open-core by
   usage; post-deploy rollout is delegated to existing progressive-delivery controllers, not built.
3. **Then `/slice`** (a separate action, not part of this decision): the build graduates into a `blockedBy`
   chain — pre-merge orchestrator + engine adapter → #092 cross-consumer pre-test edge → post-deploy
   rollout config-emit → plateau-app operated surface — each separately prioritized.

## Sources

- [Running Renovate — Renovate Docs](https://docs.renovatebot.com/getting-started/running/)
- [renovatebot/github-action](https://github.com/renovatebot/github-action)
- [Renovate deployment guide — Mend.io](https://docs.mend.io/wsk/renovate-deployment-guide-self-hosted-integrations)
- [About Dependabot on GitHub Actions runners — GitHub Docs](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/about-dependabot-on-github-actions-runners)
- [Dependabot on GitHub Actions GA — The GitHub Blog](https://github.blog/news-insights/product-news/dependabot-on-github-actions-and-self-hosted-runners-is-now-generally-available/)
- [Dependabot vNet + ARC GA — GitHub Changelog](https://github.blog/changelog/2025-05-27-dependabot-support-for-virtual-network-vnet-and-actions-runner-controller-arc-is-generally-available/)
- [argoproj/argo-rollouts](https://github.com/argoproj/argo-rollouts)
- [ArgoCD + Argo Rollouts vs Flagger — OneUptime](https://oneuptime.com/blog/post/2026-02-26-argocd-rollouts-vs-flagger/view)
