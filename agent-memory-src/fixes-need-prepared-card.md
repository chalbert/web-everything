---
name: fixes-need-prepared-card
description: Every fix, including urgent daemon fixes and blockers, starts from a filed+prepared card (scope, risks, test plan, tasks, proof plan) reviewed before any code — never a bespoke ad-hoc dispatch prompt.
metadata:
  type: feedback
---

Every fix — including an urgent daemon fix or a blocker — starts from a card filed via `file-item`, never
from a hand-composed dispatch prompt. The card carries `scope`, risks, a test plan, tasks, and a proof plan
(the before/after evidence a fix must show, per [[failure-is-a-product-improvement]]). A short **prepare**
step then writes the actual plan onto that card, and a **light review** checks the prepared plan — for
conflicts with open PRs and registered daemon overlays, and for gaps — before any code is written. Dispatch
then runs on the card **+ the generic brief**, never a bespoke orchestrator prompt improvised for that one
fix (the same discipline `file-item`'s own header names for filing, and mechanical-delivery-doctrine's rule 2
names for build dispatch — this extends both to the *fix* path specifically).

A blocker gets a **faster lane** — a tighter time box on prepare/review/build — not a *skipped* one. A truly
hand-done emergency fix stays explicitly labelled as an emergency, and still gets its card filed **after**,
so the instance stays visible rather than silently absorbed.

**Why:** on 2026-09-27 the orchestrator had been briefing fix workers with ad-hoc prompts, skipping
Definition of Ready entirely. The cost showed up live, not hypothetically: a worker hit a real design fork
mid-build and had to defer it to a card it should have had going in; an overlay conflict with another
registered daemon surfaced only at the very end instead of at review; the brief itself was revised twice
mid-flight because it hadn't been thought through once, up front; and one worker spent 35 of its 47 minutes
on roughly 290 small model turns — thrash a prepared plan would have priced in before dispatch. The operator
had separately observed that stories prepared with design + analysis upfront build much more efficiently
than ones that aren't.

**How to apply:** don't dispatch a fix worker from a custom prompt. File the card, run the prepare step onto
it, get the light review, and only then dispatch on the card + the generic brief. Adopted as a **trial** —
collect prepared-vs-unprepared stats (time, tokens/turns, rework rounds, grade) rather than assuming the
win; see the `run-rating` comparison work this motivated. Related: [[39-feedback_never_take_unprepared_decision]]
(never take a decision without a `preparedDate` — the same DoR-before-action shape, for calls rather than
fixes), [[story-preparation-checklist]] (what a prepared card must carry), and rule 149 (Operation Limit
Fixed On The Prototype — a limitation gets fixed in the system, never worked around by hand in private
notes; the same "fix the mechanism, don't route around it" instinct applied to dispatch here).
