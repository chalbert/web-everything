---
name: closing-session
description: Pre-close safety check — confirm nothing is lost before ending a session. Use when the user asks "can I close this session?", "is it safe to close?", "are we done?", "wrap up", "end of session", or runs /closing-session. Audits whether session context is durably captured, runs the repo health gate, and reports working state. A commit is never *required*, but it auto-commits this session's own work (tight pathspec, no push) when the state is clean. The close COLLECTS but never adjudicates: every lesson, improvement idea, and friction it notices is emitted to the cross-session learnings pool, which the separate periodic /harvest run dedups, red-teams, and routes. The close opens no PR.
---

# Closing-Session Check

Run when the user asks whether it's safe to close / end / wrap up a session. Goal: guarantee no
**context** is lost, and report repo health and working state. Produce a short checklist and a clear
verdict.

## The governing rule: the close COLLECTS, it does not ADJUDICATE

**A session records what it observed. It never decides what the observation is worth.** Worth is decided
later, once, by the periodic `/harvest` (`we:skills-src/harvest-learnings/SKILL.md`) over the **whole
cross-session pool**. Everything the close notices that isn't already durable — a lesson, a reusable
principle, a friction, a doc/skill gap, a model-routing improvement — is **emitted** as one validated
drop-box entry and left there. The close does **not** dedup it, red-team it, decide it's memory-worthy,
file it, or land it.

Three reasons the judgment moved off the close (2026-08-06, operator directive):

1. **A subagent cannot run a close.** Curating here meant a delivery agent's observation only counted if
   the session it rode under happened to close cleanly.
2. **A session that never closes loses everything it noticed.**
3. **Dedup-from-a-sample-of-one.** "Fresh angle or covered cluster?", "narrow one-off or recurring?" — the
   red-team's own filters are recurrence questions a single session structurally cannot answer. A pool
   answers them with a count.

It also makes the single-tenant path identical in shape to the eventual multi-tenant one (#2610): many
people experience, one owner adjudicates.

**Reporting is not judging.** The close still *names what it emitted* and reports the pool's depth — that
keeps the operator able to say "file that one now" without the close having decided anything.

## Hard rules
- **A commit is never *required* to close — but auto-commit this session's own work when the state is
  clean, without asking** (standing user authorization, 2026-06-27). **"Clean" =** the repo gate is green
  (after any safe regen in step 2) **and** this session's changes are *finished* work (no broken
  half-state, no item left in a half-done `active` claim this session owns). When clean, commit **without
  prompting** — but stage **only the files this session actually touched**, by **explicit pathspec**
  (**never** `git add -A`/`git add .`: concurrent sessions routinely hold 100+ unrelated uncommitted
  files — honour the commit-tightly rule in `~/.claude/CLAUDE.md` / memory). One commit per finished
  piece, a real descriptive message, commit on the **current branch**.
  **Never push and never open a PR** — those still need an explicit ask. If the state is **not** clean
  (red gate that needs a real decision, or unfinished/half-done work), do **not** commit: report the
  uncommitted work for awareness only.
