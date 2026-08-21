---
bornAs: xcnjqcn
kind: task
status: open
dateOpened: "2026-08-05"
tags: [review, jury, gate, security]
---

# Gate that a relaxation's compensating control is wired on the outcome path it opens

A gate relaxation is defended by naming a compensating control. The defence is only real if that control
actually RUNS on the path the relaxation opens. Twice now the control was built as a pure RENDERER, tested
in isolation, and never called from the branch that newly needed it — so the relaxation shipped with an
argument for its safety and none of the safety.

## Why it is owed

Observed on PR #1046, twice in the same feature, one layer apart.

- Round 1 (blocker 3B): `PREVENTION_IMPACT_BAR` let a below-bar uncaptured guard ride a clean `accept`.
  The defence was the operator notice (`renderPreventionSummary`) — which fires only on the `escalated`
  event, i.e. exactly the path a below-bar finding no longer takes. The fix moved the facts into
  `renderFindingLine` (`we:scripts/lib/review-render.mjs`).
- Round 2 (blocker 1): `renderFindingLine` renders correctly, but the drain's `land` / `autoLand: true`
  branch (`we:skills-src/drain/SKILL.md`) posted NO comment at all — it applied `redteam:accepted` +
  `review:accepted` and re-ran. Only the `autoLand: false` gate-self branch posted anything. The renderer
  was right and unreachable. Worse, prose asserting the opposite shipped alongside it, in both the
  reviewer-facing mandate and the JSDoc.

Both rounds passed their unit tests, because a pure renderer is trivially testable in isolation and its
call site is a natural-language instruction in a skill document that no test reads.

## The guard

A `check:standards` rule over the drain skill's TERMINAL BRANCHES — the review-skill guard in
`we:scripts/lib/review-skill-guard.mjs` (§15) is the working model: it already parses `skills-src/` +
`docs/agent/` prose for a forbidden instruction, so it can parse for a REQUIRED one.

1. Identify the terminal branches — every place the skill instructs an accept-label application
   (`--add-label review:accepted`) or an escalation. These are the outcome paths.
2. Require that each terminal branch reachable with findings in hand names a findings-EMITTING call
   (`renderPanelComment` / `renderReviewNotice` / an explicit `gh pr comment`) before the label
   application, or carries a marker documenting why that branch is legitimately silent.
3. Derive the branch set from the document, not a hand list — a new terminal branch someone adds must
   enrol itself, exactly as `we:scripts/lib/verdict-totality.mjs` derives its consumer set.

The rootCause worth encoding in the error message: the reviewer and the author both check that the control
EXISTS and is correct, because that is the part that lives in code and has tests. Nobody re-checks that the
newly-opened branch CALLS it, because that call site is prose. A relaxation must therefore be argued at the
outcome path, never at the renderer in isolation.

**Related:** the same PR's prose claimed a below-bar guard was "always visible … including on a clean accept
that auto-lands" while the emission was in fact conditional. Whatever this rule enforces, the wording of the
claim must match the wiring — an unconditional claim over a conditional emission is the same defect in
prose.

**Prevention for:** PR #1046 review, round 2 blocker 1 (`#2942`).

**Locus:** `we:scripts/check-standards.mjs`, `we:scripts/lib/review-skill-guard.mjs`,
`we:skills-src/drain/SKILL.md`

## Design

*Grounded against the live tree 2026-08-21.*

### The blocker nobody has hit yet: the drain skill is deliberately OUT of the §15 guard's scope

[we:scripts/lib/review-skill-guard.mjs](scripts/lib/review-skill-guard.mjs) `:59` sets
`GUARDED_DOC_PREFIXES = ['skills-src/review/', 'docs/agent/']` — `skills-src/drain/` is **not** in it, on
purpose, and the module's own header (`:49-58`) explains why: the drain skill's auto-land accept was a known
violation of the *single-home* rule that could not be fixed by a doc edit, so it was held out pending #2896
rather than waived. `we:scripts/check-standards.mjs` `:1978` derives its fs walk from that same constant, so
**widening the constant silently widens the single-home rule too** — and the drain skill's raw
`gh pr edit … --add-label review:accepted` (`we:skills-src/drain/SKILL.md` `:409`) would immediately go red.

So this item MUST NOT just add `skills-src/drain/` to `GUARDED_DOC_PREFIXES`. Two clean options, pick one:

- **(A) A separate scope constant for this rule.** Add `TERMINAL_BRANCH_DOCS = ['skills-src/drain/']` beside
  the existing prefix list, with its own walk entry in `we:scripts/check-standards.mjs`. Keeps the two rules'
  scopes independent, which is what they actually are. **Default.**
