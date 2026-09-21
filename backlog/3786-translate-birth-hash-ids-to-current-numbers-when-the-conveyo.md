---
bornAs: x238swe
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/conveyor/queue-store.mjs", "we:scripts/conveyor/queue.mjs", "we:scripts/conveyor/queue-work.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/conveyor-state.mjs"]
relatedTo: ["3605", "3567", "3570", "3478"]
dateOpened: "2026-09-21"
tags: []
---

# Translate birth-hash ids to current numbers when the conveyor queue sidecar is read (ratified #3605)

Build the ruling of [#3605](/backlog/3605-jit-renumbering-never-re-keys-the-conveyor-queue-sidecar-so/):
a conveyor-queue entry stored under a pre-land birth hash must still match its card after the drain renumbers it
to `#NNN`. One pure translation step in `we:scripts/conveyor/queue-store.mjs` maps each stored id through the
`bornAs` values on the backlog the reader already loads. Nothing in the drain changes and the drain never writes the
sidecar.

## Scope of the change

1. **One pure step, one place.** Add `canonicalizeQueue(queue, aliases)` to `we:scripts/conveyor/queue-store.mjs`
   (aliases = `Map<normNum(bornAs), NNN>`). It deduplicates by the translated key and keeps the first `addedAt`.
   It also keeps the original spelling so `list` can print it (`parseQueue` drops unknown fields today, so extend
   it or carry a side map). Apply it **once per IO shell, right after the sidecar is read**. Do not thread an alias
   map through `selectClearedRows`, `clearedNotReady`, `shapeQueue`, `deriveClearedNotReady` or `readinessOf`:
   their signatures and tests stay unchanged.
2. **Readers.** `we:scripts/readiness/dispatch-plan.mjs` loads the backlog *before* matching (today it loads after,
   at the `byNum` block) and builds the alias map from it. `we:scripts/readiness/conveyor-state.mjs` (the
   `shapeQueue` `buildQueued` read and `deriveClearedNotReady`) gets the same map. If the backlog load fails, both
   fall back to today's behaviour.
3. **Operator CLIs are the only writers.** `we:scripts/conveyor/queue.mjs` and `we:scripts/conveyor/queue-work.mjs`
   translate before `addToQueue` / `removeFromQueue` and write the corrected queue back, so `remove <NNN>` removes
   an entry stored under its hash and any operator action leaves correct ids on disk.
4. **`list` shows both spellings.** A translated entry prints `#NNN (cleared as <hash>)`.
5. **No write-back from the dispatch tick** and none from the drain (#3605 Fork 2 (a), Fork 1 (b)). Under
   `--backlog-dir` the tick translates against the fixture corpus in memory only.

## Done when

1. **Executable** — `npx vitest run` on the new queue-store, dispatch-plan and conveyor-state cases passes. They
   fail on `main` today and pass after:
   - a sidecar entry stored as a hash whose card now carries that `bornAs` selects the card as a cleared, ready row;
   - the same entry with no ready row appears in `cleared-but-not-ready` under its **current number**, not the hash;
   - a hash entry and its number added together collapse to one;
   - `remove <NNN>` removes an entry stored under its hash;
   - `list` prints `#NNN (cleared as <hash>)`;
   - a failed backlog load leaves matching exactly as it is today.
2. **Existing coverage unchanged** — the current `selectClearedRows`, `clearedNotReady`, `shapeQueue` and
   `deriveClearedNotReady` tests pass without edits.
3. **Live evidence** — against the real `we:.conveyor/queue.json`, the hash-keyed entries whose cards have landed
   no longer show as `cleared-but-not-ready` in the tick output.
4. `npm run check:standards` green.
