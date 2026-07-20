---
name: closing-session
description: Pre-close safety check — confirm nothing is lost before ending a session. Use when the user asks "can I close this session?", "is it safe to close?", "are we done?", "wrap up", "end of session", or runs /closing-session. Audits whether session context is durably captured, runs the repo health gate, and reports working state. A commit is never *required*, but it auto-commits this session's own work (tight pathspec, no push) when the state is clean. When the project has the lane machinery, substantive agent-memory improvements land automatically — each candidate is red-teamed, then the survivors ride a lane → PR (the one place the close opens a PR). On a session that touched the review/PR gate, it also surfaces concrete improvement candidates to that flow (advisory).
---

# Closing-Session Check

Run when the user asks whether it's safe to close / end / wrap up a session. Goal: guarantee no
**context** is lost, and report repo health and working state. Produce a short checklist and a clear
verdict.

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
  content (the `~/.claude/…/memory` symlink points into the repo's `.claude/agent-memory/`), so it lands via
  the **red-team → lane → PR** path in **§1a**, never a direct write to the primary tree. This rule is a
  no-op in a normal solo-on-`main` repo with no such lock — there the current-branch commit above still
  applies, and §1a falls back to propose-with-go-ahead (no lane machinery).
- The only real blockers are **uncaptured context** and a **red repo gate** (one that needs a real
  code/content decision — not a regenerable artifact, see step 2). Everything else is FYI.
- The check is otherwise read-only — the only changes it performs unprompted are (a) a **safe
  generated-artifact regen** (step 2), (b) the **clean auto-commit** above, and (c) the **automatic
  memory improvement** of §1a (draft → red-team → lane → PR — survivors auto-land on green with **no human
  in the loop**, because the **red team is the reviewer**; the PR is only the audit/revert trail). Capturing missing context as a **backlog item**
  still happens **with the user's go-ahead**; only **memory** capture is the automatic §1a path.

## Steps

### 1. Context-capture audit (the important one)
Scan the session for anything durable that lives only in the conversation — decisions, findings,
gotchas, deferred work, open threads — and verify each has a home in the repo (`backlog/`, `reports/`,
`docs/agent/*.md`) or `memory/`. Specifically:
- Any **open TodoWrite items**? Unfinished work that should be a backlog item or finished now.
- Any **report** with open questions not registered in `/backlog/` (see `docs/agent/backlog-workflow.md`).
- Any **decision/finding/deferred follow-up** discussed but never written down.
- **Encountered-but-unfixed defects / inert gates** — a gate, check, test, or command this session
  **could not run, bypassed, or worked around** (e.g. "the locus `npm test` couldn't run — vitest isn't
  installed", a skipped/xfail'd test, a tool that errored and you routed around it). This is the most
  common build-session leak: the fix exists and has an owner, so it is a **backlog item**, filed, not an
  optional aside. Default to *proposing the concrete item* (title + ≤100-word digest) so the user
  approves a real thing, not a vague "want me to note this?". **Routing rule:** a finding with a *fix or
  an owner* → `backlog/` (file it); a finding about *how the user wants you to work* → `memory/`. Don't
  send an actionable repo gap to memory, and don't downgrade it to an opt-in offer — an unfiled gate gap
  is uncaptured context exactly like an unwritten decision. (**Routing, full form:** a finding with a
  *fix or owner* → `backlog/`; a finding about *how the user wants you to work* **or a reusable
  principle/correction the session established** → `memory/`.)
- **Working-style preferences** the user expressed → these belong in `memory/` or `~/.claude/CLAUDE.md`,
  **not** backlog.
- **Generalizable principles & reframes** — a *correction, reframe, or design principle that emerged this
  session and generalizes beyond the one item it surfaced on* belongs in `memory/`, **even when the
  specific decision was already written into a `backlog/` item.** This is the subtlest leak and the one
  the rest of this audit misses: a principle captured *only inside* the item that surfaced it reads as
  "captured" here (the file exists, the gate is green) but is **invisible to a future session reasoning
  about a different subject** — so the reusable lesson is lost while looking saved. The strongest trigger
  is **the user overturning or reframing your approach on the merits**: when a discussion changed *how
  you'd decide the next case* (not just this one), that is a memory write, not merely an item edit. Ask:
  "if a future session faced a *different* instance of this, would it benefit from what we just learned —
  and is that lesson anywhere it would actually look?" If not, draft the concrete memory (name +
  one-line description + body) as a **candidate** — it does not get proposed to the user and does not get
  written directly; it enters the §1a queue (memory-worthiness gate → red team → lane → PR). Distinct from *Working-style preferences*
  above: that captures *how the user wants you to work*; this captures *a reusable judgment/principle the
  session established*. (Worked example: #1377's "authoring SoT = the standard form, impls are removable
  adapters" reframe — written into the decision item, but the *principle* only reached memory because the
  user asked; it should have been proposed when the reframe landed.)

- **Memory-worthiness gate — the red team's first pass; never spend a slot that won't earn its keep.** A
  memory candidate drafted above only advances to §1a (land via lane → PR) if it survives this check; a
  candidate that fails is dropped — report it as "captured on-disk, not memory-worthy" and move on. This is
  the deterministic front half of the red team; §1a adds an adversarial reviewer that re-runs these filters
  *plus* a faithfulness check. The three filters (a candidate must pass all):
  1. **Dedup against the existing cluster.** Read `MEMORY.md` and find the entries nearest the lesson. If
     it's a *fresh angle on a principle already covered* by ≥1 entry (a 4th take on "verify real state",
     "separate by default", etc.) rather than a **new axis**, it does not earn a slot — the existing
     cluster already fires for the next session. Only a genuinely uncovered axis passes.
  2. **Budget/eviction cost.** If the index is at/near its cap (the budget hook refuses the add, or it's
     within a line or two of the limit), adding *evicts* an existing entry. Only propose if the candidate
     **clearly outranks the weakest current entry** — a marginal lesson that forces an eviction is a net
     loss, not a save. When unsure, don't.
  3. **On-disk sufficiency.** If the *specific* fix already lives in a `backlog/`/`reports/` artifact that
     anyone working that area will see, and the principle is narrow or rare (a one-off race, not a
     recurring decision pattern), leave it on-disk — memory is for the reusable-and-likely-to-recur, not
     for everything true.
  Net: advance the high-value, uncovered, recurring lessons to §1a; silently leave the rest on-disk. Saving a
  lesson that isn't worth keeping is itself a cost (it crowds the index and dilutes recall).

