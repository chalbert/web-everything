---
bornAs: xmzpb04
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# Sweep the retired unlabelled-is-a-hold framing out of the rest of the corpus

PR #1050 corrected `/pr` and the three conveyor briefs: `--park` is the only unconditional hold, and an unlabelled PR is not held because the daemon labels any green producer PR `ready-to-merge`. Four sites elsewhere still carry the retired framing — they either prescribe `pr-land --no-wait` as the land recipe or describe an unlabelled PR as safely parked. They were out of scope for #1050's freeze. Sweep them, and check each is corrected rather than deleted.

## The sites (verified 2026-08-05 on `main`)

| file | line | what it says |
|---|---|---|
| [`we:docs/agent/backlog-workflow.md`](docs/agent/backlog-workflow.md) | 807 | the per-item arc prescribes `pr-land … --no-wait` then "label it **`ready-to-merge`**" — a hand-applied label after a no-wait open, which is exactly the hand-rolled labelling `/pr` now forbids |
| [`we:skills-src/batch-backlog-items/SKILL.md`](skills-src/batch-backlog-items/SKILL.md) | 86 | "a PR whose CI ends up red is left unlabelled for you to fix, never handed to the drain" — the daemon's green reconcile hands it over on any later green run |
| [`we:skills-src/batch-backlog-items/SKILL.md`](skills-src/batch-backlog-items/SKILL.md) | 352 | the `check-timeout` → "open but unlabelled" → "invisible to the drain and strands" description, which `shouldLabelOnGreen` (#2216) was built to heal — the finalize reconcile it describes may now be redundant |
| [`we:agent-memory-src/104-feedback_commit_to_default_branch_ok.md`](agent-memory-src/104-feedback_commit_to_default_branch_ok.md) | 12 | states the land recipe as "`pr-land --no-wait` + the `ready-to-merge` label" |

Line numbers are a snapshot — grep for the phrasing, not the line.

## Why it matters

The corrected framing only holds if the corpus agrees. An agent that reads the batch skill and the `/pr` skill
in the same session gets two different answers to "does an unlabelled PR wait for me?", and the wrong one is
the silent-land direction: `shouldLabelOnGreen` ([`we:scripts/merge-ai-prs.mjs`](scripts/merge-ai-prs.mjs))
labels **any** producer-owned AI PR `ready-to-merge` once its required check reads green, remembering no
earlier red run, and the resident daemon runs that reconcile continuously.

## Done when

- Each of the four sites states the current mechanism: `--park=<review:human|review:pending>` is the hold; an
  unlabelled PR is not held; the `ready-to-merge` label is applied by `pr-land` on green, never by hand.
- The two batch-skill sites are **re-derived, not just reworded** — decide whether the `labelled:false`
  finalize reconcile at :352 is still doing work now that the daemon heals the same state, and say so.
- A grep for the retired shapes (`--no-wait` presented as a hold; "left unlabelled" presented as safe) returns
  nothing outside a deliberate "this is what it does NOT do" explanation.
- The sweep does not silently delete the `--no-wait` flag's documentation — the flag still exists and still
  has one honest use (raise the PR now, content for the daemon to land it on green).
