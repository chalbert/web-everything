---
kind: story
size: 5
parent: "3099"
status: open
dateOpened: "2026-08-14"
tags: [plateau-loop, operations, engine, review, preparation, delivery]
scope:
  - we:scripts/operations/review-prep.mjs
  - we:scripts/operations/review-prep-io.mjs
  - we:scripts/operations/__tests__/review-prep.test.mjs
  - we:scripts/operations/__tests__/review-prep-io.test.mjs
---

# A `review-prep` operation: mechanize the independent-review-of-preparation pattern proven ten times tonight

This session added checklist item 9 (`we:agent-memory-src/story-preparation-checklist.md`): a prepared story
is not build-ready until its preparation has been independently reviewed. That review has now been run by
hand, headless-CLI, TEN times in one evening — #2787, #3095, #3004, #2842, #2803, #2351, #3063 (the six
original preparations), plus #3103, #3108, and #1254 itself (the checklist change) — every single one via a
freshly hand-written mandate. That is exactly the smell `#3094`'s own card named for code review: *"the loop
routed around its own machinery because the machinery could not express the thing that made those reviews
work."* Same smell, same fix shape, different target.

## What the ten hand-rolled reviews actually did, every time

1. Fetch the card, sync to `main`.
2. Re-verify the card's factual claims against the LIVE code (not trust the card's own line numbers).
3. Judge the decided design — is the reasoning actually sound, not just confident-sounding.
4. Check interfaces/line numbers, `## Done when` testability, checklist conformance.
5. State a **confidence level** (High/Medium/Low) and **named risks** (against `we:backlog/3103-*.md`'s
   taxonomy).
6. If a real fixable defect is found: fix it directly, gate (`check:standards`, `test:unit` if code changed),
   commit, land a correction PR. If not: append a short review note to the card and land that.

Every one of those six steps was hand-composed prose in a mandate file tonight. None of it is specific to the
CARD it was reviewing — it is the same shape #3094 just mechanized for PRs, aimed at a different `read`/kind
of target.

## Why this is NOT "extend `review-pr` with a PR-or-card flag" — the decided design

**Fork, decided:** a SEPARATE declared operation, `review-prep`, not a target-type branch inside
`we:scripts/operations/review-pr.mjs`.

Reasoning: `review-pr`'s `read` and `record` steps are PR-shaped all the way down —
`read` composes `assembleReviewDetail` + `computeNetDiffText`/`computeNetDiffPaths` (a PR diff has no
analogue for a backlog card, which has no diff, only a `scope:` list and prose claims to verify against live
code) and `record` composes `decideSetLabel` + `renderPanelComment` (a GitHub PR label; a backlog card has no
labels — its "verdict" is a review note appended to the file and a commit, the pattern all ten reviews used
by hand tonight). Branching those two steps on a target-type flag would put an if/else through the exact
place #3031's statute says stays declared-once-per-shape: *"an operation that appears to need a fifth kind is
a signal to change the model"* already governs `read`; a `read` that internally forks between two unrelated
IO shapes is the same signal in miniature.

