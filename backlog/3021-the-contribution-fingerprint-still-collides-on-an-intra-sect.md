---
bornAs: x413mbt
kind: story
size: 3
status: open
dateOpened: "2026-08-08"
parent: "3054"
tags: [gate, review, drain, review-escalation, fingerprint]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
---

# The contribution fingerprint still collides when a relocation keeps its `@@` heading and hunk gaps unchanged

> **WIDENED 2026-08-10 by `#3054`'s repair — read this before the body, which describes the narrower original.**
> `#3046` and `#3052` proved that BOTH position signals this card's title names are variant under the base
> moving, and they revoked two live operator clearances on 2026-08-09. They are now gone from
> `normalizeContributionFingerprint`, so the collision no longer needs the heading and the gap to be preserved:
> **any relocation collides** that keeps the same files, the same hunk order, the same hunk lengths, the same
> context-run shape and byte-identical `+`/`-` lines. The pinned test in
> [we:scripts/lib/__tests__/review-escalation.test.mjs](scripts/lib/__tests__/review-escalation.test.mjs) was
> widened in the same change and now pins three shapes, two of which were REFUSED before: a move across a
> top-level declaration, and a hunk moving relative to its sibling.
>
> **Why this was not avoidable, so nobody re-litigates it here.** Everything the digest can see about a hunk's
> position is its old-side start. A base growing *k* lines above the contribution and the contribution
> relocating *k* lines down an unchanged base produce byte-identical projections — headings included, when the
> base's insertion is a declaration and the relocation crosses one. Two identical inputs cannot get two
> different answers, so a digest invariant under every base move is blind to every relocation. Reproduced from
> real `git diff` output ("THE INDISTINGUISHABILITY"). Note what that proof also says about the old design: the
> gap and the heading never separated that shape either — they only made a base move look like a change in
> *other* shapes.
>
> **What partially replaced them, and it is not nothing.** A base-invariant context-**RUN SHAPE** — the length
> of each run of context lines between contributed lines, never its text. It costs no invariance (a base edit
> that changes a run length already changed `oldLen`/`newLen`) and it refuses any relocation that re-clusters
> the contributed lines or truncates a run at a file edge.
>
> **So the two directions that close this card are both OUTSIDE the digest**, and the *Directions worth costing*
> below should be read with the first one struck: per-hunk context anchors are refuted by #1100 itself, where
> `main` changed 5 context lines under the lane across the head move (re-derived 2026-08-10). What remains is
> **attribute the move to its actor** and **bound the escape by a recorded merge base** — plus a third the
> siblings surfaced: **recompute the reviewed side against the new base** instead of comparing two projections
> taken against different bases.

`normalizeContributionFingerprint` drops context lines so a clearance survives the drain rebasing a lane, and
that leaves one collision open: a contribution that MOVES while keeping the same `@@` section heading and the
same gap to its sibling hunks. This is WIDER than "one function, one hunk" — git's `@@` heading is the nearest
preceding line starting at column 0 with a letter (no `.gitattributes` in this repo), not "the enclosing
function", so the collision also covers a move between two methods of the *same* class, a move between two
blocks of one long top-level function, and **any** relocation inside an indented JSON/YAML file (no line there
starts at column 0, so the heading is empty and identical for the whole file). It is not limited to single-hunk
files either: a set of hunks that relocates uniformly preserves every gap and collides the same way. Closing it
needs evidence the digest does not carry — the same context the #1100 case requires it to tolerate.

## The shape

Reproduced with real `git diff` output — one added guard line placed at two different points inside the same
function of a 23-line file:

```
@@ -4,6 +4,7 @@ function only() {        @@ -13,6 +13,7 @@ function only() {
   s2();                                    s11();
   s3();                                    s12();
   s4();                                    s13();
+  if (!authorized) throw …                +  if (!authorized) throw …
   s5();                                    s14();
```

Same `+` line, same hunk lengths, same section heading, one hunk so no inter-hunk gap to compare →
byte-identical digest → `acceptanceCoversHead` returns `covers: true`. This is the "right line, wrong place"
class narrowed down to what PR #1119 could not close: a guard moved below the call it guards, inside one
function.

