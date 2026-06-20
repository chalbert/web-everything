# Backlog split analysis — 2026-06-20 (focused: #1243)

`/split 1243` — single-item run. Candidate: **#1243 — Reproduce shadcn/ui as theme+intents over
WE/FUI — first parity target, gap list** (`kind: story`, `size: 13`, `parent: 1226` → oversized-story
candidate, the *should-split* band). The body itself flags "Likely needs /split into per-component
build slices once the harness is wired" — this run tests whether that harness is wired *enough* to draw
those per-component seams now.

## Verdict: **could not split** — the reproduction surface does not exist yet (rubric 3 / investigation step 3)

The per-component slices the body anticipates ("button, input, card, dialog, …") cannot be drawn yet
because **none of the reproduction surface exists in the tree to cite them against**, and #1243 is
itself the foundational slice that creates it. This is the textbook *land-foundational-slice-A-first*
outcome, not a refusal-of-principle.

### What the investigation found

The validator/oracle chain the body names (#1167/#1219/#1220/#1221/#1176) is **built and resolved** —
the explorer engine, Layer-1 invariants, Layer-2 conformance-vector oracle, and Layer-3 advisory VLM
judge all live in [fui:tools/explorer/](../../frontierui/tools/explorer/) +
[fui:tools/explorer/oracles/](../../frontierui/tools/explorer/oracles/). The thin parity **contract**
WE consumes is also defined and resolved (#1227 →
[we:reproduction-parity/contract.ts](../reproduction-parity/contract.ts),
`ReproductionTarget` / `LayeredOracleReading` / `ReproductionVerdict` / `GapDelta` /
`ReproductionParityReport`).

But the things #1243 must *build* are all absent:

- **No shadcn-token webtheme scheme.** [we:webtheme/schemes.ts](../webtheme/schemes.ts) /
  [we:webtheme/defaultTokens.ts](../webtheme/defaultTokens.ts) hold the accent/contrast runtime and
  platform defaults — there is no shadcn palette/token layer (`grep -ril shadcn` over `src/`/`demos/`
  hits only research-description njk + benchmark JSON, never a theme or a reproduction page).
- **No reproduction scaffold.** There is no page/demo that renders WE intents over FUI primitives
  styled as shadcn, and nothing that drives it through the parity loop and ingests a
  `ReproductionVerdict`.
- **No external-reference parity oracle.** The existing oracle legs measure FUI components against
  *their own* #899 conformance vectors. There is **no fuzzy-pixel + structural-diff leg that compares a
  WE-rendered component against an incumbent shadcn reference** — the very measurement #1243's parity
  claims gate on. (Per #1226 Fork 1 + #1227, that judge runtime is a *Plateau-side* co-evolving service
  WE ingests outputs from, so it is correctly out of WE scope — but it also means the per-component
  loop cannot be exercised, and therefore cannot be seam-cited, until both the scaffold and that judge
  co-evolve far enough to produce one verdict.)

### Which rubric condition failed

- **(3) Slices land small, with named file paths grounded in the investigation** — **FAILS.** The
  per-component reproduction slices have no file to point at (`file:line`-citable); the reproduction
  surface is net-new and unbuilt. Proposing "reproduce the button (size 2)", "reproduce the dialog
  (size 3)" now would be authoring slices *straight from the body* — exactly the guess-the-seams
  failure the work-investigation pass forbids. The component count, which intents map cleanly, and where
  the gaps fall are all **unknown until the harness phase runs** (and discovering them *is* the
  deliverable — the GAP LIST).
- **Work-investigation pass, step 3** — the surface doesn't exist yet; scope is genuinely unknown until
  the foundational piece (shadcn theme + reproduction scaffold + parity wiring, proving the loop on a
  seed component or two) lands. That is a *result*, not a blocker to wave past.

Rubric (1) is **clean** — no buried decision: the measurement approach is settled by the #1225 charter
(ratified, codified `we:docs/agent/platform-decisions.md#reproduction-conformance`) and the #1227
contract; the co-evolving-dependency stance is #1226 Fork 1. So #1243 is *volume*, not an unresolved
fork — it is simply pre-investigable volume.

## Could-split

*(none this run)*

## Could-not-split

| #NNN | Title | Rubric condition failed | Unblocking action |
|---|---|---|---|
| **#1243** | Reproduce shadcn/ui as theme+intents over WE/FUI — first parity target, gap list | **(3)** per-component slices not `file:line`-groundable — reproduction surface is unbuilt (investigation step 3: surface doesn't exist yet) | **Land #1243's foundational harness phase first** as its own coherent deliverable — the shadcn-token webtheme scheme + a reproduction scaffold (WE intents over FUI primitives) + the wiring to the #1227 `ReproductionVerdict`/`GapDelta` contract, reproducing a **seed set (~2–3 leaf components)** to prove the loop and emit a first gap delta. Its artifact then exposes the real per-component seams (component list, intent-map cleanliness, gap clusters) for a **future `/split`** into per-component build slices. |

### Outcome (applied 2026-06-20)

No split (no new slices, no story→epic conversion). Instead the could-not-split verdict is **recorded on
the item** via the new **`unsplittableReason: foundational`** field (the story-side mirror of an epic's
`childlessReason`, shipped this session). That clears the deterministic **split** flag — #1243 keeps its
honest `size: 13` but the board shows a muted **"atomic · foundational first"** pill instead of the
orange **split** badge, so it stops re-flagging as a `/split` candidate while staying real buildable
work. (Earlier draft recommended re-sizing `13 → 8` to dodge the scan — superseded; shrinking the number
would have been dishonest. The field is the right tool.)

#1243 stays a `story` under #1226. **Re-run `/split 1243`** after the harness-and-seed phase ships to
carve the per-component slices against the then-real surface.
