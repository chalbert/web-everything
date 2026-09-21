---
bornAs: xjsr7pa
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/operations/wip-report.mjs", "we:scripts/operations/wip-report-io.mjs", "we:scripts/operations/wip-report-cli.mjs", "we:scripts/operations/__tests__/wip-report-readable.test.mjs"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
preparedAgainstSha: "afd7d5118eeee0afa4c4a2cac0f1259eb3fda9ae"
blockedBy: ["xa1hqo9"]
tags: []
---

# /wip report is readable on a phone: full-word descriptions, no truncation, Needs you first, Next from the Priority order

Operator (2026-09-21, from a phone; recorded as rule 4 in the operator rules file): the /wip report is too long, is not focused on what the operator must see, gives no description of a work item, and cuts titles with an ellipsis, which makes a cut title useless on a phone. This card makes the report readable on a phone. REQUIREMENTS. (1) Every work item row carries a description in plain words, in full, wrapped onto more lines, never cut with an ellipsis. (2) The default view is four parts, in this order. (a) NEEDS YOU: the operator-queue script NEEDS YOU section, verbatim, unchanged. (b) RUNNING: a compact table with ID, description, supervisor agent, and its tasks with the agent on each task; the supervisor and executor data already exists in the `--sessions` view (we:scripts/operations/wip-agents.mjs). (c) QUEUE: an ordered list of the same rows (ID, description, tasks) with NO agent column, because the queue is routed mechanically. (d) NEXT, not yet queued: a similar table (ID, description, planned tasks, Priority-order list line number) for the operator to review and approve into the queue. (3) NEXT is taken from the first dispatchable lines of the `## Priority order` in epic #3383 card (read from the prototype branch), skipping claimed, blocked, operator-decision and already-in-flight lines and anything already in QUEUE; each row shows its list line number and a one-line why. (4) The long Done-since table and the internal Attention findings leave the default view and stay available behind a flag such as `--full`, the way `--bullets` and `--sessions` exist. (5) A test renders the report over a fixture and fails if any line ends in an ellipsis, any row lacks a description, the four parts are out of order, a part has the wrong columns, or the QUEUE part has an agent column. Amendment 2026-09-21 (operator, relayed by the continuation session): the RUNNING, QUEUE and NEXT split replaces the first wording, "then what is running, then Next"; the no-ellipsis, full-description and flag-hidden-Done-since rules are unchanged. RELATION TO OTHER CARDS (read 2026-09-21). #3736 (open on main; its build is in commit c952d29fe on the prototype branch, graduation owed) specified work item titles cut to about 18 characters and three short columns, plus compact Done-since and Attention tables. This card SUPERSEDES that one clause (the 18-character cut, `TITLE_MAX` in we:scripts/operations/wip-report.mjs) and the default Done-since table. It does not reopen the rest of #3736: the queued, gap and overdue handling of Attention findings stays as built, only hidden from the default view. #3767 (the deployed /wip command is hand-edited and its source is stale) is a separate concern and is not folded in; the command text is not touched here. PROTOTYPE WORK. The code (we:scripts/operations/wip-report.mjs, we:scripts/operations/wip-report-io.mjs, we:scripts/operations/wip-report-cli.mjs) exists only on lane/mechanical-dispatcher, so this build is prototype work under epic #3383: commit straight to lane/mechanical-dispatcher, no PR, one tracker note per push. Not blocked: the code it changes already exists there.

## Done when

