---
kind: task
status: open
dateOpened: "2026-08-08"
tags: [gate, footgun, lane]
---

# Nothing stops an agent destroying work in a lane leased by another session

The lane guard protects the primary checkout only. It has no lease or owner check, so a raw git reset --hard inside a lane held by a different session is unguarded and can wipe uncommitted or unpushed work.

## The near-miss (2026-08-08)

A read-only review subagent had a directory mix-up and ran `git reset --hard` inside
`lane-1`, which at that moment held a **live lease belonging to a different session** and
three commits of in-progress work for PR #984. Nothing refused the command. The agent
noticed, recovered the tip from `git reflog`, and nothing was lost — but only because it
happened to check.

Had the work been uncommitted rather than committed, the reflog would not have saved it.

## Why nothing stopped it

- `we:scripts/guard-lane.mjs` refuses edits to the shared **primary** checkout (#2123). It
  has no notion of a lease or an owner — grep it for `lease`, `owner`, or `foreign` and
  there are no hits. Every lane looks equally writable to it.
- `we:scripts/guard-bash.mjs` gates tree-writing commands **at the primary cwd**. Inside a
  lane it deliberately steps back, which is the whole point of lanes — so a destructive git
  command in *someone else's* lane passes both guards.
- The lease is advisory. `we:scripts/lane-pool.mjs` honours it (`acquire` refuses a live
  lease, `release` checks ownership), but the lease is only consulted by the pool CLI. Raw
  `git` in the directory never consults it.

So the protection model today is "the pool hands out lanes correctly", with nothing behind
it if a caller reaches a lane by path instead of by the pool.

## Why it matters more than it looks

The whole delivery flow is lane clones, and sessions routinely run many subagents at once —
this session had eight live at one point, each holding a lane. Lane directory names are
near-identical and differ only by a trailing number, agents pass them around as strings, and
a stale path from earlier in a transcript is an easy mistake. The blast radius is another
session's unpushed work, which is the one thing in this system with no backup.

## What to consider

- A `PreToolUse` check on `Bash` that refuses a destructive git verb (`reset --hard`,
  `clean -fd`, `checkout -f`, `stash`) when the resolved cwd is a pool lane whose lease
  marker names a **different** session. Cheap, deterministic, script-decidable — the
  hookable-vs-judgment rule says this belongs in a hook, not in a brief.
- The same check belongs on `Edit`/`Write` in `we:scripts/guard-lane.mjs`, for the same
  reason it already refuses the primary.
- Decide what an agent with no lease at all should be allowed to do in a lane — today it is
  everything. A read-only agent arguably should not be writing to any lane.
- Whatever the rule, the deny message must name the remedy (acquire your own lane) rather
  than just refusing, or it becomes the next false-deny footgun — see #2986 and #2994 for
  what that costs.

## Done when

- A destructive git verb inside a lane leased by another session is REFUSED, with a message
  naming the lease holder and the remedy.
- The same protection covers the `Edit`/`Write` path, not just `Bash`.
- Your OWN leased lane is unaffected — no new friction on the normal flow. Pin this with a
  must-allow test, not just a must-deny one.
- A lane with no lease at all behaves per whatever the item's ruling decides, and the ruling
  is recorded.
