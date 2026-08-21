---
bornAs: xefpfd2
kind: task
status: open
dateOpened: "2026-08-02"
tags: [agent-tooling, closing-session, cost, lane-guard, backlog-cli]
---

# Cost-on-card accrual is unreachable at close — the lane-only guard blocks it and the close may not open a PR

The `closing-session` skill's cost-on-card step tells the close to accrue the session's usage-equivalent cost onto
the card(s) worked. In this repo it cannot: `we:scripts/backlog.mjs cost` is blocked in the primary checkout by the
lane-only mutation guard (#2431), and the close's own hard rules forbid opening a PR for anything but memory. So the
step silently no-ops every close. Evidence: a grep for `costUsd` / `costTokens` / `costSessions` across all 2 829
backlog items returns **zero** matches — no card has ever carried a cost since the guard landed.

## Gap

Three rules are individually right and jointly unsatisfiable:

1. `we:scripts/backlog.mjs` dies with *"Every card mutation (cost/claim/resolve/…) must run in a LANE clone"* —
   `cost` is named explicitly, with no carve-out (#2431, resolved 2026-07-28; #2219/#2339 ratified that nothing ever
   splices to primary).
2. The closing-session skill's cost step calls `we:scripts/backlog.mjs cost` directly and says "the card edit folds
   into the clean auto-commit" — it has **no** lane-provisioning logic, unlike the memory path in the same skill,
   which does provision a lane and open a PR.
3. The close's hard rules say never push and never open a PR, with a single carve-out for memory.

An interactive top-level session runs from the primary checkout and delegates edits to lane clones, so path 2 is the
common case and it always hits the guard.

`we:docs/agent/platform-decisions.md` already states the intended design — "the cost-on-card splice either fold into
an already-PR'd lane commit or are session-meta under this carve-out" — but nothing implements the folding when the
closing session itself runs from primary.

## Why it matters

Cost-on-card exists so a card carries its true cumulative cost across its whole life (`/prepare` then `/decide` then
build summing into one running total), which is the input to the batch point-budget and to any cost-per-item
reasoning. Every session's figure is currently discarded, and nothing reports the omission — the close prints a
dollar total and moves on, so the gap reads as "no item worked" rather than "blocked".

## Mechanical fix

Pick one:

- **(a) Local-signal carve-out.** Treat `cost` like the sanctioned session-meta writes
  (`we:.claude/skills/batch-backlog-items/claims.json` and its class) and allow it on primary. Cheapest, and
  defensible: a cost accrual is per-session bookkeeping, not durable reviewable content. Cost: it is real frontmatter
  on a tracked file, so it weakens the "nothing splices to primary" invariant #2339 ratified — this fork needs an
  explicit call, not a quiet exception.
- **(b) Lane-route the accrual in the skill.** Give the close's cost step the same lane→PR machinery its memory step
  already has. Keeps every invariant intact; costs a PR per close for a frontmatter line.
- **(c) Defer the accrual.** Have the close write the figure to a session-meta file (already a sanctioned local
  write) and let the next lane commit that touches the card fold it in.

**(b)** is the smallest change that breaks nothing; **(a)** is the smallest change overall but reopens a ratified
invariant.

## Re-grounded before building — two claims above have gone stale

**The "zero matches" evidence is no longer literally true, and the corrected figure is still damning.**
Measured on this branch: **4** of **3191** backlog items carry `costUsd:` / `costTokens:` frontmatter, not
zero. So the accrual does land occasionally — presumably from closes that happened to run inside a lane
clone — which makes the failure *intermittent and invisible* rather than total. Re-measure at build time;
the criterion below is a delta, not the absolute number.

**(b) is no longer the smallest change that breaks nothing — it may not be available at all.** The close
skill's memory path this option was modelled on **does not exist any more**. `we:.claude/skills/closing-session/SKILL.md`
now says the close "emits the lesson to the pool" and `/harvest` lands it via lane → PR, and states flatly:
*"The close never opens a PR — no carve-out. The former memory-PR exception is gone."* So (b) means adding
lane→PR machinery to the close in direct contradiction of an explicit rule in the same file, not reusing an
existing precedent. Any build choosing (b) is amending that rule and must say so.

That reweighs the fork. **(c)** is now the option with a live precedent, and it is the same shape the
learnings pool already took for the identical problem: collect locally at close (a sanctioned session-meta
write — the `we:.claude/skills/batch-backlog-items/claims.json`-class carve-out the skill names), adjudicate/land elsewhere. **(a)** is unchanged —
cheapest, but it reopens the #2339 "nothing splices to primary" invariant and needs an explicit ruling.
State which one is taken and why, in the PR body.

## Design

**The guard is one regex and it is not `cost`-specific.** `we:scripts/guard-bash.mjs` denies on
`BACKLOG_MUTATION`, a single pattern matching a `node we:scripts/backlog.mjs <verb>` invocation for
`claim|resolve|release|scaffold|settle|retype|yield|cost|prepare-stamp`, checked by the exported
`isBacklogMutation`. `reason()` fires it when `primaryCwd` is true, with the denial text the digest quotes
verbatim. Option (a) is therefore a one-token change plus a deliberate ruling — which is precisely why it
must be a ruling and not a quiet edit.

**Note the guard's verb list is wider than its own message.** The message enumerates
"claim/resolve/scaffold/settle/retype/yield/prepare-stamp" while the regex also matches `release` and
`cost`. A caller denied on `cost` reads a message that does not name `cost`. Whatever fork wins, fix the
message to match the pattern — it is the same "the message asserts something that isn't so" failure class
as #2897/#2902.

**The write itself is already correct and needs no change.** The `cost` verb in `we:scripts/backlog.mjs` accrues the cumulative
`costTokens` breakdown and derives `costUsd` through the one shared rate table
(`we:scripts/backlog/cost-rates.mjs`), bumping `costSessions`. Nothing about the accrual's *semantics* is
in question here — only where it is allowed to run. A build that starts editing the cost verb has drifted.

**Whatever wins, the silent no-op must end.** Today the step fails and the close prints its dollar total and
moves on, so a blocked accrual is indistinguishable from "no item worked". That is the property that let
this go unnoticed, and it is worth fixing even in the fork where the accrual still cannot happen.

## Done when

- A cost accrual attempted from the primary checkout no longer silently discards the figure. Whichever fork
  is taken, this is provable by a unit case over the guard's pure predicate (`isBacklogMutation` /
  `reason`) in `we:scripts/__tests__/`, failing before and passing after:

  ```
  npx vitest run scripts/__tests__/guard-bash.test.mjs
  ```

