---
bornAs: x6epe3f
kind: story
size: 2
status: open
dateOpened: "2026-08-02"
relatedTo: ["2884", "2883", "2409", "2198"]
tags: [backlog, review, gate, fork, batchable]
scope:
  - we:backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb.md
  - we:backlog/2883-a-stale-acceptance-must-stay-non-waivable-after-the-accepted.md
---

# Carve #2884's three-option fork into a decision item and repair the scope it leaves unsound

#2884 weighs three options with no default while computing `batchable`, and its declared scope covers only one of the three — so a build agent gets an item with nothing to build and a lease that is wrong for the two options the item itself prefers.

## Where this came from

A `/review` pass over PR #1003, red-teamed afterwards. This is one of the three findings of six that
survived. The red-team tried hard to refute it — checked the real `batchable` derivation, checked whether
the existing lint already catches it, checked whether an outcome-stated Definition of done excuses a missing
default — and every angle failed.

## The fork is live and the item is dispatchable

[we:backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb.md](backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb.md)
lists three options — content-keyed coverage via patch-id, keep sha-identity and remove the race, or
auto-re-stamp on a provably-identical rebase — all three bolded, so bolding marks no default. Its closing
line states only a negative constraint ("this should not be filed as switch-to-patch-id"), never a pick.

It is nonetheless dispatchable. Running the real loader,
[we:src/_data/backlog.js](src/_data/backlog.js) derives `{ tier: 'A', batchable: true }` for #2884
(`story` + `size <= 8` + clear blockers + no `projectPending` + no human gate). Re-verified 2026-08-21:
`node we:scripts/check-readiness.mjs --json` still lists **both** #2884 and #2883 under `selection.batchable`. So
the conveyor hands #2884 to a build agent that has three approaches and no ruling — the buried-fork stop risk
[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) names at `:630` for exactly this shape.
(The two `#L514` / `#L541` line anchors this card originally cited are stale — that file has moved on; the
live line numbers are `:630` and `:657`.)

[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) `:657` is the governing rule: "A fork
lives in a `kind: decision` item — never inline in an idea/epic/story body… Carve instead: (1) scaffold a
separate `kind: decision` item holding the fork(s) in the prepared-fork shape (options + bold default +
concrete refs); (2) make the original `blockedBy` that decision; (3) trim the fork out of the original's
body."

## The scope is the proof, not just the discipline

