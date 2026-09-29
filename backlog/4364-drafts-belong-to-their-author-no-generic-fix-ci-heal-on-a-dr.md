---
bornAs: x7qre1u
kind: story
size: 8
priority: high
status: open
scope: ["we:scripts/conveyor/reconcile-core.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/conveyor/review-status-tag.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/build-dispatch-policy.mjs", "we:scripts/conveyor/build-dispatch-claim.mjs", "we:scripts/conveyor/fix-dispatch-claim.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/promote-draft-pr-dispatch.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/lib/pr-snapshot.mjs", "we:scripts/lib/pr-events.mjs", "we:scripts/verify-lane.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs", "we:scripts/__tests__/merge-ai-prs-draft-invisible.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Drafts belong to their author: no generic fix/ci-heal on a draft; red CI on a draft goes back to the author

PR #2855 (building #4349) was a draft with a real soak break written and about to be pushed when the resident ci-heal daemon healed the red we:.github/workflows/soak-replay-gate.yml check by pushing a soak-waiver instead, orphaning the author's real work. we:scripts/conveyor/reconcile-core.mjs's ci-heal branch and its stacked-conflict fix branch carry no isDraft gate (we:scripts/conveyor/review-status-tag.mjs already says a draft is never exempt from CI healing — only from review), and we:scripts/conveyor/build-dispatch-claim.mjs retires the delivery agent's own claim the moment a PR opens, draft or not. Review already refuses drafts; generic fix/ci-heal must too, while the author's claim survives its own draft.

## Operator ruling (2026-09-28, refined twice after the initial ask)

**"The builder is responsible until the PR is not in draft."** Ownership of a draft PR belongs to the delivery
item/builder from open until it is promoted out of draft (its required checks all green — the SAME promotion
`we:scripts/operations/promote-draft-pr-dispatch.mjs` already performs). That does not mean the builder must fix
red CI itself: it MAY delegate to a specialist fixer through a **local request marker → dispatcher → specialist
session** path (the same pattern `we:scripts/verify-lane.mjs`'s own `request` mode already uses: an interactive
session drops a `request`-stamped marker, and a separate mechanical pass — there, `we:scripts/conveyor/verify-dispatch.mjs` —
picks it up on its next tick and runs it to completion; the specialist-role delegation card the operator named,
`4361`, is the general form of this same shape) — **never through the fix/ci-heal daemon's `we:reconcile-core.mjs`
path**, which is heavier (an independent agent dispatch, a claim, a review-adjacent comment thread) for a case
that is really "the builder's own next step, possibly handed to a cheaper specialist." The signal that a draft's
CI went red should come from the webhook/PR-events feed (`we:scripts/lib/pr-events.mjs`, #2812) or the verify
result the builder's own lane already produces — **never from a daemon polling `gh pr list` for draft state**,
which is exactly the GraphQL-budget pressure #2812 was built to relieve. Only after promotion do the review/fix
daemons take over, unchanged from today.

**"A draft is invisible to every daemon except its author's path."** The drain must not comment, label, or
otherwise touch a draft PR at all — not even a "skip" comment. Live evidence: draft PR #2835 got a
`drain-skip-reason` comment ("required check 'test' is not green" / "merge state ... DRAFT⇒not landable") from
`we:scripts/merge-ai-prs.mjs`'s own skip path (`decision = 'skip'` at line 661, `... DRAFT⇒not landable ... left
for its author`) — the DECISION not to land was already correct, but the drain still spent a `gh` write telling
the author something they already know (their own PR is a draft). Same principle extends to
`we:scripts/conveyor/parked-pr-conflict-watch.mjs`, which today has NO `isDraft` check anywhere in its detection
loop and will apply `merge-status:conflicting` + a comment to a draft exactly as it would a ready PR — and to
`we:scripts/conveyor/review-status-tag.mjs`, whose labels beyond the author's own `awaiting-ci` status (see
Design) must not be applied to a draft either.

## Design

**Ownership window.** A PR is "author-owned" from `isDraft: true` at open through the first tick where
`we:scripts/operations/promote-draft-pr-dispatch.mjs` un-drafts it (all required checks green). Every mechanical
daemon this card touches gates on this SAME `pr.isDraft` field already threaded through `we:reconcile-core.mjs`
(see `deriveReviewStatus`'s existing `isDraft` param) — no new draft-detection is invented.

**Generic fix/ci-heal refuses a draft, mirroring the EXISTING review refusal exactly — every dispatch branch,
not only three of them (first-pass gap: the advisory-fix and ordinary bounced-review-fix branches were missed).**
`we:scripts/conveyor/reconcile-core.mjs`'s `dispatchReviewRow` already refuses review on `pr?.isDraft` FIRST,
ahead of every other check (around line 1063: `if (pr?.isDraft) refuse('draft', ...)`). FIVE branches get the
IDENTICAL refusal shape, checked first, for the same reason a draft's red check or conflict is the author's own
problem to resolve or delegate, not the daemon's: the ci-heal branch (`phase === 'ci-red'`, lines ~1532-1709),
the two conflict-fix branches (stacked-rebase ~1930-1940, main-base ~2040), the **advisory-fix branch**
(`phase === 'needs-human'` + `advisory:changes`, `we:scripts/conveyor/reconcile-core.mjs:1750`, `dispatch.push({
kind: 'fix', mode: 'advisory-fix', ... })`), and the **ordinary bounced-review fix branch** (the ELSE arm after
`dispatchReviewRow` at `we:scripts/conveyor/reconcile-core.mjs:2078`, `dispatch.push({ kind: 'fix', ... })` with
no mode qualifier) — neither of the last two is protected by `dispatchReviewRow`'s own refusal (that function is
only called for the REVIEW half, `we:scripts/conveyor/reconcile-core.mjs:1985`), so a withdrawn draft with
findings already on its thread could still reach either fix path today.

**Execution-side guard needs REAL draft data, which does not exist at three real boundaries today (first-pass
gap: guards tested only against injected `{isDraft: true}` fixtures would still pass while production writes to
or heals drafts).** `pr.isDraft` is already in `we:scripts/lib/pr-snapshot.mjs`'s `SNAPSHOT_FIELDS` (the shared
open-PR snapshot supports it), but nothing REQUESTS it at the call sites this card touches:
`we:scripts/merge-ai-prs.mjs`'s own direct `gh pr list --json` call (`:4018`) omits `isDraft` from its field
list; `we:scripts/conveyor/parked-pr-conflict-watch.mjs#defaultListParkedPrs` (`:1359`) omits it from BOTH the
shared-snapshot field request and the direct `gh pr list --json` fallback. Both gain `isDraft` in their existing
field lists — a one-line addition at each, not a new read. `we:scripts/operations/ci-heal-pr-dispatch.mjs`'s
execution-side `planned` object (`:273`, built from `entry`/`resolveWorkUnit`) carries no `isDraft` field at all
and has no fresh reader of its own — the "defense-in-depth" layer the first pass promised did not actually exist
yet. `dispatchCiHeal` (`we:scripts/operations/ci-heal-pr-dispatch.mjs:65`) gains an injectable
`readDraftState = ({repo, pr}) => ...` seam (mirroring its own existing `readFixClaim`/`readBrief` injection
pattern) that re-reads `isDraft` fresh, at dispatch time, straight off `gh pr view` — never trusting the
planning-time snapshot alone, which is the actual race the "second layer" was meant to close.

**The delegation path a builder MAY use instead of fixing it personally**, modeled on `we:scripts/verify-lane.mjs`'s
`request`/`check` shape: the builder (or its wrapper) drops a request marker naming the role needed (e.g.
`ci-fix`) on its OWN lane; a dispatcher (the mechanism `4361` declares) picks it up and launches a specialist
session scoped to that one fix, cheaper and less `gh`-heavy than a full reconcile-core round because it never
re-derives review status, never posts a review-adjacent comment thread, and works directly in the builder's own
lane rather than a fresh clone. This card wires reconcile-core's draft branches to STOP short-circuiting into
`kind: 'ci-heal'`/`kind: 'fix'` for a draft, but does not itself build the dispatcher — that is `4361`'s job.
Task 6 below sequences the delegation call after `4361` explicitly; no card-level `blockedBy` (Tasks 1-5 need
nothing from it).

**The author's claim survives its own draft (first-pass gap: this pointed at the wrong module and the wrong
mechanism).** `we:scripts/conveyor/build-dispatch-claim.mjs` is only the acquire/release PRIMITIVE (lock-dir
mkdir/TTL) — it holds no "PR delivers it" logic at all. The actual retirement predicate is `doneWhy` in
`we:skills-src/conveyor/build-dispatch-daemon.mjs` (`:157`: `const pr = openPrs.find((p) => prDeliversNum(p,
n)); if (pr) return ...`), fed by `we:scripts/conveyor/build-dispatch-policy.mjs#normalizeOpenPrs` (`:136`),
which today projects `{repo, number, headRefName, labels, files}` — **`isDraft` is discarded before `doneWhy`
ever sees it**, so PR #2855's claim went stale not because the predicate ignored draft state, but because the
data never reached the predicate at all. The real fix: `normalizeOpenPrs` widens its projected shape to include
`isDraft` (reading it off the SAME `gh pr list`/webhook payload its caller already has, once #2812/pr-events or
the daemon's own PR read carries it), and `doneWhy`'s check becomes `if (pr && !pr.isDraft) return ...` — the
claim survives the whole author-owned window without any SEPARATE hold/refresh mechanism, because a draft PR
simply never satisfies "delivers it" in the first place. **No wrapper-side refresh/hold is needed and none is
added**: the first pass proposed `we:scripts/operations/deliver-item-wrapper.mjs` must "refresh/hold this claim
for as long as it keeps pushing to its own draft, release only at real exit" — but the wrapper settles and exits
right after opening the PR (`we:scripts/operations/deliver-item-wrapper.mjs:560`), well before the draft is
promoted, so a design that depended on the ORIGINAL wrapper process staying alive across the whole draft window
was never buildable. Retirement instead rides the SAME self-clearing pattern
`we:scripts/operations/promote-draft-pr-dispatch.mjs`'s own header already documents for the review daemon
(`we:scripts/operations/promote-draft-pr-dispatch.mjs:13`: "the review daemon's OWN next tick reads
`pr.isDraft: false` off the SAME PR"): the moment promotion flips `isDraft` false, the very next build-dispatch
tick's `doneWhy` naturally retires the claim on its own — `we:scripts/operations/promote-draft-pr-dispatch.mjs`
needs no NEW coupling to the build claim at all.

**Signal source: push, not poll.** Any NEW code this card adds that needs to know "did this draft's CI just go
red" reads it from `we:scripts/lib/pr-events.mjs`'s webhook feed (the daemon-side client already built for
#2812) or from the builder's own `we:scripts/verify-lane.mjs` result — never a new `gh pr list` poll loop. This
does not touch `we:pr-events.mjs` itself; it is a consumption rule for whatever this card wires, not a new feature
of that module (hence its presence in `scope:` is for the WIRE-UP call site, not an edit to the module).

**The drain stays completely silent on a draft — no exception for a "helpful" skip note.**
`we:scripts/merge-ai-prs.mjs`'s skip DECISION for a draft (line 661) is already correct and unchanged; what
changes is that a draft PR is filtered out BEFORE the comment-writing step ever runs for it, so no
`drain-skip-reason` comment, no label, no `gh` write of any kind reaches a draft. `we:scripts/conveyor/parked-pr-conflict-watch.mjs`
gains an `isDraft` exclusion at the top of its detection loop (mirroring the review refusal's "checked first"
placement). `we:scripts/conveyor/review-status-tag.mjs` keeps its own `awaiting-ci` status for a draft (that IS
the author's-own-status the operator's exception names) but applies no OTHER label a ready PR would get.

## Interfaces

- `we:scripts/conveyor/reconcile-core.mjs` — new refusal reason `'draft'` (reusing the SAME string
  `dispatchReviewRow` already uses) added to FIVE branches: ci-heal, both conflict-fix branches, the
  advisory-fix branch (`:1750`), and the ordinary bounced-review fix branch (`:2078`) — each checked FIRST in
  its branch, each producing the same `{ role, reason: 'draft', why }` shape review's own refusal already
  emits — one shared helper, not five copies.
- `we:scripts/operations/ci-heal-pr-dispatch.mjs` — a new injectable `readDraftState` seam at `dispatchCiHeal`'s
  entry (mirroring its existing `readFixClaim` injection), re-reading `isDraft` FRESH at dispatch time; refuses
  before any repair attempt. Never trusts `planned.isDraft` alone (the planning-time value the reconcile-core
  refusal above already caught) — this is the real second, race-closing layer.
- `we:scripts/lib/pr-snapshot.mjs` — no change to `SNAPSHOT_FIELDS` (`isDraft` is already declared there); the
  two callers below simply start requesting it.
- `we:scripts/merge-ai-prs.mjs` / `we:scripts/conveyor/parked-pr-conflict-watch.mjs` — both add `isDraft` to
  their existing `gh pr list --json`/shared-snapshot field lists (`:4018` and `:1359` respectively).
- `we:scripts/conveyor/build-dispatch-policy.mjs#normalizeOpenPrs` — widens its projected PR shape to include
  `isDraft` (currently `{repo, number, headRefName, labels, files}`).
- `we:skills-src/conveyor/build-dispatch-daemon.mjs#doneWhy` — the retirement predicate (NOT
  `we:scripts/conveyor/build-dispatch-claim.mjs`, which holds no such logic) gains `&& !pr.isDraft` alongside
  "an open PR delivers the item"; unaffected: TTL expiry, "item left the cleared queue", and explicit release on
  dispatch failure. No change to `we:scripts/operations/deliver-item-wrapper.mjs` or
  `we:scripts/operations/promote-draft-pr-dispatch.mjs` — retirement rides the daemon's own next-tick re-read of
  live `isDraft`, the same self-clearing pattern `we:scripts/operations/promote-draft-pr-dispatch.mjs`'s own
  header already documents for the review daemon.
- `we:scripts/conveyor/review-status-tag.mjs` — `awaiting-ci` (the author's-own-status) is the ONLY state a
  draft PR may carry from this module; every other label path is gated on `!isDraft` same as today's review gate.

## Tasks

1. Add the shared `isDraft` refusal to `we:scripts/conveyor/reconcile-core.mjs`'s ci-heal, both conflict-fix,
   advisory-fix, and ordinary bounced-review-fix branches (five call sites); fixture-driven tests reconstructing
   PR #2855's shape (draft, red soak-replay-gate, real soak break present) prove NO `ci-heal`/`fix` dispatch is
   planned from any of the five.
2. Add `isDraft` to `we:scripts/merge-ai-prs.mjs`'s and `we:scripts/conveyor/parked-pr-conflict-watch.mjs`'s own
   `gh pr list --json`/snapshot field requests (both already support the field, per `we:scripts/lib/pr-snapshot.mjs`'s
   `SNAPSHOT_FIELDS`); wire the new `readDraftState` fresh-read seam into
   `we:scripts/operations/ci-heal-pr-dispatch.mjs#dispatchCiHeal`'s execution entry point.
3. Widen `we:scripts/conveyor/build-dispatch-policy.mjs#normalizeOpenPrs`'s projected shape to carry `isDraft`;
   fix `we:skills-src/conveyor/build-dispatch-daemon.mjs#doneWhy`'s retirement predicate; test that a claim for
   a draft PR survives past the point a ready-PR claim would already be retired, and IS retired on the tick
   after promotion flips `isDraft` false (no new coupling in `we:scripts/operations/promote-draft-pr-dispatch.mjs`
   needed — confirm with a test, not a behavior change there).
4. Exclude drafts from `we:scripts/merge-ai-prs.mjs`'s comment/label-writing step and from
   `we:scripts/conveyor/parked-pr-conflict-watch.mjs`'s detection loop; regression test against PR #2835's own
   reconstructed shape (draft, red `test` check, BLOCKED merge state) showing zero `gh` writes where today's
   behavior would post `drain-skip-reason`.
5. Confirm `we:scripts/conveyor/review-status-tag.mjs` never emits a non-`awaiting-ci` state for a draft — NOT
   already true as first written: `we:scripts/conveyor/review-status-tag.mjs:121,131,143,152` show live
   review/fix/ci-heal-match and draft-reason branches returning OTHER states before the final draft fallback;
   this task is a real behavior change (gate every one of those branches on `!isDraft` first), not merely a
   confirming test.
6. Wire the actual delegation call (builder drops the request marker instead of doing nothing when it wants to
   hand off a red-draft fix), once `we:backlog/4361-specialist-agent-roles-a-role-registry-with-narrow-briefs-ro.md`'s
   dispatcher (its Phase 2) exists to receive it — the last of these six tasks to land, SEQUENCED after `4361`
   rather than a card-level `blockedBy` (Tasks 1-5 need nothing from `4361` and land independently per Delivery
   shape below). `4361` (`4361`) now resolves to an existing, open card in this checkout — the first pass's
   "does not yet exist" note is stale and corrected here.

## Delivery shape

Lands incrementally, in the Task order above: each of 1-5 is independently useful and safe behind `main` (a
pure additional refusal/exclusion, never a removal of an existing correct decision). Task 6 is gated on
`4361` and may land as its own follow-up PR once that dependency ships, rather than holding this whole card
open.

## Independent plan review (Codex, read-only, 2026-09-28)

Confidence **High**, build-ready **No** — real design gaps found on this card's FIRST review pass (combined
with 4365/4366), resolved directly in Design/Interfaces/Tasks/`scope:` above rather than left open:

1. **[blocker, resolved above]** The claim-retirement change targeted the wrong module
   (`we:scripts/conveyor/build-dispatch-claim.mjs`, which holds only the acquire/release primitive) and lacked
   the data it needed. Corrected: the real predicate is `doneWhy` in
   `we:skills-src/conveyor/build-dispatch-daemon.mjs`, fed by `we:scripts/conveyor/build-dispatch-policy.mjs#normalizeOpenPrs`,
   which discards `isDraft` today — both are now named and in `scope:`.
2. **[blocker, resolved above]** The proposed draft guards lacked real draft data at `we:scripts/merge-ai-prs.mjs`,
   `we:scripts/conveyor/parked-pr-conflict-watch.mjs`, and `we:scripts/operations/ci-heal-pr-dispatch.mjs` — none
   of the three actually carries `isDraft` through to where a guard would read it. Corrected: `isDraft` added to
   both `gh`/snapshot field requests, and a new `readDraftState` fresh-read seam added to `dispatchCiHeal`.
3. **[blocker, resolved above]** The enumerated reconcile guards missed the advisory-fix and ordinary
   bounced-review-fix dispatch branches (`we:scripts/conveyor/reconcile-core.mjs:1750` and `:2078`), neither
   protected by the review refusal. Corrected: all five dispatch branches now get the same `'draft'` refusal.
4. **[major, resolved above]** The ownership lifecycle assumed `we:scripts/operations/deliver-item-wrapper.mjs`
   stays alive and refreshes the claim across the whole draft window, but it settles and exits right after
   opening the PR. Corrected: retirement needs no wrapper-side hold at all — it rides the daemon's own
   next-tick re-read of live `isDraft`, the same self-clearing pattern
   `we:scripts/operations/promote-draft-pr-dispatch.mjs` already uses for the review daemon.
5. **[major, resolved above]** The dependency note on Task 7 (now Task 6) was stale — `4361` (`4361`) exists
   in this checkout; Task 6 is now explicitly sequenced after it (a card-level `blockedBy` would incorrectly
   hold Tasks 1-5 too, which need nothing from `4361`).
6. **[minor, resolved above]** Task 6's (now Task 5's) "likely already true" claim about
   `we:scripts/conveyor/review-status-tag.mjs` was false — corrected to name it a real behavior change with the
   specific lines that return other states before the draft fallback.

This card is now presented for the ONE combined read-only Codex re-review this session runs across
4364/4365/4366 together — its first review and its re-review both fold into this same section, since this was
the first pass for this specific card.

## Independent plan review — re-review (Codex, read-only, 2026-09-28)

Confidence **High**, build-ready **No** — **1 blocker remains**, found against the fixes above:

1. **[blocker, OPEN]** The corrected retirement predicate (`doneWhy` gains `&& !pr.isDraft`) does not by itself
   preserve a claim through the WHOLE draft window: `we:scripts/conveyor/build-dispatch-claim.mjs`'s
   `DEFAULT_BUILD_DISPATCH_CLAIM_TTL_MINUTES` is 240 minutes (`:42`), and an EXPIRED claim disappears from
   `listBuildDispatchClaims`'s own output (`:100`) before `doneWhy` ever gets a chance to apply the corrected
   `!pr.isDraft` check — a draft that sits open past 240 minutes still loses its claim regardless of this
   card's fix. **Not resolved in this session** (the session's one re-review round is spent) — a real design
   choice is owed here (e.g. a longer TTL specifically for the draft-owned window, or an explicit
   refresh-on-tick for a still-draft claim nearing its TTL) before this is build-ready.

MINOR (also open): Task/Delivery-shape prose still reads as though `4361` is a hard `blockedBy` in one spot
(`:87`) while the corrected Task 6 (`:179`) says explicit sequencing, not a card-level edge — reconcile the
wording at the next touch.

**This card stays `status: open`, `preparedDate` withheld** — one real blocker remains after this session's one
permitted re-review round; a follow-up prep pass is owed before build.

## Done when

1. **Executable** — a fixture reconstructing PR #2855's shape (draft, red `we:.github/workflows/soak-replay-gate.yml`,
   a real soak break present) proves `we:reconcile-core.mjs` plans no `ci-heal`/`fix` dispatch; it fails today (the
   card's own Evidence is the live counter-example) and passes after.
2. A fixture reconstructing PR #2835's shape (draft, red `test`, BLOCKED merge state) proves zero `gh` writes
   from `we:merge-ai-prs.mjs`'s drain pass and zero label/comment from `we:parked-pr-conflict-watch.mjs` — both fail
   today.
3. A build-dispatch claim for a draft PR is still held one tick after the PR opens (where today's retirement
   predicate would already have released it) and is retired at the SAME tick `we:promote-draft-pr-dispatch.mjs`
   un-drafts it — proven by a fixture test, not by inspection.
4. Once `4361` lands, a builder's dropped request marker reaches a specialist session for a red-draft fix
   without ever touching `we:reconcile-core.mjs`'s `ci-heal`/`fix` dispatch paths.
