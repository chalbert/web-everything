# Moving the three repos into a GitHub organization — research and coupling scan (2026-10-03)

Session: prepare-org-move. Card: `we:backlog/xvgqv8h-move-the-three-repos-into-a-github-organization.md`.
Read-only. No org was created, no setting changed, nothing transferred. No secret value was read or printed:
only secret NAMES and plist KEY names were listed.

Marks: **[V]** verified on the cited page today; **[M]** measured live on this machine or via read-only `gh api`;
**[U]** unverified (stated as inference).

Starting state assumed (operator, 2026-10-03 ~16:25 ET): **the empty company org exists (Free), no repo moved.**

## 1. Repo facts [M]

| repo | visibility | stars | forks | Pages | branch protection on `main` | rulesets | repo secrets (names) | webhooks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `chalbert/web-everything` | public | 0 | 0 | off | `test`, `smoke`, `daemon-soak`, `soak-replay-gate`; `enforce_admins` off | 0 | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `FUI_READ_TOKEN`, `NPM_TOKEN` | 1 → `we-pr-events.nicgilbert.workers.dev` |
| `chalbert/frontierui` | **private** | 0 | 0 | off | **none possible** (403 "Upgrade to GitHub Pro or make this repository public") | none possible (same 403) | none | 1 → same worker |
| `chalbert/plateau-app` | **private** | 0 | 0 | off | **none possible** (same 403) | none possible | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `FUI_READ_TOKEN`, `GATE_CODE`, `GATE_COOKIE_SECRET`, `WIP_PUBLISH_TOKEN` | 1 → same worker |

Deploy keys: 0 on all three. Environments: none on WE.

## 2. Plans and features [V unless marked]

- **Price.** Free $0; Team $4/user/month; Enterprise Cloud $21/user/month (labelled "for the first 12 months";
  later price [U]). https://github.com/pricing
- **Merge queue.** "available in any public repository owned by an organization, or in private repositories owned
  by organizations using GitHub Enterprise Cloud."
  https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
  - So a **Free org already gives WE (public) a merge queue**. **Team does NOT give one to FUI or plateau-app
    (private)** — only Enterprise Cloud does. User-owned repos are not in the list (explicit wording [U]; the
    #3732 report recorded the same gate on 2026-09-21).
- **Concurrent Actions jobs (standard runners).** Free 20 (5 macOS), Pro 40 (5), Team 60 (5), Enterprise 500 (50).
  https://docs.github.com/en/actions/reference/limits . Free-personal vs Free-org share one "Free" row [U as
  separate rows]; the limit is account/org-wide across all its repos (reading of "total concurrent jobs" [U]).
- **Minutes.** Public repos on standard runners: free. Private: Free 2,000, Team 3,000, Enterprise 50,000/month.
  https://docs.github.com/en/billing/concepts/product-billing/github-actions
- **Larger runners.** Team or Enterprise Cloud only; always billed, even for public repos.
  https://docs.github.com/en/actions/using-github-hosted-runners/using-larger-runners/about-larger-runners
- **Rulesets.** Public repos on Free/Free-org; public and private on Pro/Team/Enterprise.
  https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
  Org-level rulesets: "creating" page says Team or Enterprise; the "about" page says Enterprise — **docs
  conflict [U]**. https://docs.github.com/en/organizations/managing-organization-settings/creating-rulesets-for-repositories-in-your-organization
- **Bypass actors.** Repo admins/org owners, roles, teams, **GitHub Apps**, Dependabot; "for pull requests only"
  mode. REST `actor_type` also has `DeployKey`. https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository ·
  https://docs.github.com/en/rest/repos/rules
- **A private repo in a Free org** "will lose access to features like protected branches and GitHub Pages" — FUI
  and plateau-app have neither today, so Free org is no regression for them, but no gain either.
  https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository
- **Fine-grained PATs.** Resource owner can be an org; org default "Require administrator approval" (owner-made
  tokens auto-approved); default max lifetime 366 days. A PAT has exactly ONE resource owner.
  https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/setting-a-personal-access-token-policy-for-your-organization
- **GitHub Apps.** Install on "Only select repositories". A user-owned App set to "Only this account" cannot be
  installed on an org: make it public or **transfer the App to the org** (App id and keys kept; a new
  installation means a new installation id [U as wording]).
  https://docs.github.com/en/apps/maintaining-github-apps/transferring-ownership-of-a-github-app

## 3. API rate limits — per installation, per user, per `GITHUB_TOKEN` [V]

Source: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

| identity | primary limit |
| --- | --- |
| authenticated user (PAT, `gh` as the user) | 5,000 / hour |
| GitHub App **installation** | 5,000 / hour base, +50 per repo and +50 per user beyond 20, **cap 12,500** — **per installation** |
| App installation in an **Enterprise Cloud** org | **15,000 / hour** |
| App user-to-server token | counts against the user's 5,000 |
| `GITHUB_TOKEN` in Actions | **1,000 / hour per repository** (15,000 per repo on Enterprise Cloud) |

