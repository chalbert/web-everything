---
bornAs: x3dvojd
kind: story
size: 3
status: open
dateOpened: "2026-08-06"
tags: []
---

# Derive the care level for working-tree convergence from the touch-set

/converge runs on working-tree material, which has no escalation reasons — so the care dial has no signal and falls to low, the weakest panel available (1 round, 1 juror per lens), on work nothing has judged yet. The skill currently tells the operator to pass --care deliberately, which is a documentation patch over a design gap. Derive the band from the change's touch-set instead, so a diff touching a trust boundary, a gate, or a shared derivation earns higher rigor without the operator remembering to ask.

## Where the gap is

`--care` is optional in we:scripts/converge-cli.mjs and defaults to `low`. `panelRigorForCareLevel('low')`
(we:scripts/lib/jury-core.mjs) yields the weakest active panel — **1 round, 1 juror per lens** — against `high`'s
3 rounds and 2 jurors per lens. So the default review is the shallowest one available, on exactly the material
that has never been judged by anything.

For the PR path this problem does not arise: care is derived from the escalation reasons, which only exist for
material that already failed something, so care is high by construction there. Porting the same dial to a
transport with no prior escalation leaves the signal empty, and the current code resolves empty to `low` by
analogy rather than by asking what the right default is for unjudged work.

## The shape of the fix

Two pieces already exist to copy from:

- **`classifyTouchSet`** (we:scripts/lib/review-core.mjs) already turns a changed-file list into the perspective
  lenses a subject earns. The same input can pick a care band.
- **`deriveCareLevel` / `CARE_WEIGHTS` / `CARE_BANDS`** (we:scripts/lib/review-escalation.mjs) already score
  signals (blast radius, size) into a band. That is the derivation shape to adapt for a working-tree diff that
  carries no PR-side signals yet.

Keep it a pure derivation in the core, reached the same way every other one is — the CLI shells for it, the skill
never decides a band by hand.

## Why this is filed separately

The question was raised and left open inside #2971, which shipped and resolved. A resolved item drops out of
selection and its open questions are treated as historical (`findBuriedForkSections` in
we:scripts/check-standards-rules.mjs exempts resolved items from the buried-fork gate), so the question was
captured but no longer actionable. This item makes it selectable again.

## Re-grounded 2026-08-21 — the default is no longer `low`

**One premise above is out of date; the item survives it.** `DEFAULT_CARE` in we:scripts/converge-cli.mjs is
now `CARE_LEVELS.ELEVATED`, not `low` — changed by the PR #1064 review for an unrelated reason: at `low`,
`panelRigorForCareLevel` yields `rounds: 1`, and `deriveNegotiationOutcome` needs `round < roundCap` to return
`continue`, so **the editor could never run** and `/converge` degenerated into `/jury` with a misleading label.
`elevated` is the weakest band at which the loop exists at all.

That fixes the floor but not this item: `elevated` is still a **constant**, not a derivation, so a diff touching
the trust chain gets exactly the same panel as a diff touching a demo fixture. Everything the "Where the gap is"
section says about a *defaulted* band stands; only the value it defaults to changed. The same review also
floored the `--jurors` / `--round-cap` overrides so they may only RAISE rigor and are recorded in the escalation
packet — a derived band must compose with that flooring, not replace it.

Also note `we:skills-src/converge/SKILL.md` already links this item by number in the very warning this item is
meant to delete, so the doc edit is a two-line change, not a rewrite.

## Design

**The derivation is the third caller of an existing classifier, not a new one — but the two calls are in the
wrong order today.** `resolveDial(flags)` in we:scripts/converge-cli.mjs is where the band is decided
(`typeof flags.care === 'string' ? flags.care : DEFAULT_CARE`), and the changed-file list is computed by
`laneChangedFiles(target.laneRoot, baseRef)` on the **very next line, after it** — feeding
`resolveRoster(dial.careLevel, changedFiles)`. So step one of the build is to **reorder those two calls** (or
thread `changedFiles` into `resolveDial` as a parameter). Nothing else in `resolveDial` depends on ordering, so
this is mechanical — but a builder who assumes the input is already in hand will find it is not.

**The predicates to score already exist and are already the repo's answer to "is this a trust boundary".** Do
not invent path patterns:

- `isTrustChainPath` (we:scripts/lib/gate-config.mjs) — basename-matched against the versioned `TRUST_CHAIN`
  roster, so it travels when a member relocates.
