---
name: design-committee
description: Right-size and run a design proposal panel — several agents each proposing a mock, blind to each other, then judged on rendered pixels. STARTS BY ASKING whether a panel is warranted at all; "no panel, just author it" is the most common answer. Use when the user asks for "a few design options", "some takes on this screen", "propose a couple of designs", "explore variants", "convene the design committee", or otherwise wants more than one design candidate. NOT the whole build-UI method — a brand-new surface ("build a new UI", "design a console/screen") is /build-ui, which owns domain modelling, integration and convergence; this skill is only its mock-proposal phase, so use /build-ui when the surface itself is new and this one when the mocks are all you need. NOT the requirements committee (that is build-ui phase 0, persona needs) and NOT the judging jury (that is /jury).
---

# /design-committee — right-size, then run the proposal panel

The method lives in *build-ui.md → 2. Mock before build* (the rung ladder, the blind/distinct-angle rule, the
count-not-model-tier rule) and *jury-refinement-method.md → When to run the full jury* (the judging half).
Don't restate the rubric here; if the method changes, edit those docs. Canonical:
[docs/agent/build-ui.md](../../../docs/agent/build-ui.md).

This skill exists so the right-sizing rules fire **without the operator restating them** every time they ask
for "a couple of options".

> **Runs in a LEASED lane — set it up FIRST (#2123).** Every seat writes a mock file, so the whole panel works
> in an isolated lane clone, never the shared primary checkout (`we:scripts/guard-lane.mjs` denies a primary
> `Edit`). The mocks live in the **product repo** (plateau-app) — WE holds zero implementation (#1282) — so
> lease from **that repo's** pool, hold the lease for the whole panel, and hand it back at the end:
>
> ```
> node we:scripts/lane-pool.mjs acquire --repo=~/workspace/plateau-app --purpose=design-committee --session=<panel-slug> --json   # → {lane, path, …}; seat every agent in .path
> …fan out (step 4) → screenshot → judge → land via PR…
> node we:scripts/lane-pool.mjs release --repo=~/workspace/plateau-app --lane=<lane> --session=<panel-slug>
> ```
>
> Never `status --json` → "pick a clean lane": that takes no lease, so a concurrent drain/conveyor `acquire`
> can reset the lane out from under the seats. A seat that hits the deny takes the lane, **never
> `LANE_GUARD_OFF`**.

## The loop

1. **Right-size first — default to no panel.** Pick a rung from *build-ui.md → 2*: none / one proposer / two /
   more, with a **hard ceiling of four seats**. State **which rung and why** in one line before doing anything
   else.
2. **Ask before climbing.** Any rung above "no panel" needs the operator's explicit **OK** first
   (*build-ui.md → 2*) — never a silent upgrade mid-run. **No operator channel reachable → rung zero**; a
   question nobody could answer never reads as OK.
3. **Rung zero → just author the mock** the *build-ui.md → 2* way and skip to step 5. This is the common exit.
4. **Fan out** one agent per seat — a **distinct assigned angle** each, **blind** to the siblings' work, one
   self-contained mock each per *build-ui.md → 2*. Give every seat **its own output path**
   (`plateau-app:docs/mocks/<surface>-seat-<N>.html` in the leased lane, one seat number per seat) so two
   blind seats cannot write the same file.
5. **Screenshot every candidate, both themes** — *build-ui.md → 3*. The candidates are the PNGs, never the HTML.
6. **Judge on the rendered pixels** — hand the PNGs to `/jury` with `subject: design-pixels` (or, for a fork
   between candidates, the explainer channel in *build-ui.md → 4*). For an **interaction-model** fork, the
   explainer channel needs the operable candidates themselves, driven over the same data — not just their
   PNGs (*build-ui.md → 4*'s interaction-model rule).
7. **Freeze the ruling** into webcases — *build-ui.md → 5*. A ruling that lives only in chat is not ruled.

## Stop rules

- **Never present a candidate you did not render** — *build-ui.md → Honesty clauses*.
- **A blind proposer that peeked is not a second angle.** If a seat read a sibling's mock, report one candidate
  and an edit of it — not spread you don't have.
- **Scale by count, never by dropping model strength.** See *build-ui.md → 2*.
