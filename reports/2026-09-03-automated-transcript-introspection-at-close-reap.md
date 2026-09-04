# Automated transcript-based introspection at session close/reap — prepare-session report

**Session:** `prepare-decision-2610-introspection`, 2026-09-03. **Item prepared:** "Automated
transcript-based introspection at session close/reap" — a not-yet-landed, hash-keyed `kind: decision` item
at prepare time (`parent: "2610"`, `relatedTo: ["2614", "3435", "3383"]`); see its own `relatedReport` link
back to this file for its identity once landed with a real number.

## Brief

The operator, verbatim, 2026-09-03: "I'd want to be able to activate a mode where, something like
introspection, where every background session is inspected at close/reap and learning about what it did and
how it could do better would be collected. Same for main session and subagent at close. We would toggle this
on now but an eventual product might turn it off, or maybe on for beta users let's say."

The originating brief framed this as the single-tenant precursor to `we:backlog/2610-*.md` (an open epic
already anticipating a multi-tenant "opt-in suggestion telemetry → owner review" channel), asked for it to be
grounded in `we:backlog/2614-*.md`'s existing self-report drop-box and `we:backlog/3435-*.md`'s reaper, and
flagged four candidate design forks: toggle location/governance, trigger mechanism per session kind, cost/
model/coverage scale, and output schema/destination.

## What the survey found that the brief did not already state

1. **The brief's claim that subagents have "no existing close-hook at all today" is wrong.** Two direct
   fetches of `https://code.claude.com/docs/en/hooks` (2026-09-03) confirm the harness already ships
   `SubagentStop` (fires in the parent session when an Agent-tool subagent finishes, carrying `session_id`,
   `transcript_path`, `agent_id`, `agent_type`) and `SessionEnd` (fires when any session terminates, carrying
   `session_id`, `transcript_path`, `cwd`). Neither is registered in `we:.claude/settings.json` (repo-level)
   or the operator's own global settings file — confirmed by reading both directly. So the real subagent gap
   is wiring an existing, unused hook, not building new harness machinery — a materially cheaper scope than
   the brief assumed, and directly resolves the brief's own open question about whether subagent support is
   in-scope for this item (yes).
2. **A concrete, load-bearing platform constraint the brief never mentioned: `SessionEnd` hooks share a
   1.5-second total timeout budget by default** (raisable via a per-hook `timeout` field, capped at 60
   seconds) — a second, independently targeted fetch of the same docs page quoting the exact defaults table
   confirmed this. This makes "run the judge pass synchronously" close to infeasible for the main-session
   trigger specifically, not merely a style preference — it materially strengthens Fork 1 (execution mode)'s
   default. Also found: a `SubagentStop` hook that exits with code 2 **blocks the subagent from stopping at
   all** — a real footgun for the eventual build item (the invoked script must never surface that exit code
   on an error path, or a failed judge dispatch would hang the very subagent it is trying to introspect).
3. **`#3435`'s reaper (`we:scripts/conveyor/session-reaper.mjs`) is a real, already-shipped, already-wired
   mechanism** — read directly, not assumed from its backlog card. Its own extensively-documented "Found
   live" findings (background sessions frequently failing to self-terminate cleanly; a reported-successful
   `claude stop` not being proof of exit) independently justify preferring an *external*, reaper-time
   transcript read over relying on that same session's own internal `SessionEnd` hook — the two are not
   equally reliable, and the less reliable one is exactly the shape most likely to be the session worth
   learning from (stuck/killed sessions are disproportionately likely to carry real friction).
4. **`#2614`'s capture mechanism (`we:scripts/conveyor/learnings-drop.mjs`) has a real, structural privacy
   gap for THIS caller specifically, invisible if you only read the card and not the code.** `#3015` (ratified
   `#2978` Fork 3) removed the append-time content scrub, justified explicitly on the grounds that a human
   typing a short generalized sentence structurally cannot paste a secret. An LLM judge reading a raw
   transcript that legitimately contains real code/paths/secrets and paraphrasing from it into the same
   fields does not carry that structural guarantee — the assumption that let `#3015` narrow the gate does not
   transfer. The wide `scrubReasons` detector (`we:scripts/lib/secret-scrub.mjs`) is still exported and
   tested, kept alive specifically because `#2610`'s tenant-ready schema needs its full width somewhere — it
   was only unwired from the human path. Re-wiring it for the automated path closes this specific hole,
   though a skeptic pass (below) found it only narrows, not fully closes, the residual risk.
5. **This repo already has a ratified model/effort-routing doctrine (`#1855`/`#3106`,
   `we:docs/agent/backlog-workflow.md:597-654`) directly on point** for the brief's own cost/model fork: a
   bounded extraction task feeding a later, more careful adjudication step (`/harvest`, exactly analogous to
   how it already treats the self-report pool) routes to the Sonnet model rung at `low` effort — not a live
   choice for this item's decider, a mechanical application of standing doctrine.