- The guard's denial message enumerates every verb its pattern actually matches — `cost` and `release`
  included. Cheap check: each verb in `BACKLOG_MUTATION` appears in the message string.
- The coverage delta is measured, not asserted: the count of items carrying `costUsd:` frontmatter rises
  across closes after the change. Baseline **4 / 3191** on this branch — re-measure before and after:

  ```
  grep -l '^costUsd:' backlog/*.md | wc -l
  ```

- The chosen fork is stated in the PR body with its cost. If **(a)**, it names the #2339 invariant it
  narrows and why a cost accrual is not durable reviewable content. If **(b)**, it names the
  "close never opens a PR" rule in `we:.claude/skills/closing-session/SKILL.md` that it is amending. If
  **(c)**, it names the session-meta file and the lane commit that folds it in.
- The close reports a blocked or deferred accrual instead of passing over it silently — a reader of the
  close's Footprint line can tell "nothing to attribute" from "could not attribute".

## Provenance

Found at the close of the human `/review` session on **PR #982** (2026-08-02), when the cost step was run and the
guard refused it. Red-teamed before filing: the problem is real (verified in `we:scripts/backlog.mjs` and by the
zero-match grep), not a duplicate (#2431 is the guard itself, resolved; #2779 is unrelated plateau SaaS build
metering), and actionable. Related: #2431, #2339, #2219.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion, ahead of implementation) — Verified directly: we:scripts/guard-bash.mjs:105 includes `cost` in BACKLOG_MUTATION, line 1268-1269 denies it unconditionally when primaryCwd (no override, per #2339), we:skills-src/closing-session/SKILL.md calls the `cost` verb of `we:scripts/backlog.mjs` with no lane-provisioning, and line 61 states 'The close never opens a PR — no carve-out.' All three legs of the card's 'jointly unsatisfiable' claim hold against the live repo.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — Card measured the real corpus (`grep -l '^costUsd:' backlog/*.md`) before proposing a fix and got 4 (my checkout, 167 commits behind origin/main, shows 4/3162 vs. the card's 4/3191 — same numerator, expected count drift, not a defect); the card explicitly frames this as a delta to re-measure rather than an absolute, which is the right call given a moving corpus.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — we:scripts/guard-bash.mjs's `reason`/`isBacklogMutation` are exercised via the PreToolUse hook (`we:.claude/settings.json`, subprocess path) and via ES imports in we:scripts/__tests__/guard-bash.test.mjs and we:scripts/mine-golden-corpus.mjs (`decide`) — both already assert `cost` is denied from primary (`we:scripts/__tests__/guard-bash.test.mjs`), so any fork touching guard behavior will visibly redden these before the card's own 'Done when' vitest run passes again; no golden-corpus fixture pins a `cost`-specific case, so no stale-snapshot risk there.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The card designs the round-trip check itself: a unit case over the guard's pure predicate (`isBacklogMutation`/`reason`) in we:scripts/__tests__/guard-bash.test.mjs, run via a targeted `npx vitest run` over `we:scripts/__tests__/guard-bash.test.mjs`, explicitly required to fail before and pass after — this is the correct seam (neither the guard's owner nor the skill's owner alone) for whichever fork is picked.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Confirmed by reading we:scripts/guard-bash.mjs:1269 — the denial message lists claim/resolve/scaffold/settle/retype/yield/prepare-stamp but omits `release` and `cost`, which the regex at line 105 does match. No existing test asserts message-completeness (checked we:scripts/__tests__/guard-bash.test.mjs, all message assertions are just `/must run in a LANE clone/`), so this drift is currently undetectable by CI — exactly what the card's own 'Done when' bullet ('each verb in BACKLOG_MUTATION appears in the message string') is designed to close.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — Card measured the corpus before sizing the fix (4/3191 cards carrying costUsd) and re-grounded its own recommendation (moving from (b) to (c) as best default) after discovering that the closing-session skill's memory-PR precedent had been removed since the card was first drafted — the mechanical-fix section was updated in light of that, not left stale.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Verified: the close's verdict template (`we:skills-src/closing-session/SKILL.md`) only distinguishes '→ #NNN' from 'not attributed (slice/resolve/no dominant item)' — a guard-denied accrual is indistinguishable from a session with no item worked. The card's final 'Done when' bullet directly targets this ('a reader of the close's Footprint line can tell nothing to attribute from could not attribute').

**Corrections recommended:**

- none — the preparation held up as written.

The card's premises all check out against the live repo — the BACKLOG_MUTATION regex, the unconditional primary-cwd denial, the closing-session skill's direct un-lane-provisioned cost call, the 'never opens a PR' rule, and the message/verb-list mismatch are all verified byte-for-byte in `we:scripts/guard-bash.mjs` and `we:skills-src/closing-session/SKILL.md`, and the card already self-corrects its own earlier evidence (zero-match → 4/3191) rather than leaving it stale.

_Recorded through the declared `review-prep` operation._
