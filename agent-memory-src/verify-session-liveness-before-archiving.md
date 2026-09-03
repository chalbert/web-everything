---
name: verify-session-liveness-before-archiving
description: Neither `claude agents --json`'s state field nor `claude stop`'s success/failure is reliable proof a background dispatcher session is alive or gone in either direction — ground-truth the target item, then ask the session itself via SendMessage before archiving.
metadata:
  type: feedback
---

Until epic #3383's own mechanical reaper (`we:backlog/3435-*.md`) ships, closing out background
dispatcher sessions (`conveyor-*`/`prepare-*`/`fix-*`/`review-*`) has NO reliable single signal —
every individual check lies in at least one direction, confirmed live across one long session
(2026-09-02/03):

**What's unreliable, both ways:**
- `claude agents --json`'s `state` field can show `working`/`idle` for a session that finished
  hours ago (real PR already merged) — a false "still alive."
- `claude stop <sessionId>` reporting "No job matching" is ALSO not proof the session is gone —
  hit this directly: `claude stop` said "no job matching" for 4 sessions the operator could see
  were genuinely still connected in their own UI. Re-confirmed via `SendMessage` to the same
  session names: all 4 accepted the message successfully, and the tool's own result noted them
  "connected via Remote Control." So a failed `claude stop` lookup is a false "already gone,"
  not a real one.
- A `claude stop` that reports SUCCESS is separately documented (per the #3435 card itself,
  citing filed upstream Claude Code issues #65925/#45250/#41461) as not proof of exit either.
- `SendMessage` reporting a target as "not reachable" is not proof of exit either — it's the
  same class of tool-side liveness check as the other two, not automatically more trustworthy
  just because it failed differently. A verification pass in this same session concluded 4
  sessions (`conveyor-3399`, `conveyor-3411b`, `prepare-decision-3457`, `prepare-3452`) were
  "already gone, no action needed" purely because `SendMessage` couldn't reach them — without
  independently re-confirming via the operator's own view (their UI showed several OTHER
  sessions as connected when tool-side checks said otherwise, the exact catch that motivated
  this whole note). Treat an unreachable `SendMessage` the same as a failed `claude stop`: a
  hint, not a verdict.

**The verification order that actually worked:**
1. **Ground-truth the target item FIRST, independent of any liveness signal.** Check the item's
   real `status:` frontmatter in a checkout that's actually synced to `main` (not a long-lived
   diverged branch checkout — that can be stale for its own reasons, see
   [[keep-local-main-current-after-merge]]), and cross-check `gh pr list --search "#NNN" --state
   merged` for a real, correctly-attributed landed PR.
2. **Never conclude "dead" from the registry's `state` field or from `claude stop` alone.**
   Instead `SendMessage` the session by its name and ask it to self-confirm: does it have real
   work left, does it hold a lane lease. A successful message delivery is itself a stronger
   liveness signal than either of the two checks above.
3. **Wait for the session's own reply before archiving anything.** It can tell you things no
   outside check can: e.g. a fix-kind agent correctly explained it deliberately did NOT release
   its own lane, because the fix-agent-brief (#2630 step 9) explicitly forbids a fix agent from
   releasing/merging/clearing review — that's the conveyor's own cleanup job, not a stuck session.
4. Only archive once EITHER the session self-confirms nothing pending (and any lease is released
   or correctly left per its own brief), OR the target item is independently confirmed resolved
   via real PR history AND `SendMessage` came back unreachable — an unreachable `SendMessage` is
   never sufficient by itself, it's the same weak signal as a failed `claude stop`, so require the
   PR-history confirmation alongside it, plus the operator's own visual confirmation when
   available (see the unreliable-both-ways bullet above).

**Why:** operator, 2026-09-03: "please verify that would really cant see them, I see all of them
as connected" — caught me about to treat several genuinely-live sessions as safe to archive based
on a `claude stop` false negative alone. Asked directly afterward to save this so the next session
isn't confused the same way before the real mechanical fix lands.

**Supersede this note once #3435 (its own subject) actually ships** — this is a manual stopgap
procedure, not the intended end state.
