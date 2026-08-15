---
bornAs: xly5h33
kind: story
size: 2
parent: "2676"
status: open
dateOpened: "2026-07-27"
scope:
  - we:skills-src/jury/subject-jury.workflow.js
  - we:skills-src/jury/__tests__/red-team-data-grounding.test.mjs
  - we:skills-src/jury/SKILL.md
tags: []
---

# Data-grounding lens: check design claims against real data availability

A lens that verifies a design's claims against the data we actually store — e.g. velocity needs dateStarted/dateResolved, a design-increment filmstrip needs captured snapshots. Flag or refuse designs that silently assume uncaptured data, and emit the missing-capture work as follow-up items.

This session the red-team's data-model-truth lens found the design assumed a feature tier and snapshot store that do not exist; those became filed capture items. The tool should do this automatically and emit the follow-ups.

Captured from the **feature-tracking-screen** design session — a capability the design-studio tool (#2676) should productize, drawn from methodology we ran by hand. Decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d

## Prepared 2026-08-15 — build-ready as a small, focused prompt change (not a new mechanism)

Verified against the live tree. The **mechanism** this card describes — flag a design claim that rests on
uncaptured data, and route the gap into a filed follow-up item — is **already built and generic**, across
two already-resolved siblings from the same design session:

- **[#2707](/backlog/2707-jury-skill-red-team-after-jury-fail-closed.md) (resolved)** gave the jury a
  mandatory, fail-closed, post-accept **red-team** stage: `redTeamPrompt()` at
  `we:skills-src/jury/subject-jury.workflow.js:697-728`, run by `redTeamGate()` (`we:skills-src/jury/subject-jury.workflow.js:860-899`) whenever a
  jury panel reaches `accept`. It is subject-agnostic (works over a PR diff, a rendered design, or decision
  prose alike) and already instructs the agent to hunt for "a claim the material asserts but did not earn"
  — the same general shape as a data-grounding check, just not yet pointed at data specifically.
- **The "emit as a follow-up item" half is also already generic** — `#2942`/`#2823`'s prevention
  introspection. Every red-team finding is already REQUIRED to carry `prevention` (the guard/capture work
  that would close the gap) and `preventionCaptured` (`we:skills-src/jury/subject-jury.workflow.js:307-312`,
  the `FINDING_INTROSPECTION_PROPERTIES` shared by the panel and the red-team schemas). When
  `preventionCaptured` is `false` and the finding's `impactIfUnfixed` clears the bar, `deriveVerdict` already
  returns `VERDICTS.PREVENTION_OUTSTANDING` (`we:scripts/lib/jury-core.mjs:74,257,371-376,454-467,486`) and
  `deriveNegotiationOutcome` already escalates it (`we:scripts/lib/jury-core.mjs:594`) rather than landing — the exact "flag it and
  route it to a filed follow-up" behaviour this card asks for, with no new code.

**So this card's real remaining scope is narrow: teach the existing red-team stage to specifically check
data-dependent claims against the real repo, instead of leaving that to the generic "claim not earned"
instruction and hoping a data-grounding gap happens to be the one an agent notices.** No new lens
mechanism, no new schema field, no new escalation path, no new module — those are already load-bearing
infrastructure this card gets for free.

## Relationship to #2697 — scope split, not a duplicate

[#2697](/backlog/2697-built-in-adversarial-red-team-of-the-tool-s-own-proposals.md) (open, size 5, same
parent #2676, same design session) frames the red-team as covering **five** honesty lenses:
"internal-contradiction, false-precision, scale-unproven, a11y-truth, data-model-truth." **This card IS
that fifth lens** ("data-model-truth" / "data-grounding" are the same thing, named twice from the same
session) — #2695 is more detailed than #2697's one-line mention (it names the concrete behaviour: flag,
refuse, emit follow-ups) and #2697 is the one that names the other four.

To avoid two lanes editing the exact same function (`redTeamPrompt()`) without knowing about each other:
**this card's scope is data-grounding ONLY.** The other four honesty lenses
(internal-contradiction/false-precision/scale-unproven/a11y-truth) stay #2697's remaining scope and are
NOT touched here. If both cards are ever picked up in parallel lanes, whichever lands second must re-read
`redTeamPrompt()` fresh rather than diff against a stale copy — flagging this as a real (if narrow) co-edit
risk, not a blocker to either card individually.

## Decided design

Add one explicit **data-grounding directive** to the shared red-team prompt, generic across all three
subjects (pr-diff / design-pixels / decision-prose) — consistent with the engine's existing rule that no
subject-specific branching lives in the harness body (`we:skills-src/jury/subject-jury.workflow.js`'s own
header: "NO JURY LOGIC LIVES HERE"). The directive:

> For any claim in the material that depends on data being stored or captured (a metric, a computed value,
> a named field, a history/snapshot series), verify the repo ACTUALLY captures that data — use your tools
> to read the real schema or data source it would come from (e.g. grep backlog item frontmatter fields
> under `we:backlog/*.md`, or the relevant `we:src/_data/*.js` derivation) before accepting the claim as
> earned. If the material assumes a field or store that is not actually captured anywhere in the repo, that
> is a BLOCKING finding; its `prevention` must name the concrete capture work needed (the field, store, or
> schema addition) so it can be filed as a follow-up item.

This is additive text inserted into `redTeamPrompt()` (after the existing "Ground every attack in the
material..." line, before the "Return { findings: ... }" contract) — no signature change, no new schema
field (the finding shape already carries `prevention`/`preventionCaptured`/`impactIfUnfixed`).

**Why this works even though the red-team is otherwise TOOL-FREE-adjacent:** the panel jurors (`judgePanel`
fan-out) are deliberately tool-free headless children (#3057). The red-team is NOT part of that fan-out —
it is one plain `agent()` call in the harness body (`we:skills-src/jury/subject-jury.workflow.js:865-868`), the same primitive the `Resolve`/`Reduce`
phases use to literally shell `node we:skills-src/jury/resolve-roster.mjs` / `node we:scripts/review-core-cli.mjs`
from inside their own prompts (`we:skills-src/jury/subject-jury.workflow.js:121-124`). A harness `agent()` call already has tool/shell access by
construction — the directive above asks it to use exactly that, not a new capability.

**De-risking probe run during this preparation (checklist item 8).** Ran the exact directive text above
live, via `claude -p` with `Read`/`Grep`/`Glob` over this repo, against a synthetic red-team material
modelled on this card's own motivating example: a velocity panel computing throughput from fabricated
`dateAssigned`→`dateShipped` fields, and a filmstrip sourced from a fabricated `designSnapshots` array —
mirroring the real fields that exist (`dateOpened`/`dateStarted`/`dateResolved`) and the real absence of any
snapshot store (both independently confirmed by direct grep during this prep: no `dateAssigned`,
`dateShipped`, or snapshot-store hit anywhere outside this card's own text and its siblings #2686/#2688).
The probe agent, given only the directive and the fabricated material — not told which fields were fake —
**correctly flagged both as unearned, cited the real file it checked (`we:src/_data/backlog.js:325-327`) and
the grep that came back empty, and proposed a concrete `prevention` for each**, plus two further genuine
findings beyond the planted ones (a missing subject→feature association key, and a semantic conflation of
`dateResolved` firing on ratified decisions as well as shipped work — correctly citing the real
`we:src/_data/burndown.js`). This is the strongest available evidence short of running the real harness live:
the directive, as drafted, produces exactly the flag-and-route behaviour the card describes, grounded in
files that are actually there.

## Interfaces / protocol at every seam

- **`redTeamPrompt(subject, noun, material, materialFile)`** — pure function,
  `we:skills-src/jury/subject-jury.workflow.js:697`. Same 4-arg signature, same return type (a prompt
  string). Insert the data-grounding directive paragraph between the existing line 715
  (`'the strongest reason this ${noun} should NOT be ratified...'` block, ending "...do not invent defects
  you cannot point to.") and line 719's `#2823` comment / the `Return { findings: ... }` contract at line
  722. No other function in this file calls `redTeamPrompt` except `redTeamGate` (`we:skills-src/jury/subject-jury.workflow.js:866`). The file is a non-importable Workflow sandbox body per its own header comment, `we:skills-src/jury/subject-jury.workflow.js:46-60`, so there is no ES-import consumer to check elsewhere.
- **`RED_TEAM_SCHEMA`** (`we:skills-src/jury/subject-jury.workflow.js:429`+) and `FINDING_INTROSPECTION_PROPERTIES` (`we:skills-src/jury/subject-jury.workflow.js:304-312`) — **unchanged**. They
  already declare `prevention` / `preventionCaptured` / `impactIfUnfixed` on every red-team finding; a
  data-grounding finding is just a finding whose `category` reads `"data-grounding"` (free-form string,
  no enum to extend).
- **`we:skills-src/jury/SKILL.md`**, "The mandatory post-jury red-team" section (lines 93-108) — add one
  bullet naming the data-grounding check, mirroring the existing bullet's tone/level of detail (doc-only,
  no interface).
- **No change to `we:scripts/lib/jury-core.mjs`, `we:skills-src/jury/resolve-roster.mjs`, `we:skills-src/jury/panel-fanout.mjs`, or any adapter**
  — confirmed by reading `redTeamRequired`/`foldRedTeamVerdict` (`we:scripts/lib/jury-core.mjs:627,645`) and
  `RED_TEAM_LENS`/`redTeamGate` (`we:skills-src/jury/subject-jury.workflow.js:140,860`): the fold/escalate logic already
  treats every red-team finding uniformly regardless of its `category`, so a new category needs no new
  branch anywhere downstream.

## Tasks (ordered)

1. Read `we:skills-src/jury/subject-jury.workflow.js` lines 697-728 (current `redTeamPrompt`) to confirm the
   exact insertion point is unchanged from this preparation.
2. Insert the data-grounding directive paragraph (see "Decided design") into `redTeamPrompt()`.
3. Add `we:skills-src/jury/__tests__/red-team-data-grounding.test.mjs` — a new test file (mirroring the
   existing text-pinning pattern in `we:skills-src/jury/__tests__/panel-fanout.test.mjs` lines 208-232, which
   reads the harness file with `readFileSync` and asserts `.toContain(...)` on literal phrases, since the
   harness body itself is not importable/unit-testable — see its own header comment, `we:skills-src/jury/subject-jury.workflow.js:100-107`). Assert
   the red-team prompt section contains the data-grounding directive's key phrases (e.g. the "verify the
   repo ACTUALLY captures that data" instruction and the "assumes a field or store that is not actually
   captured" blocking-finding language) so a future edit that silently drops the directive fails the gate.
4. Add one bullet to `we:skills-src/jury/SKILL.md`'s red-team section (lines 93-108) naming the data-grounding
   check.
5. Run `npx vitest run skills-src/jury` — confirm the new test passes and nothing else regresses.
6. Run `node --check we:skills-src/jury/subject-jury.workflow.js` — confirm it still fails (the file stays
   a non-standard Workflow sandbox body, not turned into an importable module; this is the existing,
   already-failing baseline — verified during this preparation — not a new requirement).
7. Run `npm run check:standards` — 0 errors.

## Done when

- `redTeamPrompt()` in `we:skills-src/jury/subject-jury.workflow.js` contains an explicit instruction to
  verify data-dependent claims against the repo's real captured/stored data (using the agent's own tools)
  before accepting them, and to treat an assumed-but-uncaptured field or store as a BLOCKING finding.
- `we:skills-src/jury/__tests__/red-team-data-grounding.test.mjs` reads the harness file as text and fails
  if the directive's key phrases are removed or reworded away from the required behaviour — verified by
  temporarily reverting the directive locally and confirming the test goes red, then restoring it.
- `we:skills-src/jury/SKILL.md`'s red-team section names the data-grounding check alongside the existing
  red-team description.
- `npx vitest run skills-src/jury` is green, including the new test.
- `npm run check:standards` reports 0 errors.
- The other four honesty lenses named in #2697 (internal-contradiction / false-precision / scale-unproven /
  a11y-truth) are NOT added here — confirms scope stayed split as decided above.

## Delivery shape

**Lands in one PR, behind `main`, no branch or flag needed.** Purely additive: one prompt paragraph, one
new test file, one doc bullet. No schema change, no new finding field, no data migration, no consumer
outside this one file family. `we:skills-src/jury/subject-jury.workflow.js` is a tracked "blast-radius" path
(`we:scripts/lib/__tests__/review-escalation.test.mjs` lines 244-251, `isBlastRadiusPath`), so the PR that lands
this will auto-escalate to a higher review care level by the existing gate — expected and correct for an
edit to agent-review-behaviour source, not a defect to route around.

## Preparation status

Items 1–8 of `we:agent-memory-src/story-preparation-checklist.md` are done above: scope+consumers (incl.
the subprocess-vs-import check this checklist calls out as the usual miss), size+basis (2 — a single prompt
paragraph + one new small test file + one doc bullet, no interface/schema change, no migration), testable
Done-when, the decided design (no open fork — the mechanism already exists generically, this card only adds
the specific check), interfaces at every seam, ordered tasks, delivery shape, and a live de-risking probe of
the risky part (does the directive actually produce the flag-and-route behaviour) rather than deferring that
question to the build. **Item 9 (independent review of this preparation) has not happened** — per the
checklist this card is *prepared*, not yet *build-ready*, until that review runs.
