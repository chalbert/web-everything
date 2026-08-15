---
bornAs: xh6gf3t
kind: story
size: 5
parent: "2705"
status: open
blockedBy: ["2725", "2686", "2719"]
scope: ["plateau-app:src/feature-tracker/velocity.ts", "plateau-app:src/feature-tracker/velocity.css"]
dateOpened: "2026-07-27"
tags: []
---

# S3 · Velocity panels + band forecast chips + insufficient/stalled/no-basis

12-week throughput sparkline + cycle where-the-time-goes (text twins), fed by #2686, registering into S2's section registry. Band forecast chips (projection allowed). Explicit named surfaces + own baselines for M2 (insufficient), M3 (stalled), and the K6/no-basis velocity panel.

## Deliverable
A 12-week throughput sparkline (SVG area+line, trend arrow) + cycle where-the-time-goes (per-segment text twins), fed by #2686. Registers into S2's section registry (does NOT edit the detail shell). Band forecast chips now that velocity exists. Explicit named surfaces + own baselines for M2 (insufficient), M3 (stalled, stallnote), and the K6/no-basis velocity panel — each honest no-forecast, not a hidden branch.

## FT cases → rendered=yes
M1/M2/M3; K1, K2, K3, K5, K7.

**Clarifying note (K6):** the Deliverable line above also names "the K6/no-basis velocity panel" as owned
here, but K6 is NOT in this card's own `rendered=yes` list — it is in S1b's
(`we:backlog/2721-s1b-fleet-scan-frame-shell-header-read-only-feature-epic-shi.md`: *"Renders the K6
no-basis chip"*). Read together these are consistent, not contradictory: S1b FIRST flips K6 to
`rendered=yes` as the fleet-SCAN row's placeholder chip ("no basis yet", before #2686 numbers are wired
in anywhere); S3 does not re-claim that flip, but its own DETAIL velocity panel must still render the
SAME zero-resolved-slices state honestly once real numbers exist, not silently fabricate one merely
because #2686 is now wired in. This card's `rendered=yes` list is deliberately left as-is (K6 stays
attributed to S1b); the design section below still specifies K6's detail-panel treatment.

## Scope
- `plateau-app:src/feature-tracker/velocity.ts`
- `plateau-app:src/feature-tracker/velocity.css`

### Consumers (item 1 — not just the two files above)
- **`plateau-app:src/feature-tracker/detail.ts`** (S2, `we:backlog/2725-*.md`, UNBUILT) — the section
  registry that mounts whatever `plateau-app:src/feature-tracker/velocity.ts` registers. S3 does not edit
  this file (per its own Deliverable: "does NOT edit the detail shell"), but
  `plateau-app:src/feature-tracker/detail.ts` is the sole runtime caller of whatever
  `plateau-app:src/feature-tracker/velocity.ts` exports.
- **`plateau-app:src/feature-tracker/burnup.ts`** (S4, `we:backlog/2732-*.md`, UNBUILT, `blockedBy:
  ["2727", ...]`) — shares the same `.velocity` 3-column grid row in the ratified mock as this card's
  spark + cycle panels (burn-up is historically the 3rd column). See
  `we:backlog/x3hbiy3-decide-the-section-registrys-shared-row-dom-contract-before-.md` (filed by this
  preparation) — the DOM-ownership contract between S3 and S4's registrations is undecided.
