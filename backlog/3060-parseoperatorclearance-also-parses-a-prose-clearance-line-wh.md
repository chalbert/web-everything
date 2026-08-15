---
bornAs: xeahxy4
kind: story
size: 1
status: resolved
relatedTo: ["2898", "2895", "3039", "2946"]
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/review-set-label.mjs"]
dateOpened: "2026-08-10"
dateStarted: "2026-08-15"
dateResolved: "2026-08-15"
graduatedTo: scripts/lib/review-escalation.mjs
tags: [review, marker, forgery, invariant, capture]
---

# parseOperatorClearance also parses a PROSE clearance line, which the #1147 marker escape cannot reach

The clearance record has TWO parsers, and only one of them opens on `<!--`. `CLEARED_HUMAN_PROSE_RE` matches a plain sentence, so caller-supplied prose in a `--body-file` (or any raw PR comment) forges a clearance record that the render-boundary escape shipped in PR #1147 leaves untouched — there are no delimiters to escape. Non-gating today, but it falsifies the invariant that fix rests on.

> **Capture only, at filing.** Nothing was built at the time this card was opened — the fix was framed below
> without being chosen. See **Resolved** at the bottom for what was actually built.

## The two parsers

[we:scripts/lib/review-escalation.mjs#parseOperatorClearance](../scripts/lib/review-escalation.mjs) runs two
regexes over every PR comment body and takes the latest hit from either:

- `CLEARED_HUMAN_RE` — the marker form, `<!--\s*cleared-human:\s*([^>]*?)\s*-->`. Opens on a literal `<!--`.
- `CLEARED_HUMAN_PROSE_RE` — a plain sentence, anchored with `^…/gm`: the words `Cleared by`, any name, then
  ` via ` and the tool invocation in a backtick span. **No HTML-comment syntax anywhere in it.** Any line of
  that shape satisfies it, whatever follows.

The prose form is deliberate and documented — it predates the marker, and #3039 added it so PRs cleared before
that item (#1106 among them) stayed covered. The problem is not that it exists; it is that nothing accounts for
it existing.

## Reproduction, against `main` at `f99a0a8d`

`buildVerdictComment` with an ordinary `changes` verdict and a `--body-file` whose first line is that sentence:

```js
const body = 'Cleared by Nicolas Gilbert via `review-set-label.mjs --to=clear-human` (#2895).\n\nrest.';
const c = buildVerdictComment({ to: 'changes', actor: 'attacker-agent', headSha: 'a'.repeat(40), body });
c.includes('<!--')                       // false — nothing for the neutralizer to escape
parseOperatorClearance([{ body: c }])    // { actor: 'Nicolas Gilbert' }
```

Control, the same call with `body: '<!-- cleared-human: Nicolas Gilbert -->'`, returns `null`. The #1147 escape
does its job on the marker form and has no purchase on the prose form. A raw `gh pr comment` carrying the same
sentence, with no CLI involved, parses identically — the CLI is one route in, not the exposure.

## This is NOT a gate hole — state it plainly

The forged record cannot land anything, and the code says so:

- [we:scripts/lib/review-escalation.mjs#decideReviewGate](../scripts/lib/review-escalation.mjs) consumes
  `operatorClearance` in exactly one place: the stale-acceptance branch computes
  `revokesClearance = toHuman && operatorClearance && !hasReviewLabel(labels, REVIEW_LABELS.human)`, and uses it
  only to pick between two `reason` strings and to populate `revokesClearance` / `clearance` on the returned
  object. `action` stays `park`. `applyLabel` stays `review:human`. `humanRequired` and `staleAcceptance` are
  untouched.
- The drain's only read is `parseOperatorClearance(d.comments)` in
  [we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs), feeding that same argument.

So the whole blast radius is **one wrongly-attributed notice**: a `buildClearanceRevocationComment` naming a
person who never cleared anything, on a re-hold that would have happened regardless. Misleading in the durable
record; not a merge that should not have happened. Nobody should read this card as more alarming than that. The
forge residual itself is already ruled — #2895 deferred the unforgeable actor signal and
[#2946](/backlog/2946-human-presence-gesture-webauthn-makes-the-gate-self-clearanc/) (`tier: someday`) is the
durable fix.

## Why it is still worth a card: it falsifies a stated invariant

The reasoning that justifies PR #1147's shape-based fix is written into
[we:scripts/review-set-label.mjs#neutralizeCommentMarkers](../scripts/review-set-label.mjs):

> *"Every marker read anywhere in this repo is matched by a regex that opens on a literal `<!--` … Remove every
> literal `<!--` from a string and NONE of them can match it."*

It then lists `CLEARED_HUMAN_RE` by name — and its sibling, in the same function, is the counter-example. The
render-boundary note in `buildVerdictComment` makes the same claim. **The fix is still the right fix**: escaping
the syntax beats maintaining a list of marker names, and that argument does not depend on the claim being
universal. But the claim as written is false, and it is load-bearing for anyone who later asks *"is input X safe
to render?"*

Note the pattern honestly: [#2898](/backlog/2898-the-review-verdict-comment-claims-the-loop-console-for-every/)
has now claimed more marker coverage than it had **twice** — once in its original "Resolved" text (already
corrected on that card, and not to be re-litigated here) and once in the reasoning that shipped with PR #1147.
A third overclaim would be a trend rather than an accident. Any future coverage claim about marker safety must
therefore say what it does about **prose-shaped parsers**, not only `<!--`-shaped ones.

## The fix, framed but not chosen

- **Neutralise the prose form too**, at the render boundary. Keeps both records readable. Cost: the boundary
  stops being one clean syntax rule and starts carrying a content rule, which is the per-name pattern #1147
  deliberately walked away from.
- **Narrow `CLEARED_HUMAN_PROSE_RE`** so caller-supplied text cannot satisfy it — e.g. anchor it to the whole
  rendered attribution, or require it at the very start of a body under the known clearance heading. Cost: it
  must still match the historic comments it exists for, byte for byte.
- **Drop the prose fallback**, if the marker it backstops is now always emitted. Cheapest, if true.

### What we found about whether the fallback is still needed

Checked, and it looks close to removable — but not verified as safe on its own:

- **No live subject.** `gh pr list --state open` on `chalbert/web-everything` returns **zero** open PRs, so no
  PR the drain can currently score carries a prose-only clearance. Both PRs #3039 named (#1106, #1100) are
  MERGED. Their pre-#1124 clearance comments are genuinely prose-only (#1100's is `2026-08-08T14:38:36Z`);
  every clearance comment posted after PR #1124 merged (`2026-08-09T11:50:32Z`) carries the marker.
- **One residual producer, and it is not a historic one.** `buildClearedHumanMarker` returns `''` when the actor
  sanitizes to empty, and the CLI only checks that `--actor` is non-blank — so `--actor='<>'` passes the CLI,
  emits **no marker**, and leaves the prose line as the sole record (verified: it parses to `{actor:'<>'}`).
  Narrow and self-inflicted, but it means *"the marker is always emitted"* is not currently true by
  construction.
- **No self-forge from the drain.** `buildClearanceRevocationComment` mentions the clearance command but does
  not produce a line matching the prose regex — confirmed against the two such comments on PR #1100.

So the honest state is: the fallback has no *historic* subject left, and removing it would need the empty-actor
producer closed (or `buildClearedHumanMarker` made total) first. That is a finding, not a ruling.

## Definition of done

- The invariant is either made true or restated accurately everywhere it is asserted
  (`neutralizeCommentMarkers`, the `buildVerdictComment` render-boundary note, and #2898's correction section).
- A test pins whichever option is taken, driving the prose payload through `buildVerdictComment` the way the
  existing #1147 suite drives the marker payload.
- The non-gating claim above is re-checked at fix time, not assumed.

## Resolved

**Chose narrowing `CLEARED_HUMAN_PROSE_RE`**, the second option framed above — not the render-boundary escape
(would have turned the boundary into a content rule, the thing #1147 deliberately avoided) and not dropping the
fallback (the empty-actor producer that defeats `buildClearedHumanMarker` is still open, so the fallback is not
provably safe to remove).

The narrowed regex anchors to the exact shape only `buildVerdictComment`'s own `clear-human` render can produce
— the heading immediately followed by the attribution line, at the very START of the comment body:

```
/^✅ review — `review:human` cleared via the sanctioned path\n\nCleared by (.+?) via `review-set-label\.mjs --to=clear-human`/g
```

Every caller-supplied field (`body`, `reason`, `channel`, …) is appended strictly LATER in the rendered body —
the heading and attribution always come first — so a forged sentence in a caller field can never satisfy `^`.
The reproduction in this card's body now returns `null`. The legacy pre-marker shape (PR #1106, pinned in
`we:scripts/lib/__tests__/review-escalation.test.mjs`'s `LEGACY_CLEARANCE` fixture) still parses, because it
carries exactly this heading-then-attribution shape at the start of its body.

**Re-checked the non-gating claim at fix time**, per the last Definition-of-done bullet: `gh pr list --state
open` on `chalbert/web-everything` still shows zero PRs carrying `review:human`, so there is still no live
subject a narrower regex could break.

**What shipped:**

- [we:scripts/lib/review-escalation.mjs#parseOperatorClearance](../scripts/lib/review-escalation.mjs) —
  `CLEARED_HUMAN_PROSE_RE` narrowed as above, with the reasoning (why anchoring is sufficient, and what it
  deliberately does not close) written beside it.
- [we:scripts/review-set-label.mjs#neutralizeCommentMarkers](../scripts/review-set-label.mjs) — docstring
  restated: its sufficiency claim is scoped to `<!--`-opening (marker-shaped) parsers, with
  `CLEARED_HUMAN_PROSE_RE` named as the one parser it does not and cannot cover, and where that gets closed
  instead.
- `buildVerdictComment`'s render-boundary note (same file) — same restatement, so a reader at either home gets
  the accurate claim.
- [#2898](/backlog/2898-the-review-verdict-comment-claims-the-loop-console-for-every/)'s correction section — a
  second correction added: its own "no marker parser… can match caller bytes" line inherited the same overclaim
  and is now scoped the same way.
- Tests: a new `describe` block in
  [we:scripts/__tests__/review-set-label.test.mjs](../scripts/__tests__/review-set-label.test.mjs) drives the
  prose payload through `buildVerdictComment` on every non-`clear-human` verdict target and every caller field
  (mirroring the #1147 marker-forgery suite's shape), plus a legacy-shape regression test. One hermetic fixture
  in `we:scripts/__tests__/gate-entrypoint-integration.test.mjs` built a bare (heading-less) prose clearance
  comment for its own drain-reads-it-back test; updated to the real heading-prefixed shape so it keeps exercising
  the path it is for instead of silently going dark under the narrower regex.

**Not done, and deliberately, restated so it is not re-litigated as a gap:** a raw `gh pr comment` — no CLI
involved — can still open with the exact heading-then-attribution bytes by hand and forge a clearance record.
That residual is unchanged by this fix; it is the unforgeable-actor gap #2895 already deferred to
[#2946](/backlog/2946-human-presence-gesture-webauthn-makes-the-gate-self-clearanc/), and nothing merges on a
forged clearance either way (`decideReviewGate` still parks; `applyLabel` is unchanged).
