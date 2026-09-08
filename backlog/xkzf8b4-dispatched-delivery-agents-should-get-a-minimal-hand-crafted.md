---
kind: decision
parent: "3383"
status: open
scope: ["we:skills-src/conveyor/delivery-agent-brief.md", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/completion-cli.mjs", "we:skills-src/mechanical-delivery-doctrine/SKILL.md"]
relatedTo: ["3621", "3418"]
dateOpened: "2026-09-08"
tags: [conveyor, context-scoping, delivery-agent, doctrine]
---

# Dispatched delivery agents should get a minimal, hand-crafted context — not full doctrine/skill access — and a schema-constrained completion contract instead of mechanical-system awareness

Not yet decided — research/proposal item, matching the record-don't-ratify posture used for tonight's other deferred ideas. Operator's own words tonight (2026-09-08): 'I see plenty of wasted work in agent, agent trying to review themselves, agent trying to use skill they should not, I think each agent should not have our full user context but only a hand crafted one. I see agent think about lanes stuff but agent should not even be aware of our mechanical system, they should be focussed only on delivery of a specific element and then sending message following a schema to a specific endpoint, end of it.' Motivating evidence (observed live tonight): dispatched delivery agents doing work outside their actual job — self-reviewing their own diff, invoking skills irrelevant to the narrow build task, reasoning about lane-pool/conveyor mechanics they have no need to know. Proposed structural fix: (1) a dispatched delivery agent gets a MINIMAL, hand-crafted context scoped to its one task, not the full we:CLAUDE.md / we:AGENTS.md / skill surface it inherits today; (2) it has NO awareness of the mechanical dispatch system (lanes, lane-pool, conveyor state, queue) — that stays the orchestrator's concern; (3) its output is a SCHEMA-CONSTRAINED completion message to a specific endpoint, and nothing else — no lane management, no self-review, no orchestration reasoning. Checked against current code before filing (2026-09-08): we:skills-src/conveyor/delivery-agent-brief.md is the ENTIRE prompt handed to a spawned build agent today — it instructs the agent to run lane-pool acquire/release itself, read and reason about backlog claim/readiness/blockedBy state, and explicitly 'review your own diff to convergence with an adversarial subagent' (step 6, /converge) before opening the PR — i.e. today's brief does the opposite of both proposed changes: it is lane-aware by design and it is instructed to self-review, not schema-report to an endpoint. we:scripts/operations/dispatch-lane.mjs's fillBrief only substitutes a small closed placeholder set (ITEM_NUM/ITEM_SPEC_PATH/LANE/SESSION_SLUG/SCOPE/ATTEMPT_TAG) into that one large template — no separate 'minimal system prompt' layer exists; the spawned claude --bg process runs from the repo checkout and gets ordinary project-level we:.claude/skills/ auto-discovery plus full we:CLAUDE.md, same as an interactive session, not a reduced surface. we:skills-src/mechanical-delivery-doctrine/SKILL.md is a separate, large (12-rule) standing-doctrine skill for the session DRIVING/orchestrating the dispatcher, not loaded into a delivery agent's own brief — but its rule 2 already states a related but distinct principle (dispatch runs on the card + the generic brief, never a bespoke prompt), which this idea would sharpen further by shrinking what that generic brief itself contains. we:scripts/operations/completion-cli.mjs already has a schema-constrained report contract in one narrow slice: 'report --session=<slug>|--kind=review|fix --pr=<n> --status=started|done' persists a structured completion record for review/fix dispatches — real prior art for 'a structured completion message to an endpoint', but scoped only to kind=review|fix, not to a build delivery agent's own end-of-job report, and it is a side-channel record file, not the delivery agent's ONLY sanctioned output. Closest existing filed item: #3418 (resolved) added a short static --append-system-prompt stating a dispatched agent's prompt is a real work order, not a template to second-guess — a narrow misjudgment fix, not context reduction or lane-unawareness. #3621 (open decision, parent #3383) is the closest sibling in spirit — its own 2026-09-07 amendment already flags 'restricting a dispatched agent to declared operations only (no arbitrary shell commands)' as genuinely new ground, researching an OS-level container/sandbox boundary. That is a DIFFERENT enforcement layer (what commands the agent's shell can physically reach) from this idea (what CONTEXT/doctrine/skill surface the agent's prompt carries, and what shape its own output takes) — complementary, not the same mechanism, so this is filed as its own sibling rather than folded into #3621. we:scripts/capability-search.mjs run before filing (verdict: partial) found no exact match on either surface. NOT YET DECIDED: this is a proposal for the operator to ratify later, same posture as #3621 and the other decision items filed tonight — no build should start from this card until it is prepared and ratified.

## Amendment (2026-09-08, later same day) — concrete evidence from `we:delivery-agent-brief.md`, cited by step

Folded in per the operator's own "yes" to adding these as concrete examples — record-only, no ratification, no
status change, no redesign proposed here. Read `we:skills-src/conveyor/delivery-agent-brief.md` in full
(current head, 527 lines) to ground the proposal's motivating claims in specific step/line numbers rather than
the general "wasted work" framing in the body above.

**1. Steps 5 and 8's verify-lane request-then-poll pattern is concrete evidence for a separate idea filed the
same night: we:backlog/3621's newest amendment (poll-vs-push).** Step 5 (lines 148-186) states plainly: "You
cannot run the gate yourself — request it, then poll (#3105)" (line 154) — `we:scripts/guard-bash.mjs` DENIES a
dispatched agent from running `verify-lane`/`check:standards`/`test:unit` directly, in any form (lines
155-160), so the agent runs `we:scripts/verify-lane.mjs request` then `we:scripts/verify-lane.mjs check --json`
"across turns until it settles" (lines 163-169). Step 8 repeats the identical shape for the final pre-open HEAD
check (lines 280-286): "Same request-then-poll shape as step 5 — you cannot run this yourself (guard-bash
denies it); request it and poll `check` across your own turns until it settles GREEN." This is a concrete,
in-repo instance of the pattern we:backlog/3621's 2026-09-08 "a single git-manager chokepoint for GitHub API
calls, and push-notify execution instead of agent polling" amendment (PR #2091, not yet merged as of this
writing) describes in the abstract as its Idea 2 — "stop agents from polling; delegate execution to 'the
mechanic,' which notifies on completion" — there explicitly tied to the passive-wait/false-Monitor-claim
anti-pattern (`we:agent-memory-src/subagent-must-not-end-turn-on-passive-wait.md`, pinned in `we:CLAUDE.md`).
Cross-referenced, not duplicated here: the poll-vs-push redesign itself belongs on #3621; this item's stake in
it is narrower — a minimal hand-crafted brief still needs SOME way to learn its gate result, so whichever
mechanism #3621 lands on (still open) directly shapes what a minimal completion contract here can look like.

