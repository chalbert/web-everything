---
bornAs: xzdi27a
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
   taxonomy). *Honestly: this step describes the pattern's MATURE form, not all ten instances — the taxonomy
   only exists from #3103 on, and the earlier reviews (#2787, #3095, #3063) recorded their corrections with no
   stated confidence level. The operation mechanizes the mature form; see `## Done when` for what that means
   concretely.*
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

**What DOES compose, reused rather than reimplemented — at the RIGHT seam** (corrected by independent
review, 2026-08-14): the juror-spawn machinery (`we:scripts/lib/judge-spawn.mjs`) and #3094's mandate
INGREDIENTS are target-agnostic; `buildPanelMandate` itself is NOT. It is a declared member of
`PR_DIFF_ADAPTER` — review-core's own doc calls it "the diff-specific mandate framing" — and its output says
"You see ONLY the diff", "reviewers on this diff", and (when given a file list) "the NET changed-file set of
this PR vs CURRENT main… already landed via a sibling lane", none of which is true of a backlog card that has
no diff. Reusing it verbatim would hand the juror a mandate describing a diff that does not exist. The
subject-neutral seam the repo already built for exactly this (#2656; `DECISION_PROSE_ADAPTER` and
`DESIGN_PIXELS_ADAPTER` are shipped precedents) is `buildSubjectMandate` (`we:scripts/lib/jury-core.mjs`)
plus the EXPORTED rule constants: `MUTATION_PROBE_RULE` (unconditional, per the fork #3094 ruled),
`FENCED_DATA_RULE`/`fenceUntrusted` for caller-supplied prose, and the fenced `aim`-hypothesis pattern.
`review-prep`'s `judge` step therefore declares a prep-card mandate builder on that skeleton, asserting those
exported constants verbatim (a `toContain` on the export, never a paraphrase) — the same composition #3094
built, with only the subject framing card-shaped. The mutation probe carries over unchanged because a
preparation's design claims are exactly the kind of thing "break this and see if a test catches it" tests,
when the claim is about existing code behavior (most of tonight's ten defects were exactly that shape: a
claim about what a function does, disproven by breaking it).

## Interfaces and protocol

```js
// we:scripts/operations/review-prep-io.mjs — new, mirrors review-pr-io.mjs's shape
export async function readPrep({ item, repo, cwd }) {
  // Reads we:backlog/<item>-*.md frontmatter + body (scope:, tags, the full prose) — no PR, no diff.
  // Returns { card: { path, frontmatter, body }, scopeFiles: string[] } — scopeFiles feeds the prep
  // mandate's OWN ground-truth block ("re-verify the card's claims against these live files"), NOT
  // buildPanelMandate's netChangedFiles param, whose wording is PR-diff-specific (see the fork section).
}
export async function recordPrepVerdict({ item, repo, cwd, confidence, risks, fixApplied, note }) {
  // Appends a "## Independent review, <date>" section to the card (confidence + named risks + what changed
  // if a fix was applied), commits, and either lands directly (--label-on-green, matching tonight's manual
  // pattern for a clean card) or leaves it for the caller to land (matches --park for a bounced/fixed one).
}
```

```js
// we:scripts/operations/review-prep.mjs — new declaration, same 4-step-kind shape as review-pr
// read(compute, IO-injected via readPrep) -> judge(judge, prep-card mandate on buildSubjectMandate +
// the exported #3094 rules) -> reduce(compute) -> record(effect, via recordPrepVerdict)
// reduce note: the juror's answer SHAPE must carry the verdict material directly — a confidence level and
// risk names per we:backlog/3103-*.md's enum alongside the findings — because deriving those from generic
// findings alone is underdetermined (a finding has category/impact, not a 3103 risk name).
// NO confirm step -- unlike review-pr, a prep review's verdict is a note + commit, not a label a human
// gate-self path cares about; if that turns out wrong once this is used for real, add confirm as a
// fast-follow, don't guess it in now.
```

## Tasks

1. `readPrep` — read a card's frontmatter + body + declared `scope:` files, no PR/diff machinery.
2. `we:scripts/operations/review-prep.mjs`'s declaration — `read`/`judge`/`reduce`/`record`, with a
   prep-card mandate builder on `buildSubjectMandate` that asserts the exported #3094 constants verbatim
   (`MUTATION_PROBE_RULE`, `fenceUntrusted`/`FENCED_DATA_RULE`, the fenced `aim` pattern) and the judge-spawn
   request shape from #3094.
3. `recordPrepVerdict` — append the review note, commit, land (mirroring the MATURE post-#3103 form of
   tonight's hand-rolled instances — the shape #3103/#3108's own review notes use — so the mechanized version
   produces output matching what a human reviewer produced by hand at the end of this session).
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
- [ ] The `judge` step reuses #3094's composition at the subject-neutral seam — the mandate is built on
      `buildSubjectMandate` and a test asserts it contains the EXPORTED `MUTATION_PROBE_RULE` and
      `FENCED_DATA_RULE` constants (`toContain` on the import), with no paraphrased copy of either anywhere
      in the new files.
- [ ] `recordPrepVerdict`'s appended section carries the concrete post-#3103 format markers: a
      `## Independent review — <date>` heading, a stated `Confidence:` level (High/Medium/Low), named risks
      per `we:backlog/3103-*.md`'s enum, and a list of any corrections applied — the same markers #3103's and
      #3108's in-card review notes carry, checkable by diffing the section skeleton against one of those.
- [ ] No `confirm` step added speculatively — if this operation later needs a human stop, that's its own item,
      decided from real use, not guessed here.

## Delivery shape

Lands incrementally behind `main` — new files, no existing operation touched (per the decided fork, this is
NOT a change to `we:scripts/operations/review-pr.mjs`). No branch needed.

## Watch for

- **Do not let this become a second, subtly-different mandate-building path.** The whole point is reuse —
  but the reuse boundary is the RULES, not the diff framing: the fencing calls and the mutation-probe must be
  the same EXPORTED constants `review-pr`'s mandate carries (assertable with `toContain` on the import; a
  reworded copy is the defect), while the subject framing legitimately differs — that is the adapter seam
  #2656 built, not divergence. If the rule constants are paraphrased instead of imported, the two reviewers
  will produce inconsistent standards and nobody will notice until a card gets a weaker review than a PR
  would for the same defect class.
