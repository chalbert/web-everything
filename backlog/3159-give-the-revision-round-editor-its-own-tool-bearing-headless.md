---
bornAs: xl5jroq
kind: story
size: 3
status: open
blockedBy: ["3145"]
relatedTo: ["3028", "3050", "2439"]
dateOpened: "2026-08-17"
scope:
  - we:scripts/lib/judge-spawn.mjs
  - we:skills-src/drain/SKILL.md
  - we:skills-src/converge/SKILL.md
tags: [delivery, review, independence]
---

# Give the revision-round editor its own tool-bearing headless spawn (drain step 4 / converge edit)

[#3145] routed every independence-claiming **judgment** spawn — the drain's panel reviewer and validator
jury, converge's panel and red-team, harvest-learnings' skeptic, next-backlog-item's decision red-team,
brand-mark-loop's red-team — off the plain `Agent` tool and onto `judgePanel`
(`we:scripts/lib/judge-panel.mjs`) through the `we:skills-src/jury/panel-fanout.mjs` shim, so every juror is a
headless `claude -p` with its own `--session-id`.

It deliberately did **not** move the two **editor** spawns (the drain's step-4 revision round, converge's
`edit` action), for two reasons stated at the time rather than discovered later:

1. **An editor authors; it does not judge.** `judgeSpawn` is documented as "the one function a `judge` step
   calls", and its answer is a forced-schema findings object. A revision round is the other half of the loop.
2. **`assertLaneCwd` structurally refuses the converge case.** A tool-bearing juror must be given a lane clone
   that is *not the driver's own*. Converge's editor exists to edit precisely the driver's lane, so it can
   never satisfy that check as written.

## What is actually left owing

The invariant both loops assert is *"the panel never authors what it judges"*. After [#3145] that holds by a
one-sided argument: the **jurors** are now distinct headless actors, so the editor (which still carries the
driver's `CLAUDE_CODE_SESSION_ID`) is provably not one of them. That is a real improvement and it is enough
for the invariant as written — but the editor is still not an actor with a **recorded** identity, so nothing
in the round's record says *which* actor made the revision.

## Done when

1. A tool-bearing single-spawn shim over `judgeSpawn` exists and is callable from a skill (argv/stdin in,
   result JSON out — the same shape as `we:skills-src/jury/panel-fanout.mjs`), passing `allowedTools` plus a
   pool-lane `cwd`, and it is exercised by a test that asserts the spawn is refused when `cwd` is the
   driver's own lane.
2. The drain's step-4 editor round routes through it (it drives from the primary checkout, so a pool lane
   satisfies `assertLaneCwd` today).
3. Converge's `edit` action either routes through it or the item records the ruling that it **cannot** —
   naming `assertLaneCwd`'s driver's-own-lane refusal as the reason — so the next reader does not re-derive
   it.
4. `npm run check:standards` — 0 new errors.
