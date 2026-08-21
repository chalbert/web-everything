---
bornAs: xyl12xs
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, statute-lint, prevention, anchor-overlap]
---

# Statute-lint: a new anchor citing an existing anchor must carry an explicit relation line

When a new statute anchor cites an existing anchor, the relationship — does it compose, extend, supersede, or narrow it? — is left implicit, so a new rule can silently alter a prior one. Add a statute-overlap rule: a NEW `{#anchor}` whose body cites an existing anchor must carry an explicit relation line — one of "composes with — does not alter", "extends", "supersedes", or "narrows".

## Gap

`we:scripts/lib/validate-rules-anchors.cjs` does not require a new anchor to declare how it relates to any existing anchor it references. Overlap is currently expressed (or not) in free prose.

## Why it matters

Statute is reversible-with-lineage: a later rule may narrow or supersede an earlier one, but only *explicitly*. An unlabelled cite lets a new anchor quietly shift the meaning of an existing one, breaking the "compose, don't mutate" discipline. This is exactly the shape the PR #982 review flagged — the diff added four cross-linked anchors, and the review required each cross-anchor cite to state its relation (e.g. `#2398` relation relabelled narrows→applies in commit `26f992a0`).

**Why the label alone is insufficient (round-3 finding R3).** The originating defect was round 2's blocker B3: the anchor carried a `composes with — does not alter — #2398` line while in fact NARROWING #2398 (it asserted a "separate session or service" bar that #2398 never sets — #2398 permits an in-process role-separated subagent given fresh context). A presence-only lint sees the required vocabulary phrase and passes, so **the very finding that produced this item would still land green**. Clause 2 of the mechanical fix is therefore load-bearing, not a refinement.

## Mechanical fix

In `we:scripts/lib/validate-rules-anchors.cjs`, when a NEW anchor's body references an existing anchor id:

1. **Relation label (presence).** Error unless an explicit relation line accompanies the cite — from a fixed
   vocabulary: `composes with — does not alter` / `extends` / `supersedes` / `narrows`.
2. **Relation FIDELITY (the half that closes the class).** A label alone is not enough: a `composes with — does not
   alter` claim must be *true*. When an anchor asserts identity or non-alteration with a cited anchor, the gate must
   locate the cited anchor's normative sentence inside the cited body — else require `extends` / `narrows` /
   `supersedes` instead. **Without this clause the lint is satisfied by writing the phrase**, which is exactly the
   defect it was filed for (see Why it matters).
3. **Reconcile with #2852** (the duplication lint) so fidelity is satisfied by a LINK plus a short relation
   label, never by copying the cited anchor's text into the new one — otherwise clause 2 becomes a licence to quote,
   and the two guards pull against each other.

## Provenance

