---
bornAs: xpb92yn
kind: story
size: 8
parent: "2445"
status: active
dateOpened: "2026-08-18"
dateStarted: "2026-08-18"
tags: [delivery, cloud-vm, bootstrap, portability, consent]
scope:
  - we:scripts/bootstrap-session.mjs
  - we:scripts/sync-commands-deploy.mjs
  - we:scripts/sync-skills-deploy.mjs
  - we:scripts/memory-resolve.mjs
  - we:scripts/lib/constellation-repos.mjs
  - we:scripts/__tests__/bootstrap-session.test.mjs
  - we:scripts/__tests__/sync-commands-deploy.test.mjs
  - we:docs/agent/vm-sessions.md
  - we:AGENTS.md
  - we:package.json
  - we:.claude/settings.json
  - we:.githooks/post-merge
---

# A cloud VM session configures its own machine state, and a workstation is only ever asked

The instruction layer travels to a cloud session — `we:AGENTS.md` is committed — but machine state does not:
a fresh container has the repo and nothing wired, so the 27 skills and 20 slash commands are inert and
every session rediscovers the setup by hand, differently. This makes it one idempotent, host-aware script.
It also removes two WE-as-hub assumptions and one hand-typed `/Users/` path. **Retro-card**: the work was
built before it was filed, so the value here is the record and the review, not the plan.

## Done when

1. **Executable** — `node we:scripts/bootstrap-session.mjs --ephemeral --dry-run` prints a per-step plan
   with a `locus:` line; before this item the script does not exist.
2. All 20 slash commands and 27 skills are live in a session whose primary directory is NOT this repo.
3. `node we:scripts/memory-resolve.mjs <slug>` resolves with no user-level memory dir present.
4. On a durable host a default run leaves the user-level settings file under `$HOME/.claude` byte-identical; on an ephemeral
   host it applies. `npm run bootstrap:install` applies on either.
5. `npm run check:standards` is 0 errors and the warning count is unchanged.

## What shipped

- **`we:bootstrap-session.mjs`** — host-aware and idempotent. Deploys skills and commands, verifies memory,
  reports constellation siblings, and skips the lane pool and guard with the reason attached.
- **`we:sync-commands-deploy.mjs`** — slash commands had no deploy path at all; they were live only in a
  session whose primary directory is this repo. Built by REUSING every risky part of the skills deploy
  (containment, opt-in prune, tracked-files-only, drift report) rather than a second implementation.
- **`we:memory-resolve.mjs`** gains the in-repo fallback `we:check-memory.mjs` already had — the resolver
  hard-failed in any fresh clone while the checker passed, one corpus with two answers.
- **`we:constellation-repos.mjs`** gains `dirs` per repo plus `repoKeyForDir` / `siblingKeys`, so the
  bootstrap DERIVES which checkout it is in instead of assuming WE. Relocating is a `git mv`.
- The `/Users/<name>/…` grant is derived (`primaryCheckout` → `withPrimaryGitDir`); the stale one-off
  `Bash(cd /Users/…)` allow-rule is deleted.

## The decided design — consent is host-shaped

A default run may write under `$HOME/.claude` **only on an ephemeral host**, whose home belongs to a
container reclaimed on idle. A durable host reports and requires `npm run bootstrap:install`.

This was NOT the first design and the difference is the whole point of the card. The first cut always
wrote, and the committed project `SessionStart` hook made that automatic: opening the repo on a
workstation silently granted a directory and installed a user-level hook that then fired in every
unrelated repo on that machine. A `/converge` panel refused it (see the review record below).

## Interfaces and protocol

- **`npm run bootstrap install` does NOT work.** npm swallows a bare positional without a `--`
  separator, so the argument never reaches `main()` and the run silently stays in report-only mode.
  Hence `bootstrap:install` / `bootstrap:uninstall` as their own scripts. Verified by running both forms.
- **`git fetch --unshallow` is not idempotent** — exit 128 on a complete repo. Any caller must gate on
  `git rev-parse --is-shallow-repository`. (Consumed by the follow-on, not by this card.)