- `isBlastRadiusPath` (we:scripts/lib/review-escalation.mjs) — the `BLAST_RADIUS` patterns plus
  `BLAST_RADIUS_ENGINE_BASENAMES`. `scoreEscalation` already computes its `blastRadius` signal as
  `changedFiles.filter((f) => isBlastRadiusPath(f) || isTrustChainPath(f))` — that exact union is the
  working-tree signal this item wants, and it needs no PR context at all.
- `classifyTouchSet` (we:scripts/lib/review-core.mjs) — the UI/page/script split that already picks perspective
  lenses; useful as a second, weaker signal, but note it is about *which lenses*, not *how hard*.

**Feed the existing scorer, do not fork it — but do not reuse its weights unexamined either.**
`deriveCareLevel({ signals, humanRequired })` (we:scripts/lib/review-escalation.mjs) is pure and total, weights
by `CARE_WEIGHTS`, and bands by `CARE_BANDS`. Adding a `deriveWorkingTreeCareLevel(changedFiles)` beside it
that builds signals and delegates keeps one band table and one weight table. **Three things it must handle
that the PR path never hits, all of which a naive delegation gets wrong:**

1. **A file-path touch-set cannot produce the `size` signal.** `CARE_WEIGHTS.size` is calibrated against
   `thresholds.diffLines` — a changed-LINE count. `laneChangedFiles` returns paths only, and nothing at
   `init` time computes line counts. So either compute a real line count (a second `git diff --numstat` in the
   same sweep) or **drop `size` and say so**; substituting file *count* silently diverges from the
   calibration — a 50-file one-line-each diff would score identically to a 50-file 5,000-line one.
2. **`blastRadius` alone can never lift this repo's own lanes above the floor.** `CARE_WEIGHTS.blastRadius` is
   `3`, `CARE_BANDS.elevated` is `3`, and `DEFAULT_CARE` — the floor — is already `elevated`. `BLAST_RADIUS`
   includes `/^scripts\//`, which matches nearly every file a `/converge` lane in this repo touches. So a
   3-line fix to we:scripts/lib/gate-config.mjs and an unrelated edit to any other file under `we:scripts/`
   derive the **same** band. That defeats the item's stated goal outright. The derivation therefore needs a
   **distinct, stronger trust-chain/leash signal** — not the `isBlastRadiusPath || isTrustChainPath` union
   `scoreEscalation` uses — or its own weights. Measure against a sample of this repo's real lane touch-sets
   before choosing, rather than assuming the PR-side calibration transfers.
3. **A score of zero must NOT fall through to `deriveCareLevel`'s `none`.** The local `CARE_BANDS` array in
   we:scripts/converge-cli.mjs deliberately refuses `none` because `panelRigorForCareLevel('none')` seats no
   lenses. Clamp the floor at the current `DEFAULT_CARE`.

It also cannot populate `dismissedFindings` or `crossRepo` (no PR, no prior review), so those stay absent.

**Keep the CLI shape.** `resolveDial` should end up choosing `flags.care` when given, else the derivation, and
the `overrides` array it already builds is the right place to record that the band was derived rather than
asked for — the escalation packet reads it.

## Done when

- **Tier 1** — a new unit test (in we:scripts/lib/__tests__/, beside the existing converge-core and
  jury-core suites) asserts the derivation is monotone over the touch-set: a changed-file list containing a
  `TRUST_CHAIN` basename derives a strictly higher band than a list of ordinary leaf files, and neither call
  reads a PR, a label, or an escalation reason. It fails today — no such function exists.
- **Tier 1** — a test pins the floor: a touch-set that scores **zero** derives a band that is still a member of
  `CARE_BANDS` in we:scripts/converge-cli.mjs and is never `none`. `panelRigorForCareLevel('none')` seats no
  lenses, so a `none` leak is a run that can only ever report `mandatory-lens-absent`.
