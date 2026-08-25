---
bornAs: xaoja7a
kind: story
size: 5
status: open
dateOpened: "2026-08-24"
tags: []
---

# A reviewing session can author the material its own juror judges

we:scripts/operations/stage-pr-view.mjs takes the PR body, comments and file list from a session-supplied file, because this host has no mechanical read path — gh REST answers 403 GitHub access is not enabled and GraphQL serves only the pinned review set. So the session transcribes the PR into the view, and NOTHING verifies that transcription against the real PR. Observed live on PR #1542: the staged view carried a paraphrased body plus a comment authored by the reviewing session and stamped authorAssociation OWNER that does not exist on the PR at all. The real PR had one comment, the drain park notice. A juror weights OWNER differently by design, so this is not merely framing — it is putting words in the operator mouth inside the evidence the juror reads. review-pr itself is mechanical and deriveVerdict is rule-based; the hole is entirely upstream, in what gets staged.

## How it was found

The operator asked, plainly: *"I thought the point of having operations was to avoid the session being biased — I thought it would run mechanically without framing from the main session."*

That is exactly the intent, and the judging half honours it. `review-pr` fans out to juror seats with their own session ids, and `deriveVerdict` reduces findings by rule — on PR #1542 it returned `needs-human` on a `gate-self: review:human` label even with **zero** findings, refusing to let a clean juror result clear a statute gate. None of that is reachable by the calling session.

The **input** half does not honour it.

## What actually happened on PR #1542

| | staged view | the real PR |
| --- | --- | --- |
| body | a paraphrase in the session's voice, with conclusions pre-loaded (*"DELIBERATELY NOT REWIRED: … because …"*, *"A briefing premise was WRONG and corrected"*) | the authored PR description |
| comments | **1, authored by the reviewing session**, stamped `chalbert` / `authorAssociation: OWNER`, reading *"This advisory review is to give the operator findings to decide on, not to clear the label."* | 1 — the drain's park notice, nothing else |

The fabricated comment is the sharp end. `authorAssociation` exists so a juror can weight an owner's word above a drive-by comment; synthesizing one inverts that. The same session also injected an `OWNER`-stamped "ROUND 1 … now fixed at head 5a1fd192 … both mutations killed" comment into PR #1533's view — telling the juror the prior finding was resolved, in the operator's voice.

Re-running #1542 with a verbatim body and only the one real comment produced the **same** verdict from a different juror seat. So no verdict is known to be wrong. That is luck: nothing in the pipeline would have caught it if it had mattered.

## Why it is not simply "don't do that"

There is no mechanical read path on this host, verified:

```
$ gh api repos/chalbert/web-everything/pulls/1542
{"message":"GitHub access is not enabled for this session…"}   HTTP 403
$ gh pr view 1542 --repo chalbert/web-everything --json title
HTTP 403: This GraphQL query is not enabled for this session — only the pinned set of PR-review operations is served.
```

Every review run from a cloud session therefore routes the PR's own text through the session. Discipline is not a control here for the same reason `#3066`'s deny-list was not: it can only enumerate, and the failure is silent when it happens.

## Options

- **a — verify the transcription.** `stage-pr-view` records a digest over `body + comments + headRefOid`; a credentialed side recomputes it against the live PR and refuses a mismatch. Detects the defect *after* the session has already authored the material.
- **b — stage from CI, over the transport that already exists.** The session pushes a *request* (`{repo, pr}`) to an ops branch; a workflow holding a token runs `gh pr view --json` and commits the view back; the session reads it out of the fetched ref. The session never authors the material at all.
- **c — bound what the session may supply.** Accept `files`/`headRefOid` (mechanically derivable from git, and checkable), require `body`/`comments` absent or verified. A juror reading no body is honest; one reading an invented body is not.

**Recommended: (b).** This was first costed as "the largest change", which was wrong — the operator pointed out the mechanism is already built. `we:.github/workflows/apply-review-request.yml` is exactly this shape in the write direction: a credential-less session pushes a file to `ops/review-requests`, and a workflow with a token acts on it. It is proven — plateau-app's own copy applied a verdict on its first live run today (#3261). Extending the same pattern to the READ direction is a sibling workflow, not a new architecture.

### What (b) actually costs — the one real objection

The applier is deliberately `contents: read`:

```yaml
permissions:
  pull-requests: write   # the label swap
  issues: write          # a PR's comments are issue comments
  contents: read         # never pushes — see the "only what this push added" note above
```

A read-flow must **commit the view back**, so it needs `contents: write`. That is a genuine privilege increase and must not be waved through. Two things bound it:

- **A separate workflow on a separate branch** (`ops/pr-views`), so the label applier keeps `contents: read` untouched. The two flows share a pattern, not a token.
- **The write is strictly weaker than what the existing boundary already grants.** The applier's own header states that anyone who can push to `ops/review-requests` can move a review label, including clearing `review:human`. Committing PR *metadata* to a branch nothing else watches is less powerful than that, not more.

### The subtlety that makes or breaks (b)

CI producing the view is not sufficient on its own. If `stage-pr-view` still reads `--from=<local path>`, the session can fetch the CI-produced view and edit it before staging — the same hole, one step further back.

So the view must be read **out of the fetched ref**, not off the filesystem: `git show origin/ops/pr-views:views/<repo>-<pr>.json`, with no session-writable path in between. That is what turns "CI produced it" into "the session could not have authored it".

(a) remains worth having as defence in depth — it is the check that survives if someone later re-introduces a local path.

## Done when

### These clauses were written for option (a) and are NOT what (b) delivers — stated rather than quietly dropped

The clauses first written here were *"a test stages a view whose `body` differs from the live PR's and asserts the verdict is REFUSED"* and the same for a fabricated comment. Both describe **(a) — verify the transcription**: they presuppose that the session still authors the material and that something later compares it against the real PR. Under **(b)**, ruled, there is nothing to compare: the session never supplies a body or a comment at all, so a test that stages a "wrong body" would have to fabricate the very path the fix removes. Writing one anyway would be a test of a code path that no longer exists — worse than no test, because it reads as coverage.

What replaces them is the same property one step earlier: the session **cannot** be the author.

1. **Executable** — `chooseViewSource` refuses when neither `--fromTransport` nor `--from=` is given, and refuses when both are. Neither is a default, so the weaker path is never reachable by omission. (`we:scripts/operations/__tests__/stage-pr-view.test.mjs` → *"exactly one view source, chosen in writing"*.)
2. **Executable** — `checkViewProvenance` REFUSES a hand-supplied view on any repo whose `ops/pr-views` branch exists on origin. This is the clause that carries the item: without it, a session fetches the CI-produced view, edits it, and stages the edit through `--from=` — the same fabrication, one step back. (*"a hand-supplied view is REFUSED wherever CI can serve — the structural half"*.)
3. **Executable** — the transport read is `git show origin/ops/pr-views:<path>` with no filesystem seam anywhere on the path, asserted by driving the reader with a booby-trapped `read` and proving it is never called. A future "fetch it into `/tmp` and read it back" breaks that test.
4. **Executable** — `checkViewFreshness` refuses a view whose `headRefOid` is not the head `origin/<headRefName>` now points at, and refuses (rather than skipping) when that head cannot be resolved at all.
5. **Non-vacuous** — each of the above was mutation-tested: reverting the refusal reddens the named test.

(a) remains worth having as defence in depth, and is NOT delivered here. What is delivered towards it is the `_stagedFrom` provenance stamp written into every staged view — the artefact now records whether its bytes came out of CI or off a session's disk, which is what a later digest check would compare against.
