---
kind: story
size: 8
status: open
scope: ["we:scripts/operations/review-pr.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/lib/model-probation.mjs", "we:scripts/operations/review-extra-seats.mjs", "we:scripts/gemini-direct-task.mjs", "we:scripts/conveyor/log-delegation-trial.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Route review seats by risk to Antigravity-Claude (Sonnet 4.6 / Opus 4.6), on probation with native-Claude spot checks

we:scripts/operations/review-pr.mjs's two MANDATORY seats (judge=correctness, judgeSecurity=security) spawn as native Claude judges today with no provider field — hardcoded, not caller-negotiable — while every existing non-Claude seat (Codex/Antigravity) is deliberately kept advisory-only, so every PR pays >=2 native-Claude mandatory seats regardless of care level; most PRs today are backlog/docs-only card PRs paying that same cost, and Claude tokens are the binding constraint (Codex out until Oct 3). This card routes the MANDATORY seats themselves by the care level we:scripts/operations/review-pr.mjs already derives (we:scripts/review-core-cli.mjs's buildShapePlan/careLevel): none/low -> agy-claude Sonnet 4.6, elevated -> agy-claude Opus 4.6 (we:scripts/lib/provider-routing.mjs's AGY_CLAUDE_MODEL_BY_TIER, already pinned), high -> unchanged native Claude. Recorded as probation trials of a new we:scripts/lib/model-probation.mjs role (mandatory-review, deliberately NOT in NEVER_BLOCKING_ROLES, per #model-probation-graduation-criteria clause 3's already-anticipated 'future blocking/gating reviewer role'), with a 1-in-5 native-Claude spot check comparing verdicts; disagreements are informative trials, promotion stays a human decision. MVP cut: low care-level only, Sonnet 4.6, spot check + trial recording; elevated/Opus and real allowance-gate fallback are follow-up slices.

**Lineage note:** conceptually a "model routing + probation" dimension instance of the
policy-as-configurable-dimensions epic (`xv0h3mp`, `#4305`) — no `parent:` frontmatter link is set because
`xv0h3mp` lives only on `origin/lane/cost-capture-and-policy-design` and does not yet resolve to an item on
`main`; wire the `parent:` field once that epic lands, rather than filing a card whose parent link is
currently unresolvable.

## Design

