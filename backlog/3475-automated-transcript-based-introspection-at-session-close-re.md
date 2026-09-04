---
bornAs: xasi4n5
kind: decision
parent: "2610"
status: resolved
scaffoldedBy: "prepare-decision-2610-introspection"
dateScaffolded: "2026-09-03"
dateOpened: "2026-09-03"
dateStarted: "2026-09-04"
dateResolved: "2026-09-04"
codifiedIn: "docs/agent/platform-decisions.md#automated-session-introspection"
preparedDate: "2026-09-03"
relatedTo: ["2614", "3435", "3383"]
relatedReport: reports/2026-09-03-automated-transcript-introspection-at-close-reap.md
tags: [introspection, learnings, conveyor, privacy, decision-prep]
---

# Automated transcript-based introspection at session close/reap (single-tenant precursor to #2610)

## Ruling (2026-09-04)

**Ratified 2026-09-04** — per the operator's explicit in-conversation instruction to ratify this card ("I
ratify 3475"), delegated to the driving session's own call (epic #3383's own standing kanban-style doctrine);
all three forks accepted as presented, no alternative picked, no amendment beyond what each fork's own
`Skeptic:` pass already folded in. The toggle-location and trigger-per-session-kind questions were already
ruled (not forked) below and are unaffected.

- **Fork 1 (execution mode): detached, as stated** — the judge pass runs fire-and-forget, forced for
  `SessionEnd`'s 1.5s budget and matching the existing best-effort convention elsewhere.
- **Fork 2 (automatic coverage): every terminal session, unconditionally, as stated** — a cheap mechanical
  pre-check may skip a structurally-trivial call as a build-time efficiency, not a coverage exclusion.
- **Fork 3 (output schema and destination): reuse the `#2614` pool with the reinstated `scrubReasons` scrub, as
  stated** — narrows the privacy gap, does not close it; the residual (field-local, 16-char entropy floor) is
  an accepted v1 risk.

