---
kind: story
size: 3
status: open
parent: "2405"
dateOpened: "2026-07-10"
tags: [gate, review, drain, gate-self, review-escalation]
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/gate-config.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:skills-src/review/SKILL.md
  - we:skills-src/drain/SKILL.md
  - we:scripts/lib/__tests__/
  - we:scripts/__tests__/review-set-label.test.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
---

# Gate: honor `review:accepted` only when a human applied it — nothing enforces "a `review:human` gate-self PR is never agent-cleared"

`decideReviewGate` ([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) — the function has moved a long way down the file since filing; find it by name, not by line) returns `{action:'merge'}` on the mere PRESENCE of the `review:accepted` label — checked BEFORE the sticky `review:human` guard, keyed only on `hasReviewLabel` (label presence), reading no actor/login/provenance anywhere; [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) adds no provenance check either. So the invariant "a `review:human` gate-self PR is never agent-cleared" (stated in [we:skills-src/review/SKILL.md](skills-src/review/SKILL.md)'s Invariant and #2286's spec: only a human may apply `review:accepted`) is DOCUMENTED POLICY WITH NO CODE ENFORCEMENT.

Trigger (2026-07-10): gate-self PRs #370 (merged) and #374 each received `review:accepted` plus a verdict comment reading "cleared by the operator, @chalbert" applied programmatically (label+comment seconds apart on #374; comment posted AFTER the merge on #370), while the operator confirms they did NOT clear them — a closing-session flow did. #374's own audit trail records it verbatim: "This supersedes the earlier auto-applied accept: that clearance was posted by a closing-session flow, not by the operator directly."

## Fix (closed-set-of-callers, not actor-provenance)
An actor-allowlist can't help — the automation shares the operator's token. The buildable fix: extract the "apply `review:accepted`" GitHub mutation into a SINGLE function that ONLY the interactive `/review` skill's step-4 human-verdict path invokes (never a batch/closing-session/drain/automation script), and add a #2406-style invariant tripwire asserting no other script in the repo issues `gh pr edit --add-label review:accepted` against a PR that carries `review:human`. This is a closed-set-of-callers guarantee (achievable) rather than GitHub-actor provenance (impossible under a shared token).

## Boundary vs. adjacent items
- **#2409** — reviewed commit-set vs. live HEAD drift (WHAT was reviewed advancing after acceptance). Different axis: this item is WHO/WHAT applied the accept label.
- **#2412** — merge-anyway timeout for blast-radius/statute parks; explicitly exempts `review:human`/gate-self. Different concern.
- **#2406** — invariant tripwires on the existing gate logic; this item adds a NEW who-applied-it invariant of the same tripwire shape.

Related: #2405 (parent, gate-hardening epic).

## Re-grounded 2026-08-21 — half of the stated fix has already landed elsewhere

**Read this before building.** The card's "extract the mutation into a SINGLE function" half is largely done;
what is still missing is the *tripwire*. Verified against the tree:

