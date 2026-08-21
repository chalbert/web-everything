---
bornAs: x9nxx8n
kind: story
size: 8
parent: "2676"
status: open
dateOpened: "2026-07-27"
tags: []
crossRef: { url: /backlog/2709-feature-tracking-screen-case-taxonomy-to-webcases/, label: "Same job, already scoped & in-flight as #2709 (build-slices #2716 landed, #2717 open) — see Prep finding" }
---

# Auto case-taxonomy → webcases, incl. error + latency families

The tool should enumerate a screen's FULL case space with a completeness-critic (not just happy-path) — including ERROR and LATENCY/loading families that get ignored — assign referenceable case codes, and graduate them to a plateau-app:*.webcases.ts registry + conformance test (the #797 / #2553 pattern, mirroring the planned card-taxonomy webcases registry that #2553 will produce).

Operator requirement: "use the web-case lens — plan for integration into webcases, same rigor identifying all variation and use cases, maybe even error and latency states." Each case gets a UC-style code (e.g. a per-screen prefix so codes never collide across screens), an assert-grammar line, and a rendered? flag, hardened by a conformance test. Sibling to #2553 (card-state conformance spec).

Captured from the **feature-tracking-screen** design session — a capability the design-studio tool (#2676) should productize, drawn from methodology we ran by hand. Decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d

## Prep finding (2026-08-15) — not viable to prepare as a standalone build-ready story; same job already in flight elsewhere

Ran the story-preparation checklist (`we:agent-memory-src/story-preparation-checklist.md`). Verdict: **do not prepare this card for build.** Its concrete ask — enumerate the feature-tracking screen's full case space (incl. error + latency families), assign UC-style codes, and graduate to a `plateau-app:*.webcases.ts` registry + conformance test — is the **same job** as [#2709](/backlog/2709-feature-tracking-screen-case-taxonomy-to-webcases/), filed the same day (`dateOpened: 2026-07-27`) from the same design session, citing the same decision-view artifact and the same operator quote. #2709 already carries the concrete numbers #2693 leaves abstract (115 cases / 8 families: S17 F15 K9 M38 E16 L13 C3 R4) and is already sliced into build-slices under the ratified epic [#2705](/backlog/2705-feature-tracking-screen-ratified.md):

- **`we:backlog/2716-s0r-taxonomy-reconcile-spec-allow-list-refreeze-r1.md`** (S0r) — its code is **already landed**: `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` (merged via plateau-app PR #115, commit `da66083`). Verified against its own acceptance line (`SPEC_BEFORE_RENDER` = the exact 44 codes S17/F13–15/M8,13,22,23,32,38/E2–16/L2–13/C1–3/R1–4, `RENDERED_COUNT` = 71, `validateFtRegister()` enforces the reconcile + list-only-shrinks invariants) — acceptance is met in code. **Its `we:backlog/2716-*.md` frontmatter still reads `status: open`** — a stale bookkeeping gap, not evidence the work is outstanding. Filed as a separate item below rather than silently fixed here (out of this card's scope, and touches a different card).
- **`we:backlog/2717-s0a-ft-webcases-registry-invariant-tests-spec-allow-list.md`** (S0a, `blockedBy: ["2716"]`) — the slice that graduates the 115 cases into the full WEB-CASE-header + assert-line + parser + conformance-test shape #2693 describes (mirroring `plateau-app:src/backlog-view/card-taxonomy.webcases.ts`). **Not yet built** (no `plateau-app:src/feature-tracker/feature-tracking.webcases.test.ts` exists yet) — this is the real remaining work, already correctly scoped, sized (3), and ordered.

Preparing #2693 as an independent story would either (a) duplicate #2717's already-correct scope under a second number, or (b) if narrowed to only the "productize into an automated tool" fragment ("the design-studio tool (#2676) should productize... drawn from methodology we ran by hand") — that piece has no decided design, no ratified interface, and no existing automation to extend (checked `we:scripts/lib/design-pixels-adapter.mjs`, `we:scripts/lib/jury-core.mjs`, `we:webcases/compileRequirement.ts`: none enumerate a screen's case space; "completeness-critic" today is a documented *manual/agent* review step in `we:docs/agent/build-ui.md`, not a tool). That fragment's natural home is epic #2676, deliberately left **unsliced** ("Rule the slice boundaries at /slice time; this epic stays a single open umbrella until then") — inventing a build-ready scope for it now would pre-empt that epic's own slicing rather than prepare real work.

**Recommendation:** leave #2693 open (no retirement mechanism for a folded duplicate exists yet — see [#2982](/backlog/2982-how-a-folded-duplicate-backlog-item-retires-foldedinto-point.md), open) but do not batch/build it; route effort to #2717 instead, which `check:readiness --select` currently reports **Tier C (blocked)** only because of #2716's stale status (see the new item filed for that below) — once #2716 is flipped to `resolved`, #2717 becomes immediately Tier A/B buildable and delivers everything #2693 asks for.

## Prep re-verification (2026-08-21) — the 2026-08-15 finding stands; one detail has moved

Re-checked the three claims the finding turns on, against the live trees:

- **`we:backlog/2716-…md` is no longer stale.** It now reads `status: resolved` (`dateResolved: 2026-08-15`,
  `graduatedTo: plateau-app:src/feature-tracker/feature-tracking.webcases.ts`). The bookkeeping gap the
  finding flagged has been closed, so its consequence has too: **#2717 is no longer Tier C**. Its
  `blockedBy: ["2716"]` now resolves to a resolved item.
- **`plateau-app:src/feature-tracker/feature-tracking.webcases.ts` exists**; it is the only file in that
  directory.
- **`plateau-app:src/feature-tracker/feature-tracking.webcases.test.ts` still does not exist** — so #2717's
  work (`status: open`, size 3, scope naming exactly those two files) is genuinely outstanding, and it is
  still the correct home for everything #2693 asks for.

Nothing else changed. The recommendation is unchanged and is now unblocked: **route effort to #2717**, not
here.

## Done when

**No tier-1 criterion — and deliberately none of any tier for a build, because this card is not buildable as
filed.** Per the #2949 exemption clause, the reason is recorded rather than criteria invented:

Its concrete ask is the same job as `we:backlog/2717-…md`, which already carries the scope, the size, the
ordering and the 115-case/8-family numbers this card leaves abstract. Writing acceptance criteria here would
either duplicate #2717's under a second number — the exact double-booking `scope:` overlap exists to prevent —
or invent a build-ready scope for the "productize it into the design-studio tool" fragment, whose home is epic
#2676, which is deliberately left unsliced until `/slice` time. Both are worse than no criteria.

What would make this card actionable, in order:

1. **#2717 lands.** Its own acceptance is what proves #2693's substance shipped.
2. **A retirement mechanism for a folded duplicate exists** — `we:backlog/2982-…md` (`foldedInto`), currently
   open. Until it does there is no way to close this card without either a false `resolved` (nothing was built
   here) or a `parked` that misdescribes the state (it is not blocked; it is redundant).

Until (2) exists, the correct handling is: leave `status: open`, do not claim, do not batch, do not build.
That instruction is this card's whole content, and re-deriving it is the cost each prep pass pays — which is
itself the argument for #2982.
