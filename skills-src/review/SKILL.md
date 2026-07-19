---
name: review
description: Review a parked pull request and record the human verdict — pull the PR's diff + the drain's escalation reasons, run the shared review core (findings + verdict), present them, and on your OK swap the review label (review:human/review:pending → review:accepted, or review:changes to bounce the fix back to the author lane). Use when the user asks to "review PR #N", "clear the parked PR", "look at the review:human PR", or give a human verdict on a drain-parked PR. NOT for reviewing your own working diff (that is /code-review) and NOT for opening a PR (that is /pr).
---

# Review a parked PR — the human verdict (#2326)

The drain (`/drain`) **parks** a blast-radius or gate-self PR with a `review:*` label and waits for an
independent verdict before it may land (#2171/#2262/#2285). Two classes reach a human:
- **`review:pending`** — agent-reviewable but not yet cleared (or the drain's auto-review bounced it here);
- **`review:human`** — a **gate-self** edit (the diff touches the auto-review trust chain,
  `we:scripts/lib/review-escalation.mjs` / `we:scripts/merge-ai-prs.mjs`), which an agent may **never**
  self-clear (conflict of interest). Two shapes reach you here, and `deriveReviewDisposition` (#2285) tells them
  apart — read the drain's comment to see which:
  - a **sensitivity** park (`gate-self`, `{ mode: converge, autoLand: false }`) — the drain **ran the panel↔editor
    convergence and may have pushed an advisory FIX** to the PR branch, then posted an `🤖 advisory AI review /
    fix (non-clearing)` comment. The diff you review may already carry agent-authored trust-chain edits — scrutinize
    them, don't rubber-stamp.
  - a **deadlock** park (`non-convergence` / `mandate-conflict`, `{ mode: human }`) — the loop ran and could not
    agree, so no fix was pushed; the comment is the round history + verdict table. You break the tie.
  Either way only a **human** clears it.

`/review <PR>` is the one review flow with no skill until now (before, a human did it by hand — e.g. PR #206).
It renders through the **same engine** as the drain's auto-review and `/code-review`: the judge-only core in
**[scripts/lib/review-core.mjs](../../../scripts/lib/review-core.mjs)** (#2325). The core **judges**; you
**decide what the verdict does** (the `decideReviewGate` policy stays in the drain — *review-core.mjs* never
applies a label). The same module also renders the operator-facing notice for your clearance (`renderReviewNotice`,
#2433) — see step 6 below.

## Flow

1. **Pull the PR.** Diff + metadata + the drain's escalation reasons:
   ```
   gh pr diff <PR> --repo <repo>
   gh pr view <PR> --repo <repo> --json title,body,files,labels,comments
   ```
   The escalation reasons ride the PR body's escalation block (and the `parked` entry in the drain's `--json`).
   Read the `🤖 advisory AI review (non-clearing)` comment if the drain already posted one.

2. **Run the shared core.** Seed a **fresh-context** review subagent (the `Agent` tool, e.g. `general-purpose`)
   with `buildMandate()` from `review-core.mjs` — it sees **ONLY the diff + PR description**, and per the mandate
   **never checks out the PR branch** in a shared tree (#2336; any test/repro runs in a throwaway clone). Shape
   its answer with `normalizeFindings()` and reduce it to a verdict with `deriveVerdict({ findings, humanRequired })`
   (`humanRequired: true` for a `review:human` PR → the verdict is always `needs-human`, never agent-clearable).

3. **Present** the findings + the escalation reason + the core's verdict to the operator. This is a **stop
   point** — the human reads and decides. Do not auto-proceed.

4. **Record the verdict as a label** on the operator's OK (never inferred, always an explicit label — #2281):
   - **accept** → `gh pr edit <PR> --repo <repo> --add-label review:accepted --remove-label review:pending`
     (for a `review:human` PR, also `--remove-label review:human`). Then `/drain` (a bare pass) lands it.
   - **changes** → `gh pr edit <PR> --repo <repo> --add-label review:changes --remove-label review:pending`,
     which routes the fix back to the **author lane** (the drain does no editing here — that convergence loop is
     v2, epic #2285). Summarize the required changes in a PR comment.

5. **Post the human verdict as a PR comment** (both paths — so the verdict is a durable, readable record on
   the PR, not just a label). Post via `gh pr comment <PR> --repo <repo> --body '<comment>'`, marked clearly as
   the human decision so it is never mistaken for the drain's `🤖 advisory AI review (non-clearing)` take:
   - Header line: `✅ human review — accepted` or `🔁 human review — changes requested`.
   - Body: the core's findings + verdict that you presented, plus one line naming who accepted / requested
     changes (the operator).
   - On the **changes** path this **is** the "summarize the required changes" comment from step 4 — post one
     comment, not two.

6. **Report the clearance to the operator via `renderReviewNotice({ event: 'cleared', pr, repo, outcome, actor })`**
   (`we:scripts/lib/review-core.mjs`, #2433) — the in-chat notice, distinct from the PR comment step 5 just
   posted. Same renderer the drain uses for its `escalated` event, so both directions of a PR's review outcome
   are reported in the same words, never hand-typed per call.

## Invariant

A **`review:human` PR is never agent-cleared** — the core may render an *advisory* take (findings + verdict as a
non-clearing comment), but the `review:accepted` label on a gate-self edit is applied **only** by a human via
this skill. The conflict-of-interest rule in `we:scripts/lib/review-escalation.mjs` (`isGateSelfPath` →
`humanRequired`) is unchanged; this skill is the sanctioned place the human acts on it.

## Non-author-accepts (#2439) — independence is about the ACTOR, not the git login

The independence #2439 wants is between the **actor that produced the diff** and the actor that clears it — **not**
between GitHub identities. In a solo constellation every PR's git author / login is the same person's PAT (a human
commit and an AI-lane commit both show up as the same account), so login identity is a **useless** independence
signal — do NOT gate on it, and do NOT warn the operator that "this is your own PR" merely because the author login
matches. It always will.

What actually matters:
- **An agent must not clear a diff it produced.** If *you* (the agent running this skill) wrote the diff, or ran the
  lane that wrote it, then reviewing it with your own subagents and flipping `review:accepted` yourself is the
  author-self-accept seam #2439's `redteam:accepted` (an INDEPENDENT hardened validator) exists to close. Spawning
  your own review subagents does not make you independent. So: review your own working diff before you open the PR
  (that is `/code-review`), but never relabel a `review:*` PR **you** authored to `review:accepted` yourself.
- **A human clearing an AI-lane PR is exactly the independence — clear it without hesitation.** A parked PR produced
  by a `lane/*` clone (an AI actor) and cleared by the human via this skill has a diff-producer distinct from its
  clearer. That holds *regardless* of the shared git login. This is the sanctioned path — present the verdict and,
  on the operator's OK, swap the label. Raise no author-self-accept caveat.