6. **The transcript path the brief asserted is real and was verified live**, not merely trusted: a
   per-session JSONL file under a project-hashed directory in the operator's home, outside any repo, with
   observed sizes from ~490KB to 58MB — the upper end material to the build item's transcript-bounding
   strategy, since no single LLM call can ingest a 58MB transcript verbatim.

## Skeptic and fresh-context screen passes (run before `preparedDate` was stamped)

Two independent sub-agents were dispatched — a skeptic (prompted only to refute, attacking classification,
merit, statute-overlap, and citation-scope on every fork/ruling) and a fresh-context two-confusion screen
(blind to this session's authoring, checking standard-vs-implementation and merit-vs-prioritization framing
on every fork). Both returned substantive, non-rubber-stamp findings, all folded into the item before
stamping:

- **The skeptic's citation-scope check caught a real over-reach**: the original toggle ruling cited
  `#2610`/`#539`'s opt-in requirement as the *sole* authority for defaulting off, but that lineage's own
  opt-in framing is about a tenant/owner relationship this single-tenant item does not literally have. The
  skeptic supplied a sounder, independent ground (automated data egress to an LLM API with no human in the
  loop at send-time) that reaches the same OFF default without stretching `#2610`'s scope — the item now
  cites that as primary, with `#2610`/`#539` downgraded to consistent supporting context.
- **The skeptic's own re-derivation of the "trigger mechanism per kind" section found it was never actually
  a fork** — the item's own "Rejected" paragraph already admitted the only named alternative (a unified
  poller) was dropped before being written up as live, and every per-kind sub-decision was already phrased
  as "Ruled," not a pick. Demoted from a numbered fork to a "Ruled (not a fork)" section, renumbering the
  three remaining genuine forks to 1–3.
- **The skeptic verified the 1.5s `SessionEnd` budget and the `SubagentStop` exit-code-2 hang risk
  independently** (this session then re-verified both a third time via its own targeted fetch before writing
  them into the item as fact, per this repo's own *verify before you claim* discipline) — folded into what
  is now Fork 1 (execution mode), strengthening rather than changing its default.
- **The skeptic read `we:scripts/lib/secret-scrub.mjs` directly** and found `scrubReasons` has real,
  documented blind spots (field-local scanning, a 16-character floor on the entropy check) — the item's
  language was corrected from "closes the real privacy gap" to "narrows, substantially, not completely,"
  with the residual risk named explicitly as a build-item concern rather than implied away.
- **The skeptic surfaced subagent fan-out** (a session spawning dozens of subagents means dozens of separate
  judge calls) as the real steady-state cost driver, distinct from any one transcript's byte size — folded
  into the sanctioned build-time micro-optimization's own criterion (key off turn/message count, not just
  bytes).
- **The fresh-context screen flagged one impl-vs-standard confusion**: the model/effort-tier sub-clause was
  originally bundled into the coverage fork's ratify-or-override framing, when it is actually a mechanical
  application of already-ratified doctrine (#1855/#3106). Pulled out into its own short "Ruled" note, leaving
  only the genuine coverage question (unconditional vs. sampled/thresholded/on-request) as the live fork.
- **The fresh-context screen cleared every other section** (the toggle ruling, the trigger-mechanism ruling,
  execution mode, and output schema/privacy) as genuinely merit-real and externally observable, not
  prioritization or implementation detail in disguise.

## Addendum (2026-09-04) — one more requirement folded in per the operator's own direction

After the item was first prepared and while its PR was in flight, the operator directed (via the
coordinator, verbatim): "make sure the next pass checks for that [missing operations], but do not run it
again" — referring to this exact prepare session's own gap: it had not, until told, checked whether it
itself ran any raw/hand-rolled command in place of a declared operation, the pattern
`we:agent-memory-src/act-as-if-a-ui-were-the-one-filing-changing-items.md` (PR #1888) and `closing-session`'s
own updated §1 bullet (PR #1889) — both landed the same night, after this survey's own initial pass — now
name explicitly. Rather than re-run introspection on this session (explicitly declined), the requirement was
folded forward into the mechanism itself: the item's Grounding digest, Fork 3's bold default, and Done-when
now all state that the future judge pass's rubric MUST include this exact check (emit `kind:
missing-convention` naming `#3029`), citing both landed precedents so the eventual build mirrors them rather
than re-deriving the pattern. This is a rubric requirement folded into the existing output-destination fork,
not a new fork — the coordinator was explicit that it should not become one.

## Net shape at Definition of Ready

One toggle question and one trigger-mechanism question resolve to existing statute/doctrine and platform
fact respectively — recorded as ruled, not forks. Three genuine forks remain, each with a bold default,
options, a fork-existence justification, a `Skeptic:` verdict, and a `Screen:` verdict: execution mode
(detached, forced for `SessionEnd`), automatic coverage (every session, unconditionally — model/effort tier
ruled separately), and output destination (the existing `#2614` pool/schema plus a reinstated privacy scrub
and a new provenance field). A follow-on build item is scaffolded under this card at ratification, per the
`#3457` → `#3460` precedent this item deliberately matches in shape.