This is what makes it more than an authoring nit. #2884's `scope` is
`[we:scripts/lib/review-escalation.mjs]` — which covers **option 1 only**. Option 2 ("do not rebase a PR
that carries a live acceptance") and option 3 ("the drain re-stamps the marker") both live in the
drain/lander, `we:scripts/merge-ai-prs.mjs` and `we:scripts/lane-drain.mjs`, outside the declared lease. The
item's own body says the second and third are the ones that keep #2409's safety posture intact. So the
unmade choice leaves the machine-read field wrong for the two options the item prefers.

## #2883 carries a milder instance of the same shape

[we:backlog/2883-a-stale-acceptance-must-stay-non-waivable-after-the-accepted.md](backlog/2883-a-stale-acceptance-must-stay-non-waivable-after-the-accepted.md)'s
third Definition-of-done bullet — "The operator retains a documented way out, and it is named in the refusal
message" — names no way out, and its body defers the choice ("it should be a deliberate call, not a side
effect. Cross-check with the sibling question in the companion item"). A build agent would have to invent
the escape hatch for a gate whose whole purpose is refusing waivers. It is also a genuinely cross-item fork:
which escape survives depends on how #2884's fork is ruled.

## Design

*Grounded against the live tree 2026-08-21.*

### State of the two target cards, right now

| fact | #2884 | #2883 |
|---|---|---|
| `kind` / `size` | `story` / `3` | `story` / `2` |
| `scope` | `["we:scripts/lib/review-escalation.mjs"]` | `["we:scripts/lib/review-escalation.mjs", "we:scripts/merge-ai-prs.mjs"]` |
| `blockedBy` | *(absent)* | *(absent)* |
| in `selection.batchable` | **yes** | **yes** |
| flagged by the buried-fork lint | **no** | **no** |

Two things follow. First, the finding still stands — nothing has been carved since it was filed. Second,
the **existing lint genuinely does not catch this**: `findBuriedForkSections` and `findNonBatchableMarkers`
([we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs) `:472` / `:592`) both return an
empty array for each card, because #2884 states its three options as ordinary bolded prose rather than under
a fork heading or with a non-batchable marker phrase. That is what makes this a carve, not a lint fix.

Note also that #2884 has since gained `parent: "3054"` — re-read it before editing; do not carve from this
card's quoted excerpts alone.

### The mechanical steps, in order

1. **Scaffold the decision.** `node we:scripts/backlog.mjs scaffold --kind=decision --title="…"` — a `decision`
   takes no required `size` ([we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) sizing
   table). Author it in the prepared-fork shape: the three options with their stated tradeoffs, **one bold
   default**, and the refs already gathered in #2884's body.
2. **Edge, then trim.** `blockedBy: ["<new NNN>"]` on #2884, then delete the fork prose from its body,
   leaving the evidence (the #983 livelock) and a one-line pointer. Order matters: `check:standards` errors on
   an unresolvable `blockedBy`, so the decision must exist on disk first.
3. **Repair #2884's scope** to match the ruled option — adding `we:scripts/merge-ai-prs.mjs` /
   `we:scripts/lane-drain.mjs` if it lands on option 2 or 3. If the decision is not ruled in the same pass,
   say so on #2884 rather than guessing the scope.
4. **#2883** — either name the operator escape in its third DoD bullet, or add the same `blockedBy` edge. The
   card itself says the escape depends on how #2884's fork is ruled, which points at the edge.

### Two things independent review found that must be checked FIRST (2026-08-21)

**1. Re-read #3054 before scaffolding anything — the fork may be substantially overtaken.** #2884's parent
epic [we:backlog/3054-the-acceptance-coverage-digest-re-parks-a-cleared-pr-whose-c.md](backlog/3054-the-acceptance-coverage-digest-re-parks-a-cleared-pr-whose-c.md)
carries a banner dated 2026-08-10: *"DIGEST REPAIRED 2026-08-10 — the two false-stale slices are closed; the
epic stays OPEN on the other two."* And `acceptanceCoversHead`
([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `:1379`) is **no longer a bare
sha-identity test**: it now has a content-equivalence diff-fingerprint escape and a contribution-fingerprint
escape layered above the sha compare, landed by #2979 and #3023 *after* #2884 was filed. #2884's body — and
therefore this card's premise that its three options are all still live — predates that.

So the first step is not `scaffold`. It is: re-read #2884 against #3054 and the live `acceptanceCoversHead`,
and decide whether the fork still has three live options, one, or none. If option 1 (content-keyed coverage)
is effectively already shipped, the right move may be to **narrow or close #2884**, not to carve a decision
item asking a human to ratify a choice the code already made. Carving a stale fork wastes a ratification
cycle; that is a worse outcome than doing nothing.

**2. Trimming the fork prose breaks a sibling item's fixtures — coordinate with #2887.**
[we:backlog/2887-widen-the-buried-fork-lint-past-heading-matching-so-a-fork-u.md](backlog/2887-widen-the-buried-fork-lint-past-heading-matching-so-a-fork-u.md)'s
Definition-of-done reads *"#2884 and #2883 are both flagged by the widened rule (**the regression fixtures**)"*
— its proof depends on those two cards still carrying the un-carved fork prose. Step 2 below deletes exactly
that prose. Whichever lands second finds the other's premise gone.

Resolve it deliberately, one of two ways: land #2887 first (it needs no change from this card), **or** copy
#2884/#2883's current fork prose into `we:scripts/__tests__/` fixture files as part of this item, so #2887's
regression corpus survives the trim. Say which was done. Do not silently trim and leave #2887 unbuildable.

### One thing this card does NOT get to decide

It carves the fork; it does not rule it. Writing the bold default is a judgment call about the drain's safety
posture (#2409), and the whole point of the carve is that it happens in a `decision` item a human ratifies.
Author the default as a *recommendation with its reasoning*, and leave the decision `status: open`.

## Done when

- **#2884 has been re-read against #3054 and the live `acceptanceCoversHead`, and the card records how many of
  the three options are still live.** This gates everything below: if the answer is "none", the correct
  outcome is narrowing or closing #2884, and no decision item is scaffolded at all. Checkable by reading the
  one-line finding written onto this card.
- If the fork survives that check: a `kind: decision` item exists on disk holding the still-live options with
  their tradeoffs, exactly one **bold default**, and the concrete refs from #2884's body.
- `node we:scripts/check-readiness.mjs --json` no longer lists #2884 under `selection.batchable` — because the
  new `blockedBy` edge points at an unresolved decision. Fails before (it is listed today), passes after.
  Same for #2883 if the edge route is taken there; if the escape is named inline instead, #2883 legitimately
  stays batchable and the card should say which route was taken.
- `node we:scripts/check-standards.mjs` → 0 errors — this is the real gate on the carve, because it validates
  that every `blockedBy` edge resolves, is acyclic, and that the new `decision` item's frontmatter is
  well-formed. It fails immediately if step 2 is done in the wrong order.
- `node we:scripts/check-backlog-item.mjs <new-decision-id>` → `✓ clean`, and the same for #2884 and #2883.
- #2887's regression fixtures survive: either #2887 landed first, or #2884/#2883's fork prose was copied into
  a fixture under `we:scripts/__tests__/` before the trim. `npx vitest run` against
  `we:scripts/__tests__/check-standards-rules.test.mjs` stays green either way, and the card names which route
  was taken.
- #2884's `scope` no longer covers only option 1: either it names the drain/lander files
  (`we:scripts/merge-ai-prs.mjs`, `we:scripts/lane-drain.mjs`) or its body states in one line why the scope
  cannot be finalised until the decision is ruled. Checkable by reading the frontmatter.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: prove the premise by mutation or reversion first) — 2886 never re-derives #2884's central claim — 'acceptanceCoversHead compares sha identity' — against the live we:scripts/lib/review-escalation.mjs (lines 1379-1424), which already carries a content-equivalence diff-fingerprint escape (#2979, status: active, landed 2026-08-07/08) and a contribution-fingerprint escape (#3023, resolved 2026-08-08) on top of the SHA check. #2884's own parent epic we:backlog/3054-the-acceptance-coverage-digest-re-parks-a-cleared-pr-whose-c.md, updated 2026-08-10, already frames the digest mechanism as repaired and lists #2884 as 'the caller' rather than as three still-open architecture branches. 2886 flags that #2884 'has since gained parent: "3054" — re-read it before editing' but does not itself read #3054 or its siblings #2979/#3023 to check whether the fork it wants carved is still live.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — we:backlog/2887-widen-the-buried-fork-lint-past-heading-matching-so-a-fork-u.md (filed the same day as 2886, evidencing the identical #2884/#2883 gap almost verbatim) states its Definition of Done as '#2884 and #2883 are both flagged by the widened rule (the regression fixtures)' — i.e. it needs those two cards' CURRENT fork prose to still be present to prove the widened lint works. 2886's own mechanical step 2 ('delete the fork prose from its body') removes exactly that prose from #2884 (and step 4 may do the same for #2883), so if 2886 lands before #2887 is built, #2887's stated fixture plan is no longer satisfiable as written. 2886 never names or accounts for #2887 anywhere in its scope or body.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — Step 3's fallback ('If the decision is not ruled in the same pass, say so on #2884 rather than guessing the scope') has no deterministic backstop — nothing in `we:scripts/check-standards.mjs` verifies that a body note was actually added when the scope repair is skipped, so a build agent that forgets the note leaves #2884's scope silently wrong with no red gate to catch it.

**Corrections applied by this review:**

- The card's framing that `acceptanceCoversHead` 'compares sha identity' describes only the first of three tiers in the live function (we:scripts/lib/review-escalation.mjs:1379-1424) — a content-equivalence diff-fingerprint escape (#2979) and a contribution-fingerprint escape (#3023) already sit on top of it, both landed after #2884 was filed.
- #2884's parent epic we:backlog/3054-the-acceptance-coverage-digest-re-parks-a-cleared-pr-whose-c.md (updated 2026-08-10) already documents the digest mechanism as repaired and frames #2884 as the epic's convergence bar/'caller', not as three still-undecided architecture branches — a framing the card does not cite despite flagging the parent field itself.
- The card's :630/:657 citations to we:docs/agent/backlog-workflow.md are correct against the live file, but the backlog/2886-*.md file actually on disk still carries the stale #L514/#L541 citations and lacks the mechanical-steps/Done-when detail the reviewed text describes.

The mechanical claims (batchable derivation, lint blind spot, doc-line citations, scaffold syntax) all verify against the live repo, but the card's central premise — that #2884's three-option fork is still live and needs fresh ratification — was not checked against #2884's own parent epic #3054, which already shows the underlying mechanism substantially repaired, and the carve's own trim step conflicts with a sibling item's (#2887) regression-fixture plan.

_Recorded through the declared `review-prep` operation._
