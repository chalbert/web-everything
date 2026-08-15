---
bornAs: x3hbiy3
kind: decision
parent: "2705"
status: open
dateOpened: "2026-08-15"
tags: []
---

# Decide the section registry's shared-row DOM contract before S3/S4/S5 self-register

Preparing #2727 (S3, velocity panels) to build-ready found that the ratified v3 baseline mock draws the throughput sparkline, cycle where-the-time-goes bar, and burn-up as THREE SIBLING panels inside one `.velocity` 3-column CSS grid, populated by one render call. The build plan splits that same row into three independently self-registering sections — velocity (S3 #2727), burnup (S4 #2732), rollup (S5 #2726) — registering into S2 (#2725) a data-driven section registry, with no stated contract for whether a registrant gets a shared grid cell or its own standalone block. This is undecided and directly affects whether S3/S4 can honestly claim baseline-pixel parity.

## Found while preparing #2727 to build-ready

Grounded against the RATIFIED design mock (the live artifact linked from `we:backlog/2705-feature-tracking-screen-ratified.md`, `https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046`) — its rendered HTML is the frozen source S0b (#2720) will annotate into `plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html`, not yet committed to either repo:

- The mock's CSS: `.velocity{display:grid;grid-template-columns:1.15fr 1.15fr 1.55fr;gap:14px;margin-bottom:18px}` — ONE grid container, three columns.
- The mock's render call sequence populates that one container directly: `vel.appendChild(sparkPanel(f,v)); vel.appendChild(cyclePanel(f)); vel.appendChild(burnPanel(f,v));` — three `.panel` children of one `vel` node, written by one function, not by three independent registrants.
- `we:backlog/2725-s2-detail-shell-section-registry-tabs-sub-line-empty-leaf.md` describes S2's deliverable as *"a data-driven section registry (velocity/burnup/rollup self-register to identical ratified DOM)"* — naming velocity, burnup, and rollup as three SEPARATE registrants.
- `we:backlog/2727-s3-velocity-panels-band-forecast-chips-insufficient-stalled-.md` (S3) scopes only `plateau-app:src/feature-tracker/velocity.ts`/`plateau-app:src/feature-tracker/velocity.css` and is `blockedBy` S2, not S4.
- `we:backlog/2732-s4-burn-up-honest-forecast-projection-gated-hatched-band-no-.md` (S4) scopes `plateau-app:src/feature-tracker/burnup.ts`/`plateau-app:src/feature-tracker/burnup.css` (+ an owned re-edit of `plateau-app:src/feature-tracker/forecast.ts`), separately, `blockedBy: ["2727", "2687"]` — i.e. burn-up registers AFTER velocity, as its own section.
- Rollup (S5, `we:backlog/2726-s5-epic-slice-rollup-with-connector-rails.md`) scopes `plateau-app:src/feature-tracker/rollup.ts`/`plateau-app:src/feature-tracker/rollup.css` and is visually a full-width block BELOW the `.velocity` row in the mock (`.sec-h`/`.rollup` are separate, unrelated CSS rules from `.velocity`) — so S5 is not actually part of this ambiguity; only velocity (S3) and burn-up (S4) compete for slots inside the same historical `.velocity` grid row.

None of S2/S3/S4's cards say which of these two shapes the registry takes:
1. **Registry entries are DOM-fragment contributors to a shared row.** S2 owns a `.velocity` grid container; S3 and S4 each register a render function that returns/injects ONE `.panel` node into that shared grid, preserving the original 3-column layout (S3 contributing 2 of 3 columns — spark + cycle — S4 contributing the 3rd). Matches the frozen baseline pixel-for-pixel with no re-baseline needed.
2. **Registry entries are independent, self-contained sections.** Each of velocity/burnup/rollup renders its own full section (own heading, own layout, stacked vertically like `.rollup` already is), and the historical single-row 3-column `.velocity` grid is INTENTIONALLY abandoned in favor of a new stacked layout — a real design change requiring the operator's visual-diff approval (a new baseline, re-baselined per `we:backlog/2705-feature-tracking-screen-ratified.md`'s own acceptance policy), not a silent drift.

Either is buildable; neither is named. Left undecided, S2's builder invents one shape, and S3/S4's builders then either match it by luck or discover the mismatch only at the S0c (#2735) baseline/visual-diff gate — the exact "buried fork handed to a builder" class `we:agent-memory-src/story-preparation-checklist.md` item 4 exists to catch. #2727's own acceptance line ("spark + cycle match baseline in both themes") is UNVERIFIABLE against a still-undecided container shape.

## Forks to rule

1. **Shared-row DOM contract (fork 1 above) vs. independent-section contract (fork 2 above).** **Recommended default: fork 1 (shared row).** It is what the ratified mock already draws, requires no new baseline/visual-diff round-trip, and keeps S3/S4's "match the frozen baseline" acceptance literally checkable. Fork 2 costs a real design change + operator re-approval for a screen that is already ratified, with no stated reason to change it.
2. **If fork 1: who owns the `.velocity` container element itself?** S2 (#2725, the detail shell) is the natural owner — it already owns the detail body per its own deliverable text. Recommended: S2's registry API takes a `group` (or `row`) key alongside each registration (e.g. velocity/burnup both declare `group: 'velocity'`), and the registry — not each registrant — creates the shared grid container once and appends each group member's returned node(s) into it in registration order. This keeps S3 and S4 mutually decoupled (neither imports the other; neither creates the shared container) while still landing them in one grid.

## Recommendation

Rule fork 1 (a) shared-row contract, decided as part of S2's (#2725) own preparation/build — S2 is the item that actually implements the registry, so this is where the concrete signature belongs, not bolted onto S3 after the fact. #2727's own preparation (this session) proceeds on the ASSUMPTION that fork 1(a) is correct (documented as a proposed, not-yet-grounded contract in its own `## Interfaces` section) so it isn't blocked on this ruling, but S3's implementation must be re-verified against S2's actual registry API once #2725 lands — the assumption is named, not silently baked in as fact.