The same class of collision also reproduces, with real `git diff` output, in three shapes that are not "one
function, one hunk":

- **Two methods of one class.** A guard line moved from `async transfer()` to `async close()` of the same class
  — both hunks read `@@ … @@ export class AccountService {`, because git's heading tracks the nearest column-0
  declaration (the class), not the method.
- **Any relocation inside a JSON/YAML file.** Moving a line within this repo's own
  [we:package.json](package.json) (2-space indented) produces a bare `@@ -9,6 +9,7 @@` — an **empty** heading,
  because no line in the file starts at column 0 with a letter. No relocation inside any JSON/YAML file is ever
  distinguished by heading.
- **Multi-hunk files, not just single-hunk ones.** Two hunks relocated uniformly (e.g. old-side starts 7/48 →
  197/238, same 41-line gap, same heading) produce a byte-identical digest, because the inter-hunk-gap signal is
  preserved by construction under a uniform shift.

PR #1119 closed relocation **across files**, **across top-level declarations** (a move between two separate
top-level functions is caught, because their headings differ), and relocation **relative to a sibling hunk**
whose gap actually changes. What is not closed is any relocation that keeps both signals unchanged — which, as
above, is not limited to "an intra-section move in a single-hunk file". This item is what remains, and it is
pinned by a deliberately-passing test in the unit suite for
[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) ("THE KNOWN RESIDUAL, pinned") so
nobody reads the other cases as "relocation is solved".

## Why it is not a one-line fix

