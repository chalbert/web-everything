---
kind: decision
parent: "3029"
status: open
dateOpened: "2026-08-31"
preparedDate: "2026-08-31"
relatedTo: ["3373", "2152", "2151", "2153"]
relatedReport: reports/2026-08-31-branch-protection-sole-writer-enforcement.md
tags: [operations, conveyor, github, branch-protection, sole-writer, decision]
---

# Branch-protection enforcement of the sole-writer invariant: platform allow-list vs. accepted script-level discipline

Carved from [#3373](/backlog/3373-branch-protection-does-not-structurally-enforce-the-sole-wri/)'s "Done when"
item 2 per the "never take an unprepared decision" and "decisions are work items, not plan mode" agent-memory
rules — a
decision-shaped fork does not get answered inline in a `kind: story` card. #3373 found that nothing at GitHub's
own layer enforces the "the drain is the sole serial writer to `main`" invariant JIT numbering depends on — it
holds entirely by script discipline (`assertMayMerge` / the numbering lock / the drain lease). The fork named
there: **(a)** turn on `enforce_admins` plus a `restrictions` push allow-list naming the drain's own credential,
accepting whatever workflow friction that adds for every other admin actor, vs. **(b)** explicitly ratify that
script-level discipline — plus the downstream `duplicateBornAs`/`strandedHashesOnMain` catch net in
`check:standards` — is the accepted enforcement layer, and record why platform-level enforcement is rejected for
now.

**Prepared, not ratified.** This item states the fork, the research behind it, and a recommended bold default;
the eventual ratification is a separate, later human turn (`/next decision`).

## Context — what was already checked, read from the live repo (2026-08-27, re-verified 2026-08-31)

`gh api repos/chalbert/web-everything/branches/main/protection`:

```json
{
  "required_status_checks": {"contexts": ["test", "smoke"], "strict": false},
  "required_pull_request_reviews": {"required_approving_review_count": 0},
  "enforce_admins": {"enabled": false},
  "allow_force_pushes": {"enabled": false},
  "allow_deletions": {"enabled": false}
}
```

No `restrictions` key — nothing limits *which* users/apps/tokens may push or merge. `enforce_admins: false` means
an admin-scoped actor can push directly to `main` or merge bypassing `test`/`smoke` and review, and GitHub itself
would not refuse it; the whole numbering/sole-writer discipline runs *inside* `we:scripts/pr-land.mjs` /
`we:scripts/merge-ai-prs.mjs`, so an admin actor bypassing those scripts (a raw `git push`, a hand-run
`gh pr merge`) is invisible to branch protection as configured today.

## Prior-art + fact-check pass (full findings: `we:reports/2026-08-31-branch-protection-sole-writer-enforcement.md`)

Three live facts checked, not assumed, because Fork (a) as literally stated depends on them:

1. **Repo ownership.** `gh api repos/chalbert/web-everything` → `"owner":{"login":"chalbert","type":"User"}`,
   `"visibility":"public"`. This is a **personal user-owned** repo, not an organization.
2. **GitHub platform capability.** Per GitHub's docs, the *classic* branch-protection `restrictions` field (a push
   allow-list) is scoped to **organization-owned** repositories only — a personal repo never exposes it, on any
   plan. The *newer* Repository Rulesets mechanism (which carries a `bypass_actors` list, the modern equivalent)
   **is** available on GitHub Free for **public** personal repos — this repo qualifies. So the "personal repos
   can't do this at all" read is too broad: the *mechanism* exists via rulesets. What's missing is the *actor*.
3. **Collaborator/identity roster.** `gh api repos/chalbert/web-everything/collaborators` → exactly **one**
   entry: `chalbert`. `gh auth status` confirms the local `gh` CLI — the same one `we:scripts/merge-ai-prs.mjs`
   shells through — authenticates as that same account. `we:scripts/lib/pr-merge-gate.mjs`'s `mergePr()` never
   passes `--admin`; the drain's merges are ordinary non-admin `gh pr merge` calls riding **the human's own
   credential**. There is no GitHub App installation, machine user, or second collaborator today.

**Industry pattern** (Renovate, Dependabot auto-merge, Mergify, semantic-release-style bots): bot-merge-only
systems uniformly authenticate as a **distinct GitHub App installation or machine user**, never the maintaining
human's own PAT — exactly so a branch-protection/ruleset allow-list can name the bot without also touching the
human's own access. This isn't just external practice; it's already the standard this repo committed to (next
section).

## Standing test — is this a fresh either/or, or already forced by an existing statute?