- **`plateau-app:src/feature-tracker/feature-tracking.mount-conformance.test.ts`** (S0b, `we:backlog/2720-*.md`,
  UNBUILT) and **`plateau-app:src/feature-tracker/feature-tracking.golden.test.ts`** (S0c,
  `we:backlog/2735-*.md`, UNBUILT) — the conformance/baseline tests that will assert this panel's DOM
  and pixels once they exist; found via subprocess/test-consumer search (`we:agent-memory-src/story-preparation-checklist.md`
  item 1's "second, usually bigger set"), not an ES import.
- **`we:scripts/readiness/velocity-metrics.mjs`** (#2686, RESOLVED, real code) — the numbers source. Verified
  a **producer**, not a consumer, of `plateau-app:src/feature-tracker/velocity.ts`; no existing WE script
  imports it back (checked `grep -rn "feature-tracker" we:scripts/ we:src/` — no hits), so this scope stays
  a plateau-app-only, single-repo change with one cross-repo data dependency (read-only, on
  `we:scripts/readiness/velocity-metrics.mjs`'s exported functions), not a two-repo edit.

## Grounding — repo state actually checked (2026-08-15)

Verified by listing `plateau-app:src/feature-tracker/` on `origin/main` and on **every** open lane/PR branch in
`plateau-app` (`git branch -r`, ~30 branches checked via `git ls-tree -r --name-only <branch> --
src/feature-tracker`):

- **Only `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` exists anywhere** (landed by S0r
  `#2716`, commit `da66083` in `plateau-app`, 2026-07-27 — merged to `plateau-app` main, confirmed via
  `git merge-base --is-ancestor da66083 HEAD`). Its own backlog item still read `status: open` as of this
  preparation (a stale-status bug independently found and already fixed in-flight —
  `origin/lane/reconcile-2716`, PR #1343, not yet merged as of this writing).
- **Nothing else exists**: `plateau-app:src/feature-tracker/read-model.ts`,
  `plateau-app:src/feature-tracker/forecast.ts`, `plateau-app:src/feature-tracker/mount.ts`,
  `plateau-app:src/feature-tracker/scan.ts`, `plateau-app:src/feature-tracker/detail.ts`,
  `plateau-app:src/feature-tracker/data.ts` (S1a/S1b/S2) are absent from `plateau-app` everywhere checked.
  No lane/PR branch (WE or plateau-app) is currently working any of S0a (#2717) / S1a (#2718) / S1b (#2721)
  / S2 (#2725).
- **`we:scripts/readiness/velocity-metrics.mjs`** (#2686) is real, resolved, unit-tested code — the one
  grounded producer interface this card can cite with confidence (see Interfaces below).
- **DEC `we:backlog/2719-*.md`** (resolved, ratified 2026-07-27) fixes the numeric thresholds this card's
  M2/M3/K6 design below relies on: `stalledAfterDays = 21`, `minSampleSlices = 3` (0 = no-basis/K6, 1–2 =
  insufficient/M2, ≥3 = enough), `noisyCoVCutoff = 0.6` (K7, a DIFFERENT state from K6 — too-noisy is not
  no-basis). `codifiedIn: plateau-app:src/feature-tracker/read-model.ts`, but that file does not exist yet
  ("S1a owns the stubs" — S1a, #2718, is itself unbuilt).
- **The ratified visual mock** (artifact linked from `we:backlog/2705-*.md`) draws the `ok`-forecast branch
  of the velocity panel only (a feature with real, non-degenerate throughput). It never draws M2
  (insufficient), M3 (stalled), or K6 (no-basis) — those three states are named in #2705's slice plan but
  were never drawn by the design committee. Per #2705's own operating model ("the operator gates the
  DESIGN via visual diff, never the implementation" — auto-land on green machine gates, escalate on visual
  diff), inventing their concrete pixels here is in-scope for this preparation and not an overreach: S0c
  (#2735) will capture whatever S3 draws as their FIRST baseline (there is no existing baseline to diverge
  from for these three cases), and the operator's visual-diff gate is the actual approval point, not this
  card.

## Decided design

**Reuse, don't reinvent, the ratified mock's panel shape** (grounded in the live artifact's real markup/CSS,
cited above) for the two panels this card owns:
- **Spark panel** (`FT-M1`, healthy/in-flight): an SVG `<svg class="spark" viewBox="0 0 W H"
  preserveAspectRatio="none" role="img">` polyline/area over #2686's `throughput` trailing-window series,
  a `.velfoot` footer showing `{pts/wk}.toFixed(1)` + a trend arrow (`↑`/`↓`/`→`, from comparing the latest
  window to the prior one — #2686 exposes one `throughput()` call per window, so S3 computes two calls,
  `asOf` = latest vs. `asOf` = latest − 7d × N, not a new metric).
- **Cycle panel** (`FT-M1`): a `.cyc` segmented bar + `.cyclegend` list, fed by #2686's `cycleTimeStats`
  (`n`/`meanDays`/`medianDays`/`p85Days`) — NOT the mock's `where-the-time-goes` phase-percentage bar (that
  was mock-only placeholder data; #2686's real `whereTheTimeGoes()` returns a **current-state point-share**
  of active WIP, not phase percentages — see the primitive's own honesty-boundary note at
  `we:scripts/readiness/velocity-metrics.mjs:15-25`). The cycle panel's "text twins" are the numeric
  echo of each bar segment (e.g. `median 4.2d` next to the median tick) — same pattern as the mock's
  `.cyclegend .li .d` mono-font numbers.

**The three new named states (M2/M3/K6) — concrete, token-grounded, since none is drawn anywhere yet:**
all three REUSE existing CSS custom properties + chip classes from the ratified mock's `:root` (real,
cited above), so no new token vocabulary is invented:

- **M2 · insufficient** (1–2 resolved slices, `minSampleSlices` boundary from DEC #2719): render the spark
  panel with whatever partial series exists (1–2 points, `Math.max(0.4,...)`-style degenerate polyline
  is fine — data, not fabrication) PLUS a `.panel` badge reusing `.fc-caveat` (`background:var(--caveat-bg);
  color:var(--caveat)`) reading **"THIN SAMPLE (n=1)"** / **"THIN SAMPLE (n=2)"** (the literal `n` from
  #2686's `throughput().count`, not a vague word) instead of the numeric `pts/wk` footer's normal green/plain
  styling. The cycle panel still renders (cycle time doesn't need 3 samples to be honest about 1–2), but
  carries the same caveat badge.
- **M3 · stalled** (`stalledAfterDays = 21`, zero throughput in the trailing window): reuse `.fc-stall`
  (`background:var(--stall-bg); color:var(--stall)`, the same class the mock's forecast chip already
  defines for `stall`) as a panel-level badge reading **"STALLED — 0 pts/wk"**, plus the required
  **stallnote** (named explicitly in the Deliverable): one line of text under the badge, e.g. "no resolved
  work in the last 21+ days" — computed from #2686's `itemVelocity` per constituent slice (the max
  `dateResolved` gap), not a static string. The spark still draws the flat-zero series (honest: a real
  flat line, not a "no data" blank) so a reader sees stalled-not-absent.
- **K6 · no-basis** (0 resolved slices ever, per DEC #2719): the spark panel shows NO svg polyline at all
  (an empty/dashed placeholder rect, mirroring `.mchip.gated`'s `border-style:dashed` pattern) and the
  `.velfoot` reads **"— pts/wk"** literally (`f.vel?f.vel.toFixed(1):"—"` is the mock's OWN existing
  null-coalescing pattern at the cited spark-panel call site — reused verbatim, not invented) with a
  one-line note **"no delivered slices yet"**. This must read as the SAME honest phrase family S1b's
  scan-row chip already commits to ("no basis yet") — S3's detail panel and S1b's scan-row chip describe
  the same K6 condition and must not drift into two different English phrasings for one case.

**Band forecast chips** (K1/K2/K3/K5/K7): a chip per §0's three-branch rule
(`we:backlog/2719-*.md`'s ruling), rendered as a `.fchip` reusing the mock's existing `FC_TXT`/`FC_CLS`
VOCABULARY SHAPE (ok/caveat/stall/noisy) — but the actual chip TEXT/state comes from S1a's forecast module
(`plateau-app:src/feature-tracker/forecast.ts`, owned by #2718, UNBUILT — see Interfaces below), not
computed locally in `plateau-app:src/feature-tracker/velocity.ts`. "Band" (vs. the mock's single-value
chip) means the chip shows a velocity-derived WINDOW (e.g. "wk of Aug 24 – Sep 7"), never a single date —
the literal wording of the projection branch in `we:backlog/2719-*.md`'s ruling.

## Interfaces / protocol at every seam

**Grounded (real, existing code):**
- `we:scripts/readiness/velocity-metrics.mjs:122` —
  `throughput(items=[], {windowDays=28, asOf=null}={})` → `{windowDays, asOf, from, weeks, points, count,
  pointsPerWeek, itemsPerWeek}`. `items` are plain records shaped `{status, dateResolved, size}` (see
  `itemVelocity` at `:78` for the full item shape). S3 calls this twice per feature (current window +
  prior window) to derive the trend arrow.
- `we:scripts/readiness/velocity-metrics.mjs:171` — `cycleTimeStats(items=[])` →
  `{n, meanDays, medianDays, p85Days, minDays, maxDays}` (all `null` when `n===0`).
- `we:scripts/readiness/velocity-metrics.mjs:78` — `itemVelocity(item={})` →
  `{num, size, status, resolved, active, blocked, cycleDays, waitDays, leadDays}` — used per-slice to
  compute M3's stallnote gap.
- These are **pure functions over plain objects** (no fs/git/clock) — this card's own consumption is
  therefore a plain-data adapter problem, not a cross-repo runtime import: whatever loads a feature's
  constituent backlog-item records (WE's own `we:backlog/*.md`, per the `kind: feature` root rule ratified
  in `we:backlog/2691-*.md`) and shapes them into this input array is presumed to be S1a's job
  (`plateau-app:src/feature-tracker/read-model.ts`), not this card's — S3 receives already-rolled-up
  numbers from the read-model, it does not re-derive them from raw backlog items itself.

**PROPOSED — NOT grounded in existing code (S1a `#2718` and S2 `#2725` are both unbuilt; no real
signature exists anywhere to cite).** Named here as an explicit, re-verify-before-building contract, per
`we:agent-memory-src/story-preparation-checklist.md`'s grounding rule ("an honest open question beats a
confident wrong contract"):
- **From S1a's read-model** (`plateau-app:src/feature-tracker/read-model.ts`): assumed to expose, per
  feature, a `velocityView` object shaped roughly `{throughput: ReturnType<typeof throughput>,
  cycleTime: ReturnType<typeof cycleTimeStats>, sampleCount: number, stalledDays: number|null, forecast:
  {branch: 'projection'|'delivered'|'absence', ...}}` — composing #2686's own return shapes 1:1 (no
  reshaping), plus the DEC #2719 threshold classification already applied (`sampleCount`/`stalledDays`
  drive M2/M3/K6 branch selection so `plateau-app:src/feature-tracker/velocity.ts` never re-implements
  threshold comparisons against raw constants). **This shape is this card's assumption, not S1a's
  ruling** — S1a's own preparation (not yet done) may fix a different shape, and S3's implementation must
  re-verify against whatever S1a actually ships.
- **From S2's section registry** (`plateau-app:src/feature-tracker/detail.ts`): assumed to expose a
  `registerSection({ id, group?, render(feature): HTMLElement | HTMLElement[] })` call — `group` per the
  shared-row proposal in `we:backlog/x3hbiy3-*.md` (this preparation's filed decision) so S3 and S4 can
  both target the historical `.velocity` grid without importing each other. **Also this card's assumption,
  not S2's ruling** — re-verify against #2725's actual API once it exists.

## Tasks (ordered)

1. Confirm S1a (`#2718`) and S2 (`#2725`) have landed and re-read their actual exported signatures —
   supersede the PROPOSED interfaces above with the real ones before writing any code.
2. Add `plateau-app:src/feature-tracker/velocity.css` — spark/cycle/badge classes, reusing the ratified
   mock's exact CSS custom properties (`--ok`/`--caveat`/`--caveat-bg`/`--stall`/`--stall-bg`) already
   present in `plateau-app`'s theme token layer (confirm the token names match once S1b's
   `plateau-app:src/feature-tracker/mount.ts` establishes the app shell's `:root`/`data-theme` scheme — do
   not assume the mock's literal hex values, only its variable NAMES, are what ships).
3. Implement the spark SVG renderer (M1) over `throughput()`'s series + trend-arrow comparison.
4. Implement the cycle panel (M1) over `cycleTimeStats()`.
5. Implement M2 (insufficient) branch — caveat badge + `n`-labelled text, partial spark.
6. Implement M3 (stalled) branch — stall badge + computed stallnote + flat-zero spark.
7. Implement K6 (no-basis) branch — empty/dashed spark + "no delivered slices yet" note, phrase-matched
   to S1b's scan-row wording.
8. Implement the band forecast chip renderer (K1/K2/K3/K5/K7), consuming S1a's forecast branch — never
   compute a date locally.
9. `registerSection(...)` call into S2's registry (per the group-key proposal above, pending #2725's real
   API).
10. Wire chart-anchor conformance per S0c's rule (`we:backlog/2735-*.md`): pin computed scalars
    (points-per-week, sample count, median days) as `data-*`/aria text, never the raw SVG path `d`.
11. Add/update this card's own baseline expectations once S0c's harness exists (own baseline images for M2/M3/K6).

## Done when

- The spark + cycle panels render #2686-sourced numbers (via S1a's read-model) and match the frozen
  baseline pixel-for-pixel in both light and dark themes, once S0b (#2720) commits that baseline.
- A feature with `sampleCount ∈ {1,2}` renders the M2 caveat badge with the literal count `n`, not a vague
  "thin" word with no number.
- A feature with `stalledDays ≥ 21` renders the M3 stall badge + a computed (not static) stallnote, and its
  own dedicated baseline exists once S0c's harness lands.
- A feature with `sampleCount === 0` renders the K6 empty-spark state with "no delivered slices yet" —
  phrase-identical to S1b's scan-row wording — and its own dedicated baseline exists.
- No chip, badge, or panel ever renders a typed future date on a blocked/gated/stalled/cycle feature (the
  honest-forecast invariant from `we:backlog/2719-*.md`) — band chips show a projection WINDOW or nothing.
- Chart-anchor conformance: the mount-conformance test (S0b/S0c) can assert on computed scalars
  (points-per-week, sample count, median days, done/total/ceiling if applicable) and never on the raw SVG
  path `d` string.
- The SVG re-renders its token-driven colours on a theme switch (no baked hex in the rendered markup).
- `npm run check:standards` is 0 errors on the plateau-app-side change (once buildable).

## Delivery shape

**Cannot land independently — must land as one piece, gated behind S1a + S1b + S2 landing first
(`blockedBy: ["2725", "2686", "2719"]`, and transitively S1a `#2718` + S0a `#2717`).** This is not a design
choice; `plateau-app:src/feature-tracker/velocity.ts` has no meaningful behaviour to ship on its own
(nothing to mount it into, no read-model to source numbers from) until the section registry (S2) and the
read-model (S1a) exist. Once those land, S3 itself lands in ONE PR (no partial/flagged rollout named
anywhere in the epic's acceptance policy) — the epic's own acceptance model (`we:backlog/2705-*.md`)
auto-lands a slice whose machine gates are green and escalates a visual diff to the operator, which is an
atomic per-slice landing model, not an incremental one.

## Preparation status

Items 1/2/3/6/7 of `we:agent-memory-src/story-preparation-checklist.md` are done above (scope+consumers
verified against live repo state across every branch, not assumed; size 5 confirmed reasonable against
sibling slices of comparable scope — S1a/S1b/S4 are also size 5; testable Done-when; ordered tasks;
delivery shape named and justified). Item 4 (decided design) is done for the two panels this card renders
AND for the three previously-undrawn M2/M3/K6 states, grounded in the ratified mock's real token/class
vocabulary rather than invented from scratch.

**Item 5 (interfaces at every seam) is only PARTIALLY satisfiable today, and this is the honest limit of
this preparation, not an oversight:** the #2686 velocity-metrics producer interface is real and cited with
`path:line`. The two remaining seams — S1a's read-model shape and S2's section-registry API — cannot be
grounded because **neither S1a (#2718) nor S2 (#2725) has any code anywhere** (verified across `plateau-app`
main and every open branch, 2026-08-15). This card names its own PROPOSED consumption contract for both,
explicitly marked as an assumption to re-verify, per the checklist's own grounding rule ("an honest open
question beats a confident wrong contract") — rather than silently building against an invented interface
and discovering the mismatch at review time (the #2803/#2351-class failure this checklist exists to catch).

**This card is therefore NOT build-ready today**, and cannot honestly be made so until S0a → S1a → S1b → S2
land in sequence (none has started; the whole chain is unbuilt). This is a structural property of a
systematically pre-sliced epic (`we:backlog/2705-*.md`'s 18-slice, `blockedBy`-ordered plan), not a defect
unique to this card — S3 is correctly positioned 5th in that chain. A second, cross-slice gap was found and
filed separately rather than worked around: `we:backlog/x3hbiy3-decide-the-section-registrys-shared-row-dom-contract-before-.md`
(the S2/S3/S4 shared-`.velocity`-row DOM-ownership contract). Once S1a + S2 land, re-open this card,
supersede the two PROPOSED interfaces with the real ones (task 1 above), and re-run item 9 (independent
review) before claiming it build-ready. Item 9 has not run and cannot meaningfully run yet — there is
nothing to independently review until the PROPOSED interfaces are replaced with grounded ones.
