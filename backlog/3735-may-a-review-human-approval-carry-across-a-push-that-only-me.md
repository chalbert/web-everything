---
bornAs: xyttg9l
kind: decision
parent: "3054"
status: open
scope: ["we:scripts/review-set-label.mjs", "we:scripts/lib/review-escalation.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-20"
tags: [review, drain, review-escalation, acceptance, merge-commit, decision-prep]
relatedTo: ["2409", "2884", "3021", "3024", "3184", "3692"]
relatedReport: reports/2026-09-21-merge-only-approval-carry-grounding.md
---

# May a review:human approval carry across a push that only merges main into the reviewed branch?

A review:human clearance is revoked by any head move. On web-everything#2347 (2026-09-20) a conflict-fix worker's plain merge commit efa134d33 re-parked an operator-cleared PR and cost a second approval. The content-keyed carry-over already in we:scripts/lib/review-escalation.mjs (acceptanceCoversHead, reviewed-contribution) would NOT have saved it: the conflict resolution changed 8 of the PR's own +/- lines. Decides what, if anything, may carry an approval across a main-merge or conflict-resolution push, and what record and guardrails that needs across we:scripts/review-set-label.mjs and we:scripts/merge-ai-prs.mjs.

**Prepared 2026-09-21.** Four forks follow, each with a bold default. The short version: an approval
carries across a push only when the drain can **replay the merge itself** and get the pushed tree
byte-for-byte, with no conflict and without main touching the PR's own files. Anything else re-parks, as
today. Grounding: [report](/reports/2026-09-21-merge-only-approval-carry-grounding.md) · research topic
[/research/merge-only-approval-carry/](/research/merge-only-approval-carry/).

## Two incidents, two answers

| PR | Push after the approval | Replay `git merge-tree --write-tree <reviewed-sha> <main parent>` | What happened | What the default does |
| --- | --- | --- | --- | --- |
| [#2365](https://github.com/chalbert/web-everything/pull/2365) (2026-09-21) | `b889a718a`, "Merge branch 'main' into lane/3495-…" | **Clean.** Result tree `0490ef4a…` equals the head's tree. PR files and main's files are disjoint. | The drain re-parked it at 12:23:15 ("review:accepted is STALE"), took `ready-to-merge` away, and a second clearance at 12:24:27 released it. | Carries. No second approval. |
| [#2347](https://github.com/chalbert/web-everything/pull/2347) (2026-09-20) | `efa134d33`, "Merge origin/main into lane/multi-repo-checks" | **Conflicts** in 3 files (we:docs/agent/testing.md, we:skills-src/conveyor/runner.mjs, we:skills-src/conveyor/__tests__/runner.test.mjs). | Re-parked; operator re-cleared ("I approve 2347"). | Does not carry. Re-parks, as today, with the resolution delta shown (settled by precedent). |

**A correction to the brief this was prepared from.** #2365 did *not* keep its approval across the merge.
Its `review:accepted` *label* stayed on, because the drain never removes that label
(we:scripts/merge-ai-prs.mjs:4291-4314). But the drain parked it `review:pending`, stripped
`ready-to-merge`, and it needed a fresh clearance. That clearance was stamped "Independence NOT
established" (#2844). So #2365 is a second live case of the cost, not a case of the carry working.

**Why today's content-keyed escape did not save #2365.** Its first acceptance came through the declared
`review-pr` operation and carried only `reviewed-sha` and `cleared-by-actor`. It had no `reviewed-diff`
and no `reviewed-contribution` marker. we:scripts/review-set-label.mjs:835-868 computes those from the net
diff and deliberately stamps nothing when that read fails ("FAIL-SOFT, DELIBERATELY"). With no fingerprint,
`acceptanceCoversHead` (we:scripts/lib/review-escalation.mjs:1590-1663) can only compare SHAs, and the SHA
moved. Why the read failed on that run was not established.

## What is true today — facts, not forks

Main read at `9002a5f1e`.

- **One gate decides staleness.** `acceptanceCoversHead` (we:scripts/lib/review-escalation.mjs:1590) has one
  caller, `decideReviewGate` (`:2275`), which the drain calls (we:scripts/merge-ai-prs.mjs:4197). Its routes, in
  order: a missing SHA covers (fails open, `:1596`); a SHA prefix match covers; an equal `reviewed-diff`
  covers; an equal `reviewed-contribution` covers; a failed live read is "not covered, not proven stale";
  anything else is "stale".
- **It knows nothing about merges or trees.** No code in `scripts/` compares trees, patch ids or range-diffs
  for review coverage. `git merge-tree --write-tree` is already used, but only to rebuild or probe
  (we:scripts/lib/rebase-drop-manifest.mjs, we:scripts/prune-landed-lanes.mjs:126).
- **The drain's own "rebase" is a merge of main.** `rebaseDropManifest` builds a two-parent commit with
  `commit-tree <tree> -p <base> -p <mergeRef>` and pushes it fast-forward
  (we:scripts/lib/rebase-drop-manifest.mjs:190-195). Then `needsAcceptanceRestamp` re-stamps the acceptance
  (we:scripts/merge-ai-prs.mjs:752-754). Its whole condition is
  `rebase?.action === 'rebased' && !!v.humanCleared && !v.reviewHeld`. Neither it nor
  `decideSetLabel('restamp')` (we:scripts/review-set-label.mjs:272-302) compares anything against the
  previous acceptance. A docstring says the re-stamp "is granted only after the `reviewed-diff`/
  `reviewed-contribution` markers show the CONTRIBUTION is unchanged" (we:scripts/merge-ai-prs.mjs:2196-2199);
  the code does not do that check. The drain's content fallback, `rebaseDropContent`, auto-resolves
  non-overlapping content conflicts and is re-stamped the same way (`:3763-3793`). Both put **main as the first
  parent** and the lane tip as the second (we:scripts/lib/rebase-drop-content.mjs:368). The id-collision heal
  `healNnnCollision` also moves the head (a single-parent commit, we:scripts/nnn-collision-heal.mjs:303) and
  never re-stamps.
- **`review:human` has no approval of its own.** `--to=clear-human` turns it into `review:accepted`
  (we:scripts/review-set-label.mjs:213-231) and stamps `cleared-human` beside `reviewed-sha`. After that,
  both kinds of approval go through the same coverage test. Three places still treat them differently:
  - a stale park re-applies `review:human` when the tier or label says so (`toHuman`,
    we:scripts/lib/review-escalation.mjs:2293), and posts a revocation notice
    (we:scripts/merge-ai-prs.mjs:4260-4273);
  - the anti-test-tampering gate matches on SHA only and needs `cleared-human` in the same comment as
    `reviewed-sha` (`shouldReparkForTestTampering`, we:scripts/lib/review-escalation.mjs:1534;
    `parseLatestHumanClearedSha`, `:1480-1501`);
  - a restamp comment does not re-emit `cleared-human` (we:scripts/review-set-label.mjs:1140-1147).
- **An acceptance records no coverage tier.** The markers are sha, diff, contribution, `cleared-human`,
  `cleared-by-actor`. The tier (statute, gate-self) is re-derived fresh on every pass.
- **The net-diff basis** is `merge-base(origin/main, head)` → head, a two-tree diff (`computeNetDiffText`,
  we:scripts/merge-ai-prs.mjs:2701-2729; `computeNetDiffPaths`, `:2807-2820`; #2450). After main is merged in,
  that base is the main tip, so the net diff is the PR's own change against current main.
- **Author-side merge commits are recognised only by message.** `isMechanicalMergeCommit`
  (we:scripts/merge-ai-prs.mjs:331-335) accepts an empty-body `Merge branch …` commit as non-authored. It
  never checks content. `gh pr update-branch` is not called anywhere.
- **Statute.** No anchor in we:docs/agent/platform-decisions.md codifies #2409's SHA binding, the restamp or
  the fingerprint escape; those rules live in code comments and resolved cards. Same-turf anchors:
  [#parked-pr-conflict-dispatched-not-scripted](../docs/agent/platform-decisions.md#parked-pr-conflict-dispatched-not-scripted)
  (a real conflict on a parked PR is bounced `review:changes` and fixed by an agent; statute or leash hunks go
  to a human),
  [#clear-human-requires-current-head-advisory-review](../docs/agent/platform-decisions.md#clear-human-requires-current-head-advisory-review)
  (ruled, unbuilt, #3692),
  [#review-human-declarative-leash-only](../docs/agent/platform-decisions.md#review-human-declarative-leash-only).

## Prior art, in one paragraph

Every system that keeps an approval across an update proves the change is the same; none trusts "it was
only a merge". **Gerrit** copies a vote on `changekind:TRIVIAL_REBASE` / `MERGE_FIRST_PARENT_UPDATE` only
when a fresh in-memory three-way merge succeeds *and* its tree equals the new patch set's tree
(`ChangeKindCacheImpl`); a conflict is `REWORK`. Chromium's Code-Review label uses exactly that.
**GitLab** compares `git patch-id` of the MR diff before and after, "when you perform commands like
`git rebase` or `git merge <target>`". **GitHub** dismisses a stale approval when the recorded diff changes,
"because a contributor … clicks **Update branch**", and since 2023 "whenever a merge base changes". Only
**Phabricator**'s sticky accept carries with no check. Everyone treats a hand-resolved conflict as new code.
`git patch-id` ignores whitespace and line numbers; `git range-diff` "is not intended to be
machine-readable". URLs and quotes in the research topic.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — what proves an outside push only merged main | **Replay each merge with `git merge-tree --write-tree` and require a clean result whose tree equals the pushed tree** | Keep the text digests as the only proof | High |
| Fork 2 — a clean merge where main changed the PR's own files | **Does not carry; re-park** | Carry any clean replay | Med |
| Fork 3 — the drain's own content-resolving merges | **Obey Fork 2 too: they re-park instead of re-stamping** | Keep re-stamping them | Med |
| Fork 4 — `review:human` vs `review:accepted` | **Same rule for both** | Never carry a human clearance | Med |

## Supported by default — not forks

Each has one coherent branch or is settled by precedent.

- **Fail closed when the proof cannot run.** Fail-open is the broken branch: it would honour a tree nobody
  checked. A failed git read, a reviewed commit that cannot be resolved, or any error means **no carry**. The
  gate then behaves as it does today. This relies on #3184's existing behaviour
  (we:scripts/lib/review-escalation.mjs:2338-2363), which is a fact, not part of this ruling: when a park would
  revoke an operator clearance on a failed read, the drain neither revokes nor merges and retries next pass.
  "Drop the label and re-review" on a read failure was considered and is not a coherent rival: it destroys an
  operator clearance over a network error and contradicts the drain's "a re-score never removes
  `review:accepted`" (we:scripts/merge-ai-prs.mjs:4291-4314).
- **Close the re-stamp gap (a bug fix, under any ruling).** The drain re-stamps only when the lane tip it
  merged in (the `mergeRef` it read before rebuilding) is itself covered by the current acceptance — the same
  SHA or digest test `acceptanceCoversHead` applies. Today nothing checks this: `isRebaseDropCandidate`
  gates on `aiGenerated`/`certifyLabel` (we:scripts/merge-ai-prs.mjs:653-660), `rebaseDropManifest` fetches
  the current lane tip (we:scripts/lib/rebase-drop-manifest.mjs:128-133), and the re-stamp then blesses
  whatever it merged. So an author push made after the accept can be merged in and re-stamped before the
  staleness gate sees it (rebase loop `:3722` runs before the escalation loop `:3905`). No test covers it.
  The drain knows its own recipe, so it checks its *input*, not a replay of its output.
- **Who verifies and where it is recorded (settled by precedent).** The drain decides, inside the one
  staleness authority `decideReviewGate` (#2409), and records through the existing re-stamp path
  `we:scripts/review-set-label.mjs --to=restamp` (#x5e2ldj). The pusher never certifies its own push. The carry
  writes its own durable comment with its own heading, so it never reads as a fresh review. Because a carry
  always runs over a live acceptance, `writeOrder` (we:scripts/lib/review-label-provider.mjs:165-167) is
  swap-first there; the "swap" adds nothing (the label is already on), so the comment is the whole record.
- **The carry never creates an acceptance.** `restamp`'s refusals stay: no `review:accepted`, `review:human`
  still present, or `review:changes` → refuse (we:scripts/review-set-label.mjs:272-302). Actor independence is
  not waived; the carry is stamped `--actor=drain`, names the original clearer, and is not a clearance.
- **After a conflicted merge: full re-clearance (settled by precedent).**
  [#parked-pr-conflict-dispatched-not-scripted](../docs/agent/platform-decisions.md#parked-pr-conflict-dispatched-not-scripted)
  governs this: a real conflict on a parked PR goes through a `review:changes` bounce, and `restamp` refuses
  over `review:changes`. A delta-only approval (the card's option 4) would contradict that anchor, and carrying
  a mechanical fixer's push (option 3) approves content nobody reviewed. **Add-on, not a fork:** the re-park
  comment shows the conflicted files and the `+/-` lines that changed (8 on #2347), so the reviewer can start
  there. Scoring that delta overlaps #3024 and stays there.
- **The tier is re-derived every pass.** A carry answers only "is this the reviewed tree". The statute and
  gate-self tiers are scored on the live net diff, as today; the carry never skips that.
- **Required checks still run on the new head.** A clean textual merge can still break behaviour; the
  required `test` check re-runs on the merged head, as after every drain rebase.
- **The digest tiers stay.** `reviewed-diff` / `reviewed-contribution` and their residuals (#3021, #2884)
  belong to parent #3054. Fork 1 adds a route beside them.
- **This does not bless outside merges of queued PRs.** "Do not rebase a queued PR from outside the drain"
  (#3350, a code-comment rule at we:scripts/merge-ai-prs.mjs:3711-3714) stands. This ruling decides only what an
  approval survives when such a push happens anyway.
- **Forged markers.** The carry rides an ordinary PR comment, the single-tenant trust model #2409 accepted.
  Not re-opened here.

## Fork 1 — What proves an outside push only merged main?

**Fork-existence.** A real either/or, with one broken branch. (c) is **broken**: a commit message proves
nothing (`efa134d33` was titled "Merge origin/main …" and changed 8 of the PR's lines). Between (a) and (b)
the call is whether a merge-only push gets a replay route at all; with (b) it does not.

Scope: pushes the drain did not make. The drain's own merges are covered by the re-stamp rule above and
Fork 3; they always put main as the *first* parent (`commit-tree -p <base> -p <mergeRef>`,
we:scripts/lib/rebase-drop-manifest.mjs:190, we:scripts/lib/rebase-drop-content.mjs:368) and drop the
manifest, so a plain replay would never match them.

- **(a) Replay the merges — recommended.** Resolve `reviewed-sha` to a full SHA. Walk from the live head back
  to it. Every commit on the way must be a merge with exactly two parents where one parent is (or descends
  from) the reviewed SHA — the PR side, found by ancestry, not by position — and the other is an ancestor of
  `origin/main`. For each such merge, `git merge-tree --write-tree <parent 1> <parent 2>` must exit 0 and
  print a tree **equal** to the merge's own tree. Then Fork 2's file test.
  - **Stated outcomes:** a non-merge commit anywhere on the path (the author added a commit and then merged
    main) → no carry. A true rebase (rewritten history) is out of scope here; it stays with the digest tiers
    under #3054, where Gerrit's `TRIVIAL_REBASE` would be the model if it is ever taken up.
  - It is Gerrit's mechanism for `TRIVIAL_REBASE` / `MERGE_FIRST_PARENT_UPDATE`: re-merge, compare trees.
  - It needs no marker from the accept, only the `reviewed-sha` every acceptance has. That is what #2365
    lacked.
  - It fails safe. `merge-tree` uses the same merge as `git merge`, with all merge bases. An author's custom
    merge driver, rerere or `-X` option can only cause a missed carry, never a wrong one. A hand edit hidden in
    a merge commit changes the tree and fails.
  - **Against it:** some legitimate merges miss (custom options, criss-cross oddities) and re-park as today.
- **(b) Keep the text digests as the only proof (today).** Rejected on merit: a digest cannot tell a base move
  from a relocation (#3021's pinned residual, we:scripts/lib/review-escalation.mjs:1260-1280), and it exists
  only when the accept could stamp it — #2365's could not, so its provably identical tree re-parked.
- **(c) Trust the commit's shape, message or pusher** (`isMechanicalMergeCommit`). Rejected as broken: #2347.
- **(d) `git patch-id` of the net diff (GitLab).** Rejected: it ignores whitespace and line numbers, weaker than
  a tree comparison, with the same relocation blindness as (b).

**Default: (a).**

**Code shape** — Fork 1 (a), a pure decision over facts an I/O probe collects:

```js
// we:scripts/lib/review-escalation.mjs — pure; the probe sits beside computeNetDiffText in merge-ai-prs.mjs
export function mergeOnlyCarry({ reviewedSha, reviewedPaths, chain, readFailed }) {
  // chain: head → reviewedSha. Each: { sha, parents, prParent, mainParentIsMainAncestor,
  //                                    replayClean, replayTree, tree, mainSidePaths }
  if (readFailed || !reviewedSha || !chain?.length) return { carries: false, reason: 'unproven' };
  for (const c of chain) {
    if (c.parents.length !== 2 || !c.prParent || !c.mainParentIsMainAncestor)
      return { carries: false, reason: `${c.sha} is not a merge of main into the reviewed branch` };
    if (!c.replayClean) return { carries: false, reason: `${c.sha}: the merge had conflicts` };
    if (c.replayTree !== c.tree) return { carries: false, reason: `${c.sha}: tree differs from git's own merge` };
    if (c.mainSidePaths.some((p) => reviewedPaths.has(p)))              // Fork 2
      return { carries: false, reason: `${c.sha}: main changed this PR's files` };
  }
  if (chain.at(-1).prParent !== reviewedSha) return { carries: false, reason: 'path does not reach reviewed-sha' };
  return { carries: true, from: reviewedSha, to: chain[0].sha, tree: chain[0].tree };
}
// probe: git merge-tree --write-tree <p1> <p2>        exit 0 = clean; first line = tree
//        git rev-parse <sha>^{tree}
//        git diff --name-only <prParent> <sha>         = mainSidePaths (no merge-base needed)
```

Replayed: #2365 → carries (clean, `0490ef4a…` both sides, no shared files); #2347 → no carry (conflicts in 3
files).

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. The skeptic confirmed soundness (a clean, tree-equal replay
can only miss, never wrongly carry) but found the first draft keyed the walk on parent *position*, which
rejects every drain merge (main is their first parent) and any PR-side-second merge. The PR side is now found
by ancestry, the fork is scoped to outside pushes, and the reviewed SHA is resolved to full length (the gate
accepts prefixes). Mixed chains and true rebases are now stated outcomes, not code-only.

**Screen:** clear. It also asked for the "forced invariant" label to go (done: (b) and (d) are coherent,
weaker rivals) and for the rebase scope to be stated (done).

## Fork 2 — A clean merge where main changed the PR's own files

**Fork-existence.** A real either/or. When main edits a file the PR also edits, in hunks that do not overlap,
git merges cleanly and Fork 1's replay matches. That merge either carries or it does not.

- **(a) Does not carry — recommended.** Carry only when the files main's side brought in
  (`git diff --name-only <PR-side parent> <merge>`, which needs no merge base) share nothing with the files
  the reviewed PR changed. Otherwise re-park as today.
  - The reviewer judged the PR's lines against the file as it was. A clean merge in the same file is where a
    semantic clash hides: main changes a signature the PR's hunk calls, a few lines away.
  - It matches GitLab's code-owner rule (drop the approval when a later change touches the owner's files) and
    the brief's constraint that a merge touching the PR's files must not carry.
  - It still carries the common case: #2365's five files and main's twelve were disjoint.
  - **Against it, stated plainly:** a PR on a busy file re-parks on every unrelated main edit to that file. A
    statute PR edits we:docs/agent/platform-decisions.md, which main touches almost daily, so **most
    `review:human` statute PRs will not carry** under (a). That removes much of Fork 4's practical benefit
    for the human tier.
- **(b) Carry any clean replay.** Rejected on merit: it certifies a file state the reviewer never saw on the
  strength of "git found no textual overlap". The `test` check narrows that gap, but docs and statute text
  have no tests.
- **(c) Carry when the edits in a shared file are far apart** (a hunk-distance test). Rejected on merit:
  distance in lines is not a semantic boundary. A renamed function at the top of a file breaks a call at the
  bottom, and any threshold is arbitrary.

**Default: (a).**

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. "Main's side" was first computed from a merge base, which is
ambiguous on a criss-cross history; it is now the diff from the PR-side parent to the merge. The cost to
statute PRs was understated and is now stated. The skeptic noted the fork sits close to a strictness setting;
it stays a fork because (b) certifies an unseen file state, which is a correctness difference, not a value
of one knob.

**Screen:** clear. The missing middle option (hunk distance) was added and rejected on merit.

## Fork 3 — Do the drain's own content-resolving merges obey Fork 2?

**Fork-existence.** A real either/or. `rebaseDropContent` (we:scripts/merge-ai-prs.mjs:3763-3793) is the
drain's fallback when the manifest is not the only conflict; it auto-resolves non-overlapping hunks and is
re-stamped today. A conflict means both sides touched the file, so every such merge touches a PR file. Either
the drain's merges follow Fork 2 or they are exempt; one event cannot have both rules.

- **(a) They obey Fork 2 — recommended.** A `rebaseDropContent` merge on an accepted PR re-parks instead of
  re-stamping. `rebaseDropManifest` merges (manifest only, no PR file touched) still re-stamp, under the
  re-stamp gap fix above.
  - One rule for one event. An author's merge of main and the drain's merge of main are judged the same way.
  - **Against it:** **every** content-resolving drain merge of an accepted PR will re-park, not some. How
    often that happens was not measured.
- **(b) Exempt the drain's own merges; keep re-stamping them.** Rejected on merit: the drain's auto-resolution
  certifies exactly the same unseen file state Fork 2 (a) refuses to certify for an author, and the drain is
  the actor that moves heads most often.

**Default: (a).**

**Skeptic:** REFUTED on mechanism, principle SURVIVES → rewritten. The first draft said the drain's manifest
merges "pass the replay trivially"; they do not (main is their first parent, the manifest conflict makes the
replay exit non-zero, and the collision heal changes the tree). The drain now checks its *input* (the lane tip
it merged) instead of replaying its output, and that check became a bug fix under *Supported by default*. The
cost is now stated as "every content merge", not "some".

**Screen:** clear. It also asked that the re-stamp bug fix be split out as a default that holds under either
branch (done).

## Fork 4 — Does the rule differ for `review:human` and `review:accepted`?

**Fork-existence.** A real either/or: a human clearance either carries under the same proof or never does.

- **(a) Same rule for both — recommended.** A replay-proven merge that did not touch the PR's files leaves the
  PR exactly as the operator approved it. Asking again asks them to approve nothing new; #2365's second
  clearance took 69 seconds and was recorded without independence, which is the rubber-stamp shape.
  - Everything that could change the human's judgment re-parks anyway: a conflict (settled above), main
    touching the PR's files (Fork 2), a new tier path (re-derived every pass).
  - **Build note (not the policy):** the carry must not copy the `cleared-human` marker. That marker is by
    design written only by `--to=clear-human` (we:scripts/lib/review-escalation.mjs:1473-1475), and the
    anti-test-tampering gate's own docblock says not to extend that comment primitive further (`:1520-1530`).
    The carry writes a distinct `carried-human-from: <sha>` marker instead, and the anti-test-tampering gate
    learns to accept a carry whose origin is a real `clear-human` comment. The durable non-comment ledger that
    docblock asks for is the better home once it exists.
  - **Statute composition.**
    [#clear-human-requires-current-head-advisory-review](../docs/agent/platform-decisions.md#clear-human-requires-current-head-advisory-review)
    is a precondition on the `clear-human` act; a carry is not that act and never stamps a clearance-shaped
    marker, so the anchor's text does not reach it. Its intent (an independent look at what lands) is served
    because nothing lands that differs from the cleared PR except files the PR does not touch.
    [#review-pending-clean-verdict-mechanical-accept](../docs/agent/platform-decisions.md#review-pending-clean-verdict-mechanical-accept)
    keeps `review:human` human-only; the carry does not clear `review:human` — it keeps an existing human
    clearance attached to a proven-identical PR.
- **(b) Never carry a human clearance.** Rejected on merit: the human tier's protection is that a human saw
  this content, and the proof shows the content is the same. Note Fork 2's cost: in practice many human-tier
  PRs will re-park anyway, so (a) versus (b) matters mostly for human-tier PRs outside the busiest files.

**Default: (a).**

**Skeptic:** REFUTED as first drafted, SURVIVES-WITH-AMENDMENT → applied. The draft re-emitted
`cleared-human`, which contradicts the marker's written design and the anti-test-tampering gate's "do not
extend" note, and blurs two anchors. It now uses a distinct marker and states how it composes with both.

**Screen:** clear, with a minor impl leak (the marker is how (a) is built, not the policy) → the marker moved
to a build note and the option is titled "Same rule for both".

## Context

**How the card's original options map.** Option 1 (status quo) is Fork 1 (b): #2365 shows it re-parks a
provably identical tree. Option 2 (content-keyed carry, made visible) becomes Fork 1 (a) plus the settled
record rule, with a replay instead of a digest as the proof. Options 3 (carry any fixer push) and 4
(delta-scoped re-approval) are rejected under *After a conflicted merge* in *Supported by default*.

**Scope.** The frontmatter `scope:` was set at filing. The build this rules would touch
we:scripts/lib/review-escalation.mjs (the pure `mergeOnlyCarry`), we:scripts/merge-ai-prs.mjs (the probe, the
gate call, `needsAcceptanceRestamp`), we:scripts/review-set-label.mjs (the carry record), and their tests.

**Predicted touch-set of the build** (#2619): we:scripts/lib/review-escalation.mjs,
we:scripts/merge-ai-prs.mjs, we:scripts/review-set-label.mjs, we:scripts/__tests__/, we:scripts/lib/__tests__/,
and the codifying anchor in we:docs/agent/platform-decisions.md. Care is estimated `high`: the staleness gate
is gate-self code.

### Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
| claim-accuracy#2 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## Definition of done for the RESULT of the decision

These are build criteria for the eventual ruling; they do not assert that a ruling has happened.

- Replay #2365 (`0ed03ddce` → `b889a718a`): carries, with a durable carry comment.
- Replay #2347 (`ed4103e9e` → `efa134d33`): does not carry; re-parks with the resolution delta shown.
- A clean merge where main changed a PR file: re-parks (Fork 2).
- A merge with main as the first parent and the PR as the second: judged by ancestry, same outcome.
- An author commit followed by a merge of main: re-parks (Fork 1).
- A drain re-stamp whose merged lane tip is not covered by the acceptance: re-parks, never re-stamps.
- A drain `rebaseDropContent` merge on an accepted PR: re-parks (Fork 3).
- A merge commit with a hand edit (tree ≠ git's merge): re-parks.
- A carried human clearance survives the anti-test-tampering gate via `carried-human-from`, and no carry
  comment contains `cleared-human` (Fork 4).
- A read failure: no carry, no revocation, retried next pass.
- Missing acceptance, a review hold, or `review:changes`: the carry refuses.

## Done when

1. **Executable** — a vitest run of the proposed test file `we:scripts/__tests__/review-human-carry-over.test.mjs` (proposed, does not exist yet) fails before the ruling's build lands and passes after. It holds the cases in the definition of done above.
2. The ruling is recorded on this card, and codified as a platform-decisions anchor (none today covers review binding to a commit). The review-ceremony guidance in `we:docs/agent/delivery-loop.md` is updated only if the ruling changes behaviour.
