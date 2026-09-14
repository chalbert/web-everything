---
bornAs: x8hzy1m
kind: story
size: 5
parent: "3383"
status: resolved
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-13"
dateResolved: "2026-09-13"
graduatedTo: none
preparedDate: "2026-09-13"
relatedTo: ["3581", "3513", "3371", "3664", "3665", "xucqrc6"]
tags: []
---

# Probe Cursor as an additional dispatch provider

> **Resolved as a completed PREP-only pass, per the operator's explicit "filing/prep only" instruction
> (PR #2194).** The prerequisite is answered and both forks below are ratified with a written verdict.
> What is NOT done — by this card's own Done-when item 3 and PR #2194's own unchecked test-plan line —
> is the live-fire install/spawn/break probe. That work is carried forward to a fresh successor item,
> `#xucqrc6`, rather than left half-tracked on this card, so this PREP deliverable can close cleanly.
> `graduatedTo: none` because no new standard entity was spawned — the successor is a plain backlog item.

Operator wants to know Cursor's likely strengths/weaknesses relative to the already-integrated we:scripts/operations/dispatch-lane-io.mjs providers (Claude Code, and Codex CLI per #3581/#3371's precedent) and, specifically, what CLASS of dispatch task suits it best -- not an assumption that it fits everywhere. Hard prerequisite, mirroring #3371's own finding for Codex verbatim (a real headless/scriptable agentic CLI mode is required for a genuine delivery-agent provider; a chat/completion API is not enough): first determine whether Cursor even offers a comparable headless/scriptable agent CLI mode at all, since it is primarily known as an IDE -- if it does not, that alone answers the evaluation and the item resolves on that finding rather than forcing a capability comparison. Genuinely open, not pre-decided in favor of adoption. If the prerequisite IS met, mirror #3371's probe method: install/authenticate against a real subscription, spawn it headless with a schema-constrained ask, break it on purpose (an unsatisfiable schema, a huge/slow request, a quota-exhausted case), and compare its parsing discipline to we:scripts/lib/judge-spawn.mjs's fail-loud approach -- then write a verdict on which task CLASS (build/delivery-agent vs. independent review/fix-dispatch vs. neither) it is actually suited for, per #3581's own risk-tiered framing of dispatch surfaces. Filing only, per the operator's explicit ask -- do NOT build or research deeply now.

## Done when

1. **The prerequisite is answered first, with evidence, not assumed.** This item's own card carries a
   concrete finding on whether Cursor offers a genuine headless/scriptable agentic CLI mode (something
   in the shape of `codex exec`/`claude --bg` — a mode that can be launched non-interactively, given a
   task, and produces tool-driven edits/output on its own) as opposed to only an IDE plugin, a chat pane,
   or a completion/chat API. Cite what was actually run or read to establish this, not a guess from the
   product's marketing.
2. **If the prerequisite fails, the item resolves right there** with a written verdict saying so, and does
   NOT force a capability comparison against Claude Code / Codex CLI that would have no CLI surface to
   compare.
3. **If the prerequisite holds, mirror `#3371`'s probe method** (install/authenticate against a real
   subscription, spawn it headless with a schema-constrained ask, break it on purpose — an unsatisfiable
   schema, a huge/slow request, a simulated quota-exhausted case if possible — and compare its output/parsing
   discipline to `we:scripts/lib/judge-spawn.mjs`'s fail-loud approach), then write a verdict on which task
   CLASS it is actually suited for (full delivery-agent build vs. independent review/fix-dispatch vs.
   neither), per `#3581`'s own risk-tiered framing of dispatch surfaces (surface risk differs sharply:
   review/fix-dispatch needs no repo-write ownership or lane-lease semantics; full delivery-agent builds need
   the hardest, most provider-specific machinery this repo has).
4. **Nothing is wired into the dispatcher.** This item produces evidence and a verdict, not running code —
   any wiring is separate, later work, gated on this verdict being a clean yes, exactly as `#3371` deferred
   `#3369` step 3.

## Deliberately NOT in scope

- **Wiring Cursor into `we:scripts/operations/dispatch-lane-io.mjs` or any provider-port surface.** That is
  later work, gated on this item's own verdict.
- **Re-deciding whether a second/third provider should exist at all.** `#3513` already ruled that on merit
  for the dispatcher generally; this item evaluates one specific candidate against that already-open door.

## Lineage

Filed under epic `#3383` (the mechanical dispatcher). Mirrors `#3371`'s probe shape and cites `#3581`'s
risk-tiered surface framing (review/fix-dispatch vs. full delivery-agent builds) for how to state the verdict.
Companion item: the sibling Grok probe filed the same session.

---

# PREP — documentation-grounded research pass, 2026-09-13