The only remaining witness to an intra-section move is the hunk's **context lines** — and the case the whole
escape exists for ([#3023](/backlog/3023-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/),
WE PR #1100) is one where `main` changed the context line **immediately adjacent** to the contribution.
Tolerating that and detecting an intra-section move are the same measurement read in opposite directions, so no
fixed-size digest can do both.

## Directions worth costing

- **Per-hunk anchors instead of one digest.** Stamp a short list of per-hunk context digests beside the
  contribution digest and compare hunk-by-hunk. Buys fuzziness, but needs a tolerance threshold, and a
  threshold is itself an attack surface (relocate exactly one hunk in a large PR).
- **Attribute the move to its actor.** The drain KNOWS when it performed the rebase; a rebase it performed
  itself could carry the clearance forward by re-stamping `reviewed-sha`, reducing later passes to the strict
  SHA test. Does not cover a producer-lane force-push, so it narrows rather than closes.
- **Bound the escape by a recorded merge base.** Require the head advance to come with a base advance, so a
  relocation force-pushed onto an unchanged base is refused. Cheap; raises the bar rather than closing it.

## Decided design (2026-08-15 preparation) — attribute the move to its actor

Of the three directions named above, this story implements **attribute the move to its actor**, scoped to
the drain's own rebase-drop pass. It is chosen over the other two, named rather than picked silently:

- **Bound the escape by a recorded merge base** would need a NEW marker stamped at accept time
  (`we:scripts/review-set-label.mjs`'s `buildVerdictComment`, ~we:scripts/review-set-label.mjs:787-816) carrying
  the merge-base the reviewer's diff was computed against, PLUS a consumer-side re-derivation of the live
  merge-base at gate time (`we:scripts/merge-ai-prs.mjs`'s `computeNetDiffText`, which already computes one
  internally at we:scripts/merge-ai-prs.mjs:2024 but does not return it to its caller). That is a real, viable
  follow-on — deferred here because it touches the producer (`we:scripts/review-set-label.mjs`) in addition to the
  consumer, for a payoff ("raises the bar," per its own description above) that the actor-attribution direction
  gets for free on the highest-frequency trigger.
- **Recompute the reviewed side against the new base** needs the RAW accepted diff text to be persisted
  somewhere retrievable (today only its 64-hex digest is stamped — `buildReviewedDiffMarker`/
  `buildReviewedContributionMarker`, we:scripts/lib/review-escalation.mjs:958-963 and :1235-1240 — the digest is
  one-way, so nothing can regenerate the diff text from it). Storing full diff text durably is a materially
  bigger change (size, storage, forge surface) and is left as future work, not attempted here.

**Why actor-attribution is viable, not just cheap.** The claim "the drain KNOWS when it performed the rebase"
is provable, not assumed — read both mechanisms end to end:

- `rebaseDropManifest` (we:scripts/lib/rebase-drop-manifest.mjs:115-198) only ever removes ONE known path
  (the transient manifest, `we:.lane-manifest.json`) from the merged tree
  (we:scripts/lib/rebase-drop-manifest.mjs:152-153) before
  `commit-tree`. It never touches any other path, so every line this PR itself added or removed survives
  byte-for-byte.
- `rebaseDropContent` (we:scripts/lib/rebase-drop-content.mjs) auto-resolves ONLY conflicts where every
  conflicting hunk is non-overlapping (we:scripts/lib/rebase-drop-content.mjs:2-17) — both sides' base-line
  ranges are disjoint, so it composes them unmodified; it never rewrites a line either side wrote. An
  overlapping (genuinely semantic) conflict is left for `/finish`, as before — this story changes nothing there.

So whenever `we:scripts/merge-ai-prs.mjs`'s rebase-drop loop (~we:scripts/merge-ai-prs.mjs:2996-3072) reports
`{ action: 'rebased' }` for a PR, the drain has PROVEN — by construction, not by inference over a position-blind
projection — that this specific head transition preserved the PR's own contribution. That is strictly stronger
evidence than anything `normalizeContributionFingerprint` can produce, and it costs nothing extra to obtain: the
information is already the return value of code that already ran.

**What this closes vs what it leaves open.** Every accepted PR the drain rebase-drops gets its `reviewed-sha`
marker re-stamped directly onto the rebuilt tip — the exact #1100/#1106 production shape (the drain's OWN
routine rebase, which fires within minutes of every accept per the docblock at
we:scripts/lib/review-escalation.mjs:986-995) no longer needs to reach the position-blind contribution
fingerprint at all; the plain SHA-identity tier at the top of `acceptanceCoversHead`
(we:scripts/lib/review-escalation.mjs:1278-1282) short-circuits it on the very next pass. It does **not** close
#3021's title claim: a producer who relocates code themselves, outside `rebaseDropManifest`/`rebaseDropContent`,
still reaches the SAME unmodified `normalizeContributionFingerprint`/`acceptanceCoversHead` x9xqexm tier this
story does not touch, and the pinned residual test stays exactly as wide as it is today (see Verification,
below). This narrows the residual's real-world exposure window; it does not close the digest-level collision.
That is consistent with — not a reinterpretation of — this direction's own description above ("narrows rather
than closes").

**A correctness constraint the builder must not skip.** Re-stamping is safe ONLY when the accepted SHA and the
PRE-rebase head SHA are the SAME tree — i.e. nothing unreviewed rode in between the accept and this pass's own
rebase. Re-stamping unconditionally whenever `rebaseDropAction === 'rebased'` on any `review:accepted` PR,
without checking this, would launder an unreviewed intervening push: the drain's routine rebase would silently
extend the accept to cover content the reviewer never saw. The design below checks this by construction — it
only fires when THIS pass's own `decideReviewGate` has ALREADY verified coverage (via any of its three existing
tiers) for the SAME transition, so it can never attribute a transition the gate itself did not just approve.

## Verification against live code (2026-08-15)

- Read `normalizeContributionFingerprint` in full (we:scripts/lib/review-escalation.mjs:1089-1157). Confirmed
  against the code, not just the docblock: the hunk-header projection at
  we:scripts/lib/review-escalation.mjs:1131 emits only `@@ -,<oldLen> +,<newLen> @@` — no absolute offset, no
  section heading — and the context-run projection (we:scripts/lib/review-escalation.mjs:1145-1151) emits only
  a run LENGTH, never text. Neither the `@@` heading nor the inter-hunk gap is hashed anywhere in this function.
  The card's own WIDENED banner (2026-08-10) already says this; this preparation confirms it is still true on
  `main` today, not stale.
- Ran the pinned regression suite against the live function (no code changed):
  `npx vitest run we:scripts/lib/__tests__/review-escalation.test.mjs -t "KNOWN RESIDUAL"` → 1 passed. That test
  (we:scripts/lib/__tests__/review-escalation.test.mjs:1198-1236) reproduces, from real `git diff` output, all
  three collision shapes the WIDENED banner names: (a) an intra-section move in a single-hunk file, (b) a move
  across a top-level declaration (different headings), (c) one hunk moving relative to its sibling (different
  gap) — all three collide under `normalizeContributionFingerprint` today, and all three are refused by
  `normalizeDiffFingerprint` (the stricter sibling), matching the card's "checked LAST" bound. The collision
  claim is real and reproduced against live code, not stale prose.
- Traced both consumers of `acceptanceCoversHead`
  (`grep -rn "acceptanceCoversHead(" we:scripts/*.mjs we:scripts/lib/*.mjs`): the decision-relevant one is
  we:scripts/merge-ai-prs.mjs:3373 (via `decideReviewGate`); the other,
  `ledgerCoversHead` (we:scripts/lib/verdict-ledger.mjs:493-503), is explicitly "PHASE-2 AFFORDANCE, BUILT AND
  DELIBERATELY UNWIRED... Nothing calls this today" (we:scripts/lib/verdict-ledger.mjs:481-487) — confirmed out
  of scope for this story; this design changes nothing it depends on.
- Confirmed the rebase-drop loop runs BEFORE the escalation pass in the SAME `runCli` invocation
  (we:scripts/merge-ai-prs.mjs:2996-3072 precedes :3103+), and that a PR just rebase-dropped this pass is
  EXPECTED to bounce its immediate merge attempt on pending CI and land on a LATER pass
  (we:scripts/merge-ai-prs.mjs:3710-3715, `c.rebaseDrop === 'rebased'` → `pendingRebased`) — i.e. the drain's own
  rebase is, today, exactly the routine trigger that forces later passes through the position-blind fingerprint
  tier repeatedly until CI goes green. This is the concrete cost this story removes.

## Interfaces and protocol

New pure exports in `we:scripts/lib/review-escalation.mjs` (alongside the existing marker builders it already
exports — `buildReviewedShaMarker`, `buildClearanceRevocationComment`, etc.):

```js
/**
 * @param {{rebaseDropAction:string|null|undefined, gateAction:string|null|undefined,
 *   acceptedSha?:string|null, headSha?:string|null}} o
 * @returns {boolean} true iff THIS pass's own rebase-drop (rebaseDropAction==='rebased') moved a PR whose
 *   FRESH decideReviewGate verdict (gateAction) is already 'merge', and the accepted/head SHAs are both known
 *   and differ (nothing to re-attribute when they already match).
 */
export function shouldReattributeRebase({ rebaseDropAction, gateAction, acceptedSha = null, headSha = null } = {}) { /* … */ }

/**
 * @param {string} newSha - the rebuilt tip's commit SHA
 * @returns {string} the durable comment body carrying a fresh `reviewed-sha` marker (same format
 *   `buildReviewedShaMarker` already produces — `parseReviewedSha`'s existing LATEST-wins read requires no
 *   change), or '' when `newSha` is not a usable SHA.
 */
export function buildRebaseReattributionComment(newSha) { /* … */ }
```

New call site in `we:scripts/merge-ai-prs.mjs`, in the escalation pass right after `const gate =
decideReviewGate({...})` (we:scripts/merge-ai-prs.mjs:3373):

```js
if (!DRY_RUN && shouldReattributeRebase({
  rebaseDropAction: v.rebaseDrop, gateAction: gate.action, acceptedSha, headSha: liveHeadSha,
})) {
  const body = buildRebaseReattributionComment(liveHeadSha);
  if (body) {
    try { execFileSync('gh', ['pr', 'comment', String(v.num), ...repoFlag(v.repo), '--body', body], { stdio: ['ignore', 'ignore', 'pipe'] }); }
    catch { /* best-effort — a miss just means the next pass re-derives via the fingerprint tiers, unchanged */ }
  }
}
```

Import addition: add `shouldReattributeRebase, buildRebaseReattributionComment` to the existing
review-escalation import line at we:scripts/merge-ai-prs.mjs:113. No signature of any EXISTING export
changes — `acceptanceCoversHead`, `decideReviewGate`, `normalizeContributionFingerprint` are all untouched.
Purely additive.

**Self-limiting, no dedup logic needed.** Once re-stamped, `acceptedSha` (read fresh next pass via
`parseReviewedSha`) equals `liveHeadSha`, so `shouldReattributeRebase`'s own "SHAs differ" check is false on the
next pass — it naturally stops firing for a PR that stops moving, with no separate dedupe helper required
(unlike `postDrainReasonComment`'s reason-text dedupe, which does not apply here since each re-attribution
names a genuinely new SHA).

**A known, accepted minor cost:** a PR the drain rebase-drops repeatedly (main advances again before the PR's
next merge attempt) gets a FRESH re-attribution comment each time — cosmetic comment noise, not a correctness
issue, and no worse than the CURRENT behaviour where the un-re-attributed PR silently re-derives via the
fingerprint tier every such pass with zero comment trail at all.

## Tasks

1. Add `shouldReattributeRebase` and `buildRebaseReattributionComment` to
   `we:scripts/lib/review-escalation.mjs`, next to the existing marker builders (reuses
   `buildReviewedShaMarker`, already exported at we:scripts/lib/review-escalation.mjs:820).
2. Unit tests in `we:scripts/lib/__tests__/review-escalation.test.mjs`:
   `shouldReattributeRebase` — true only when all of (rebaseDropAction==='rebased', gateAction==='merge',
   both SHAs present, SHAs differ) hold; false when tested individually against each of the other four
   conditions. `buildRebaseReattributionComment` — round-trips through the EXISTING `parseReviewedSha` (i.e.
   `parseReviewedSha([{ body: buildRebaseReattributionComment(sha) }])` returns `sha.toLowerCase()`); returns
   `''` for an invalid/empty SHA.
3. Wire the call site into `we:scripts/merge-ai-prs.mjs`'s escalation pass exactly as specified in Interfaces,
   above (~we:scripts/merge-ai-prs.mjs:3373) and add the two new names to the existing review-escalation import
   (we:scripts/merge-ai-prs.mjs:113).
4. Update this card's own "Directions worth costing" list above: mark "Attribute the move to its actor" as
   IMPLEMENTED by this story (narrows only; does not close), leaving the other two directions open as named
   future work.
5. `npm run test:unit` (this story touches code) and `npm run check:standards`.

**Not a task — a documented limitation.** The new `gh pr comment` call in
`we:scripts/merge-ai-prs.mjs`'s escalation pass follows the SAME raw-`execFileSync` pattern the adjacent
accept-comment fetch already uses (we:scripts/merge-ai-prs.mjs:3330), which is not independently unit-tested at
the CLI-wiring level either — `postDrainReasonComment` (we:scripts/merge-ai-prs.mjs:2538-2548), the file's
existing analogous comment-poster, is likewise untested as a wired call site; only its pure text-builder
sibling (`buildDrainReasonComment`) is (we:scripts/__tests__/merge-ai-prs.test.mjs:2328-2341). This story keeps
the SAME split — pure logic tested, impure wiring reviewed by eye — rather than inventing new CLI-mocking
infrastructure this file does not otherwise use. An independent reviewer should read the wiring diff directly.

## Done when

- `shouldReattributeRebase` and `buildRebaseReattributionComment` are exported from
  `we:scripts/lib/review-escalation.mjs` and unit-tested in
  `we:scripts/lib/__tests__/review-escalation.test.mjs` per Tasks item 2, above.
- The pinned test `'THE KNOWN RESIDUAL, pinned at its WIDENED width: any offset-only relocation collides
  (#x413mbt)'` (we:scripts/lib/__tests__/review-escalation.test.mjs:1198) is UNCHANGED and still passes — this
  story does not touch `normalizeContributionFingerprint`, so the residual's logical width is unchanged; only
  its real-world exposure (how often the drain's own operation reaches it) narrows.
- `we:scripts/merge-ai-prs.mjs`'s escalation pass calls `shouldReattributeRebase` immediately after computing
  `gate` for each candidate (per Interfaces, above), gated on `!DRY_RUN`, and on `true` posts
  `buildRebaseReattributionComment(liveHeadSha)` via `gh pr comment` — reviewed directly (see Tasks' documented
  limitation on why this specific call is not newly unit-tested).
- `npm run test:unit` and `npm run check:standards` both pass (0 errors).

## Delivery shape

One PR, landed as a single piece — no flag, no migration, no incremental staging needed. Both new exports are
strictly additive (new names, no existing signature changed) and the one new call site is a conditional
ADDITION inside an existing loop that is `false` for every PR that does not hit `v.rebaseDrop === 'rebased'`
this same pass — a PR that never goes through the drain's own rebase-drop behaves byte-identically to today.
Safe to land through the standard lane → PR transport.

## Scope note: lock-point files

Both edited files are heavily-scoped lock points (measured this run, `status: open`/`active` items only,
excluding this card): `we:scripts/merge-ai-prs.mjs` — 4121 lines, named in **59** other queued items'
`scope:`; `we:scripts/lib/review-escalation.mjs` — 1997 lines, named in **45**. Building this item serializes
against every other queued item that also names these files — dispatcher information, not a defect to fix
here.

## Bound on the exposure, meanwhile

The contribution escape is checked **last**, after the SHA test and the strict `normalizeDiffFingerprint` test,
so it can only ever honour an accept those already rejected — and only for a head advance in which every
added/removed line, every hunk length, every section heading and every inter-hunk gap is unchanged.

## What "bounded" does and does not buy — added 2026-08-10 from the independent review of PR #1158

The *Bound on the exposure* section above, and #1158's restatement of it, are both correct and both easy to
over-read. Stated sharply, so nobody reads the widening as smaller than it is:

> **`bounded` is an ordering guarantee, not a size guarantee.**

Checking this tier **last** bounds **which** transitions can reach it — only those the SHA test and the strict
`normalizeDiffFingerprint` test already refused. It says nothing about how large the false-honour class is once
a transition gets here, and #3054's repair made that class **strictly larger**. Ordering was unchanged by the
repair; width was the whole cost. Two different properties, one word.

**The case that makes the cost legible.** After #3054's repair, **any pure offset-only relocation is silently
honoured** — same files, same hunk order, same hunk lengths, same run shape, same content, only the old-side
start differs. That includes **a same-text move across a semantic boundary**: a guard moved past the thing it
guards. The suite pins three such shapes ("THE KNOWN RESIDUAL, pinned at its WIDENED width"), and **two of the
three were refused before** the repair — a move across a top-level declaration, and one hunk moving relative to
its sibling. This is the concrete thing an operator's clearance now carries forward.

**A frame-limit on the impossibility proof, worth knowing before anyone re-litigates it.** THE
INDISTINGUISHABILITY is sound, but it is proved *for a digest built from git's default 3-line-context unified
diff*. Under that frame the two events genuinely produce byte-identical projections. Widen the frame and they
need not:

- **A wider diff context.** More surrounding lines is more base text, so it costs invariance in the direction
  #1100 exercised — but the trade is a dial, not a wall, and it was never costed.
- **An AST-based scope anchor.** Record the enclosing *syntactic* scope rather than git's nearest column-0
  line. A guard moved past the call it guards changes its scope; a base insertion above it does not.

Neither is a counter-signal to the proof — both are **different mechanisms**, outside the frame the proof
assumes, and that is exactly why they are where a real closure could come from. Add them to *Directions worth
costing* alongside "attribute the move to its actor", "bound the escape by a recorded merge base", and
"recompute the reviewed side against the new base".

Related: [#3023](/backlog/3023-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/) (parent),
[#2409](/backlog/2409/).
