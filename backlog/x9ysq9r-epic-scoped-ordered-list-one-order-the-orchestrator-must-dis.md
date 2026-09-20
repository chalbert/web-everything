---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/operations/suggest-next.mjs", "we:scripts/operations/suggest-next-io.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Epic-scoped ordered list: one order the orchestrator must dispatch from, and what a design-first card does in it

FOUND 2026-09-20. Operator: the orchestrator must not choose priority; "we had an ordered list already, and if not there should be". Checked in the code and live 2026-09-20:
- The scope this card assumed ALREADY exists. `we:scripts/operations/run.mjs suggest-next` takes `--parent`, `--tag` and `--locus` (#3213, resolved). `suggest-next --parent=3383 --limit=50 --json` returned the epic's ranked children. It is a filter over the board's own order: `applyScope` in we:scripts/operations/suggest-next.mjs only removes items and never reorders (by design, #3213).
- The output is capped. `MAX_LIMIT` is 50 in we:scripts/operations/suggest-next.mjs (the declaration vocabulary has no numeric range, so the value is clamped rather than refused). With `--parent=3383` the pool holds 63 eligible tier-A items and shows 50, and there is no offset or paging, so 13 are unreachable. Cards 3768, 3769, 3770, 3771, 3775 and 3756 are not among the 50 shown (tier A or tier B); they are presumably among the hidden 13, which cannot be confirmed without an offset. Unscoped, the board holds 601 tier-A items and the same cap applies.
- The order is the readiness ranker's, not a priority anyone set: leverage, then smaller, then number (per the handoff's description of the ranker; the shown `why` field reads "leverage 1001 (frees 1, gates 1)"). Epic #3593 ranks second in the scoped list, ahead of small tasks.
- Design-first cards that are not cleared DO appear in the ranked pool. Cards 3767, 3752, 3744 and 3772 to 3774 are in the scoped top 50. So the list already mixes cards that are not ready to build (design review owed) with cards that are.
- The operator's other "ordered list", the cleared list, is a gitignored per-checkout file, we:.conveyor/queue.json, holding only an id and a time per entry. It has no rank field, and three checkouts gave three answers today (1 entry, none, 4). So it is neither one list nor an order.
- The tracker card's "owed" lists are unordered prose (the latest Session update ends with a free-text Owed line).
- #3736 point 3 wants /wip to show "the TOP planned items, ranked" from the unified planned list, and #3740 (track) owns intake of planned work. Nobody owns the order.

OVERLAP, NAMED. #3213 (resolved) built the scope filter; this card does not rebuild it. #3736 and #3740 consume or feed an order and do not define one. The delta is: who owns the order the orchestrator must dispatch from, and closing the cap.

DESIGN TO SETTLE.
1. Where the order lives. (a) The ranker scoped to the epic, with the cap and paging fixed. No new store. The order stays leverage-first, which the operator did not set. (b) An explicit operator rank (a frontmatter field or a sidecar order) that the ranker honours first and leverage second. (c) (a) as the default with (b) as an operator override only when the operator gives one. Recommendation: (c) minimal, starting from (a). The operator has to say whether leverage order is acceptable to them at all before anything is built.
2. The cap. Add an offset or a `--all`, or lift `MAX_LIMIT` when a scope is given, or add a truncated count to the output ("13 more not shown"). Settle whether to add a numeric range to the declaration vocabulary or a second field.
3. What a design-first card does in the order: it stays in the list, marked not buildable ("design review owed"), so the order says what comes next instead of hiding it or offering it as a build. Interaction with the clearing gate that the design-review operation epic (#3770) proposes.
4. Epics in the list: an epic is not a build item; show its next slice or mark it, and do not let it take rank 2.
5. The rule the orchestrator follows: dispatch only from the top of this order (respecting blockedBy and the worker cap), and any departure is written to the tracker with the reason. Settle whether that is enforced at dispatch time (the dispatch step takes the next item from the order) or stays an instruction.

## Done when

1. **Executable** — a test over a fixture board with 60 or more items under one parent: the scoped query returns all of them or states how many were cut ("N more not shown"), and the order equals the unscoped order restricted to that scope.
2. **Executable** — a fixture with an uncleared design-first card shows it in the order marked "design review owed", and not as buildable.
3. **Executable** — live: `we:scripts/operations/run.mjs suggest-next --parent=3383 --json` reports every eligible child (63 on 2026-09-20) or the number it cut, and cards 3768, 3769, 3770, 3771, 3775 and 3756 can each be found in it or shown as excluded with a reason.
4. **Human verify** — the operator confirms the ordering rule (leverage by default, or an operator rank), and the orchestrator's handoff and /continue text name this order as the only source of dispatch order.
