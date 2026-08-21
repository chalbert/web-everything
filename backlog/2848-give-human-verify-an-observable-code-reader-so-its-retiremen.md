---
bornAs: xooi128
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, prevention, human-verify, oracle]
---

# Give human-verify an observable code reader so its retirement is enforced both ways

The `human-verify` state has no observable code reader, so its retirement — when a deterministic oracle should take over — is not enforced in either direction: a slice can stay `human-verify` after an oracle exists, or drop it before one does. Give `human-verify` an observable code reader that enforces its retirement both ways.

## Gap

`human-verify` is a lifecycle marker with no code that reads it against the existence of a deterministic acceptance oracle. So the transition is unpoliced in both directions.

## Why it matters

`#deterministic-oracle-clears-slice` says `human-verify` applies **only until** a green acceptance oracle exists. Without an observable reader, two failure modes go uncaught: a slice keeps `human-verify` after its oracle lands (a human is asked to verify what a script now proves), or a slice drops `human-verify` before any oracle exists (nothing verifies it at all). An observable reader makes the retirement a two-way, checkable fact.

## Mechanical fix

Give `human-verify` an **observable code reader** that: (a) flags a slice still marked `human-verify` once its deterministic oracle exists (retire it), and (b) flags a slice that dropped `human-verify` with no oracle in place (premature retirement). Enforced in both directions.

## Provenance

Outstanding **minor** prevention from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Serves `#deterministic-oracle-clears-slice`. Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.

## What `human-verify` actually is today (grounded 2026-08-21)

Before designing a reader, know what it reads. `human-verify` is a **backlog frontmatter tag**, nothing more —
`grep -rn "human-verify" we:scripts/ we:src/` returns nothing; the only code-adjacent mention is the statute
prose at `#deterministic-oracle-clears-slice` in we:docs/agent/platform-decisions.md, which itself says the tag
is "a documented convention today with **no code reader**".

**Four** items carry it in `tags:` — `#2809` (**resolved**), `#2810` (**resolved**), `#2811` (active), `#2834`
(active). (A first pass of this note said three and missed `#2809`; corrected by the independent review.) All
four also carry `render-slice` and `slice-uifg`; `#2811`'s body spells the convention out under a *"Conveyor
guardrail — self-proving, human-verify"* heading ending `render-slice: resolve gates on the rendered red→green
proof, human-reviewed`.

**Two of the four are live instances of failure mode (a)**, and they are this item's best fixtures:

- `#2810` — `resolved`, still tagged `human-verify`, `scope` names `plateau-app:tests/visual/geometry-theme.ts`,
  which exists on disk.
- `#2809` — `resolved`, still tagged `human-verify`, and richer: five scoped files, all present in plateau-app,
  including `plateau-app:tests/fidelity/fidelity-render.test.ts` — an actual test file, i.e. the least arguable
  "deterministic acceptance oracle" of the set.

Whether a given scoped file counts as "its deterministic oracle" is precisely the judgment a reader must not be
asked to make, which is the crux below.

## Design

**Direction (a) is mechanizable. Direction (b) is not, unless the oracle is DECLARED.** Say so up front rather
than discovering it mid-build:

- **(a) "still `human-verify` after the oracle exists"** needs one fact: does the item's oracle resolve on disk?
- **(b) "dropped `human-verify` with no oracle"** needs a fact no frontmatter carries: that this item was ever
  *supposed* to be verify-gated. A rule cannot infer it from an absent tag — absence is the overwhelmingly
  common case (nearly every item in the backlog), so any auto-derived predicate either fires on everything or
  on nothing. Git history is not available to a `check:standards` rule and would not be an *observable* reader
  anyway.

**So the reader keys on a declared field, not a derived one.** This repo has already settled that trade in the
same file: `validatePolyglotWideningGate` (we:scripts/check-standards-rules.mjs) is documented as *"TAG-KEYED
and DECLARED, not auto-derived (declared-over-auto-derived)"* precisely because a blanket predicate
false-positived across ~38 items. Copy that shape exactly:

