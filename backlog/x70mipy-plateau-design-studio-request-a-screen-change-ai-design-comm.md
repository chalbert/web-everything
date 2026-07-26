---
kind: epic
shortTitle: "Plateau design-studio product loop"
parent: "2445"
status: open
dateOpened: "2026-07-26"
tags: [plateau-loop, design-studio, product-loop, jury, epic]
---

# Plateau design-studio: request a screen/change -> AI design committee proposes -> ratify with visual diff + trace -> build (as a first-class product loop)

The create/update-UI loop as a first-class Plateau product: a user requests a screen or change in plain language, an AI design committee proposes, the human reviews proposed-vs-current with the visual diff + convergence trace, ratifies (auto/human threshold, shadow-first), and triggers the build via the conveyor. Composes already-built components (design-pixels adapter, jury-core, comparator, disposition judge, jury ledger); the NEW scope is the product surface. Relates to console epics #2527/#2505/#2555; a future /slice candidate.

## The framing (operator, 2026-07-26)

"This process ... is a product for plateau." The way we make UI — someone asks for a NEW screen or a change to an existing one, a multi-agent **design committee** proposes a design, that proposal goes to the human with the **convergence trace** and a **current-vs-proposed visual diff**, the human **ratifies** it (under a configurable auto/human threshold, shadow-first), and then it gets **built** — is not merely an internal agent workflow. It is a first-class **Plateau product capability**. This epic makes that loop a user-facing surface people can drive, not a thing that only happens inside agents.

## Mostly already built — this epic is the surface that composes them, not a rebuild

The heavy machinery of the loop already exists as separate, landed (or in-flight) pieces. This epic does **not** rebuild them; it composes them into one product surface. The pieces:

- **The design committee / jury** — the **design-pixels adapter** (the "design" subject adapter for the jury; resolved [#2657](/backlog/2657-design-pixels-decision-prose-subject-adapters.md)) running on **jury-core**, the subject-agnostic jury engine ([#2649](/backlog/2649-jury-core-subject-agnostic-jury-engine-thin-skill-ratified-f.md)). This is the "committee" that proposes and rates a design.
- **The current-vs-proposed visual diff** — the shared **screenshot comparator** ([#2670](/backlog/2670-screenshot-vs-baseline-visual-comparator-the-shared-primitiv.md)), the jury's **visual lens** (screenshot-vs-target; [#2671](/backlog/2671-give-the-jury-design-pixels-screenshot-vs-target-visual-lens.md)), and **build-time visual self-review** for UI items ([#2672](/backlog/2672-build-time-visual-self-review-for-ui-items-delivery-agent-sc.md)). Together these produce and score the "here is CURRENT, here is PROPOSED, here is the delta" view.
- **The auto/human ratify threshold** — the **disposition judge**: per-lens weights + dissent threshold config ([#2651](/backlog/2651-disposition-config-per-lens-weights-dissent-threshold-on-the.md)) and the judge itself, a red-judge over the jury ledger ([#2652](/backlog/2652-disposition-layer-judge-red-judge-over-the-jury-ledger.md)); plus the **shadow-first auto-land seam** ([#2675](/backlog/2675-auto-land-seam-for-clean-auto-dispositions-defaulting-to-sha.md)) and the **judge-wiring** into the review/land path ([#2674](/backlog/2674-wire-the-disposition-judge-into-the-review-land-path-jury-ve.md)). This is what decides "small + converged → auto-approve" vs "escalate to a human", shadow-first so confidence is earned before auto acts.
- **The convergence trace** — the **jury ledger** surfaced live ([#2641](/backlog/2641-jury-ledger-surfaced-live-to-the-conveyor-as-the-single-sour.md)): the single source of truth for votes, ratings, rounds, and how the committee converged. This is the "trace" the human reads to trust (or challenge) a proposal.
- **Surface only real contention** — the **micro-decision surfacing / challenge loop** ([#2650](/backlog/2650-micro-decision-surfacing-challenge-loop.md)): only genuine disagreement is raised to the human, not every internal wobble.

## What is NEW (this epic's actual scope)

The **Plateau product surface** that composes the pieces above into an end-to-end, user-drivable create/update-UI loop. A user can:

1. **Request** a screen or a change **in plain language** — the intake that turns "I want a screen that ..." / "change X on this screen" into a design brief the committee runs on.
2. **Watch / kick off the design committee** — start the committee run and follow it live.
3. **Review the proposal** — see the **PROPOSED design vs CURRENT** with the visual diff, alongside the committee's **trace** (votes / ratings / how it converged).
4. **Ratify** — **auto-approve** small, converged changes once confidence is built; **human-approve** everything else. The auto/human line is the configurable threshold, shadow-first.
5. **Trigger the build** — hand the ratified design to the **conveyor** to build it.

That is the new work: the request-intake surface, the live committee/trace view, the proposed-vs-current review surface, and the ratify → build trigger. It **closes the create/update-UI loop as a product**, rather than as an agent-only internal flow.

## Dogfood note (recursion)

The **feature-tracker screen** design-committee run on 2026-07-26 is the first ad-hoc instance of exactly this loop — a screen designed by the committee, reviewed, and built by hand today. The eventual product surface would **design its own screens through the same committee**: the design-studio uses the design-studio. That recursion is the strongest dogfood we have and the clearest proof the loop is a product, not a one-off.

## Relation to the console-program epics

This is a **sibling product loop** under the Plateau Loop coordinator (#2445), alongside:

- **[#2527](/backlog/2527-plateau-loop-autonomous-ai-build-queue.md)** — the autonomous AI **build queue** (prioritize → build ready items). The design-studio's ratify → build step **feeds** this: a ratified design becomes queued build work.
- **[#2505](/backlog/2505-plateau-loop-operable-backlog-console-built-fresh-in-plateau.md)** — the operable **backlog console** (browse/operate a repo's work). The design-studio is a **producer of** backlog work (a request becomes items to build) that this console then operates.
- **[#2555](/backlog/2555-real-launch-review-console-board.md)** — the **launch-review console board** (the human intervention surface for launches). The design-studio's proposed-vs-current + trace review is the **design-time analogue** of that board's build-time review; the two share the review/ratify idiom (trace + diff + human verdict).

## Likely slices (kept unsliced for now — a future /slice candidate)

Left as an **unsliced epic** deliberately; when scheduled it likely slices into roughly:

- **Request-intake surface** — plain-language "new screen / change this screen" → design brief.
- **Committee-run + trace view** — kick off / watch the committee; render the jury ledger convergence trace live.
- **Proposed-vs-current review surface** — the visual diff (current vs proposed) plus votes/ratings.
- **Ratify → build trigger** — the auto/human threshold control (shadow-first) and the hand-off to the conveyor.

Rule the slice boundaries at /slice time; this epic stays a single open umbrella until then.
