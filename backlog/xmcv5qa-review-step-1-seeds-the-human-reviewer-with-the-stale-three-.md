---
kind: story
size: 2
status: open
dateOpened: "2026-08-03"
relatedTo: ["2450", "2373", "2336", "2326"]
scope:
  - we:skills-src/review/SKILL.md
  - we:.claude/skills/review/SKILL.md
tags: [review, diff, net-diff, skill, stale-base]
---

# /review step 1 seeds the human reviewer with the stale three-dot gh pr diff — #2450 fixed only the drain

#2450 moved the drain's auto-review panels off `gh pr diff`'s three-dot merge-base diff onto a net two-tree diff (`computeNetDiffText`) and updated `we:skills-src/drain/SKILL.md` step 1 to say so. Its `scope:` never listed the review skill, so `we:skills-src/review/SKILL.md` step 1 still instructs `gh pr diff <PR> --repo <repo>` — the exact stale-base command #2450 removed from the drain. A human reviewer following the skill literally grades files sibling lanes already landed on `main`, as if this PR added them. Point `/review` at the same net basis.

## Evidence

Observed live during the `/review` of **PR #1009** (2026-08-03). `gh pr diff` presented the change as
**4 files / 42 lines**; the true net diff against current `main` was **2 files / 2 lines**. Three of the
four files were already on `main` via sibling lanes (#1008 had landed the `#2450` resolve, #1010 the
`#2882` close-out). Reviewing the three-dot output would have meant grading a `#2450` resolve and a
`#2882` close-out that this PR did not contribute.

The phantom content was not harmless framing — it hid the one thing that did matter. The `#2882`
frontmatter this PR *did* carry conflicted with the copy #1010 had already landed, and that only became
visible once the review switched to the net basis and to `git merge-tree`.

## Why the skill, not just the reviewer

The agent-memory verification index already carries the rule — *"Review a parked PR against CURRENT main,
not `gh pr diff`"* — so today's correctness depends on the agent recalling a memory that **contradicts the
skill it is executing**. The skill is the artifact in front of the reviewer at the moment of the call;
leaving it wrong makes memory load-bearing for a step that should be mechanical.

## Fix shape

- `we:skills-src/review/SKILL.md` step 1: resolve the head ref (`gh pr view <PR> --json headRefName`) and
  seed the review from `computeNetDiffText({ exec, rev: <headRef>, fetchExtraRefs: [<headRef>] })`
  (`we:scripts/merge-ai-prs.mjs`), stating plainly — as the drain skill already does — that this is **not**
  `gh pr diff`'s three-dot diff and why. Keep `gh pr diff` only as the `scored:false` fallback.
- Keep the #2336 no-checkout constraint intact: `computeNetDiffText` only fetches tracking refs and diffs
  two trees in place, so it never moves HEAD in a shared checkout.
- Mirror into `we:.claude/skills/review/SKILL.md` the same way #2450 mirrored the drain skill.
- Optional, cheap, and proven useful here: pass the net changed-file set as `netChangedFiles` to
  `buildPanelMandate` (`we:scripts/lib/review-core.mjs`), the same GROUND TRUTH block #2450 added for the
  drain, so a reviewer can self-check a scope finding.

`computeNetDiffText` is already generic — `exec` is an injected callback and `rev` is any ref, so nothing
about the drain's call site needs to change for `/review` to reuse it.

## Acceptance

- `we:skills-src/review/SKILL.md` no longer instructs a bare `gh pr diff` as the review basis; it names the
  net two-tree basis first and `gh pr diff` only as the degraded fallback.
- The `we:.claude/skills/review/SKILL.md` mirror matches.
- A reviewer following the skill on a PR whose merge base is stale sees only the files the PR actually
  adds.
