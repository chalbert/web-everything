---
bornAs: x3kt7op
kind: story
size: 3
parent: "3029"
status: open
relatedTo: ["2439", "2821", "3050"]
dateOpened: "2026-08-16"
scope:
  - we:skills-src/drain/SKILL.md
  - we:skills-src/harvest-learnings/SKILL.md
  - we:skills-src/next-backlog-item/SKILL.md
  - we:skills-src/brand-mark-loop/SKILL.md
tags: [plateau-loop, delivery, operations, review, independence]
---

# Subagent "independent" reviewers aren't independent — route judgment through judgeSpawn/judgePanel, not the Agent tool

Four skills spawn a "fresh-context" / "independent" agent via the plain `Agent` tool for a judgment their own
text calls independent — but a subagent inherits its parent's `CLAUDE_CODE_SESSION_ID`, the identity
`we:scripts/lib/review-independence.mjs` keys independence on, so every one is the same actor wearing another
hat. Not speculative: `/jury` had this exact bug — *"one actor wearing N hats by this repo's own test"* —
before [#3050]'s `judgePanel` fixed it with distinct-session-id processes. The fix is shipped; these four sites
haven't moved onto it.

## The fix already shipped, elsewhere

`/jury` (`we:skills-src/jury/SKILL.md`) now fans out through `judgePanel` (`we:scripts/lib/judge-panel.mjs`,
#3050), which spawns headless, tool-free `claude -p` processes each with its own derived `--session-id`, and
refuses to seat a panel whose derived ids are not pairwise distinct.

## The four sites

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

## Why this is a fix, not a new mechanism

`judgeSpawn` (`we:scripts/lib/judge-spawn.mjs`, the single-juror case `review-pr`'s `judge` step uses) and
`judgePanel` (`we:scripts/lib/judge-panel.mjs`, #3050, the N-juror fan-out `/jury` uses) already exist and are
proven in production. None of the four sites above need a NEW spawn mechanism — they need to stop calling the
`Agent` tool for a judgment they call independent and start calling one of these two, exactly as `/jury` and
`review-pr`/`review-prep` already do. Where a site already runs inside a declared operation's `judge` step
(none of these four do yet — drain and harvest-learnings are pure skills, next-backlog-item's ratify step has
no operation at all today), the fix is free: a `judge` step structurally cannot be satisfied by a self-spawn,
because the engine suspends and the caller must do a real `judgeSpawn`/`judgePanel` call between two `advance`
calls. Where a site stays a plain skill (drain, harvest-learnings), the fix is calling `judgeSpawn`/`judgePanel`
directly in place of the `Agent` tool — a smaller, still-real improvement even without an operation wrapping it.

## Relationship to the prepare/ratify work

Site 3 (next-backlog-item's decision red-team) is the ratify-side occurrence of the identical failure the
prepare-side skeptic pass hit tonight (see [#3033] and the sibling "declare prepare's skeptic + two-confusion
screen as judge steps" story). If ratify is mechanized with a `judge` step for its own skeptic/red-team pass
(per #3033's design discussion), that structurally fixes site 3 as a side effect — landing this item's fix for
site 3 should be checked against whatever #3033 ships before both are called done, to avoid two divergent
fixes for the same step.

## Done when

1. Drain's three spawn sites (panel reviewer, validator jury, editor) call `judgeSpawn`/`judgePanel` instead of
   the `Agent` tool, or route through a declared operation's `judge` step if one exists by the time this lands.
2. Harvest-learnings' skeptic-per-candidate step does the same.
3. Brand-mark-loop's step 5 no longer offers "role-play" as an accepted substitute for a real independent spawn.
4. Next-backlog-item's decision red-team step is fixed here OR is confirmed superseded by the ratify
   mechanization (#3033 / the prepare sibling story) — not both independently, and not silently dropped if
   neither lands.
5. `npm run check:standards` — 0 new errors.