**2. Additional concrete waste beyond the step-6 self-review already cited in the body above:**
- **Step 9 — learnings-drop (lines 336-359).** An unrelated extra responsibility bolted onto "deliver this
  item": a whole separate schema (`--kind`/`--summary`/`--area`/`--suggestion`, all four required, line 353), a
  240-char cap on `--summary` (line 354), and an allow-listed-field privacy boundary — "there is deliberately
  **no** `--item`/`--entry`/free-form field (the allow-list is the privacy boundary — a disallowed key is
  rejected, never appended)" (lines 355-356). Candidate to move entirely to the orchestrator: the orchestrator
  already receives a structured result back from the agent (the one-line return of step 10, line 367) and could
  prompt for a lesson separately, rather than every delivery agent carrying this schema.
- **Step 7 — visual self-review (lines 224-251), UI-locus items only.** A second self-review layer, same shape
  complaint as step 6: render + screenshot, read the PNG, run the #2670 comparator, iterate to convergence
  (lines 228-245) — additive cost specifically for UI items.
- **Escalations (lines 423-513) — 7 cases, 0 through 6** (case 0 at line 441 through case 6 at lines 489-497),
  three different, non-overlapping exit codes (`check-red` exit 2, line 459; `locus-prefix` exit 3, line 456;
  `blocked-on-infra` exit 4, lines 318/489), label semantics spanning `ready-to-merge` (line 304), `review:human`
  (lines 330, 449, 471, 481) and `review:pending` (lines 403-404), park-mode mechanics (`--mode=park
  --parkLabel=review:human`, lines 463-464, plus the label-confirmation caveat at lines 499-505), and
  cross-locus manifest authoring (lines 394-400, the `we:.lane-manifest.json` + `validateManifest` machinery).
  Under the proposed schema-to-endpoint model, most of this collapses: the agent could report a simple result
  shape (done / blocked / needs-human-judgment-on-\<X\>) and the orchestrator — not the agent — decides which
  label/exit-code/park-mode that maps to.

**3. Step 6 (`/converge` self-review, lines 188-222) flagged as UNCERTAIN, not a clean cut.** Unlike the three
items above, removing step 6 from the delivery agent might just shift the load onto the downstream review
committee (the panel/red-team `/converge` already drives, lines 191-195 and 209-212) rather than eliminate real
work — the checking still has to happen somewhere. This is an open question the eventual redesign needs to
actually resolve (does moving it save work, or just move who does it and when), not something already known to
be safe to cut.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
