---
bornAs: xyl3dc9
kind: story
size: 3
status: open
parent: "x5p1xz8"
relatedTo: ["2409", "2198"]
scope: ["we:scripts/lib/review-escalation.mjs"]
dateOpened: "2026-08-02"
tags: [gate, review, drain]
---

# Acceptance coverage keys on head-SHA identity so a no-op rebase invalidates a valid review

`acceptanceCoversHead` compares sha identity, which the #2409 docblock takes deliberately — but with the drain rebasing a manifest-carrying lane on every main advance, "self-corrects on a fresh accept" becomes a livelock.

## This is a ratified tradeoff, not an oversight

State it plainly, because the fix must not be written as though someone got it wrong. `we:scripts/lib/review-escalation.mjs` says so directly: the gate keys on head-SHA identity, so **any** head change re-parks, "including a benign rebase-onto-main / force-push of an already-accepted branch that adds no review-worthy content… That is stricter than the motivating case, but defensible: a rebase DOES change the tree, and the re-park self-corrects on a fresh accept. We prefer the false-park over honouring an accept against a tree the reviewer never saw."

What this item carries is **new evidence against the "self-corrects" clause**, not a claim that the strictness is wrong.

## The evidence — PR #983, 2026-08-02

The drain's rebase-drop (#2198) rebases a manifest-carrying lane whenever `main` advances. On a busy night `main` advanced four times in about twenty minutes, partly from PRs opened to fix this very PR's review findings. Each advance rebased the lane, which changed the head, which invalidated the acceptance, which re-parked the PR.

Five re-parks. Two of them followed a valid human acceptance, one of which carried a correct `reviewed-sha` marker for the then-live head. The self-correction never converged, because a fresh accept has to win a race against the next rebase and the rebase is driven by unrelated traffic. The PR landed only via the `--no-review-escalation` operator valve.

So the clause that makes the strictness acceptable — "it self-corrects" — does not hold whenever the drain is also the thing moving the head.

## The obvious fix is not free

Comparing content instead of identity (`git patch-id` over the net `<merge-base>..<head>` patch, which is exactly the check run by hand on #983 and which came back byte-identical) would make a pure rebase preserve the acceptance.

But a rebase changes the **base**, and an identical net patch can still combine badly with whatever landed on `main` in between — a semantic conflict that no textual comparison sees. "Byte-identical diff" is therefore not the same as "the review is still valid", and #2409's stated preference for the false-park is a defensible answer to precisely that. Required CI re-runs on the rebased head and catches mechanical breakage, not semantic breakage.

Options worth weighing, rather than assuming the first one:

- **Content-keyed coverage** — patch-id on the net patch. Kills the livelock; accepts the semantic-conflict residual.
- **Keep sha-identity, remove the race** — do not rebase a PR that carries a live acceptance, or re-evaluate the gate before the rebase rather than after. Preserves the strictness and fixes the convergence failure instead.
- **Auto-re-stamp on a provably-identical rebase** — the drain, having produced the rebase itself, re-stamps the marker when the net patch is unchanged; a human re-accept is then only needed when content actually moved.

The second and third keep #2409's safety posture intact, which is why this should not be filed as "switch to patch-id".

## Definition of done

- A parked PR with a valid acceptance converges to a land without an operator valve, in the presence of a drain that rebases it on unrelated `main` traffic.
- Whichever option is taken, #2409's stated preference is either preserved or explicitly revised in the docblock — the two must not silently disagree.
- A test reproduces the livelock: accept → unrelated main advance → drain rebase → assert the acceptance still converges.