1. Add an optional `acceptanceOracle:` frontmatter field — a repo-qualified path to the deterministic oracle
   (the same spelling `scope` uses, e.g. `plateau-app:tests/visual/geometry-theme.ts`).
2. **(a)** item has `human-verify` **and** `acceptanceOracle` resolves on disk → **error**: retire the tag, the
   oracle clears it (`#deterministic-oracle-clears-slice`).
3. **(b)** item declares the verify-gated class (the `render-slice` tag is the existing declaration — all four
   `human-verify` items carry it, and no other item does) **and** has neither `human-verify` nor a resolving
   `acceptanceOracle` → **error**: premature retirement.
4. Carve-out, mirroring `POLYGLOT_CARVEOUT_TAGS`: a `status: resolved` item is out of scope for (b) but **in**
   scope for (a) — a resolved slice still wearing `human-verify` next to a live oracle is the exact
   already-present instance (`#2810`).

**Cross-repo path resolution is the one real hazard.** All three current oracles live in plateau-app, and
`check:standards` runs in web-everything. The existing precedent for this is the block-impl drift gate
(`validateBlockImplConformance`, same file): **detect-or-skip** — when the sibling repo is absent, the content
arm is *skipped*, never failed. Reuse that, and keep the pure rule taking a resolved `oraclePresent:
true|false|null` so the fs walk stays in we:scripts/check-standards.mjs, as every sibling rule does.

**Keep it in the same three places the polyglot gate lives:** the pure rule + its constants in
we:scripts/check-standards-rules.mjs, its fixtures in we:scripts/__tests__/check-standards-rules.test.mjs, and
one call site in we:scripts/check-standards.mjs. No new module.

**Coordinate with `#2853` before touching the statute sentence.** `#2853` is `status: open` and its whole job is
to rewrite the owed-work pointers in the stop-the-line anchors — including the very
`#deterministic-oracle-clears-slice` sentence this item's tier-3 criterion requires editing, whose current text
already says "pending #2853's re-point". Whichever lands second will be editing text the other moved. Either
land after `#2853` and edit the corrected sentence, or state in the PR body exactly which clause you replaced so
the other lane can rebase onto it. Do not silently re-word it.

## Done when

- **Tier 1** — a new pure rule in we:scripts/check-standards-rules.mjs has fixture coverage in
  we:scripts/__tests__/check-standards-rules.test.mjs for all four arms: (a) fires, (b) fires, the resolved
  carve-out for (b), and the sibling-absent skip. Every arm is a separate assertion — a rule with only the
  happy path is the vacuous-test failure `#2905` is filed about.
- **Tier 1** — `npm run check:standards` reports **both** already-present instances: `#2809` and `#2810` are
  each `resolved`, tagged `human-verify`, with scoped files that exist — so arm (a) must fire on both on the
  very first run. If it fires on neither, the rule is not reading what it claims to; if it fires on only one,
  the population predicate is wrong. Fix both items (retire the tag) as part of the same change so the gate
  lands green.
- **Tier 2** — the class is declared, not guessed: `acceptanceOracle` is a documented field in
  we:docs/agent/backlog-workflow.md's frontmatter section, and the rule's carve-out tags are one exported
  frozen constant with exactly one reader — the shape `POLYGLOT_CARVEOUT_TAGS` already uses.
- **Tier 2** — no cross-repo hard failure: with the plateau-app sibling absent, `npm run check:standards` in a
  bare web-everything clone is unchanged (the oracle arm skips, mirroring `validateBlockImplConformance`).