**It's forced — twice over.** This is not a first call; it is the **second, independent reason to reaffirm** a
choice this repo already made and applied. **[#2152](/backlog/2152-configure-main-branch-protection-for-self-approved-pr-landin/)**
(resolved 2026-07-02) set `enforce_admins: false` **deliberately** when branch protection was first configured, for
its own stated reason: *"admins bypass protection, so the retained `git push origin main` fallback … keeps
working. Flipping protection does not brick today's direct-push landing … it only gates non-admin merges through
the self-approved-PR path."* That fallback is still live today — `we:scripts/pr-land.mjs`'s `--fallback-git`
local-merge degrade and the `we:scripts/lib/pr-merge-gate.mjs` `WE_MERGE_BREAK_GLASS` admin override both depend on
an admin actor being able to push/merge without protection refusing it. Turning on `enforce_admins` now would not
just hit the missing-identity gap below — it would also **regress an already-resolved, still-relied-on decision**
(#2152) without a compensating fix for the fallback paths it protects. #3373's card never cited #2152/#2151/#2153;
this item does, so the ratification here reads as *extending* settled policy for an additional reason, not
re-litigating it from scratch.

Layered on top of that, [`#pr-flow-rollout-mechanism`](/docs/agent/platform-decisions.md#pr-flow-rollout-mechanism)
(ratified #1996/#1998, 2026-06-30) specs an **Enforcement ladder** for exactly this asymmetry:

- **Rung 1 — convention (live now).** No server-side gate; isolation-by-practice + the #1153 branch guard +
  commit/closeout guards are the floor. Verbatim: *"nothing prevents an agent committing `main` directly — the
  floor is discipline, not a rule."* — **this is #3373's option (b), word for word.**
- **Rung 2 — server-side bot-principal branch rule (the specced future flip).** A branch-protection rule requiring
  a PR for a **distinct bot GitHub principal** (a machine user or GitHub App installation token, **never the
  human's credentials**), human exempt. Verbatim: *"This rung needs a real GitHub remote + org/app setup, so it is
  **not agent-executable** (a human setup gate)."* — **this is #3373's option (a), word for word.**
- **Rung 3 — symmetric observe-only `main` (deferred)** until a second human writer appears.

Applying the fork-existence test: option (a) is the *excluded/broken* branch **right now** — not because platform
enforcement is a bad idea in general (Rung 2 already endorses it as the eventual flip), but because it is
currently **unimplementable as stated**: there is no "drain's own credential" distinct from the human admin to
name, and naming the human's shared account instead would either (i) change nothing about the incident scenario
#3373 investigated (an admin acting outside the disciplined scripts is still an admin, allow-listed or not), or
(ii) block the human's own direct-`main` path, which contradicts the *already-ratified* Rung-1/Rung-3 design
("the human is the single trusted writer and keeps direct commit/push to `main`"). Exactly one branch is
correct today — this is a **ratify**, not a weigh.

## Fork 1 — which rung of the already-ratified ladder is current, and what closes the gap

*Fork-existence (forced invariant):* option (a) is positively broken today for the reason above — it cannot
achieve the stated goal (distinguish the drain from an out-of-band admin actor) without a prerequisite (a minted
bot identity) that Rung 2 itself already says is a non-agent-executable human setup step. Option (b) is what is
already true in practice and already the ratified interim state.

| Option | Status | Why |
|---|---|---|
| **(b) Ratify script-level discipline as the accepted enforcement layer, now** | **Recommended default** | Matches the live Rung 1; the only branch that is actually implementable and doesn't regress the human's own ratified direct-push path |
| (a) Turn on `enforce_admins` + a push allow-list naming the drain's credential | Rejected *for now* (not excluded forever — see revisit trigger) | No distinct "drain credential" exists to name (one collaborator: `chalbert`, same as the human); would either no-op or block the human's own already-ratified access |

**(b) in practice — the enforcement chain already shipped, cited exactly:**

```
we:scripts/lib/pr-merge-gate.mjs:148        assertMayMerge()        — the sole `gh pr merge` chokepoint; throws
                                                                        for any caller !== 'drain' unless
                                                                        WE_MERGE_BREAK_GLASS=1 (logged loudly
                                                                        every use — no silent bypass)
we:scripts/readiness/drain-lock.mjs:114     withNumberingLock()     — the numbering mutex JIT numbering depends on
we:scripts/readiness/drain-lock.mjs         withLandWriteLock()     — shares the same lock key so a merge write and
                                                                        the numbering step stay mutually exclusive
we:scripts/check-standards-rules.mjs:2180   duplicateBornAs()       — downstream catch net: flags a `bornAs` hash
                                                                        minted twice (the #2318 tripwire class)
we:scripts/check-standards-rules.mjs:2245   strandedHashesOnMain()  — downstream catch net: flags a hash-id file
                                                                        that reached `main` un-numbered (#2319)
```

These are a real, tested, *layered* control: a live-process gate (`assertMayMerge`) plus a build-time audit
(`check:standards`) that would surface exactly the artifact an out-of-band write leaves behind — a duplicate or
un-numbered hash — even if the live gate were somehow skipped. This is what #3373's item 2(b) asks to be
recorded, not merely implied.

**(a) in practice — what it would take, for the record (not executed):**

```bash
# The mechanism that WOULD exist for this fork, once its prerequisite exists — a Repository Ruleset (not the
# classic `restrictions` field, which is org-only and this repo is personal/public):
gh api repos/chalbert/web-everything/rulesets --method POST --input - <<'JSON'
{
  "name": "main-sole-writer",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [{ "type": "pull_request" }],
  "bypass_actors": [
    { "actor_type": "Integration", "actor_id": "<drain's GitHub App installation id — DOES NOT EXIST YET>",
      "bypass_mode": "always" }
  ]
}
JSON
```

The blocking gap is the `actor_id` — there is no App/machine identity to put there today. Minting one (a GitHub
App registration + installation, or a dedicated machine user with its own PAT, wired into `we:scripts/pr-land.mjs`
/ `we:scripts/merge-ai-prs.mjs`'s `gh` auth) is Rung 2's own stated prerequisite, and is itself a
human/org-setup step, not something this decision authorizes or this item builds.

**Revisit trigger (concrete, not "someday"):** re-open this decision when either (1) a distinct bot GitHub
principal is minted for the drain (Rung 2's prerequisite — a GitHub App installation or machine-user PAT wired
into the drain's `gh` auth, distinct from the human's own), making a real `bypass_actors`/allow-list entry
possible without touching the human's path, or (2) a second human writer joins the repo (Rung 3). Neither
condition holds today.

**Statute-overlap check.** [`#pr-flow-rollout-mechanism`](/docs/agent/platform-decisions.md#pr-flow-rollout-mechanism)'s
authoring scope is exactly "the PR-flow rollout mechanism and its enforcement ladder for the main-branch write
asymmetry" — this decision's subject (branch-protection enforcement of the sole-writer invariant) sits squarely
inside that scope; it is not a narrower rule stretched to cover a broader case. No collision: this decision
*composes* with it (ratifying "we are at Rung 1, here is why, here is the trigger for Rung 2") rather than
contradicting it. [`#repo-drain-check-contract`](/docs/agent/platform-decisions.md#repo-drain-check-contract)'s
reference to #2246 ("making the `test` check GitHub-*required* via branch protection is a separate credentialed
step") is a sibling but narrower concern — a required *status check*, not push/merge identity — no overlap.

**Skeptic:** SURVIVES-WITH-AMENDMENT → amendment folded in above. A throwaway skeptic sub-agent (`general-purpose`,
prompted only to refute) attacked all four axes. **Classification (0):** flagged that this isn't a config
dimension (turning on `enforce_admins` today would break the human's own direct-push path — (a) and (b) can't
coexist as stated), but *did* catch that the item understated how settled this already was — **#2152 already
ratified `enforce_admins: false` in 2026-07 for its own reason** (preserving the direct-push fallback), which
this item hadn't cited. **Fixed above** (the reconciliation now cites #2152/#2151/#2153 and states this decision
extends, not re-litigates, that call). **Merit (1):** could not find a working alternative that closes the gap —
confirmed no `bypass_actors` shape (role-based, PAT-based) can name "the drain" distinct from "the admin" on a
one-collaborator repo, and confirmed flipping `enforce_admins` alone, today, would regress the still-live
`--fallback-git`/`WE_MERGE_BREAK_GLASS` paths. **Statute-overlap (2):** verified the `#pr-flow-rollout-mechanism`
quotes verbatim against the live file (lines 2680–2699) — no misquote, no contradiction, ladder is real; the only
gap was the missing #2152 citation, now fixed. **Citation-scope (3):** both cited anchors' authoring scopes
genuinely reach this question — no stretching found. Net: default retained, reasoning strengthened by the #2152
citation the attack surfaced.

**Screen:** clear — a fresh-context agent (no prior exposure to this session's authoring) answered: (1) this rules
on web-everything's own repo-operations infrastructure, invisible to any FUI/Plateau consumer of WE's published
standards — correctly scoped as internal ops, never mis-cast as a standard-boundary question (it never claims to
be one); (2) even at zero build/maintenance cost, option (a) still needs a writer identity genuinely distinct from
the human, which this single-collaborator repo structurally lacks — minting one either changes nothing (an
allow-list still resolves to the same human) or breaks the already-ratified direct-push path, so (a) is not simply
a "do it later" version of (b) — a real merit difference survives cost being stripped, not prioritization in
costume.

## Done when

1. **A decision recorded** — ratify (b) as the accepted enforcement layer today, with the revisit trigger stated
   above as the un-gate condition for reopening (a). (This item's own resolution, via `/next decision`.)
2. #3373 is unblocked (`blockedBy` cleared) and its remaining non-decision follow-through (the executable
   test/documented check, and the "if (a): apply via `gh api`" contingency) proceeds per its own body against
   whichever branch is ratified.

## Lineage

Carved from [#3373](/backlog/3373-branch-protection-does-not-structurally-enforce-the-sole-wri/) (2026-08-31) per
the "never take an unprepared decision" agent-memory rule (the #3373 worked example is literally this card) and
"decisions are work items, not plan mode". Composes with
[`#pr-flow-rollout-mechanism`](/docs/agent/platform-decisions.md#pr-flow-rollout-mechanism) (#1996/#1998) and
[`#repo-drain-check-contract`](/docs/agent/platform-decisions.md#repo-drain-check-contract) (#2315, #2246).
Extends and reaffirms **#2152** (resolved 2026-07-02, the original `enforce_admins: false` application) and its
siblings **#2151** (CI-on-PR) / **#2153** (PR-based drain) — surfaced by the pass-4 skeptic, not cited in #3373's
original card.