- **Under a strict lane-only lock (WE #2203/#2191), close-out is NOT a direct-`main` write path.** In a
  constellation repo whose primary checkout is read-only, edit-shaped work has **already landed via a
  lane→PR during the session**, so the auto-commit above **no-ops on already-PR'd work** (the common case).
  Anything genuinely uncommitted-and-finished that is *edit-action* work routes through the repo's **lane→PR**
  helper (e.g. `scripts/pr-land.mjs`), never a `git commit` on `main`. The **one carve-out** is
  **transient session-meta local signals** — **`claims.json`-class files** (`claims.json`/`queued.json`/
  `reservations.json`): these are throwaway bookkeeping, not durable content, and stay a sanctioned local
  write (the guard's `MAIN_PUSH_OK`/local-signal path). **Substantive agent-memory *content* is NOT in this
  carve-out** — a new lesson/principle or an edited memory entry is durable, reviewable, git-tracked project
  content (the `~/.claude/…/memory` symlink points into the repo's `.claude/agent-memory/`), and the close
  no longer writes it at all: the close **emits the lesson to the pool** (§1a) and `/harvest` lands it via
  lane → PR. This rule is a no-op in a normal solo-on-`main` repo with no such lock — there the
  current-branch commit above still applies.
- **The close never opens a PR — no carve-out.** The former memory-PR exception is gone with §1a's
  adjudication; a close that finds a lesson emits it, full stop.
- The only real blockers are **uncaptured context** and a **red repo gate** (one that needs a real
  code/content decision — not a regenerable artifact, see step 2). Everything else is FYI.
- **The close no longer red-teams, dedups, or gates anything.** Those are *judgments*, and judgment moved
  to `/harvest`, where it runs against the whole pool instead of a sample of one. The close's job is to
  **emit faithfully** — an observation you're unsure about still gets emitted, because deciding it doesn't
  matter is exactly the call the close no longer makes. (This supersedes the 2026-07-10 "red-team every
  proposal before surfacing it" directive, which presumed the close was the adjudicator.)
- The check is otherwise read-only — the only changes it performs unprompted are (a) a **safe
  generated-artifact regen** (step 2), (b) the **clean auto-commit** above, and (c) **appending to the
  learnings pool** (§1a) — a validated, untracked, machine-local JSONL append, never repo content.
  **Nothing is filed, written to memory, or landed by the close.** A backlog item is created at close only
  if the user explicitly asks for one this turn.

## Steps

### 1. Context-capture audit (the important one)
Scan the session for anything durable that lives only in the conversation — decisions, findings,
gotchas, deferred work, open threads — and verify each has a home in the repo (`backlog/`, `reports/`,
`docs/agent/*.md`) or `memory/`.

**Two different outputs, don't confuse them.** Something *already written down* is captured — say so and
move on. Something **not** written down is an **observation**: emit it to the pool in §1a. What you never
do here is decide *what it's worth* — not whether it dedups, not whether it earns a memory slot, not
whether it deserves an item. Emit it and let `/harvest` decide.

Specifically, scan for:
- Any **open TodoWrite items**? Unfinished work that should be a backlog item or finished now.
- Any **report** with open questions not registered in `/backlog/` (see `docs/agent/backlog-workflow.md`).
- Any **decision/finding/deferred follow-up** discussed but never written down.
- **Encountered-but-unfixed defects / inert gates** — a gate, check, test, or command this session
  **could not run, bypassed, or worked around** (e.g. "the locus `npm test` couldn't run — vitest isn't
  installed", a skipped/xfail'd test, a tool that errored and you routed around it). This is the most
  common build-session leak. **Emit it** as `kind: friction` (or `missing-convention`) with a concrete
  `suggestion` — the fix and its owner belong in the entry, so the harvest can file a real item without
  re-deriving them. Do **not** file it here and do **not** ask whether to; an observation you emitted is
  captured.
- **Working-style preferences** the user expressed → emit as `kind: improvement`, `area: working style`.
  (Only a preference the user asks you to remember *right now* is written directly — that's an explicit
  instruction, not the close adjudicating.)
- **Generalizable principles & reframes** — a *correction, reframe, or design principle that emerged this
  session and generalizes beyond the one item it surfaced on* belongs in `memory/`, **even when the
  specific decision was already written into a `backlog/` item.** This is the subtlest leak and the one
  the rest of this audit misses: a principle captured *only inside* the item that surfaced it reads as
  "captured" here (the file exists, the gate is green) but is **invisible to a future session reasoning
  about a different subject** — so the reusable lesson is lost while looking saved. The strongest trigger
  is **the user overturning or reframing your approach on the merits**: when a discussion changed *how
  you'd decide the next case* (not just this one), that is a lesson worth emitting, not merely an item
  edit. Ask: "if a future session faced a *different* instance of this, would it benefit from what we just
  learned — and is that lesson anywhere it would actually look?" If not, **emit it** as the generalized
  principle (one sentence in `summary`, the recommendation in `suggestion`). Distinct from *Working-style
  preferences* above: that captures *how the user wants you to work*; this captures *a reusable
  judgment/principle the session established*. (Worked example: #1377's "authoring SoT = the standard form,
  impls are removable adapters" reframe — written into the decision item, but the *principle* only reached
  memory because the user asked; today it would simply be emitted when the reframe landed.)

  **This is the bullet the emit-only rule most improves.** Under the old shape you had to decide, from one
  session, whether a reframe was a new axis or a fourth take on a covered cluster — from a sample of one.
  Now you just record that it happened. If it's real, another session will hit it too, and the harvest will
  see the count.

### 1a. Emit to the learnings pool — the ONE thing the close does with an observation

Everything §1 surfaced that isn't already written down becomes **one validated drop-box entry**. That is
the whole step. No gate, no red team, no dedup, no lane, no PR.

```bash
node scripts/conveyor/learnings-drop.mjs \
  --kind=friction|missing-convention|doc-gap|skill-gap|improvement \
  --area="<coarse label — the subsystem or activity, ≤60 chars>" \
  --summary="<the observation, one sentence, ≤240 chars>" \
  --suggestion="<what you'd do about it, ≤400 chars>"
```

**Writing the entry well is the close's actual skill.** The harvest can only judge what you recorded, so:

- **Generalize.** `summary` is the lesson, not the incident: "the lane gate reruns the full suite for a
  docs-only diff", not "PR #1064 took 9 minutes". A future session must recognise its own case in it.
- **One observation per entry.** Two frictions in one `summary` cluster with neither.
- **Keep `area` coarse and stable.** It is the clustering key — "lane gating", "memory index", "backlog
  readiness". A too-specific area (a file name, an item number) never clusters with anything and the
  observation dies alone in the pool.
- **Always fill `suggestion`.** Every distinct member suggestion survives clustering, so yours reaches the
  harvest even if another entry becomes the representative.
- **Emit when unsure.** The floor for emitting is "I actually observed this", not "this is important".
  Importance is the harvest's call, and an entry nothing else corroborates simply never recurs.

**The schema is the privacy boundary, and it is enforced.** Only `kind`/`area`/`summary`/`suggestion`
exist — there is deliberately no field for code, diffs, paths, or secrets — and the append runs a
deterministic scrub that **rejects on hit** (secret-shaped values, absolute or repo-identifying paths,
high-entropy tokens, over-long fields). A rejected entry is never written. If the helper rejects yours,
**rewrite it more generally** — do not work around the gate. This is the same seam that later ships to the
multi-tenant inbox (#2610), where minimal-by-construction is a hard requirement.

**The pool is untracked, machine-local, and cumulative.** Entries land in
`.conveyor/learnings/<session>.jsonl` (gitignored), one file per session so concurrent agents never
contend. Nothing consumes them at close — only `/harvest` does, after it has acted. A cheap in-the-moment
append cannot afford a lane→PR; the durable artifacts the harvest lands are what reaches git.

**Any agent can emit, at any time.** A subagent that hits friction mid-task should drop an entry *then*,
not hope its parent session closes cleanly. The close is simply the last emitter, not a privileged one.

**Then report the pool, and stop:**

```bash
npm run harvest:status
```

Put the one-line result on the **Learnings** field of the verdict (§4). If the pool is deep or old, that
number is the nudge to run `/harvest` — but **do not run the harvest as part of the close**, and do not
start adjudicating the pool you just read. A close that ends by saying "23 entries, oldest 9 days" has
done its whole job.

**Zero entries is a perfectly good close.** A session where everything was already written down emits
nothing. Say "nothing to emit" and move on — it is not a failure and not a caveat.

### 1b. Artifact hygiene — is what THIS session wrote coherent?

Distinct from §1a and **not** subject to the emit-only rule: these check the artifacts *this session
itself produced*. Fixing your own half-written output is finishing your work, not adjudicating someone
else's observation. Emit-only governs *lessons*; it never licenses leaving a broken edge behind.

- **Blocker-edge audit** (if the session touched `backlog/`): did this session create items, resolve
  prerequisites, or surface a dependency stated only in prose? Verify the `blockedBy` edges reflect it —
  any new item carries the right prerequisites, and no item that was just finished still falsely gates
  others. See `docs/agent/backlog-workflow.md` → **"Keep the blocker DAG honest"**. A stale DAG silently
  mis-reports agent-readiness, so a missing edge *is* uncaptured context. Capture (with the user's
  go-ahead) any edge the session implies but didn't record; `check:standards` must stay green (it errors
  on cyclic/unresolvable edges).
- **Digest audit** (for any item the session created or materially re-scoped): the item's first
  paragraph is its digest (the loader's `summary`, surfaced for selection). Confirm each new item has a
  real ≤100-word "what + why" lead paragraph, and that a re-scoped item's opening paragraph still
  describes it (the body's later sections may have moved on). See `docs/agent/backlog-workflow.md` →
  **"The digest"**. A stale digest mis-leads the next selection, so it's uncaptured context too.

- **Active-story audit** (if `backlog/` has any `status: active` items): classify each before saying
  anything about it — an `active` item is **not** automatically a problem, and "active + `blockedBy` an
  open item" is **not** proof of a stray claim. Three cases:
  1. **This session worked it and finished** → it should be `resolved`; close it out (offer to, per the
     close-out gate).
  2. **This session worked it but it's genuinely unfinished** → leave it `active` (resumable); just
     confirm its `## Progress` block (esp. **Next**) is in sync so a fresh session can pick it up.
  3. **This session did *not* touch it** → assume it belongs to **another concurrent session / an
     ongoing batch** and **leave it alone**. Do not call it "stray", "stale", or flip it to `open`
     without evidence of abandonment — the burden of proof is on showing it's abandoned, not on the
     active state. **Verify before asserting anything:** a present `dateStarted` means a real
     `backlog.mjs claim` ran (a linter/format-on-save never adds it), so it was a deliberate claim, not
     an artifact; check `.claude/skills/batch-backlog-items/reservations.json` for a holding session
     (absence isn't disproof — `claim` auto-drops an item's reservation when it hard-claims); and note
     the file mtime only tells you *when*, never *which* session. If you can't prove abandonment, the
     correct report is "active, owned by another session — left as-is", not a caveat. Only a claim that
     is BOTH this session's AND left in a broken half-state is a real close concern.

- **Batch calibration** (only if this session **ran a batch** *and* the project has
  `.claude/skills/batch-backlog-items/capacity.json`): the batch point-budget self-calibrates from real
  sessions, so a closed batch that isn't recorded is lost signal. Run, once, with the user's go-ahead:
  `node scripts/backlog.mjs calibrate --points=<cost-points resolved this session> --context-pct=<context used at close>`
  — `points` = the summed `batchCost` of items that actually `resolved` (a story's `size`, a task = 2;
  the batch ledger's `cost <spent>` figure), `context-pct` = context occupancy at close (a rough 1–100 is
  fine — it's EMA-blended). **Don't ask for `context-pct` cold — derive it:** the `Context peak` line from
  `session-cost.mjs` (step 3b) prints `context-pct=<N>` straight from the transcript. **Use that value**;
  only ask the user to correct it if the window looks misjudged (the transcript doesn't record whether the
  session ran a 200K or `[1m]`/1M window, so a 1M session that stayed under 200K reads ~5× high — if the
  editor meter clearly disagrees, prefer the meter). It updates `capacityPoints` and is reversible (git).
  Skip silently if no batch ran or the file is absent — this is project-specific and never a close blocker. See the project's
  `docs/agent/backlog-workflow.md` → **"Calibrating the budget"**.

- **Parallel-batch post-mortem** (only if this session **ran a `/batch` whose execute phase went through
  the parallel orchestrator** — i.e. not `--serial`, and the pool actually split into ≥1 parallel lane).
  Parallel is the default execute model but is still on a *reversible* footing pending real-run evidence,
  so each parallel batch is a data point. From the Workflow return (`{ integrationBranch, ledger,
  conflictsReplayed, multiLaneFiles, derivedRegenerated }`) and the session, report and judge:
  1. **Landing happened on the live branch, once** — confirm the main agent merged `integrationBranch` (a
     single `git merge`) rather than the workflow writing the branch directly, and that the temp branch was
     deleted. An un-landed integration branch left dangling is uncaptured state — surface it.
  2. **`multiLaneFiles`** (files changed by >1 lane — the residual *silent clean-but-wrong merge* risk):
     name each and confirm it was eyeballed. After the #1145/#1146 per-entry split this is usually empty;
     a non-empty list that wasn't reviewed is a real close concern, not FYI.
  3. **Conflicts/replays** (`conflictsReplayed`): a few are normal (the partition self-corrected to serial).
     **Heavy** replay — most lanes falling back — means the probe/partition is mis-predicting touch-sets:
     that's the **reevaluation signal**, worth a backlog note ("parallel default mis-partitioned on <pool>,
     consider opt-in"), because the whole point of the default is that it usually *avoids* replays.
  4. **Final gate green on the landed tree** and **derived artifacts regenerated once** (AGENTS.md /
     referenceIndex.json not double-applied). A red landed tree is a close blocker like any red gate.
  This audit is the agreed watch on the parallel default — if a session's evidence says it misbehaved, the
  correct output is a filed reevaluation item, not silence.

Before proposing a new backlog item, **dedup**: list existing titles and `grep -rilE "<topic>" backlog/`
(per backlog-workflow's review-first rule). Extend an existing item rather than adding a near-duplicate.

**Review the whole backlog for doubles**, not only before adding: `ls backlog/` titles + grep related
terms, and flag any overlapping pair (watch for parallel-but-distinct tracks — cross-reference, don't
merge). Capture anything uncaptured now. This is the step that actually prevents loss.

### 2. Repo health gate
Run the project's validation/tests and report pass/fail:
```bash
npm run check:standards   # if present (this repo's invariant gate)
npm test                  # or the project's unit suite, if quick
```
If a build can break silently (e.g. 11ty), a quick build-smoke is worth it:
`npx @11ty/eleventy --output=/tmp/close-check` and check for template errors.

**Auto-regen safe stale generated artifacts — no asking (standing authorization, 2026-06-27).** If the
gate's only error(s) are a **stale generated artifact with a known, deterministic regenerate command** —
the fix is a pure regeneration with **no judgment/content decision** (e.g. `AGENTS.md inventory is stale →
npm run gen:inventory`; a stale `referenceIndex.json` / inventory of the same shape) — **run that command,
then re-run the gate.** This only syncs generated output to the real tree, so it has no impact and needs
no prompt; the regenerated file becomes part of this session's footprint and folds into the clean
auto-commit (step-2 Hard rule). **Do not** auto-fix a red gate that needs a real code/content change —
that stays a reported blocker and makes the state *not clean* (so no auto-commit). If you're unsure
whether an error's fix is a pure regen, treat it as a real blocker and report it.

### 3. Working-state report (FYI, never a blocker)
```bash
git rev-parse --abbrev-ref HEAD
```
State the **branch**. If the clean auto-commit (step-2 Hard rule) fired, report the resulting **commit
sha(s)** here. Otherwise state the branch only — **do not list or count the remaining uncommitted files**
(they persist on disk; at close it's noise) and do **not** turn this into a commit prompt (the auto-commit
rule already made the commit decision; if it didn't fire, the state wasn't clean and that's reported, not
re-asked).

### 3a. Efficiency-introspection (advisory, never a blocker — standing step, all session types)
The close is the one moment that sees the session's **whole** execution, so it's the cheapest place to
spot recurring overhead the session itself just paid — regardless of what kind of session it was (build,
drain, review, decide, batch, …). **Skip this step entirely on a trivial session** — a quick read-only
check, a single small edit, a short Q&A with no multi-step execution to look back on — say nothing, don't
emit an empty table for it.

On a non-trivial session, scan the transcript for two evidence-based shapes of avoidable overhead (cite
the actual turn/command; never a plausible-sounding guess backfilled after the fact):
- **(a) Main-loop steps that should have been delegated** — work that ran inline on the primary loop
  when it was **not** one of the things that must stay there. The test is *delegate-by-default*, not
  "did it qualify for a cheap model". Where the project documents the split
  (`docs/agent/backlog-workflow.md` → **"Model routing"**), read its lane table for what stays inline
  rather than judging from memory, and **skip this half** when that section's *one override* applied
  (the harness forbade the Agent tool — nothing could have been delegated). Name the concrete `#NNN`s
  so the next claim routes them down — but this half fires on **any** project: it's a general
  main-loop-vs-delegate check, not contingent on that doc existing.
- **(b) Ad-hoc command sequences that should be scripted** — the same shell/`node -e` incantation (or a
  close variant) hand-run more than once this session, or a multi-step manual sequence a script/CLI
  subcommand could wrap in one call. Name the repeated command and where a script/CLI addition would
  collapse it (e.g. "5× inline `node -e` reductions → a `review-core.mjs reduce` subcommand").

**Each finding is an emit, not a proposal** — `kind: improvement`, `area: model routing` or
`area: scripted tooling`, the observation in `summary` and the fix in `suggestion`. Route it through §1a
like every other observation; do **not** propose a backlog item, dedup it against existing memory, or
decide whether it's worth acting on. Overhead that only shows up once is noise; overhead that shows up in
session after session is a real cost, and only the pool can tell those apart.

Show the findings in the close's own output as a **bounded table** (max 5 rows; if more genuine candidates
exist, keep the 5 highest-value and add "+N more, same shape" below it — never an unbounded dump), so the
operator can see what you emitted:

| Type | What | Evidence | Suggested fix |
|------|------|----------|----------------|
| delegate \| script | <one-line description> | <the turn/command cited> | <e.g. "sub-agent", "scripts/foo.mjs subcommand"> |

Purely advisory — it never blocks the close and never forces a change this turn. If the session is
non-trivial but the scan turns up nothing, say "nothing to flag" (not an empty table).

### 3b. Session cost (advisory, never a blocker)
Report the session's **usage-equivalent** dollar cost — what it would cost if billed per-token on the API
(subscription plans aren't charged this; it's a cost-awareness figure). Run:
```bash
node ~/.claude/skills/closing-session/session-cost.mjs
```
It sums the current session's transcript (input / cache-write / cache-read / output, per model, at that
model's **current** rates — cache-writes priced by tier, unknown models warned + excluded, never priced as
opus) and prints a one-line total plus a token breakdown. Put the total on the **Session cost** line of the
verdict template; the breakdown can sit under it if useful. Never a blocker.

### 3c. Cost-on-card attribution (accrue the session cost to the item worked)
Fold the session's usage into the backlog item(s) this session actually advanced, so a card carries its
true cumulative cost over its whole life (e.g. /prepare then /decide sum into one running total). What's
**durable on the card is the token breakdown** (`costTokens`); `costUsd` is **derived** from it at each
accrual through the one shared rate table, so it re-prices itself when rates change and can never drift.
Forward the estimator's `--tokens-only` line straight to the `cost` verb — tokens, not a raw dollar figure:
```bash
tokens=$(node ~/.claude/skills/closing-session/session-cost.mjs --tokens-only)   # e.g. "in=54 cw=93964 cr=1939233 out=24453"
node scripts/backlog.mjs cost <NNN> --tokens="$tokens"   # accrues costTokens (cumulative) + derives costUsd + bumps costSessions
```
**Which card(s), and whether to attribute at all — the judgment half:**
- **A single dominant item** (a `/decision`, `/prepare`, or focused build session that mostly worked one
  card) → attribute the **full** token breakdown to that one `<NNN>`.
- **A `/workflow` (parallel) session** → the orchestrator is light; **even-split** the tokens across the N
  items the workflow resolved (from its ledger) and accrue an `1/N` share to **each** card. Divide each
  token count by N and pass the split breakdown:
  `for n in <NNN...>; do node scripts/backlog.mjs cost "$n" --in=$((IN/N)) --cw=$((CW/N)) --cr=$((CR/N)) --out=$((OUT/N)); done`.
  (If the items landed via lane PRs still mid-drain, this frontmatter-only bump is low-conflict — accrue
  on the primary copy as normal; it rides the next commit.)
- **A `/slice` or `/resolve` session, or any session with no clear item worked** → **attribute nothing**
  (these don't represent an item's build cost). Skip silently.
Attribute **once per close** (re-running would double-count). Report the accrual in the **Footprint** line
(e.g. "cost $X → #NNN"). The card edit folds into the clean auto-commit like any other frontmatter splice.

### 3d. Review/PR-flow improvement suggestion (advisory, never a blocker)
The auto-review/merge gate (`scripts/lib/review-escalation.mjs`, `scripts/merge-ai-prs.mjs`,
`scripts/pr-land.mjs`, `scripts/lib/pr-merge-gate.mjs`, the `drain`/`merge`/`review`/`pr`/`finish` skills)
is meant to get **stronger over time from the sessions that exercise it** — and the close is the cheapest
place to capture that, because it is the one moment that sees the whole session's experience with the flow.
A lesson about how the gate *should* work that surfaces mid-session and is never **recorded** is exactly the
leak §1 guards against, one dimension narrower. So when this session **touched the flow**, emit what it
taught.

**Fire only on a relevant session — the deterministic half (rule #51).** Emit this step **only** when either
holds; if neither, **omit it entirely** (no line, no verdict field — silence, like the efficiency line on a
trivial session, step 3a):
- **(a) The session edited a flow file.** Match the session's changed paths against the gate set:
  `scripts/lib/review-escalation.mjs`, `scripts/merge-ai-prs.mjs`, `scripts/pr-land.mjs`,
  `scripts/lib/pr-merge-gate.mjs`, `scripts/lib/review-core.mjs`,
  `scripts/lane-*.mjs`, the gate tests (`scripts/**/__tests__/` files matching `*review*` / `*gate*` /
  `*merge-ai*` / `*pr-land*`), or the `drain`/`merge`/`review`/`pr`/`finish` **skill sources** — a
  name-match, no judgment.
- **(b) The session exercised or bumped against the flow.** A PR this session opened **parked / escalated /
  went to `review:human`**, a review fired, a drain/merge ran, **or the user voiced friction** about the
  review/PR path (too slow, too much manual review, a gate that couldn't run, a step that felt like theater).

**When it fires — the judgment half: surface 1–3 CONCRETE, NAMED candidates**, not generic advice. What this
session's experience says would make the flow *stronger or cheaper* next time. The recurring high-value shapes:
- **A human review that a test could replace.** A gate step where the human adds little (can't evaluate it
  statically, or rubber-stamps an agent's opinion) but pays real time — the profile where a deterministic
  test is *strictly stronger* than a look (the `gate-invariants` tripwire pattern: assert the safety property
  exhaustively, then self-reference the test file in `GATE_SELF_PATHS` so only a change to the invariant needs
  a human).
- **Gate logic living in skill *prose* that could be *code*.** Anything the flow relies on the agent
  *following* rather than a script *enforcing* is invisible to CI — every bit moved prose→code is a bit that
  goes from "a human reviews it" to "CI reviews it." Name the specific step.
- **A check/gate the session couldn't run, or a friction point the user hit** — the same leak §1 catches, but
  aimed squarely at the flow itself.

**Every candidate is an emit — do not invent a new channel and do not file anything.** Drop each through
§1a as `kind: friction | missing-convention | improvement`, `area: review flow` (or `area: pr gating` — keep
it coarse so entries from different sessions cluster). Do **not** propose a backlog item, dedup against the
gate-hardening epic, or decide which candidates are worth acting on. The flow is meant to get stronger
**from the sessions that exercise it**, and that only works when the evidence accumulates: one session's
"this gate step felt like theater" is an opinion, five sessions' is a finding.

**Render the line, don't hand-type it (#2433).** Shape the emitted candidates as `{summary, route: 'pool'}`
and pass the list to `renderCloseSessionFlowLine({ candidates })` (`we:scripts/lib/review-core.mjs`) for the
**Flow improvements** line below — it also supplies the `"nothing to flag"` fallback when the array is
empty, so that exact wording is never re-typed per close.

### 4. Verdict
Emit the close audit in **exactly this template** — fixed field order, fixed labels, verdict last.
Every close should look the same so the user can scan it without re-reading:

```
## Close audit

**Footprint:** <files / new backlog items / reports / docs / commit shas this session — the artifacts>
**Context capture:** <"all session context is in backlog/reports/memory" OR name exactly what isn't + where it should go>
**Learnings emitted:** <N entries: "<kind>: <summary>" each — or "nothing to emit"; then the pool line from `npm run harvest:status`>
**Repo gate:** <✅ N errors=0, M warnings (pre-existing/unrelated) | ❌ red — what failed>
**Session cost:** <~$X.XX usage-equivalent (model, N turns) — from session-cost.mjs; + "→ #NNN" if accrued to a card (step 3c), or "not attributed (slice/resolve/no dominant item)">
**Branch:** <branch name only — never list or count uncommitted files>
**Efficiency:** <one line — N delegate/script candidates flagged this session (table above), or "nothing to flag", or omit entirely on a trivial session>
**Flow improvements:** <one line — concrete review/PR-flow improvement candidate(s) this session emitted, or "nothing to flag"; OMIT the line entirely if the session didn't touch the flow (step 3d)>
**Follow-ups (open by design):** <items deliberately left open, e.g. a blockedBy chain — or "none">

**Verdict:** ✅ Safe to close   |   ⚠️ Safe to close, with caveats — <only real caveats>
```

Rules for filling it:
- **Footprint** — the session's artifacts at a glance; group as files / items / reports / commits.
- **Context capture** — state it explicitly: either all context is durably saved, or name precisely
  what leaked and where it belongs. This is the line that matters most. **A lesson emitted to the pool is
  CAPTURED** — never report an emitted observation as uncaptured context and never let it trigger ⚠️. The
  pool is a durable home; that it hasn't been adjudicated yet is the design, not a leak.
- **Learnings emitted** — name each entry you dropped (kind + the one-line summary) so the operator can see
  what you recorded, then the pool depth/age from `npm run harvest:status`. **Naming what you emitted is
  not judging it** — do not rank the entries, do not say which "should" be acted on, and do not offer to
  file any of them. "nothing to emit" is a fine and common value. This line is never a caveat in the
  verdict; a deep or old pool is a nudge to run `/harvest`, not a close problem.
- **Repo gate** — pass/fail; if green, note the warning count is pre-existing so it doesn't read as new.
- **Session cost** — the one-line total from `session-cost.mjs` (usage-equivalent $; subscription isn't
  billed this). Advisory context-awareness only; never a caveat in the verdict.
- **Branch** — name only. Uncommitted work is **never** a caveat and is **not** reported here.
- **Efficiency** — advisory only (step 3a); the one-line summary of the delegate/script table (or
  "nothing to flag" on a non-trivial session with no findings). Never a caveat in the verdict. Omit the
  line entirely on a trivial session (step 3a's skip).
- **Flow improvements** — advisory only (step 3d). Present ONLY when the session touched the review/PR flow
  (edited a gate file, or exercised/bumped against it); otherwise **omit the line entirely**. When present,
  name the concrete candidate(s) you emitted, or "nothing to flag". Never a caveat in the verdict.
- **Follow-ups** — only work *intentionally* left open (e.g. a filed `blockedBy` chain); "none" if clean.
- **Verdict** — one line. ⚠️ only for real caveats: uncaptured context (offer to capture) or a red gate
  (offer to fix). Nothing after the verdict line.

Keep every field to one line where possible. The template is the whole output — no preamble, no recap
above it, no discussion below the verdict.