1. **Executable** — vitest run (`npx vitest run`, run on `lane/mechanical-dispatcher`) on we:scripts/operations/__tests__/wip-report-readable.test.mjs passes. The test renders the default report over a fixture and asserts: (a) no output line ends in an ellipsis (`…` or `...`); (b) every row in RUNNING, QUEUE and NEXT has a non-empty description; (c) the four parts appear in the order NEEDS YOU, RUNNING, QUEUE, NEXT; (d) RUNNING has the columns ID, description, supervisor agent, tasks (with the agent on each task), QUEUE has ID, description, tasks and NO agent column, and NEXT has ID, description, planned tasks, Priority-order line number. Before: the file does not exist, and the current compact report cuts titles at `TITLE_MAX = 18` with `…`, so (a) fails on the same fixture.
2. **Executable** — NEEDS YOU is verbatim: a test feeds the operator-queue script's NEEDS YOU section (the fixture text) in and asserts the report's first part equals it line for line.
3. **Executable** — NEXT comes from the Priority order: a test gives the parser a fixture of epic #3383's `## Priority order` with claimed, blocked, operator-decision and already-queued lines mixed in, and asserts NEXT holds only the first dispatchable lines, each with its correct list line number.
4. **Executable** — the default view drops the long tables: with the same fixture, the default output has no `## Done since` heading and no `## Attention` heading, and the report CLI we:scripts/operations/wip-report-cli.mjs run with `--full` (on `lane/mechanical-dispatcher`) prints both. `--full` is listed in the CLI's `KNOWN` flags beside `--bullets` and `--sessions`.
5. **Executable** — the existing report tests still pass: `npx vitest run` on all `wip-report*` tests under we:scripts/operations/__tests__ exits 0, with the `TITLE_MAX` cut assertions of #3736 updated in the same commit.
6. **Human verify** — the operator opens `/wip` on a phone and reads it top to bottom without an ellipsis, with a description on every row, Needs you first.

## Design (prepared 2026-09-21)

*Prepared by session `prepare-3809-design` for a design review (operator rule 7: "If unsure we should have a design review"). Nothing here is ruled and nothing is built. The operator rules each fork; the **bold** option is the recommended default.* Code references are to the prototype branch `lane/mechanical-dispatcher` at `5ab89f87b` (the report exists only there); backlog references are to `main` at `afd7d5118`. No `/research/` topic: the method's prior-art survey is for greenfield design, and this card changes an internal report whose shape the operator already specified (rule 4), so the grounding is the live data below, not a web survey.