- **What CI actually uses [M].** No WE or plateau-app workflow mints a token from the `web-everything` App. CI
  calls the API with `GITHUB_TOKEN` (`we:.github/workflows/deploy.yml:90,117`,
  `we:.github/workflows/soak-replay-gate.yml:65`, `we:.github/workflows/stage-pr-view.yml:111`,
  `we:.github/workflows/apply-review-request.yml:99`). The App's credentials live only in the 14 daemon plists.
- **So today's "rate limit exceeded for installation" in CI is most likely the per-repo `GITHUB_TOKEN` bucket
  (1,000/h), not a bucket shared with the daemons.** `GITHUB_TOKEN` is itself an installation token of the
  GitHub Actions app, which is why its error reads "for installation" [U — inference from token type; the
  failing run's log was not pulled]. Moving to an org on Team does **not** raise that bucket; only Enterprise
  Cloud does (15,000/h/repo). A CI-owned App token does: 5,000–12,500/h on its own installation.
- **One App per role** therefore buys three separate buckets (CI, daemons, WIP publisher), each 5,000–12,500/h,
  and isolation: a runaway daemon cannot starve CI. Scaling is per installation, so three Apps each installed
  on the org triple the total.

## 4. What a transfer keeps and breaks [V unless marked]

Source: https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository

- **Kept:** issues, PRs, wiki, stars, watchers, commit history; webhooks, services, **secrets** and **deploy keys**
  "remain associated". Assignees who are not org members are cleared.
- **Numbers:** issue/PR numbers kept [U — not stated; follows from issues/PRs moving whole].
- **Redirects:** web and `git clone/fetch/push` redirect. **API redirect not stated [U]** — must be proved in the
  dry run because every daemon talks to the API through `gh --repo <slug>`.
- **Redirect killer:** creating a repo or fork with the old name at the old owner deletes the redirect for good.
- **Name retirement:** a repo with >100 clones or >100 Actions uses in the week before the move gets
  `OWNER/REPO` permanently retired at the old owner. WE's own CI checks out repos far more than 100 times a week,
  so assume **`chalbert/web-everything` and `chalbert/frontierui` get retired** — rollback by transferring back
  to the same name may be impossible [U].
- **Pages:** not redirected (none of the three uses Pages — no impact).
- **Packages:** ghcr packages belong to the account; they stay with the user. None in use here [U — not audited].
- **Not stated [U]:** environments, Actions variables, rulesets and branch protection carrying over, App
  installation carrying over. Treat all as "re-check after transfer".
- **Org Actions defaults for new orgs:** `GITHUB_TOKEN` read-only for contents/packages; "Allow GitHub Actions to
  create and approve pull requests" **off** → release-please cannot open its PR until an org owner turns it on.
  https://docs.github.com/en/organizations/managing-organization-settings/disabling-or-limiting-github-actions-for-your-organization
- **npm provenance:** the package manifest must carry "a public `repository` that matches (case-sensitive) where
  you are publishing with provenance from." https://docs.npmjs.com/generating-provenance-statements .
  Real E422 text ("Failed to validate repository information ... expected to match ... from provenance"):
  https://github.com/DeviceFarmer/STFService.apk/pull/193 . `we:contracts/package.json:9` names
  `chalbert/web-everything` → the first release-please publish after the move 422s unless updated in the same
  cut-over. A trusted-publisher entry on npmjs.com (if used) also names the owner [U for transfers].

## 5. Our own coupling — the slug count [M]

Counted with `git grep -I -w` on each checkout's tracked files (the npm lockfile excluded).

| place | `chalbert/<repo>` slug hits | files | notes |
| --- | --- | --- | --- |
| WE, all tracked | 2,948 (WE 2,532 · FUI 185 · PA 231) | — | dominated by history: `we:backlog/` 1,240 hits / 590 files; tests about 1,700 |
| **WE, live non-test code + docs** | **234** | **96** | scripts 168 / 66 files · workflows 8 / 3 · JSON 19 / 7 · Python 11 / 1 · Rust 1 · prose 24 / 15 |
| WE, bare `chalbert` (login, not owner) | 11 | — | e.g. `we:scripts/lib/marker-authorship.mjs:87` operator-login default — the **login does not change**; leave |
| FUI | 4 | 4 | `fui:.github/workflows/ci.yml:44` (checks out WE), 2 `@see` comments, `fui:src/_data/site.js:18` |
| plateau-app | 95 | 26 | 9 in workflows (checkouts of WE+FUI), `plateau:scripts/wip-publish.ts:54`, rest tests/docs |
| `~/Library/LaunchAgents` | **0** | — | but **14 plists** carry the same `WE_GITHUB_APP_INSTALLATION_ID` (one value) — it changes on org install |
| WIP relay/publisher config (`~/.config/plateau-app`) | 0 | — | keys `WIP_PUBLISH_TOKEN`, `WIP_RELAY_URL` only |
| App token shim (`~/.claude/github-app-token`) | 0 | — | the cache file holds an `installationId` that rotates with the plists |

**Single source already exists:** `we:scripts/lib/constellation-repos.mjs:35-39` (`CONSTELLATION_REPOS`, imported
by 66 scripts). About 60 other script files carry their own literal. Highest counts:
`we:scripts/conveyor/reconcile-core.mjs` 17, `we:scripts/operator/dispatch.mjs` 11,
`we:scripts/conveyor/parked-pr-conflict-watch.mjs` 10, `we:scripts/merge-ai-prs.mjs` 9.

**Silent-failure sites (worse than a crash):**
- The PR-events worker keys every event by `payload.repository.full_name`
  (`we:scripts/conveyor/pr-events-worker/core.mjs:81`) and consumers filter by a repo list
  (`we:scripts/lib/pr-events.mjs:124`). After the move, events arrive as `<org>/web-everything`; a filter still
  holding `chalbert/web-everything` **drops them without error**.
- `FUI_READ_TOKEN` (WE and plateau-app secrets) is a fine-grained PAT whose resource owner is the user. Once FUI
  is org-owned the PAT cannot see it: every CI and deploy checkout of FUI (`we:.github/workflows/ci.yml:103`,
  `:176`, `:376`, `:468`, `:582`; `we:.github/workflows/deploy.yml:163`) fails.
- `we:contracts/package.json:9` repository url → npm E422 on the next release.

## 6. Prior art for the "owner as config" shape

- GitHub Actions exposes `github.repository_owner` / `github.repository` as context — the native way for a
  workflow to name its own owner instead of a literal.
- `gh` resolves the repo from the checkout's `origin` remote when `--repo` is absent.
- The repo's own `config-extends-platform-default` rule was considered and set aside after the skeptic pass: who
  owns a repo is one fact, not a strategy, so this is single-sourcing in the constellation table.

## 7. Addendum (operator input ~16:40 and ~16:50 ET): Enterprise Cloud, EMU, terms, spin-out [V unless marked]

- **Concurrency re-verified:** Enterprise 500 standard (50 macOS) vs Team 60. https://docs.github.com/en/actions/reference/limits
  Per-org vs shared across an enterprise's orgs: not stated [U].
- **Rate limits re-verified:** App installation 15,000/h on Enterprise Cloud; `GITHUB_TOKEN` 15,000/h per repo on
  Enterprise Cloud (1,000 otherwise). https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- **EMU:** "Managed user accounts can contribute only to private and internal repositories within their
  enterprise and their own private repositories." "Only private and internal repositories can be created in
  organizations owned by an enterprise with managed users." "Managed user accounts cannot create gists."
  https://docs.github.com/en/admin/managing-iam/understanding-iam-for-enterprises/abilities-and-restrictions-of-managed-user-accounts
  → EMU cannot host public WE; personal accounts it is.
- **Terms of Service §H (API Terms):** "You may not share API tokens to exceed GitHub's rate limitations."
  "Abuse or excessively frequent requests to GitHub via the API may result in the temporary or permanent
  suspension of your Account's access to the API." §B: "One person or legal entity may maintain no more than one
  free Account (if you choose to control a machine account as well, that's fine, but it can only be used for
  running a machine)." https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
- **Acceptable Use Policies:** no clause on multiple Apps; §4 forbids "automated excessive bulk activity".
  https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies
  Stance: one App per distinct role is fine; clones of one role to multiply buckets is the §H circumvention.
- **App transfer:** "You can transfer apps from a user or organization to another account. You cannot transfer
  ownership to a team." Whether id, keys and installations survive: not stated [U].
  https://docs.github.com/en/apps/maintaining-github-apps/transferring-ownership-of-a-github-app
- **Spin-out:** a later org-to-org repo transfer follows the same transfer page. Not legal advice: code ownership
  is set by contract between the people and companies involved, not by which org hosts the repo.
- **Skeptic findings verified in code:** `REQUIRED_APP_REPOS` at `we:scripts/lib/github-app-auth-env.mjs:63`
  requires one installation covering all three slugs; PR-events rows keyed by lowercased slug at
  `we:scripts/conveyor/pr-events-worker/core.mjs:111`; the merge-queue build is deferred by the
  `event-driven-land-is-wake-only` anchor (`we:docs/agent/platform-decisions.md:3730`).
