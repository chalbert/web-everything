---
bornAs: xkzf8b4
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

## Amendment (2026-09-09) — concrete design + prototype (record only, still NOT ratified)

Per the operator's direct request, this session designed and prototyped the redesign this card proposes, in
lane clone `lane-2`, PR TBD. **Nothing here is wired into the live system** — `we:skills-src/conveyor/delivery-agent-brief.md` is untouched, `we:scripts/operations/dispatch-lane.mjs`'s spawn path is untouched, and
dispatch is separately paused (`we:scripts/readiness/dispatch-pause.mjs` `status`) for an unrelated reason. This
amendment records the design so it can be reviewed and ratified (or not) on its own timeline — not a
notification that anything went live.

**What was prototyped, concretely:**

- `we:skills-src/conveyor/delivery-agent-brief-v2.md` — a full, real ~160-line minimal brief. The agent's
  entire job: a quick spec-still-holds sanity read, build, commit, report one of three outcomes
  (`done`/`blocked`/`needs-human-judgment`) through one CLI. No lane-pool, verify-lane, pr-land, label, park-mode,
  `/converge`, or cross-locus-manifest vocabulary anywhere in it.
- `we:scripts/operations/delivery-report-record.mjs` / `we:delivery-report-store.mjs` / `we:delivery-report-cli.mjs` —
  REAL, working, tested code (47 passing vitest cases across three test files) implementing the schema-constrained
  completion contract, mirroring the pure/io/CLI split `we:scripts/operations/completion-record.mjs` /
  `we:completion-store.mjs` / `we:completion-cli.mjs` already establish for review/fix dispatches (#3436). New third
  kind rather than widening `COMPLETION_KINDS`, reasoned explicitly in the file's own header (a build's
  `outcome`/`reason`/`filesTouched`/`learning` shape has nothing in common with review/fix's `verdict`/`label`).
  The load-bearing rule — a `blocked`/`needs-human-judgment` report with no `reason` is REFUSED, not merely
  discouraged — is enforced at write time (`validateDeliveryReport`) and covered by tests exercising the actual
  CLI path, not just the pure validator.
- `we:scripts/operations/deliver-item-wrapper.mjs` — a ~360-line design SKETCH (explicitly labeled REAL vs.
  SKETCH vs. PLACEHOLDER per-function, not a working implementation) of the orchestration wrapper: acquire lane
  → claim → spawn the minimal agent → act on its report → run the gate → drive review → open the PR → forward
  the optional learning → exit. Not imported by anything, not tested, not wired into `we:dispatch-lane.mjs`.

**The structured completion schema** (see file for the full pure/io/CLI code): `{ v, session, item, status,
outcome, reason, filesTouched, learning, startedAt, updatedAt }`. `status` is the same two-phase
`started`→`done` write `we:completion-record.mjs` already uses (crash survives as `started`, never nothing).
`outcome` is deliberately closed to exactly THREE values — `done` / `blocked` / `needs-human-judgment` — the
shape suggested in this card's own body. The agent never sees or reasons about `ready-to-merge`/`review:human`/
`review:pending`, exit codes 2/3/4, or park modes; those all collapse into the WRAPPER's job of mapping
`outcome` + `reason` + a deterministic statute/policy-path check (reusing `we:scripts/lib/gate-config.mjs`'s
`isStatutePath`/`isPolicyCorePath`, not reinventing it) onto a label.

**The wrapper's shape, concretely** (see the file for the real call order): `acquireLane` → `claimItem` →
`runAgentToCompletion` (spawns the agent, blocks until it exits, reads its report) → branch on `outcome`
(`blocked` with no files touched ⇒ release and return `not-ready`; `blocked` with files touched ⇒ release and
return `blocked-mid-build`, a genuinely new case today's brief has no analogue for, flagged as an open question
in the file) → `runGateWithOneRetry` (runs `we:verify-lane.mjs` directly, synchronously, in the wrapper's own
process) → `runConverge` (drives `we:converge-cli.mjs` init/step itself) → `decideParkMode` (statute-path check +
outcome + converge verdict → a label) → `openPr` (the SAME `we:run.mjs open-pr` / `pr-land` CLI surface the live
brief already uses) → `dropLearning` (forwards the agent's optional learning to `we:learnings-drop.mjs`) → exit.

**Step 6 (`/converge`) — the call this amendment's own body flagged as uncertain, now made.** KEEP the
review; MOVE who drives it. The checking still happens — `runConverge` still drives the same panel/red-team/
editor core (`we:converge-cli.mjs`, `we:scripts/lib/converge-core.mjs`/`we:jury-core.mjs`) with the same substance — but
the WRAPPER drives the init/step loop and interprets `land`/`escalate`, never the delivery agent. This resolves
the "does removing it save work, or just move who does it" question directly: it is NOT removed, and the
review work does NOT shift downstream onto a human — it shifts from the delivery agent's own turn budget
(today, the agent spends its own turns looping `init`/`step`, per the live brief's step 6) onto the wrapper's
process, which was already going to be running regardless. This is a straightforward instance of the SAME
"orchestration mechanics move out of the agent" principle applied to steps 7 (visual self-review) and 9
(learnings-drop) elsewhere in this design — those, too, are wrapper-driven now (the agent still contributes its
`learning` field's content — a judgment call about what happened — but never touches the CLI or its scrub
mechanics itself). Step 7 is not separately reworked in this prototype beyond noting it follows the same shape
(`runConverge`'s pattern generalizes to a visual-review stage the wrapper would drive for UI-locus items); not
built out as its own function here, to keep the sketch bounded.

**Five firm requirements from the operator, folded in and verified, not just asserted:**

1. **No agent-initiated review, ever.** The agent never calls `/converge` or anything like it — confirmed by
   grep: `we:delivery-agent-brief-v2.md` contains zero mentions of `converge`, `panel`, or `red-team` as agent
   actions; `runConverge` in the wrapper is called only from `deliverItem`, never from anything the agent's
   own brief tells it to run.
2. **No PR monitoring by the agent.** The agent never opens, watches, or checks its own PR — `openPr` is
   wrapper-only; the brief's closing section explicitly tells the agent not to.
3. **The mechanical layer drives everything** — review, PR lifecycle, verification, escalation mapping — all
   inside `we:deliver-item-wrapper.mjs`; the agent's brief is scoped to build + report, nothing else.
4. **True push, not "the wrapper polls instead" — corrected mid-design.** An earlier draft of the wrapper had
   it poll the delivery-report sidecar file in a loop after backgrounding the agent (`--bg`); that was WRONG —
   it just relocated the poll rather than removing it, and was flagged and fixed in this same session before
   finishing. The corrected design: `defaultSpawnAgent` (`we:scripts/operations/dispatch-lane-io.mjs`, a REAL,
   already-existing function this session confirmed uses `execFileSync` internally) BLOCKS until its child
   process exits. Spawning the agent WITHOUT `--bg` (a foreground, not backgrounded, run) means that blocking
   call itself IS the notification — no loop, no status check, anywhere. The one resume (gate came back red)
   is the wrapper handing the agent a fresh turn with the actual failure output already in hand, and that
   resume call is itself a single blocking call too. Zero polling loops exist anywhere in the final design.
5. **No mechanical-system awareness leaks through the spawn mechanism itself — investigated concretely, not
   assumed.** Checked whether today's LIVE dispatch (`we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv`,
   the real function `we:dispatch-lane.mjs` calls) suppresses the operator's personal, home-relative
   `we:.claude/CLAUDE.md` memory file, this repo's own `we:CLAUDE.md`, or skill auto-discovery for a spawned
   agent: it does NOT — its `--bg` branch passes only `--session-id`/`-n`/`--append-system-prompt-file`, none
   of which touch memory-file loading, hooks, or skills. **This is a REAL, confirmed gap in the CURRENT
   system**, not a v2-only concern: every dispatched delivery agent today, including under the live 527-line
   brief, auto-loads the operator's personal `we:.claude/CLAUDE.md` (interactive-collaboration preferences —
   timezone, response-format rules — irrelevant to an autonomous build) plus this repo's own
   `we:CLAUDE.md`→`we:AGENTS.md`→`we:docs/agent/conventions.md`-family doctrine chain and the full
   `.claude/skills/` auto-discovery listing, exactly like an interactive session does. Ran `claude --help`
   directly against the installed CLI (v2.1.266) to find the fix: `--bare` is a REAL, documented flag —
   verbatim from that help output:

   ```
   Minimal mode: skip hooks, LSP, plugin sync, attribution, auto-memory, background prefetches, keychain
   reads, and CLAUDE.md auto-discovery. Sets CLAUDE_CODE_SIMPLE=1. ... Skills still resolve via /skill-name.
   ```

   — paired with `--disable-slash-commands` ("Disable all skills") as
   defense in depth. `buildForegroundAgentArgv` in the wrapper sketch uses both. **Two honest costs, stated
   plainly, not papered over:** (a) `--bare` also disables HOOKS, so `we:scripts/guard-bash.mjs`'s general
   safety nets (destructive-git-op protection, the `main`-push block) would be off too, not just the
   lane-mechanics awareness this design wants gone — `--bare`'s own text allows layering a `--settings <file>`
   back in to reinstate just a hook, but the exact settings-JSON shape to do that was NOT independently
   verified in this session, left as a real open task; (b) `--bare`'s own text states auth becomes strictly
   `ANTHROPIC_API_KEY`/`apiKeyHelper` — "OAuth and keychain are never read" — so switching to `--bare` requires
   confirming whatever spawns this wrapper actually has an API key available, not assuming today's OAuth-based
   dispatch carries over unchanged.

**Validated against two real, already-resolved historical builds** (`we:backlog/3370-*.md`,
`we:backlog/3579-*.md` — both landed tonight, size 3, single-locus WE-only, non-UI, no cross-locus, no
escalation, `git log` confirms both merged clean as `ready-to-merge`): tracing the new flow through both —
`acquireLane`/`claimItem` unchanged from today; the agent's own job under v2 would have been identical (read
the port-extraction spec, implement `defaultClaudeProvider`/`createDispatchSinks`, add the port-shaped tests,
commit, report `done` with the touched files) with strictly LESS to reason about (today's step 6 loop, step 8's
request/poll pair, and the label/exit-code table never enter the agent's own context at all); `runGateWithOneRetry`
would have run green on the first pass for both (both PRs' own `## Progress` notes report every existing test
passed locally); `decideParkMode` would have resolved `ready-to-merge` for both (neither touches a statute/
policy-core path, neither item reports a `needs-human-judgment` outcome) — the SAME outcome both items actually
reached. Nothing in either real case exposes a gap the v2 design fails to handle. **This validation is
necessarily light** — both cases are simple, single-locus, escalation-free refactors; it does NOT exercise the
cross-locus couple path, the `blocked`/`needs-human-judgment` paths, or the gate-red retry path, none of which
had a real historical instance handy tonight to trace against.

**What is explicitly NOT resolved by this amendment:** whether to actually cut over (a real, separate
ratification decision); the `ANTHROPIC_API_KEY` auth prerequisite (cost 5b above, still open after the
revision below closed cost 5a); the `blocked-mid-build` partial-work case the wrapper sketch flags as
genuinely new ground with no existing analogue; and the full `runConverge`/`decideParkMode` wiring against
`we:converge-cli.mjs`'s and `we:review-escalation.mjs`'s REAL output shapes (both used here as SKETCH-level
approximations of APIs this session read partially, not verified end-to-end). Left for whoever takes this from
prototype to real cutover, per the operator's own "review and decide, not deploy tonight" framing.

## Revision (same session, folded into PR #2104) — the safety-hooks gap closed; provider parity made structural

Two operator follow-ups on the design above, both applied directly to the same PR rather than filed
separately, per the operator's own instruction (the design is still a prototype, not yet merged).

**1. The safety-hooks tradeoff (cost "a" above) is CLOSED, not just flagged, via a verified `--settings`
combination.** Re-checked `claude --help` directly: `--bare`'s own text lists `--settings` among what a caller
may explicitly layer BACK ON TOP of it, and `--settings <file-or-json>` is documented as loading ADDITIONAL
settings — not a replacement. So `--bare --settings=<file>` is a REAL, VERIFIED combination, not a guess.
`we:scripts/operations/deliver-item-wrapper.mjs` now defines `DELIVERY_HOOKS_SETTINGS` — the SAME hook-schema
shape read directly from this repo's own `we:.claude/settings.json`, trimmed to carry ONLY the two hooks a
delivery agent's own tool calls still need for safety: `we:guard-lane.mjs` (Edit|Write matcher) and
`we:guard-bash.mjs` (Bash matcher) — dropping the other three Edit|Write hooks the real settings file also
carries (`we:lint-locus-prefix.mjs`, `we:check-memory.mjs`, `we:backlog-guard.mjs`, `we:guard-backward-edge.mjs`), none
of which a minimal delivery agent needs since it never touches `backlog/*.md`/`reports/*.md`/agent-memory files
itself. `CLAUDE_BARE_PROVIDER`'s `spawn` now passes `--settings=<the materialized file>` alongside
`--bare --disable-slash-commands`. Net: the agent still gets zero `we:CLAUDE.md`-style memory/doctrine/skill surface, but
keeps its safety net — the all-or-nothing tradeoff the original design left open is gone. Cost "b" (the
`ANTHROPIC_API_KEY` auth prerequisite) is unaffected by this fix and remains open.

**2. Provider parity is now structural, mirroring #3579/#3370's own extracted ports.** The operator's explicit
requirement: whatever spawns a minimal delivery agent must have the SAME provider-port shape already landed
for `we:scripts/operations/dispatch-lane-io.mjs`'s dispatcher seam (#3579, `provider` param on
`createDispatchSinks`) and `we:scripts/operations/cli-adapter.mjs`'s judge seam (#3370, `createDefaultJudge`'s
injected implementation) — both real, both already shipped. The wrapper sketch is restructured accordingly: a
`DeliveryAgentProvider` port (`spawn({sessionId, prompt, resumeSessionId}) → void`, blocking — the delivery-
report contract stays provider-agnostic by design, since whichever CLI a provider spawns, the agent shells the
SAME `we:delivery-report-cli.mjs` inside its own run) with `CLAUDE_BARE_PROVIDER` as the one REAL
implementation and a `CODEX_PROVIDER` that is a NAMED SEAM ONLY — it throws, naming exactly what is
unresearched (Codex CLI's actual minimal-context spawn flags, whether it has any hook-equivalent mechanism at
all, and whether it supports a blocking/foreground invocation this wrapper's contract needs) rather than
inventing plausible-looking Codex flags. `deliverItem`/`runAgentToCompletion`/`runGateWithOneRetry`/
`resumeAgentWithGateFailure` all take the provider as a parameter (defaulting to `CLAUDE_BARE_PROVIDER`) and
contain zero Claude-CLI-specific logic themselves — swapping providers is a call-site change, not a rewrite of
the wrapper's control flow.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
