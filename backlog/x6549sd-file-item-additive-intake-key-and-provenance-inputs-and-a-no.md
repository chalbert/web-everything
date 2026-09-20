---
kind: story
size: 3
parent: "3740"
status: open
scope: ["we:scripts/operations/file-item.mjs", "we:scripts/operations/scaffold.mjs", "we:scripts/backlog/scaffold.mjs", "we:scripts/operations/__tests__/file-item.test.mjs", "we:skills-src/file-item/SKILL.md"]
dateOpened: "2026-09-20"
tags: []
---

# file-item: additive intake key and provenance inputs, and a non-operator card is never queued

Adds two optional inputs to the file-item operation, an intake key and a provenance, written into the new card frontmatter, and makes file-item refuse to clear any card whose provenance is not the operator or orchestrator. This keeps one intake run write-only: many cards land in one working tree and one pull request, none of them visible to the conveyor. Design-first, uncleared.

Slice of epic #3740 (design point 4). Filed uncleared: a design review comes before any build.

## Design

**Settled (read from the code, not from the epic's wording).**

- `file-item` never commits, stages or opens a pull request. Its header says landing is not folded in, and the skill's landing sequence is add and commit, then `verify`, then `open-pr` (`we:skills-src/file-item/SKILL.md`). So one intake run is N `file-item` calls in one lane clone, then one verify and one open-pr. The epic's "stage-only flag" is therefore not a git-staging flag. The only thing `file-item` does beyond writing the card is the queue clear (`FILE_ITEM_QUEUE_EFFECT`, `we:scripts/operations/file-item.mjs:68` and the `queueAdd` step at `:183`), and `--queue=false` (`:141`) already turns it off.
- What is really missing is two things. (a) Somewhere for the key and provenance to live: `renderItem` (`we:scripts/backlog/scaffold.mjs:79`) emits a fixed field set and `planScaffold` (`we:scripts/operations/scaffold.mjs:111`) forwards only known inputs. (b) A guard so a careless wrapper cannot clear a card: the queue clear writes into the live runner's sidecar, outside the git tree (`resolvePath`, `we:scripts/operations/file-item-io.mjs:69`), so a wrongly cleared card is visible to the conveyor before its pull request is even reviewed.
- Two new optional inputs, `intakeKey` and `provenance`, written into the card frontmatter. Absent means today's behaviour exactly, so no existing caller changes.
- A provenance other than `operator` or `orchestrator` forces `queueing: false` in `planQueueing` (`we:scripts/operations/file-item.mjs:97`) with a named reason, even when `--queue=true` is passed explicitly. This check runs first and wins over any other rule.
- The guard is defence in depth, not proof: `file-item` receives provenance as a string and cannot verify it. The verified derivation lives in the line-contract slice (derived from the real file path, never from content).

**Open (settle in the design review).**

1. Field shape: flat `intakeKey` and `provenance` keys, or one nested `intake` map. Check whether the backlog loader (`we:src/_data/backlog.js`) and `check:standards` tolerate unknown keys (`scaffoldedBy` is the precedent) and whether the provenance value should be validated against a fixed set.
2. Should an unknown provenance value fail closed (refuse the write) or be treated as non-operator (file, never queue)? Leaning fail closed, but that is a refusal reason the operation has not had before.
3. Overlap with #3587: it edits the same `planQueueing` and the same test file to let epics and decisions be queued. Not a `blockedBy` edge (that task is unrelated in purpose), but the two must be ordered or landed together, and the composition rule is stated above: provenance is checked first.

## Done when

1. **Executable** — `node --test we:scripts/operations/__tests__/file-item.test.mjs` includes new cases that fail today and pass after: `planQueueing({ kind: 'story', status: 'open' }, { queue: 'true', provenance: 'worker' })` returns `queueing: false` with a reason naming provenance; the same call with provenance `operator`, or with none, is unchanged; and a run given `intakeKey` and `provenance` writes both into the new card's frontmatter.
2. **Executable** — a conveyor-eligibility test in the same suite: `file-item` run with provenance `worker` against a temporary queue sidecar leaves that sidecar byte-identical, and `planTick` (`we:scripts/conveyor/tick-core.mjs:1010`) fed the state read from that sidecar has no build spawn for the new card.
