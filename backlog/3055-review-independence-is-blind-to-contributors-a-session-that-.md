---
bornAs: xto7zl6
kind: decision
status: open
scope: ["we:scripts/lib/review-independence.mjs", "we:scripts/review-set-label.mjs", "we:scripts/pr-land.mjs", "we:scripts/lib/auto-land-seam.mjs"]
dateOpened: "2026-08-09"
preparedDate: "2026-08-16"
relatedReport: reports/2026-08-16-3055-contributor-blindness-prep.md
relatedTo: ["3048", "2844", "2439", "2398", "2946", "3006"]
tags: [review, gate, self-clear, review-independence, clearance]
---

# Review independence is blind to contributors — a session that edits the branch but did not open the PR can still clear it

The independence check compares exactly two identities: the `authored-by-actor` stamp written once at PR-open,
naming only the opener, and the clearing session's live id. No commit authorship on the branch is ever read, so a
third session that lands a commit on the branch and then clears it passes the machine check while failing the
independence bar the check exists to enforce.

**Prepared.** The two forks below are grounded in a prior-art + codebase survey (`relatedReport`): industry
precedent (GitHub's "require approval of the most recent reviewable push", Gerrit's uploader-cannot-self-`+2`)
and two already-shipped patterns in this exact repo (`we:scripts/merge-ai-prs.mjs`'s per-commit author read,
and the `we:.githooks/` + `core.hooksPath` git-hook wiring `we:scripts/guard-git-push.mjs` already uses). Each
fork carries a recommended default in **bold**, attacked by a skeptic sub-agent and cleared by a fresh-context
two-confusion screen — recorded inline. Nothing is ruled; the record below is options + tradeoffs for a human
to ratify.

## Framing — two questions, in order

The prep's own first draft of Fork 1 tried to bundle "should this be enforced" and "how" into one three-way
choice (`## Fork N` should be `enforce via commit-read` / `enforce via stamp` / `norm-only`) and a skeptic
sub-agent refuted it: `option 3`'s justification ("spend the enforcement budget on #2946 instead") is
resource-allocation language, which the *not-a-prioritization* rule forbids as a fork branch. Splitting the
question in two removes that defect: **Fork 1** asks whether a mechanized signal belongs here at all (a
**ratify**, argued on merit with cost stripped out — never "is it worth the effort"); **Fork 2** asks, given
Fork 1's answer, *which* mechanism (a genuine either/or between two non-dominated designs). *When* either gets
built, relative to `#2946` and everything else, is ordinary backlog prioritization and lives outside this item.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — enforce at all? | (a) Yes — build a mechanized contributor signal | (b) No — stay norm-only | High |
| 2 — which mechanism? | (b) Push-time PR-comment/body marker | (a) Commit-time git trailer | Med-high — genuine, close tradeoff |

## Fork 1 — does a mechanized signal close this gap, or does it stay norm-only?