**What the real report shows today** (run 2026-09-21 13:54 EDT against live data, `node we:scripts/operations/wip-report-cli.mjs`): 7 work-item rows, 4 of them cut with `…` (the PR title `#3735 ratified a…`, and session names such as `file-3779-followu…` and `prepare-3809-desi…`); 28 Done-since rows, all 28 cut (`/Users/nicolasg…`, because a completion record's outcome is a result-file path); the Attention block first; `## Needs you` last. Item rows carry no title at all (`title: ''`, we:scripts/operations/wip-report.mjs:281), and session rows none either (:285). The raw `--sessions` view lists 11 live sessions; every Executor cell reads `none` and every Supervisor cell is the session's own model (`claude-sonnet-5`, `claude-opus-5`, or `unknown`).

**Supported by default (not forks):**
- No `…` anywhere in the default view: the description cell loses the `cut` / `TITLE_MAX = 18` path (we:scripts/operations/wip-report.mjs:473-487); long text wraps with the existing `wrap()` at `WRAP_AT = 42` (:372-383).
- NEEDS YOU is `parseNeedsYou()` unchanged (:233-241), the operator-queue script's own lines.
- An unreadable source is still named in the default view (the module's NEVER GUESS rule, :21-22): one `Source error:` line each, as today (:583).
- `--bullets` and `--sessions` stay as they are; `--bullets` keeps its own `clip()` at 36 characters (:114, :421), because the requirements are about the default view.

### Fork 1 — Where a row's plain-words description comes from

*Fork-existence:* every row needs one description, and the candidate sources disagree on wording, coverage and cost; the report must pick one order.

Measured on `main` (3785 cards): no card has a `digest` or `description` field (0 of 3785); 15 have `shortTitle`, which the lint bounds to 42 characters, 3 to 5 words (we:scripts/check-standards.mjs:1082-1091); card titles are long and technical (#3720's is 157 characters, #3725's names `list --acquirable` and `--lane`). The Priority order's rule 5 gives every #3383 line a plain-words why (`N. #card · size · band · why`, "On-path lines say the manual step removed or the blocker cleared", #3383 card, branch, line 36), for example line 23: "#3725 · 3 · A · Clears: lane availability is miscounted, so dispatch launches too few or too many." Brief-file workers carry `input.item` and `input.brief` in their run record (the `dispatch-task` run records under the operator's coordination runs folder; 51 records, e.g. `build-3736` with `item: "3736"`), and 124 of 125 briefs start with a `TASK:` line. A review worker such as `review-2389` binds to a PR (we:scripts/conveyor/session-verdicts.mjs:66-73) whose title the report already holds (we:scripts/operations/wip-report.mjs:268).

- (a) The card title, in full, wrapped. Rejected as the first choice: titles are written as specs, with code names and flags, and run 3 to 4 phone lines; kept as the fallback.
- (b) `shortTitle`. Rejected: 15 of 3785 cards have one, and 3 to 5 words is a label, not a description.
- (c) A new `digest` / `description` field. Rejected for now: it does not exist on any card, so it needs a filing rule and a backfill before it shows anything.
- (d) The first sentence of the body. Rejected: bodies open with provenance, not a description (this card opens "Operator (2026-09-21, from a phone; recorded as rule 4 …)").
- (e) The dispatch brief's TASK line. Rejected as a primary source: only brief-file workers have one, and it is an instruction paragraph, not a description; used only to find the item.
- (f) A model-written summary cached per item. Rejected: a model call per new item is a real cost, a cached summary goes stale when the card is re-scoped, and the module states "Nothing here is composed by a model" (:12).
- **(g) A fixed fallback chain, all deterministic — recommended.** For a card: its Priority-order why (with the `Clears:` / `Removes:` lead kept), else its full title. For a PR row: the card the PR names (`#NNNN` in its title or branch), else the PR title. For a session: the card its run record names (`input.item`), else the card its name names (`build-3724`, `prepare-3809-design`), else the PR it binds to, else its brief's TASK line up to the first full stop. Last resort: `no description: <why>` naming the missing source, so a row is never blank. The chain's source is shown nowhere; the test pins it per row kind.

*Skeptic:* the why goes stale when priority-sync lags ("new lines wait for a worker to write their why", #3383 card, branch, line 24). Answer: a line with no why falls through to the title, which is never stale. The why also exists only for #3383 cards; the title covers the rest.

### Fork 2 — What "supervisor agent" and "the agent on each task" mean in today's data

*Fork-existence:* the RUNNING columns name data that is only partly real today; the report must either show what exists, or wait for data that does not exist yet.

What exists. `pickSupervisor` takes a dispatch record's `supervisorModel`, else the transcript's last assistant model (we:scripts/operations/wip-agents.mjs:115-121). `pickExecutor` takes the dispatch record's `executor`, else a transcript scan for `codex-direct-task` / `gemini-direct-task` calls (:122-126, :75-110). Measured: 0 of the 51 dispatch records in the run store carry `supervisorModel`, 0 carry the #3717 `routedProvider`, and `executor` is always written `null` (we:scripts/operations/dispatch-lane-io.mjs:1283-1310). So "Supervisor" is today the session's own model, and "Executor" is `none` unless the session itself called Codex or Gemini. The supervision tree, which has exactly this shape (a supervisor plus tasks each with an agent), is a pure contract with no runtime caller (we:scripts/lib/dispatch-supervision-tree.mjs:62, :100, marked "no runtime caller in slice G1"); wiring it is the owed "Graduation G2" line of the #3383 Priority order ("Owed, no card yet").

- (a) Wait for the supervision tree (G2) and leave the columns out until then. Rejected: the card requires the columns now, and G2 has no card.
- (b) Use only the #3717 routing record (`routed` / `executed`). Rejected as the only source: 0 of 51 records have it, so every row would read unknown.
- **(c) Show the best source present, in a fixed order — recommended.** Supervisor: the supervision tree's supervisor when a plan exists; else the dispatch record (`executed`, plus `(routed <provider>)` when the two differ); else the session's model from `pickSupervisor`, shortened (`opus-5`). Tasks: the tree's tasks, each with its agent, when a plan exists; else one line per delegation found (`codex <model>`); else `none (works alone)` when the transcript scan was complete, and `not known` when it was not (the existing `source: 'unknown'` vs `'transcript'` split, :125). Today every row will read `<model>` and `none (works alone)`, which is true.
- (d) Show the session name as the supervisor. Rejected: the name is already the row's handle; it says nothing about which agent works.

### Fork 3 — What QUEUE is, and where a row's (planned) tasks come from

*Fork-existence:* the card names a QUEUE but no single queue record exists; and an item not yet started has no task list, so something must stand in for one.

**3a. What QUEUE holds.** Measured: the clear-for-build frontmatter `buildQueued: true` is on 8 cards, all resolved, and `node we:scripts/backlog.mjs build-queue --next` prints "build queue empty"; the conveyor sidecar (`node we:scripts/conveyor/queue.mjs list`, the one the dispatch plan pulls from, we:scripts/readiness/dispatch-plan.mjs:501-531) is empty; the owed PR dispatches of land-advance (the report's present `## Next`, we:scripts/operations/wip-report.mjs:340-342) are real and mechanical; and the orchestrator's actual "Queued next" list lives as prose in the operator's handoff file (the operator ruled on 2026-09-21 that the queue source is the Priority order, not `suggest-next`).

- (a) Parse the handoff prose. Rejected: free text, not a record; it would break on the next rewording.
- (b) `buildQueued: true` frontmatter. Rejected: each approval would need a card edit landed by PR to `main`.
- **(c) The two mechanical queues the runner already acts on — recommended.** First the land-advance owed dispatches (review / fix / ci-heal a PR), then the items cleared in the conveyor sidecar, in Priority-order line order. Approving a NEXT row means `node we:scripts/conveyor/queue.mjs add <N>`, a command that exists. Today QUEUE will read "empty" — true, and it shows that the orchestrator still queues by hand (#3720, #3777). *Build note:* the sidecar path is per checkout (`resolveQueuePath`, `CONVEYOR_QUEUE_FILE` override, we:scripts/conveyor/queue-store.mjs:142-145); the report must read the runner's file, not its own checkout's.
- (d) A new queue file written by an "approve" command. Rejected: a third queue beside the two the runner reads.

**3b. Planned tasks for an item not yet started.** Measured: no supervision plan records exist (3a's G2 point); the delivery-agent brief's steps are the same for every item; the dispatch plan already maps each item to one outcome by card kind, scope and blockers (build, needs-slice, needs-decision, unshaped → auto-prepare, investigate; we:scripts/readiness/dispatch-plan.mjs:24-40); and the card-kind to task-type map is fixed (we:scripts/lib/dispatch-contracts.mjs:83).

- (a) The brief's steps. Rejected: identical on every row, so they carry no information.
- (b) The routing table's task type and provider. Rejected for QUEUE and NEXT: it names an agent, and QUEUE has no agent column by the operator's rule.
- **(c) The fixed step list of the dispatch outcome — recommended.** Build → `build, review, land`; unshaped → `prepare, build, review, land`; decision → `prepare forks, you rule`; epic → `slice first`; owed PR row → `review`, `fix` or `ci-heal`. When a supervision plan exists (after G2), its task titles replace the list. With no card data at all: `no plan yet`.

### Fork 4 — What "dispatchable" means for NEXT, and how many rows

*Fork-existence:* the card lists skip reasons (claimed, blocked, operator decision, in flight, queued) but some of them are recorded nowhere mechanical; the report must either guess from prose or get a marker.

Measured by parsing all 135 numbered lines of the Priority order (#3383 card, branch, lines 22-210) against card status on `main` and the branch: a filter on status, claimed, band A, not an epic or decision, and open `blockedBy` leaves 49 "dispatchable" lines, and 4 of its first 5 are wrong. #3717 (line 6) is built on the branch (`0f1d0fb8f`) and its choices wait on decision #3801; #3656 (line 15) is built (`5ab89f87b`); #3486 (line 12) waits on #3804 per the operator's handoff; #3653 (line 2) is named by decision #3805. None of these gates is in the build card's `blockedBy`: #3801 and #3805 point back only through their own `relatedTo`. A branch commit whose subject starts `#NNNN ` marks a card as built and waiting to graduate (#3717, #3656, #3724, #3730, #3736 all have one).

- (a) Frontmatter only. Rejected: 4 of the first 5 rows wrong today.
- (b) Parse the why text ("blocked on", "waits for", "follows"). Kept as one signal, rejected as the rule: it catches #3487, #3726, #3397, #3398, #3562 but none of the decision gates.
- (c) A report-only marker on the Priority-order line (`· held: #3801`). Rejected: a second copy of the dependency that the ranker and the dispatch plan (`openBlockers`, we:scripts/readiness/dispatch-plan.mjs:26) never read, so the two drift.
- **(d) Mechanical checks plus `blockedBy` as the one gate record — recommended.** Skip a line when: the card is resolved or claimed (on `main` or the branch); its band is not A; it is an epic or decision; a `blockedBy` entry is open; a branch commit subject starts with its number (built, graduation owed); a live session or open PR binds to it; it is already in QUEUE; or its why says "blocked on" / "waits for". Decision gates become `blockedBy` entries on the gated card (#3717 → #3801, #3486 → #3804, #3653 → #3805), filed as a separate backlog change, not by this build. **Rows: the first 5**, each with its line number and why; `--full` shows 10.

### Fork 5 — What the default view drops, and what `--full` keeps

*Fork-existence:* the operator asked for no long Done-since table and no internal findings; but `/wip` stamps the Done-since cursor on every run (the deployed command runs `--stamp`; we:scripts/operations/wip-report-cli.mjs:31), so a table hidden by default would silently lose what landed between two reads.

- (a) Drop Done-since and Attention from the default view, nothing else. Rejected: with `--stamp`, landings between two default reads are never seen.
- (b) Stamp only on `--full`. Rejected: the Done window would then grow without end on a phone-only day.
- **(c) One summary line instead of each block — recommended.** Default view, in order: the time line; NEEDS YOU; RUNNING; QUEUE; NEXT; then one line `Since 11:04: 11 PRs landed, 17 sessions finished (--full lists them)` (the 13:54 live counts); then source errors, if any. When the runner is not live, QUEUE gets one line "the queue does not move: the runner is not live", because that changes what the operator expects. `--full` prints everything the report prints today: the header (load, workers, runner, old PRs, queue count), Attention with its queued / gap / overdue notes, Done-since in full, the land-advance Next lines, and the docket count line. Nothing the operator relied on is removed; it moves behind `--full`.

### Fork 6 — Where the build runs, and what graduating it would cost

*Fork-existence:* the card says prototype, but the report is the operator's daily view and the branch is far behind `main`; building on `main` instead is a real alternative.

Measured (`git cat-file` on `origin/main`, 2026-09-21): none of we:scripts/operations/wip-report.mjs, we:scripts/operations/wip-report-io.mjs, we:scripts/operations/wip-report-cli.mjs, we:scripts/operations/wip-report-queue.mjs, we:scripts/operations/wip-agents.mjs, we:scripts/operations/land-advance.mjs, we:scripts/conveyor/session-verdicts.mjs or we:scripts/lib/dispatch-contracts.mjs exists on `main`; we:scripts/operations/operator-queue.mjs exists only on `main` (the report reaches it through `findRoot`, we:scripts/operations/wip-report-io.mjs:40-44). The branch is 256 commits ahead of `main` and 504 behind. Decision #3804 (how the branch keeps up with `main`, and its Fork 4, when a slice may graduate) is prepared 2026-09-21 and not ruled (no `## Ruling`); graduation itself is epic #3443 (claimed).

- (a) Build on `main`. Rejected: the report's whole import graph (eight modules) would have to graduate first, which waits on #3804.
- **(b) Build on `lane/mechanical-dispatcher`, no PR, one tracker note — recommended**, as the card already says. Graduation is not part of this card: it rides #3443 with the rest of the report after #3804 is ruled, at the cost of the eight modules above and their tests.

### Fork 7 — How a row is laid out on a phone (added by this preparation)

*Fork-existence:* a markdown table keeps each row on one source line, so a full, never-cut description makes the table wide; "compact table" and "wrap, never ellipsis" cannot both hold for a table row. The compact tables of #3736 stay narrow only because they cut cells to 35 characters a row (`ROW_MAX`, we:scripts/operations/wip-report.mjs:471). How the operator's phone renders a wide markdown table was **not verified** here.

- (a) Markdown tables with full cells. Rejected: the width then depends on the viewer; if it scrolls sideways, the description is off screen, which is the complaint.
- **(b) One short block per row, fields on their own lines — recommended.** A bold ID line, the description wrapped at 42 columns, then `supervisor:` and `tasks:` lines (RUNNING), `tasks:` (QUEUE), `planned:` and `line N` (NEXT). The test checks the field labels per part instead of table columns. Sample, built from the 13:54 live data:

```
## Running
**#3809** prepare-3809-design
/wip report is readable on a phone:
full-word descriptions, no truncation,
Needs you first, Next from the Priority
order
supervisor: opus-5
tasks: none (works alone)

## Queue
Empty.
The queue does not move: the runner is
not live.

## Next (approve: add it to the queue)
**#3657** line 16
Clears: lane acquire prints npm output
into the lane path, so a fresh lane can
be unusable.
planned: build, review, land
```

- (c) A narrow table (ID, tasks) with the description as a `- ` note under it. Rejected: the description, the part the operator asked for, becomes a footnote.

### Which Done-when items each fork touches

| Fork | Done-when items |
|-|-|
| 1 description source | 1(b), 6 |
| 2 supervisor and task agents | 1(d), 6 |
| 3 QUEUE and planned tasks | 1(d), 6 |
| 4 dispatchable for NEXT | 3, 6 |
| 5 default vs `--full` | 2, 4, 5 |
| 6 where it is built | 1, 4, 5 (all run on the branch) |
| 7 row layout | 1(a), 1(d), 5, 6 |

### Proposed Done-when edits (not applied; for the ruling)

- **1(d)**, if Fork 7 (b) is ruled: "has the columns" becomes "each row has the labelled fields": RUNNING `supervisor:` and `tasks:`; QUEUE `tasks:` and no `supervisor:` or agent field; NEXT `planned:` and `line N`.
- **1(b)**: add "and the description comes from the Fork 1 chain: the fixture has a Priority-order card (why), an unlisted card (title), a PR with no card (PR title) and a brief-file session (its run record's item); the test asserts each row's text."
- **1**, new (e): "a RUNNING row whose transcript scan is incomplete says `not known`, and one with a complete scan and no delegation says `none (works alone)`."
- **2**: as written it fails today, because the renderer prefixes each line with `- ` (we:scripts/operations/wip-report.mjs:581). Say which is wanted: "each NEEDS YOU line equals the operator-queue line, with no prefix added" (recommended), or "… after a `- ` prefix".
- **3**: add fixture lines for a card with a branch build commit, a card with an open `blockedBy` decision, a band-B line and an epic line; assert NEXT holds exactly the first 5 dispatchable lines.
- **New 3b**: "QUEUE lists the land-advance owed PR dispatches first, then the conveyor sidecar's items in Priority-order line order, each with its planned steps (Fork 3); with both empty it prints `Empty.`"
- **4**: add "the default output has one `Since HH:MM:` summary line, and `--full` also prints the header lines, the land-advance Next lines and the docket count line."
- **5**: add "`--bullets` output is byte-for-byte unchanged on the existing fixture."
- **Scope**: add a new pure parser file for the Priority order (for example we:scripts/operations/wip-report-next.mjs) and its test. The `blockedBy` data edits of Fork 4 (d) are a separate backlog change on `main`.