- **Tier 1** — a test pins that an explicit `--care` still wins over the derivation, and that the `--jurors` /
  `--round-cap` flooring (overrides may only RAISE rigor, PR #1064) still applies on top of a *derived* band —
  the derivation must not become a way to smuggle a lower dial past that guard.
- **Tier 1** — a test pins that the trust-chain signal actually separates: a touch-set of ONE `TRUST_CHAIN`
  basename derives a **strictly higher** band than a touch-set of one ordinary `we:scripts/` file of the same
  size. Under a naive reuse of `CARE_WEIGHTS`/`CARE_BANDS` both derive `elevated` and this test is RED — which
  is the point: it is the criterion that forces Design item 2 to be solved rather than assumed.
- **Tier 2** — no NEW definition sites: `grep -rn "CARE_BANDS\|CARE_WEIGHTS" we:scripts/` returns the same
  set it does today (note there are already **two** distinct `CARE_BANDS` — the valid-`--care` array in
  we:scripts/converge-cli.mjs and the score-threshold object in we:scripts/lib/review-escalation.mjs), with the
  new derivation importing rather than restating any threshold.
- **Tier 2** — the prose warning is gone: `grep -n "deliberately" we:skills-src/converge/SKILL.md` no longer
  matches the "Pick the care level deliberately" block, and the paragraph that replaces it states what the
  derivation does and that this item's number no longer needs citing there.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: check by mutation or reversion ahead of the build) — The core gap (no derivation function exists, DEFAULT_CARE is a constant) is verified real, but two supporting premises don't hold against the live repo: the changedFiles-before-resolveDial ordering claim, and the assumption that both blastRadius and size are derivable from the file-path touch-set alone (size needs diffLines, unavailable in-process — see findings).
- **blast-radius** (NOT addressed; strategy: measure against the real corpus before wiring) — No measurement against this repo's actual /converge touch-sets was done before proposing to reuse deriveCareLevel's PR-calibrated weights unmodified; had it been measured, the elevated/high compression (Finding C) would likely have surfaced.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Verified there is exactly one caller of resolveDial/DEFAULT_CARE (we:scripts/converge-cli.mjs itself, not exported) and one doc reference (we:skills-src/converge/SKILL.md) — both are explicitly the card's own scope, and no daemon/subprocess caller (we:scripts/converge-daemon-pass.mjs, we:scripts/lib/converge-daemon-schedulers.mjs) passes --care today.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Tier-1 'Done when' bullet 3 explicitly pins the seam between an explicit --care, the derivation, and the pre-existing jurors/round-cap flooring composing correctly.
- **population** (NOT addressed; strategy: name the population each threshold guards) — The card doesn't name or check the population its reused thresholds must now guard (this repo's own working-tree touch-sets, dominated by we:scripts/ edits) — see Finding C for the concrete consequence.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Tier-1 bullet 2 requires a NAMED test pinning that a zero-score touch-set never falls through to 'none', directly guarding the CARE_BANDS-exclusion invariant it identifies.
- **unmeasured-impact** (NOT addressed; strategy: measure the constraint before sizing) — Same underlying gap as blast-radius/population: the reused CARE_WEIGHTS/CARE_BANDS constraint was not measured against the working-tree population's actual shape before being wired in as the design's fixed point.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The derivation stays pure/total (mirroring deriveCareLevel, never throwing) and dialOverrides already surfaces whether a band was derived vs. explicitly asked for in the escalation packet, so a derived-low-rigor run is still visible, not silent.

**Corrections applied by this review:**

- The card claims changedFiles is already computed 'just above' the point where resolveDial chooses the band ('the input the derivation needs is in hand at the exact point the band is chosen'), but in the live we:scripts/converge-cli.mjs, `resolveDial(flags)` runs at line 272 and `laneChangedFiles(...)` (which computes changedFiles) runs after it at line 273 — the implementer must reorder these two calls (or thread changedFiles into resolveDial) before the derivation has any input.
- The card's Tier-2 done-when criterion asks for 'the same single definition sites as before the change' when grepping `CARE_BANDS\|CARE_WEIGHTS` in we:scripts/, but the live repo already has TWO distinct `CARE_BANDS` definitions today (a local array of valid `--care` values in we:scripts/converge-cli.mjs:67, and a score-threshold object in we:scripts/lib/review-escalation.mjs:373) — the bullet should say 'no additional definition sites,' not 'single definition sites.'

_Recorded through the declared `review-prep` operation._

**Driver disposition (2026-08-21).** All findings accepted; every one was verified against the tree before
applying. **Ordering**: confirmed — `resolveDial(flags)` is line 272 and `laneChangedFiles(...)` line 273, so
the input is NOT in hand; the Design now makes reordering step one. **`size` needs `diffLines`**: confirmed —
`laneChangedFiles` returns paths only; the Design now says compute a real line count or drop the signal and
say so, never substitute file count. **Band compression (Finding C)**: confirmed —
`CARE_WEIGHTS.blastRadius === 3 === CARE_BANDS.elevated`, `DEFAULT_CARE` is already `elevated`, and
`BLAST_RADIUS` includes `/^scripts\//`; so the naive derivation cannot lift this repo's own lanes above the
floor. This was the most consequential finding and is now both a Design item and a new **tier-1** criterion
that is RED under the naive reuse. **Two `CARE_BANDS` sites**: confirmed (we:scripts/converge-cli.mjs:67 and
we:scripts/lib/review-escalation.mjs:373); the tier-2 criterion now reads "no NEW definition sites".
