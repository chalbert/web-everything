---
name: design-committee
description: Right-size and run a design proposal panel — several agents each proposing a mock, blind to each other, then judged on rendered pixels. STARTS BY ASKING whether a panel is warranted at all; "no panel, just author it" is the most common answer. Use when the user asks for "a few design options", "some takes on this screen", "propose a couple of designs", "explore variants", "convene the design committee", or otherwise wants more than one design candidate. NOT the requirements committee (that is build-ui phase 0, persona needs) and NOT the judging jury (that is /jury).
---

# /design-committee — right-size, then run the proposal panel

The method lives in *build-ui.md → 2. Mock before build* (the rung ladder, the blind/distinct-angle rule, the
count-not-model-tier rule) and *jury-refinement-method.md → When to run the full jury* (the judging half).
Don't restate the rubric here; if the method changes, edit those docs. Canonical:
[docs/agent/build-ui.md](../../../docs/agent/build-ui.md).

This skill exists so the right-sizing rules fire **without the operator restating them** every time they ask
for "a couple of options".

## The loop

1. **Right-size first — default to no panel.** Pick a rung from *build-ui.md → 2*: none / one proposer / two /
   more. State **which rung and why** in one line before doing anything else. A tweak, a single component, or
   an already-obvious call is rung zero.
2. **Ask before climbing.** Any rung above "no panel" spends the operator's budget — get their **OK** first.
   Never silently upgrade mid-run either.
3. **Rung zero → just author the mock** the *build-ui.md → 2* way and skip to step 6. This is the common exit.
4. **Fan out** one agent per seat, each with a **distinct assigned angle** and **blind** to the siblings' work,
   each producing a self-contained mock per *build-ui.md → 2*.
5. **Screenshot every candidate, both themes** — *build-ui.md → 3*. The candidates are the PNGs, never the HTML.
6. **Judge on the rendered pixels** — hand the PNGs to `/jury` with `subject: design-pixels` (or, for a fork
   between candidates, the explainer channel in *build-ui.md → 4*).
7. **Freeze the ruling** into webcases — *build-ui.md → 5*. A ruling that lives only in chat is not ruled.

## Stop rules

- **Never present a candidate you did not render.** A fork ruled against a described-but-unbuilt option was
  imagined, not ruled (*build-ui.md → Honesty clauses*).
- **A blind proposer that peeked is not a second angle.** If an agent read a sibling's mock, you have one
  candidate and an edit of it — say so rather than reporting spread you don't have.
- **Scale by count, never by dropping model strength.** See *build-ui.md → 2*.
