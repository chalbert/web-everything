---
bornAs: xpi4ncm
kind: story
size: 2
status: open
dateOpened: "2026-08-02"
relatedTo: ["2882", "2416", "2409"]
tags: [review, gate, gate-self, skill, invariant]
scope:
  - we:backlog/2882-route-review-through-the-shared-review-label-cli-instead-of-.md
  - we:scripts/review-set-label.mjs
  - we:skills-src/review/SKILL.md
---

# Name the sanctioned gate-self override /review needs before routing its accept through the shared label CLI

#2882 tells `/review` to call the shared label CLI for both verdicts, but `decideSetLabel` refuses an accept on a `review:human` PR and never removes that label — so the item as written strands every gate-self PR.

## Where this came from

A `/review` pass over PR #1003 (the PR that filed #2882/#2883/#2884), red-teamed afterwards. Three findings
of six survived the red-team; this item carries the one rated blocking. The others are #2884's buried fork
and the buried-fork lint's blind spot, filed alongside.

## The contradiction

[we:scripts/review-set-label.mjs](scripts/review-set-label.mjs#L79-L87) — `decideSetLabel`'s INVARIANT 2 —
returns `{ allowed: false, reason: 'gate-self: review:human is human-ceremony-only — clear via /review in a
session' }` whenever `to === 'accepted'` and the PR carries `review:human`. The CLI then exits 1 without
touching a label ([we:scripts/review-set-label.mjs](scripts/review-set-label.mjs#L207-L211)). There is no
escape: the argv parse recognises only `--repo=`, `--actor=`, `--to=` and the positional PR number, the
module reads no `process.env`, and its own docblock says the refusal "lives in the PURE core so it is
unbypassable — the CLI cannot route around it. Do NOT weaken it."

#2882's first Definition-of-done bullet says `/review` steps 4-5 must invoke that CLI "for both verdict
paths" and that "the raw `gh pr edit` / `gh pr comment` instructions are gone". Built literally, a
`review:human` PR becomes unclearable by any path — strictly worse than today, and it breaks the exact tier
#2882's own "consequence 2" exists to protect. The refusal message tells the caller to use `/review`; #2882
routes `/review` into the refusal.

## A second break, in the same bullet

Even if the refusal were lifted, the accept branch
([we:scripts/review-set-label.mjs](scripts/review-set-label.mjs#L91-L99)) returns
`removeLabels: [REVIEW_LABELS.pending]` and **never removes `review:human`** — while
[we:skills-src/review/SKILL.md](skills-src/review/SKILL.md#L50) requires the human accept to drop it. So the
CLI as it stands cannot express the human ceremony even with permission. Both halves have to be designed
together.

The `changes` path is unaffected — always allowed, correctly keeps `review:human`. Only the accept path on a
gate-self PR is broken.

## Also: the root-cause narrative to correct, in two places

#2882 attributes PR #983's stale marker to "the drain's own advisory-review stamp, two rounds old". No drain
path emits a `reviewed-sha` marker. `buildReviewedShaMarker` has exactly one non-test caller —
[we:scripts/review-set-label.mjs](scripts/review-set-label.mjs#L274) — and every marker-bearing comment on
PR #983 is a human `/review` accept. The real sequence: the 21:58Z accept omitted the marker, so
`parseReviewedSha` fell back to the **earlier human accept's** stamp from 20:52Z and judged it stale.

This error is inherited, not invented: [we:skills-src/review/SKILL.md](skills-src/review/SKILL.md#L62)
already says "which is then the drain's own older advisory-review stamp". Correcting #2882 alone leaves the
wrong statement in the skill it proposes to rewrite. Fix both or neither.

## Current state (re-grounded, 2026-08-21) — most of this shipped; a factual correction and one edge remain

This item was filed 2026-08-02 as a *blocker on #2882*. Both #2882 (`status: resolved`, 2026-08-03) and its
successor #2895 (`status: resolved`, 2026-08-06) have since landed, and #2895 built exactly the sanctioned
override this item asked to be named. Re-read the code before treating anything above as current:

- **The override exists and is a target, not a flag.** `decideSetLabel` in `we:scripts/review-set-label.mjs`
  now closes over `REVIEW_LABEL_TARGETS = ['accepted', 'changes', 'rearm', 'clear-human', 'restamp']`. The
  `clear-human` branch is the ONE target that removes `review:human`: on a PR carrying it, it returns
  `addLabel: REVIEW_LABELS.accepted` and `removeLabels: [human, pending, changes]`, `keepsHuman: false`; on a
  PR without it, it refuses (`'no review:human label — nothing to clear'`). Both halves this item said "have
  to be designed together" — permission to accept, and removal of the label — are in that one branch.
- **INVARIANT 2 survived rather than being weakened**, which is what this item asked for. The `accepted` branch
  is *unconditionally* refused on a `review:human` PR; #2895's inline rationale records why a `--clear-human`
  flag on `accepted` was rejected (it would make INVARIANT 2 conditional). `npm run review:clear` is wired to
  `--to=clear-human`.
- **The `changes` path is still unaffected** — always allowed, never removes `review:human`. That part of the
  analysis above holds.
- **The review-skill half of the attribution fix is already gone.** `we:skills-src/review/SKILL.md` no longer
  contains the phrase "advisory-review stamp" in the `parseReviewedSha` context this item quotes; the file was
  rewritten around the `reviewed-sha` / `reviewed-diff` / `reviewed-contribution` markers and the #2964 write
  ordering. The line-number cites in the body above (`#L50`, `#L62`, `#L79-L87`, `#L91-L99`, `#L207-L211`,
  `#L274`) are all stale — read by symbol, not by line.

**What is actually left**, and it is small (this is now a ~size-1 residue, not the size-2 blocker it was filed as):

1. The wrong root-cause attribution still stands, verbatim, in
   `we:backlog/2882-route-review-through-the-shared-review-label-cli-instead-of-.md` — "the drain's own
   advisory-review stamp, two rounds old". No drain path emits a `reviewed-sha` marker; the real sequence is
   *the 21:58Z accept omitted the marker, so `parseReviewedSha` fell back to the earlier human accept's 20:52Z
   stamp*. #2882 is `resolved`, so this is a **factual correction to a closed record**, not a scope change —
   worth doing precisely because the wrong narrative is what a future reader inherits.
2. `we:backlog/2882-route-review-through-the-shared-review-label-cli-instead-of-.md` carries
   `relatedTo: ["2409", "2644", "2470"]` — still no edge to #2416 (`status: open`), whose scope fully overlaps
   it. Adding it is a one-line frontmatter edit on each side.
3. Whether #2416's remaining scope is *also* discharged by `clear-human` is an open question this item should
   answer rather than assume: #2416 asks the gate to honor `review:accepted` only when a human applied it, and
   `decideSetLabel`'s own comment records that **nothing checks WHO is asking** (#2895 deferred the unforgeable
   actor signal). So #2416 is NOT closed by #2895 — say so on it.

## Done when

**No tier-1 criterion, and here is why.** After #2895 the whole residue is a *record* change — two frontmatter
edges and one corrected paragraph, all in `we:backlog/`. No behaviour changes, so no test can fail before and
pass after. The one command in scope, `npm run check:standards`, does **not** validate `relatedTo` at all
(unlike `blockedBy`, which has a resolution + cycle walk) — asserting it as proof would be a false tier-1. Every
criterion below is therefore tier 2, each checkable by one grep.

- The `relatedTo` edge is present in **both** directions: `grep -n relatedTo` over
  `we:backlog/2882-route-review-through-the-shared-review-label-cli-instead-of-.md` lists `2416`, and over
  `we:backlog/2416-gate-honor-review-accepted-only-when-a-human-applied-it.md` lists `2882`. Both edits must
  land — the gate will not catch a one-sided edge.
- `npm run check:standards` stays green after the edits (it does not *prove* the edges, but a frontmatter typo
  or a broken body link would red it, so it is the floor).
- `grep -c "advisory-review stamp"` over `we:backlog/2882-route-review-through-the-shared-review-label-cli-instead-of-.md`
  returns **0**, and the paragraph instead states the marker-less-accept-falls-back-to-the-previous-human-accept
  sequence. The `we:skills-src/review/SKILL.md` half needs no change — verified absent 2026-08-21; re-check
  before editing rather than assuming.
- The two DoD bullets this item opened about #2882's own wording are recorded as **superseded by #2895**, with
  the `clear-human` target named, rather than acted on: #2882 is resolved and per the ratified-decision rule a
  closed item's DoD is not retro-edited. A factual correction (bullet above) is not a DoD rewrite.
- #2416 carries an explicit note that `clear-human` did **not** deliver its ask — `decideSetLabel` still checks
  no actor identity — so the next reader does not close it as already-shipped.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: mutation/reversion check ahead of the build) — The card's central premise — that #2882 and #2895 landed and #2895 built the sanctioned clear-human override — is re-verified against we:scripts/review-set-label.mjs (REVIEW_LABEL_TARGETS includes 'clear-human', the clear-human branch removes review:human/pending/changes and sets keepsHuman:false, INVARIANT 2's accepted+isHuman refusal is unconditional and unchanged). The card explicitly re-grounds itself on 2026-08-21 and flags its own original line-number cites as stale rather than trusting them, which is exactly the mutation/reversion-style premise check this risk asks for.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The card is honest that npm run check:standards does not validate relatedTo at all (verified: only blockedBy has a resolution + cycle walk in we:scripts/check-standards.mjs lines 778-822; no relatedTo validation exists anywhere in we:scripts/check-standards-rules.mjs or we:scripts/backlog/*.mjs). It calls check:standards 'the floor', not proof, and states plainly that a one-sided relatedTo edit is not caught by any gate — avoiding the trap of citing a green check as evidence of a claim it cannot verify.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The card measures what's actually left after #2882/#2895 landed (re-reads the live decideSetLabel, confirms the skill's stale phrase is already gone) and resizes the remaining work from a size-2 blocker to a ~size-1 record correction, rather than assuming the original filing's scope still holds.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card itself notes 'the gate will not catch a one-sided edge' for the two-directional relatedTo frontmatter edit, and proposes no gate to surface a partial/failed edit — this is a pre-existing gap in check:standards (relatedTo has zero validation, unlike blockedBy's cycle walk) that this card does not introduce and is not in scope to fix here, but it is named as accepted risk rather than closed.

**Corrections recommended:**

- none — the preparation held up as written.

**Review note:** the one risk the juror left open — that a one-sided `relatedTo` edit is caught by no gate, because `check:standards` validates `relatedTo` nowhere (only `blockedBy` has a resolution + cycle walk) — is **accepted as named, not fixed here**. It is a pre-existing hole in the gate, not something this item introduces, and building `relatedTo` validation is its own change. The Done-when above already requires the grep on both sides for that reason.

_Recorded through the declared `review-prep` operation._