**Where the mandatory seats stand today.** `we:scripts/operations/review-pr.mjs`'s two `MANDATORY_LENSES`
seats (`judge` → `correctness`, `judgeSecurity` → `security`) are built with no `provider` field at all — every
OTHER seat in the same `reduce` (`judgeAdvisory`/`judgeCorrectnessAdvisory` → `codex`/`codex, advisory`;
`judgeAntigravityReview` → `antigravity, advisory`) carries one, and the file's own comments say the mandatory
pair is "not caller-negotiable" by design: a `changes` verdict from any added seat must never flip the whole
panel, so every added seat (Codex, and the existing Antigravity fifth seat at `gemini-3.1-pro` via
`we:scripts/lib/antigravity-judge-spawn.mjs`'s `ANTIGRAVITY_MODEL`) is deliberately kept OUT of
`MANDATORY_LENSES`/`PANEL_LENSES`. The care-level dial (`we:scripts/review-core-cli.mjs`'s `buildShapePlan`,
reading `we:scripts/lib/review-escalation.mjs`'s `CARE_LEVELS`) today only scales the ADVISORY panel's rigor —
the two mandatory seats run unconditionally regardless of care level. So a backlog-only, docs-only card PR pays
the exact same 2 native-Claude mandatory seats as a daemon/security change. Today's own evidence: most PRs
filed this session were backlog/docs-only card PRs, each paying that same >=2-native-Claude-seat cost, while
Claude tokens are the binding constraint and Codex is out of allowance until Oct 3.

**Why this needs a genuinely new probation role, not a reuse of an existing one.**
`we:scripts/lib/model-probation.mjs` today tracks exactly two roles — `PROBATION_ROLES = ['delivery',
'advisory-review']` — and `NEVER_BLOCKING_ROLES = ['advisory-review']` asserts that role can structurally never
gate a merge, whatever its status (`assertRoleNeverBlocks`). Neither existing role fits what this card asks
for: `advisory-review` is defined to never gate, and `delivery` means code-authoring dispatch, not staffing a
review judge seat. This is not an oversight to route around — `#model-probation-graduation-criteria`
(`we:docs/agent/platform-decisions.md#model-probation-graduation-criteria`, `#3654`) clause 3 already
anticipates exactly this: "any future blocking/gating reviewer role would earn the strictest bar, should one
come to exist." This card is that role coming to exist, under the strictest bar clause 3 already names, and
under the operator's own 2026-09-28 direction authorizing it to gate low-care-level PRs specifically as a bounded
probation trial — never an unsupervised general grant.

**The routing rule, by care level (full design):**

1. **`none`/`low`** (backlog-only, docs, small non-daemon changes, per `we:scripts/review-core-cli.mjs`'s
   `careLevelFromReasons`) — both mandatory seats (`judge`, `judgeSecurity`) route to `agy-claude` at
   `we:scripts/lib/provider-routing.mjs`'s `AGY_CLAUDE_MODEL_BY_TIER.sonnet` (`'claude-sonnet-4-6'`, already
   pinned there), dispatched through the EXISTING escape hatch `we:scripts/gemini-direct-task.mjs` already
   proves works for routing a Claude model string through the Antigravity CLI (its own docblock: "this same
   escape hatch can route Claude through" Antigravity, e.g. `--model=claude-sonnet-4-6`) — no new transport.
2. **`elevated`** — both mandatory seats route to `agy-claude` at `AGY_CLAUDE_MODEL_BY_TIER.opus`
   (`'claude-opus-4-6-thinking'`, the pinned AGY model per `we:scripts/lib/provider-routing.mjs`) — "Opus 4.6 on
   agy is still not too bad" per the operator's own 2026-09-28 direction.
3. **`high`** (daemon/gate/security/statute) — unchanged: native Claude, exactly today's behavior. No routing
   change ever reaches this tier.
4. **Spot check.** A stable 1-in-5 sample per PR (a per-PR hash tie-break, mirroring the existing
   `stableLensHash` shape `we:scripts/lib/provider-routing.mjs`'s `selectReviewSeatProvider` already uses for a
   different purpose) runs a PARALLEL native-Claude judge on the same lens and diff; on `elevated`, EVERY
   `accept` verdict additionally gets a native-Claude spot check (the operator's own explicit ask). A
   disagreement between the two verdicts is recorded as an informative trial — never silently resolved, never
   auto-escalated to block the PR by itself. Promotion out of probation is never decided by this card; it stays
   a human ratification once real trial-count data exists, exactly as `#model-probation-graduation-criteria`
   requires for every `{provider, model, role}` triple.
5. **Trial recording.** Every dispatched mandatory-seat verdict is logged through the existing
   `we:scripts/conveyor/log-delegation-trial.mjs` machinery under a NEW `dispatchKind` distinct from today's
   `REVIEW_SEAT_DISPATCH_KIND` (`'review-seat'`, `we:scripts/lib/provider-routing.mjs`) — proposed
   `'mandatory-review-seat'` — so a mandatory-seat trial can never be read by `selectReviewSeatProvider`'s
   `rowsFor` (which filters strictly on `dispatchKind`) and pollute the UNRELATED advisory-seat provider-pick
   history; `taskType` reuses `reviewSeatTaskType(lens)` verbatim (already namespaced `review-lens:<lens>`, no
   collision given the different `dispatchKind`).
6. **Fallback on exhausted allowance.** When `agy` is out of allowance, the seat falls back to native Claude.
   The real allowance check is a REAL, gated dependency this card does NOT build: a "provider allowance gate"
   card is being authored in a sibling PR this same session, per the operator's direction — it does not yet
   have an id and is NOT claimed as filed here (per the "a deferral sentence must carry the id of a card that
   already exists" discipline; this one does not exist yet, so it is named honestly as a gap, not a hand-off).
   Until it lands, this card's own MVP (below) fails closed to native Claude on ANY allowance ambiguity —
   never a silent skip of the seat.
7. **Shared cap accounting.** An `agy-claude` mandatory-seat call counts against the SAME shared/per-provider
   daily budget `we:scripts/operations/review-extra-seats.mjs` already tracks (`DAILY_CAP_ENV`,
   `DEFAULT_DAILY_CAP`, the per-provider split from `#2817`) — composed with, never a second parallel cap.
8. **Docblocks that assert the mandatory pair is "not caller-negotiable"** (`we:scripts/operations/review-pr.mjs`,
   beside the `JUDGE_STEPS` construction) must be updated alongside the code change — this card is the
   ratification-track exception to that invariant, not a silent contradiction of it left for a future reader to
   discover.

## MVP cut

**Must (MVP):**
- `none`/`low` care-level PRs' two mandatory seats (`judge`, `judgeSecurity`) route to `agy-claude` Sonnet 4.6
  (`AGY_CLAUDE_MODEL_BY_TIER.sonnet`) via the existing `we:scripts/gemini-direct-task.mjs` transport. `elevated`
  and `high` are unchanged from today (design points 2–3 are Could).
- 1-in-5 stable spot check against a parallel native-Claude run on the same lens/diff; disagreement recorded,
  never auto-blocking (design point 4, the `none`/`low` half only — the "every accept on elevated" clause needs
  elevated routing to exist first, so it rides with that Could).
- `we:scripts/lib/model-probation.mjs` declares the new `mandatory-review` role: added to `PROBATION_ROLES`,
  explicitly NOT added to `NEVER_BLOCKING_ROLES`, entry `since`/`owner` pointing at this card (design point
  "why this needs a genuinely new role").
- Trial recording via the new `'mandatory-review-seat'` dispatchKind (design point 5).
- Fail-closed fallback to native Claude on any allowance/availability ambiguity — the blunt placeholder for
  design point 6 until the real allowance-gate card exists and lands.
- The `we:scripts/operations/review-pr.mjs` docblocks asserting "not caller-negotiable" are updated to describe
  the new, bounded, care-level-gated exception (design point 8).

**Could (follow-up, already designed above — not built now):**
- `elevated` → Opus 4.6 routing (design point 2) and the "every accept on elevated" spot-check clause (the
  second half of design point 4) — both depend on the Opus branch existing.
- Wiring to the real provider-allowance-gate card once it is filed and lands, replacing the MVP's blunt
  fail-closed fallback with the actual allowance check (design point 6).
- Extending `we:scripts/lib/provider-routing.mjs`'s `REVIEW_SEAT_PROVIDERS`/`selectReviewSeatProvider` (`#4194`)
  to formally include `antigravity` as a candidate for the unrelated ADDED (advisory) seat axis — a real, but
  separate and smaller, piece of work this card's MVP does not need.
- Surfacing this new role's trial stats in `we:scripts/conveyor/run-rating.mjs` / the graduation-progress
  report — genuinely useful once several trials exist to compare, mirroring `xtw16qn`'s own Could-cut reasoning
  ("a rule can be applied and later measured; it cannot be measured before it exists").

**Size:** the MVP is one new probation role + one care-level branch + one dispatch path already proven by
`we:scripts/gemini-direct-task.mjs` + one new dispatchKind for logging — within this card's own `size: 8`, no
split needed.

## Interfaces

- `we:scripts/lib/model-probation.mjs` — `PROBATION_ROLES` gains `'mandatory-review'`; `NEVER_BLOCKING_ROLES`
  is explicitly NOT changed to include it (the whole point of this role is that it CAN gate, under the
  care-level bound above); a new registry entry (`we:scripts/lib/model-probation.json`) for `{provider:
  'antigravity', model: 'claude-sonnet-4-6'}` (and later `'claude-opus-4-6-thinking'`) with `roles:
  {'mandatory-review': 'probation'}`.
- `we:scripts/operations/review-pr.mjs` — the `judge`/`judgeSecurity` steps in the `JUDGE_STEPS` reduce gain a
  care-level-conditional `provider` resolution (reading `buildShapePlan`'s `careLevel`, already computed at
  this call site) instead of their current unconditional native path.
- `we:scripts/lib/provider-routing.mjs` — `AGY_CLAUDE_MODEL_BY_TIER` is read (not changed) for the MVP; a new
  exported `dispatchKind` constant (proposed `MANDATORY_REVIEW_SEAT_DISPATCH_KIND = 'mandatory-review-seat'`)
  sits beside the existing `REVIEW_SEAT_DISPATCH_KIND`.
- `we:scripts/gemini-direct-task.mjs` — reused verbatim as the dispatch transport (`--model=claude-sonnet-4-6`
  pattern already demonstrated); no changes to this file are anticipated for the MVP beyond a caller passing
  the right model string.
- `we:scripts/conveyor/log-delegation-trial.mjs` — gains the mandatory-seat call site, logging `{provider:
  'antigravity', model, taskType: reviewSeatTaskType(lens), dispatchKind:
  'mandatory-review-seat', verdict, spotCheckVerdict, agreed}` per dispatched seat.
- `we:scripts/operations/review-extra-seats.mjs` — `DAILY_CAP_ENV`/`DEFAULT_DAILY_CAP` accounting is read, not
  duplicated, for the shared/per-provider budget these new calls also spend from.

## Tasks

1. Add `'mandatory-review'` to `we:scripts/lib/model-probation.mjs`'s `PROBATION_ROLES`; add the registry entry
   for `{antigravity, claude-sonnet-4-6}`; unit test that it is NOT in `NEVER_BLOCKING_ROLES` and that
   `statusFor` reads it correctly (Must).
2. Wire `we:scripts/operations/review-pr.mjs`'s `judge`/`judgeSecurity` steps to resolve `provider` from
   `careLevel` (`none`/`low` → agy-claude sonnet via `we:scripts/gemini-direct-task.mjs`; `elevated`/`high` →
   unchanged) and update the adjacent "not caller-negotiable" docblocks (Must for `none`/`low`; the
   `elevated` branch is Could).
3. Add the 1-in-5 stable spot-check sampler (per-PR hash) and the disagreement-recording path (Must for the
   `none`/`low` half; the "every accept on elevated" clause is Could).
4. Add `MANDATORY_REVIEW_SEAT_DISPATCH_KIND` and wire `we:scripts/conveyor/log-delegation-trial.mjs` logging
   for every dispatched mandatory seat (Must).
5. Fail-closed fallback to native Claude on any allowance/availability ambiguity, with a named TODO pointing at
   the not-yet-filed provider-allowance-gate card for the real check (Must for the placeholder; Could once that
   card exists and lands).
6. File the `elevated` → Opus 4.6 branch, the `REVIEW_SEAT_PROVIDERS` antigravity extension, and the run-rating
   trial-stats surfacing as their own follow-up slices once this MVP lands (Could, already designed above).

## Delivery shape

One PR for the MVP (Must items 1, 2's `none`/`low` half, 3's `none`/`low` half, 4, 5) — a single coherent
behavior change (new role + one care-level branch + logging + fail-closed fallback), reviewed and landed
together since the branch is meaningless without the role existing and vice versa. The Could items are
follow-up slices, `blockedBy` this card wherever a real dependency exists (the Opus branch and the elevated
spot-check clause structurally need this card's `none`/`low` plumbing first).

## Done when

1. **Must** — a `none`/`low` care-level PR's two mandatory review seats (`judge`, `judgeSecurity`) dispatch to
   `agy-claude` Sonnet 4.6 by default; a 1-in-5 stable spot check runs a parallel native-Claude judge on the
   same lens/diff and records any disagreement without auto-blocking; `we:scripts/lib/model-probation.mjs`
   declares the `mandatory-review` role (never in `NEVER_BLOCKING_ROLES`); every dispatch is logged as a trial
   under the new `mandatory-review-seat` dispatchKind, which cannot collide with existing `review-seat` rows;
   any allowance ambiguity fails closed to native Claude. Proven on a REAL low-care-level PR (this card's own
   PR, or the next `none`/`low` PR after this lands) as live evidence — per this repo's own "prove on the live
   case, never a private workaround" discipline (`xtw16qn`'s own Done-when uses the identical proof
   requirement) — not unit tests alone.
2. **Could** — `elevated` → Opus 4.6 routing, the "every accept on elevated" spot-check clause, and the real
   provider-allowance-gate wiring, once that sibling card exists and lands.
