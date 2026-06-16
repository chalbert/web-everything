---
type: decision
workItem: story
size: 5
status: resolved
blockedBy: ["562", "141"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-14"
locus: plateau-app
relatedReport: reports/2026-06-14-bot-pr-mechanics.md
crossRef: { url: /research/bot-pr-mechanics/, label: "Bot-PR mechanics research" }
tags: [dev-browser, fix-loop, git-integration, pr-mechanics, decision]
---

# Fix-loop git-integration — bot-PR mechanics (flow, forge-auth, agnosticism, gate parity)

## Digest

The fix-loop's *"act on the repo → open a PR"* step (the #141 PR step,
[#562](/backlog/562-dev-browser-source-awareness-ide-bridge-map-deployed-dom-bac/)'s downstream) assumes a whole
**VCS-interaction surface** no item captured — surfaced as #562's Cluster A. **No design existed yet**; this
prep surveyed established bot-PR practice (Dependabot, Renovate, GitHub's Copilot coding agent) and published
the [`bot-pr-mechanics`](/research/bot-pr-mechanics/) research topic. The survey **collapses the eight raised
axes** to **one forced invariant + one genuine on-merit fork**; the other six are *support-all-coherent*
(policy dials read from the compliance layer, or mechanics derived from the resolver) — exactly how #562
ruled its provider registries. The invariant (generated code is **not privileged** — identical gates, no
bypass) is a **ratify**. The sole fork — **the PR evidence payload (standard contract vs. Plateau
markdown)** — carries a **bold** default. **Forge auth / bot identity** was raised as a fork but
**dissolved on the fork-existence test** (RATIFIED 2026-06-14): A-vs-B aren't competing end-states — they
co-exist as a credential-source *provider seam* selected by runtime context, the literal twin of the forge
provider registry already demoted here. Ratification, not research.

## Supported by default (not decisions — support all coherent)

Per the fork-existence test, six of the eight raised axes are **not** a decision — every coherent value is
supported; the only rules are defaults (which live in the compliance layer, #579) and degradation. They are
demoted out of the call (full detail in `## Context`):

- **Forge auth / bot identity = a credential-source provider seam** *(demoted on ratification 2026-06-14)* —
  raised as Fork 1, but A-vs-B are **not competing end-states**: the IDE-bridge git auth (local) and the
  GitHub-App backend broker (hosted) **co-exist**, selected by runtime context exactly like the forge
  provider registry below. Every coherent credential source is a provider; precedence + degradation are the
  only rules. The **security invariant** (no long-lived credential in the browser → user PAT/OAuth is
  fallback-only, never primary) and the **per-context default** live in the compliance layer (#579).
  Identity/signing **ride** the source (App ⇒ bot + auto-signed; bridge ⇒ user + their git config) — not a
  separate fork. Layer: **Plateau** (auth mechanism), no standard-owned contract. Couples to #410's
  authorization dial (a forge write is privileged). Full A/B/C survey recorded in `## Context`.
- **Forge-agnosticism = a forge provider registry** — "open a PR" abstracted behind a per-forge provider
  (GitHub/GitLab/Gitea/Forgejo/Bitbucket), every provider used, precedence + degradation the only rules —
  the **same support-all ruling #562 gave its bridge registry** ([#576](/backlog/576-ide-bridge-provider-registry-passive-file-line-jump-file-sys/)).
  Prior art is unambiguous (Renovate's `Platform` interface, Woodpecker's `forge.Forge`, git-pkgs/forge,
  go-git-providers). v1 ships the **GitHub provider first** — *prioritization, not a fork* (the ruled
  end-state is the registry; *when* each provider lands is burndown ordering).
- **Git-flow / PR-strategy policy dials** — draft-vs-ready, target branch, one-fix-per-PR vs. batched,
  rebase/squash/merge, auto-merge. Every value is coherent → configurable per project; the **defaults live in
  the compliance layer** ([#579](/backlog/579-platform-default-vcs-convention-vocabulary-in-the-compliance/),
  Cluster B), *read* by the bot, never invented by it.
- **Conflict & concurrency** — rebase-on-stale-base, detect-and-skip racing fixes; the local-edit conflict is
  [#577](/backlog/577-deep-two-way-vs-code-extension-emit-active-projects-coordina/)'s concern. Mechanics, not a
  merit fork.
- **Revert / rollback** — a merged-bad fix is backed out by the same loop opening a **normal revert PR**
  through the same gates (no special privilege); autonomy-gated per #410's revertibility ruling.
- **Monorepo / multi-repo targeting** — derived from the resolver ([#575](/backlog/575-source-anchor-self-description-contract-resolver-provider-re/)):
  the repo is wherever the resolved `file:line` lives; cross-repo → **independent PR per repo** (atomic
  cross-repo merge rejected — forges don't support it).

## Forced invariant (ratify, not weigh) — generated code is NOT privileged

The anchor the rest hangs on. A generated fix runs the **identical review + code-compliance gates as a human
PR**: lint, tests, type-check, static analysis / quality gate (coverage, no new smells), branch protection,
required human review — **no bypass path**. The autofix **verify gate**
([scripts/autofix/engine.mjs:229-247](../scripts/autofix/engine.mjs#L229)) is *necessary but not sufficient*:
it proves the fix cleared the failure locally; the org's CI + review still gate the merge. *Which* gates
apply is **read from the compliance layer** (#579), not asserted by the bot. **Auto-merge** (the #141/#410
autonomy ladder — [#141 Fork 2](/backlog/141-dev-browser-vision/) ratified *default = open-PR*) is reachable **only
after every gate is green**. This is a ratify, not an open call: 2025 agent-PR consensus converges on exactly
it (GitHub's Copilot coding agent opens PRs that run the same branch-protection + required-checks gates;
best practice separates "analysis" from "execution" with a human approval gate).

## Axis-framing

The machinery this builds on already exists in the tree: the verify-gated autofix engine (apply → re-run →
keep only if the failure cleared with no new error, else revert —
[scripts/autofix/engine.mjs:229-247](../scripts/autofix/engine.mjs#L229)) with its bounded, metered
orchestrator ([scripts/conformance-autofix.mjs:3](../scripts/conformance-autofix.mjs#L3)) and the human
`decide` hook that reverts a gate-passing patch before it lands
([engine.mjs:247](../scripts/autofix/engine.mjs#L247)); the introspectable
[capability matrix](../src/_data/capabilityMatrix.json#L1) the evidence payload can ride; and the
selection→disk bridge precedent the forge action mirrors
([tools/dev-panel/vite-plugin.ts:11](../tools/dev-panel/vite-plugin.ts#L11),
[:260-281](../tools/dev-panel/vite-plugin.ts#L260)). With the support-all axes demoted, **one axis remains a
genuine call**: **the PR evidence payload** — whether WE mints a standard contract for the machine-readable
conformance evidence the PR carries, or leaves it as Plateau formatting. (Credential source — raised as a
second fork — dissolved into the support-all provider seam above; see `## Context`.) It composes with
already-resolved rulings (#410's authorization dial + audit record; #575's anchor contract; #576's bridge
registry), so the survey *narrowed* the surface rather than widening it.

### Recommended path at a glance

The sole remaining fork and its ratified default. (The forge registry, the credential-source seam, and the
policy dials above the divider are *not* forks — they're support-all-coherent.)

| Fork | Ratified default | Main alternative | Confidence |
|---|---|---|---|
| **PR evidence payload** | standard-owned conformance-evidence manifest (app emits, Plateau renders) — built thin-first (B's markdown rendering ships ahead of the full contract) | freeform Plateau PR markdown only | **Med** — minting a standard here is a genuine judgment |

## ~~Fork 1~~ — Forge auth, bot identity & commit signing *(DISSOLVED → support-all provider seam, ratified 2026-06-14)*

**Dissolution.** Raised as a fork, but it **fails the fork-existence test**: A (reuse the IDE-bridge's git
auth) and B (GitHub-App backend broker) are **not competing end-states** — the item's own default was "A for
v1/local, B as the hosted tier," i.e. *both ship*, selected by runtime context. That is identical to the
forge provider registry (and #576's bridge registry) already demoted above: a **credential-source provider
seam**, every present source used, precedence + degradation the only rules. So it moves to *"Supported by
default."* What survives is **not** a winner-pick: a **security invariant** (no long-lived credential in the
browser → C is fallback-only) and a **per-context default** — both living in the compliance layer (#579),
not asserted by the bot. The A/B/C survey is retained below as recorded prior art for the seam's providers.

**Crux (recorded).** For unattended PR automation the industry-recommended pattern is a **GitHub App**: short-lived
installation tokens (~1h), fine-grained permissions, org-owned (survives employee churn), a built-in bot
identity, and API-made commits that are **auto-signed and verified** — strictly better than a long-lived,
user-tied PAT. But a **browser/extension is a poor place to hold an App private key**. Couples to
[#410 Fork 2](/backlog/410-dev-browser-deployed-app-live-patch-gated-capability-safety-/)'s authorization dial (a
forge write is a privileged action) and reuses the bridge precedence/degradation model from #562.

- **A — Reuse the IDE-bridge's existing git auth** *(recommended, v1)*. Open the PR through the
  already-authenticated #576/#577 bridge (the VS Code extension / git CLI is authenticated) — **zero new
  credential surface**. Identity = the user; signing = the user's existing git config. Cost: tied to a
  present, authenticated bridge — no headless/unattended story.
- **B — GitHub-App backend broker** *(the hosted/org-bot tier)*. The Plateau backend holds the App, mints
  short-lived installation tokens, and opens the PR. Identity = a **bot**; commits **auto-signed/verified**;
  org-owned. The recommended pattern for *unattended* automation. Cost: needs a backend + per-org App
  install — the hosted-SaaS posture (couples to #555/#556).
- **C — User OAuth/PAT entered into the browser** *(Rejected as primary)*. The user pastes a token; the
  browser calls the forge API directly. *Rejected:* a long-lived credential in the browser is an
  information-exposure surface. Keep only as a last-resort fallback where neither a bridge nor a backend is
  available.

**Resolution (the seam, not a pick): A and B are co-existing providers — A ships first (v1/local,
zero-credential bridge), B is the hosted-SaaS tier, C is fallback-only (security invariant).** Identity and
signing **ride** the source (App ⇒ bot identity + auto-signed; bridge ⇒ user identity + their signing
config). Which provider is the default in a given context, and the no-browser-credential rule, are
compliance-layer policy (#579), *read* by the bot — mirroring #562's local-vs-hosted layering.

## The sole fork — PR evidence payload: standard-owned conformance-evidence manifest vs. Plateau markdown

**Crux.** The autofix gate already produces the conformance failure + the verify before/after
([engine.mjs](../scripts/autofix/engine.mjs)), and #410 Fork 4-A already rules that an **audit record** rides
the PR. The open call is whether WE **mints a standard contract** for the *machine-readable conformance
evidence* the PR carries — i.e. whether this is a standards artifact or pure Plateau presentation.

- **A — Mint a standard-owned conformance-evidence manifest** *(recommended)*. A contract emitted by the
  app's introspectable self-description / trace substrate (reusing the capability-manifest vocabulary,
  [capabilityMatrix.json:1](../src/_data/capabilityMatrix.json#L1)) — the **same app-emits / tool-consumes
  shape #575's source-anchor contract took**. Plateau **renders** it into the PR body. Because the manifest
  is runtime-agnostic, a **polyglot/enterprise fix-loop** (a .NET/Java conformance runner) emits the *same*
  manifest — the forward-adapter reach. Classification: a self-description extension **contract**, **not a
  Protocol** (no swappable-vendor interop beyond emit/consume — minimize lock-in). Composes with, doesn't
  duplicate, #410-4A's audit record: the audit record is *who/when/diff/revert*; this manifest is *which
  gates ran + the verify before/after + the autonomy level*.
- **B — Freeform Plateau PR markdown only** *(Rejected as the end-state)*. The bot formats the evidence into
  PR markdown with no standard contract. Simplest and ships fastest, but **re-invents the payload per
  implementation** and forfeits the interop / forward-adapter reach. *Rejected* as the ruled end-state — but
  it is the natural **v1 rendering** of A's manifest, so it isn't wasted: ship the markdown rendering first,
  backed by the manifest contract.

**Default: A — mint the conformance-evidence manifest (standard-owned), Plateau renders it.** Constellation
split (#475/#091): the **manifest contract** → WE standard; the **rendering + attach-to-PR** → Plateau
dev-browser. *Sub-decision at ratification:* whether the manifest is a fresh self-description extension or an
additive field-set on #410-4A's audit record — default **a sibling extension reusing the same substrate**
(separation bias).

---

## Context

### Why this is captured here

Surfaced and documented during #562's prep as **Cluster A** (the genuine-design half; Cluster B — convention
*vocabulary* — is [#579](/backlog/579-platform-default-vcs-convention-vocabulary-in-the-compliance/)). The fix-loop's
*"act on the repo → open a PR"* step quietly assumes a whole VCS-interaction surface nobody had captured.
#562 fanned it out on ratification with a first-cut classification per axis; this prep ran the survey and
brought it to DoR.

### Per-fork classification (recorded)

- **Forge provider registry** — runtime-DI provider-set seam (mirrors #576's bridge registry). Support-all-
  coherent (fork-existence test): every present provider is used; precedence + degradation the only rules →
  not a winner-pick (demoted to "Supported by default"). Layer: **Plateau product** (the dev-browser acts on
  the repo), like #576.
- **Git-flow / PR-strategy** — author/project conventions. Per the conventions-fold-into-compliance ruling
  (#436/#437) WE never mandates them; defaults live in a project config extending the **platform default**
  (#579), compliance-enforced, bot-consumed. Not a decision — a vocabulary the bot *reads*.
- **Forge auth (raised as Fork 1, DISSOLVED on ratification 2026-06-14)** — a privileged forge-write action, but **not a
  winner-pick**: A (bridge auth) and B (App broker) co-exist as a **credential-source provider seam**
  selected by runtime context (twin of the forge provider registry). Demoted to "Supported by default." The
  security invariant (no long-lived browser credential → C fallback-only) and the per-context default are
  compliance-layer policy (#579). Couples to #410's authorization dial. Layer: **Plateau** (auth mechanism),
  no standard-owned contract — identity/signing ride the source.
- **PR evidence payload (Fork 2)** — the *machine-readable conformance evidence* is classified a
  **standard-owned self-description extension contract** (app-emits/tool-consumes; reuse the
  capability-manifest vocabulary), **not a Protocol** (no swappable-vendor interop). Plateau owns the
  rendering. Constellation split per #475/#091.
- **Conflict / revert / multi-repo** — mechanics derived from the resolver + the autonomy ladder; no
  on-merit fork.

### Near-invariant detail (the anchor, recorded in full)

The org's CI + review gate the merge, not the bot. The verify gate
([engine.mjs:229-247](../scripts/autofix/engine.mjs#L229)) proves the fix cleared *locally*; lint, tests,
type-check, static analysis / SonarQube (quality gate, coverage, no new smells), branch protection, and
required human review still gate it. *Which* gates apply is read from the compliance layer (#579). Auto-merge
is only reachable after every gate is green — the autonomy dial (#141/#410) *is* the merge dial.

### Relationships

- **Blocked by** #562 (source-awareness substrate — provides the resolver/bridge the PR step rides) and #141
  (the fix-loop itself). **Pairs with** #579 (Cluster B — the convention vocabulary this loop *reads*).
- **Couples to** #410 (authorization dial for the credential-source seam; audit record for the evidence-payload
  fork) and **reuses** #575's anchor-contract shape (the manifest, option A) and #576's bridge registry (the
  forge registry's twin).
- On ratification, the item **graduates to spin-off builds** via a `blockedBy` chain: the forge provider
  registry (Plateau), the credential-source provider seam (Plateau, A-first/B-hosted), and the
  conformance-evidence manifest contract (WE standard) + its Plateau renderer — sequenced after the v1
  fix-loop and bridge exist.

## Ruling (RATIFIED 2026-06-14)

1. **Invariant — ratified as written.** Generated code is **not privileged**: a bot fix runs the identical
   review + code-compliance gates as a human PR (lint, tests, type-check, quality gate, branch protection,
   required review); the autofix verify gate is necessary-not-sufficient; auto-merge only after all-green.
2. **Fork 1 (forge auth / bot identity) — DISSOLVED, not picked.** Fails the fork-existence test: A (bridge
   auth) and B (App broker) co-exist as a **credential-source provider seam** selected by runtime context —
   the twin of the forge provider registry. Demoted to *Supported by default.* Residuals are not forks: a
   **security invariant** (no long-lived browser credential → C fallback-only) + a **per-context default**,
   both compliance-layer policy (#579). Identity/signing ride the source.
3. **Fork 2 (PR evidence payload) — ratified A, built thin-first.** Mint a **standard-owned
   conformance-evidence manifest** (WE standard; app-emits/tool-consumes; reuse the capability-manifest
   vocabulary; **contract, not a Protocol**), Plateau renders it. Build order: ship **B's markdown rendering
   first** backed by the manifest contract, letting the renderer's real needs drive the contract's fields —
   don't over-build the manifest before a real fix-loop PR exists.
   **Sub-decision ratified:** the manifest is a **sibling self-description extension** reusing #410-4A's
   substrate (separation bias), **not** an additive field-set on the audit record — the audit record is
   who/when/diff/revert; the manifest is which-gates-ran / verify-before-after / autonomy-level.

Spin-off builds filed (each its own `blockedBy`-chained item, sequenced after the v1 fix-loop + bridge):
**(a)** [#598](/backlog/598-forge-provider-registry-abstract-open-a-pr-behind-a-per-forg/) forge provider registry
(Plateau; ⟵ #575); **(b)** [#600](/backlog/600-credential-source-provider-seam-bridge-auth-v1-github-app-br/)
credential-source provider seam (Plateau, A-first/B-hosted, compliance-read default; ⟵ #598); **(c)**
[#599](/backlog/599-conformance-evidence-manifest-standard-owned-contract-for-bo/) conformance-evidence manifest
contract (WE standard; ⟵ #575); **(d)** [#601](/backlog/601-pr-body-renderer-render-the-conformance-evidence-manifest-in/)
its Plateau PR-body renderer, thin markdown first (⟵ #599, #598).

**Hygiene follow-on:** because this ruling exercised the **fork-existence test** in anger (a false fork
dissolved into a provider seam), [#602](/backlog/602-fork-existence-test-sweep-find-single-solution-mandates-that/)
sweeps the rest of the standard for single-solution mandates the same test would reject.
