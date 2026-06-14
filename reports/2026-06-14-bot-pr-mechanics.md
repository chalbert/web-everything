# Bot-PR Mechanics — how the fix-loop opens a pull request

**Date**: 2026-06-14
**Point**: Prior-art survey grounding decision #578 (Cluster A of #562) — the VCS-interaction surface the
#141 fix-loop's *"act on the repo → open a PR"* step assumes. The survey collapses eight raised axes to
**one forced invariant + two genuine on-merit forks**; everything else is support-all-coherent (policy
dials read from the compliance layer, or mechanics derived from the resolver), mirroring how #562 ruled its
provider registries.
**Research page**: `/research/bot-pr-mechanics/`

---

## Question

The #141 fix-loop's last step — *report → propose → verify → **open a PR against the source repo*** — assumes
a whole bot-PR surface no item captured: how the browser/extension authenticates to the forge, what identity
and signature the commits carry, whether "open a PR" is forge-agnostic, what the PR body carries, how gate
parity is enforced, how conflicts/concurrency/revert/multi-repo targeting are handled. #562's prep surfaced
these as Cluster A (`needs-prep`). What does established bot-PR practice (Dependabot, Renovate, Copilot coding
agent) say, and which of these axes are *genuine decisions* vs. *support-all-coherent*?

## Recommendation

**One forced invariant (ratify), two genuine forks, the rest support-all.**