Outstanding prevention **M1** from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). *(Stale pointer corrected 2026-08-21: this line used to say enforcement "belongs on the open
conveyor-mechanization line (#2840 / #2785)". Both of those are `status: resolved` — verified — so following
that pointer lands on a dead end. Enforcement belongs here, in `we:scripts/lib/validate-rules-anchors.cjs`,
under this card's parent #2822; this item does not reopen the resolved decisions.)*

## Design

*Grounded against the live tree 2026-08-21.*

### Where it lands

[we:scripts/lib/validate-rules-anchors.cjs](scripts/lib/validate-rules-anchors.cjs) — CommonJS, `module.exports`
at `:564`. It already owns every statute-anchor pass, each a small pure helper over the doc source:
`collectExplicitAnchorDefs` (`:87`), `findDuplicateAnchors` (`:95`), `findOrphanAnchors` (`:116`),
`collectAnchorReferences` (`:131`), `anchorSubstance` (`:143`), `validateAnchorSubstance` (`:169`), with
`runStatuteCheck` (`:520`) as the entry point over `we:docs/agent/platform-decisions.md`. The new rule is one
more helper in that family plus an export; the test home is
[we:scripts/__tests__/rules-anchors.test.mjs](scripts/__tests__/rules-anchors.test.mjs).

`anchorSubstance` (`:143`) already knows how to *find* an anchor's body span — from its definition line
(explicit `{#id}`, slugged heading, or raw-HTML `id=`) to the next heading. **But it returns a normalized
character COUNT, not the text** (`:160` — `return body.join(' ')…​.length`), so it cannot be called directly to
get "the new anchor's body". Factor its span-finding loop out into a small shared helper that returns the
body text, and have `anchorSubstance` call that and take `.length` — one span-finder, two consumers. Do not
duplicate the loop (correction from independent review, 2026-08-21: an earlier draft said the function could
be reused as-is, which is wrong).

### "NEW" is the hard part, and the mechanism already exists in-repo

Every existing pass here is **whole-corpus**: `runStatuteCheck` reads the file and checks all of it.
`we:docs/agent/platform-decisions.md` carries **124** explicit `{#…}` anchors today, so a whole-corpus version
of this rule would demand a relation line be retrofitted onto the entire statute — not this item's job, and a
guaranteed way to make the gate un-landable.

Do not invent a scoping scheme. [we:scripts/check-standards.mjs](scripts/check-standards.mjs) `:1242-1275`
(the #3026 provenance gate) already implements exactly this: `git merge-base origin/main HEAD`
→ `git diff --unified=0 $BASE -- docs scripts`
→ a per-file set of ADDED line numbers, base→**working tree** so uncommitted prose is gated too. Crucially it **fails LOUD** when the base cannot be resolved — it emits a
`provenance-gate-unscoped` warning saying the check did not run, rather than reporting clean. Copy that
mechanism *and that failure policy*. An anchor is NEW when its `{#id}` definition line is in the added set.

This puts the git call in `we:scripts/check-standards.mjs` (where it already lives) and keeps the rule in
`we:scripts/lib/validate-rules-anchors.cjs` pure, taking the added-line set as an argument — the same
pure-rule / impure-caller split every other pass in that file uses.

### Clause 1 is straightforwardly buildable

A fixed relation vocabulary (`composes with — does not alter` / `extends` / `supersedes` / `narrows`), required
on the same line as — or within a small line window of — the cite, inside a NEW anchor's body span. Note the
em-dash: the phrase as written in the card uses `—`, and PR #982's real relabel (`narrows` → `applies`) shows
the vocabulary is not yet settled — `applies` is a fifth word already used in the corpus. Enumerate the
vocabulary from the corpus before freezing it, and put the frozen list in ONE exported constant.

### Clause 2 collides with #2852's ruling — rule the fork before building that half

Read [we:backlog/2852-statute-lint-flag-verbatim-duplication-between-a-new-anchor-.md](backlog/2852-statute-lint-flag-verbatim-duplication-between-a-new-anchor-.md)
before building clause 2. Its Mechanical-fix clause 3 rules the opposite direction, explicitly:

> *"Reconcile with #2850 in ONE rule: satisfy relation-fidelity by requiring a LINK plus a short relation label,
> **never** by requiring a quotation. If #2850 lands first as a quote-the-source check, this item supersedes
> that half."*

Clause 2 here says the gate must "locate the cited anchor's normative sentence inside the cited body". Any
mechanical form of that is a quote-or-substring check — precisely what #2852 forbids and what its clause 1
(warn on a shared verbatim run of ≥12 words) would then flag. The two cards, as written, cannot both be built.

Beyond the collision, the underlying question — *is this `composes with — does not alter` claim TRUE?* — is a
semantic judgment, not a script-decidable property. The originating defect (an anchor asserting a
"separate session or service" bar #2398 never sets) is exactly the kind of divergence only a reader catches.

**So clause 2 is a live fork and should be carved, not guessed.** Candidate resolutions, none picked here:
(a) drop clause 2 from this item and let #2852's overlap warning be the fidelity signal; (b) require the
relation line to name the cited anchor's normative sentence by **anchor + line reference** rather than by
quoting it — locatable, not copied, and decidable as a resolvable reference; (c) treat a
`composes with — does not alter` label on a NEW anchor as a `review:human` trigger rather than a lint.
Whoever builds this must settle it first (see #2886's carve pattern) — do not ship clause 1 while leaving
clause 2's prose standing as though it were also being built.

## Done when

- `npx vitest run` against [we:scripts/__tests__/rules-anchors.test.mjs](scripts/__tests__/rules-anchors.test.mjs)
  is green with clause-1 cases over synthetic doc fixtures: a NEW `{#anchor}` whose body cites an existing anchor
  and carries NO relation phrase → error naming the anchor and the line; the same with each vocabulary phrase →
  clean; an anchor NOT in the added-line set with an unlabelled cite → **not** flagged (the grandfathering that
  makes this landable); and a relation phrase from outside the frozen vocabulary → error. All fail today — the
  rule does not exist.
- The vocabulary is one exported frozen constant in `we:scripts/lib/validate-rules-anchors.cjs`, and a test
  asserts every phrase currently used in `we:docs/agent/platform-decisions.md` is a member — so the list is
  derived from the corpus, not hand-guessed. (`applies`, used in PR #982's commit `26f992a0`, is the known case
  the card's four-word list omits.)
- `node we:scripts/check-standards.mjs` → 0 errors on `main` with the rule wired in, i.e. the existing 124
  anchors are untouched and only newly-added ones are gated.
- The scope failure is LOUD, not silent: with no resolvable `git merge-base origin/main HEAD`, the run emits a
  warning saying the anchor-relation check did not run — asserted as a case, mirroring
  `we:scripts/check-standards.mjs`'s `provenance-gate-unscoped` warning at `:1251-1254`.
- **Clause 2 carries no tier-1 criterion, and that is deliberate** — relation *fidelity* ("is this
  `composes with` claim true?") is a semantic judgment, and its mechanical forms are ruled out by #2852. It is
  an open fork (see `## Design`) that must be settled before it is built; this item's provable surface is
  clause 1 plus the NEW-anchor scoping.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: prove the premise by mutation or reversion first) — The card's Provenance line (we:backlog/2850-statute-lint-a-new-anchor-citing-an-existing-anchor-must-car.md:41) claims enforcement 'belongs on the open conveyor-mechanization line (#2840 / #2785)'; both are verified status: resolved in we:backlog/2840-human-principle-not-implementation-narrow-gate-self-from-pat.md and we:backlog/2785-implement-the-narrowed-review-human-rubric.md — an unverified premise the card copied without checking against the live repo it claims to be grounded in.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — The card explicitly measures the corpus (124 anchors, verified) and reuses we:scripts/check-standards.mjs's #3026 NEW-line mechanism instead of a whole-corpus retrofit — a concrete, verified mitigation.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The design names only we:scripts/check-standards.mjs as the caller to wire the added-line set through, but we:scripts/check-statute.mjs is a second, real, standalone caller of the same runStatuteCheck() (npm script check:statute) that the card's Done-when never accounts for.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The card explicitly negotiates the seam with the sibling we:backlog/2852-statute-lint-flag-verbatim-duplication-between-a-new-anchor-.md card (quoting its clause 3 verbatim) and defers the conflicting half rather than building two guards that fight.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The card's own 'Why the label alone is insufficient' section names clause 1 alone as gameable by exactly the R3 defect, and its Done-when explicitly discloses that only the presence check ships now — an honest, legible disclosure rather than a silently shipped no-op.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card states plainly that clause 2 is 'load-bearing, not a refinement' for closing the originating defect, and that the item's provable surface is deliberately narrower than the full fix — sized and stated, not hidden.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when requires the loud provenance-gate-unscoped warning (verified to exist verbatim at we:scripts/check-standards.mjs:1250-1254) rather than a silent pass when the git base can't resolve.

**Corrections applied by this review:**

- The Provenance section's claim that enforcement 'belongs on the open conveyor-mechanization line (#2840 / #2785)' is false — both items are status: resolved, and #2853 (open) already exists specifically to correct this exact stale-pointer pattern in sibling documents.
- The Design section's claim that anchorSubstance (we:scripts/lib/validate-rules-anchors.cjs:143) can be reused directly to get 'the new anchor's body' is imprecise — the function returns only a normalized character-count length (line 160), not the body text/span, so its span-finding loop must still be factored out or duplicated.

The design is well-grounded (line numbers, the 124-anchor count, the R3/B3 history, the em-dash vocabulary, and the #2852 fork are all independently verified against the live repo), but the card carries a real stale-status citation and misses a second live consumer of the function it plans to modify.

_Recorded through the declared `review-prep` operation._
