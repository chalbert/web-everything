---
kind: story
size: 3
status: open
relatedTo: ["2171", "2162", "2216"]
tags: [lane, pr-flow, drain, review, merge-queue, footgun]
dateOpened: "2026-07-04"
---

# Review-escalation park must create the `review:*` labels and cannot permanently strand a sampled PR

The #2171 deterministic review-escalation rubric parks an escalated ready PR by applying `review:pending`
(`we:scripts/merge-ai-prs.mjs`, the escalation pass) — best-effort (`try { gh pr edit --add-label } catch {}`).
Two gaps surfaced landing this session's own memory PRs (observed live 2026-07-04, PR #110):

1. **The `review:*` labels are never created.** Unlike `ready-to-merge` (the `/workflow` Provision step
   `gh label create`s it once), nothing creates `review:pending` / `review:accepted` / `review:changes`. So the
   park's `--add-label review:pending` **silently no-ops** — `gh` returns `'review:pending' not found` and the
   catch swallows it. The park still *skips* the PR that pass, but leaves no visible signal that it was parked.

2. **A deterministically-sampled PR can never land via an escalation-on drain.** The 1-in-N sampling floor is
   keyed on the PR number (`prNum % sampleNth === 0`) — deterministic, so a sampled PR re-scores `escalate` on
   **every** pass. With **no reviewer daemon** to apply `review:accepted` (the seam #2171 left open) and the
   label uncreated, the PR is **re-parked every drain forever** — effectively unlandable until someone runs
   `--no-review-escalation` or hand-applies the (nonexistent) accept label. Observed: PR #110 (110 % 10 = 0)
   parked on the sampling floor; the only exit was a `--no-review-escalation` drain.

**Fix (compose):**
- **Create the `review:*` labels** — add them to the same idempotent `gh label create` step that mints
  `ready-to-merge` (the `/workflow` Provision step and/or a one-shot in `pr-land`/the drain), so the park's
  label actually applies and is visible.
- **Don't let the park be a dead end.** Until the independent-reviewer session/daemon exists (the #2171 runtime
  seam that applies `review:accepted`/`review:changes`), give the drain a safe escape: e.g. a bounded park
  window that times out to `merge-anyway` + auto-file (the `decideReviewGate` timeout branch is already written
  and tested — wire the park age so it fires), and/or make `--no-review-escalation` the documented manual
  override for a green sampled PR. The sampling floor must *slow* a PR for a spot-check, never *strand* it.
- **Don't re-park across passes silently.** A PR already carrying `review:pending` this drain shouldn't be
  re-announced as a fresh park each pass — track it (in `--watch` state) or read the existing label.

Relates to #2171 (the rubric this completes), #2162 (the drain), #2216 (the label-reconcile pass this rhymes
with — both are "the drain applies a label the producer flow was supposed to").
