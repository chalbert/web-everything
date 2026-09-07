---
kind: decision
parent: "3383"
status: open
scaffoldedBy: "file-prepare-auto-conflict-resol-lane-16-0981ca21"
dateScaffolded: "2026-09-06"
dateOpened: "2026-09-06"
preparedDate: "2026-09-06"
relatedReport: reports/2026-09-06-parked-pr-conflict-auto-resolution-research.md
tags: [conveyor, drain, review, merge, conflict, dispatch]
---

# Automate merge-conflict resolution on parked PRs — dispatch an agent, never a script

we:scripts/conveyor/parked-pr-conflict-watch.mjs (#3494, landed) detects when a parked PR
(`review:pending`/`review:human`/an uncleared `review:changes`) drifts into a real merge conflict against
`main` and applies a `merge-status:conflicting` label plus a one-time comment — deliberately alert-only, no
auto-fix, because rewriting unreviewed content pre-review was judged too risky for a pure mechanical script
to attempt blindly. Design discussion on 2026-09-05 concluded that risk assessment was about a *script*
blindly auto-merging; dispatching a real *agent* to attempt resolution is a different, lower-risk shape,
since the result still goes through the SAME independent-review gate before it can land — no different from
we:scripts/conveyor/reconcile-fix-dispatch.mjs's already-shipped `review:changes` bounce-and-fix loop for an
ordinary reviewer finding. Four forks below rule how that dispatch actually works. Research (grounded in the
real tree, not restated uncritically — see we:reports/2026-09-06-parked-pr-conflict-auto-resolution-research.md)
found the four forks collapse further than expected: forks 2-4 are variations on ONE answer ("reuse the
existing bounce+fix-dispatch pipeline wholesale"), and fork 1 surfaced a genuinely open, already-tracked,
ratified-statute-flagged uncertainty the operator's own framing had not anticipated.

### Recommended path at a glance

| | recommended default | main alternative | confidence |
| --- | --- | --- | --- |
| Fork 1 | **(c) resume via the `authored-by-actor` id, through the existing dispatch operation; verify no fork-a-copy; fall back to fresh-dispatch** | (a) always fresh-dispatch | medium |
| Fork 2 | **(a) every parked PR the existing conflict-watch predicate already targets, including `review:human` — EXCEPT a conflict inside a principle-surface file** | (b) exclude every `review:human` PR wholesale | high |
| Fork 3 | **(a) reuse `we:scripts/conveyor/reconcile-core.mjs`'s existing durable cap + `we:scripts/conveyor/stand-down.mjs --reason=conflict` — one small brief addition owed** | (b) a dedicated conflict-retry counter | high |
| Fork 4 | **(b) route through the existing bounce+fix-dispatch pipeline via `we:scripts/conveyor/reconcile-finding.mjs`, with a broadened shared banner** | (a) a new parallel dispatch pass | high |

## Why this is live now

`#3494`'s own design explicitly refused to auto-resolve a conflict because "resolving it means choosing which
side's edit wins in the overlapping region... rewriting a review-parked PR's content before it has been
reviewed is unsafe." That reasoning is correct for a *script* — a deterministic pass with no judgment has no
principled way to pick a side. It does not, on inspection, extend to a *dispatched agent* whose output still
lands through the exact same review gate `#3494` itself is protecting: nothing about resolving a conflict
mechanically bypasses `review:human`/`review:pending`/`review:accepted`, because — as this research confirms
below (Fork 2) — the fix-agent pipeline this item reuses is already forbidden from touching those labels for
ANY reason, conflict or otherwise. So the actual gap is narrower than `#3494`'s own text suggests: not "should
a conflict ever be resolved mechanically" (already answered "not by a bare script"), but "should a conflict be
handed to the SAME agent-dispatch-then-independent-review loop this repo already runs for every other kind of
reviewer finding" — with one carved-out exception this research surfaced (Fork 2) for the one case where an
agent choosing which side wins IS drafting principle content, not ordinary code. Filed under `#3383` (the
background mechanical dispatcher epic) because this is a new mechanized launch trigger onto the SAME dispatch
machinery that epic already built and ratified (`#conveyor-dispatch-calls-the-declared-operation`, `#3118`).

## Fork 1 — does the dispatch prefer resuming the PR's original builder session?

*Why this is a fork:* a resumed session carries context a fresh agent structurally cannot reconstruct from
the PR body + diff alone — why a rejected approach was rejected, a transient discovery never written down,
the intent behind an odd-looking line. That is a genuine, irreducible information asymmetry between the two
branches (confirmed by an independent two-confusion screen: this holds "even at infinite budget," so it is
merit, not cost dressed up). The two branches cannot be quietly merged into one: a caller either attempts to
reach the original session or it does not.

**The mechanism the operator proposed exists, but not exactly as assumed.** `claude --help`'s own `--bg` line,
read directly: *"With --resume <session-id>, continues that session in the background under the same ID, or
starts a copy and says so when the session is already running."* This is reachable only by a plain
child-process call to the `claude` CLI — no `SendMessage`, no Agent-tool reach needed, because none of the
callers here (we:scripts/conveyor/reconcile-fix-dispatch.mjs and its siblings) are themselves agent turns with
tool access; they are bare `node` scripts. (`SendMessage` IS a real, separately-confirmed mechanism for
reaching a live independent background session — we:backlog/3435-*.md documents the operator's own session
messaging `conveyor-3452`/`prepare-3448` directly and getting a reply — but it is a tool call, not something a
headless mechanical pass can invoke on its own, so it is not the right primitive for this layer.)

**A live, ratified statute anchor already governs this exact territory — this fork must implement WITHIN it,
not alongside it.** we:docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation
(`#3118`, ratified 2026-08-26) rules TWO things that both bind here: stop-then-resume IS the accepted conveyor
steering mechanism ("clause 3... *that sufficiency is the operator's ruling and it stands*"), AND every
dispatch must go through the ONE declared spawn implementation — "a second module that spawns `claude` for
the conveyor is... forbidden whether the rival lives in this repo or a sibling one" (clause 1). So the
resume attempt is NOT a standalone exec call added next to the existing dispatcher — it is a new argv branch
added INSIDE `we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv` (an optional `resumeSessionId`
parameter that emits `--resume <id>` in place of `--session-id <fresh-uuid>`), reached through
`we:scripts/conveyor/reconcile-fix-dispatch.mjs#dispatchFix` exactly as every other dispatch is. "Widening
dispatch... extends the declared operation; it does not fork a new spawner" (clause 1, verbatim) is the test
this fork's implementation must pass, not merely cite.

**That same statute names a live, unresolved trigger this fork must be honest about, not paper over.**
Clause 3's own text: *"if `#3331`'s probe comes back negative — if `claude --bg` really does discard
`--session-id`, the dispatcher cannot address the session it started, and stop-then-resume is unreachable as
designed until `#3331`'s own remedy... exists."* **Correction to a secondary narrative found during this
research:** `#3383`'s own session-update log claims *"Session-identity fix (#3331, resolved)."* Read against
its own primary card, that is stale: we:backlog/3331-*.md's frontmatter reads `status: open`, its own probe
(2026-08-27, CLI 2.1.246) found `--session-id` IS discarded on `--bg` (3 of 3 mismatched, with the CLI itself
warning `--bg manages the session id; ignoring --session-id (use --resume <id> to continue an existing
session)`), and its own "Remedy status" says *"started, not landed... 53 commits behind main."* Confirmed
directly against the current tree: `buildAgentArgv` (~line 901 of the file above) still emits
`'--session-id', String(sessionId)` with no `--resume` anywhere and no read-back of a real id — matching the
OPEN status, not the epic's "resolved" claim. **This item treats `#3331` as open**, per its own primary
record, not the secondary narrative.

**Why this fork's build is not simply blocked on `#3331`, and exactly what remains genuinely open even so.**
`#3331`'s own measured defect is that `dispatch-lane` MINTS a request-side id and then tries to match it
against the listing — that match fails because `--bg` silently reassigns its own id. This fork's design never
does that: it reads the REAL id back from the PR's own `authored-by-actor` stamp
(we:scripts/pr-land.mjs#withAuthorStamp, `<!-- authored-by-actor: <uuid> -->`, the value of
`CLAUDE_CODE_SESSION_ID` the builder's OWN process saw at PR-open — necessarily the CLI's real, self-assigned
id, not a discarded request), then compares THAT value against `claude agents --json --all`'s own `sessionId`
field to confirm the session is still listed at all. That side-steps `#3331`'s exact failure mode by
construction — it never asks the CLI to honor a minted id, only to resume an id it already assigned. What
`#3331`'s own probe never tested, because it only probed the REQUEST-side `--session-id` flag, is whether
`claude --bg --resume <id>` itself accepts the FULL `sessionId` UUID (what `authored-by-actor` supplies) or
wants the SHORT `id` field instead — a genuinely separate, still-open question. There is a live, hard-won
precedent for exactly this kind of field confusion: we:scripts/conveyor/session-reaper.mjs's own header
documents that `claude stop` silently fails against the full `sessionId` and needs the SHORT `id` instead — a
wrong-field bug that looked, for a while, like CLI flakiness.

**Recommended default — (c).** Extract the `authored-by-actor` UUID from the PR body. Look it up in
`claude agents --json --all`'s `sessionId` field (not `id`) to find the matching row — if none is found (the
session has fully exited AND its registry entry has been reaped, e.g. by
we:scripts/conveyor/session-reaper.mjs), go straight to a fresh dispatch with the PR's own body + diff as
context; no resume is attempted against a listing that cannot even confirm the session ever existed. If a row
IS found, dispatch through `buildAgentArgv`'s new `resumeSessionId` branch (never a bespoke exec — see above)
and compare the id the CLI reports backgrounding under against the id requested: same id ⇒ a genuine resume,
proceed; a DIFFERENT id ⇒ the CLI silently forked a copy because the original was still actually running
(documented CLI behavior, not a guess) — immediately `claude stop` the accidental copy
(we:scripts/operations/dispatch-abort.mjs#stopSession, never a bare `kill`, per `#3383`'s own hard-won lesson)
and fall back to fresh-dispatch rather than let two builders touch the same conflict.

**Rejected alternative — (a) always fresh-dispatch.** Simpler, zero new surface, but throws away exactly the
context this whole item exists to preserve — the operator's own stated reason for wanting this ("it already
has full context on why the code was written that way — better than a fresh session with none"). Rejected as
the *default*, though it remains the correct fallback for every case (c) cannot cleanly resolve, and is
ALSO the correct interim behavior if the build-time gate below is not yet cleared.

**Build gate, named as a hard prerequisite, not a soft footnote.** Before this fork's resume branch is wired
into the live dispatch path, its build owes a narrow, three-run probe mirroring `#3331`'s own methodology but
scoped to `--resume` specifically (never probed by `#3331`, which only tested `--session-id`): does
`claude --bg --resume <sessionId-uuid>` correctly continue the named session, and does the CLI's stdout carry
a parseable marker distinguishing "continued" from "started a copy"? Until that probe runs and answers both
questions, this fork's build ships with the resume branch present but the fresh-dispatch fallback as the ONLY
path actually exercised — i.e., (c)'s fresh-dispatch half is real Done-when-buildable content today; its
resume half is gated on the probe. This is stricter than treating the unknowns as ordinary build-time
polish, per a skeptic pass's own finding that citing `claude --help` alone, without also gating on a
repo-native probe, understates a known-negative adjacent result (`#3331`).

**Skeptic:** classification (real fork, not a config-dimension — confirmed: the branches produce observably
different agent behavior). Merit: SURVIVES (context advantage is real, confirmed independently by the
two-confusion screen). Statute-overlap: found a real, load-bearing citation
(`#conveyor-dispatch-calls-the-declared-operation`) — first pass flagged the draft as routing around clause 1
(a bespoke exec) and treating `#3331`'s known-negative result as mere unfinished homework; REFUTED as first
drafted, revised above to route through `buildAgentArgv` exclusively and to make the `#3331`-adjacent probe a
hard build gate rather than a confidence footnote. Citation-scope: the `#3331` citation is now scoped
precisely (explains why this fork's id-recovery path differs from the one `#3331` measured broken, rather
than either hiding behind or dismissing its open status). SURVIVES-WITH-AMENDMENT (amended twice: mechanism
routing, and gate strength).
**Screen:** clear (pure implementation detail, invisible to any WE↔FUI boundary; merit-not-cost, confirmed by
an independent fresh-context screen).

## Fork 2 — scope: which parked PRs is this dispatched at?

*Why this is a fork:* an agent editing code is either allowed to run against a `review:human`-held PR or it
is not — there is no third, partial state, and the two branches produce genuinely different real-world
behavior for a human reviewer (confirmed by the two-confusion screen: this is a real semantic/safety
question, not a cost tradeoff).

**Recommended default — (a) no blanket carve-out, with one narrow, content-based exception.** Apply to every
parked PR the existing predicate already targets:
`we:scripts/lib/review-escalation.mjs#hasUnclearedReviewLabel(labels, {allowPending:false})` — an uncleared
`review:human`, `review:pending`, or `review:changes` — exactly what
`we:scripts/conveyor/parked-pr-conflict-watch.mjs#isParkedConflictTarget` already uses. Grounded in existing,
SHIPPED behavior, not a fresh judgment call: `we:scripts/progress-board.mjs#classifyPr` (lines 486-490) checks
`review:changes` and returns `'bounced'` *before* it checks `review:human` — so a PR carrying BOTH labels
today already classifies as `'bounced'`, and `we:scripts/conveyor/reconcile-core.mjs`'s `OWED.bounced = 'fix'`
already auto-dispatches a fix agent at it via `we:scripts/conveyor/reconcile-fix-dispatch.mjs`, for an
ORDINARY reviewer finding, right now, unconditionally. There is no reasoned basis to treat a merge-conflict
finding more cautiously than a code-quality finding for DISPATCH-ELIGIBILITY purposes on `review:human`
grounds alone, because both route through the identical fix-agent brief carrying the identical guardrail:
we:skills-src/conveyor/fix-agent-brief.md's own "Guardrails" section states plainly that `review:human` is
NEVER touched by a fix agent, and `we:scripts/conveyor/rearm-review.mjs`'s `decideSetLabel` machine-refuses to
ever emit `review:accepted` or remove `review:human` (backed by `we:scripts/review-set-label.mjs`'s
INVARIANT 2). The human clearance LABEL is therefore untouched either way.

**The one real exception a skeptic pass surfaced, and why it is narrower than a `review:human` carve-out.**
The label being untouched is not the same claim as the CONTENT being safe to auto-resolve. `#3494`'s own
motivating incident (PR #1920) was a gate-self/statute edit, and its own design docblock's reasoning —
"rewriting a review-parked PR's content before it has been reviewed is unsafe" — is at its strongest exactly
there: if the CONFLICTING hunk itself sits inside a declarative-leash or statute-tier file
(`we:scripts/lib/review-escalation.mjs#isDeclarativeLeashPath`/`#isStatutePath`, the same predicates
`deriveCareLevel`'s `humanRequired` already keys on), an agent choosing which side's text survives IS drafting
principle content, not ordinary code — the exact judgment this repo's own doctrine already reserves for a
human, independent of whatever review label the PR happens to carry. So the scope carve-out is by FILE
CONTENT of the conflicting hunk, not by PR LABEL: a conflict whose overlapping region touches a
declarative-leash/statute path routes straight to `we:scripts/conveyor/stand-down.mjs --reason=conflict`
(Fork 3) with no dispatch attempt at all, regardless of `review:human`/`review:pending`/`review:changes`;
every other conflict dispatches normally. This is a sharper, evidence-driven refinement of the operator's own
coarser "maybe exclude `review:human`" instinct, not a rejection of the underlying worry.

**Rejected alternative — (b) exclude every `review:human` PR wholesale.** This was the operator's own initial
framing. Research complicates it in both directions: it is TOO BROAD (most `review:human` PRs carry no
statute-tier conflict at all, and excluding them all forfeits the automation for no safety gain — the label
alone says nothing about the conflicting hunk's own content) and, per the exception above, arguably also TOO
NARROW in the wrong place (a statute-tier conflict on a PR that does NOT currently carry `review:human` — e.g.
one about to be escalated to it — deserves the same carve-out on content grounds, not because of a label that
may not even be applied yet). Confidence: **high**.

**Skeptic:** classification (real fork — confirmed). Merit: first pass found the draft's "label untouched ⇒
safe" reasoning incomplete against `#3494`'s own statute-edit motivating incident — SURVIVES-WITH-AMENDMENT,
resolved above by separating "which LABEL" (no carve-out) from "which CONTENT" (the new declarative-leash/
statute exception). Statute-overlap: the exception is now grounded directly in `isDeclarativeLeashPath`/
`isStatutePath`, the SAME predicates `#2771`/`#2785`'s own `humanRequired` derivation uses — reinforcing an
existing rule rather than colliding with it. Citation-scope: both citations (the `classifyPr` ordering and the
leash/statute predicates) are drawn from the exact mechanisms they are cited for. SURVIVES-WITH-AMENDMENT.
**Screen:** clear (impl-only; a genuine merit question even at infinite budget, per the independent screen).

## Fork 3 — retry/failure escalation: what happens when the dispatched agent can't cleanly resolve it?

*Why this is a fork:* an unbounded auto-repair loop with no human check-in is the exact failure `#2643`'s
durable rearm-count cap already exists to prevent, and a fresh conflict-specific escalation mechanism is a
second implementation of that same protection unless the merits say otherwise.

**Recommended default — (a) reuse wholesale, with one small, concretely-named brief addition owed.** Once
Fork 4 posts the conflict as a `review:changes` bounce, the PR is — by construction — an ordinary bounced PR
from the reconciler's point of view, and the cap machinery already exists and needs no change:
`we:scripts/conveyor/rearm-review.mjs#countRearmComments` (one comment posted per completed repair cycle) read
against `NEGOTIATION_ROUND_CAP` (5, `we:scripts/lib/jury-core.mjs`) by
`we:scripts/conveyor/reconcile-core.mjs#planReconcile` (`cap-exhausted` refusal, TERMINAL `stood-down` checked
first).

**A factual correction to this item's own earlier framing, caught by an adversarial pass reading the brief
directly rather than trusting a paraphrase of it.** `we:skills-src/conveyor/stand-down.mjs#STAND_DOWN_REASONS`
already names this scenario by hand (`conflict: 'a genuine same-line conflict with main blocked the repair'`)
— but it is wired ONLY into we:skills-src/conveyor/fix-agent-brief.md's "Manual take-over" section (the human
`/finish` path, step 3: "If you stop instead, run `we:scripts/conveyor/stand-down.mjs {{PR_NUM}} --reason=conflict`").
The brief's own AUTOMATIC path (step 3, the one an auto-dispatched fix agent actually runs) currently calls
only `node we:scripts/operations/completion-cli.mjs report --status=done --outcome=escalated-conflict` — a
completion record for the DISPATCH pipeline's own bookkeeping, never a durable comment on the PR itself.
Without that comment, `we:scripts/conveyor/reconcile-core.mjs`'s `countStandDownComments`-based `stood-down`
refusal never fires for an AUTO-dispatched conflict escalation, so
`we:scripts/conveyor/reconcile-fix-dispatch.mjs` would simply re-dispatch the same unresolved conflict again
next tick — bounded only by the 5-attempt rearm cap, not by the terminal stand-down exit this fork's default
otherwise relies on. **This item's build therefore owes one small, concrete addition:** add the same
`node we:scripts/conveyor/stand-down.mjs {{PR_NUM}} --reason=conflict` call to the brief's AUTOMATIC step 3,
alongside its existing `we:scripts/operations/completion-cli.mjs` report, mirroring exactly what the brief's
own manual-path step 3 already does. This is a small, well-scoped brief edit, not a new mechanism.

**Correction to the operator's own suggested tool for a different reason.** The task's own framing suggested
reusing `we:scripts/conveyor/reconcile-finding.mjs` to post the "could not auto-resolve" finding. Research
found this is the wrong mechanism for that moment: `we:scripts/conveyor/reconcile-finding.mjs` posts a NEW
`review:changes` bounce when a mechanical pass discovers a fresh cross-cutting concern — that is Fork 4's job
(turning the ORIGINAL conflict into a bounce). "The dispatched agent already tried and cannot resolve it" is a
different, later moment on a PR that is ALREADY `review:changes`, and
`we:scripts/conveyor/stand-down.mjs` is the tool actually built for it.

**Why sharing ONE counter across every bounce cause (a conflict OR an ordinary reviewer finding) is the
behaviorally correct answer, not merely the cheap one** (an independent two-confusion screen initially flagged
this fork as cost-dressed-as-merit and forced this reasoning to be made explicit). The cap exists to answer
one question: *has this PR been through enough unsupervised auto-repair round-trips that a human should look,
regardless of what kept making one necessary?* A PR that burned 3 attempts on real reviewer findings and then
drifts into a conflict needing 2 more auto-repair cycles has had FIVE unsupervised round-trips with zero human
intervention — precisely the situation the cap was built to catch, arguably more urgently than either cause
alone. Splitting the counter by cause would let a PR silently accumulate a larger TOTAL number of unsupervised
repair cycles than the cap was ever meant to allow — a real behavioral regression, not a neutral engineering
choice. No evidence surfaced in this research (or in `#2643`'s own history) that a conflict-driven repair
legitimately needs a *structurally different* attempt budget than a finding-driven one; absent that evidence,
a second counter is exactly the kind of unforced, unevidenced fork the standing prepare test warns against
ratifying.

**Rejected alternative — (b) a dedicated conflict-retry counter.** Real, but it duplicates a solved seam for
no evidenced behavioral gain, and — per the reasoning above — risks silently *raising* the effective
unsupervised-repair ceiling for any PR that hits both failure causes, the opposite of the cap's own purpose.
Confidence: **high**.

**Skeptic:** classification (confirmed a real fork exists: "shared vs. isolated cap," argued on behavioral
merit). Merit: first pass caught a real factual error (the "already wired into the auto path" claim was
false — see correction above) — SURVIVES-WITH-AMENDMENT, resolved by naming the exact one-line brief addition
this item's build owes rather than asserting the wiring already exists. Statute-overlap: none found — no
anchor in `we:docs/agent/platform-decisions.md` governs retry-cap sharing. Citation-scope:
`STAND_DOWN_REASONS.conflict` is exactly on-point (authored for this precise scenario) once correctly scoped
to the manual path plus the named build addition for the automatic one. SURVIVES-WITH-AMENDMENT.
**Screen:** flagged(prio) → fixed. The screen's own finding: *"the stated rationale ('no new counter... reuse
the EXISTING') is a build/maintenance-avoidance argument... the only thing that would make one branch
genuinely better is whether sharing the cap across unrelated failure causes changes behavior."* Addressed
directly above — the default is now argued on exactly that question, with the reuse-avoids-duplication point
demoted to a secondary observation.

## Fork 4 — dispatch mechanism: how does a detected conflict actually reach a dispatched agent?

*Why this is a fork:* two independent, uncoordinated dispatch authorities that can both fire on the same PR
(a new parallel conflict-dispatch pass running alongside the existing bounce+fix-dispatch pipeline) is a real
double-dispatch/race hazard — the exact class of bug `#3416` already found and fixed once for the ordinary
dispatch path. Funneling every "this PR needs a fix agent" decision through ONE pipeline is a correctness
property, not a style preference (confirmed independently by the two-confusion screen).

**Recommended default — (b) reuse the existing bounce+fix-dispatch pipeline; no new dispatch pass; broaden the
shared banner rather than fork a second one.** When
`we:scripts/conveyor/parked-pr-conflict-watch.mjs#planConflictLabelChange` computes `newlyDetected: true` (the
exact moment it already detects a fresh conflict, minus the Fork-2 statute-tier exception), post the conflict
as a `review:changes` bounce via `we:scripts/conveyor/reconcile-finding.mjs` — built for exactly this shape
("a mechanical or reconciliation pass... found this PR conflicts with a decision made ELSEWHERE in the repo")
— alongside, or instead of, the existing alert-only label+comment. That relabeling flips
`we:scripts/progress-board.mjs#classifyPr`'s phase from `'conflicted'` to `'bounced'` (the `review:changes`
check runs before the `mergeStateStatus` check), which the EXISTING `we:scripts/conveyor/reconcile-core.mjs`
(`OWED.bounced = 'fix'`) and `we:scripts/conveyor/reconcile-fix-dispatch.mjs` (`dispatchFix`) already pick up
and dispatch against — using the EXISTING we:skills-src/conveyor/fix-agent-brief.md, which already carries
conflict-resolution instructions (step 3) and the escalation exit Fork 3 completes.

**One real mischaracterization risk a skeptic pass found, and the fix that keeps this a true reuse rather than
a second fork.** `we:scripts/conveyor/reconcile-finding.mjs#RECONCILE_FINDING_BANNER` is worded specifically
around a SEQUENCING concern ("conflicts with a decision made ELSEWHERE in the repo... the kind of concern the
normal correctness/security review pass does not check for") — its own motivating incident (`#2412`'s deferred
feature) was a semantic/`blockedBy` conflict, not a raw git `CONFLICTING` state. Posting that exact banner
verbatim atop a real merge-conflict finding would describe the PR's problem slightly wrong to the human/agent
reading it. The fix is a small, one-time wording broadening of the SHARED banner constant itself (naming BOTH
a semantic sequencing conflict and a raw merge conflict against `main`), not a second, forked
`we:conflict-finding.mjs` shim — forking the banner text into two near-identical files would be exactly the
"twin templates for the same job" drift this fork's own rejected alternative below warns against, one file
lower.

**One new authoring task this collapse still owes, distinct from the banner fix:** the finding TEXT
`we:scripts/conveyor/reconcile-finding.mjs --body-file=` posts for a conflict must tell the fix agent plainly
that resolving the conflict IS the whole task this time — no separate reviewer comment exists to read, unlike
an ordinary finding.

Fork 1's resume-preference slots in here as an OPT-IN parameter on `dispatchFix`
(we:scripts/conveyor/reconcile-fix-dispatch.mjs, lines 150-171) / `buildAgentArgv`
(we:scripts/operations/dispatch-lane-io.mjs, lines 895-909) — both currently mint a FRESH `randomUUID()` for
EVERY dispatch, for every bounce cause, with no resume path at all. Defaulting the new parameter OFF for every
existing (non-conflict) caller keeps ordinary review-finding fixes byte-identical to today; only the new
conflict-triggered call site turns it on. This deliberately does NOT extend resume-preference to ordinary
review:changes fixes — whether an ordinary code-review fix should ALSO prefer resuming its original builder is
a real, separate, larger question (it would change behavior for every existing fix-dispatch caller, not just
this item's new trigger) that this item does not need to answer to close its own scope.

**Rejected alternative — (a) a new, parallel dispatch pass** (duplicating
`we:scripts/conveyor/reconcile-fix-dispatch.mjs`'s fill/dispatch primitives, cap-tracking, and escalation
machinery for the conflict case specifically). Rejected: this is exactly the "twin templates for the same job"
drift risk we:scripts/conveyor/review-session-slug.mjs's own file header already warns against, and the class
of mistake `we:scripts/conveyor/reconcile-fix-dispatch.mjs`'s own header names directly ("a second planner for
the same job is the drift this file's phase-borrowing rule exists to prevent") — plus the double-dispatch
hazard named above. It would also re-implement Fork 2's scope predicate and Fork 3's cap/escalation machinery
a second time, for no benefit this research could find. Confidence: **high**.

**Skeptic:** classification (real fork — confirmed: "one pipeline vs. two" is a structural correctness
question). Merit: SURVIVES (the double-dispatch argument is independent of cost, grounded in `#3416`'s own
already-observed failure mode). First pass found a real citation-scope issue (the reused banner's wording
mischaracterizes a raw merge conflict) — SURVIVES-WITH-AMENDMENT, resolved above by broadening the shared
banner rather than forking it. Statute-overlap: checked against `#conveyor-dispatch-calls-the-declared-
operation`'s clause 1 — this fork's default is the direct application of that same one-implementation
principle one layer up ("one thing decides a PR needs a fix agent"); no collision, direct reinforcement.
SURVIVES-WITH-AMENDMENT.
**Screen:** clear (impl-only; the independent screen found this "a correctness property... not just
reuse-for-convenience").

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (blast-radius signal — this decision authorizes work in `we:scripts/conveyor/`,
`we:scripts/operations/dispatch-lane-io.mjs`, and `we:skills-src/conveyor/`, the delivery-machinery surface).
Predicted touch-set (#2619 probe, coarse/prefix-shaped): `we:scripts/conveyor/parked-pr-conflict-watch.mjs`,
`we:scripts/conveyor/reconcile-finding.mjs`, `we:scripts/conveyor/reconcile-core.mjs`,
`we:scripts/conveyor/reconcile-fix-dispatch.mjs`, `we:scripts/operations/dispatch-lane-io.mjs`,
`we:skills-src/conveyor/fix-agent-brief.md`.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

## Notes

(1) This item does not itself change any code — ratifying it authorizes the follow-on build(s), which per
`#3383`'s own build strategy should land as small, individually reviewable pieces (Fork 1's resume-support
with its own probe as one slice, Forks 2-4's pipeline wiring as another), not one large PR.

(2) A dedicated skeptic pass and a separate fresh-context two-confusion screen both ran against this item's
first drafted forks before this version was written. Both surfaced real corrections (Fork 1's routing +
gate strength, Fork 2's statute-content exception, Fork 3's factual error about the brief's auto path, Fork
4's banner mischaracterization) — every one is folded into the text above, not left as a residual caveat.
