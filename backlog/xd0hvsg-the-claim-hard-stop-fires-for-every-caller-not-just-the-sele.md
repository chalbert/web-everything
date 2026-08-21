---
kind: task
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateStarted: "2026-08-21"
dateResolved: "2026-08-21"
tags: []
---

# the claim hard-stop fires for every caller, not just the selection flow it was written for

`we:scripts/backlog.mjs` claim emits the two-turn rename-and-stop block for every non-conveyor `active` claim. Its own comment says the opposite — *"emit the stop only for the decision claim (#1397)"* — and the discipline actually belongs to the `/next` selection flow, where the stop preserves the two-go arc and gets the chat renamed. Every other caller pays a wasted turn: `we:skills-src/batch-backlog-items/SKILL.md` passes a batch session slug and gets the stop despite its own rule that a batch labels the session once, and any directed claim is told to hand off to a rename that is never coming. Invert it: no stop by default, `/next` opts in.

## Found by paying it

Reported by the operator mid-batch: a directed claim of #3253 emitted the stop, and the session ended the turn obeying it. Batch A has three items, so the same turn would have been spent twice more.

## The evidence it was already known

- The code's own comment states the narrower intent and the code does not implement it. The condition is `claimedStatus === 'active' && !background` — no `kind` check anywhere.
- `--background` was the only escape and only the conveyor knew to pass it: an allow-list of one, added by #2621 for the one caller that complained.
- `we:skills-src/conveyor/prepare-decision-agent-brief.md` carried a prose workaround telling the agent the CLI *"may print an interactive ⏸ stop here / rename the chat message … you MUST ignore it"*. Instructing an agent to disobey its tool's output is the weaker fix — it works only where someone remembered to write it, and nobody wrote it for the batch path.

## Why inverted rather than gated on `kind`

Matching the stale comment would mean emitting the stop only for `kind: decision`. But the arc the stop protects is the **selection hand-off**, and `/next` runs that for a story exactly as it does for a decision — this item's own trigger was a `story`. The caller knows which flow it is in; the item's kind does not. So the caller asks: `--stop-for-rename`, passed by `we:skills-src/next-backlog-item/SKILL.md` and nothing else.

`--background` still wins when both are passed: it asserts there is no human to end the turn, so honouring the stop would stall an agent outright.

## Done when

1. **Executable** — `we:scripts/backlog.mjs claim <NNN>` with no flag emits no stop and no rename prompt; `claim <NNN> --stop-for-rename` emits both. Both pinned in `we:scripts/__tests__/backlog-cli-snapshot.test.mjs`, red before this lands.
2. **Executable** — `claim --background --stop-for-rename` reports `stop: false`, so an agent can never be stalled by a caller passing both.
3. The `/next` skill passes the flag; the batch and conveyor paths do not, and the prepare brief's prose workaround is deleted rather than left standing beside the real fix.
