# Jury-Refinement Method — how to rule a high-leverage fork

> Tier-2 reference. Read before ruling a **long-lived, high-fan-out** design or decision fork — a whole
> icon grammar, a colour system, a taxonomy, a layout language, an architectural cut. This is the
> **method's home** (#2576, under the Plateau-Ruler epic #2577): the reusable template proven on the
> console icon grammar. [build-ui.md](build-ui.md) phase 4 plugs it into the UI build; the executable
> derivation lives once in the **jury engine** (`scripts/lib/jury-core.mjs`, epic #2649) and you run it
> through the **`/jury`** front door — this doc is the *why and how*, not a second copy of the code.

A fork ruled inline from one head evaporates when the session ends and carries that head's blind spots. The
fix is a **jury**: a panel of fresh, single-lens reviewers that *proposes* a ruling, an adversarial pass that
tries to *break* it, and a human who *disposes*. The panel never averages disagreement away and never
self-ratifies. The output is a cite-able ruling with a per-option ledger — not a vote tally.

## When to run the full jury — gate by blast-radius, not by default

The full machinery is **care-level-keyed**, not run on everything (`#blast-radius-advisory-care-not-a-gate`).
Blast-radius is an **advisory care signal** that dials the rigor up — it is *not* a hard gate that blocks a
land:

- **Heavy jury** — a durable, high-fan-out call (a grammar every future card inherits, a token system, a
  contract). More jurors per lens, more rounds, the red-team is mandatory.
- **Light pass** — a one-off with a small blast radius. A single reviewer per lens, one round; skip the
  candidate-search unless the best option flags weak.

The care→rigor mapping (how many jurors per lens each band earns) is a pure derivation in the engine
(`panelRigorForCareLevel` in `scripts/lib/jury-core.mjs`) — you pick the care-level; the engine sizes the
panel. Don't hand-tune the roster.

## The loop — the seven moves

### 1. Convene a fresh single-lens panel

Spawn reviewers each carrying **one** lens, in **fresh context** — a reviewer who has seen the prior round
rationalizes it. The standing design lenses are **usability · visual · a11y · design-systems**, plus
**IA/ops** for a structure call (is-this-a-state-or-an-action, where-does-this-live). Which lenses a subject
*earns* is derived by its adapter from the touch-set; the care band adds its static lenses. One lens per
juror keeps each verdict legible — a single head juggling five lenses blurs them into one averaged opinion.

### 2. Expose the forks — never average disagreement away

When the panel splits, **keep the split**. Do not collapse a 3–2 into "the majority preferred A." Develop
**each** side through an **advocate** — the honest case *for* that option, not a strawman — and carry both
forward as live forks. Disagreement is signal about a real trade-off; averaging it destroys the signal and
launders a close call into false consensus.

### 3. Rate every option 1–5 — don't just pick

Each juror scores **every** option on a **1–5** scale, not "which one wins." A single pick hides *how much*
better the winner is and hides an option that is everyone's strong second choice. Ratings surface the shape of
the field: a 4.5-vs-4.4 is a coin-flip to record as such; a 4.5-vs-2.1 is a real ruling.

### 4. Weak-flag and search when the best option is below threshold

If the **top-rated** option still scores below the acceptance threshold, **flag it weak and search for new
candidates** rather than settling for the least-bad of a poor field. **Keep the old options** in the running —
a new candidate competes against them, it doesn't replace them. Settling on a weak winner because it was the
best of what you happened to enumerate is the failure this step exists to catch.

### 5. Truth-check the live surface each round

Re-run the **deterministic** checks against the *current* picks every round — the panel judges taste, the
truth-check judges facts:

- **Collision / duplicate detection** synced to the current selections (two states must not resolve to the
  same glyph/colour/label).
- **State-vs-action distinctness** — a thing that *is* a status must not read like a thing you *do*.

These are machine facts, not opinions; they belong in code, not in a juror's head, and they re-check as the
picks move.

### 6. Red-team a positive verdict before ratifying it — fail closed

A jury `accept` is a **proposal, not a land** (#2707). Before a positive verdict ratifies, one **adversarial
red-team** pass assumes the accept is *wrong* and hunts the reason it should not ship:

- A red-team that runs clean **ratifies** the accept.
- A red-team that finds a blocking issue **bounces** it (folded into another round; the round cap still bounds
  the negotiation).
- A red-team that **does not run degrades to `needs-human`** — fail-closed. Every stage that produces no
  signal (a resolve that didn't run, a mandatory lens whose whole jury failed, an editor fold that produced
  nothing, an unrun red-team) is read as a *failing* signal, never a silent land. This is the guard against a
  foreman **fabricating** a verdict over a jury that produced no real signal.

### 7. Human-gate — the jury proposes, the human disposes

The jury **judges**; it never **acts**. It returns a verdict + a ledger and applies no label, posts no
comment, merges nothing. The ruling is taken by a human against the panel's proposal — point-level where the
surface supports it (a specific line/point, plain-language, with **ratify / fork / challenge**), never a
blanket "escalate the whole thing" (`#blast-radius-advisory-care-not-a-gate`, Fork 2). No self-ruling: an
agent panel that ratified its own accept would just be consensus wearing a review's clothes
(`#agent-convergence-independent-validation`).

## The guardrails — these ARE the method, not optional polish

- **Justify the specific difference.** Force each juror to name *why this option differs from that one* to
  break **phantom unanimity** — the 4–0 "everyone agrees" that became 2–2 once the panel was made to defend
  the specific A14 dot. Unexamined agreement is the most expensive kind.
- **Rate, don't just pick** (move 3) — a bare pick hides the margin.
- **Refute-style prompts.** Frame the juror's job as *find the reason to reject*, not *say if it's fine*.
  Sycophancy ratifies; an adversarial framing surfaces the real objection.
- **Diversity-selection, never a majority vote.** A split verdict reduces by **diversity-selection**, not by
  counting heads (`#blast-radius-advisory-care-not-a-gate`, Fork 2; the engine's `derivePanelVerdict`). A
  diverse AI panel does *not* decorrelate — LLMs share failure modes — so a numeric majority launders a shared
  blind spot into a "consensus." A non-zero **decorrelated human axis** must remain (the human gate, move 7).
- **Fail closed on missing signal** (move 6) — no stage that returned empty is ever read as accept.
- **Gate by care-level** — heavy for the durable high-fan-out call, light for the one-off. Over-running the
  full jury on trivia makes it the bottleneck it exists to remove.

## Run it — the engine and the front door

The method is codified **once** in the engine; the skill is a thin shell that invokes it and renders the
result — it owns **no** jury logic (epic #2649):

- **Engine (the single source):** [`scripts/lib/jury-core.mjs`](../../scripts/lib/jury-core.mjs) —
  `resolveAdapterRoster`, `materializeRoster`, `derivePanelVerdict`, `panelRigorForCareLevel`, `redTeamRequired`
  / `foldRedTeamVerdict`, the ledger event schema. Nothing re-derives any of this elsewhere.
- **Front door:** the **`/jury`** skill — run the jury on one subject (`pr-diff` | `design-pixels` |
  `decision-prose`) at a care-level. It resolves the roster, fans out one juror per seat, reduces to a
  verdict, red-teams a positive result, and returns the verdict + ledger.
- **Subject adapters** (the only per-domain code) frame each lens's mandate for the subject — a code diff, a
  rendered design, or a decision approach in prose.

Run the jury when you need the *verdict*; use this doc when you need to understand *why each move is there* or
to rule a fork by hand where no adapter fits yet.

## Where it plugs in

- **UI builds** — the fork-ruling technique of [build-ui.md](build-ui.md) phase 4. The decision-explainer
  artifact is the *channel*; this jury is the *technique* for ruling what the artifact frames.
- **The decision-ruling console** (epics #2577 / #2494 / #2555) — the point-level human-gate surface (move 7)
  is the same build as the codified-ruling console, not a duplicate.
- **Agent-fix convergence** — the drain's independent-validator bar
  (`#agent-convergence-independent-validation`) is the same "a landed change is accepted by a distinct fresh
  validator, red-teamed, fail-closed" shape applied to a code diff.

## Lineage

Born on the §6e console icon grammar (artifact `66248282`, under the backlog-console epic #2505) — the run where forcing
"justify the specific difference" turned a phantom 4–0 into a real 2–2 on the A14 dot. Supersedes the earlier
method candidate #2565. Generalized into the subject-agnostic engine + adapters under epic #2649 (ratified
F1/F2/F3 from the jury-of-#2576 decision record), with the mandatory post-jury red-team + fail-closed posture
added by #2707. Statute: [`#blast-radius-advisory-care-not-a-gate`](platform-decisions.md#blast-radius-advisory-care-not-a-gate)
(care-is-advisory, diversity-selection, point-level human check) and
[`#agent-convergence-independent-validation`](platform-decisions.md#agent-convergence-independent-validation)
(peer-agreement is not validation). Parent epic: #2577 (Plateau Ruler).
