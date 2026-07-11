# Backlog split analysis — 2026-07-11

Focused run: `/slice 2410`.

## Candidate

- **#2410** — *Unified drain convergence loop — peer co-negotiation + independent hardened validator (option B)*
  · `kind: epic` · carries a stray `size: 13` (mis-converted — an epic holds no points; must drop on split) ·
  no item references it as `parent` → **unsliced epic** (candidate kind **b**). Body ships a
  "Slices (to cut when picked up)" section with 4 named slices. Graduated from decision **#2398** (resolved).

Because it's an unsliced epic, rubric condition (1) (*split-at-all?*) is settled at the parent level. Each
slice is still verified against the real tree and against (1)-within-slice (no buried fork), (2)-(5).

## Work-investigation pass — where the seams actually fall

The loop is split across **pure reducers** (`we:scripts/lib/review-core.mjs`) and the **label/merge gate**
(`we:scripts/lib/review-escalation.mjs`, `we:scripts/merge-ai-prs.mjs`, `we:scripts/lib/pr-merge-gate.mjs`).
The JUDGEMENT half (spawning subagents) is driven by the drain skill, not a script. Grounding:

- **Negotiation reducers** — `we:scripts/lib/review-core.mjs`: `deriveNegotiationOutcome`
  (`we:scripts/lib/review-core.mjs:210`), `buildEditorMandate` (:170), `buildMandate` (:131),
  `NEGOTIATION_ROUND_CAP` (:157).
- **Panel machinery already exists** — `buildPanelMandate` (:358), `derivePanelVerdict` (:404),
  `PANEL_LENSES` (:348), `MANDATORY_LENSES` (:341). Slice 2 extends this, doesn't build from scratch.
- **Acceptance-label vocabulary** — `we:scripts/lib/review-escalation.mjs:20` (`review:accepted`); the merge
  gate that consumes it lives at `we:scripts/merge-ai-prs.mjs:1243-1261`. Slice 2 adds a `redteam:accepted`
  producer here; **enforcement** (require-the-label, kill the merge-anyway escape) is owned by the separate
  gate-integrity story **#2412** (open) + delivered-by-removal in **#2425** (resolved) — *not* this epic.
- **CI-green / test-red strand** — `we:scripts/lane-resume.mjs:81` (`disposition: 'test-red'`); slice 4 folds
  the green check into `deriveNegotiationOutcome`'s land condition and retires this strand.
- **Flag parsing pattern** — `we:scripts/lane-drain.mjs:69-76`; slice 4 adds the off-by-default convergence flag here.

All four slices' named files are `file:line`-citable. Verdict: **could split** (all 4 carve).

## Could split

| # | Slice | kind / size | Scope (grounded) | blockedBy |
|---|-------|-------------|------------------|-----------|
| A | Approach handshake — plan-agree before diff | story / 3 | Add a pre-diff plan-handshake reducer + mandate alongside `buildEditorMandate`/`deriveNegotiationOutcome` in `we:scripts/lib/review-core.mjs`; the two peers agree the fix approach before any code, so rounds aren't burned on wrong-target fixes. Fixture-driven reducer test. | — (root) |
| B | Independent hardened validator + `redteam:accepted` producer | story / 5 | Distinct fresh-context adversarial validator over the final diff (diff+tests+rubric only, never the peers' self-assessment); extends the existing panel reducers (`buildPanelMandate`/`derivePanelVerdict`) into a diverse jury; persists a deterministic `redteam:accepted` label (new vocab entry in `we:scripts/lib/review-escalation.mjs`, per #2281's total label fn). **Produces** the label; enforcement stays with #2412. This is where the non-author-accepts invariant lives. | — (root) |
| C | Anti-test-gaming gates on the CI-green clause | story / 5 | Deterministic gates: fail the land if coverage drops or tests are removed/skipped; require a test that fails on pre-change behavior for logic fixes; diff-gate author-peer test edits; validator inspects for tampering. Lands in `we:scripts/lib/pr-merge-gate.mjs` + the `we:scripts/merge-ai-prs.mjs` gate + a validator-mandate clause in `we:scripts/lib/review-core.mjs`. | B |
| D | CI-green land clause + off-by-default flag | story / 3 | Fold "required `test` green" into `deriveNegotiationOutcome`'s land condition and retire the `lane-resume` `test-red` strand (`we:scripts/lane-resume.mjs:81`); wire the whole loop behind an off-by-default flag (`we:scripts/lane-drain.mjs` flag parsing), scoped to small/non-security diffs first. The capstone that turns the loop on. | A, B, C |

**DAG:** `A → D`, `B → C → D`. Two independent roots (**A** and **B**) → satisfies "≥2 proceed
independently." D is the capstone gathering all three. Because the live loop only switches on at **D** (the
flag), slices A/B/C each add a self-contained, fixture-tested unit while the drain's behavior on `main` stays
unchanged (flag off) — no broken intermediate state.

**Batchable:** A and B immediately (both roots, size ≤ 5). C unblocks when B lands; D when A+B+C land.

**Note on slice B's "panel/jury (different model)":** framed in the body as a *stronger form* of the base
distinct validator, not an unresolved fork — the base validator ships the slice, the jury is an enhancement
depth. The build decision (#2398, option B) is already ratified, so no decision is buried here.

## Could not split

None. All four body slices carve cleanly.

## Net effect if approved

`#2410` stays an epic (kind b — no story→epic conversion), drops its stray `size: 13`, and gains 4 child
slices (A, B, C, D) with the DAG above. `+4` items opened. Then `/batch` can burn down A + B.
