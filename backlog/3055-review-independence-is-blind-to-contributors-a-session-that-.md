---
bornAs: xto7zl6
kind: decision
status: open
scope: ["we:scripts/lib/review-independence.mjs", "we:scripts/review-set-label.mjs", "we:scripts/pr-land.mjs", "we:scripts/lib/auto-land-seam.mjs"]
dateOpened: "2026-08-09"
relatedTo: ["3048", "2844", "2439", "2398", "2946", "3006"]
tags: [review, gate, self-clear, review-independence, clearance, capture]
---

# Review independence is blind to contributors — a session that edits the branch but did not open the PR can still clear it

The independence check compares exactly two identities: the `authored-by-actor` stamp written once at PR-open,
naming only the opener, and the clearing session's live id. No commit authorship on the branch is ever read, so a
third session that lands a commit on the branch and then clears it passes the machine check while failing the
independence bar the check exists to enforce.

**Capture only.** Nothing is built and nothing is ruled here. The design question below is stated and left open
on purpose.

## What the code actually does — the two ids, and only those two

Read against `main` at `480e8de7`:

- **The author id is stamped once, at PR-open, by the producer.**
  [we:scripts/pr-land.mjs#withAuthorStamp](../scripts/pr-land.mjs) appends
  `<!-- authored-by-actor: <CLAUDE_CODE_SESSION_ID> -->` to the PR body, from the module-scope `AUTHOR_MARKER`
  built by `buildAuthorActorMarker(currentActorId())`. It is **idempotent and never updated**: the function
  returns the body unchanged the moment `readAuthorActorStamps` finds any existing stamp, and
  [we:scripts/pr-land.mjs#composePrBody](../scripts/pr-land.mjs) is the only caller. So the stamp records the
  session that ran `pr-land`, once, and nothing rewrites it as the branch grows.
- **The clearer id is read live, at clear time.**
  [we:scripts/review-set-label.mjs#runReviewLabelCli](../scripts/review-set-label.mjs) sets
  `const clearerId = currentActorId()` and, when the target stamps an acceptance, calls
  `decideClearerIndependence({ authorId: parseAuthorActorId(prBody), clearerId })`.
- **The decider compares those two strings and nothing else.**
  [we:scripts/lib/review-independence.mjs#decideClearerIndependence](../scripts/lib/review-independence.mjs) is
  pure over `{ authorId, clearerId }`: empty clearer → `unknown-clearer`, empty author → `unknown-author`,
  exact-equal → `self-clear`, otherwise → `independent`. Its **entire input** is the PR body's single resolved
  stamp plus one env var.
- **Both consumers inherit that input.** The invoked CLI refuses only a proven `self-clear` on `--to=accepted`;
  SAFETY RAIL 4 in [we:scripts/lib/auto-land-seam.mjs#decideAutoLand](../scripts/lib/auto-land-seam.mjs) refuses
  anything that is not `independent`. Neither reads the branch.

**Confirmed by search, not inference:** the only symbols exported by
[we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs) are the marker builders, the
body/comment parsers, `currentActorId`, and the decider. There is no commit, ref, or diff input anywhere in the
module, and no caller supplies one.

**Consequence.** Independence is judged against *who opened the PR*, never against *who wrote what is in it*. A
session that did not open the PR, commits to the branch, and then clears it is `independent` by the machine's
definition. **Fix-then-clear is invisible.**

## The live instance — PR #1135

`chalbert/web-everything#1135` (`lane/3032-operation-engine`, `MERGED` 2026-08-10, merge commit `480e8de7`).
Three sessions touched it:

1. Session `01f39b97-274a-4078-8eeb-e7f8d6008673` opened it. The body carries
   `<!-- authored-by-actor: 01f39b97-274a-4078-8eeb-e7f8d6008673 -->` — verified in the live PR body.
2. A second, headless session reviewed it adversarially and found a genuine gap: the effect executor's pre-sink
   `pending` mark had no test, and deleting it left all 113 tests green. It **fixed it in place** as commit
   `137e789250c3acaa92cf8e2c4d492a6e8348419b`, *"review(#1135): pin the pre-sink `pending` persist the suite did
   not hold"* — verified present on the merged branch. It then **declined to clear**, reasoning that its own
   commit was now on the branch.
3. A third session cleared it. The durable verdict comment (2026-08-10T01:53:24Z) stamps
   `<!-- cleared-by-actor: 0f03b262-af72-4439-9056-3bb5cde209b7 -->` — verified.

Had session 2 cleared instead, `decideClearerIndependence` would have compared *its own* session id against
`01f39b97-274a-4078-8eeb-e7f8d6008673`, found them different, and returned `independent` — with the fix commit
`137e7892` sitting on the branch, unread. The tool would have allowed it. **The restraint was a judgement call,
not an enforced one.** That is the whole item.

## The norm that currently substitutes for enforcement

*A session that edits a branch must not also clear it.* Recorded as the agent-memory leaf
`clearing-session-must-not-edit-the-branch`, landing via `chalbert/web-everything#1138` (`OPEN` at the time of
writing — the leaf is on `lane/capture-session-findings`, not yet on `main`). Its rule: the final reviewer
**reports** (`--to=changes`, routing the fix back to the author lane) and does not edit; the moment it commits
to the branch it co-authors the diff, and a further session is needed — which is why only a *reporting* final
reviewer terminates the recursion.

**The card's value is that a norm is not a check.** The memory leaf tells an agent what to do; nothing stops an
agent that does otherwise.

## The bound — say it honestly

This is a **norm-evasion** gap, not an escalation of privilege. Both existing refusals are **unaffected**:

- It **cannot** let an agent clear a PR it opened. That is the `self-clear` branch of the decider, and it fires
  on session-id equality regardless of commits.
- It **cannot** clear a `review:human` PR. INVARIANT 2 in
  [we:scripts/review-set-label.mjs#decideSetLabel](../scripts/review-set-label.mjs) (#2416) still refuses
  `→ accepted` there, and `--to=clear-human` is itself refused when the PR does not carry `review:human`.

What it permits is exactly one thing: a **contributor who is not the opener** recording an accept on a diff it
partly wrote. Read it as that, not as more.

## The design question — NOT ruled here

Three candidate shapes, deliberately left open:

1. **Read every commit author on the branch** and require the clearer to appear in none of them.
2. **Append to the `authored-by-actor` stamp** as contributors land, so the body accumulates the contributor set
   and the existing comparison becomes set-membership.
3. **Leave it a norm** — accept that this is judgment the memory leaf already carries, and spend the enforcement
   budget elsewhere (e.g. #2946).

Real costs on each side: (1) means the clearer must **fetch the branch** — the decider is currently pure over
two strings and both consumers call it with no I/O, so this moves it from a pure comparison to a git read;
(2) means a **write on every push**, and it collides head-on with the reader's *agreement-or-nothing* rule —
[we:scripts/lib/review-independence.mjs#parseAuthorActorId](../scripts/lib/review-independence.mjs) resolves a
body carrying two **different** author stamps to `''` (i.e. `unknown-author`, which the autonomous seam refuses
outright), so "append a second stamp" as written today does not extend the record, it **destroys** it; (3)
leaves the hole knowingly open.

**A measured constraint on option (1), which the obvious framing gets wrong.** Git commit authorship carries
**no session identity at all**. Every commit on `lane/3032-operation-engine` — the opener's `58cd55b3` and the
second session's `137e7892` alike — is authored `Nicolas Gilbert <nic.g.gilbert@gmail.com>`; the git identity is
the human's in every lane. The only per-commit agent signal is the `Co-Authored-By` trailer, and it names a
**model** (`Claude Opus 5 (1M context)` vs `Claude Fable 5`), not a session — two sessions on the same model are
indistinguishable by it. So "read the commit authors" is not a cheap read of data that already exists: it first
requires a session id to be stamped into commits. That is a cost of the option, not a ruling against it.

## Acceptance

- [ ] The fork above is ruled, with the losing options' costs recorded.
- [ ] Whatever is ruled, the record states plainly whether contributor-blindness is *enforced* or *deliberately
      left to the norm* — silence is not an acceptable outcome.
- [ ] If enforcement is chosen: given a PR whose `authored-by-actor` is session A and whose branch carries a
      commit by session B, a clearance attempt by B is refused, and a test asserts it on a fixture in that state.
- [ ] The existing refusals are unchanged — a test asserts that a self-clear on `--to=accepted` and a
      `--to=clear-human` on a PR without `review:human` still fire.
- [ ] If enforcement is chosen via the stamp, the *agreement-or-nothing* property of `parseAuthorActorId` is
      either preserved or explicitly superseded with its reasoning recorded — it must not be broken silently.

## Neighbours — related, not duplicated

- **#3048** (open decision) is the closest card and records the larger finding that *independence is checked at
  one seam only* — the clearance seam, never the review seam — because a subagent inherits its parent's session
  id. **It does not state contributor-blindness.** Its two cases both concern the *opener*: a self-authored PR
  with no recording route, and a reviewer subagent that is the same actor as the author. This item is the
  opposite direction — a **third** session that is genuinely a different actor, becomes a contributor after open,
  and is therefore *wrongly* cleared as independent. Distinct hole, same module.
- **#2844** (resolved, landed as `chalbert/web-everything#1100`) built
  [we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs) and the land seam's refusal of
  a self-cleared verdict. It is the code this item reads; resolved, so it cannot absorb this.
- **#2439** and **#2398** (both resolved) are the independence bar itself — *the clearing agent must not be the
  author*, applying the distinct-fresh-validator rule. This item asks whether "the author" should mean "the
  opener" or "any contributor".
- **#2946** (open, `tier: someday`) is the identity-verification residual — a hardware human-presence gesture for
  the *forgeability* of the actor signal. Orthogonal: this item is about a comparison with the wrong inputs, not
  a signal that can be faked.
- **#3006** (open epic) holds the session-id inheritance measurement this all rests on.
