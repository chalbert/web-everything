---
kind: decision
size: 3
status: open
dateOpened: "2026-08-02"
preparedDate: "2026-08-02"
tags: [governance, two-pr-rule, principle-surface, check-standards, write-gate, sequencing]
---

# Principle changes must be separate from implementation — the two-PR rule

**Principle statement.** A **principle change** and the **implementation** that carries it may not travel
in the same diff. A single change either authors/weakens a **principle surface** — a statute anchor in
`we:docs/agent/platform-decisions.md`, or a `@principle` / `@invariant`-marked assertion that encodes a
guarantee — OR it changes implementation code. Never both. The principle PR is the **human** step
(`review:human`, ratified by the operator); the implementation PR is the **mechanical** step (an agent
lands code + the invariant test that ENFORCES the just-ratified principle). They land in that order, in
two PRs.

This is the sequencing discipline the sibling gate-narrowing decision (`#xhrni4v`) depends on: `#xhrni4v`
only lets behaviour-preserving impl go mechanical *because* a principle is ENCODED as an invariant — and
that encoding must ride the impl PR, never smuggle into the ratification PR. This decision is itself
authored under its own rule: it is a principle, so it lands in a decisions-only PR parked `review:human`
alongside `#xhrni4v` and `#x2w4qbf`, with zero implementation.

## Current state

Nothing stops one diff from doing both. A PR may edit a statute anchor AND the code the anchor governs in
the same commit — so the operator ratifying the principle is simultaneously accepting an implementation
they did not separately review, and a diff-only reviewer cannot tell "the human ratified this rule" from
"the human happened to also approve this code." The existing statute gate
(`we:scripts/lib/review-escalation.mjs#isStatutePath`) forces `review:human` on the whole mixed diff, but
that is the wrong grain: it human-gates the impl *because* the principle rode along, instead of forcing
them apart. There is no write-time refusal of the both-touch shape.

## The change

A single diff may **NOT** touch both a principle surface and implementation code. Enforced two ways:

