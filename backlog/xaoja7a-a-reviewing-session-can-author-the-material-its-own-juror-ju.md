---
kind: story
size: 5
status: open
dateOpened: "2026-08-24"
tags: []
---

# A reviewing session can author the material its own juror judges

we:scripts/operations/stage-pr-view.mjs takes the PR body, comments and file list from a session-supplied file, because this host has no mechanical read path — gh REST answers 403 GitHub access is not enabled and GraphQL serves only the pinned review set. So the session transcribes the PR into the view, and NOTHING verifies that transcription against the real PR. Observed live on PR #1542: the staged view carried a paraphrased body plus a comment authored by the reviewing session and stamped authorAssociation OWNER that does not exist on the PR at all. The real PR had one comment, the drain park notice. A juror weights OWNER differently by design, so this is not merely framing — it is putting words in the operator mouth inside the evidence the juror reads. review-pr itself is mechanical and deriveVerdict is rule-based; the hole is entirely upstream, in what gets staged.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

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

- **a — verify the transcription.** `stage-pr-view` records a digest over `body + comments + headRefOid`; the applier side, which holds a real token, recomputes it against the live PR and refuses a verdict whose staged view does not match. Catches paraphrase and fabrication alike, and needs no new read path on the judging host.
- **b — stage from CI.** The view is produced by a workflow with a token and pushed to the transport branch; the session may read it but never author it. Strongest, and the largest change.
- **c — bound what the session may supply.** Accept `files` and `headRefOid` from the session (mechanically derivable from git, and checkable), but require `body`/`comments` to be absent or digest-verified. A juror reading no body is honest; a juror reading an invented one is not.

**Recommended: (a)**, then (b) if the transport moves to CI anyway. (c) is a cheap partial and composes with either.

## Done when

1. **Executable** — a test stages a view whose `body` differs from the live PR's and asserts the verdict is REFUSED, naming the mismatch. It must RED today, where any string is accepted.
2. **Executable** — a test stages a view carrying a comment absent from the live PR and asserts the same refusal. Fabrication and paraphrase are the same defect and must both be covered.
3. **Non-vacuous** — reverting the check must redden both named tests.