- **(B) Wait on #2896**, then widen the shared list once. Correct but couples this item to another's landing.

State the pick in the PR — silently doing (A) while the header still promises a single shared widening is the
kind of drift this file's own comments warn about.

### The document is already in the shape the rule needs

The `land` / `autoLand: true` terminal branch in
[we:skills-src/drain/SKILL.md](skills-src/drain/SKILL.md) (`:389-448`) is currently CORRECT — round 2's
blocker is fixed in prose. It reads: on combined `land`, *"first run the BAR-UN-BLOCKED PREVENTION CHECK,
THEN apply `redteam:accepted` THEN `review:accepted`"*, and the blockquote below it names
`renderPanelComment({ findings, verdict, disposition, lensVerdicts })` posted via
`node we:scripts/review-core-cli.mjs comment` → `gh pr comment` before the labels. The `autoLand: false`
branch (`:413-421`) names `renderReviewNotice({ event: 'escalated', … })`. So the rule's job is **pinning a
correct state**, not driving a fix — it fails only when a future edit removes the emission or adds a fourth
terminal branch with none.

That also fixes the ordering requirement concretely: the emitting call must appear **before** the label
instruction *in document order within the branch*, which is exactly what the current text does and what a
line-offset comparison can check.

### Named things the rule matches on (all verified to exist)

| token | where it lives |
|---|---|
| `renderPanelComment` | [we:scripts/lib/review-render.mjs](scripts/lib/review-render.mjs) `:120` |
| `renderReviewNotice` | [we:scripts/lib/review-core.mjs](scripts/lib/review-core.mjs) |
| `hasUncapturedPrevention` / `blocksAcceptance` / `PREVENTION_IMPACT_BAR` | [we:scripts/lib/jury-core.mjs](scripts/lib/jury-core.mjs) `:485` / `:530` / `:257` |
| the raw label application | `gh pr edit … --add-label review:accepted` in `we:skills-src/drain/SKILL.md` `:409` |

### Mechanism — copy the two house patterns, invent neither

- **Prose matching:** `RAW_SWAP_RE` in `we:scripts/lib/review-skill-guard.mjs` `:70` is the model for a
  markdown-aware, wrapped-line-tolerant match — a bounded window that never crosses a blank line, with the
  reported line derived from the match offset (`lineOf`, `:79`). Its header records exactly why line-anchored
  matching failed here before; do not repeat that.
- **Derived enrolment (requirement 3):** `checkVerdictTotality` in
  [we:scripts/lib/verdict-totality.mjs](scripts/lib/verdict-totality.mjs) `:212` is the model — discovery finds
  the sites, an **unmarked** site is itself an error, and a `@…-partial <reason>` opt-out requires a written
  reason (a bare marker is its own error, `:245-250`). Reuse that three-state shape verbatim: a terminal branch
  is `emitting` / `silent + <reason>` / unmarked→error.

### The prose-claim half is a second, weaker rule — say so

The "Related" note (an unconditional claim over a conditional emission) is **not** mechanically decidable in
general. Do not try to gate it. What IS decidable and worth doing: assert that the guarantee sentence in
`we:skills-src/drain/SKILL.md` stays the narrow one already written there — *"no land that the bar un-blocked
happens silently"*.

**A naive unconditional-phrasing substring lint would FALSE-POSITIVE on that very file — measured, not
guessed** (juror finding, 2026-08-21). An earlier draft of this section proposed flagging `always` /
`every land` / `on every accept` inside the branch block. `we:skills-src/drain/SKILL.md` already contains
`every land` **twice inside that exact block**, both in negated or hypothetical form: `:440` *"making every
land noisy would train the operator to skim past…"* and `:443` *"a claim that every finding is posted on
every land would be false."* Both are correct prose the rule is meant to PIN, and a substring match would red
the file on its first run.

So this secondary lint is **out of scope unless it is negation-aware**, and if it is built at all it needs its
own Done-when case asserting those two `:440`/`:443` sentences stay clean. Prefer the positive form instead:
assert the narrow guarantee sentence is PRESENT, rather than hunting for absent-minded absolutes.

## Done when

- `npx vitest run` against [we:scripts/lib/__tests__/review-skill-guard.test.mjs](scripts/lib/__tests__/review-skill-guard.test.mjs)
  is green with new cases over synthetic markdown fixtures: (a) a terminal branch that applies
  `--add-label review:accepted` with NO findings-emitting call before it → error; (b) the same branch with
  `renderPanelComment` named before the label → clean; (c) a branch carrying the silent-branch marker WITH a
  reason → clean; (d) the same marker BARE, no reason → its own error; (e) a branch where the emitting call
  appears AFTER the label instruction → error (order is the point). All fail today — the rule does not exist.
