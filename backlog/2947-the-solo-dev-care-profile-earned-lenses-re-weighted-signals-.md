---
bornAs: x0q5anw
kind: story
size: 5
parent: "2948"
status: open
dateOpened: "2026-08-06"
tags: []
---

# The solo-dev care profile: earned lenses, re-weighted signals, one juror

Ship the first named review profile as contract data: lenses earned by what the diff touches instead of a static four-lens fan-out, blast-radius re-weighted so plain internal machinery sits at low care, and one juror per lens at every band. Cuts the default panel from four seats to one or two without changing any routing or clearance rule.

## The three changes

**1. Lenses are earned, not static.** Today every band fans out all four of `PANEL_LENSES`. Move two of them onto the touch-set mechanism that already exists (`classifyTouchSet` + `attachedBy: 'touch-set'`, we:scripts/lib/review-core.mjs):

| lens | when it sits |
|---|---|
| `correctness` | always — the one lens with no deterministic backstop |
| `standards-conformance` | only when the diff touches the standards definitions, their conformance demos/fixtures, or a Frontier UI implementation of one. `check:standards` already covers the mechanical half everywhere else |
| `security` | only when the diff touches auth, secrets, network, `exec`, user input, or a published surface. Advisory, not mandatory |
| `simplicity` | advisory, recharter to *"is this more complex than the problem itself requires?"* — never a blocker |

**2. The mandatory pair varies by layer.** Not by file sensitivity, but by who else is affected:

- **standards defs** → `correctness` + `standards-conformance` mandatory. A published contract with two repos downstream, expensive to walk back.
- **internal machinery** → `correctness` only. Nothing downstream depends on the shape, and a mistake surfaces within a day.

`PR_DIFF_ADAPTER.mandatoryLenses` becomes a function of the touch set rather than the frozen `MANDATORY_LENSES` constant. `derivePanelVerdict` already guards the empty-mandatory-set vacuous-accept trap, so the dynamic set stays safe.

**3. Re-weight and re-dial.** `CARE_WEIGHTS.blastRadius` 3 → 1, so a plain internal-machinery PR lands at `low` instead of making `elevated` the floor; the standards-def touch is what earns the extra care and the extra lens. `jurorsPerLens` drops to 1 at `high` — two same-model jurors double the cost and share the blind spot, so a high band should buy *more lenses and better grounding* instead (see the epic's open question).

## Shipping it as a profile

Add `careJury.profiles` to we:scripts/lib/review-policy.contract.json with a `solo-dev` entry and an `activeProfile` selector; a profile's bands narrow the default bands the same way a per-band `disposition` narrows the global default. That keeps the change reversible (flip `activeProfile` back), keeps every value in the one human-gated file, and is the shape the eventual per-project / per-team configurability needs — more profiles against the same schema, not new constants.

## Build

- we:scripts/lib/review-policy.contract.json — `careJury.profiles.solo-dev` (bands + lens triggers + mandatory-by-layer table), `careJury.activeProfile`
- we:scripts/lib/review-policy.mjs — validate the profile shape, resolve `activeProfile` through the existing precedence, export the resolved bands
- we:scripts/lib/review-escalation.mjs — `CARE_WEIGHTS.blastRadius` 3 → 1; split the published-surface signal from the internal-machinery one
- we:scripts/lib/review-core.mjs — extend `classifyTouchSet` with the layer classification; make `PR_DIFF_ADAPTER.mandatoryLenses` touch-set-derived
- we:scripts/lib/jury-core.mjs — `panelRigorForCareLevel` reads its bands from the resolved profile instead of the inline `rigorByLevel` literal
- we:scripts/lib/__tests__/ — extend the existing `review-policy.conformance` suite

## Acceptance

1. **Executable** — a vitest case asserting that for an internal-machinery changed-file set (we:scripts/lib/lane-drain.mjs), the resolved roster is exactly `[correctness]`, `jurorsPerLens: 1`, `roundCap: 1`, and `mandatoryLenses` is `['correctness']`.
2. **Executable** — a vitest case asserting that for a standards-def changed-file set (we:src/_data/blocks.json), the roster carries `standards-conformance` and `mandatoryLenses` is `['correctness', 'standards-conformance']`.
3. **Executable** — the existing `review-policy.conformance` suite stays green, proving the contract table and `deriveReviewDisposition` still agree over the full input space (routing is unchanged by this slice).
4. **Executable** — `npm run check:standards` green.
5. **Observable** — flipping `careJury.activeProfile` off `solo-dev` restores the current four-lens roster, proving the change is one reversible value rather than a rewrite.