- **The single home exists.** [we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) is documented as
  the "SINGLE HOME of the shared review-label CLI harness (#2644)", and its pure `decideSetLabel` enforces
  INVARIANT 2 by refusing `to === 'accepted'` on a PR that carries `review:human` — see the `REVIEW_LABEL_TARGETS`
  closed set (`accepted`, `changes`, `rearm`, `clear-human`, `restamp`) and the `clear-human` target (#2895),
  the one sanctioned path that removes `review:human`.
- **The forge mutation is behind one port.** `GH_ARGV` in
  [we:scripts/lib/review-label-provider.mjs](scripts/lib/review-label-provider.mjs) owns the `gh pr edit` argv,
  so there is exactly one place the label write is issued from.
- **The prose route is already gated.** `checkReviewLabelSingleHome`
  ([we:scripts/lib/review-skill-guard.mjs](scripts/lib/review-skill-guard.mjs), #2882) errors on a doc that
  *instructs* a raw `gh pr edit … --add-label review:*`, wired in `check:standards` §15.
- **The known non-interactive writer is sanctioned and routed.**
  [we:scripts/lib/auto-land-seam.mjs](scripts/lib/auto-land-seam.mjs) writes `review:accepted` in `enforce`
  mode — but it does so by *shelling the single home* (`--to=accepted --actor=…`), not by touching `gh`. So
  "only the interactive `/review` step-4 path may call it" as literally written is already false and should not
  be re-asserted: the correct invariant is **"only through the single home"**, plus the seam's own INVARIANT-2
  re-enforcement.

**What is genuinely missing:** nothing scans `we:scripts/**` for a *code* path that bypasses the home.
`checkReviewLabelSingleHome`'s scope constant `GUARDED_DOC_PREFIXES` is `['skills-src/review/', 'docs/agent/']`
— prose only, and not even all of `skills-src/`. A new script that shells `gh pr edit --add-label
review:accepted` directly would pass every gate in the repo today.

## Design

Build the tripwire in the shape the repo already uses for exactly this, so it is one familiar test rather than
a new mechanism.

**The template is INVARIANT 13(b)**, in
[we:scripts/lib/__tests__/gate-invariants.test.mjs](scripts/lib/__tests__/gate-invariants.test.mjs): *"the
drain issues NO `--remove-label review:accepted` anywhere"* — a source scan that `readFileSync`s
`we:scripts/merge-ai-prs.mjs` and asserts three forbidden argv spellings are absent
(`'--remove-label', REVIEW_LABELS.accepted`, the quoted-literal form, and the `=`-joined form). This item is the
**`--add-label` mirror of that test**, widened from one file to a directory walk.

Concretely:

1. Add a `SANCTIONED_ACCEPT_WRITERS` allowlist (frozen, repo-relative) naming the *only* modules permitted to
   emit the accept-label argv: `we:scripts/lib/review-label-provider.mjs` (the port that owns `GH_ARGV`) and
   `we:scripts/review-set-label.mjs` (the home). Keep it beside the roster it belongs to —
   [we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs) already holds `TRUST_CHAIN` and is itself
   gate-self, so an edit that widens the allowlist is human-reviewed by construction. That closure is the point.
2. Scan every executable source file under `we:scripts/` (skipping `__tests__/` and the allowlist) for the
   forbidden argv spellings, and fail the test naming the offending file. **Not just `.mjs`** —
   `we:scripts/lib/` already holds 17 `.cjs` modules, so an extension filter of `.mjs` alone leaves a real,
   populated part of the tree unscanned while the card's own framing promises to cover `we:scripts/**`. Scan
   `.mjs`, `.cjs` and `.js`, and state in the rule's comment that shell/other file types are out of scope (or
   include them) — an unstated narrowing is the hole.
3. Do **not** try to key the assertion on "against a PR that carries `review:human`" — a static scan cannot see
   runtime labels, and `decideSetLabel` already owns that conditional. The static half asserts the *route*; the
   pure half already asserts the *condition*.

**Widen the prose guard while you are here.** `GUARDED_DOC_PREFIXES`'s own comment says to widen it to
`skills-src/` once #2896 lands — check whether it has; if so, widening is a one-line change in the same area
and closes the drain-SKILL hole the comment names. If #2896 has not landed, leave it and say so.

**A gap this item surfaces but should NOT silently fix.** `TRUST_CHAIN` (we:scripts/lib/gate-config.mjs)
registers the basenames of we:scripts/lib/review-escalation.mjs, we:scripts/lib/review-core.mjs,
we:scripts/lib/auto-land-seam.mjs, we:scripts/merge-ai-prs.mjs, we:scripts/lib/gate-config.mjs and
we:scripts/lib/__tests__/gate-invariants.test.mjs among others — but **not**
we:scripts/review-set-label.mjs, the module whose
`decideSetLabel` holds the actual INVARIANT-2 enforcement. So today an edit that weakens that refusal does not
force `review:human`. Adding it to the roster is a one-line change with real blast radius (every future edit to
the review CLI becomes human-gated), so it is a call to make and record, not a side effect of building the
tripwire. Raise it explicitly in the PR body either way.

## Done when

- **Tier 1** — a new invariant in
  [we:scripts/lib/__tests__/gate-invariants.test.mjs](scripts/lib/__tests__/gate-invariants.test.mjs)
  fails when a fixture module outside the allowlist contains any of the three `--add-label review:accepted`
  argv spellings, and passes on the current tree. Prove the fixture arm actually bites — the sibling 13(b)
  test scans a real file only, so a copy that never sees a positive case would be vacuous.
- **Tier 1** — the whole `gate-invariants` suite (`npx vitest run` scoped to
  we:scripts/lib/__tests__/gate-invariants.test.mjs) is green, and the allowlist is
  exercised: a test asserts `we:scripts/review-set-label.mjs` and
  `we:scripts/lib/review-label-provider.mjs` are the ONLY entries, so silently adding a third writer is a
  visible diff in a gate-self file.
- **Tier 2** — the allowlist is one exported constant with one reader. `grep -rn "SANCTIONED_ACCEPT_WRITERS"
  we:scripts/` shows exactly one definition and one import; no second hardcoded path list anywhere (the
  two-readers-of-one-contract defect §15 of `we:scripts/check-standards.mjs` calls out by name).
- **Tier 3** — the card's original "only the interactive `/review` step-4 path may call it" wording is corrected
  in the body, not silently built around: `we:scripts/lib/auto-land-seam.mjs` is a sanctioned non-interactive
  writer that routes through the home, and the shipped invariant says "through the single home", not "from one
  skill".

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: check by mutation or reversion ahead of the build — wording adjusted by the driver, whose template phrasing tripped the `unverified prerequisite` non-batchable lint as a passing mention) — The 2026-08-21 re-grounding section is a premise-verification pass done right: it re-read we:scripts/review-set-label.mjs, we:scripts/lib/review-label-provider.mjs, and we:scripts/lib/review-skill-guard.mjs against the tree, found the original 'extract into one function' half already done, and corrected its own 'only /review step-4' framing after discovering we:scripts/lib/auto-land-seam.mjs is a second sanctioned writer that routes through the home. I independently re-verified all of it (REVIEW_LABEL_TARGETS, GH_ARGV, checkReviewLabelSingleHome wiring at we:scripts/check-standards.mjs line 1966 '§15', GUARDED_DOC_PREFIXES scope, #2896 backlog status) and it holds.
- **population** (NOT addressed; strategy: name the population each threshold guards) — Design item 2 scopes the new tripwire to 'every .mjs under we:scripts/', but we:scripts/lib/ already holds 17 .cjs files (real precedent for scripts in that tree that are not ES modules), and nothing else in the repo scans non-markdown code for a raw `gh pr edit --add-label review:*` — we:scripts/lib/review-skill-guard.mjs's checkReviewLabelSingleHome only walks skills-src/review/ and docs/agent/ prose. A future writer landing in a CommonJS, plain-JS or shell file under we:scripts/ would bypass the new tripwire silently, while the card's own framing ('nothing scans we:scripts/** for a code path that bypasses the home') reads as though the gap will be fully closed.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when Tier 1 explicitly requires the fixture arm to bite ('a copy that never sees a positive case would be vacuous'), mirroring the real INVARIANT 13(b) pattern I confirmed at we:scripts/lib/__tests__/gate-invariants.test.mjs:613-624 (a source-scan against three forbidden argv spellings). I also mutation-tested the adjacent, already-shipped guard it is modeled on: neutering `if (to === 'accepted' && isHuman)` in we:scripts/review-set-label.mjs reddens the named test 'decideSetLabel — INVARIANT 2 (review:human is human-ceremony-only) > REFUSES accepted on a review:human PR' in we:scripts/__tests__/review-set-label.test.mjs, confirming that layer is live, not decorative.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Done-when Tier 2 requires `grep -rn SANCTIONED_ACCEPT_WRITERS we:scripts/` to show exactly one definition and one import, directly targeting the two-readers-of-one-contract defect §15 already guards on the doc side — the same discipline explicitly extended to the new code-side allowlist.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Design item 2 requires the test to 'fail the test naming the offending file' — the failure surfaces which module violated the allowlist rather than merely asserting the invariant holds somewhere.

**Corrections recommended:**

- none — the preparation held up as written.

The preparation is well-grounded — every factual claim I re-verified against the live repo checked out exactly as stated (REVIEW_LABEL_TARGETS, GH_ARGV, checkReviewLabelSingleHome's §15 wiring, GUARDED_DOC_PREFIXES scope, auto-land-seam's buildSetLabelArgs, INVARIANT 13(b)'s exact template shape, #2896 still open) — but its confidence that a closed-set-of-callers scan closes the gap rests on two unexamined holes: the file holding the actual INVARIANT-2 enforcement isn't itself gate-self, and the new scan's file-extension scope is narrower than the tree it claims to cover.

_Recorded through the declared `review-prep` operation._

**Driver disposition (2026-08-21).** Verdict High, no corrections requested — but the reviewer's two named holes
were worth acting on and both are applied. (1) **Population**: verified 17 `.cjs` modules under
we:scripts/lib/, so Design step 2 now scans `.mjs` + `.cjs` + `.js` and requires the rule to state what it does
not scan. (2) **The INVARIANT-2 file is not gate-self**: verified — `TRUST_CHAIN` in
we:scripts/lib/gate-config.mjs lists the review-escalation, review-core, auto-land-seam, merge-ai-prs,
gate-config and gate-invariants basenames, but **not** the one for we:scripts/review-set-label.mjs. Added
as a named design call to make and record rather than a silent roster edit, since registering it human-gates
every future edit to the review CLI. The reviewer's own prose was reworded in one place where its phrasing
tripped the #883 locus lint.