- A regression case pins the derived-enrolment requirement: a fixture with a FOURTH terminal branch nobody
  listed is flagged, proving the branch set comes from the document rather than a hand list.
- `node we:scripts/check-standards.mjs` → 0 errors with the rule wired in and
  `we:skills-src/drain/SKILL.md` in its scope — i.e. the live drain skill passes as written today.
- The scope decision is visible, not implicit: either a new scope constant exists beside
  `GUARDED_DOC_PREFIXES` in `we:scripts/lib/review-skill-guard.mjs` with a comment naming why it is separate,
  or `GUARDED_DOC_PREFIXES` itself widened and the `#2896` hold-out note in that file's header updated in the
  same diff. `grep -n "skills-src/drain" we:scripts/lib/review-skill-guard.mjs` returns a hit either way.
- If the secondary unconditional-phrasing lint is built at all, a case asserts `we:skills-src/drain/SKILL.md`
  `:440` and `:443` (both containing `every land` in negated form) stay CLEAN — the false-positive the naive
  substring form would produce on the file this rule exists to pin. If it is not built, the card says so and
  the criterion drops with it.
- A red-then-green proof against the real regression: reverting
  `we:skills-src/drain/SKILL.md`'s BAR-UN-BLOCKED PREVENTION CHECK blockquote (the PR #1046 round-2 state)
  makes `node we:scripts/check-standards.mjs` report the new error. Kept as a fixture in the test suite, not as
  an actual revert.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: prove the premise by mutation or reversion first) — Every citation for the primary terminal-branch rule was re-verified against we:scripts/lib/review-skill-guard.mjs, we:scripts/check-standards.mjs, we:skills-src/drain/SKILL.md, we:scripts/lib/review-render.mjs, we:scripts/lib/jury-core.mjs and we:scripts/lib/verdict-totality.mjs and all held (GUARDED_DOC_PREFIXES at :59, the #2896 hold-out header, hasUncapturedPrevention/:485, blocksAcceptance/:530, PREVENTION_IMPACT_BAR/:257, checkVerdictTotality/:212, the BAR-UN-BLOCKED blockquote already present at we:skills-src/drain/SKILL.md:422-443, #2896 confirmed still status:open). The one un-verified premise is the secondary phrasing lint — see findings.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — we:backlog/2896-the-drain-auto-accept-path-hand-rolls-the-review-label-swap-.md scopes the same file (we:scripts/lib/review-skill-guard.mjs) for a future GUARDED_DOC_PREFIXES widening; the card explicitly names this collision and picks the separate-constant option (A) specifically to decouple the two items' scopes rather than share a seam.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — The new TERMINAL_BRANCH_DOCS scope is deliberately narrowed to we:skills-src/drain/ alone rather than widening the shared GUARDED_DOC_PREFIXES (which would pull in all of skills-src/ and immediately redden the drain skill's existing raw label swap under the wrong rule).
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Independently grepped for we:scripts/lib/review-skill-guard.mjs / GUARDED_DOC_PREFIXES consumers beyond we:scripts/check-standards.mjs: only the test file and a doc-comment mention in we:scripts/lib/__tests__/doc-prose.mjs turned up, both non-functional. No unscoped consumer found.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when's last bullet requires a red-then-green proof (revert the BAR-UN-BLOCKED blockquote in we:skills-src/drain/SKILL.md, confirm we:scripts/check-standards.mjs newly errors), kept as a fixture — this is exactly the mutate-and-require-a-named-test-to-redden strategy.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The whole point of the item is converting a silent unreachable-control failure into a check-standards error; Done-when bullets (a)-(e) plus the derived-enrolment regression case pin that the failure surfaces as an error, not a silent pass.

**Corrections applied by this review:**

- The card cites RAW_SWAP_RE as living at we:scripts/lib/review-skill-guard.mjs:71; it is actually at :70 (off by one, immaterial to the design).

The card's design is thoroughly grounded against the live repo (every cited symbol/line for the primary terminal-branch rule checks out, the #2896 scope-collision is explicitly identified and mitigated, and the mutation/red-green proof is built into Done-when) — the one real gap is that its secondary "unconditional phrasing" lint is proposed without checking it against the very passing text it's meant to validate, and that text already contains the trigger substring in negated form.

_Recorded through the declared `review-prep` operation._
