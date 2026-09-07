---
bornAs: x9650wc
kind: story
size: 5
parent: "3383"
status: resolved
scope: ["we:scripts/operations/file-item.mjs", "we:scripts/operations/file-item-io.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/declared-homes.mjs", "we:skills-src/file-item/SKILL.md"]
dateOpened: "2026-09-06"
dateResolved: "2026-09-07"
tags: []
---

# Route every new backlog item's filing through a declared file-item operation, never a hand-composed prompt

Filing an item today is a card plus a separately-remembered `we:scripts/conveyor/queue.mjs add` gesture, so every session drives it by hand — confirmed live 2026-09-06, when every item this session filed went through a hand-dispatched Agent-tool subagent with a bespoke prompt, exactly the mechanical-delivery-doctrine rule 2 violation that rule has always applied to BUILD dispatch but never to filing. A PROTOTYPE now exists on `origin/lane/mechanical-dispatcher`: `we:scripts/operations/file-item.mjs`/`we:scripts/operations/file-item-io.mjs` wrap scaffold's own read/plan/write (reused, not re-derived) plus a second effect that clears the card via `we:scripts/conveyor/queue-store.mjs`'s pure core — closing the file-to-queue hand-off gap `we:scripts/conveyor/tick-core.mjs`'s planTick only ever reads cleared (buildQueued) rows from. A `we:skills-src/file-item/SKILL.md` skill states the never-hand-roll framing (mirrors `/pr`'s own). This item tracks GRADUATING the prototype: promote the file-item operation plus its wiring in `we:scripts/operations/run.mjs` and its entry in `we:scripts/operations/declared-homes.mjs` to main via the normal story/PR pipeline once proven stable under live dispatcher use; also decide whether gating (e.g. widening `we:scripts/backlog-guard.mjs`'s existing hand-numbered-file DENY from numeric-only to any new backlog file created via the Write tool) should land as part of the same graduation or separately, and migrate the skills that still teach raw `we:scripts/backlog.mjs scaffold` (next-backlog-item, prepare-decision-item, new-standard, split-backlog-item, batch-backlog-items, consolidate-backlog-items) to file-item's framing.

## Done when

1. **Executable** — `we:scripts/operations/run.mjs file-item --help` succeeds from a checkout tracking
   `main` (today it only succeeds on `origin/lane/mechanical-dispatcher`), and
   `git log --oneline main -- we:scripts/operations/file-item.mjs` is non-empty.
2. At least one skill among `next-backlog-item`, `prepare-decision-item`, `new-standard`,
   `split-backlog-item`, `batch-backlog-items`, `consolidate-backlog-items` names
   `we:scripts/operations/run.mjs`'s `file-item` verb instead of a raw `we:scripts/backlog.mjs scaffold`
   call, and `we:scripts/check-standards.mjs`'s #3224 skill-wiring scan reports it clean.
3. A decision is recorded (here, or as a follow-up item) on whether `we:scripts/backlog-guard.mjs`'s
   hand-numbered-file DENY should widen from numeric-only to any new backlog file created via the `Write`
   tool — and, if yes, that widening has landed with its own updated regression test.

## Update — 2026-09-07

Done-when item 1 is now satisfied: `we:scripts/operations/file-item.mjs`/`we:scripts/operations/file-item-io.mjs`
and their `we:scripts/operations/run.mjs` + `we:scripts/operations/declared-homes.mjs` wiring graduated from
`origin/lane/mechanical-dispatcher` to `main` in this PR (cherry-picked from `2056414d7`, "not yet graduated"
language in the code/comments/skill reworded to reflect landing). `we:scripts/operations/run.mjs file-item
--help` and an end-to-end filing + queue-add smoke test both passed from a checkout tracking `main`. Items 2
(skill migration to the `file-item` verb) and 3 (the `we:scripts/backlog-guard.mjs` DENY-widening decision)
remain open follow-up work — this PR does not touch either, so `status` stays `open`.
