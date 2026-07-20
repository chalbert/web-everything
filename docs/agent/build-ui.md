# Build-UI — the sighted method for "we have a new UI to build"

> Tier-2 reference. Read before designing or building any non-trivial UI surface (a console, a board, a
> panel, a decision-ruling screen). Codified from the Plateau-Loop backlog-console program (#2505 and its
> children), where this exact sequence produced a design that survived review and became a machine-checkable
> spec instead of dying with the session (#2559, serves G5 — the method + the decision record are durable).

The failure this kills: **building a UI straight into the app, then reviewing it by reading the source.**
That produces a plausible-looking surface nobody looked hard at, a design decision nobody can cite, and
craft that evaporates when the session ends. The fix is a *sighted* pipeline — model the domain, mock it,
review the pixels, rule the forks in the open, and freeze the ruling into durable cases — driven to
convergence by fresh adversarial reviewers.

## The one rule that matters

**Never trust a UI you have not rendered and looked at.** A sub-agent that reads your source scores markup,
not appearance — it cannot see that two states are indistinguishable, that a glyph reads as the wrong thing,
or that dark mode is unreadable. The value of this method is the *sighted* loop: render every state, screenshot
it, and review the image. Source review is not a substitute for looking.

## The method (six phases, in order)

### 1. Model the domain — axes → matrix → the one live-action rule

Before any pixels, enumerate the **axes** of the domain (for the console: actor, edge, primary status,
rendered state, use-case). Cross them into a **matrix** of every real state (the console had 37). Then distill
the **one live-action rule** that governs each state — the single thing the UI must let the operator *do*, or
must show, per cell. The matrix is the spec's skeleton; the live-action rule is what keeps the UI from being a
decorative dashboard. A state with no live-action rule is either dead or mis-modelled — merge or drop it.

### 2. Mock before build — self-contained HTML, real data shapes

Do **not** build in the real app first. Author a **single self-contained HTML file** (inline CSS/JS, no build
step) that renders the matrix from phase 1, populated with **real data shapes** — the actual item/record
fields, not lorem. A throwaway mock is cheap to iterate, has no framework friction, and forces you to confront
the real data early. This is where the design actually happens; the app build (which lives in the impl repo,
never WE — WE holds zero implementation) comes *after* the mock is ruled and frozen.

### 3. Review the pixels, not the source — screenshot matrix × both themes → PNGs to reviewers

Render the mock and **screenshot every cell of the matrix in BOTH light and dark themes** (Playwright). Hand
the **PNGs** to fresh review subagents — they judge the rendered appearance, never the HTML. Score against the
ratified design-critique rubric (see *vision-tiers.md → Design-critique rubric*) — the same 8 closed axes plus
localized findings the `/review-design` skill uses. Both themes are mandatory: a design that works in light and
fails in dark is a failing design, not a passing one with a caveat.

### 4. Decision-explainer artifacts — the ruling channel

When the design has a genuine fork (which glyph family, whether a rule is transient or persistent, one layout
vs another), do **not** decide it inline. Build a **decision-explainer artifact**: the competing options
rendered **side by side in option panes**, an **honest counter-argument** for each (the real case *against* the
one you prefer, not a strawman), and **one recommendation**. That artifact is the ruling channel — the decision
is ruled from a lane against the explainer, never ratified inline (*backlog-workflow.md → Never take an
unprepared decision*), and the ruling is recorded in the design doc so it is cite-able (the console's live at
`plateau-app:docs/backlog-console-design.md`).

**How you rule a high-leverage fork — the jury method.** The explainer artifact is the *channel*. For a fork
that is long-lived and high-fan-out (a whole icon grammar, a colour system), the *technique* for ruling it is
the **jury-refinement loop** (#2576, born on the §6e icon grammar). Run a panel of fresh single-lens jurors
(usability · visual · a11y · design-systems, plus IA/ops for structure calls). Keep every fork the panel splits
on — develop each side through an advocate, never average the disagreement away. Rate each option **1–5**, not
just "pick one"; when the best option scores below threshold, **flag it weak and search for new candidates**
rather than settling. Truth-check the live surface each round (collision / duplicate detection, state-vs-action
distinctness). The jury *proposes*; the human *disposes* — no self-ruling. Gate the full machinery by
blast-radius: the heavy jury for a durable high-fan-out call, a light pass for a one-off. This method owns its
own home (#2576, under the Plateau-Ruler epic #2577) — link to it here, don't duplicate its operational detail.

### 5. Graduate to webcases — durable, cite-able, machine-checkable

A ruling recorded only as prose rots. Port each ruled state into **webcases**: durable fixture files whose
`assert:` line encodes the ruled grammar, hardened by a **conformance test**. The assert line starts as the
**base attention grammar** — the ratified attention-card triple plus the coverage id (the console's
`card-taxonomy.webcases.ts` carries `actor · edge · primary · rendered · uc`). **Ruled visual language — glyph,
motion, colour forks — is additive to that line, not a footnote beside it.** Once a fork is ruled in the design
record, a **dedicated port pass graduates it onto the same `assert:` line** (appending fields like
`glyph`/`motion` alongside the base grammar), so the visual ruling is itself machine-checked — never left as a
prose port-note that drifts. That port was just run for the console taxonomy (#2578). Now the build can *cite* a
state's design by its case id, and drift is caught by the test — the design is a spec, not a memory. This is the
durability payoff (#2559 G5): the method *and* the decision survive the session.

### 6. Converge — alternating-lens fresh reviewers, two clean rounds, every edit assert-verified

Iterate to convergence: spawn **fresh-context reviewers with alternating lenses** (e.g. hierarchy/polish one
round, accessibility/state-distinguishability the next) and keep going until **two consecutive rounds come back
clean**. Fresh context each round is the point — a reviewer who has seen the prior round rationalizes it. And
**every fixture edit is assert-verified**: after each change to a webcase, re-run the conformance test so a
grammar edit can never silently break the spec. One clean round is luck; two in a row from distinct lenses is
convergence.

## The repo hooks this rides on (non-negotiable)

The build-UI work is edit-action work, so it obeys the standard delivery discipline — none of this is optional:

- **Lane → PR, never a direct commit to `main`.** Every edit runs in an isolated lane clone and lands via a
  ready-to-merge PR (*backlog-workflow.md → Working an item*, #2183/#2190/#2123); `guard-lane.mjs` denies a
  primary `Edit`. Set the lane up **first**, before editing.
- **Complete the branch before labeling.** Finish the item — green gate + `resolve` + one commit (stage only
  the files that piece touched) — *then* open the PR and apply `ready-to-merge`. Never label a half-done branch
  (*backlog-workflow.md → The arc per item*).
- **The write-seam.** The `PreToolUse(Edit|Write)` hook (`scripts/lint-locus-prefix.mjs --pre`, #883) scans the
  *proposed* content and denies the write at the seam — a shared gate enforced at write-time, not after. Expect
  it; don't fight it.

## Honesty clauses

- **Rendered-and-looked-at, or it didn't happen.** Never call a state good from its markup. If you have no
  screenshot, you have no review.
- **Both themes or neither.** A one-theme review is half a review; ship the dark-mode failure as a finding, not
  a footnote.
- **The counter-argument must be real.** A decision-explainer whose counter-argument is a strawman is a
  rationalization with extra steps. State the honest case against your own recommendation.
- **WE holds zero implementation.** The UI impl lives in the product repo (plateau-app); WE owns the *method*
  (this doc), the reference model, and the machine-checkable spec — not the app code (memory rule 6, #1282).

## Related

- Worked example: Plateau-Loop backlog console — epic #2505; the mock-before-build seed #2565; the
  graduate-to-webcases port #2578; design record `plateau-app:docs/backlog-console-design.md`.
- Rubric the pixel review scores against: *vision-tiers.md → Design-critique rubric* (#1034), driven by
  `skills-src/review-design`.
- The fork-ruling technique (plugs into phase 4): the jury-refinement method (#2576, parent epic #2577
  "Plateau Ruler") — multi-lens jury, per-option 1–5 ratings, weak-flag→candidate-search, human-gate; how the
  §6e icon grammar was ruled.
- Delivery discipline: *backlog-workflow.md → Working an item* (lane→PR, the arc, the write-seam).
