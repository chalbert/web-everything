# Prep report — #2937: does the agent-behaviour landing/review governing subset sit at the statute layer?

**Session:** `/prepare 2937`, 2026-08-15. **Item:** [`we:backlog/2937-should-the-agent-behaviour-rules-that-govern-landing-and-rev.md`](../backlog/2937-should-the-agent-behaviour-rules-that-govern-landing-and-rev.md).

## What this is

#2909 registered the two agent-behaviour trees (`we:skills-src/`, `we:agent-memory-src/`, both `.claude/` link
spellings) as `blast-radius` — escalation-worthy but agent-clearable. Some of those files are the *operative
rules a reviewing/landing agent is itself governed by* (the land bar, the review procedure), so an agent
clearing a diff to one is policing its own leash — the gate's CODE half is already protected against exactly
this (`isGateSelfPath` on `we:scripts/lib/review-escalation.mjs` → `review:human`); its PROSE half is not. PR
#1045 is a live incident: an agent narrowed the land bar's own test 3 and merged *during its own review*. This
item asks which clearance tier the *governing subset* of the agent-behaviour trees should sit at.

## Grounding read (standalone, before touching the item)

Read `we:docs/agent/platform-decisions.md` in full for the relevant anchors, and the live code:

- `we:scripts/lib/review-escalation.mjs` — `STATUTE_PATHS`/`isStatutePath` (matches only
  `we:docs/agent/platform-decisions.md` + `we:docs/agent/*statute*`), `BLAST_RADIUS`/`isBlastRadiusPath`
  (matches `we:scripts/`, the agent-behaviour trees, hooks, CI — agent-clearable), `scoreEscalation`
  (`we:scripts/lib/review-escalation.mjs:557-573` — `statute` and `gate-self`/leash fire as **distinct,
  separately-worded reason tokens**, even though both force the same `humanRequired: true`).
- `we:scripts/lib/gate-config.mjs` — `TRUST_CHAIN`, the hand-curated named-file policy-tier roster. Each
  policy entry carries `leash: 'spec'` (declarative leash — forces `review:human`, no behaviour-preserving
  edit possible) or `leash: 'code'` (derivation code — escalates to the independent committee, backstopped by
  a conformance suite). Matched by **basename**, deliberately, so a member travels across repos/relocations.
- `we:scripts/lib/review-policy.contract.json` — the machine-diffable policy spec; its `reasons` array
  documents `gate-self` and `statute` as two separately-described tokens.
- Statute anchors read: `#review-human-declarative-leash-only` (#2771 — the leash-vs-derivation split and its
  "an agent might be policing its own leash" rationale), `#human-is-principle-surface-not-path` (#2840 — the
  `POLICY_SPEC` declarative-leash floor: "those files ARE the encoded principle... permanently pinned"),
  `#principle-and-impl-two-pr` (#2839 — principle and its implementation never land in one diff),
  `#deterministic-core-thin-judgment` (#2607 — the hookable-vs-judgment discipline this repo already names:
  script-decidable → a deterministic mechanism; judgment stays in context), `#human-required-is-judgment-only`
  (#2851 — human gate reserved for genuine judgment), `#blast-radius-advisory-care-not-a-gate` (#2563/#2909 —
  blast-radius stays advisory care, not a park-gate, for the surfaces it covers).
- Read the actual governing-file exemplars: `we:agent-memory-src/land-on-no-regression-not-perfection.md`
  (states the land bar; its own `:63-67` already says "'policy-tier' is the path list in `BLAST_RADIUS`/
  `isGateSelfPath`/`isStatutePath`, not every file that steers agent behaviour — check the list before citing
  the gate as protection"), plus `we:agent-memory-src/complete-branch-before-labeling-ready-to-merge.md`,
  `we:agent-memory-src/producer-opens-pr-drain-reviews.md`, `we:agent-memory-src/drain-gated-build-review-resolve-loop.md`,
  `we:agent-memory-src/approve-verdict-sets-review-accepted-label.md`, `we:agent-memory-src/sweep-review-findings-to-closure.md`,
  `we:agent-memory-src/record-verdict-before-launching-converge.md`, `we:agent-memory-src/humangate-review-is-not-real-escalation.md`,
  `we:agent-memory-src/stop-hardening-an-unachievable-guarantee.md`, and the review/drain/jury/converge/pr
  skill procedures (`we:skills-src/review/SKILL.md`, `we:skills-src/drain/SKILL.md`,
  `we:skills-src/jury/SKILL.md`, `we:skills-src/converge/SKILL.md`, `we:skills-src/pr/SKILL.md`).

## Existing "hookable vs judgment" rule found

There is no separately-named statute anchor titled "hookable vs judgment" — the discipline is named inline at
`#deterministic-core-thin-judgment` (#2607): *"a script-decidable decision lives as a deterministic, tested
script... judgment is reserved for judgment-shaped work."* This item is a **classification/tier** question
(which enforcement mechanism a file falls under), not itself a candidate for hooking — the enforcement
(`scoreEscalation`, already a deterministic script) exists; what's undecided is which roster a given file
belongs in. That's a governance/taxonomy call, not new hookable logic.

## What prep did

1. Confirmed the fork is genuine (case (b), forced-invariant flavored: (a) is a demonstrated live failure via
   PR #1045).
2. Named a concrete discriminator for "governing" (a file the review/drain/jury/converge/pr skills' own
   procedure treats as an operative rule, vs a project note about unrelated subsystems) and cited exemplar
   files on both sides of the line.
3. Found and priced a genuine mechanical wrinkle under the recommended default (c): `TRUST_CHAIN`'s basename
   matcher collides on the shared skill entry-point filename (every skill's file is named `we:SKILL.md`), so
   governing skill files need a path-suffix matcher (mirroring `BLAST_RADIUS`'s existing anchored-regex
   approach for the same trees), not the shared `basenameOf` Set — memory files stay basename-matched (already
   unique).
4. Ran a throwaway skeptic sub-agent against the (c)-over-(b) choice and the matcher design, and a separate
   fresh-context two-confusion screen. Findings folded into the item's `Skeptic:`/`Screen:` lines.
5. Generated the item's provisional review-jury charter for real via `buildJuryCharter`/`renderJuryCharter`
   (`we:scripts/lib/review-core.mjs`) at `careLevel: 'high'` (statute/gate-self-adjacent) over the item's
   `scope:` touch-set.

## Outcome

Fork 1 rewritten with concrete file:line grounding, a named exemplar roster (illustrative, not exhaustive —
the actual roster is build-time curation per the item's "Done when"), the skill-matcher wrinkle solved
inline, and `Skeptic:`/`Screen:` verdicts. `preparedDate` stamped. Not resolved — ratification is the
decision-owner's call at `/next decision`.
