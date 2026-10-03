---
kind: decision
status: open
scaffoldedBy: "prepare-org-move"
dateScaffolded: "2026-10-03"
dateOpened: "2026-10-03"
preparedDate: "2026-10-03"
preparedAgainstSha: "177d3e9d601aac947abac7325fc93ef1c887dbe0"
relatedTo: ["3732", "3532", "3423", "2152"]
relatedReport: reports/2026-10-03-github-org-move-prior-art.md
tags: [github, organization, enterprise, actions, github-app, rate-limits, cut-over]
---

# Decision: move the three repos into a GitHub organization (one company org now, owner single-sourced)

Operator intent (2026-10-03 ~16:15 ET, verbatim): *"So I am thinking of creating an org for my company for now with
all 3 repos under, might move the open source under their own org later."* Amendments the same evening:
~16:25 ET — **one GitHub App per role**, each with its own installation and rate bucket, and **the empty company
org will exist before the move** (starting state: org exists on Free, no repo moved); ~16:40 ET — the
orchestrator recommends **Enterprise Cloud with personal accounts (not EMU)** over Team; the org is created under
the operator's consulting company, and **Plateau may later spin out into its own company**.

*Prepared 2026-10-03 (session prepare-org-move).* Research topic:
[/research/github-org-move/](/research/github-org-move/). Session report:
`we:reports/2026-10-03-github-org-move-prior-art.md` (every claim marked verified, measured or unverified, with
its source). Read-only prep: no org created, no setting changed, nothing transferred, no secret value read.

