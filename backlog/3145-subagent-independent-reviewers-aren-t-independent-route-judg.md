---
bornAs: x3kt7op
kind: story
size: 3
parent: "3029"
status: resolved
relatedTo: ["2439", "2821", "3050"]
dateOpened: "2026-08-16"
dateStarted: "2026-08-17"
dateResolved: "2026-08-17"
scope:
  - we:skills-src/drain/SKILL.md
  - we:skills-src/harvest-learnings/SKILL.md
  - we:skills-src/next-backlog-item/SKILL.md
  - we:skills-src/brand-mark-loop/SKILL.md
  - we:skills-src/converge/SKILL.md
tags: [plateau-loop, delivery, operations, review, independence]
---

# Subagent "independent" reviewers aren't independent — route judgment through judgeSpawn/judgePanel, not the Agent tool

Five skills spawn a "fresh-context" / "independent" agent via the plain `Agent` tool for a judgment their own
text calls independent — but a subagent inherits its parent's `CLAUDE_CODE_SESSION_ID`, the identity
`we:scripts/lib/review-independence.mjs` keys independence on, so every one is the same actor wearing another
hat. Not speculative: `/jury` had this exact bug — *"one actor wearing N hats by this repo's own test"* —
before [#3050]'s `judgePanel` fixed it with distinct-session-id processes. The fix is shipped; these five sites
haven't moved onto it.

## The fix already shipped, elsewhere

`/jury` (`we:skills-src/jury/SKILL.md`) now fans out through `judgePanel` (`we:scripts/lib/judge-panel.mjs`,
#3050), which spawns headless, tool-free `claude -p` processes each with its own derived `--session-id`, and
refuses to seat a panel whose derived ids are not pairwise distinct.

## The five sites

1. **`we:skills-src/drain/SKILL.md`, the auto-review v3 negotiation loop** — three separate spawns, all via the
   plain `Agent` tool:
   - *"Spawn ONE **fresh-context adversarial review subagent per lens** (the `Agent` tool, fanned out in
     parallel via the Workflow orchestrator)"* — the panel reviewer.
   - *"Spawn a fresh-context validator JURY — one subagent per `PANEL_LENSES` lens"* — the pre-land
     [#2439] "INDEPENDENT HARDENED VALIDATOR" gate, whose whole point is that it "took NO part in the
     negotiation" — the exact property a subagent spawn cannot guarantee.
   - *"Spawn a fresh-context editor subagent"* — the revision round between panel rounds.
   This is the highest-value site to fix: drain is the merge-queue lander, and its "independent validator"
   language is the load-bearing claim [#2439] exists to make true.
2. **`we:skills-src/harvest-learnings/SKILL.md`, step 2** — *"One skeptic sub-agent per candidate, mandate =
   kill it"* — same pattern, lower stakes (its output only routes to backlog/memory, gated further downstream).
3. **`we:skills-src/next-backlog-item/SKILL.md`, the decision red-team step** — *"spin up a throwaway
   **skeptic sub-agent** (prompted only to refute)"* for high-leverage/high-`gates` forks at ratification time.
   This is the ratify-side sibling of the exact bug [prepare's skeptic pass] hit tonight — see the coordinating
   note below.
4. **`we:skills-src/brand-mark-loop/SKILL.md`, step 5** — *"Red-team — spawn (**or role-play**) a skeptic
   prompted only to REFUTE"* — weaker still: it explicitly sanctions no spawn at all, self-role-play accepted
   as an equivalent.
5. **`we:skills-src/converge/SKILL.md`, the panel/editor/red-team loop** — the same shape a third time, driven
   by `we:scripts/converge-cli.mjs` / `we:scripts/lib/converge-core.mjs`, neither of which calls `judgeSpawn` or
   `judgePanel` (confirmed: zero hits for either name in `we:scripts/lib/converge-core.mjs`,
   `we:scripts/converge-cli.mjs`, or `we:scripts/lib/converge-transports.mjs`) — the CLI only prints an
   instruction for the driving agent to act on:
   - *"spawn ONE fresh subagent per printed lens (× `jurors`)"* — the panel step.
   - *"spawn ONE editor subagent"* — the edit step.
   - *"spawn one fresh adversary per entry in `redTeam.jury`"* — the red-team step, whose whole point (per the
     skill's own invariants) is that "an unrun red-team never ratifies" and "the panel never authors what it
     judges" — the same independence claim the other four sites make and cannot keep with a plain `Agent`
     spawn. Contrast with `we:skills-src/jury/SKILL.md`, which states plainly that its CLI "calls `judgePanel`
     ... which spawns" the distinct-session-id processes itself — converge's CLI does not do this, so the
     independence claim rests entirely on the driving agent's own `Agent`-tool spawn, same as sites 1–4.

## Why this is a fix, not a new mechanism

`judgeSpawn` (`we:scripts/lib/judge-spawn.mjs`, the single-juror case `review-pr`'s `judge` step uses) and
`judgePanel` (`we:scripts/lib/judge-panel.mjs`, #3050, the N-juror fan-out `/jury` uses) already exist and are
proven in production. None of the five sites above need a NEW spawn mechanism — they need to stop calling the
`Agent` tool for a judgment they call independent and start calling one of these two, exactly as `/jury` and
`review-pr`/`review-prep` already do. Where a site already runs inside a declared operation's `judge` step
(none of these five do yet — drain, harvest-learnings, and converge are pure skills, next-backlog-item's ratify
step has no operation at all today), the fix is free: a `judge` step structurally cannot be satisfied by a
self-spawn, because the engine suspends and the caller must do a real `judgeSpawn`/`judgePanel` call between two
`advance` calls. Where a site stays a plain skill (drain, harvest-learnings, converge), the fix is calling
`judgeSpawn`/`judgePanel` directly in place of the `Agent` tool — a smaller, still-real improvement even without
an operation wrapping it.

## Relationship to the prepare/ratify work

Site 3 (next-backlog-item's decision red-team) is the ratify-side occurrence of the identical failure the
prepare-side skeptic pass hit tonight (see [#3033] and the sibling "declare prepare's skeptic + two-confusion
screen as judge steps" story). If ratify is mechanized with a `judge` step for its own skeptic/red-team pass
(per #3033's design discussion), that structurally fixes site 3 as a side effect — landing this item's fix for
site 3 should be checked against whatever #3033 ships before both are called done, to avoid two divergent
fixes for the same step.

## Done when

> **Ruling recorded on land (2026-08-17).** Criteria 1 and 5 name the **editor** spawns alongside the judging
> ones. They were NOT routed through `judgeSpawn`/`judgePanel`, on purpose and for reasons in the code rather
> than preference — an editor authors rather than judges, `judgePanel` has no `allowedTools` to forward, and
> `assertLaneCwd` structurally refuses a tool-bearing juror pointed at the driver's own lane, which is exactly
> the tree converge's editor exists to edit. The residual is filed as [#xl5jroq] and the capability a
> tool-free panel loses is filed as [#x27e4xs]. Read 1 and 5 below as met **for the judging spawns**; see
> *Deviation* in Progress for the full argument. Nothing here was silently dropped.

1. Drain's three spawn sites (panel reviewer, validator jury, editor) call `judgeSpawn`/`judgePanel` instead of
   the `Agent` tool, or route through a declared operation's `judge` step if one exists by the time this lands.
   -> **panel reviewer + validator jury: done. Editor: ruled out with reason, [#xl5jroq].**
2. Harvest-learnings' skeptic-per-candidate step does the same. -> **done.**
3. Brand-mark-loop's step 5 no longer offers "role-play" as an accepted substitute for a real independent spawn.
   -> **done.**
4. Next-backlog-item's decision red-team step is fixed here OR is confirmed superseded by the ratify
   mechanization (#3033 / the prepare sibling story) — not both independently, and not silently dropped if
   neither lands. -> **fixed here** ([#3033] still `open` at build time), with an in-skill coordination note so
   the two fixes do not diverge.
5. Converge's panel, edit, and red-team steps call `judgeSpawn`/`judgePanel` instead of instructing the driving
   agent to spawn via the plain `Agent` tool. -> **panel + red-team: done. `edit`: ruled out with reason (see
   above), [#xl5jroq].**
6. `npm run check:standards` — 0 new errors. -> **green.**

## Progress

**2026-08-17 — all five sites routed off the `Agent` tool.** Every independence-claiming **judgment** spawn in
the five skills now shells `we:skills-src/jury/panel-fanout.mjs`, the shim `/jury` already uses, which calls
`judgePanel` (`we:scripts/lib/judge-panel.mjs`) and seats one tool-free headless `claude -p` per juror with its
own derived `--session-id`. No new spawn mechanism was built, exactly as this item argued.

- **The recipe is written once**, in `we:docs/agent/delivery-loop.md#independent-judgment-spawn` — the page
  that already owned *"spawning a reviewer that is actually independent"*, whose existing recipe covers only
  the **acting** reviewer (its own lane, tools, `bypassPermissions`). The five skills cite that anchor rather
  than each carrying a copy.
- **Drain (done-when 1)** — the round-1 panel and the [#2439] validator jury both fan out through the shim.
  Two details that are properties, not formalities, are now stated in the skill: the validator **must** use a
  `--run-id` distinct from every negotiation round (a seat's id derives from `runId` + `lens#slot`, so reusing
  it would mint the validator the same actor id as the panel juror it must be independent of), and each round
  gets its own run id so round N+1 is not round N re-judging itself.
- **Harvest-learnings (2)** — one seat per candidate, mandate = kill it. Called out honestly: the Grounding
  filter asks the skeptic to open a corroborating in-repo artifact and a tool-free seat cannot, so the driver
  now does that lookup and puts what it found — **including "nothing"** — into the material. Same filter, the
  search moved to the only actor that can run it. Also corrected a claim this change falsified: the red-team
  seats no longer emit into the learnings pool while they run (they have no tools); the pool still grows from
  *other* sessions, which is what the `--archive` bound is really for.
- **Brand-mark-loop (3)** — "or role-play" is gone, with the reason stated: you authored the mark and wrote
  the step-4 critique, so a self-played refutation is the author grading the author. The seat is tool-free and
  cannot see the PNG, so it red-teams your rendering notes and critique — you are the eyes, it is the doubt.
- **Next-backlog-item (4)** — fixed here, because [#3033] is still `open` (checked at build time). The block
  carries an explicit coordination note: if [#3033] mechanizes ratify as a declared operation with a `judge`
  step, that fix is structural and this block becomes the operation's `judge` step — do not leave both
  standing.
- **Converge (5)** — the `panel` and `red-team` actions now seat jurors through the shim.
  `we:scripts/converge-cli.mjs` is unchanged: it still only *prints* the mandates, so the fix is in how the
  driving agent acts on them, which is where the `Agent`-tool call lived.

### Deviation: the two EDITOR spawns stay subagents, on purpose

Done-when 1 names drain's editor and done-when 5 names converge's `edit` step. Neither was routed through
`judgeSpawn`/`judgePanel`, for two reasons found in the code rather than assumed:

1. **An editor authors; it does not judge.** `judgePanel` has no `allowedTools` to forward — every seat is
   `--tools ''` and answers a forced findings schema. There is no editor for a juror to be.
2. **`assertLaneCwd` structurally forbids the converge case.** A tool-bearing `judgeSpawn` juror is admitted
   only against a lane clone that is **not the driver's own**; converge's editor exists to edit precisely the
   driver's lane.

What the *"the panel never authors what it judges"* invariant actually needs is that the editor is not one of
the actors that judged it — and that now holds by construction, because every juror is headless with its own
id while the editor carries the driver's. Giving the editor its own tool-bearing headless spawn is filed as
[#xl5jroq]; the capability a tool-free panel loses (`MUTATION_PROBE_RULE`'s break-the-line probe, and the
mandate's throwaway-`git clone` escape) is filed as [#x27e4xs]. Both are stated in the skills at the point of
use, not only here.

### The documented recipe was RUN, not merely written

The commands added to the five skills were executed once against this lane's own diff before the PR opened
(`--run-id=we-3145-selfreview-r1`, two seats, `$0.96`): both seats returned `ok: true` with **different**
reported session ids (`55b5906d-…` / `0435e850-…`) and five findings between them, three of which were real
and are fixed in this same diff — a garbled sentence a hand-edit left in the drain skill, a converge payload
example missing the `id` its own instructions told you to map by, and this ruling block. The fourth
(`buildPanelMandate` supposedly not accepting `goal`/`round`) was **dismissed with reason**: both are
declared parameters of its signature in `we:scripts/lib/review-core.mjs`, checked in source. The fifth is a
juror's own note that the diff is documentation-only, which is true and not a defect.

That run is the evidence for the one claim a documentation change like this could otherwise not make: the
payload shape and flag list in these skills are runnable as written, rather than plausible.