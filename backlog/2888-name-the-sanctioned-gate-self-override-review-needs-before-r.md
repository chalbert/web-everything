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

## Definition of done

- #2882 states the sanctioned gate-self override: what the CLI grows so the human ceremony can run through
  the single home (permission to accept a `review:human` PR **and** removal of that label), and what keeps it
  from being reachable by an agent — INVARIANT 2's substance survives the change rather than being weakened.
- #2882's DoD bullet 1 no longer reads as "remove the raw path" without naming what replaces it for gate-self.
- The "drain's own advisory-review stamp" attribution is corrected in **both**
  `we:backlog/2882-route-review-through-the-shared-review-label-cli-instead-of-.md` and
  `we:skills-src/review/SKILL.md`, to the marker-less-accept-falls-back-to-the-previous-human-accept sequence.
- A `relatedTo` edge is added between #2882 and #2416 (both open, fully overlapping scope, same extraction
  proposed from different angles — WHO applied the accept vs. that `/review` hand-rolls the swap), so the
  extraction is designed once.
