---
bornAs: xiluli3
kind: decision
parent: "3598"
status: open
dateOpened: "2026-09-07"
tags: []
---

# Approval-granularity v1 scope: which levels ship, where the policy config lives, and what the default should be

Three genuinely open forks for we:backlog/3598's approval-granularity project, flagged rather than silently picked: (1) which granularity levels ship in v1 -- epic-only vs epic+category vs all three (epic/category/global-manual) at once; (2) where the approvalPolicy config lives -- a frontmatter field on the epic card vs an env var vs a separate policy file/sidecar; (3) what the default policy should be when unset -- keep today's implicit auto-queue-everything-except-epic-decision behavior, or flip the default to manual. Each fork states a bold recommended default with reasoning; none is decided silently in the epic or its first slice.

## Fork 1 — which granularity levels ship in v1

**Why this is a fork, not a "support all of these":** the three granularities the operator named — epic/program-wide,
category-wide (e.g. "auto-approve bug fixes as identified"), and fully-manual — do NOT all reduce to one flag; each
needs its own population-matching logic (epic ⇒ walk `parent`; category ⇒ classify by some as-yet-undefined
predicate, since this repo has no formal `kind:bug` or `type:bug` field today, only freeform `tags`; fully-manual ⇒ a
policy that overrides every epic's own setting). Building all three in one slice is a real scope choice, not a
default everyone agrees on — this fork picks which subset ships first.

- **(a) Epic-only.** we:backlog/3599's slice: an `approvalPolicy` field on the epic card, consulted by
  we:scripts/operations/file-item.mjs's `planQueueing` for that epic's children only.
- **(b) Epic + category together in v1.** Adds a second axis (e.g. `tags: [bug]` ⇒ auto-approve) in the same slice.
- **(c) All three at once, including a global manual-everything switch.**

**Recommended default: (a), epic-only.** Category-level approval needs a settled notion of "category" first — this
repo has no `kind:bug`/`type:bug` today (confirmed: bugs are filed as `kind: task`/`story` with freeform `tags`,
per we:docs/agent/backlog-workflow.md's kind axis), so building category-level approval now would either invent a
new classification scheme inline (a second, larger decision hiding inside this one) or bind the knob to `tags`,
which is unvalidated and drifts easily. The operator's own framing ("keep this slice concrete and small — the
simplest version that proves the concept") already names this exact sequencing. A global manual-everything switch
((c)'s addition) is cheap once epic-level exists (it is just "every epic defaults to manual instead of auto" — see
Fork 3) so it does not need its own separate v1 slot.

## Fork 2 — where the approvalPolicy config lives

- **(a) A frontmatter field on the epic's own card** (`approvalPolicy: auto | manual`). Durable, versioned, git-blamed,
  colocated with the epic it governs — the same shape `parent`/`blockedBy`/`kind` already take, and read the same
  way we:scripts/conveyor/queue.mjs's `kindOf` (:52-77) already reads a card's frontmatter directly by filename/
  `bornAs` match (no new lookup mechanism to invent).
- **(b) An env var** (e.g. `WE_APPROVAL_POLICY_DEFAULT`, mirroring the `WE_DECISION_DOCKET_WATCH_DISABLED` kill-switch
  convention in we:backlog/3562). Fine for a single GLOBAL default, but cannot express "epic #3500 is manual, epic
  #3600 is auto" simultaneously without an ad hoc per-epic naming scheme (`WE_APPROVAL_POLICY_3500`), and an env var
  carries no git history of who set it or when.
- **(c) A separate policy file/sidecar** (e.g. `we:.conveyor/approval-policy.json`, mirroring `we:.conveyor/queue.json`,
  or a committed `we:backlog/approval-policy.md`). Adds a second store that must stay in sync with the epic it
  describes — a sync problem frontmatter does not have, since the policy lives ON the card it governs.
- **(d) A GLOBAL env-var default (b) layered UNDER per-epic frontmatter (a) — not a rival, a combination.**

**Recommended default: (a) for the per-epic knob, PLUS a narrow (d) — a single global env var (e.g.
`WE_APPROVAL_POLICY_DEFAULT=manual`) that flips the *default* every un-annotated epic resolves to, without touching
every card.** This directly serves the operator's third stated mode ("could decide to manually approve everything")
without inventing a bulk-frontmatter-edit workflow for it. The per-epic field always wins when present; the env var
only changes what an ABSENT field resolves to. Category-level (Fork 1) is out of v1 scope, so its own config location
is deliberately left for whichever later item builds it — likely `tags`-keyed, but that is its own fork, not
prejudged here.

## Fork 3 — what should the DEFAULT policy be when unset

- **(a) Keep today's implicit behavior as the literal default: `approvalPolicy` absent ⇒ `auto`** (auto-queue
  everything except `kind:epic`/`kind:decision`, exactly what we:scripts/operations/file-item.mjs's `planQueueing`
  does today with zero frontmatter change).
- **(b) Flip the default to `manual`** — every epic requires an explicit `approvalPolicy: auto` opt-in to keep
  today's auto-queue behavior.

**Recommended default: (a).** Flipping to `manual` ((b)) would silently stop auto-queueing on every existing,
un-annotated epic the moment this ships — a surprising regression with no upside, and a direct violation of this
slice's own stated backward-compatibility bar (we:backlog/3599's Done-when #2). An operator who genuinely wants
"manual, everything, always" gets there deliberately via Fork 2(d)'s global env-var override — an explicit,
reversible, one-line opt-in — never as the silent out-of-the-box behavior.

## Recommendation summary

Fork 1 → (a) epic-only for v1. Fork 2 → (a) epic frontmatter field + (d) one global env-var default override.
Fork 3 → (a) default stays `auto`, unchanged from today. None of these are stamped `preparedDate` — this item states
recommended defaults with reasoning per the filing session's own brief, but has not yet run the full skeptic +
`/research/` pass we:docs/agent/backlog-workflow.md's "prepared-fork shape" requires before ratification; a
`/prepare` pass (or a fresh skeptic sub-agent) should attack these three defaults before this item is ratified.

## Done when

1. Each of the three forks above is ratified (kept as recommended, or overridden) with a dated ruling recorded
   inline, per we:docs/agent/backlog-workflow.md's decision-resolution convention.
2. we:backlog/3599 (the epic-level slice) is re-read against the ruling — if Fork 2 lands differently than its
   own `approvalPolicy`-on-epic-frontmatter assumption, that slice is corrected before/while it builds, not after.
3. On resolve, this decision is codified: if the ruling establishes a reusable rule (e.g. "approval-policy config
   always lives in frontmatter, never a sidecar"), it is added to we:docs/agent/platform-decisions.md (or the
   nearest topical doc) and passed via `--codifiedTo=<doc>#<anchor>`; a genuinely narrow one-off ruling passes
   `--codifiedTo=one-off` instead.