**What DOES compose, reused rather than reimplemented:** the `judge` step (`buildPanelMandate` from
`we:scripts/lib/review-core.mjs`) and the underlying juror-spawn machinery (`we:scripts/lib/judge-spawn.mjs`)
are already target-agnostic — a juror doesn't care whether the "goal" text describes a PR or a backlog card,
only that the mandate states what to verify and fences caller-supplied prose (`fenceUntrusted`, per #3094).
`review-prep` DECLARES its own `read`/`record` but calls the SAME `judge` composition #3094 just built,
including the unconditional mutation-probe rule this session ruled — a preparation's design claims are
exactly the kind of thing "break this and see if a test catches it" tests, when the claim is about existing
code behavior (most of tonight's ten defects were exactly that shape: a claim about what a function does,
disproven by breaking it).

## Interfaces and protocol

```js
// we:scripts/operations/review-prep-io.mjs — new, mirrors review-pr-io.mjs's shape
export async function readPrep({ item, repo, cwd }) {
  // Reads we:backlog/<item>-*.md frontmatter + body (scope:, tags, the full prose) — no PR, no diff.
  // Returns { card: { path, frontmatter, body }, scopeFiles: string[] } — scopeFiles feeds the mandate
  // the same way review-pr's netChangedFiles does, so the juror is told exactly what to re-verify against.
}
export async function recordPrepVerdict({ item, repo, cwd, confidence, risks, fixApplied, note }) {
  // Appends a "## Independent review, <date>" section to the card (confidence + named risks + what changed
  // if a fix was applied), commits, and either lands directly (--label-on-green, matching tonight's manual
  // pattern for a clean card) or leaves it for the caller to land (matches --park for a bounced/fixed one).
}
```

```js
// we:scripts/operations/review-prep.mjs — new declaration, same 4-step-kind shape as review-pr
// read(compute, IO-injected via readPrep) -> judge(judge, REUSES buildPanelMandate) ->
// reduce(compute, derives confidence+risks from findings) -> record(effect, via recordPrepVerdict)
// NO confirm step -- unlike review-pr, a prep review's verdict is a note + commit, not a label a human
// gate-self path cares about; if that turns out wrong once this is used for real, add confirm as a
// fast-follow, don't guess it in now.
```

## Tasks

1. `readPrep` — read a card's frontmatter + body + declared `scope:` files, no PR/diff machinery.
2. `we:scripts/operations/review-prep.mjs`'s declaration — `read`/`judge`/`reduce`/`record`, reusing
   `buildPanelMandate` and the judge-spawn request shape from #3094 verbatim (same fencing, same
   unconditional mutation-probe rule).
3. `recordPrepVerdict` — append the review note, commit, land (mirroring tonight's ten hand-rolled instances
   exactly, so the mechanized version produces output indistinguishable from what a human reviewer produced
   by hand this session).
4. Derived CLI adapter (same generation mechanism #3035 used for `review-pr`, per #3031 — do not hand-write a
   second CLI).
5. Drive ONE real review of a real ALREADY-PREPARED card through the operation (a good candidate: whatever
   the next prepared-but-unreviewed card is at build time) and compare its output against what a hand-rolled
   review of the same card would have found — this item has proven nothing until that comparison is made,
   same discipline #3094's own Done-when required of itself.

## Done when

- [ ] `review-prep` operation registered, runnable via its derived CLI.
- [ ] One real card driven through it end-to-end; its confidence + risks output is at least as good as a
      hand-rolled review would have produced (spot-checked, not assumed).
- [ ] The `judge` step is proven to be the SAME composition #3094 built — no forked copy of
      `buildPanelMandate` or the mutation-probe rule.
- [ ] `recordPrepVerdict`'s output (the appended review-note section) matches the shape all ten hand-rolled
      reviews used tonight, so a reader can't tell a mechanized review from a manual one by format alone.
- [ ] No `confirm` step added speculatively — if this operation later needs a human stop, that's its own item,
      decided from real use, not guessed here.

## Delivery shape

Lands incrementally behind `main` — new files, no existing operation touched (per the decided fork, this is
NOT a change to `we:scripts/operations/review-pr.mjs`). No branch needed.

## Watch for

- **Do not let this become a second, subtly-different mandate-building path.** The whole point is reuse; if
  `review-prep`'s `judge` step diverges from `review-pr`'s even slightly (a different fencing call, a
  reworded mutation-probe), the two reviewers will produce inconsistent standards and nobody will notice
  until a card gets a weaker review than a PR would for the same defect class.
- The `record` step commits directly to a card and lands a PR — this is a MUTATING effect same as `review-pr`'s
  label-set, and needs the same care: a card mid-review by a human should not get silently overwritten by a
  mechanized pass racing it (the exact race #3094's own live-fire proof-of-concept hit and correctly abstained
  from).
