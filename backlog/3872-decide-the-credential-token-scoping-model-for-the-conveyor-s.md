---
bornAs: x5ljiz4
kind: decision
parent: "3383"
status: open
scope: ["we:skills-src/conveyor/", "we:scripts/conveyor/"]
dateOpened: "2026-09-22"
relatedReport: reports/2026-09-22-daemon-role-credential-scoping.md
tags: []
---

# Decide the credential/token scoping model for the conveyor's daemonized processes

Daemonizing the conveyor runner (epic #3383, see #3860 and its sibling slices) split one process into several
long-lived ones, each spawned by its own `launchd` agent from its own dedicated git checkout. Confirmed by direct
read: today every daemon inherits the SAME operator GitHub credential — `gh auth status` shows a single OAuth
token (`gho_…`, scopes `gist`/`read:org`/`repo`/`workflow`) on the personal account `chalbert` (not an
organization); `we:scripts/lib/gh-throttle.mjs`'s `runGhSync` wraps `execFileSync('gh', args, opts)` with `opts`
passed straight through, no credential-injection seam anywhere in it; and the one representative `launchd` agent
inspected, `~/Library/LaunchAgents/com.we.review-daemon.plist`, sets only `PATH` in its `EnvironmentVariables`
dict. No mechanism exists today to give one daemon (a read-only watcher) a narrower credential than another (the
Fix-dispatch or Review daemon, which spawns agents and posts to PRs). Prior-art survey:
[`daemon-role-credential-scoping`](/research/daemon-role-credential-scoping/) (report via `relatedReport`).

## Standing fork-existence pass (pass 0)

Two concerns were checked against the standing test:

- **"Should a read-only watcher ever hold write scope?"** — **forced invariant, not a fork.** No coherent
  argument survives for deliberately over-privileging a pure-read sweep: it buys nothing (a watcher never calls a
  write endpoint) and only widens blast radius if that credential leaks. Recorded below as **Settled by
  precedent**, not a `## Fork N`.
- **"Which credential-scoping model to adopt (GitHub App / fine-grained PAT / status quo)"** — **a genuine
  fork**, but — per the skeptic pass below — one this repo already has a shape for: a **staged dimension with a
  safe default**, escalated on a named prerequisite rather than re-litigated on merit each time, the same pattern
  `we:docs/agent/platform-decisions.md:2753-2767` ("Amendment — the rung is a configurable dimension whose
  current value is Rung 1... Rung 2 is a selectable flavor blocked on a *prerequisite*, not on merit") already
  ratified for the sibling PR-flow-enforcement decision. See **Fork 1** and **Statute-overlap** below for how the
  two relate without colliding.

## Settled by precedent — the role taxonomy this decision applies to

Confirmed by direct read of `we:skills-src/conveyor/daemon-manifest.mjs` and the daemon files themselves:

- **Write-capable** (spawn agents, post labels/comments/PRs): the **Fix-dispatch daemon**
  (`we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs`, wraps
  `we:scripts/conveyor/reconcile-fix-dispatch.mjs`) and the **Review daemon**
  (`we:skills-src/conveyor/review-daemon.mjs`, wraps `we:scripts/operations/review-dispatch.mjs` +
  `we:scripts/conveyor/review-round-tag.mjs` / `we:scripts/conveyor/review-status-tag.mjs`). These are two
  **distinct** write-capable roles, not one — see Fork 1's skeptic-amended default below for why they must not
  share a single write-capable credential.
- **Read-only sweeps**, all resolved through `we:skills-src/conveyor/daemon-manifest.mjs`'s `DAEMON_MANIFEST` and
  run under the generic `we:skills-src/conveyor/pass-daemon.mjs`: `branch-drift`, `infra-blocked`,
  `duplicate-pr-watch` (WE-only, per that file's own header — neither of the first two has a `--repo` flag, and
  the third's item ids are WE-specific), plus the three-constellation-repo instances of `ci-queue-watch`,
  `parked-pr-conflict-watch`, `parked-pr-progress-watch`, and `lane-pool-health-watch` (12 total instances).
  These all carry the SAME trust level (read-only, across the same repo set), so — unlike the two write-capable
  daemons — sharing one credential across all of them loses no real segmentation.
- **The Dispatcher** (`we:skills-src/conveyor/runner.mjs`, supervised by
  `we:skills-src/conveyor/supervisor.mjs`, holding the singleton lease + tick mutex) still runs whichever
  mechanical passes have not yet been extracted to a standalone daemon, per #3860's rolling-cutover plan — its
  own real credential need shrinks toward the read-only floor as passes migrate off it, and never grows past
  whatever the still-inline passes individually need.
- **The Verify daemon** (#3878, tracked, `blockedBy: ["3877"]`) is **not yet built** — this decision's ruling
  applies to it the same way it applies to any future daemon: classify it write-capable or read-only by what its
  wrapped pass (`we:scripts/conveyor/verify-dispatch.mjs`) actually does, not by name.

This taxonomy is the input Fork 1's chosen model is applied against — it is not itself a decision to make.

## Fork 1 — the credential-scoping model: GitHub App vs fine-grained PAT vs status quo

**Fork-existence:** genuine three-way fork, not forced and not a config dimension in the "no ratifiable winner"
sense (see pass 0) — each branch is a coherent, mutually exclusive standing policy for this repo's own daemon
fleet. It is, however, correctly **adopted as a staged ladder** (default now, upgrade on a named prerequisite),
not a one-shot "pick forever" verdict — see the classification amendment below.

- **(a) GitHub App, per-installation-role tokens.** One App, installed on the three constellation repos, holding
  the union of permissions any role needs. Each daemon (or a shared broker every daemon calls) mints its OWN
  installation access token at need, narrowed via the mint-time `permissions` object (a strict subset of what
  the app was granted — [GitHub's docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
  confirm a minted token "cannot be granted permissions that the app was not granted"; this ceiling bounds
  mint-time *requests*, it does not by itself stop a compromised minting process from minting up to that full
  ceiling — a real residual, not a citation error) and the `repositories` list. Example: the Review daemon mints
  a token with `{"pull_requests": "write", "issues": "write", "contents": "read"}` restricted to the one repo it
  is currently ticking; a watcher pass-daemon mints `{"contents": "read", "pull_requests": "read"}` and nothing
  else. Tokens expire in **one hour** — this is not merely a cost-cheapened version of (b); it is a genuinely
  different, permanently smaller exposure window that survives even if minting were free (see the fresh-context
  screen below). **Real cost, confirmed by direct read of `cli/cli` community discussions (#5081, #5095, #8747):**
  `gh` CLI has **no native GitHub App authentication** — every real-world workaround
  (`actions/create-github-app-token`, the `gh-token`/`gh-app-auth` extensions) mints the token out-of-band from
  the app's private key and then feeds the string to `gh` via `GH_TOKEN` anyway. Adopting this model means
  writing (or adding a dependency for) a minting step in every daemon, or building a shared credential-broker
  process none of today's daemons have, plus safeguarding the App's private key as a brand-new standing secret.
- **(b) Fine-grained personal access tokens, THREE — one per distinct trust role, not one per "read/write"
  bucket.** **Amended by the skeptic pass** (see below): the original draft proposed only two tokens (one shared
  write-capable PAT for both Fix-dispatch and Review); that collapses exactly the segmentation this fork exists
  to buy, since those are two different write-surface daemons, each processing untrusted repo content (issue
  bodies, PR diffs, review threads) — the highest-injection-risk daemons in the fleet. The corrected default is
  **one read-only PAT shared across all 12+ watcher pass-daemon instances** (all three constellation repos,
  `contents: read` + `pull_requests: read` + `issues: read` — safe to share because every one of those instances
  is already the SAME trust level), **plus a SEPARATE write-capable PAT for the Fix-dispatch daemon**, **plus a
  THIRD, separate write-capable PAT for the Review daemon** (each `contents: write` + `pull_requests: write` +
  `issues: write`, scoped only to the repos that daemon actually ticks). Each PAT is scoped to specific repos at
  creation ([GitHub's docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens):
  "Only select repositories," recommended over broader access) with an expiration of 1–366 days (a personal
  account cannot mint a non-expiring fine-grained token) — **two independent manual-update triggers**, not one:
  the fixed expiry, AND any future change to the repo set (a fine-grained PAT's repo list is fixed at creation;
  adding a fourth constellation repo later means manually re-scoping every PAT that should cover it, not just
  waiting out an expiry). Wiring cost is **zero new code, confirmed down to the `git push` layer, not just `gh`
  subcommands**: `gh`'s own [environment manual](https://cli.github.com/manual/gh_help_environment) states
  `GH_TOKEN`/`GITHUB_TOKEN` "will be used when a command targets github.com" (a general statement covering every
  `gh` subcommand, including `gh auth git-credential` itself) and "take precedence over previously stored
  credentials"; **confirmed live on this operator's machine** — `~/.gitconfig`'s `credential.helper` for
  `https://github.com` is already `!/opt/homebrew/bin/gh auth git-credential` (from a prior `gh auth setup-git`),
  not the OS-default `osxkeychain` — so a raw `git push` (used by `we:scripts/push-if-green.mjs:194` and
  `we:scripts/pr-land.mjs:693,781`, not just `gh api`/`gh pr` calls) is ALSO governed by a per-daemon `GH_TOKEN`,
  not silently exempt from it. **This is a standing precondition to re-verify on any new checkout a daemon is
  ever moved to** (a checkout where `gh auth setup-git` was never run would fall back to the OS keychain's
  broad credential for `git push` specifically, silently defeating the scoping for that one operation) — not
  something to assume forever true. Every daemon's `launchd` plist already carries an `EnvironmentVariables`
  dict (`~/Library/LaunchAgents/com.we.review-daemon.plist` sets `PATH` there today) — a role's `GH_TOKEN` is one
  more key in that same dict, no new code. **Residual risk, named rather than solved:** a missed manual rotation
  is not a silent failure — every daemon already logs a non-fatal tick/run error on an auth failure (e.g.
  `we:skills-src/conveyor/review-daemon.mjs`'s own `onTickError`), so an expired PAT surfaces as a recurring
  logged failure, not a silent stall; no new expiry-watch mechanism is built here, and none is needed beyond
  that existing logging.
- **(c) Status quo — accept full-environment inheritance, unchanged by the split.** No new credential, no
  rotation chore, no new secret to protect — revisit only if a real incident (a leaked token, an unwanted write
  from a daemon that should have been read-only) forces the question. Real cost: every read-only watcher, across
  all three constellation repos, holds a credential capable of writing/merging/deleting in any of them; the
  daemon split itself did not create this exposure, but it also did nothing to shrink it even though the fleet
  of long-lived processes sharing one credential is now larger than the single runner process it replaced.

```
# (b), the recommended default (skeptic-amended: THREE tokens, not two) — wired into existing plists, no code:
# ~/Library/LaunchAgents/com.we.review-daemon.plist          (Review's OWN write-capable role PAT)
# ~/Library/LaunchAgents/com.we.reconcile-fix-dispatch-daemon.plist  (Fix-dispatch's OWN write-capable role PAT)
<key>EnvironmentVariables</key>
<dict>
  <key>PATH</key><string>...</string>
  <key>GH_TOKEN</key><string>github_pat_11ABCXYZ...</string>   <!-- this daemon's OWN fine-grained PAT -->
</dict>
# every watcher pass-daemon instance's own plist gets the ONE SHARED read-only PAT in the same slot; gh (and,
# on this machine, `git push` too — credential.helper already routes through `gh auth git-credential`) honors
# GH_TOKEN over the keychain-stored `gh auth login` credential (cli.github.com/manual/gh_help_environment)
```

**Recommended default: (b) — fine-grained PATs, THREE roles (one shared read-only + two separate write-capable,
per the skeptic amendment above).** It is the only option that needs zero new code, reusing a mechanism (the
plist `EnvironmentVariables` dict + `gh`'s own env-var precedence, confirmed to reach raw `git push` too) already
present and already proven (it already carries `PATH`). It achieves the real segmentation this decision exists
for — a watcher pass-daemon genuinely cannot write, full stop, and a compromise of Fix-dispatch no longer hands
over Review's own write capability for free — at a cost (manual rotation, up to once a year, plus a re-scope on
any repo-set change) that is a bounded, low-frequency operator chore, not an ongoing engineering burden. (a) is
the correctness-grade option — a permanently smaller per-leak exposure window (1 hour vs up to 366 days, a real
merit difference that survives even at zero build cost, not just a cost artifact — see the fresh-context screen)
— but its cost today (a minting dependency wired into every daemon or a new broker process, since `gh` cannot do
App auth natively, plus private-key custody) is disproportionate to today's actual threat model: a single
operator's own laptop, not a multi-tenant CI fleet. (c) is not "wrong," but it leaves the exposure the split grew
unaddressed with no plan to revisit it.

**Concrete upgrade trigger for (a):** if the daemon fleet ever moves off the single operator's laptop onto
shared/CI infrastructure (where a 366-day static secret per role is a materially worse risk than the extra
minting-step engineering cost), or a real incident occurs (a role's PAT leaks or a daemon writes somewhere it
should not have been able to), upgrade from (b) to (a) — the role taxonomy and the least-privilege permission
sets this decision defines carry over unchanged; only the minting mechanism changes. **This trigger is
independent of, and must not be conflated with, `we:docs/agent/platform-decisions.md`'s own Rung 2 trigger** (a
distinct bot GitHub principal minted for the drain) — see Statute-overlap below.

`Skeptic: SURVIVES-WITH-AMENDMENT — a real throwaway skeptic sub-agent attacked all four axes. Classification:
amended to a staged-dimension framing (matches the sibling Rung-ladder precedent, not a one-shot pick-forever
fork). Merit: amended — (b) is now THREE PATs (Fix-dispatch and Review each get their own), not two, closing the
shared-write-credential gap the skeptic found; the manual-rotation risk was also named as non-silent (existing
daemon error logging surfaces an expired-token failure). Statute-overlap: a REAL collision was found and is
reconciled below, not waved off. Citation-scope: the GitHub-App permission-ceiling citation held; the gh
env-var-precedence citation was verified to also cover raw `git push` (confirmed live on this machine's own
git config), which the original draft had asserted without checking.`

`Screen: clear — a separate, fresh-context agent (no authoring context) confirmed this is a genuine
cross-cutting security-posture call (blast-radius exposure of the whole daemon fleet), not an implementation
detail. On the "would a merit difference survive free/instant build?" question it found a real, non-cost merit
difference DOES survive (token lifetime: 1 hour vs up to 366 days) — which if anything argues (a) is the
long-run-superior mechanism once minting cost drops, exactly why the item names a concrete, cost-independent
upgrade trigger for (a) rather than treating (b) as a permanent answer.`

## Skeptic pass — full attack + resolution log

A throwaway skeptic sub-agent (general-purpose, instructed to attack only, no defense) was run against Fork 1's
default on all four required axes. Verbatim findings, each resolved into the fork text above:

1. **Classification attack — SURVIVES-WITH-AMENDMENT.** The draft asserted "not a config dimension" while its own
   text already staged an upgrade trigger — internally inconsistent. `we:docs/agent/platform-decisions.md`
   (lines ~2753-2767) already ratifies exactly this shape for a sibling decision: "the rung is a configurable
   dimension whose current value is Rung 1... Rung 2 is a selectable flavor blocked on a *prerequisite*, not on
   merit." **Folded in:** Fork 1 is now explicitly framed as a staged dimension with a safe default, matching
   this repo's own established pattern, rather than argued into a false one-shot three-way pick.
2. **Merit attack — SURVIVES-WITH-AMENDMENT (real flaw).** Option (b) as first drafted issued only TWO PATs for
   three distinct roles — the write-capable PAT was shared by Fix-dispatch AND Review, collapsing the exact
   segmentation the fork exists to buy (a compromise of either untrusted-content-processing daemon hands over
   the other's write capability for free). **Folded in:** (b) is now three PATs — one shared read-only (safe,
   since all watcher instances are the same trust level) plus one EACH for Fix-dispatch and Review. Secondary
   finding (expiry-monitoring) folded in as a named, accepted residual (existing per-daemon error logging already
   surfaces an auth failure; no new watcher built for it).
3. **Statute-overlap attack — SURVIVES-WITH-AMENDMENT (real collision found, not refuted).** Grep run:
   `grep -niE 'GH_TOKEN|GITHUB_TOKEN|personal access token|\bPAT\b|oauth|keychain|GitHub App|gh auth'
   we:docs/agent/platform-decisions.md`. Found an already-ratified, directly on-point rule: the PR-flow
   enforcement ladder (`#non-destructive-closeout-prflow`, amended by #3423) specs a future "Rung 2" where
   automated writers authenticate as **"a distinct GitHub principal (a bot identity — a machine user or GitHub
   App installation token, never the human's credentials)"** (`we:docs/agent/platform-decisions.md:2738-2739`),
   with its own stated revisit trigger being **"a distinct bot GitHub principal is minted for the drain... an
   App installation or machine-user PAT wired into its `gh` auth"** (`we:docs/agent/platform-decisions.md:2778-2779`).
   **The real collision:** Fork 1(b)'s fine-grained PATs are minted from the SAME single operator's own personal
   GitHub account — narrower in scope, but still the human's own identity, not "a distinct GitHub principal."
   Adopting (b) here does **not** satisfy, and must not be conflated with, Rung 2's already-ratified bar. **Folded
   in (reconciled, not just noted):** see Statute-overlap section below — this decision's scope-narrowing axis and
   Rung 2's identity-distinctness axis are named as two separate, non-conflicting axes, and Fork 1's own upgrade
   trigger is explicitly decoupled from Rung 2's trigger so a future reader never conflates "we scoped the token"
   with "we minted a distinct bot principal."
4. **Citation-scope attack.** Claim 1 (GitHub App permission ceiling) — **REFUTED**: the ceiling is a
   mechanism-level property independent of org-vs-personal account and independent of Actions-vs-local execution;
   no scope failure. (One adjacent nuance folded into (a)'s text: the ceiling bounds mint-time requests, not a
   compromised minter's ability to mint up to the full ceiling.) Claim 2 (`GH_TOKEN` precedence) — **real gap
   found and closed, not merely survived**: the citation covers `gh` subcommands generally, but this repo's
   actual write path also includes raw `git push` (`we:scripts/push-if-green.mjs:194`,
   `we:scripts/pr-land.mjs:693,781`), which only inherits the `GH_TOKEN` scoping if git's own `credential.helper`
   routes through `gh auth git-credential` rather than the OS keychain default. **Verified directly** (not just
   asserted): this machine's `~/.gitconfig` already has `credential.helper = !/opt/homebrew/bin/gh auth
   git-credential` for `https://github.com`. **Folded in:** this is now stated as a load-bearing, standing
   precondition to re-verify on any new checkout, not an unexamined assumption.

## Two-confusion screen

A separate, fresh-context agent (given the fork in fully genericized form, with none of this item's authoring
context or discussion) was asked the two required screen questions:

1. **Implementation detail vs cross-cutting/security-posture call?** — **Cross-cutting.** "It sets the
   blast-radius exposure of every daemon in the fleet if a credential leaks or a process is compromised — that's
   a security architecture property, not an implementation detail hidden from any consumer."
2. **Real merit difference, or prioritization in costume?** — **Real merit difference survives.** The agent found
   that once engineering/rotation/setup cost is zeroed out, the (a)-vs-(b) choice does not collapse to nothing:
   "(a)'s 1-hour token lifetime vs (b)'s up-to-366-day lifetime is not a cost artifact — it's an inherent
   exposure-window difference... under zero-cost assumptions, (c) simply falls away... and the (a)-vs-(b) choice
   collapses TOWARD (a) on a genuine security merit (shorter-lived tokens), not sequencing." This is exactly why
   Fork 1's default names an explicit, cost-independent upgrade trigger for (a) rather than presenting (b) as a
   permanent answer — the fork is honest about which of its own reasoning is cost-driven (true, and a legitimate
   input) versus merit-driven (also true, and the reason (a) is not dismissed, only deferred).

`Screen: clear (0 flags) — the fresh-context read confirms the classification (cross-cutting) and confirms a real,
non-cost merit difference exists, which the item already surfaces honestly via the named upgrade trigger rather
than hiding it behind "(b) is simply the answer."`

## Statute-overlap (reconciled — a real collision was found, not merely checked and cleared)

`we:docs/agent/platform-decisions.md` was grepped for every credential/token/security-posture term this decision
could plausibly collide with (`GH_TOKEN`, `GITHUB_TOKEN`, `personal access token`, `PAT`, `oauth`, `keychain`,
`GitHub App`, `gh auth`, `credential`, `secret`, `blast-radius`). Two families of hits:

- Design-token vocabulary (color/spacing/theme) and the PR-review **care-level** "blast-radius" family
  (`#blast-radius-advisory-care-not-a-gate` and kin) — these govern how hard an AI review panel looks at a diff
  and whether a machine may push a fix (a review-rigor dial), **not** GitHub-credential custody. No overlap.
- **A real, on-point anchor**: the PR-flow enforcement ladder's Rung 2 (`we:docs/agent/platform-decisions.md:2738-2739`,
  amended by #3423 at `:2753-2767` and `:2778-2779`) already rules that tightening automated writers off
  direct-`main` access requires **"a distinct GitHub principal (a bot identity — a machine user or GitHub App
  installation token, never the human's credentials)"**, gated as a "dimension... blocked on a prerequisite, not
  on merit" whose own trigger is that same distinct-principal minting.

**Reconciliation.** These are two genuinely separate axes, not one decision wearing two hats: Rung 2 asks *whose
identity* an automated writer authenticates as (the human operator vs. a distinct bot/App principal); #3872 asks
*how narrowly scoped* whatever credential a given daemon holds is (full account access vs. role-scoped). A
fine-grained PAT minted from the operator's own account (#3872's Fork 1(b)) answers the SECOND question without
touching the first — it is still the human's own identity, merely narrower. **This decision's ruling therefore
does NOT satisfy, advance, or count toward Rung 2's prerequisite**, and Fork 1's own "upgrade trigger for (a)" is
deliberately worded to stay independent of Rung 2's trigger (a distinct principal being minted for the drain) so
a future reader never mistakes "we scoped the daemons' tokens" for "we minted a distinct bot principal." If Rung
2 ever DOES activate (a distinct GitHub principal is minted), that principal's own installation/PAT should be
scoped using this decision's SAME role taxonomy (Fix-dispatch / Review / shared-read-only-watchers) — the two
decisions compose (identity-distinctness × scope-narrowness are independent dimensions) rather than colliding.

### Review jury (provisional — pre-registered #2638)

Care band: **elevated** (system-machinery / cross-daemon security-posture call, not a statute-self change, so not
`high`). Predicted touch-set of the build this decision would authorize (repo-qualified prefixes; any buildable
child item carved off takes its own slice of this set as its `scope:`): `we:skills-src/conveyor/`,
`we:scripts/conveyor/`, `we:scripts/lib/gh-throttle.mjs`, and each affected `~/Library/LaunchAgents/com.we.*.plist`
(operator-machine config, outside the repo tree, not a `changedFiles` input but part of what a build slice must
also touch).

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

## Done when

1. **Executable** — a ratified `codifiedIn` anchor exists on this item pointing at a new
   `we:docs/agent/platform-decisions.md` section naming the adopted credential-scoping model (Fork 1's chosen
   option), the role taxonomy above, and the explicit non-overlap reconciliation with Rung 2; `grep -c
   "codifiedIn" we:backlog/3872-*.md` returns 1 where it returns 0 today.