This pass answers the item's own stated prerequisite from current, cited product documentation (WebFetch/
WebSearch against live sources, not training-data recall) and drafts the forks the prerequisite's answer
opens up. It does **not** perform `#3371`'s live install/spawn/break probe — that stays separately scoped
(see "What still needs a live probe" below) — consistent with this item's own Done-when item 4 ("nothing is
wired... any wiring is separate, later work") and the operator's explicit prepare-only instruction.

## Prerequisite verdict: PASSES — with a caveat sharper than "IDE-only"

**Cursor genuinely offers a headless/scriptable agentic CLI, and a second, structurally different
surface the card's own framing did not anticipate.**

1. **Cursor CLI (`cursor-agent`/`agent`)** — [Using Headless CLI · Cursor
   Docs](https://cursor.com/docs/cli/headless): a documented **print mode** (`-p`/`--print`) built
   explicitly for "non-interactive scripting and automation." Tool use is real: the agent reads files
   (code, images, video) and, when `-p` is combined with `--force`, **applies** edits rather than merely
   proposing them (without `--force`, changes are proposed only — the CLI's own default is human-gated).
   Output formats include `text`, `json`, and `stream-json` (with `--stream-partial-output` for incremental
   deltas). Auth is a `CURSOR_API_KEY` env var, not a login flow. This is shape-comparable to `codex
   exec`/`claude -p` — a real subprocess a parent can spawn, feed a task, and read structured output back
   from.
2. **[Cursor Agent CLI · Cursor blog](https://cursor.com/blog/cli)** (announced 2025-08-07, still "beta" as
   of that post): confirms the CLI can read/modify/delete files and execute shell commands, cites explicit
   "headless" and CI/CD use, and flags "security safeguards still evolving" — a real, current caveat, not
   a stale one, since this repo's own probes (`#3371` Probe 10/11) treat doctrine/tool isolation as a load-
   bearing property for any tool-bearing dispatch candidate.
3. **A second, structurally different surface exists: the Background Agent API / "Cloud Agents."** The
   Cursor **User API Key** (distinct from the plain CLI's `CURSOR_API_KEY`) additionally grants a
   **Background Agent API** — a REST surface to programmatically create/manage agents Cursor itself runs
   on **its own remote infrastructure**, not a local child process. As of February 2026, Cursor shipped
   "Cloud Agents": autonomous agents on isolated VMs that self-test (run the full suite against their own
   changes), record video demos, and **ship merge-ready pull requests themselves**. Free-plan API keys are
   confirmed to exclude Background Agent API access (headless CLI only).

The prerequisite the card asks — "does a genuine headless/scriptable CLI mode exist, comparable to `codex
exec`/`claude`, or is it IDE-only" — is answered **yes**, and answered twice over: there are **two**
candidate surfaces, not one, with materially different process models, and the card's own frame (a single
CLI to evaluate) undersells what is actually on offer. That is this prep pass's first fork.

## Fork 1 — Which Cursor surface is even a *candidate* integration point

**Fork-existence justification.** The two surfaces cannot be treated as one evaluation target: a local
`cursor-agent -p` subprocess is spawned, fed input, and parsed by the *caller* — the same shape as every
provider `we:scripts/operations/dispatch-lane-io.mjs` and `we:scripts/lib/judge-spawn.mjs` already wrap.
The Background/Cloud Agent API does its own git branching, its own testing, and **ships its own pull
requests**, on Cursor's infrastructure, outside this repo's process boundary entirely. Evaluating "Cursor"
as a single undifferentiated candidate would silently average two things with opposite governance
properties.

- **(a) The CLI print-mode subprocess (`cursor-agent -p --force`)** — spawned, timed out, and parsed by
  this repo's own machinery, exactly like `claude`/`codex` are today. Compatible with the existing
  provider-port shape (`we:scripts/operations/cli-adapter.mjs`'s function-type port, per `#3371`'s own
  finding that the port survived a second CLI provider intact) ← **RECOMMENDED as the only candidate worth
  probing live.**
- **(b) The Background/Cloud Agent API** — **REJECTED as an integration surface for this repo, on
  structural grounds, not a capability gap.** This repo's whole dispatch discipline is that a mechanically-
  dispatched agent's edits land through *this repo's own* lane-lease + PR-transport pipeline
  (`we:docs/agent/platform-decisions.md#dispatched-agent-never-runs-commands-directly`,
  `#conveyor-dispatch-calls-the-declared-operation`) — every PR self-approved and landed via
  `we:scripts/pr-land.mjs`, never a second, independent PR-opening mechanism. Cloud Agents that "self-test...
  and ship merge-ready pull requests" **on their own**, from Cursor's own infrastructure, cannot be made to
  route through that pipeline without giving up exactly the property (this repo owns the git operations,
  the lane clone, the PR transport) that makes every other provider composable with the rest of the
  dispatcher. This is a forced-invariant rejection, not a preference: (b) does not compose with the
  already-ratified pipeline shape at all, regardless of how good its output turns out to be. **Caveat, named
rather than papered over:** this rests on the cited sources' description of Cloud Agents as a packaged,
non-configurable "self-test + auto-ship-PR" product behavior — if a future live probe of the actual REST
API finds a mode that returns a diff/branch without auto-opening a PR, that narrower mode would need this
rejection re-examined; nothing here has verified the API's exact request/response surface directly.

**Skeptic (real sub-agent attack, `general-purpose`, prompted only to refute):** SURVIVES. The attack tried
two angles: (1) *"couldn't (b) just be used read-only, e.g. only for its planning/self-test loop, without
letting it open the PR?"* — refuted: the cited capability (self-test + ship PR) is a packaged, atomic
product behavior per the source material, not separable into a callable planning-only mode from what is
documented; treating it as separable would be inventing a capability, not reading one off cited evidence.
(2) *"is this actually a governance re-litigation of `#3513`/whether a second provider may exist at all,
which this item's own 'Deliberately NOT in scope' section forecloses?"* — refuted: `#3513` ruled a second
provider may exist; this fork rules on *which of two surfaces from the SAME candidate* is even eligible to
be probed, a narrower question `#3513` never addressed. Both attacks failed to dislodge the default; no
amendment needed.
**Screen (fresh-context, no access to this session's authoring):** clear. Not an implementation detail —
which surface even preserves this repo's lane-lease/PR-transport invariant is externally observable in
where a PR comes from and who owns the git operations, not an internal wiring choice. A genuine merit
difference (composes with the existing pipeline vs. structurally cannot) survives "both free to build,
instantly maintained" — (b) still can't be made to route through this repo's own PR transport no matter
how much engineering time is thrown at it, because the incompatibility is in what Cursor's own product does
autonomously, not in how much this repo builds around it.

## Fork 2 — is there anything left to decide about *task class*, given Fork 1's answer?

No fresh fork here — **supported by default**, citing already-ratified precedent rather than re-deciding
it. `#3581` (`xzf5v6w`, ratified 2026-09-08) already rules the general shape for *any* second delivery-
agent-shaped provider: pilot on independent review/fix-dispatch first (no repo-write ownership, no lane-
lease semantics to get wrong), never start with full delivery-agent builds, and do so only once `#3513`'s
gate — "a second subscription actually held, or a measured usage-window cap — not a decision" — has
actually fired. Nothing about Cursor's CLI surface (Fork 1(a)) changes that reasoning; if anything it
reinforces it, since Cursor's own docs flag "security safeguards still evolving" for exactly the class of
work (full delivery-agent builds touching a lane clone) `#3581` already says to defer.

## What still needs a live probe — sharpened by this pass, not re-guessed

This prep pass narrows `#3371`'s probe method to the specific unknowns documentation could not resolve,
so a future live-fire probe (this item's own Done-when item 3, still open) does not start blind:

1. **Schema enforcement, unverified.** `we:scripts/lib/judge-spawn.mjs`'s guarantee 2 (`--json-schema` as a
   *forced tool call*, not a request) has no confirmed Cursor CLI equivalent in the fetched docs —
   `json`/`stream-json` are output *formats*, not a cited structural schema-constraint mechanism. Until
   probed, assume Cursor CLI's structured output is a *request*, not a guarantee, and treat any
   judge/reviewer use as unproven.
2. **The `--force` / non-interactive boundary.** Docs describe `--force` as required to apply edits (vs.
   propose) under `-p`, but do not confirm whether a *fully unattended* run (no human ever present) can
   invoke `--force` safely, or whether some approval gate still fires. `#3371`'s Codex probe found exactly
   this kind of undocumented gap (the stdin trap) on its first invocation; Cursor should be assumed capable
   of an equivalent trap until proven otherwise.
3. **Auth persistence across headless invocations.** `CURSOR_API_KEY` is a plain env var (simpler than
   Codex's ChatGPT-login persistence), but whether a Free-plan key is sufficient for the CLI (vs. requiring
   a paid plan even for print-mode) was not confirmed in the fetched pages and should be checked against a
   real account before any live probe assumes free-tier access.
4. **Failure-mode shape** (quota exhaustion, malformed schema, timeout) — entirely unprobed; `#3371`'s
   probes 5/6/8 are the template to repeat.

## Verdict

**Buildable-in-principle, not yet proven.** Cursor CLI (Fork 1(a)) clears the prerequisite and is a real
candidate for the *same* review/fix-dispatch-first lane `#3581` already prescribes for any second delivery-
agent-shaped provider — gated on `#3513`'s trigger firing and on a live probe resolving the four open
unknowns above, chiefly whether Cursor's structured-output mode is a genuine forced-schema guarantee or
only a request. The Background/Cloud Agent API (Fork 1(b)) is **not a candidate integration surface at
all**, on structural grounds independent of capability — it does not compose with this repo's own PR-
transport discipline. Nothing is wired into the dispatcher; this remains a research/verdict item per
Done-when item 4.
