---
bornAs: x4e6mib
kind: epic
parent: "3383"
status: open
scope: ["we:scripts/operations/file-item.mjs", "we:scripts/operations/file-item-io.mjs", "we:scripts/conveyor/queue.mjs", "we:scripts/conveyor/queue-store.mjs", "we:docs/agent/backlog-workflow.md"]
dateOpened: "2026-09-07"
tags: []
---

# Configurable approval-granularity knobs gate whether a ready item auto-queues for the conveyor, or waits for explicit human sign-off

Today we:scripts/operations/file-item.mjs's planQueueing auto-clears every newly-filed story/task into we:.conveyor/queue.json unless the kind is epic/decision, the card was born active (#670), or the caller passes --queue=false -- one implicit, all-or-nothing policy with no per-epic/per-category granularity and no human-sign-off step. Confirmed live 2026-09-07: clearing a card for the conveyor IS today's only human-OK gate (we:scripts/conveyor/queue-store.mjs's addToQueue is the sole mechanism; nothing in we:scripts/conveyor/tick-core.mjs, we:scripts/readiness/dispatch-plan.mjs, or any *watch*.mjs re-queues an item later -- a blocked-but-cleared row just flows into we:scripts/conveyor/tick-core.mjs's plan.launch the moment openBlockers hits 0, with zero extra queuing action). The operator wants a THIRD gate layered on top of this, distinct from PR-merge clearance (clear-human, we:.claude/skills/review/SKILL.md) and decision ratification (/prepare + ratify): a configurable approval policy governing whether a build-ready item is allowed to actually enter the queue, at three granularities -- standing bulk approval for a whole epic/program (approve everything under an epic as it becomes ready, no per-item re-approval), standing bulk approval for a category as items are discovered (e.g. auto-approve bug fixes as coroner/audit passes surface them), or the strict opposite (manual approve everything, every item needs an explicit human nod). The operator's personal global slash-command config (their own wip command file, outside this repo entirely -- not a we: locus) becomes the interim surface for toggling these knobs and for showing/approving whatever is currently pending, before a real UI (Decision Board we:backlog/3562, or the Plateau Loop we:backlog/2445/2505) exists.

## What already exists — reused, not reinvented (verified before filing)

- **file-item's own queue-decision, exactly as it stands today.** we:scripts/operations/file-item.mjs:100-113's
  `planQueueing` auto-clears a freshly-scaffolded card into we:.conveyor/queue.json unless: the caller passed
  `--queue=false` (:101-102), the kind is `epic`/`decision` (`NON_DISPATCHABLE_KINDS`, :103-108), or the card was
  born `active` via a `--session` filing (#670, :109-110). This epic adds a FOURTH branch — a per-epic (v1) policy
  check — to that same function; it does not replace or duplicate the existing three.
- **Distinct from we:backlog/3562 / we:backlog/3576 (the leverage-ranked auto-prepare docket passes) — confirmed,
  not assumed.** Both siblings decide what gets **PREPARED** (dispatch a `prepare-decision`/`prepare-scope` lane
  agent to author options/scope for an item that has none yet) — they never touch we:.conveyor/queue.json and never
  call `addToQueue`. This epic decides what gets **QUEUED** (cleared for the conveyor to actually build) once an
  item is ALREADY prepared/ready — a strictly later stage in the same pipeline. A decision can be top-5-leverage
  and mechanically prepared by #3562's watch, then still sit un-queued under this epic's `manual` policy; the two
  layers are adjacent, not overlapping. we:backlog/3601's *Grounding* also cites this.
- **Distinct from `clear-human` (PR-merge) and `/prepare`+ratify (decision ratification) — the two gates the
  operator explicitly named as NOT what this epic is.** `clear-human` (we:.claude/skills/review/SKILL.md) governs
  whether a REVIEWED PR may land on `main`; `/prepare`+ratify governs whether a `kind:decision` item's ruling is
  accepted. Neither touches whether a build-ready story/task is allowed to enter the dispatch queue in the first
  place — that gap is what this epic closes.
- **No existing "standing/bulk approval" convention found.** Grepped `backlog/` and `docs/agent/` for
  "auto-approve", "bulk approve", "standing approval", "approval policy" (2026-09-07) — no hits describing this
  concept; genuinely new ground, not a rename of something that already exists.
- **we:scripts/conveyor/queue.mjs's `add <NNN>` is already, today, an unconditional per-item human sign-off
  gesture** (it never checks policy — confirmed via we:backlog/3587, which independently found the `add` action
  always clears and only WARNS on non-dispatchable kinds). This epic's slices build the STANDING/bulk knobs; the
  single-item override path already exists and needs no new mechanism.

## Staged breakdown

1. **First buildable slice — we:backlog/3599**: per-epic `approvalPolicy: auto | manual` frontmatter field,
   consulted by `planQueueing` before auto-clearing that epic's children; `auto` (today's implicit default)
   preserved when the field is absent, so every existing epic is unaffected until it opts in.
