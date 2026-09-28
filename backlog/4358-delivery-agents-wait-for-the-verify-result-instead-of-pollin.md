---
bornAs: xevbh9g
kind: story
size: 3
status: open
scope: ["we:scripts/verify-lane.mjs", "we:scripts/lib/lane-verify.mjs", "we:skills-src/conveyor/delivery-agent-brief.md", "we:skills-src/conveyor/delivery-agent-brief-v2.md"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "d0ca633fdd77999f8e9ac61e0ee330544ab494eb"
tags: []
---

# Delivery agents wait for the verify result instead of polling it every few seconds

Today's we:skills-src/conveyor/delivery-agent-brief.md has agents loop node we:scripts/verify-lane.mjs check --json every few seconds across turns for 10-45 minutes waiting on a request-then-poll gate (#2833/#3105), burning tokens and process churn on a result that only changes once. Give we:scripts/verify-lane.mjs a blocking wait mode (poll internally, return only on a settled green/red), or have the brief itself sleep on the .lane-verify marker file with a bounded wait, and update we:skills-src/conveyor/delivery-agent-brief.md's request-then-poll steps to use it instead of the per-turn poll loop.

## Codex review correction (folded 2026-09-28)

A read-only Codex plan review (`node we:scripts/codex-direct-task.mjs --review`) read the actual live files and
found three real problems with the plan below (kept, corrected):

- **`we:skills-src/conveyor/delivery-agent-brief-v2.md` has no request/poll steps to change.** It is an
  explicitly non-live PROTOTYPE whose own header states verification mechanics move OUT of the agent's brief
  entirely, into a wrapper (`we:scripts/operations/deliver-item-wrapper.mjs`, itself not wired in). There is
  nothing in v2 for this card to update — it is dropped from Scope. If the wrapper design is ever built for
  real, ITS OWN polling shape is that item's concern, not this one's.
- **A brand-new `wait` subcommand would be denied to the callers who need it.** `we:scripts/guard-bash.mjs`'s
  `SANCTIONED_VERIFY_LANE_QUERY` allows a dispatched agent to run only `we:verify-lane.mjs request|check|reset` —
  a new verb is not on that list and would need a guard change (plus its own guard test) to ever reach a
  dispatched agent. **The regex only checks the subcommand word, not what follows it** — a bounded-wait
  FLAG added to the EXISTING `check` subcommand (e.g. `we:verify-lane.mjs check --wait=<ms>`) already matches
  `SANCTIONED_VERIFY_LANE_QUERY` unchanged, so implementing the new behavior as a `check` flag, not a new verb,
  avoids the guard change entirely. This is now the stated mechanism (Tasks item 2, below), not an open fork.
- **The live brief's actual wording is "poll again next turn," not "every few seconds."** The "every few
  seconds" framing (this card's own title/digest) is the operator's own stated evidence for how the loop plays
  out in practice, not a literal instruction the brief gives — worth keeping the real quote straight so the
  live-proof step (below) measures the right thing (invocation COUNT and elapsed time, not a specific cadence
  the brief never actually prescribed).
- **Missing risk, folded in below:** `verifyGateDecision` (`we:scripts/lib/lane-verify.mjs`) can return `ok:
  true` for `break-glass` and `untracked` verdicts that are NOT a verified green — the new wait mode must treat
  `green`/`red` as the only two states that end a wait as "settled," and decide explicitly what `corrupt`,
  `break-glass`, and a HEAD move mid-wait (the tracked sha stops matching) each do, rather than conflating any
  `ok:true` with "done."

## Scope

- **we:scripts/verify-lane.mjs** — add a bounded-wait FLAG to the existing `check` mode (e.g. `--wait=<ms>`),
  not a new subcommand (see correction above for why this specific shape matters).
- **we:scripts/lib/lane-verify.mjs** — the shared marker reader + `verifyGateDecision` core both `verify-lane`
  and `pr-land` already call; the new flag is built on this, not a re-derivation of marker-reading logic.
- **we:skills-src/conveyor/delivery-agent-brief.md** — the request-then-poll steps at the mid-work gate AND the
  final-HEAD verify step (the live text: "poll again next turn," no stated interval, `check --json` on a loop).
- ~~we:skills-src/conveyor/delivery-agent-brief-v2.md~~ — **dropped from scope** (Codex correction above: no
  request/poll steps exist there to change).

## Risks

- **A literal in-process blocking wait must stay inside the tool's own safe foreground window.** The `--wait`
  flag blocks up to its own bounded ceiling (well under the tool's timeout) and returns a "still pending" status
  if the marker hasn't settled by then — the agent's own turn loop, not one Bash call, does the multi-minute
  waiting, at a much coarser interval than a per-turn `check` with no wait. we:CLAUDE.md's own pinned rule (never
  end a turn assuming a backgrounded call will wake the agent) still applies unchanged: this fix cuts how OFTEN
  the agent has to check, not whether it must keep checking to completion in the foreground.
- **Only `green`/`red` may end a wait as "settled."** `break-glass` and `untracked` are `ok:true` verdicts that
  are NOT a verified result (see correction above) — the new flag must not treat any `ok:true` as done. `corrupt`
  should end the wait with an explicit error (matching `check`'s own existing non-waiting behavior), never loop
  silently.
- **A HEAD move mid-wait.** If the tracked sha stops matching the marker's `sha` while a wait is in progress
  (a new commit landed on the lane), the wait must detect and report this distinctly from "still running" —
  waiting on a marker for a sha that is no longer HEAD is not the same as "not yet settled."
- **`we:scripts/verify-lane.mjs check` has other callers** expecting today's fast, non-blocking marker read
  (humans, other scripts); `--wait` is additive and opt-in, so `check`'s default (no flag) behavior is
  unchanged.

## Test plan (each fails before the fix)

1. `we:scripts/verify-lane.mjs` unit test: given a marker that settles to green after N simulated poll
   intervals (fake clock, fake marker reads), `check --wait=<ms>` returns as soon as it settles rather than
   waiting out the full ceiling, and returns a bounded "still pending" result if the marker has not settled by
   the ceiling.
2. A `break-glass`/`untracked` verdict during a wait does NOT end it as settled; only `green`/`red` do. A
   `corrupt` marker ends the wait with an explicit error, not a silent retry.
3. A HEAD move mid-wait (the marker's `sha` stops matching the tracked sha) is reported distinctly from "still
   pending."
4. `grep -n` over `we:skills-src/conveyor/delivery-agent-brief.md`: the request-then-poll sections reference
   `check --wait=` (a named interval/ceiling), not the old bare "poll again next turn" loop with no stated
   cadence.
5. A real dispatched-agent invocation of `we:verify-lane.mjs check --wait=<ms>` is NOT denied by
   `we:scripts/guard-bash.mjs`'s `SANCTIONED_VERIFY_LANE_QUERY` (confirms the flag-not-verb shape actually
   avoids the guard change).
6. **Live proof** — count ALL `we:scripts/verify-lane.mjs check`/`--wait` tool invocations (not just literally
   renamed calls) a delivery session makes across one full gate wait, before vs after this change, on a
   comparable gate duration, plus the wall-clock elapsed time.

## Tasks

1. Add `--wait=<ms>` to `we:scripts/verify-lane.mjs`'s existing `check` mode, built on
   `we:scripts/lib/lane-verify.mjs`'s existing marker read + `verifyGateDecision` — no new marker vocabulary,
   no new subcommand (see the Codex correction above for why the flag shape specifically matters).
2. Handle the terminal-state distinctions from Risks explicitly: only `green`/`red` settle a wait; `corrupt`
   errors immediately; a HEAD move is reported as its own case, not folded into "still pending."
3. Update `we:skills-src/conveyor/delivery-agent-brief.md`'s request-then-poll sections (mid-work gate and
   final-HEAD verify) to use `check --wait=`.
4. Confirm (Test plan item 5) the new flag is not denied by `we:scripts/guard-bash.mjs` for a dispatched agent.
5. Gate with the `verify` operation; open with `open-pr`; run the proof plan below.

## Proof plan (live, before/after)

- **Before:** a real delivery session's transcript shows N separate `we:scripts/verify-lane.mjs check --json`
  calls across turns for one gate wait — record the real count and the real elapsed time.
- **After:** the same real wait, on a gate of comparable duration, shows materially fewer total invocations
  using `check --wait=` — record the real count and elapsed time for comparison, not just an assumption that
  renaming the call reduced anything.