### 1a. Automatic memory improvement — red-team → lane → PR
**Runs only when the project has the lane machinery (`scripts/lane-pool.mjs`).** Without it (a normal
solo repo), skip §1a and fall back to the legacy path — *propose* each surviving candidate to the user
with a name + one-line description and write it directly on go-ahead. With it, memory improvement is
**fully automatic and non-blocking**: no per-candidate "want me to save this?", and **no human in the
loop** — **the red team is the reviewer** and the PR **auto-lands on green**. The human never gates a
batch; the PR + git history are a *retrospective audit trail* (spot-check anytime, one-command revert if
the red team ever lets a bad entry through), not a review step the loop waits on.

Agent memory is **git-tracked project content** (`.claude/agent-memory/`, where the `~/.claude/…/memory`
symlink points), so a memory edit lands the same way every tracked change does — a **lane clone → PR**,
never a direct write to the primary tree. For **memory candidates only** (backlog captures still ask):

1. **Draft** every candidate that cleared the memory-worthiness gate above — the concrete file(s) (name +
   frontmatter + body with `[[links]]`) *and* the `MEMORY.md` / sub-index pointer line. Draft in-session;
   do not write to the primary tree.
2. **Red-team each candidate — one skeptic sub-agent per candidate, mandate = kill it, default to REJECT.**
   Spawn an `Agent` (Sonnet is fine — it's bounded) that must clear **all four** or the candidate is dropped:
   - **Dedup** — a fresh *angle* on a cluster already covered (not a new axis)? → reject.
   - **Budget/eviction** — would adding it evict a stronger existing entry (index at/near cap)? → reject.
   - **On-disk sufficiency** — does the specific lesson already live where anyone in that area will see it,
     and is it narrow/rare? → reject.
   - **Faithfulness** — did *this session actually establish* this, in the transcript — not a
     plausible-sounding generalization the model backfilled? It must **quote the grounding turn** or → reject.
   Reject on any uncertainty (mirrors the gate's "when unsure, don't"). **Escalate to a 3-vote panel only
   when the budget filter fires** (the add would force an eviction) — a marginal lesson that costs an
   existing slot needs a majority to survive. Record each verdict + one-line rationale for the report.
3. **Land the survivors via lane → PR (automatic, no ask).** Use the standard transport `/pr` documents:
   - Provision/reuse a lane clone: `node scripts/lane-pool.mjs provision --count=1 --json` (or a mapped
     lane), then `git reset --hard origin/main` in that clone. **All writes happen in the clone**, never primary.
   - Write the survivor file(s) + the index pointer **in the clone**; commit **tight-pathspec** (`git add`
     the exact memory paths — **never** `-A`), message `memory: <the lesson, one line>`.
   - `node scripts/pr-land.mjs --ref=lane/memory-<slug> --sha=HEAD --base=main --body-file=<digest> --label-on-green`
     — opens the PR and **auto-lands it on green** via the standard self-approval, **with no human in the
     loop**. Memory carries no runtime/CI risk, so it rides the normal drain like any AI PR. The red team
     (step 2) is the gate; the merged PR is just the audit trail + revert path, never a review the loop
     waits on. One PR per close is fine (batch the survivors); title it `memory: <N> lesson(s)`.
   - If **zero** candidates survive the red team, do nothing and say so — an empty pass is the common,
     correct outcome, not a failure.
   Report the memory PR in **Footprint** (`memory PR #NNN: <slugs>`), and note any red-team rejections in
   **Context capture** as "left on-disk (red-team rejected: <reason>)". This is the **one** place the close
   opens a PR — the Hard-rules "never open a PR" carve-out, memory only. Backlog capture, cost attribution,
   and the session's own auto-commit are unchanged.
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
- **(a) Main-loop steps that should have been delegated** — execution that ran inline on the primary loop
  but was mechanically clear + bounded (single locus, no contract/shared-gate decision, already prepared)
  — exactly what a `Task`/sub-agent call would have kept off the expensive main-loop context. Where the
  project documents a routing split (`docs/agent/backlog-workflow.md` → **"Model routing"**, the
  Opus-orchestrates/Sonnet-executes pattern), name the concrete `#NNN`s so the next claim routes them
  down — but this half fires on **any** project: it's a general main-loop-vs-delegate check, not
  contingent on that doc existing.
- **(b) Ad-hoc command sequences that should be scripted** — the same shell/`node -e` incantation (or a
  close variant) hand-run more than once this session, or a multi-step manual sequence a script/CLI
  subcommand could wrap in one call. Name the repeated command and where a script/CLI addition would
  collapse it (e.g. "5× inline `node -e` reductions → a `review-core.mjs reduce` subcommand").

Emit findings as a **bounded table** (max 5 rows; if more genuine candidates exist, keep the 5
highest-value and add "+N more, same shape" below it — never an unbounded dump):

| Type | What | Evidence | Suggested fix |
|------|------|----------|----------------|
| delegate \| script | <one-line description> | <the turn/command cited> | <e.g. "sub-agent", "scripts/foo.mjs subcommand"> |

Route candidates the same way §1's routing rule does: a fix with a concrete owner → propose it as a
`backlog/` item (dedup first, per §1's backlog-dedup step); a reusable working-pattern that generalizes
beyond this one session → `memory/` via §1a. It is purely advisory — it never blocks the close and never
forces a change this turn. If the session is non-trivial but the scan turns up nothing, say "nothing to
flag" (not an empty table).

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
A lesson about how the gate *should* work that surfaces mid-session and is never offered is exactly the leak
§1 guards against, one dimension narrower. So when this session **touched the flow**, surface what it taught.

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

**Route the candidates the normal way — do not invent a new channel** (this is §1's routing rule applied to
the flow): a candidate with a **fix or an owner** → a **`backlog/` item** (propose it with the user's
go-ahead, dedup first — file it under the open gate-hardening epic if there is one); a **reusable principle
about how the flow should work** → **`memory/` via §1a** (red-team → lane → PR). It is purely advisory: it
never blocks the close and never forces a change this turn.

**Render the line, don't hand-type it (#2433).** The judgment above (which candidates qualify, where each
routes) stays yours; once decided, shape them as `{summary, route: 'backlog'|'memory', target}` (`target` the
`#NNN`/slug you just filed or routed to) and pass the list to `renderCloseSessionFlowLine({ candidates })`
(`we:scripts/lib/review-core.mjs`) for the **Flow improvements** line below — it also supplies the
`"nothing to flag"` fallback when the array is empty, so that exact wording is never re-typed per close.

### 4. Verdict
Emit the close audit in **exactly this template** — fixed field order, fixed labels, verdict last.
Every close should look the same so the user can scan it without re-reading:

```
## Close audit

**Footprint:** <files / new backlog items / reports / docs / commit shas / memory PR #NNN this session — the artifacts>
**Context capture:** <"all session context is in backlog/reports/memory" OR name exactly what isn't + where it should go>
**Repo gate:** <✅ N errors=0, M warnings (pre-existing/unrelated) | ❌ red — what failed>
**Session cost:** <~$X.XX usage-equivalent (model, N turns) — from session-cost.mjs; + "→ #NNN" if accrued to a card (step 3c), or "not attributed (slice/resolve/no dominant item)">
**Branch:** <branch name only — never list or count uncommitted files>
**Efficiency:** <one line — N delegate/script candidates flagged this session (table above), or "nothing to flag", or omit entirely on a trivial session>
**Flow improvements:** <one line — concrete review/PR-flow improvement candidate(s) this session suggests + where each routed (backlog/memory), or "nothing to flag"; OMIT the line entirely if the session didn't touch the flow (step 3d)>
**Follow-ups (open by design):** <items deliberately left open, e.g. a blockedBy chain — or "none">

**Verdict:** ✅ Safe to close   |   ⚠️ Safe to close, with caveats — <only real caveats>
```

Rules for filling it:
- **Footprint** — the session's artifacts at a glance; group as files / items / reports / commits.
- **Context capture** — state it explicitly: either all context is durably saved, or name precisely
  what leaked and where it belongs (and offer to capture it). This is the line that matters most. A lesson
  the memory-worthiness gate **deliberately left on-disk** (failed dedup/budget/sufficiency) is **captured,
  not leaked** — do not report it as uncaptured context and do not let it trigger ⚠️; if useful, note it in
  one clause as "X left on-disk (not memory-worthy)", never as a follow-up to offer.
- **Repo gate** — pass/fail; if green, note the warning count is pre-existing so it doesn't read as new.
- **Session cost** — the one-line total from `session-cost.mjs` (usage-equivalent $; subscription isn't
  billed this). Advisory context-awareness only; never a caveat in the verdict.
- **Branch** — name only. Uncommitted work is **never** a caveat and is **not** reported here.
- **Efficiency** — advisory only (step 3a); the one-line summary of the delegate/script table (or
  "nothing to flag" on a non-trivial session with no findings). Never a caveat in the verdict. Omit the
  line entirely on a trivial session (step 3a's skip).
- **Flow improvements** — advisory only (step 3d). Present ONLY when the session touched the review/PR flow
  (edited a gate file, or exercised/bumped against it); otherwise **omit the line entirely**. When present,
  name the concrete candidate(s) and where each routed, or "nothing to flag". Never a caveat in the verdict.
- **Follow-ups** — only work *intentionally* left open (e.g. a filed `blockedBy` chain); "none" if clean.
- **Verdict** — one line. ⚠️ only for real caveats: uncaptured context (offer to capture) or a red gate
  (offer to fix). Nothing after the verdict line.

Keep every field to one line where possible. The template is the whole output — no preamble, no recap
above it, no discussion below the verdict.