- **Invariant (ratify, not weigh): generated code is NOT privileged.** A generated fix runs the *identical*
  review + code-compliance gates as a human PR — lint, tests, type-check, static analysis / quality gate,
  branch protection, required human review — **no bypass path**. The autofix verify gate
  (`scripts/autofix/engine.mjs:229-247`) is *necessary but not sufficient*; the org's CI + review still gate
  the merge. *Which* gates apply is read from the compliance layer (#579), not asserted by the bot.
  Auto-merge (the #141/#410 autonomy ladder) is reachable only after every gate is green. Market autofix
  practice converges on exactly this (tests + re-scan *before* a PR is auto-opened; an autonomy ladder; a
  PR-body safety checklist incl. a revert plan), so it is a ratify, not an open call.

- **Fork 1 — Forge auth, bot identity & commit signing.** A browser/extension can't safely hold a GitHub-App
  private key, yet App installation tokens (short-lived ~1h, fine-grained, org-owned, own bot identity,
  API commits auto-signed) are the industry-recommended pattern over PATs (long-lived, user-tied). Genuine
  either/or on the *credential source*: **(A) reuse the IDE-bridge's existing git auth** (the #576/#577
  bridge is already authenticated — open the PR through it as the user) · **(B) a dedicated GitHub-App
  backend broker** (Plateau backend holds the App, mints short-lived installation tokens, opens the PR as a
  bot identity — the hosted/org-bot tier) · **(C) user OAuth/PAT entered into the browser** (rejected as
  primary — long-lived credential in the browser is an exposure surface). **Default: A for v1/local, B as
  the hosted-SaaS tier; C a fallback only.** Identity + signing *ride* the auth choice (App = bot identity +
  auto-signed; bridge = user identity + their git signing config), so they aren't a separate fork.

- **Fork 2 — PR evidence payload: a standard-owned conformance-evidence manifest vs. Plateau-formatted
  markdown.** The autofix gate already produces the failure + verify before/after (`engine.mjs`); #410 Fork
  4-A already rules an *audit record* rides the PR. The open call is whether WE **mints a standard contract**
  for the machine-readable conformance evidence the PR carries — emitted by the app's introspectable
  self-description / trace substrate (reusing the capability-manifest vocabulary, `capabilityMatrix.json:1`),
  the same app-emits/tool-consumes shape #575's anchor contract took — or leaves it as freeform Plateau PR
  markdown. **(A) mint the manifest** (standard-owned; Plateau renders it into the PR body; reaches the
  enterprise/polyglot fix-loops via the forward-adapter line) · **(B) freeform markdown only** (no contract;
  simplest; re-invents the payload per impl, no interop). **Default: A** — but it's a real judgment about
  whether to coin a standard here, so Med confidence.

- **Supported by default (not decisions):**
  - **Forge-agnosticism = a forge provider registry** (open-PR abstracted behind a per-forge provider;
    GitHub/GitLab/Gitea/Forgejo/Bitbucket). Support-all-coherent, exactly as #562 ruled its bridge registry —
    every provider used, precedence + degradation the only rules. Prior art is unambiguous (Renovate's
    `Platform` interface, Woodpecker's `forge.Forge`, git-pkgs/forge, go-git-providers). v1 ships the GitHub
    provider first — *prioritization, not a fork* (the end-state is the registry).
  - **Git-flow / PR-strategy policy dials** — draft-vs-ready, target branch, one-fix-per-PR vs. batched,
    rebase/squash/merge, auto-merge. Every value is coherent → configurable per project; *defaults* live in
    the compliance layer (#579, Cluster B), not picked here.
  - **Conflict & concurrency** (rebase-on-stale-base, detect-and-skip racing fixes), **revert/rollback** (a
    merged-bad fix is backed out by the same loop opening a normal revert PR through the same gates; autonomy
    gated per #410), **monorepo/multi-repo targeting** (derived from the resolver — the repo is wherever the
    resolved `file:line` lives; cross-repo → independent PR per repo, atomic-cross-repo-merge rejected as
    unsupported by forges) — all mechanics, not on-merit forks.

## Key Findings

1. **Bot-PR flow is a settled pattern.** Renovate/Dependabot: create a branch → commit the change → open a
   PR/MR. Draft-vs-ready, branch naming, and grouping (one-per-update vs. batched) are *configuration*, not
   architecture. Dependabot itself is a stateless library wrapped by proprietary coordination — i.e. the
   *mechanics* are the easy part; the *policy* (what to follow) is the configurable surface. → maps our
   git-flow axis to support-all policy dials + #579.

2. **GitHub Apps beat PATs for unattended automation** — short-lived installation tokens (~1h), fine-grained
   perms, org-owned (survives employee churn), a built-in bot identity, and API-made commits are
   automatically signed/verified. The catch for us: a *browser/extension* is a poor place to hold App private
   keys → the genuine fork is the **credential source** (bridge-delegation vs. backend-broker vs.
   user-token), not "App vs. PAT" in the abstract.

3. **Forge abstraction is a solved provider-interface pattern.** Renovate's `Platform`
   (`lib/modules/platform/types.ts`) abstracts GitHub/GitLab/Bitbucket/Azure/Gitea/Forgejo/Gerrit/CodeCommit;
   Woodpecker's `forge.Forge` keeps the core forge-agnostic; git-pkgs/forge + go-git-providers expose one
   interface across forges. This is the *same support-all provider-registry shape* #562 ratified for its
   resolver + bridge registries — so forge-agnosticism is a registry, not a winner-pick.

4. **Agent-PR gate parity is the 2025 consensus.** GitHub's Copilot coding agent opens PRs that run the
   *identical* branch-protection + required-checks gates; best practice separates "analysis" from "execution"
   with a human approval gate, and auto-merge only after green. → confirms #578's near-invariant as a ratify.

## Files Created/Modified

| File | Action |
|---|---|
| `reports/2026-06-14-bot-pr-mechanics.md` | created (this report) |
| `src/_data/researchTopics.json` | added `bot-pr-mechanics` entry |
| `src/_includes/research-descriptions/bot-pr-mechanics.njk` | created (write-up) |
| `backlog/578-…md` | rewritten to prepared-fork shape; `preparedDate` set; released to `open` |

## Sources

- [How Dependabot Actually Works — Andrew Nesbitt](https://nesbitt.io/2026/01/02/how-dependabot-actually-works.html)
- [Renovate — Platforms](https://docs.renovatebot.com/modules/platform/) · [GitLab Platform (DeepWiki)](https://deepwiki.com/renovatebot/renovate/3.2-gitlab-platform)
- [Woodpecker — Supported Forges (DeepWiki)](https://deepwiki.com/woodpecker-ci/woodpecker/4.1-supported-forges)
- [git-pkgs/forge — one interface across GitHub/GitLab/Gitea/Bitbucket](https://github.com/git-pkgs/forge)
- [Why GitHub Apps Are Better Than PATs for Automation](https://dev.to/patelaryan66/why-github-apps-are-better-than-personal-access-tokens-for-automation-1lg9) · [Deciding when to build a GitHub App — GitHub Docs](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app)
- [Agent pull requests are everywhere — The GitHub Blog](https://github.blog/ai-and-ml/generative-ai/agent-pull-requests-are-everywhere-heres-how-to-review-them/)
- [How to Build a Code Quality Gate for AI-Assisted Pull Requests](https://dev.to/137foundry/how-to-build-a-code-quality-gate-for-ai-assisted-pull-requests-2kbg)