- **Tier 3** — the statute sentence is retired, not left contradicting the code:
  `#deterministic-oracle-clears-slice` in we:docs/agent/platform-decisions.md still says `human-verify` has "no
  code reader" and that the gate is "still owed". Read that anchor after the change — it must name this item's
  number and the rule, or the doc now lies about its own enforcement.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed at the time of review; strategy: check by mutation or reversion ahead of the build) — The card asserts 'Exactly three items carry [human-verify]: #2811 (active), #2834 (active), #2810 (resolved)' (repeated in the Design section as 'all three human-verify items carry [render-slice]'). Verified against we:backlog/*.md frontmatter: a fourth item, we:backlog/2809-real-route-render-harness-plateau-app.md, also carries `tags: [..., render-slice, human-verify, ...]` and `status: resolved`, with all five of its scope files confirmed to exist on disk in plateau-app (plateau-app:scripts/dev/fidelity-render.mjs, plateau-app:tests/fidelity/console-board.contract.mjs, plateau-app:tests/fidelity/fidelity-render.test.ts, plateau-app:vitest.config.ts and its .gitignore). This is a second, richer live instance of failure mode (a) the card's own fixture-selection missed.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — we:backlog/2853-correct-the-owed-work-pointers-in-the-stop-the-line-anchors-.md is `status: open` and its explicit mechanical fix is to edit the same `#deterministic-oracle-clears-slice` sentence in we:docs/agent/platform-decisions.md that #2848's own Tier 3 'Done when' requires editing ('must name this item's number and the rule'). #2853's body even already says the current sentence is 'pending #2853's re-point.' #2848 never mentions #2853, so whichever lands second edits stale text without a stated reconciliation plan.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — The design deliberately keys arm (a)/(b) on a DECLARED `acceptanceOracle` field (not auto-derived), which caps blast radius to zero until someone opts an item in — the same declared-over-auto-derived shape verified present in we:scripts/check-standards-rules.mjs's validatePolyglotWideningGate, so the false-positive risk that motivated that precedent is inherited correctly.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Checked for other consumers of the `human-verify`/`render-slice` tags beyond check-standards (we:src/_data/backlog.js, we:src/_data/backlogMeta.js, the workflows dir, plateau-app, frontierui) — none found reading these tags specially, so the card's claimed three touch-points (we:scripts/check-standards-rules.mjs, its test file, and we:scripts/check-standards.mjs) are complete.
- **population** (addressed; strategy: name the population each threshold guards) — Both arms name their population precisely: arm (a) keys on items carrying a resolving `acceptanceOracle`, arm (b) keys on the `render-slice` tag population — verified render-slice is currently carried by exactly the same 4 items that carry human-verify, so no scope-mismatch between the tag population and the state it gates.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Tier 1 'Done when' explicitly requires separate fixture assertions for all four arms (fires/fires/carve-out/sibling-skip) and explicitly cites #2905's vacuous-test-happy-path-only failure as the thing to avoid.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Both arms are specified as hard errors (not warnings), so a violation surfaces as a check:standards failure rather than silently passing.

**Corrections applied by this review:**

- The card's claim that 'exactly three' items carry `human-verify` (#2811, #2834, #2810) is factually wrong — we:backlog/2809-real-route-render-harness-plateau-app.md also carries the tag and is `status: resolved` with all its scoped files present on disk, making it a fourth item and a second unaddressed instance of failure mode (a).

The mechanical design (declared acceptanceOracle field, detect-or-skip cross-repo resolution, resolved-carve-out) is sound and correctly grounded in this repo's existing `validatePolyglotWideningGate` / `validateBlockImplConformance` precedents, but the card's own headline fact ("exactly three" human-verify items) is wrong and it never cross-checks an already-open sibling item that plans to edit the same statute sentence.

_Recorded through the declared `review-prep` operation._

**Driver disposition (2026-08-21).** Both findings accepted; both were driver errors and both are corrected.
**The count was wrong**: re-checked with `grep -l "tags:.*human-verify" we:backlog/*.md` — `#2809` also carries
the tag, is `resolved`, and its five scoped files all exist in plateau-app (including a real test file), making
it a second and better instance of failure mode (a) than `#2810`. The body, the population claim in Design item
3, and the tier-1 criterion now all say four and require the rule to fire on both. **The `#2853` collision is
real**: `#2853` is open and exists to rewrite the owed-work pointers in these same statute anchors, and the
sentence this item's tier-3 criterion edits literally reads "pending #2853's re-point". A coordination
paragraph is added. No `blockedBy` edge: the collision is a text-merge conflict on one sentence, not a
prerequisite artifact, so an edge would wrongly hide ready work — the prose note is the honest record.