- The `record` step commits directly to a card and lands a PR — this is a MUTATING effect same as `review-pr`'s
  label-set, and needs the same care: a card mid-review by a human should not get silently overwritten by a
  mechanized pass racing it (the exact race #3094's own live-fire proof-of-concept hit and correctly abstained
  from). With no `confirm` step there is no human to ask, so this abstention must live IN `record` as a
  deterministic guard (e.g. the card's content hash at `read` time no longer matches at `record` time ⇒
  declare zero effects and report), not as a question.

## Independent review — 2026-08-14 (checklist item 9, applied to this card itself)

Confidence: **High** (after the corrections below; Medium as originally written — the central reuse claim
misidentified its seam).

All ten cited hand-rolled reviews were verified real in git history / PR comments; three were deep-read
(#3103's and #2787's review commits, #1254's PR comment thread) and match the six-step pattern. The fork
decision (separate operation, not a target-type branch in `we:scripts/operations/review-pr.mjs`) HOLDS — its
`read` and `record` were re-read and are PR-shaped exactly as claimed (net-diff basis, label guard through
`decideSetLabel`, PR comments).

**Corrections applied by this review** (risk names per `we:backlog/3103-*.md`):

- **interface** — the card claimed `buildPanelMandate` is "already target-agnostic". It is not: it is
  `PR_DIFF_ADAPTER`'s diff-specific framing ("You see ONLY the diff", the PR-vs-main ground-truth block), and
  verbatim reuse would hand a card juror a mandate describing a nonexistent diff. Corrected to the
  subject-neutral seam the repo already ships: `buildSubjectMandate` + the exported #3094 rule constants.
  The "Watch for" divergence rule, Tasks 2, and Done-when 3 were rewritten to match (rules reused verbatim
  via import; subject framing differs by design — the #2656 adapter seam).
- **premise** — "every time" overstated: the confidence + risk-taxonomy form exists only from #3103 on;
  #2787, #3095, and #3063's reviews state no confidence level. Step 5 now says the operation mechanizes the
  MATURE form, and Done-when 4 names its concrete format markers instead of "indistinguishable from all ten"
  (which was unfalsifiable — the ten do not share one format).
- **interface** (minor) — `reduce` "derives confidence+risks from findings" was underdetermined; the
  interfaces section now requires the juror's answer shape to carry confidence + 3103 risk names directly.
- **legibility** (minor) — the no-`confirm` decision is sound as a deferral, but the mid-review-race
  abstention the Watch-for names must then be a deterministic guard inside `record`; one sentence added
  saying so.

**Residual risks:** **consumer** (low — the operation's one consumer, checklist item 9's flow, is the same
flow that ran ten times tonight); **unmeasured-impact** (low — Task 5's hand-rolled-comparison requirement is
the measurement, and it is correctly gated in Done-when 2).
