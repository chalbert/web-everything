---
bornAs: xppjnof
kind: story
size: 5
status: resolved
blockedBy: []
scope: ["we:scripts/conveyor/", "we:skills-src/conveyor/"]
dateOpened: "2026-07-26"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Conveyor auto-heals a launched PR whose CI goes red after open (BEHIND / main-advance / flake), not just review:changes

The conveyor watches a launched PR only for TERMINAL states and only auto-repairs a review:changes bounce; a PR that was green at open but goes BEHIND / red on a required check after main advances (or a flake) silently stalls, since its delivery agent has exited and the drain skips a red-CI PR. Detect a conveyor-launched PR gone BEHIND / red-CI and auto-dispatch a red-CI fix-agent variant (reconstitute, rebase onto current main, diagnose+repair the failing check, re-push) bounded by N attempts, WITHOUT touching review:human/review:pending — only CI is repaired, the review gate stays for the human.

## Problem

The conveyor's merge watcher (`we:scripts/conveyor/pr-watch.mjs`) resolves each launched PR only on a **terminal** signal: merged, parked, timeout, closed, or error. Its one auto-repair path is a `review:changes` bounce, which re-dispatches a fix agent via the fix-agent-brief + rearm-review loop (#2630). There is no path for a PR that was **green at open** but later goes **red on a required check** while it sits.

The most common cause is `main` advancing under the branch: a sibling scope PR lands, the branch falls **BEHIND**, and its `test` job breaks against the new main (a flake is the other cause). When this happens nothing notices and nothing fixes it:

- The authoring **delivery agent has already exited** (one agent = one item = one PR), so there is no live owner watching that PR's checks.
- The **drain skips a red-CI PR** — a required check that is not green is not landable — so the PR silently stalls until a human happens to notice.

Observed 2026-07-26: PR #743 (item #2638) was green at pr-land; `main` then advanced as several scope PRs merged; the branch went **BEHIND** with `test: FAILURE`; only a human noticing surfaced it.

### Why #2183 does NOT cover this

#2183 (unify all edits behind ready-to-merge PRs / decouple the drain) has the drain rebuild a PR that is **BEHIND but landable**. But a PR parked `review:human` / `review:pending` is **NOT landable**, so #2183's rebuild never fires for it — the parked-and-BEHIND PR needs **rebase + CI repair while staying parked**. The review gate must remain untouched (the human still owes a verdict); only the CI half is repaired.

## Proposed behaviour

The conveyor (or the drain's watcher) detects a conveyor-launched PR that was **green-at-open but is now BEHIND and/or red on a required check**, and auto-dispatches a **fix agent (red-CI variant)**:

- Reconstitute the lane ref, **rebase onto current main**, diagnose + repair the failing check, re-push HEAD.
- Do **NOT** touch `review:human` / `review:pending` — the review gate stays for the human; **only CI is repaired**.
- Mirror the existing `review:changes` fix loop (#2630), but with a **red-CI / BEHIND trigger** in place of a `review:changes` label.
- **Bound it** — N repair attempts, then surface to the operator — to avoid a flap loop on a genuinely-broken diff.

## Related

- **Review-convergence cluster** — #2630 (auto-re-dispatch a `review:changes` bounce into its lane; this is the sibling loop to mirror), #2635 (bind/reconcile the jury roster at PR-open), #2285 (negotiated agent review for the drain). This item extends that cluster with a **CI-health** trigger alongside the review-verdict trigger.
- **#2183** (drain BEHIND-rebuild) — covers the **landable** BEHIND case; this item covers the **parked / not-landable** BEHIND case #2183 leaves unhealed (see *Why #2183 does NOT cover this*).

## Progress

Delivered as a 4th conveyor guard — the **CI-heal guard**, the CI-axis sibling of the `review:changes` fix guard (#2630):

- `we:scripts/conveyor/tick-core.mjs` — `planCiHealSpawns` / `retireCiHealGuards` / `clearTerminalCiHealAttempts` + predicates (`isCiHealTarget` / `isRedCi` / `isBehind` / `wasGreenAtOpen` / `isReviewParked`), wired into `planTick` (new `spawnCiHeals` decision, `ciHealGuards` / `ciHealAttempts` bookkeeping, `healing` status-line segment). Trigger: a conveyor-launched PR that was **green at open** and is now **red-CI** (`ci === 'fail'`) or **BEHIND + parked**; `review:changes` PRs excluded (owned by #2630). Bounded by a retry cap on `max(in-session, durable)`.
- `we:scripts/conveyor/ci-heal-mark.mjs` (new) — the durable CI-heal comment marker + `countCiHealComments`, the restart-surviving retry-cap floor (mirrors #2643). **No label swap** — CI is repaired, the review gate is not.
- `we:skills-src/conveyor/fix-agent-ci-brief.md` (new) — the CI-heal agent brief: reconstitute the ref → rebase onto `main` → repair the failing check → re-push → post the CI-heal comment → **never touch the review label** → exit.
- `we:skills-src/conveyor/SKILL.md` — new **§3c-ci** rule + updated §1/§2/§5 (decisions, bookkeeping, status line, briefs list, state-store paragraph).
- Tests: `we:scripts/conveyor/__tests__/tick-core.test.mjs` (+CI-heal guard cases) and `we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs` (new).

**BEHIND branch is dormant** until the PR row carries `mergeStateStatus` — that field lives in `we:scripts/readiness/conveyor-state.mjs` (out of this item's scope), so it is tracked by the follow-up task `#2738` (blockedBy 2666). The red-CI trigger — which is how the observed #743 incident actually manifested (`test: FAILURE`) — is fully live.