**What this card delivers, and what it does not.** Delivers: a ruled plan for the move — org shape, Enterprise
account type, bot identities — plus a cut-over runbook and the single-sourcing that makes a later move a
one-value edit. Does **not** deliver: the move itself (creating Apps, transferring repos, changing plan or org
settings are operator-run steps, never agent actions); **turning on the merge queue** (the org makes it
*available*; turning it on is governed by `#event-driven-land-is-wake-only` clause 3 and must be reconciled with
`#backlog-ids-numbered-before-publish`'s land-lock check — a separate call); **turning on Rung 2** (that is knob
#3532's own change).

## FOUND (measured or verified 2026-10-03)

- **Visibility.** `chalbert/web-everything` is public. `chalbert/frontierui` and `chalbert/plateau-app` are
  **private**, and on a Free personal account they cannot have branch protection or rulesets at all (`gh api`
  returns 403 "Upgrade to GitHub Pro or make this repository public"). WE's `main` requires `test`, `smoke`,
  `daemon-soak`, `soak-replay-gate`; no rulesets; no deploy keys; one webhook per repo to the PR-events worker.
- **Merge queue.** GitHub: "available in any public repository owned by an organization, or in private
  repositories owned by organizations using GitHub Enterprise Cloud." A Free org already makes it available on
  WE; Team adds nothing for the private repos; Enterprise Cloud adds FUI and plateau-app.
- **Concurrent Actions jobs (standard runners), verified:** Free 20, Pro 40, Team 60, **Enterprise 500**
  (macOS 5 / 5 / 5 / 50). Whether the 500 is per org or shared across an enterprise's orgs is not stated
  (unverified). Operator-reported pain today: 116 runs queued at the Free limit of 20.
- **API rate limits, verified (REST rate-limit docs):** user 5,000/h. App installation 5,000/h, scaling to a
  12,500/h cap, **per installation**; **15,000/h per installation on Enterprise Cloud**. `GITHUB_TOKEN`
  **1,000/h per repo**; **15,000/h per repo on Enterprise Cloud**.
- **CI does not use the App today.** Every API-calling workflow step uses `GITHUB_TOKEN`
  (`we:.github/workflows/deploy.yml:90`, `we:.github/workflows/soak-replay-gate.yml:65`,
  `we:.github/workflows/stage-pr-view.yml:111`). The `web-everything` App's credentials live only in 14 daemon
  plists. So today's CI "rate limit exceeded for installation" is most likely CI's own per-repo `GITHUB_TOKEN`
  bucket (1,000/h), not one shared with the daemons (unverified: the failing run's log was not pulled). Enterprise
  Cloud raises that exact bucket to 15,000/h.
- **The WIP publisher has no App.** `com.plateau.wip-publisher` runs `npm run wip:publish` with the operator's
  own `gh` login, so it spends the operator's personal 5,000/h.
- **EMU forbids public work, verified.** Managed user accounts "can contribute only to private and internal
  repositories within their enterprise", cannot push or open issues/PRs outside it, and "Only private and
  internal repositories can be created in organizations owned by an enterprise with managed users."
- **The slug count.** Live WE code and docs: **234 `chalbert/<repo>` literals in 96 files** (scripts 168 in 66
  files, workflows 8 in 3, JSON 19, Python 11). FUI: 4. plateau-app: 95 in 26 files (9 in workflows). LaunchAgents,
  WIP publisher config and the token shim: 0 slugs, but **14 plists share one `WE_GITHUB_APP_INSTALLATION_ID`**,
  which changes when the App is installed on the org. History (`we:backlog/`, tests, reports) adds about 2,700
  more and stays as written. A single source exists — `we:scripts/lib/constellation-repos.mjs:35`
  (`CONSTELLATION_REPOS`, imported by 66 scripts) — and about 60 other files bypass it.
- **Silent breaks.** (1) PR-events records carry `payload.repository.full_name`
  (`we:scripts/conveyor/pr-events-worker/core.mjs:81`), stored rows are keyed by the lowercased slug
  (`we:scripts/conveyor/pr-events-worker/core.mjs:111`), and consumers filter by repo list
  (`we:scripts/lib/pr-events.mjs:124`): after the move a filter on the old slug drops every event with no error,
  and open PRs need re-import under the new slug. (2) `FUI_READ_TOKEN` is a fine-grained PAT owned by the user;
  it cannot see an org-owned FUI, so every sibling checkout (`we:.github/workflows/ci.yml:103`,
  `we:.github/workflows/deploy.yml:163`, plateau-app's `deploy-alpha` and `destroy-alpha`) fails. (3)
  `we:contracts/package.json:9` names the old repo; npm provenance requires an exact, case-sensitive match, so the
  next publish fails with E422. (4) `REQUIRED_APP_REPOS` (`we:scripts/lib/github-app-auth-env.mjs:63`) demands
  one installation covering all three slugs; while the repos sit under two owners no single installation does,
  so every daemon falls back to the operator's personal auth.
- **Transfer facts.** Issues, PRs, stars, webhooks, secrets and deploy keys move. Web and git URLs redirect; the
  API redirect is not documented. A repo with more than 100 clones or Actions uses in the prior week has its old
  `owner/name` retired for good, so **WE cannot come back to `chalbert/web-everything`**. New orgs default
  `GITHUB_TOKEN` to read-only and switch off "Allow GitHub Actions to create and approve pull requests", which
  release-please needs. A GitHub App registration can be transferred "from a user or organization to another
  account" (verified); whether its id and keys survive is not stated.

## Recommended path at a glance

| fork | question | **default** | main alternative |
| --- | --- | --- | --- |
| 1 | org shape now | **(a) one company org with all three repos** | (b) an open-source org now as well |
| 2 | Enterprise account type | **(a) Enterprise Cloud with personal accounts** | (b) Enterprise Managed Users |
| 3 | bot identities | **(c) one org-owned App per role; the drain App is created but not yet a bypass actor** | (b) one App for everything |

Plan level and cut-over order are **not forks** (the fresh-context screen flagged them as budget and runbook
detail); they are recorded below as a setting and a runbook default.

## Supported by default — not forks

- **Plan level is a budget setting, default Enterprise Cloud.** With cost set aside (the operator calls it
  negligible against token and hardware spend), Enterprise Cloud beats Team on every axis that matters here:
  500 vs 60 concurrent jobs, 15,000/h per App installation and per-repo `GITHUB_TOKEN` vs 12,500 and 1,000, and a
  merge queue available on private repos. Team stays the fallback if cost ever matters; downgrade is a billing
  change. Upgrade path at cut-over: Free → Enterprise Cloud (trial or paid) before the first transfer.
- **The owner is single-sourced (not a config dimension).** Who owns a repo is one fact, not a strategy, so this
  is single-sourcing, not `#config-extends-platform-default`. The constellation table carries an `owner` per repo
  with one shared value; every slug, sibling checkout and filter reads it. Sibling checkouts read the **sibling's**
  owner, never `github.repository_owner` — after an open-source split, WE and FUI may sit under different owners.

  ```js
  // we:scripts/lib/constellation-repos.mjs — one owner value; per-repo override for a later split or spin-out
  const OWNER = 'chalbert'; // the ONE value each cut-over step edits
  const REPOS = {
    we:            { name: 'web-everything', slugTag: '',    path: '', dirs: ['web-everything', 'webeverything'] },
    frontierui:    { name: 'frontierui',     slugTag: 'fui', path: '$HOME/workspace/frontierui', dirs: ['frontierui'] },
    'plateau-app': { name: 'plateau-app',    slugTag: 'pa',  path: '$HOME/workspace/plateau-app', dirs: ['plateau-app'] },
  };
  export const CONSTELLATION_REPOS = Object.freeze(Object.fromEntries(Object.entries(REPOS).map(([k, r]) => {
    const owner = r.owner ?? OWNER;
    return [k, Object.freeze({ ...r, owner, slug: `${owner}/${r.name}` })];
  })));
  ```

  ```yaml
  # a sibling checkout — owner from a repo variable set per repo, never assumed equal to this repo's owner
  - uses: actions/checkout@v4
    with: { repository: '${{ vars.FUI_SLUG }}', path: frontierui, token: '${{ steps.ci-app.outputs.token }}' }
  ```

  A `check:standards` rule refuses a new `chalbert/<repo>` literal in live WE code outside the table. plateau-app
  cannot import WE's table, so it carries its own one-line owner constant and the same guard in its own gate.
  History files keep their old links; redirects serve them.
- **The App installation is looked up per repo, not pasted.** Each daemon asks GitHub for the installation on
  each repo it needs (`GET /repos/{owner}/{repo}/installation` with the App's JWT) and accepts a **set** of
  installations as covering `REQUIRED_APP_REPOS`, instead of reading one `WE_GITHUB_APP_INSTALLATION_ID` from 14
  plists. That makes the mixed-owner window safe (silent break 4) and makes the rotating id need no edit.
- **The operator login stays `chalbert`.** The 11 bare `chalbert` uses (for example the operator-login default at
  `we:scripts/lib/marker-authorship.mjs:87`) name a person, not an owner.
- **Org settings the move needs anyway:** allow Actions to create and approve PRs (release-please); set
  `GITHUB_TOKEN` defaults to match today's per-workflow `permissions:` blocks; replace `FUI_READ_TOKEN`; update
  `we:contracts/package.json:9` in the same PR as WE's owner flip (publishing authenticates with `NPM_TOKEN`, not a
  trusted publisher, so no npmjs.com change is needed).
- **One App per role is within GitHub's terms; clones of one role are not.** Terms of Service §H (API Terms):
  "You may not share API tokens to exceed GitHub's rate limitations." and "Abuse or excessively frequent
  requests to GitHub via the API may result in the temporary or permanent suspension of your Account's access to
  the API." §B allows a machine account "only ... for running a machine". The Acceptable Use Policies have no
  clause on multiple Apps; they forbid "automated excessive bulk activity". Stance: one App per **distinct role**
  (CI, drain, review/fix daemons, WIP publisher) separates duties and is fine; minting extra Apps or
  installations for the **same** role to multiply rate buckets is the circumvention §H targets, and we do not do
  it. The guard: the App roster is a declared table, one row per role.
- **Future spin-out of Plateau.** Moving plateau-app later from the consulting company's org to a new company's
  org is the same transfer as this one (repo-to-org), and an App registration can be transferred to another
  account. With the owner single-sourced it is a one-value edit for plateau-app. Not legal advice: **who owns the
  code is set by contract** (assignment or licence between the operator, the consulting company and any new
  company), not by which GitHub org hosts the repo; record that agreement before the spin-out, whatever the org
  placement.
- **Where the ruling is recorded.** `we:docs/agent/platform-decisions.md` already holds tooling anchors
  (`#pr-flow-rollout-mechanism`, `#repo-drain-check-contract`), so the new anchor goes there, titled as a
  repo-hosting and tooling rule, not a standard rule.

## Fork 1 — One company org now, or an open-source org as well

*Fork-existence:* WE's first move is either into the company org (and later out again) or straight into an
open-source org; both cannot be the first move.

- **(a) One company org now, all three repos; the open-source split later (operator's lean).** One set of App
  installations; no cross-org tokens (WE CI reads private FUI inside one org); one cut-over. Costs a second
  transfer of WE later, retiring `<company>/web-everything` too.
- **(b) Two orgs now: an open-source org (WE, and FUI once public) and the company org (plateau-app).** WE moves
  once and its public identity is never tied to the consulting company's name. But which repos are open source is
  not yet decided (FUI is private today), so the open-source org's shape would be guessed now. Cross-org reads of
  private FUI need an App installed on both orgs.

**Default: (a) — one org now, a second org later, both under one enterprise.** Operator input 2026-10-03
~16:50 ET: Enterprise Cloud with personal accounts, owned by the consulting company; ONE org for now, working
name `plateauapp` (final name to come), holding all three repos; an open-source org may be added under the same
enterprise later (see *Later: a second org for WE and FUI* below). Rested on merit, not cost: the open-source boundary is an undecided call (is FUI open? under
what name?), and (b) pre-decides it; (a) keeps every cross-repo read inside one org. The second move's cost is
made small by single-sourcing.

Skeptic: SURVIVES-WITH-AMENDMENT — attack: "the later split is one value" was false while sibling checkouts
used `github.repository_owner`. Amendment folded in: sibling owners come from the table or a per-repo variable.
Earlier amendment kept: split **before** the company-org URL appears in published docs; trigger = first external
contributor or first public announcement of WE, whichever comes first.
Screen: flagged(prio) → fixed: the "Free org caps WE at 20 jobs" cost argument is dropped; the default now rests
on the undecided open-source boundary and in-org reads.

## Fork 2 — Enterprise account type: personal accounts or Enterprise Managed Users

*Fork-existence:* an enterprise is created as one or the other, and EMU is broken for this constellation: it
cannot hold public repositories and its users cannot contribute to public repos outside the enterprise.

- **(a) Enterprise Cloud with personal accounts.** The operator keeps `chalbert`; public WE stays public; outside
  contributors use their own accounts.
- **(b) Enterprise Managed Users.** Identity from an IdP, accounts owned by the company. Verified: "Only private
  and internal repositories can be created in organizations owned by an enterprise with managed users." WE is
  public, so it could not live there.

**Default: (a).** (b) is excluded outright by WE being public, and by the open-source plan for FUI.

Skeptic: SURVIVES — attack: "EMU's central identity helps a spin-out". Rejected: a spin-out moves repos between
orgs either way, and EMU would forbid the public repos that motivate the split.
Screen: clear (on merit, EMU cannot host a public repo).

## Fork 3 — Bot identities: one App per role, and the drain's App

*Fork-existence:* a ruleset bypass names an identity; if the drain shares its App with every daemon, any later
bypass covers every daemon, so "one shared App" and "a drain-only identity" cannot both hold.

- **(a) A new App for the drain only; everything else on the existing App.** A distinct drain identity; one
  shared bucket for the rest.
- **(b) The existing `web-everything` App, moved to the org, for everything.** Least work; one bucket; no
  separable drain identity.
- **(c) One org-owned App per role (operator amendment).** The existing App moves to the org as the **review/fix
  daemons** App. New Apps: **drain**; **CI** (contents read on FUI only, replacing `FUI_READ_TOKEN`, minted with
  `actions/create-github-app-token`); **WIP publisher** (off the operator's login). Each has its own
  installation, so its own 15,000/h bucket on Enterprise Cloud.
- **(d) A machine user account.** A seat, a PAT, and 5,000/h. Rejected: Apps are the documented bypass actor and
  scale per installation.

**Default: (c), with three limits.** (1) The drain App is created and used for the drain's writes, but it is
**not** added as a bypass actor by this card — that is turning on Rung 2, which is knob #3532's own change; when
#3532 does it, the human stays a bypass actor too (break-glass and the human's direct path). (2) CI keeps
`GITHUB_TOKEN` for writes: on Enterprise Cloud that bucket is 15,000/h per repo, and an App token would start
other workflows where `GITHUB_TOKEN` deliberately does not (`we:.github/workflows/release-please.yml:15`). (3)
No second App for the same role.

**Composes with #3866** (prepared, open: a dedicated credential so fleet `gh` calls stop spending the operator's
personal 5,000/h). This fork does not re-decide #3866; it supplies the org-owned Apps #3866's credential would
be. If #3866 is ratified first, its credential becomes the daemons App here.

```yaml
# option (c) of the bot-identity fork: CI App, read-only on FUI, replacing the user-owned FUI_READ_TOKEN PAT
- id: ci-app
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.CI_APP_ID }}
    private-key: ${{ secrets.CI_APP_PRIVATE_KEY }}
    owner: ${{ vars.FUI_OWNER }}
    repositories: frontierui
```

Skeptic: SURVIVES-WITH-AMENDMENT — attacks: naming the drain the bypass actor silently flips Rung 2 and drops the
human (statute overlap with #3423 / #3532); an App key in a public repo's secrets outlives a per-run
`GITHUB_TOKEN`; App tokens re-trigger workflows. Amendments folded in as limits (1)–(3); the CI App is read-only
on one private repo, so a leaked key reads FUI and nothing else.
Screen: clear (merit remains at zero cost: bypass scope, bucket isolation, key blast radius).

## Runbook default — cut-over order (not a fork)

Options laid out: (a) all three at once; (b) one repo per step, one night, a gate between steps; (c) one repo
per night. **Default (b): plateau-app → frontierui → WE.** plateau-app first: nothing else checks it out, so a
break stays local. FUI second: proves WE CI (still user-owned) reading org-owned FUI with the CI App. WE last:
it has the npm publish, the drain and the only certain name retirement. This is a transfer order, not the
impl-first landing rule.
Skeptic: SURVIVES-WITH-AMENDMENT — attack: "a stopped sequence is a safe resting state" was false because of
`REQUIRED_APP_REPOS`; amendment: the per-repo installation lookup must land before the night.
Screen: flagged(impl) → fixed: moved out of the forks into the runbook (build story 5).

## Cut-over checklist (operator-run; starting state: empty company org exists on Free)

**Before the night (agent-buildable, lands while still user-owned; behaviour unchanged):**
1. Owner single-sourced (WE table, plateau-app constant) + literal guards.
2. Per-repo installation lookup; a set of installations satisfies `REQUIRED_APP_REPOS`.
3. Workflows read sibling slugs from per-repo variables; the CI App step behind `vars.CI_APP_ID`, falling back
   to `FUI_READ_TOKEN` (not `GITHUB_TOKEN`, which cannot read private FUI) while unset.
4. PR-events consumers read their repo list from the table; a re-import path for open PRs under a new slug
   (`we:scripts/conveyor/pr-events-worker/bootstrap.mjs`).
5. A scripted remote audit that `git remote set-url`s every checkout: the three primaries, every lane clone, the
   drain's dedicated clone.

**D. Dry run (a night before):** two throwaway repos under `chalbert` (one public, one private, with a webhook,
one secret, a release-please config). Transfer both to the org. Prove: git and web redirect; `gh api
repos/chalbert/<throwaway>` follows the undocumented API redirect; secrets and webhook survived; a cross-owner
checkout with the CI App works; release-please opens its PR once the org setting is on; **an App moved to the
org stays usable on the user account's repos** (if not, move the App last). Transfer one back to prove rollback
on a repo with no clone history. Delete the throwaways from the org only; never recreate a name at the old owner.

**The night (America/New_York, after 23:00):**
1. Kill switch on: `node we:scripts/readiness/dispatch-pause.mjs set --reason=org-move`; let the drain empty the
   queue; stop the drain daemon. No open `ready-to-merge` PR.
2. Upgrade the org (working name `plateauapp`) from Free to Enterprise Cloud with personal accounts, the
   enterprise owned by the consulting company.
3. Org settings: Actions may create and approve PRs; `GITHUB_TOKEN` defaults; fine-grained PAT policy.
4. Install the new drain, CI and WIP-publisher Apps on the org (selected repositories). Move the existing App
   per the dry-run result.
5. **plateau-app:** transfer → flip its owner value → remote audit → check: secrets present (`WIP_PUBLISH_TOKEN`,
   `GATE_*`), webhook fires, CI green on a no-op PR, `deploy-alpha` and `destroy-alpha` check out WE and FUI.
   Go/no-go.
6. **frontierui:** same; plus WE CI (still user-owned) reads org-owned FUI with the CI App. Go/no-go.
7. **WE — point of no return:** `chalbert/web-everything` will be retired; say go knowing there is no way back to
   that name. Transfer; flip the owner value with `we:contracts/package.json:9` in the same PR; re-import open PRs
   into the PR-events worker; re-verify the fork guard in `we:.github/workflows/deploy.yml`
   (`head_repository.full_name` vs `repository`) and any Cloudflare dashboard Git link; the drain's next merge
   records under the drain App.
8. Refresh daemon caches (`~/.claude/github-app-token`, daemon self-sync state); restart daemons; clear the kill
   switch (`node we:scripts/readiness/dispatch-pause.mjs clear`); watch one full drain cycle.

**Not on this checklist, on purpose:** turning on the merge queue (see "does not deliver"); adding a bypass actor
(#3532); making `backlog-ids` a required check (after the move, under #3732's own setup step); private-repo
branch protection on FUI and plateau-app (waits for #3532, because a required-PR rule blocks the drain while it
merges with the human's credential, `#pr-flow-rollout-mechanism` / #2152).

**Rollback:** stop at the failed step; earlier repos stay moved and work (owner is per repo, installations are
looked up per repo). For plateau-app or FUI: transfer back to `chalbert` and flip the owner value (the dry run
proved the path; a retired name would block it, so check the clone count first). For WE after step 7: no
rollback to the old name; fix forward in the org.

## Later: a second org for WE and FUI (config change + transfer)

The design above is built so this is a config change plus a transfer, not a second migration:

1. Create the open-source org under the **same enterprise** (concurrency and billing stay in one place; whether
   the 500-job limit is shared across the enterprise's orgs is unverified — check before relying on it).
2. Install the CI and daemons Apps on the new org too (selected repos). App installations are per org, and the
   per-repo installation lookup already accepts a set of installations.
3. Same night shape: kill switch on, queue empty. Transfer FUI, then WE.
4. Config change only: set `owner` on the `we` and `frontierui` rows of the constellation table (and plateau-app's
   constant), update the per-repo sibling-slug variables (`vars.FUI_SLUG` etc.), and update
   `we:contracts/package.json:9`. No literal anywhere else changes; the literal guard proves it.
5. Run the remote audit and the PR-events re-import, as in steps 5–8 of the night above. Cross-org reads of
   private FUI (if FUI is still private) use the CI App's installation on the new org.

## What ratifying files

Ratification records Forks 1–3 in `we:docs/agent/platform-decisions.md` (a repo-hosting tooling anchor, composing
with `#backlog-ids-numbered-before-publish`, `#event-driven-land-is-wake-only`, `#pr-flow-rollout-mechanism` and
the #3532 rung knob) and files:

1. **Owner single-sourced + literal guard** — scope `we:scripts/lib/constellation-repos.mjs`,
   `we:scripts/conveyor/`, `we:scripts/operations/`, `we:scripts/check-standards-rules.mjs`.
2. **Per-repo installation lookup** — scope `we:scripts/lib/github-app-auth-env.mjs`, `we:scripts/lib/gh-app-shim.mjs`.
3. **Workflows read sibling slugs + CI App** — scope `we:.github/workflows/`, `fui:.github/workflows/`,
   `plateau:.github/workflows/`.
4. **PR-events slug re-key; WIP publisher on its App; plateau-app owner constant** — scope
   `we:scripts/lib/pr-events.mjs`, `we:scripts/conveyor/pr-events-worker/`, `plateau:scripts/`.
5. **The cut-over runbook as a `setup` operation** (the checklist above, plus the remote audit) that refuses to run
   while the queue is not empty.

## Done when

1. **Executable** — ratification records the forks in `we:docs/agent/platform-decisions.md`, links this card via
   `codifiedIn`, and files the build stories above. `npm run check:standards` validates those artifacts.
2. **Checked after the move, by the runbook operation:** a grep of live code for `chalbert/<repo>` finds only the
   owner constants, and changing one owner value is the whole code change for a later split or spin-out.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