1. **Write-time refusal.** A `check:standards` gate — same shape as the shared-gate write guard
   (`we:scripts/lint-locus-prefix.mjs --pre`, the `PreToolUse(Edit|Write)` deny path, per memory rule #43)
   — scans the changed-file set and **REFUSES** when it touches both a principle surface and impl. One or
   the other, never both.
2. **Sequencing.** The **principle PR** (human-ratified) lands FIRST; the **implementation PR** (code + the
   invariant test that ENFORCES the ratified principle) lands SECOND, mechanically.

**Scope note — what is NOT a principle change.** Adding *enforcement* of an **already-ratified** principle
is implementation: the invariant test that encodes a ruled principle rides the impl PR and is mechanical
(the committee clears it). Only **authoring a NEW** principle or **WEAKENING** an existing one is the human
step. This mirrors the ratified codification split
(`we:docs/agent/platform-decisions.md#review-human-declarative-leash-only`, Fork B / #2771): mechanically
codifying a call the human already made is committee-clearable, not a fresh human gate.

## Mechanical enforcement design (the concrete gate)

A **write-time `check:standards` gate**, `assertNotPrincipleAndImpl(changedFiles, diffHunks)`, in
`we:scripts/check-standards-rules.mjs`, invoked from both the `PreToolUse(Edit|Write)` deny path
(shift-left, per rule #43) and the whole-tree `check:standards` run (durable backstop):

- **`principleTouch`** = any changed file/hunk that is a **principle surface**, reusing `#xhrni4v`'s
  `isPrincipleSurface` detector: a statute-anchor edit in `we:docs/agent/platform-decisions.md`, OR an edit
  to a `@principle` / `@invariant`-marked assertion.
- **`implTouch`** = any changed file that is executable/impl code (`.mjs` / `.ts` / `.cjs` / `.json`
  config) and is NOT itself a principle surface this diff. A `@principle`-marked test file counts as
  `principleTouch` only for the marked hunks; unmarked hunks in the same file count as `implTouch` — so the
  test file that *adds* an invariant (unmarked-until-committed) rides the impl PR, and the diff that
  *edits an existing marked* invariant is the principle PR.
- **REFUSE** (exit 2 on the write path; hard error on the tree path) iff `principleTouch && implTouch`.
  The message names both sides and points at the split: "principle surface `X` and impl `Y` in one diff —
  split into a ratification PR (principle only) and a follow-on impl PR."
- **Sequencing check (backstop).** The impl PR that adds an invariant enforcing anchor `#A` must cite a
  `codifiedIn: …#A` decision already `status: resolved` on `main`; an enforcing invariant landing *ahead*
  of its ratified anchor is a hard error (`check:standards`), so impl can never precede the human ruling it
  enforces.

The gate is a pure function over `{changedFiles, diffHunks}` — the same signal set `#xhrni4v`'s trigger
and the existing locus-prefix write guard already consume — so it composes with them at one write-time
seam, no new plumbing.

## RISK

**Over-refusal blocks a legitimately atomic change** — e.g. a rename that must touch a `@principle` marker
comment and its call-site together, or a doc-only typo fix inside an anchor body that a reviewer would wave
through. If the both-touch test is coarse, it forces an artificial two-PR split on changes that carry no
real principle decision, adding ceremony for no oversight gain (the smart-glue-in-reverse failure: process
that costs more than the risk it removes).

## SAFEGUARD

The gate keys on **`isPrincipleSurface`, not on file path** — so it only ever fires when a diff genuinely
edits a statute anchor's rule or a marked guarantee, not on incidental touches to a trust-chain file. A
pure-impl change to `we:scripts/lib/review-escalation.mjs` (no anchor, no marked invariant) has
`principleTouch = false` and passes untouched. And the refusal is always satisfiable by the intended
action — **split the PR** — never by weakening a principle, so the escape hatch is the correct behaviour,
not a bypass. The rename case is handled by the marked-hunk grain (a marker-comment-only touch that
changes no rule text is not a statute-anchor edit).

## Options

| Option | Shape | Verdict |
|--------|-------|---------|
| **A — two-PR rule, write-time refusal (recommended)** | refuse a diff touching both principle surface + impl; principle PR first, impl PR second | the operator ratifies a rule in isolation; impl is mechanical and cites the ratified anchor |
| B — status quo (mixed diffs allowed) | one PR may carry both, statute gate human-gates the whole thing | the human accepts unreviewed impl by ratifying a rule; provenance is muddy |
| C — convention only (no gate) | document "keep them separate", rely on authors | REJECT — the operator's directive is "enforced not just by instruction but by mechanical gating"; a convention is exactly the unenforced instruction |

## Recommendation

**Adopt A.** It makes the ratification act clean — the operator sees a principle and only a principle — and
turns enforcement of that principle into ordinary mechanical impl the committee clears. It is the
structural precondition for `#xhrni4v` (an invariant can only make impl "mechanical" if the invariant
itself never smuggled through the human gate) and for `#x2w4qbf` (the enforce-flip's readiness record is
only trustworthy if principle and impl are separable events). The write-time gate is the mechanical
enforcement the directive demands; the implementation of that gate is itself a follow-on impl PR under this
very rule — this PR authors only the principle.

**Lineage:** extends `we:docs/agent/platform-decisions.md#human-required-is-judgment-only` (the human step
is judgment — authoring/weakening a principle — not the mechanical enforcement of one) and the codification
split of `we:docs/agent/platform-decisions.md#review-human-declarative-leash-only` (#2771 — codifying an
already-ruled call is committee work). Enforcement placement mirrors memory rule #43 (the write-time
`PreToolUse` deny gate) and the shared-gate shape of `we:scripts/lint-locus-prefix.mjs`.
