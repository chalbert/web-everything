---
type: decision
workItem: story
size: 5
status: open
blockedBy: ["562", "141"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
preparedDate: "2026-06-14"
locus: plateau-app
relatedReport: reports/2026-06-14-bot-pr-mechanics.md
crossRef: { url: /research/bot-pr-mechanics/, label: "Bot-PR mechanics research" }
tags: [dev-browser, fix-loop, git-integration, pr-mechanics, decision]
---

# Fix-loop git-integration — bot-PR mechanics (flow, forge-auth, agnosticism, gate parity)

## Digest

The fix-loop's *"act on the repo → open a PR"* step (the #141 PR step,
[#562](562-dev-browser-source-awareness-ide-bridge-map-deployed-dom-bac.md)'s downstream) assumes a whole
**VCS-interaction surface** no item captured — surfaced as #562's Cluster A. **No design existed yet**; this
prep surveyed established bot-PR practice (Dependabot, Renovate, GitHub's Copilot coding agent) and published
the [`bot-pr-mechanics`](/research/bot-pr-mechanics/) research topic. The survey **collapses the eight raised
axes** to **one forced invariant + two genuine on-merit forks**; the other five are *support-all-coherent*
(policy dials read from the compliance layer, or mechanics derived from the resolver) — exactly how #562
ruled its provider registries. The invariant (generated code is **not privileged** — identical gates, no
bypass) is a **ratify**. The two forks — **forge auth / bot identity** and **the PR evidence payload
(standard contract vs. Plateau markdown)** — each carry a **bold** default. Ratification, not research.

## Supported by default (not decisions — support all coherent)

Per the fork-existence test, five of the eight raised axes are **not** a decision — every coherent value is
supported; the only rules are defaults (which live in the compliance layer, #579) and degradation. They are
demoted out of the call (full detail in `## Context`):

- **Forge-agnosticism = a forge provider registry** — "open a PR" abstracted behind a per-forge provider
  (GitHub/GitLab/Gitea/Forgejo/Bitbucket), every provider used, precedence + degradation the only rules —
  the **same support-all ruling #562 gave its bridge registry** ([#576](576-ide-bridge-provider-registry-passive-file-line-jump-file-sys.md)).
  Prior art is unambiguous (Renovate's `Platform` interface, Woodpecker's `forge.Forge`, git-pkgs/forge,
  go-git-providers). v1 ships the **GitHub provider first** — *prioritization, not a fork* (the ruled
  end-state is the registry; *when* each provider lands is burndown ordering).
- **Git-flow / PR-strategy policy dials** — draft-vs-ready, target branch, one-fix-per-PR vs. batched,
  rebase/squash/merge, auto-merge. Every value is coherent → configurable per project; the **defaults live in
  the compliance layer** ([#579](579-platform-default-vcs-convention-vocabulary-in-the-compliance.md),
  Cluster B), *read* by the bot, never invented by it.
- **Conflict & concurrency** — rebase-on-stale-base, detect-and-skip racing fixes; the local-edit conflict is
  [#577](577-deep-two-way-vs-code-extension-emit-active-projects-coordina.md)'s concern. Mechanics, not a
  merit fork.
- **Revert / rollback** — a merged-bad fix is backed out by the same loop opening a **normal revert PR**
  through the same gates (no special privilege); autonomy-gated per #410's revertibility ruling.
- **Monorepo / multi-repo targeting** — derived from the resolver ([#575](575-source-anchor-self-description-contract-resolver-provider-re.md)):
  the repo is wherever the resolved `file:line` lives; cross-repo → **independent PR per repo** (atomic
  cross-repo merge rejected — forges don't support it).

## Forced invariant (ratify, not weigh) — generated code is NOT privileged

The anchor the rest hangs on. A generated fix runs the **identical review + code-compliance gates as a human
PR**: lint, tests, type-check, static analysis / quality gate (coverage, no new smells), branch protection,
required human review — **no bypass path**. The autofix **verify gate**
([scripts/autofix/engine.mjs:229-247](../scripts/autofix/engine.mjs#L229)) is *necessary but not sufficient*:
it proves the fix cleared the failure locally; the org's CI + review still gate the merge. *Which* gates
apply is **read from the compliance layer** (#579), not asserted by the bot. **Auto-merge** (the #141/#410
autonomy ladder — [#141 Fork 2](141-dev-browser-vision.md) ratified *default = open-PR*) is reachable **only
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
[:260-281](../tools/dev-panel/vite-plugin.ts#L260)). With the support-all axes demoted, **two orthogonal axes
remain a genuine call**: **(1) the credential source** — how a browser/extension authenticates to the forge
and what identity/signature the commits carry; and **(2) the PR evidence payload** — whether WE mints a
standard contract for the machine-readable conformance evidence the PR carries, or leaves it as Plateau
formatting. Both compose with already-resolved rulings (#410's authorization dial + audit record; #575's
anchor contract; #576's bridge registry), so the survey *narrowed* the surface rather than widening it.

### Recommended path at a glance

Ratify both rows, or override just the one you'd change. The **confidence** column says where judgment is
actually needed. (The forge registry + policy dials above the divider are *not* forks — they're
support-all-coherent.)

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · forge auth / bot identity** | reuse the IDE-bridge's git auth (v1); GitHub-App backend broker as the hosted tier | user OAuth/PAT in the browser | **Med-high** — App-vs-bridge is clear; browser context makes credential-source the real call |
| **2 · PR evidence payload** | standard-owned conformance-evidence manifest (app emits, Plateau renders) | freeform Plateau PR markdown only | **Med** — minting a standard here is a genuine judgment |

## Fork 1 — Forge auth, bot identity & commit signing

**Crux.** For unattended PR automation the industry-recommended pattern is a **GitHub App**: short-lived
installation tokens (~1h), fine-grained permissions, org-owned (survives employee churn), a built-in bot
identity, and API-made commits that are **auto-signed and verified** — strictly better than a long-lived,
user-tied PAT. But a **browser/extension is a poor place to hold an App private key**, so the genuine
either/or is the *credential source*, not "App vs. PAT" abstractly. Couples to
[#410 Fork 2](410-dev-browser-deployed-app-live-patch-gated-capability-safety-.md)'s authorization dial (a
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

**Default: A for v1/local, B as the hosted-SaaS tier; C a fallback only.** Identity and signing **ride** the
auth choice (App ⇒ bot identity + auto-signed; bridge ⇒ user identity + their signing config) — they are
*not* a separate fork. This mirrors #562's local-vs-hosted layering: the zero-credential bridge path ships
first; the bot-identity broker is the hosted tier.

## Fork 2 — PR evidence payload: standard-owned conformance-evidence manifest vs. Plateau markdown

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
*vocabulary* — is [#579](579-platform-default-vcs-convention-vocabulary-in-the-compliance.md)). The fix-loop's
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
- **Forge auth (Fork 1)** — a privileged forge-write action; the *credential source* is a genuine either/or
  (browser can't hold App keys). Couples to #410's authorization dial. Layer: **Plateau** (auth mechanism),
  no standard-owned contract — identity/signing ride the choice.
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
- **Couples to** #410 (authorization dial for Fork 1; audit record for Fork 2) and **reuses** #575's
  anchor-contract shape (Fork 2-A) and #576's bridge registry (the forge registry's twin).
- On ratification, the item **graduates to spin-off builds** via a `blockedBy` chain: the forge provider
  registry (Plateau), the chosen auth path, and the conformance-evidence manifest contract (WE standard) +
  its Plateau renderer — sequenced after the v1 fix-loop and bridge exist.