2. **Open decision — we:backlog/3601**: which granularity levels ship in v1 (epic-only vs. epic+category vs.
   all three), where the policy config lives (frontmatter vs. env var vs. sidecar file), and what the default
   should be — each fork carries a recommended default with reasoning, none decided silently.
3. **A natural third slice, explicitly OUT of this repo's own build:** the operator's personal `/wip` command
   (their own global slash-command config, outside this repo entirely) gaining a "pending your approval" section
   plus an easy way to approve from it. `/wip` is the interim control surface named in this epic's own digest, but
   editing it is a later pass — human or agent — against that file directly, the same way tonight's other `/wip`
   edits were made by the operator's own session, never via a repo PR. This epic tracks the RELATIONSHIP (what
   `/wip` needs to gain: a query for "items filed-but-not-queued due to policy", and a way to invoke
   we:scripts/conveyor/queue.mjs's `add <NNN>` per pending item) without filing build work against a file this
   repo does not own.

## Done when

1. we:backlog/3599 (or its v1-scope-adjusted successor, once we:backlog/3601 rules) is resolved: an epic can
   carry `approvalPolicy: manual` and its children file successfully but are not auto-cleared, verified by a real
   lane-clone smoke test.
2. we:backlog/3601 is ratified, and any slice whose assumptions it overturns (e.g. Fork 2 picking a config
   location other than epic frontmatter) is corrected to match before it resolves.
3. we:docs/agent/backlog-workflow.md documents the new `approvalPolicy` field and its default.
4. This epic resolves once every child slice/decision above is resolved (the standard no-open-slice gate) — no
   additional epic-level executable check beyond its children's own.

## Grounding

- we:scripts/operations/file-item.mjs:83-113 — `planQueueing`, the function every slice under this epic extends.
- we:scripts/conveyor/queue.mjs:44-49 — `NON_DISPATCHABLE`, confirming the `add` action always clears (never
  refuses) and only warns on epic/decision kinds — the existing single-item override this epic's slices build
  alongside, not over.
- we:backlog/3562-a-standing-mechanical-pass-keeps-the-5-highest-leverage-open.md,
  we:backlog/3576-generalize-the-leverage-ranked-auto-prepare-docket-pass-beyo.md — the adjacent auto-PREPARE
  mechanism this epic is distinct from (confirmed live 2026-09-07, see *What already exists* above).
- we:backlog/3587-file-item-can-never-queue-a-decision-or-epic-even-on-explici.md — confirms the `add` action's
  real always-clears-with-warning behavior, the precedent this epic's own refusal-reason shape follows.
- we:.claude/skills/review/SKILL.md — `clear-human`, the PR-merge gate this epic is explicitly NOT duplicating.
- we:backlog/3599-per-epic-approval-policy-gates-file-item-s-auto-queue-decisi.md — this epic's first buildable
  slice.
- we:backlog/3601-approval-granularity-v1-scope-which-levels-ship-where-the-po.md — this epic's open decision.