Codified: [#automated-session-introspection](/docs/agent/platform-decisions.md#automated-session-introspection).

## Digest

An opt-in mode where every session — background, main, subagent — gets an automated LLM judge pass over its
own real transcript at close/reap, feeding `#2614`'s existing learnings pool instead of relying on
self-report. Grounded in a prior-art survey (`/research/automated-transcript-introspection-at-close-reap/`)
of this repo's three real trigger mechanisms (only one wired today) and `#2610`'s ratified privacy
requirements. Two questions are **ruled, not forked** (toggle location; which mechanism fires per session
kind). Three skeptic-attacked, screened forks remain, each with a **bold default**: (1) execution mode —
**detached/best-effort**, forced for `SessionEnd`'s 1.5s budget; (2) coverage — **every session,
unconditionally**; (3) destination — **`#2614`'s pool**, plus a reinstated privacy scrub and a new
provenance field.

## Recommended path at a glance

| # | Concern | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- | --- |
| — | Toggle location/governance | Ruled (not a fork) — `WE_INTROSPECTION_ENABLED` env var, off by default | — | high |
| — | Trigger mechanism per session kind | Ruled (not a fork) — reaper / `SessionEnd` / `SubagentStop` | One unified poller (never live — see Rejected note) | high |
| Fork 1 | Execution mode | Detached / best-effort, never blocks the caller | Synchronous, blocking | high |
| Fork 2 | Automatic coverage | Every terminal session, unconditionally | Sampled or size/duration-thresholded | med-high |
| Fork 3 | Output destination | Same `#2614` pool/schema + wide append-time scrub + `origin` field | A separate destination/schema | med-high |

## Grounding digest

Full survey in
[`we:reports/2026-09-03-automated-transcript-introspection-at-close-reap.md`](../reports/2026-09-03-automated-transcript-introspection-at-close-reap.md),
research topic [`automated-transcript-introspection-at-close-reap`](/research/automated-transcript-introspection-at-close-reap/).

- **The operator's own words, verbatim (2026-09-03):** "I'd want to be able to activate a mode where,
  something like introspection, where every background session is inspected at close/reap and learning
  about what it did and how it could do better would be collected. Same for main session and subagent at
  close. We would toggle this on now but an eventual product might turn it off, or maybe on for beta users
  let's say."
- **`#2610`** (open epic, this item's `parent`) is the multi-tenant generalization one layer up — filed
  "to shape the seams," with three **HARD, already-ratified** privacy requirements (`we:backlog/2610-*.md:22-27`):
  (1) minimal-by-construction schema — no code/diffs/secrets/paths/repo-identifying strings; (2) a
  deterministic scrub gate at the SEND seam, deny-on-hit; (3) opt-in = a verbatim payload preview. Its own
  opt-in framing (`we:backlog/2610-*.md:10-12`) is specifically about a **tenant/owner** relationship
  ("suggestion telemetry from users' sessions flows to the owner"), which this single-tenant, same-person,
  no-distinct-owner precursor does not literally have — see the toggle ruling below for how this is used
  (as consistent context, not sole authority).
- **`#2614`** (resolved story) built the ONLY existing capture mechanism — `we:scripts/conveyor/learnings-drop.mjs`,
  a pure validator (`validateEntry`, `ALLOWED_KEYS = ['kind','summary','area','suggestion', ...OPTIONAL_HICCUP_KEYS]`,
  per-field `FIELD_CAPS`, `we:scripts/conveyor/learnings-drop.mjs:56-70`) + thin CLI, appending to a
  machine-fixed pool (`poolDir`, a JSONL file under a dot-directory in the operator's home, not part of any
  repo, `we:scripts/conveyor/learnings-drop.mjs:198-213`). It is **self-report**: a session (or
  `closing-session`) decides in the moment what's worth a hand-typed entry. `we:skills-src/closing-session/SKILL.md`
  §1a (lines 123-145) is the only trigger, and it is **manual** — a human has to run `/close`.
- **The append-seam content scrub was REMOVED, not merely narrowed (`#3015`, ratified `#2978` Fork 3)** —
  `we:scripts/conveyor/learnings-drop.mjs:18-26` and `we:scripts/lib/secret-scrub.mjs:1-70` are explicit: the
  wide `scrubReasons` detector (secrets + paths + code + PII + repo names — the exact width `#2610`'s
  tenant-ready schema requires) is still exported and tested but **no longer wired into `validateEntry`**.
  The narrower `scrubPublish` runs only at the later COMMIT seam. The stated reason the append scrub was
  safe to drop: a **human typing a short generalized sentence structurally can't paste a secret** — see
  Fork 3 below; this assumption does not transfer to an automated judge reading a raw transcript, and
  `#2978`'s own removal never contemplated a caller that could put a live secret in the pool at all.
- **`scrubReasons` itself has real, documented blind spots** (`we:scripts/lib/secret-scrub.mjs:112,191-197`,
  read directly, not assumed): it is **field-local** (a secret split across two fields, e.g. half in
  `summary` and half in `suggestion`, is not caught), and its high-entropy-token gate requires
  `length >= 16` — an unlabeled short opaque secret slips through both the entropy check and the
  labeled-credential fallback. Material to Fork 3 below: reinstating this scrub **narrows** the gap
  substantially; it does not close it completely.
- **`#3435`** (resolved task, epic `#3383`) built `we:scripts/conveyor/session-reaper.mjs`, wired into
  `we:skills-src/conveyor/runner.mjs:210` (`§4d`) inside the best-effort `mechanicalPasses` pass
  (`we:skills-src/conveyor/runner.mjs:138`: "a pass failure never stalls a tick"). It is the real,
  already-running trigger point for every **background CLI-dispatched** session (`kind: 'background'` in
  `claude agents --json`) — it reads the live listing, classifies each row `reap`/`keep`, and for `reap`
  rows calls `stopSession` immediately before the process is torn down
  (`we:scripts/conveyor/session-reaper.mjs:364-394`). `#3435`'s own three "Found live" sections establish,
  repeatedly and with reproduced evidence, that these sessions **do not reliably self-terminate cleanly** —
  many need an external `claude stop`, and even a reported-successful stop is "a hint, not a certainty"
  (`we:scripts/conveyor/session-reaper.mjs:75-80`).
- **A materially wrong premise in this item's own originating brief, corrected by checking the real platform
  docs, not assumed:** the brief states subagents have "no existing close-hook at all today." Fetched
  `https://code.claude.com/docs/en/hooks` directly (2026-09-03, re-verified twice) — the harness already
  ships **`SubagentStop`** ("fires in the main session when a subagent finishes," carrying `session_id`,
  `transcript_path`, `agent_id`, `agent_type`) and **`SessionEnd`** ("fires when a session terminates,"
  carrying `session_id`, `transcript_path`, `cwd`). Neither is registered in `we:.claude/settings.json`
  (repo-level), nor in the operator's own personal, machine-local Claude settings file outside any repo —
  confirmed by reading both: only `SessionStart`/`PreToolUse`/`PostToolUse` are wired in either. So the real
  gap is **wiring**, not **building a new hook mechanism**.
- **Verified platform constraint, load-bearing for Fork 1: `SessionEnd` hooks share a 1.5-second total
  timeout budget by default** (raisable via a per-hook `timeout` field, capped at 60 seconds) — confirmed by
  a second, targeted fetch of the same docs page quoting the exact defaults table. A synchronous Sonnet judge
  call cannot complete in 1.5s, so blocking is not merely worse for the `SessionEnd` path, it is close to
  infeasible without raising the budget (itself a cost the detached default avoids). **`SubagentStop` hooks
  that exit with code 2 block the subagent from stopping at all** ("prevents the subagent from stopping") —
  a real footgun for the build item: the invoked script must never exit 2 on an error path, or a failed
  judge dispatch would hang the very subagent it's trying to introspect.
- **The transcript path is real and confirmed live**, exactly as the brief states: a per-session JSONL file
  under a project-hashed directory in the operator's home, outside any repo. File sizes observed range from
  ~490KB to **58MB** for a single session — material to Fork 2 below (a single LLM call cannot ingest a 58MB
  transcript verbatim; some bounding strategy is a forced mechanical necessity, not a fork, and is left to
  the build item).
- **This repo already has a ratified, on-point model/effort-routing doctrine**
  (`we:docs/agent/backlog-workflow.md:597-604,622-654`, `#1855`/`#3106`): route a spawn's model tier and
  effort to the *shape* of the work, never default-cheap or default-expensive. A bounded extraction task
  whose output feeds a **later, more careful** adjudication step (exactly `/harvest`'s relationship to the
  self-report pool today) is Sonnet-rung, `low`/`medium`-effort territory — not Haiku (the transcript-reading
  task is not a "does X exist" one-liner) and not Opus (it writes no ruling into the backlog graph;
  `/harvest` still owns that call). **This is a mechanical application of an already-ratified doctrine, not
  a live choice** — a fresh-context screen on the original draft flagged bundling it into the coverage fork
  as an implementation detail mis-layered as a decider-facing call; pulled out below.
- **A concrete, already-ratified rubric requirement for the judge pass, folded in after this item's own
  prepare session was itself found to have skipped exactly this check once, live, and the operator directed
  the future mechanism not repeat the gap.** Two same-night precedents this repo just landed (PR #1888:
  `we:agent-memory-src/act-as-if-a-ui-were-the-one-filing-changing-items.md`; PR #1889: an update to
  `we:skills-src/closing-session/SKILL.md` §1) both name the identical pattern: a session running a **raw,
  hand-rolled command in place of a declared operation** (`we:scripts/operations/*.mjs`, reachable via
  `we:run.mjs <operation>`) that should have existed for that action. The memory leaf's own test — **"would
  a UI button be able to do this?"** — and `closing-session`'s own now-updated bullet — emit as `kind:
  missing-convention` (or `friction`), `summary` naming what was hand-rolled and why no operation covered
  it, `suggestion` naming `#3029` (Operation engine) as the likely home — are the exact shape the automated
  judge's own rubric must mirror, not redesign from scratch. See Fork 3 and Done-when below for where this
  becomes a concrete requirement rather than left-open prompt detail.

## Not a fork: where the toggle lives (governed by an existing statute + a genuine data-egress concern)

Per-fork classification pass Q4 ("fixed mechanic or configurable dimension? … a dimension is *not* a fork —
pull it out of the `## Fork N` sections entirely"): an on/off toggle is a **config dimension**, governed by
the already-ratified
[`#config-extends-platform-default`](/docs/agent/platform-decisions.md#config-extends-platform-default)
statute (`we:docs/agent/platform-decisions.md:1633-1656`) — core stays default-less, the shipped platform
default is one flavor, a project/operator config *extends* it. There is nothing here for a decider to
ratify; recorded as **ruled**, not proposed:

- **The flavor is OFF, not the statute's usual "most-permissive."** `#config-extends-platform-default`'s
  general rule picks the most-permissive/native-first value as the platform default; that generic rule does
  not, on its own, argue for OFF here. **The real, independent ground (folded in after a skeptic pass
  found the original citation over-reached): this capability performs automated data egress by
  construction** — an unattended process reading a full session transcript (which can carry real code, file
  paths, and anything a session happened to touch) and sending it to a fresh LLM call, with no human in the
  loop deciding *at that moment* that this specific content should go out. That is a materially different
  risk class from the ordinary work a session already does (a human-directed turn sending task-relevant
  content the human is actively looking at) and is sufficient on its own to default OFF, independent of any
  other item. **`#2610`/`#539`'s own opt-in-for-telemetry lineage is cited as consistent, supporting
  context** — this item is explicitly `#2610`'s single-tenant precursor and an off-by-default posture here
  is what lets that lineage generalize cleanly — but it is not stretched to serve as the *sole* authority for
  a case (single machine, single person, no distinct owner) its own text does not literally describe.
- **Mechanism: one boolean, read by whatever each trigger's own script invokes — never by conditionally
  registering/deregistering a harness hook.** Claude Code hook registrations are static, read once from
  `we:.claude/settings.json` at session start (confirmed live: neither repo's settings file today declares
  `SubagentStop`/`SessionEnd` at all) — a running session cannot flip its own hook wiring mid-session, so
  gating "is introspection on" *at the hook-registration layer* would require restarting every open session
  on every toggle flip. The cheap, precedented alternative: wire the `SubagentStop`/`SessionEnd` hook entries
  **once, permanently** (they are cheap no-ops when off), and gate the actual judge-pass work **inside** the
  invoked script with one boolean read, checked first. This repo already has an abundant, working precedent
  for exactly this shape — script-level env-var toggles read fresh on every invocation, no session restart
  needed: `WE_DISPATCH_AGENT_ARGS`, `WE_BACKLOG_DIR`, `LEARNINGS_POOL`/`LEARNINGS_SESSION`,
  `WE_LAND_UNVERIFIED` (`we:scripts/conveyor/learnings-drop.mjs:211`, `we:scripts/conveyor/session-reaper.mjs:217`,
  and others). **Ruled: one new env var, `WE_INTROSPECTION_ENABLED`, unset (falsy) by default, read first by
  every trigger's invoked script** (the reaper's own tick, the `SubagentStop`/`SessionEnd` hook command) —
  short-circuits to a no-op with zero cost when unset. No new file, no new settings key, no session-restart
  dependency, one flip point for all three trigger kinds.

**Skeptic:** SURVIVES-WITH-AMENDMENT — a dedicated skeptic sub-agent found the original citation
(`#2610`/`#539`'s opt-in requirement, alone, superseding `#config-extends-platform-default`) over-reached:
that lineage's own opt-in framing is about a tenant/owner relationship this single-tenant item doesn't
literally have, a citation-scope stretch. The skeptic identified a sounder, independent ground (automated
data egress to an LLM API with no human in the loop at send-time) that reaches the OFF default directly
without needing to stretch `#2610`. Folded in above; `#2610`/`#539` is now cited as consistent supporting
context, not sole authority.
**Screen:** clear — a separate fresh-context reviewer confirmed both halves of this ruling (the OFF default,
the env-var mechanism) are genuinely forced by real facts (the ratified opt-in lineage / the data-egress
concern; Claude Code's static hook-registration model), not a live rival branch dressed as settled.

## Ruled (not a fork): trigger mechanism per session kind

**Why this is not a fork, corrected after a skeptic pass:** an earlier draft framed this as
`## Fork 1` with a top-level "fork-existence" justification. A skeptic sub-agent caught that the item's own
"Rejected" paragraph already admitted the only named alternative (one unified poller) "was considered and
dropped before being written up as a real option" — i.e. never a live rival. And every one of the three
per-kind sub-decisions below is *itself* already written as "Ruled," not as a pick between named options
with a bold default. By this item's own standing test (name the excluded/flawed branch or admit there's no
decision), there is no live either/or anywhere in this section — it belongs with the toggle above, not
numbered as a fork.

A background CLI session, the main interactive session, and an Agent-tool subagent are three architecturally
separate surfaces with three separate close/finish signals in this codebase today (confirmed in the
Grounding digest: no single mechanism reaches all three), so each needs its own trigger to get coverage at
all — support-both is forced, not chosen.

- **Background CLI session → the `#3435` reaper, `we:scripts/conveyor/session-reaper.mjs`.** Excluded
  branch: relying on that session's own `SessionEnd` hook firing inside its own process. `#3435`'s own
  repeated, reproduced findings (`we:scripts/conveyor/session-reaper.mjs:21-102`) establish that these
  sessions frequently do **not** exit cleanly — many require an external `claude stop`, and even a
  successful-looking stop is not proof of exit. Whether `SessionEnd` reliably fires when a background
  process is torn down from *outside* itself (an external stop, a hard kill after a stuck dialog) is
  undocumented by the platform and unverified here — exactly the failure shape most likely to be the session
  worth learning from. An external, reaper-time transcript read is robust to *how* the session ended; an
  internal self-hook is not. **Insertion point:** immediately before `stopSession(...)` in the reap loop
  (`we:scripts/conveyor/session-reaper.mjs:381-386`) — the transcript file is complete and the session's own
  target (`sessionTarget`, `we:scripts/conveyor/session-reaper.mjs:159-166`) is already resolved there.
- **Main/interactive session → wire the platform's own `SessionEnd` hook, additive to `closing-session`'s
  existing manual path, not a replacement of it.** Excluded branch: relying solely on a human remembering to
  run `/close` — that cannot deliver "every … session" (the operator's own stated bar); a session that is
  simply closed without an explicit `/close` gets zero coverage today. Wiring `SessionEnd` is the only
  mechanism that reaches that case. Keeping `we:skills-src/closing-session/SKILL.md`'s own §1a manual
  self-report emission unchanged costs nothing and captures a different signal (a session's own aware
  self-report vs. a cold external read) — per Fork 3 below, these are not redundant.
- **Agent-tool subagent → wire the platform's own `SubagentStop` hook.** Excluded branch: treating this as
  "no mechanism exists, build one" (the brief's own premise) — false, per the Grounding digest. Fires in the
  **parent** session, carrying `agent_id`/`agent_type`/`transcript_path` for the finished subagent directly.
  In-scope for this decision, not a separate item: the marginal work is one `we:.claude/settings.json` hook
  entry plus the same invoked script every other trigger uses.

**Skeptic:** SURVIVES — the per-kind mechanism choices were independently re-verified (reaper insertion
point, hook existence and payload fields) and hold. The section's *framing* was the defect, corrected above
by demoting it out of the numbered forks.
**Screen:** clear (post-correction) — each per-kind call carries a cost-independent merit reason (reliability
for the reaper, coverage-completeness for `SessionEnd`, correcting a false "doesn't exist" premise for
`SubagentStop`), externally observable as whether a given session kind is ever actually inspected.

## Fork 1 — execution mode: does the judge pass block the trigger point, or run detached?

**Fork-existence:** a genuine either/or for the reaper path (a plain script with no harness-imposed budget);
**forced outright, not merely preferred, for the `SessionEnd` hook path** specifically — see the verified
1.5-second timeout budget in the Grounding digest. The two branches cannot both be the default behavior at
once for the same call site, and each has a real, opposite failure mode (a hang/timeout vs. a lost result).

- **(a) Synchronous — the reaper/hook blocks until the judge call returns, then proceeds.** Guarantees the
  entry is captured (or the failure is visible) before the trigger point moves on. **Rejected as the
  default:** infeasible outright for `SessionEnd` (a Sonnet call cannot complete inside a 1.5s default
  budget, and raising it to the 60s max is itself a cost this fork exists to avoid); for the reaper and
  `SubagentStop` paths it directly contradicts `we:skills-src/conveyor/runner.mjs:138`'s own stated design
  ("a pass failure never stalls a tick") and risks the exact class of stuck-session problem `#3435` was
  filed to fix, now caused by the fix's own sibling feature. A `SubagentStop` hook blocking the **parent**
  session on an LLM call is worse: it adds visible latency to the human's own turn every time a subagent
  finishes — and **a `SubagentStop` hook that exits with code 2 blocks the subagent from stopping at all**
  (verified from the platform docs), so a synchronous design that fails badly could hang the very subagent
  it is trying to introspect.
- **(b) Detached / fire-and-forget — the trigger point spawns the judge pass as an independent process and
  moves on immediately**, mirroring `we:scripts/conveyor/session-reaper.mjs`'s own already-established
  best-effort convention (a per-candidate `try/catch` that logs and continues, never blocks the pass;
  `we:scripts/conveyor/session-reaper.mjs:387-393`) and `mechanicalPasses`'s own pass-level
  `try { … } catch { /* best-effort */ }` (`we:skills-src/conveyor/runner.mjs:138`).

**Bold default: (b), uniformly across all three trigger kinds** — forced for `SessionEnd`, and matching an
existing, already-proven convention for the other two rather than inventing a second execution model to
maintain. A lost introspection entry (the judge process dies before appending) is a strictly lower-stakes
failure than a stalled dispatch tick, a slowed-down human turn, or a hung subagent — introspection is
explicitly a *nice-to-have improvement channel*, never a blocking dependency of the thing it observes. **The
build item must confirm true OS-level detachment** — the spawned child process must survive the parent hook
process's own exit at its timeout boundary, not merely be asynchronous within the same process — the sketch
below names this but does not itself prove it; and the invoked script's own top-level error handling must
never surface as `SubagentStop`'s exit code 2, given the hang risk just above.

```js
// Fork 1(b) — sketch of the non-blocking dispatch shape, mirroring session-reaper.mjs's own
// try/catch-and-continue convention. MUST exit 0 (or a non-2 code the hook contract treats as advisory)
// on every path — a SubagentStop hook that exits 2 blocks the subagent from stopping (verified platform
// behavior). True OS-level detachment (surviving the parent's own exit) is left to the build item to prove.
function onSessionTerminal({ transcriptPath, sessionMeta }) {
  if (!process.env.WE_INTROSPECTION_ENABLED) return; // the one flip point, see the toggle ruling above
  try {
    spawnDetached('scripts/conveyor/introspect-session.mjs', [transcriptPath, JSON.stringify(sessionMeta)]);
  } catch { /* best-effort — never blocks or fails the caller, matching session-reaper.mjs's own convention */ }
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT — the default was already right; the skeptic surfaced the concrete 1.5s
`SessionEnd` budget (making detached forced there, not just preferred) and the exit-code-2 hang risk for
`SubagentStop`, both folded in above, plus the true-detachment requirement added to close a real gap in the
original code sketch (it asserted `spawnDetached` without establishing it survives a parent kill).
**Screen:** clear — a fresh-context reviewer confirmed this is externally observable (a person feels the
latency, or the tick stalls) and merit-real even under the free-to-build test (the tradeoff is about the
shipped behavior's coupling to the core pipeline, not how cheap either branch was to write).

## Fork 2 — automatic coverage: does every terminal session get checked?

*(Model/effort tier is not part of this fork — see the ruled note below; a fresh-context screen flagged
bundling it in as an implementation detail mis-layered onto a decider-facing question.)*

**Fork-existence:** a genuine either/or on the merits, not prioritization in disguise — per the
*not-a-prioritization* rule, whether a session gets checked **at all** is an observable coverage difference
(a real gap the operator would notice — "why didn't it learn from that session"), not a pure cost knob.
Options, not exhaustive:

- **(a) Every terminal session, unconditionally.** Simplest, matches "every … session" literally.
- **(b) Sampled — only a random fraction of terminal sessions get a judge pass.** Rejected: directly
  contradicts the operator's own explicit words ("every background session is inspected"). A silently
  dropped session is not a cost optimization the operator asked for; it is a coverage regression they
  would notice and did not request.
- **(c) Size/duration-thresholded — skip sessions below some transcript-size or wall-clock floor.** Real
  candidate; rejected as the **decision-level default** (though very plausibly the right *build-time*
  micro-optimization — see below) via the free-to-build test: if the judge pass ran on the cheapest viable
  model rung, the marginal cost of also running it on a tiny transcript is already near the floor — so a
  threshold's only real justification is cost, not a separate merit fork.
- **(d) On-request only — a human or `/harvest` explicitly asks for introspection on one named session,
  never automatic.** Rejected: defeats the actual point of the feature (`#2614`'s own rationale for the
  *existing* self-report drop-box already established that distributed, cheap, in-the-moment capture beats
  relying on someone remembering to ask later — the same argument applies here, doubled, since nobody but the
  session itself even knows what happened inside it).

**A second, distinct cost driver a skeptic pass surfaced — subagent fan-out, not just transcript size.** A
single main or background session can spawn dozens of Agent-tool subagents (quick `Explore` lookups, small
verifications) in its own lifetime. Each is a separate `SubagentStop` firing, each a separate judge call —
the real steady-state cost multiplier is **call count**, not any one transcript's byte size. This does not
change the ruling (per-call cost is already bounded by the Sonnet/`low`-effort rung, and the operator's own
"every … session" bar covers subagents explicitly), but it sharpens what the sanctioned build-time
micro-optimization should key off.

**Bold default: (a) — every terminal session, unconditionally.** Honors the operator's own explicit coverage
bar. **A build-time micro-optimization is explicitly sanctioned, not ruled out:** the build item may add a
cheap, mechanical (non-LLM) pre-check that short-circuits a structurally-trivial judge call — keyed off
**turn/message count, not only transcript byte size** (a subagent that made one tool call and returned has
nothing to introspect regardless of how verbose that one call's output was) — that is an implementation
efficiency inside "always run," not a coverage exclusion, and does not need to come back to this decision.

**Ruled, not part of this fork's ratify-ask — model/effort tier.** Per this repo's own already-ratified
model-routing (`#1855`) and effort-routing (`#3106`) doctrine (`we:docs/agent/backlog-workflow.md:597-654`):
the job is a bounded extraction task whose output feeds a **later, more careful** adjudication (`/harvest`)
— Sonnet rung, `low` effort. Not Haiku (not a one-line pointer-check), not Opus (writes no ruling into the
backlog graph). This is a mechanical application of standing doctrine, not a live choice for this item's
decider.

**A forced constraint, not a fork — noted so the build item does not have to re-discover it:** transcripts
observed up to 58MB (see Grounding digest) exceed any single LLM call's practical context window by a wide
margin. Some bounding strategy (tail-N-messages, rolling summarization, or similar) is a mechanical necessity
for large sessions regardless of which option above is chosen — there is no coherent "read the whole
transcript in one shot" branch to weigh, so this is not a fork. Left entirely to the build item.

**Skeptic:** SURVIVES-WITH-AMENDMENT — the coverage default survives; the skeptic's fan-out finding (call
count, not just transcript size, is the real steady-state cost driver) is folded into the sanctioned
micro-optimization's own criterion above.
**Screen:** flagged(impl) → fixed — a fresh-context reviewer caught the model/effort-tier sub-clause bundled
into this fork's ratify-or-override framing when it is actually a mechanical application of already-ratified
doctrine; pulled out into its own "Ruled" note above, leaving only the genuine coverage question (a)-(d) as
the live fork.

## Fork 3 — output schema and destination, and the privacy gate an automated judge needs that a self-report didn't

**Fork-existence:** a genuine either/or — reusing `#2614`'s existing pool/schema and minting a new one are
mutually exclusive as the *primary* destination (an entry lives in exactly one place), and `#2610`'s ratified
privacy requirements bind on whichever is chosen, so the choice is load-bearing, not cosmetic.

- **(a) Reuse the exact same `we:scripts/conveyor/learnings-drop.mjs` schema, pool, and `appendEntry` path,
  byte-for-byte, with no changes.** Simplest, reuses everything `#2614` and `/harvest` already do (dedup,
  routing, the whole downstream pipeline). **Real risk, not hypothetical:** `#3015`'s own removal of the
  append-time content scrub was justified *specifically* on the grounds that a human typing a short
  generalized sentence structurally cannot paste a secret/path/code block
  (`we:scripts/conveyor/learnings-drop.mjs:18-26`). An LLM judge reading a **raw transcript that legitimately
  contains real code, real file paths, and potentially real secrets** and then paraphrasing or quoting from
  it into `summary`/`suggestion` does not carry that structural guarantee — the one property that let `#3015`
  safely narrow the gate does not hold for this caller, and `#2978`'s own removal never contemplated a
  caller that could put a live secret in the pool at all. Taking (a) with no further change would silently
  reopen a real leak class for exactly the caller most likely to trigger it.
- **(b) Reuse the same pool/schema, but add back the wide append-time scrub specifically for judge-authored
  entries, plus one new optional provenance field.** The wide detector already exists, is already tested, and
  is already exported for exactly this reason — `scrubReasons` (`we:scripts/lib/secret-scrub.mjs:14-18`,
  "the TENANT-READY-BY-CONSTRUCTION requirement of the drop-box schema (#2610)") was kept alive specifically
  because `#2610` needs its full width somewhere; it was only *unwired from the human path* because the human
  path didn't need it. The automated path does. Denying an entry on a `scrubReasons` hit (deny-on-hit,
  never silently redact) is also the literal mechanism `#2610`'s own second HARD requirement names ("the
  write-time gate hook precedent — PreToolUse deny-the-write pattern"), already precedented in this exact
  repo (`we:scripts/guard-lane.mjs`, `we:scripts/check-memory.mjs --pre`, `we:scripts/backlog-guard.mjs
  --pre`). **This narrows the gap substantially — it is not a complete guarantee**: `scrubReasons` is
  field-local (a secret split across `summary`/`area`/`suggestion` is not caught) and its high-entropy check
  requires `length >= 16`, so an unlabeled short opaque secret can still slip through
  (`we:scripts/lib/secret-scrub.mjs:112,191-197`). The new field — `origin: 'self-report' |
  'auto-introspection'`, optional, additive — follows the exact precedent `#3421`'s `OPTIONAL_HICCUP_KEYS`
  already set for growing this schema (`we:scripts/conveyor/learnings-drop.mjs:60-65`: an optional field
  with its own validation branch, byte-identical shape for every caller that omits it). It lets `/harvest`
  weight or spot-check the two signal shapes differently later, without forcing that call now.
- **(c) A wholly separate destination/schema for automated entries.** Real candidate, rejected as the
  default on a composability ground, not a cost one: a second destination gives `/harvest` two disjoint
  pools to dedup against instead of one, which is a correctness risk (a real duplicate can survive
  undetected across a pool boundary the dedup pass never crosses), for a distinction — provenance — that
  (b)'s one optional field already captures within the single pool `/harvest` already iterates.
  `#2610`'s own "same pipeline shape" framing (`we:backlog/2610-*.md:14-16`, "capture → dedup → red-team →
  … the multi-tenant generalization of the single-tenant drop-box sweep") argues for one pipeline the
  multi-tenant version can later generalize wholesale, not two to reconcile.

**Bold default: (b).** Reuses the existing schema, pool, and downstream pipeline (minimal new surface,
directly serves `#2610`'s own stated "shape the seams" purpose for this exact epic lineage); substantially
narrows the real privacy gap (a) would silently reopen, by reusing an existing, already-tested,
already-exported detector rather than inventing a new one — stated honestly as a narrowing, not a closure,
given `scrubReasons`'s own documented blind spots; and adds the one field a future multi-tenant
differentiation (`#2610`'s owner-review screen) will very plausibly want, at near-zero cost now. **Left to
the build item, not this decision:** whether the residual gap (short/split secrets) needs a further,
dedicated mitigation before this ships, or is an accepted residual risk consistent with what the
publish-seam `scrubPublish` already accepts elsewhere in this repo.

**Settled, not left open: the judge's rubric must also target the SAME `kind` values this schema already
carries for the raw-command/missing-operation pattern.** Since destination (b) reuses `#2614`'s existing
`kind` enum verbatim, the judge prompt naturally emits `kind: missing-convention` (or `friction`) for a
hand-rolled command that stood in for a missing declared operation — mirroring
`we:agent-memory-src/act-as-if-a-ui-were-the-one-filing-changing-items.md`'s "would a UI button be able to
do this?" test and `closing-session`'s own now-updated §1 bullet, not a new destination-shaped question.
See the Grounding digest and Done-when for why this is a settled requirement, not open prompt detail.

```js
// Fork 3(b) — the automated caller scrubs BEFORE calling the existing appendEntry, denying on any hit
// (never silently redacting — matches #2610's own deny-on-hit requirement and this repo's PreToolUse
// deny-the-write precedent). The only change inside learnings-drop.mjs itself is adding 'origin' to
// ALLOWED_KEYS as a new OPTIONAL key, mirroring the #3421 OPTIONAL_HICCUP_KEYS precedent exactly — an
// entry that omits it (every existing caller) stays byte-identical to today. scrubReasons narrows the
// leak surface; it is not a complete guarantee (see the field-local / length>=16 gaps noted above).
import { scrubReasons } from '../lib/secret-scrub.mjs';
import { appendEntry } from './learnings-drop.mjs';

function emitJudgeFinding(entry, { session }) {
  const reasons = [entry.summary, entry.area, entry.suggestion].flatMap(scrubReasons);
  if (reasons.length) {
    // Deny-on-hit — #2610's second HARD requirement. Logged for the build item's own observability story;
    // never appended, never silently trimmed.
    throw new Error(`introspection finding rejected — ${reasons.join('; ')}`);
  }
  return appendEntry({ ...entry, origin: 'auto-introspection' }, { session });
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT — the default survives; the skeptic's direct read of
`we:scripts/lib/secret-scrub.mjs` found `scrubReasons`'s own documented blind spots (field-local, `>=16`
char floor) and the write-up's original "closes the real privacy gap" language was corrected to "narrows,
substantially, not completely" throughout, with the residual risk named explicitly rather than implied away.
**Screen:** clear — a fresh-context reviewer called this a "textbook genuine merit fork": privacy/security
and pipeline-composability differences hold independent of build cost, the sanctioned merit categories.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (touches `we:.claude/settings.json` hook wiring, the `#3435` reaper, and the
`closing-session`/`learnings-drop`/`secret-scrub` privacy pipeline — system machinery adjacent to a shared
gate, not a routine change). This jury binds against the item's predicted scope and is re-checked against
the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## What this decision does not settle

Left to the follow-on build item(s), scaffolded under this card once it resolves (mirroring the
`#3457` → `#3460` precedent):

- The exact judge prompt/output-shaping instructions, and the transcript bounding/chunking strategy for a
  session whose transcript exceeds a practical single-call context window (see Fork 2's forced-constraint
  note). **One piece of that rubric is NOT left open, though — see the settled requirement in the Grounding
  digest and Fork 3's default below: the judge must scan for the raw-command/missing-operation pattern
  `we:agent-memory-src/act-as-if-a-ui-were-the-one-filing-changing-items.md` and `closing-session`'s own §1
  already name, emitting `kind: missing-convention` pointing at `#3029` when found.** The rest of the
  prompt's shape (tone, examples, chunking) is still build-item detail.
- The exact `WE_INTROSPECTION_ENABLED` read helper's shape and where it lives (a tiny shared module vs. one
  read per call site), and proving true OS-level detachment for Fork 1(b)'s spawn.
- De-duplication between `closing-session`'s own unchanged manual §1a emission and the new automatic
  `SessionEnd`-triggered emission for the **same** session, if a human runs `/close` on a session that also
  gets the automatic pass — both are sanctioned to coexist per the trigger-mechanism ruling, but whether
  `/harvest`'s dedup already handles the resulting near-duplicate pair or needs a small assist is
  implementation.
- Whether `/harvest`'s own dedup/red-team logic should weight or spot-check `origin: auto-introspection`
  entries differently from self-reports — Fork 3 adds the field so this call can be made later; it is not
  made here.
- Whether `scrubReasons`'s residual gaps (short/split secrets) need a dedicated further mitigation before
  this ships, or are an accepted residual risk — flagged explicitly in Fork 3, not resolved there.
- Observability/logging for a denied (scrubbed) automated entry, and for a detached judge process that
  fails outright — best-effort per Fork 1, but *how* a failure is surfaced (a log line, a counter, nothing)
  is implementation. The invoked script must never exit `SubagentStop`'s code 2 on any path (see Fork 1).
- Verifying live whether `SessionEnd` actually fires for a `--bg`-mode background session torn down via an
  external `claude stop` (flagged as undocumented in Grounding digest) — recommended as an early smoke test
  in the build item, though the trigger-mechanism ruling does not depend on the answer (the reaper stays the
  background trigger either way).

## Done when

1. A ruling is recorded on each of Fork 1 through Fork 3 above (ratify or override the defaults) — the
   toggle and trigger-mechanism questions are already ruled, not open.
2. A follow-on build item is scaffolded under this card, naming: the `WE_INTROSPECTION_ENABLED` read
   helper, the three trigger wire-ups (reaper insertion point, `SessionEnd` hook entry, `SubagentStop` hook
   entry — with the exit-code-2 and true-detachment constraints from Fork 1), the judge-pass script and its
   prompt/chunking shape, and the `origin`-field schema addition to `we:scripts/conveyor/learnings-drop.mjs`.
3. **The scaffolded build item's own Done-when must require the judge's rubric to include the
   raw-command/missing-operation scan** — mirroring, not redesigning,
   `we:agent-memory-src/act-as-if-a-ui-were-the-one-filing-changing-items.md`'s "would a UI button be able
   to do this?" test and `closing-session`'s own §1 bullet (PR #1889): flag a hand-rolled command that stood
   in for a missing `we:scripts/operations/*.mjs` operation, emitted as `kind: missing-convention` (or
   `friction`) naming `#3029` as the likely home. This is carried forward from this same prepare pass's own
   introspection gap (found live, folded in per the operator's direction, not re-run) — a follow-on build
   that ships without this specific check does not satisfy this card's own ruling.
4. This card `resolve`s once every fork is ruled — building the follow-on item is separate work tracked on
   its own card, not a precondition of this card's own resolution (matching `#3457`'s convention).
