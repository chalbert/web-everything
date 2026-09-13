---
name: no-stray-sessions-or-orphaned-watchers
description: Never leave an unused peer session sitting idle, and never let a dispatched agent's own background watch/monitor process outlive the work it was watching — clean up before reporting done, or don't create it in the first place.
metadata:
  type: feedback
---

Before creating a peer session or a background watch/monitor process, have a concrete
reason it is needed **right now** — not a speculative "might be useful later." And once
a dispatched agent's actual work is done (a PR reviewed, a delivery completed), it must
stop any background watch/monitor process it started for that work **before** reporting
completion. A report of "done" should mean nothing from that work is still running
behind it — not "done, and also something is still ticking that I forgot about."

**Why:** two real incidents found during live investigation under this epic (#3383), same
session, same night:

1. A peer Claude session (`173aed73`) was created at 16:08 UTC and sat completely idle —
   zero dispatched work, ever — for 2.5+ hours until a human manually pinged it. It cost
   nothing to run, but it was pure orchestration debt: a resource created "just in case"
   with no task attached to it, discoverable only by someone happening to notice it.
2. Multiple background shell "watch" tasks — spawned by subagents to monitor a PR review
   or a delivery run — kept running for 55+ minutes **after** the work they were watching
   had already completed and been reported. The dispatching agents finished, reported
   success, and simply never circled back to stop their own monitors.

Both are the same failure shape: the orchestration layer (this interactive session, and
the agents it spawns) created something to track a piece of work, then lost track of the
tracker itself once the work was done or never started.

**The line the user drew:** monitoring that is built into the actual mechanical
runner/driver system — `session-reaper.mjs`, `driver-watchdog.mjs`, the
`clear-stuck-session` operation — is fine and wanted; that is real infrastructure doing
its job. What is NOT acceptable is the orchestration layer leaving its **own** loose
ends: a stray idle session or an orphaned watcher that nobody but the mechanical reaper
would ever notice or clean up. Don't rely on the reaper to mop up what you personally
spawned — stop it yourself, at the point you stop caring about the answer.

Related but distinct: [[long-watch-agents-cant-self-diagnose-their-reporting]] is about
an agent giving vague status reports once stuck in a watch loop — a *reporting* failure.
This rule is about the loop outliving its own purpose in the first place — an
*infrastructure cleanup* failure, upstream of and separate from whether its reports were
any good. Both trace back to the same standing bar in
[[root-cause-over-workaround-standard]]: routing around a symptom (pinging an idle
session, noticing a stale watcher) is never the accepted fix — the standing fix is not
creating the loose end, or closing it the moment its purpose ends.
