# Branch-protection enforcement of the sole-writer invariant — prior-art + fact-check

**Session report backing [`xgbtds5`](/backlog/xgbtds5-branch-protection-enforcement-of-the-sole-writer-invariant-p/)
(carved from #3373's "Done when" item 2).** Not a new web/UX standard — this is an operational/infra decision about
GitHub branch protection and this repo's own merge-authority architecture, so "prior art" means: how do comparable
serial-writer/bot-merge systems configure branch protection + admin bypass, and what does GitHub's own platform
actually support on *this* repo (its plan, its ownership type, its collaborator list) — checked live, not assumed.

## Live facts checked on this repo (2026-08-31)

- `gh api repos/chalbert/web-everything` → `"owner":{"login":"chalbert","type":"User"}`, `"visibility":"public"`.
  The repo is owned by a **personal user account**, not a GitHub organization.
- `gh api repos/chalbert/web-everything/collaborators` → exactly **one** entry: `chalbert`. No second human, no
  bot/machine user, no installed GitHub App with write access.
- `gh auth status` → the local `gh` CLI (the same one `we:scripts/merge-ai-prs.mjs` / `we:scripts/pr-land.mjs`
  shell out through) is authenticated as `chalbert`. `we:scripts/lib/pr-merge-gate.mjs`'s `mergePr()` never passes
  `--admin`; the drain's merges are ordinary non-admin `gh pr merge` calls riding this same account's credential.
- `gh api repos/chalbert/web-everything/branches/main/protection` → unchanged from #3373's original read:
  `enforce_admins: false`, no `restrictions` key, `required_approving_review_count: 0`.

**The load-bearing consequence:** there is currently no GitHub identity distinct from the human operator's own
account that could be named in a platform allow-list as "the drain's credential" — the drain *is* the same
account/token as the human admin. Any platform-level restriction today would either name that one shared account
(no behavioral change from the incident scenario #3373 investigated) or block it outright (which would also block
the human's own legitimate direct-`main` path).

## GitHub platform capability check

- **Classic branch-protection `restrictions` (push allow-list)** — per GitHub's own docs
  (docs.github.com → *About protected branches*), push restrictions are scoped to **organization-owned**
  repositories: "public repositories owned by a GitHub Free organization, and all repositories owned by an
  organization using GitHub Team or GitHub Enterprise Cloud." A **personal user-owned** repository — which
  `chalbert/web-everything` is — does not expose this field at all, on any plan.
- **Repository Rulesets (the modern successor, supports a `bypass_actors` list)** — per GitHub's docs, rulesets
  *are* available on GitHub Free for **public** repositories, including personal-account ones (private-repo push
  rulesets still need Team/Enterprise). Since this repo is public, a ruleset *could* technically require a PR on
  `main` and name a bypass actor. This nuance matters: the "personal repos can't do this at all" read is too broad —
  the mechanism exists. What doesn't exist is the *actor* to name (previous section).
- **Industry pattern for bot-merge-only repos** (Renovate, Dependabot auto-merge, Mergify, semantic-release-style
  bots): these systems uniformly authenticate as a **distinct GitHub App installation or machine user**, never the
  maintaining human's own PAT — precisely so a branch-protection/ruleset bypass or allow-list entry can name the bot
  without also touching the human's access. That pattern is already anchored in this repo's own ratified statute
  (below), not just external practice.

## Statute already on point — this is a ladder, not a fresh either/or

[`#pr-flow-rollout-mechanism`](../docs/agent/platform-decisions.md#pr-flow-rollout-mechanism) (ratified #1996/#1998,
2026-06-30) already specs an **Enforcement ladder** for exactly this asymmetry:

- **Rung 1 — convention (live now).** No server-side gate; isolation-by-practice + the #1153 branch guard +
  commit/closeout guards are the floor. Verbatim: *"Interim risk: nothing prevents an agent committing `main`
  directly — the floor is discipline, not a rule."* This is #3373's option (b).
- **Rung 2 — server-side bot-principal branch rule (the specced future flip).** A branch-protection rule requiring
  a PR for a **distinct bot GitHub principal** (a machine user or GitHub App installation token, never the human's
  credentials), human exempt. Verbatim: *"This rung needs a real GitHub remote + org/app setup, so it is **not
  agent-executable** (a human setup gate)."* This is #3373's option (a).
- **Rung 3 — symmetric observe-only `main` (deferred)** until a second human writer appears.

So the fork #3373 named was already anticipated and sequenced by an existing ratified decision — the open question
this item actually prepares is narrower: **ratify that we are still at Rung 1, name the concrete trigger for Rung
2, and record the compensating controls that hold the invariant in the meantime.**

## Compensating controls already shipped (the accepted enforcement layer today)

- [`we:scripts/lib/pr-merge-gate.mjs:148`](../scripts/lib/pr-merge-gate.mjs) `assertMayMerge()` — the sole `gh pr
  merge` chokepoint; throws for any non-`drain` caller unless `WE_MERGE_BREAK_GLASS=1` is set, which logs a loud
  audit line every time.
- [`we:scripts/readiness/drain-lock.mjs:114`](../scripts/readiness/drain-lock.mjs) `withNumberingLock()` /
  `withLandWriteLock()` — the numbering + land-write mutex JIT numbering depends on.
- [`we:scripts/check-standards-rules.mjs:2180`](../scripts/check-standards-rules.mjs) `duplicateBornAs()` and
  [`we:scripts/check-standards-rules.mjs:2245`](../scripts/check-standards-rules.mjs) `strandedHashesOnMain()` —
  the downstream `check:standards` catch net that flags exactly the kind of bypass (a hash minted twice, an
  un-numbered hash landed on `main`) an actor skipping the disciplined path would leave behind.

## Sources

- GitHub Docs, *About protected branches* — restrictions/organization scoping.
- GitHub Docs, *About rulesets* / *Available rules for rulesets* — Free-plan public-repo availability, bypass
  actors.
- `we:docs/agent/platform-decisions.md#pr-flow-rollout-mechanism` (this repo's own ratified enforcement ladder).
