---
name: verify-session-liveness-before-archiving
description: Neither `claude agents --json`'s state field nor a `claude stop` SUCCESS is reliable proof a background dispatcher session is alive or gone — ground-truth the target item, then ask the session itself via SendMessage before archiving. (A `claude stop`/`rm` FAILURE, "No job matching," was traced to a wrong-ID-field bug in the caller, since fixed — not a genuine CLI limitation; see the correction inline below.)
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
- **CORRECTED 2026-09-04, same night this note was written:** this bullet originally claimed
  `claude stop <sessionId>`/`claude rm <sessionId>` reporting "No job matching" was ALSO not
  proof the session is gone, citing 4 sessions where `claude stop` said "no job matching" while
  the operator could see them still connected. **That framing was wrong — it was falsified later
  the same session.** The real, confirmed root cause: every failing call (this repo's own
  `we:scripts/conveyor/session-reaper.mjs`, and this note's own manual `claude stop` calls) was
  passing the full session `sessionId` (a UUID) to `stop`/`rm`, when those two specific
  subcommands need the SHORT 8-char `id` field instead (`--resume`/`attach` accept the full
  `sessionId` fine — it's specifically `stop`/`rm` that need the short form). Passing the short
  `id` worked immediately and repeatably: 3 independent single-session tests, then a
  151-session bulk clear, 151/151 successful. Fixed in `we:scripts/conveyor/session-reaper.mjs`
  (PR #1879, merged), which now uses the short `id` and documents the correct field in its own
  comments. So a failed `claude stop`/`rm` lookup was NOT a genuine CLI-reliability gap — it was
  a caller-side bug, now fixed. **This correction is itself an instance of the exact lesson in
  [[question-a-concluded-external-limitation-before-accepting-it]]: a note declaring an external
  CLI limitation was itself wrong, and the mistake was caught and fixed later the same night it
  was written.** See that note for the fuller record.
- **Still separately true, and NOT affected by the correction above:** a `claude stop` that
  reports SUCCESS is not proof of exit — documented per the #3435 card itself, citing filed
  upstream Claude Code issues #65925/#45250/#41461. This is a different claim about a different
  direction (success, not failure) and a different underlying cause (upstream CLI behavior, not
  a wrong ID field); do not read the correction above as touching it.
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
