---
bornAs: xvpy20j
kind: story
size: 3
parent: "3029"
status: open
scope: ["we:scripts/operations/explore-io.mjs", "we:scripts/operations/run-store.mjs"]
dateOpened: "2026-08-17"
tags: [operations, epic-3029, committee, security]
relatedTo: ["3150", "3037"]
---

# A committee panelist can still reach a sibling seat's report path, so blindness rests on instruction

The `explore` committee (#3150) names each panelist's report file after that attempt's minted session id,
stopping the one-token substitution a serialized panel used to allow. It does not make the id UNREACHABLE. Two
channels remain: the run records sit inside the checkout a panelist is started in, carrying every seat's handle
in plain JSON; and a panelist that has written its report keeps running, so it can attribute the next dispatched
session by diffing the agent listing. A subverted panelist can therefore still forge a neighbour's report — and
so the cross-lens agreement the synthesis trusts most. Close it structurally.

## The two channels, named

1. **The run store is inside the panelist's cwd.** `we:scripts/operations/run-store.mjs` resolves records to
   `<checkout>/.operations/runs/<id>.json`, and the sink starts a panelist in that same checkout because the
   checkout is what it investigates. The record carries every seat's `handle`, `panelist` and `brief` in plain
   JSON. The brief forbids reading it — and an instruction is not enforcement: nothing stops a `cat` from an
   agent that was handed the checkout and told to read code and run commands.
2. **A reported panelist keeps running.** The observer resolves off the report FILE (deliberately — the session
   lingers after an agent's last write, and ordering liveness first would report a finished investigation as
   running). Because the executor serializes the seats, exactly one new session appears when the next is
   dispatched, so a still-live panelist can attribute it by set-differencing `claude agents --json`.

## What is already in place, so this is a residual and not an open hole

`we:scripts/operations/explore-io.mjs#panelistReportPath` names the file after the attempt's minted session id
(so the derivable path is gone and a retry cannot inherit its predecessor's report), and
`we:scripts/operations/explore.mjs#buildPanelistBrief` forbids writing anywhere but the one path given, reading
the run records, and inspecting other sessions. Both are documented as raising the cost rather than closing the
channel — the docblock says so explicitly, which is what this item is the follow-through on.

## Candidate approaches

- **Move the run store out of the panelist's reach** — start the panelist with `OPERATION_RUNS_DIR` pointing
  outside its cwd, or start it in a directory that is not the record's home. Cheapest, and closes channel 1
  outright; needs care that the WAKER still resolves to the same store.
- **Do not let a reported panelist keep running.** Closes channel 2 and shortens every committee, but the
  observer would have to end a session it currently only observes.
- **Give each panelist a read-only view** rather than the live checkout. The heaviest, and the only one that
  also covers channels nobody has thought of.

## Done when

1. **Executable** — `npx vitest run scripts/operations/` passes with a test proving a panelist process cannot
   reach a sibling seat's handle through the chosen channel (e.g. the run store does not resolve under the
   spawn cwd), and the existing forgery tests in `we:scripts/operations/__tests__/explore.test.mjs` still pass.
2. `we:scripts/operations/explore-io.mjs`'s "what it does NOT close" note is rewritten to match what is then
   actually true — including deleting it if the channels are gone.
