---
kind: story
size: 5
parent: "2565"
status: active
scaffoldedBy: "slice-2565"
dateScaffolded: "2026-07-20"
blockedBy: ["2558", "xntcdet"]
dateOpened: "2026-07-20"
tags: [plateau-loop, console, decision-surface, rule-interface, write-port, override, slice-2565]
---

# Rule a fork through the write port with first-class override capture

Record a per-fork operator verdict — accept-default / override-with-X / defer — and write it through the
[#2558] write port: on ratify, a lane-to-PR `resolve --codified-to` carries the human's call. **Override is a
first-class path** that captures the operator's alternative, not just an accept/reject of the recommendation.
This is the **write half** that makes the surface a real rule interface rather than an explainer; it builds on
the live-rendered forks from [#xntcdet].

## Scope
- **The verdict control.** Each fork card ([#xntcdet]) gains a ruling control with three outcomes:
  **accept-default** (ratify the recommended option), **override** (choose a different option, or enter an
  alternative the operator authors), and **defer** (leave the fork open, no write). One verdict per fork; a
  decision with multiple forks records each independently.
- **Override is first-class, not a rejection.** The override path captures *what the operator chose instead* —
  the alternative option or free-text call plus a short reason — so the record answers "what did the human
  decide," never merely "the human declined the recommendation." This alternative is what rides into
  `codifiedIn` / the resolve narrative.
- **Write path = the `#2558` write port, only.** On ratify, the surface issues the mutation through
  `POST /api/backlog/write` (never a direct disk/CLI call): the `we:` decision-resolve verb
  ([we:scripts/backlog.mjs](scripts/backlog.mjs) `resolve <NNN> --codified-to=…`) run inside an acquired
  lane → `check:standards` gate → `gh pr create --label ready-to-merge`. **No write touches `main`** (the
  `#2558` R1 invariant). Recording a ruling **reuses the existing `resolve` verb** — no new verb and no
  second write path. `resolve` is already a member of the `WriteVerb` type union
  (`plateau-app:src/backlog-view/write.ts` — a string-literal union, there is no `WRITE_VERBS` enum/set). The
  two concrete changes that make it carry a ruling are named in "Where the code goes" below.
- **Verdict → resolve payload.** Accept-default resolves the decision citing the recommended option's rule;
  override resolves citing the operator's alternative as `--codified-to` (or the sanctioned `one-off`
  sentinel for a genuinely narrow call); defer writes nothing. The mapping from the three-outcome control to
  the resolve payload is the deliverable's core.

## Where the code goes (locus)
- Ruling control + submit live in the plateau-app view alongside the read surface:
  `plateau-app:src/backlog-view/`. The write goes through the existing client → middleware write flow
  (`plateau-app:src/backlog-view/write-action.ts` `runWriteFlow`), reusing the existing `resolve` verb; the
  actual `resolve` runs in the lane's own [we:scripts/backlog.mjs](scripts/backlog.mjs). Two concrete code
  changes make `resolve` usable for a decision ruling:
  1. **Lift the decision guard in `canApply`** (`plateau-app:src/backlog-view/write.ts`). Today `canApply`
     hard-blocks a `kind: decision` resolve with `reason: 'a decision must be codified before it resolves'`
     — precisely the case this surface now handles. Replace that blanket refusal so a decision is *rulable*
     from here **when a `--codified-to` payload is present** (still refused without one, so the gate below can
     never be reached empty). `kind: epic` stays refused.
  2. **Thread `--codified-to` through the write flow** (`plateau-app:src/backlog-view/write-action.ts` and
     `plateau-app:src/backlog-view/write.ts`). `resolve` currently emits only `--graduated-to=none` in
     `cliArgsAfterVerb`, and there is no codified-to field on `WriteFlowOpts` / `WriteRequest`. Add a
     `codifiedTo` field to those option shapes and have `cliArgsAfterVerb` append
     `--codified-to=<anchor|one-off>` for a decision resolve. This is the payload the operator's verdict maps
     to; without it the WE-side resolve gate (below) rejects the write.
- The `--codified-to` gate on a `kind: decision` resolve is a `we:` rule already enforced by
  [we:scripts/backlog.mjs](scripts/backlog.mjs) (via [we:scripts/backlog/frontmatter.mjs](scripts/backlog/frontmatter.mjs)
  `validateCodifiedIn`) — so once the plumbing in change (2) supplies it (the operator's rule anchor or
  `one-off`), the write is gate-clean.

## Depends on / out of scope
- **Depends on** [#xntcdet] — the live fork cards are what the ruling control attaches to.
- **Governance fencing** (whether a given decision may be ruled from this launch frame, statute routing,
  waivers) is [#xzlknku] — this slice writes the verdict; that slice gates *whether the write is allowed*.

## Acceptance
- A fork card offers accept-default / override / defer; submitting **accept-default** ratifies via the
  `#2558` write port and lands a `ready-to-merge` PR that resolves the decision citing the recommended
  option — nothing touches `main` directly.
- **Override** records the operator's chosen alternative (option or authored call + reason) and that
  alternative is what appears in the resolved item's `codifiedIn` / narrative — not a bare "recommendation
  rejected."
- **Defer** writes nothing and leaves the decision open.
- The ruling reuses the existing `resolve` `WriteVerb` (no new verb, no second write path); the
  `kind: decision` block in `canApply` (`plateau-app:src/backlog-view/write.ts`) is lifted so a decision is
  rulable here only when a `--codified-to` payload is present; `cliArgsAfterVerb` emits
  `--codified-to=<anchor|one-off>` alongside the existing `--graduated-to=none` for a decision resolve; a
  `kind: decision` resolve always carries a `--codified-to`; `plateau-app` `npm test` and `we:`
  `check:standards` pass.
