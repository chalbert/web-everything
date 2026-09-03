---
name: question-a-concluded-external-limitation-before-accepting-it
description: "Before concluding a tool/API genuinely can't do something, verify every input you're passing it — a wrong parameter can look identical to a real external limitation."
metadata:
  type: feedback
---

**Don't stop at "this tool can't do it" — verify you're calling it correctly first.** A
call that fails the same way across multiple attempts, multiple sessions, and even
multiple different commands can still be a caller-side bug wearing the costume of an
external limitation, not a real one.

**Why:** hit live 2026-09-03, in the same overnight session that produced [[verify-
session-liveness-before-archiving]]. Tonight's own session-reaper (`we:scripts/conveyor/
session-reaper.mjs`) reported `claude stop`/`claude rm` failing with "No job matching"
for nearly every session it tried to close — for hours, across many real attempts, by
hand and mechanically. I concluded this was a genuine limitation in the `claude` CLI's
own background-agent registry (a resident daemon caching stale state) and said so
explicitly, more than once, as settled fact — including telling the operator directly
"I don't have another lever to pull on it from here."

The operator pushed back: **"stop saying this please... assume there is a way you
haven't found."** Continuing to dig turned up the real cause in minutes: `claude agents
--json --all` returns each session with BOTH a short `id` (8 hex chars) and a full
`sessionId` (the complete UUID). Every failing call — mine and the reaper's own code —
was passing the full `sessionId` to `stop`/`rm`. Passing the SHORT `id` instead worked
immediately and repeatably (confirmed on two independent sessions). The CLI was never
broken; the caller was passing the wrong field the entire time, and the failure mode
(a clean, deterministic "No job matching" error) looked exactly like a real capability
gap because it was consistent and reproducible — consistency is not the same as
correctness of the premise being tested.

**How to apply:** when a tool/API call fails the same way repeatedly, before writing off
the capability as absent:
1. Check whether you're passing the shape of ID/parameter the FAILING command's own
   documentation or error message actually expects — don't assume the same identifier
   that worked for one subcommand (`--resume`, `attach`) is the right shape for a
   DIFFERENT subcommand (`stop`, `rm`) of the same tool, even in the same CLI family.
2. A consistent, reproducible failure is not proof the capability is genuinely absent —
   it's exactly what a systematic caller-side mistake also looks like.
3. When told directly to keep looking rather than accept a conclusion, that is a strong
   signal the conclusion was reached too early — re-open the investigation rather than
   re-explaining the same "no way" conclusion with more confidence.