- **`we:planSteps` contract** — `{ id, title }` plus one of `skip` / `info` / `verify` / `argv` / `gitDir`.
  `verify`'s return value is consumed as report detail, so a new effect gets its own key.
- **`formatPlans({ noun })`** — the shared reporter took a noun so it stops saying "skill(s)" about
  commands. Defaults to `'skill'`; the 25 existing skills-deploy tests are untouched.

## Scope consumers

`we:bootstrap-session.mjs` has **zero ES importers** outside its own test — every consumer is a subprocess
or config caller, the set an import scan finds none of:

- `we:.claude/settings.json` (repo-level SessionStart hook) and the user-level file under `$HOME/.claude`
- `we:package.json` — `bootstrap`, `bootstrap:install`, `bootstrap:uninstall`, `bootstrap:check`
- `we:.githooks/post-merge` — invokes both deploy CLIs on a merge touching their sources

`formatPlans` is the one genuine ES-import consumer touched, from `we:sync-commands-deploy.mjs`.

## Delivery shape

One PR. The doc and the behaviour must land together — `we:vm-sessions.md` describes the consent model, and
a gap between them is worse than either alone.

## Review record

Driven through `/converge` at `care=high` in a cloud VM. **Escalated `needs-human`, reason
`mandatory-lens-absent`** — see the caveat below. Three rounds, all findings fixed or dismissed:

| Round | Finding | Disposition |
|---|---|---|
| 1 | SessionStart hook auto-wrote the user's global settings, unprompted | fixed — consent is host-shaped |
| 1 | sibling checkouts searched and `execFileSync`'d with no provenance check | fixed — search deleted |
| 1 | two SessionStart registration paths fired per session | fixed — collapsed with the above |
| 1 | `withPrimaryGitDir` dropped any `/.git` grant, revoking an operator's own | fixed — `knownGitDirs` |
| 2 | post-merge deploys write to the operator's global tree with no consent gate | **dismissed** — real, but it is the ratified #2579 pattern for skills and this card's commands block copied it; fixing only the new half creates the asymmetry the finding objects to. Wants one item covering both. |
| 2 | host detection rests on spoofable env vars | **dismissed** — no marginal escalation: a repo that can set env through `we:.claude/settings.json` already registers hook commands in that same file, so it has code execution by a shorter path |
| 2 | `we:AGENTS.md` row still promised the hook "runs it unasked" | fixed |
| 3 | `npm run bootstrap install` does not forward its argument | fixed |
| 3 | `knownGitDirs` imported by the test but never exercised — returning `[]` reddened nothing | fixed, and the new coverage is mutation-verified |

**The escalation is not a verdict on the diff.** The `correctness` lens never ran: `judge-spawn`'s
`DEFAULT_BUDGET_USD = 0.5` was set for a TOOL-FREE juror (#3028, 2026-08-09) and never revisited when
tool-bearing jurors arrived (#3072, 2026-08-12), so a tool-bearing seat is killed at turn 2 having spent
$0.596 — surfacing as `is_error, stop_reason: "tool_use"`, which reads like a crash. Re-running the
identical seat at `budget: 3.0` succeeded at **$0.69** and produced the two round-3 findings. The declared
operations are unaffected (`we:review-pr` / `we:review-prep` set `JUDGE_BUDGET_USD = 1.5`); only the converge
path inherits the old default, because nothing declares a budget for it. Filed separately against #3072.

## Preparation risk assessment

- **premise** — every claim above was probed in a live cloud VM, not inferred; the commands and their
  exact output are quoted in the commit messages.
- **legibility** — this is a retro-card. Items 4, 6 and 8 of the story-preparation checklist (decided
  design, tasks, de-risk-during-prep) are recorded rather than predictive, which is strictly weaker.
  The independent review is the compensating control, and it found four real defects.
- **blast-radius** — a durable host now writes nothing by default, so the change is a strict reduction in
  what an unattended run touches. The residual is a false-positive host detection on a workstation that
  exports `CCR_AGENT_PROXY_ENABLED` for unrelated reasons.
- **unmeasured-impact** — no measurement that a self-configuring VM session actually reduces setup cost
  across sessions; the argument is that every VM session so far redid it by hand, which is observed but
  not quantified.