**Fork-existence justification (forced invariant, not a genuine weigh):** strip cost from the comparison —
imagine a correctly-scoped contributor signal is free to build and instantly, perfectly maintained. Under that
hypothetical, "leave it norm-only" produces a *strictly worse* real-world outcome: the gap this item names stays
silently exploitable forever, for zero benefit, when a free alternative exists. That is a genuine merit
delta (an audit/correctness property — can a norm violation be caught at all — not a cost or timing one), so
`(b)` is the excluded/flawed branch, and `(a)` is a **ratify**. This also mirrors a philosophy the codebase has
*already* ratified for the mechanism this item extends: `we:scripts/lib/review-independence.mjs`'s own header
states the existing `authored-by-actor` stamp's purpose is that "self-clearing now takes a DELIBERATE FORGE...
instead of costing nothing" — explicitly **not** claiming to stop a fully shell-access-privileged adversary
(that ceiling is out of scope here, and is `#2946`'s job). A contributor signal built to the same accepted
standard is asking for nothing new in kind, only in scope (opener → any contributor, the exact axis `#2439`
already drew for the opener case).

- **(a) Yes — build it [RECOMMENDED — ratify].** Some session-contributor signal is built (mechanism: Fork 2).
- **(b) No — leave it a norm.** Rejected per the justification above: once cost is stripped, this is dominated,
  not merely more expensive. *(The earlier framing of this branch as "spend the budget on #2946 instead" is
  itself the disguised-prioritization tell — struck; see Skeptic note.)*

**Skeptic:** REFUTED the first draft, which posed this as a genuine 3-way weigh with `(b)`'s case resting on
"spend the enforcement budget on #2946 instead" (resource-allocation language) and cited
`we:scripts/guard-git-push.mjs` as proof the residual bypass (`--no-verify`) is an already-accepted cost — a
citation-scope stretch, since that hook is explicit it is "defence-in-depth *alongside* the Bash guard + branch
protection," two other independent layers a lone contributor-signal mechanism would not have. Rewritten as
above: the ratify now rests purely on the free-to-build merit test and the existing author-stamp precedent,
with the citation corrected to name what it actually proves (the *wiring pattern* is reusable, not that the
residual is "already accepted" at this weaker trust tier — see Fork 2's own named residual).

**Screen:** clear — Q1 (does this rule on an invisible implementation detail?): no, it changes what any clearer
can get away with, an externally-observable capability. Q2 (free-to-build, does a merit difference survive?):
yes — norm-only leaves the gap open forever at zero benefit; the fork explicitly fences off timing/#2946 as a
separate call, so this does not collapse to prioritization.

## Fork 2 — given Fork 1's ratify, which mechanism: a commit-time trailer, or a push-time PR marker?

**Fork-existence justification (genuine either/or):** the prep's own first pass tried to dissolve option (b)
into "just a cache over (a)'s trailer, not a coequal branch" (the composability probe — B as a facade over A's
kernel). A skeptic sub-agent refuted that: (b) does **not** need (a)'s trailer to exist first — a push-time hook
has direct access to the same `CLAUDE_CODE_SESSION_ID` env var (a) would read (`currentActorId()`,
`we:scripts/lib/review-independence.mjs:81-84`), so it can write its own record with no dependency on (a) at
all. The two branches store the fact in genuinely different places with genuinely different, non-dominated
properties (tamper-evident git history vs. in-place-correctable PR record) — a real either/or.

- **(a) Commit-time git trailer.** A new `commit-msg` (or `prepare-commit-msg`) hook under `we:.githooks/`
  (extends the existing `core.hooksPath .githooks` wiring `we:scripts/guard-git-push.mjs`'s `pre-push` hook
  already uses, alongside the existing `pre-commit`/`post-merge` hooks) appends `Session-Actor: <id>` to every
  commit message:

  ```js
  // we:.githooks/commit-msg (new) — appends the contributor trailer at commit time, local/instant, no network.
  import { readFileSync, writeFileSync } from 'node:fs';
  import { currentActorId } from '../scripts/lib/review-independence.mjs';

  const [, , msgFile] = process.argv;
  const id = currentActorId();
  const body = msgFile ? readFileSync(msgFile, 'utf8') : '';
  if (id && msgFile && !/^Session-Actor:\s/m.test(body)) {
    writeFileSync(msgFile, `${body.trimEnd()}\n\nSession-Actor: ${id}\n`);
  }
  ```

  Read at clear time via a **new** `gh pr view --json commits` fetch — the same read shape
  `we:scripts/merge-ai-prs.mjs#isAiCommit` (`:304-309`) / `#isAiAuthor` (`:244-249`) already use in production
  to detect AI-authored commits, applied to a new field:

  ```js
  // A new export beside readAuthorActorStamps — same shape, different source (per-commit message, not the PR body).
  export function readContributorSessionIds(commits) {
    const ids = new Set();
    for (const c of Array.isArray(commits) ? commits : []) {
      const m = /^Session-Actor:\s*(\S+)/m.exec(String(c?.messageBody || c?.body || ''));
      if (m) ids.add(m[1].trim());
    }
    return [...ids];
  }
  ```

  Tradeoffs: **(+) tamper-evident and permanent** — once pushed, the trailer travels with the commit in git
  history; altering it after the fact requires a visible history rewrite, which is a *stronger* audit property
  than a comment (b) offers. (+) the write is local and instant, no network call at commit time. **(-)** the two
  existing safety-rail callers (`we:scripts/lib/auto-land-seam.mjs`, `we:scripts/review-set-label.mjs`) must
  now perform a **new** `gh pr view --json commits` fetch neither currently makes — a new failure mode
  (network/API error) inside the fail-closed refusal path. **(-)** uncorrectable in place: a misfired hook or a
  wrong env var leaves a bad or missing trailer that cannot be repaired without rewriting shared history —
  unlike `#3067`'s `STAMP_LOST` repair route for the existing author stamp.

- **(b) Push-time PR-comment/body marker [RECOMMENDED DEFAULT].** A new hook at the existing `pre-push`
  chokepoint (`we:.githooks/pre-push` → `we:scripts/guard-git-push.mjs`'s wiring point) posts/updates a **new,
  distinct** marker key — never reusing `AUTHOR_ACTOR_MARKER`, which would hit `parseAuthorActorId`'s
  agreement-or-nothing collision the item's first draft already found:

  ```js
  // New exports beside the existing marker builders in we:scripts/lib/review-independence.mjs — a fresh key,
  // so this can never collide with AUTHOR_ACTOR_MARKER's agreement-or-nothing scan (parseAuthorActorId is
  // untouched by construction).
  export const CONTRIBUTOR_ACTOR_MARKER = 'contributed-by-actor';
  export function buildContributorActorMarker(id) { return buildActorMarker(CONTRIBUTOR_ACTOR_MARKER, id); }

  // A growing SET, not agreement-or-nothing — every distinct id across the body + all comments.
  export function readContributorActorIds(body, comments) {
    const ids = new Set();
    const scan = (text) => {
      const re = actorMarkerRe(CONTRIBUTOR_ACTOR_MARKER, 'g');
      let m; while ((m = re.exec(String(text || ''))) !== null) ids.add(m[1].trim());
    };
    scan(body);
    for (const c of Array.isArray(comments) ? comments : []) scan(typeof c === 'string' ? c : c?.body);
    return [...ids];
  }
  ```

  Read at clear time by extending the existing decider with a new optional input, wired into both existing
  callers:

  ```js
  // decideClearerIndependence — existing checks (unknown-clearer, unknown-author, self-clear) unchanged;
  // one new branch, checked after self-clear so a self-clear still reports as SELF_CLEAR, not this.
  if (Array.isArray(contributorIds) && contributorIds.includes(clearer) && clearer !== author) {
    return {
      independent: false,
      status: INDEPENDENCE.CONTRIBUTOR_CLEAR, // new status, alongside the existing five
      reason: `CONTRIBUTOR-CLEAR REFUSED — the clearing actor (${clearer}) committed to this branch after `
        + `PR-open (per ${CONTRIBUTOR_ACTOR_MARKER}); it must not also clear the verdict it partly authored `
        + `(#3055, extending #2439's independence bar from "the opener" to "any contributor")`,
    };
  }
  ```

  Tradeoffs: **(+) no new dependency in the fail-closed refusal path** — `contributorIds` comes from parsing
  the *same* PR body/comments payload `we:scripts/review-set-label.mjs:489-492` and
  `we:scripts/lib/auto-land-seam.mjs` already fetch for the author/clearer comparison, so the safety rail's
  robustness to a network hiccup is unchanged (a real correctness/robustness property of the refusal path
  itself, not a labour-cost saving). **(+) correctable in place** — an append/edit on a PR comment, mirroring
  the repair philosophy `#3067`'s `STAMP_LOST` marker already established for this exact file, rather than
  requiring a git-history rewrite. **(-)** the write needs a network round-trip (`gh pr comment`/`gh pr edit`)
  from the `pre-push` hook, which today only inspects stdin locally — a new failure mode *at push time*
  (best-effort, must not block the push on a transient API error). **(-)** weaker audit permanence than (a): a
  PR comment can be edited or deleted by anyone with write access to the PR, whereas altering committed git
  history is a visible, harder-to-hide act — (a)'s tamper-evidence is real and not fully matched here.

**Named residual — honest, applies equally to (a) and (b):** both write mechanisms are **self-declared by the
very session being tracked**, at the exact moment it has maximum motive to skip the write (`git commit
--no-verify` / `git push --no-verify`). That is a **weaker** trust property than the existing `authored-by-actor`
stamp, which a *shared tool* (`we:scripts/pr-land.mjs`) writes automatically at PR-open — before the writing
session could know it would later want to self-clear (the temporal-separation property the file's own header
calls out as the whole reason a forge there requires deliberate tampering with someone *else's* record, not a
private omission of one's own). Neither (a) nor (b) closes the gap against a fully adversarial, shell-access
session — that ceiling stays `#2946`'s job, consistent with the scope this file already accepts for every other
session-id signal it defines. What both buy is coverage of the **cooperative-but-forgetful** case named in the
item's own "bound" section (a norm-evasion gap, not a privilege escalation) — a real, bounded improvement, not
oversold as more.

**Skeptic:** REFUTED the first draft's dissolution of (b) as a mere facade over (a) — restored as a coequal
branch (see fork-existence justification above). Also flagged the first draft's citation of
`we:scripts/guard-git-push.mjs` as blanket proof the `--no-verify` residual is "already accepted" — corrected:
that citation now only supports the *wiring pattern* being reusable, and the trust-tier gap versus the existing
author stamp is named plainly instead (Named residual, above), per the file's own `#2895` discipline of saying
plainly what a signal is not.

**Screen:** clear on both — Q1 (implementation detail?): no, the choice changes what's actually recorded
(immutable per-commit history vs. mutable per-push PR state) and what the two existing safety-rail callers
depend on (a new external fetch vs. reuse of an already-fetched payload), both externally-observable
architecture properties. Q2 (merit survives free-to-build?): yes — (a) keeps unmatched tamper-evidence, (b)
keeps the fail-closed path free of a new live dependency and stays in-place correctable; different real
outcomes, not cost dressed as merit. **One flag on the initial phrasing of (b)'s default:** the two-confusion
screen noted the original wording leaned on convenience language ("zero new network call," "already proven read
pattern") that reads cost-flavored even though defensible as a safety-rail-robustness/correctness property —
reworded above to state it as exactly that (the refusal path's own resilience to a network hiccup), and (a)'s
tamper-evidence is named as a real, unmatched advantage of the non-default branch rather than argued away.

---

## Context

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

## Acceptance

- [ ] Fork 1 is ratified (or overridden) and Fork 2 is ratified, with the losing options' costs recorded.
- [ ] Whatever is ruled, the record states plainly whether contributor-blindness is *enforced* or *deliberately
      left to the norm* — silence is not an acceptable outcome.
- [ ] If enforcement is chosen: given a PR whose `authored-by-actor` is session A and whose branch carries a
      commit/push by session B, a clearance attempt by B is refused, and a test asserts it on a fixture in that
      state.
- [ ] The existing refusals are unchanged — a test asserts that a self-clear on `--to=accepted` and a
      `--to=clear-human` on a PR without `review:human` still fire.
- [ ] Whichever mechanism is chosen uses a **new, distinct** marker/trailer key — `parseAuthorActorId`'s
      *agreement-or-nothing* property over `AUTHOR_ACTOR_MARKER` is preserved unchanged, never overloaded with a
      second, accumulating meaning.

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
  a signal that can be faked. Fork 1's ratify explicitly leaves the *timing* of this item's build relative to
  #2946 as ordinary backlog prioritization, not part of this call.
- **#3067** (landed, on `main`) is the closest sibling *mechanism* precedent: it added a new, distinct marker
  (`author-stamp-lost`) rather than overloading the existing one, and a repair-in-place philosophy — the same
  shape Fork 2 (b) reuses for the contributor marker.
- **#3006** (open epic) holds the session-id inheritance measurement this all rests on.
