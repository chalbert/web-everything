---
bornAs: xwh81wh
kind: story
size: 2
status: open
dateOpened: "2026-08-06"
dateStarted: "2026-08-08"
relatedTo: ["2326", "2433", "2644", "2882", "2750"]
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/lib/review-core.mjs
  - we:skills-src/review/SKILL.md
tags: [review, skill, ergonomics]
---

# The /review skill's documented call sequence fails on first use (body-file path guard, notice outcome vocabulary, no PR-state guard)

Three papercuts in the `/review` skill's own documented steps. (1) and (2) were hit on the first invocation
during the human review of **WE PR #1063** (2026-08-06); (3) was hit in a separate session reviewing
**WE PR #1073** (2026-08-07), which also re-hit (1). None of the three is a merge-safety hole and all have
workarounds, but each costs a round-trip on a path that is supposed to be mechanical. (1) pushes the agent
toward a *worse* practice than the guard it trips, and (3) is worse than a round-trip: it reports success for
an act that did not happen, which is enough to produce a confidently wrong diagnosis.

## 1. `--body-file` refuses the agent scratchpad, pushing findings into the tracked tree

`we:scripts/review-set-label.mjs` constrains `--body-file` to `[cwd, os.tmpdir()]` — correctly, since the
file is published to a public PR and cannot be unpublished. But on macOS `os.tmpdir()` is `/var/folders/…`,
while the Claude Code session scratchpad is `/private/tmp/claude-501/<project>/<session>/scratchpad`. So the
sanctioned agent temp directory is refused:

```
{"error":"--body-file must live under the repo root or the temp dir
 (got /private/tmp/claude-501/…/scratchpad/pr1063-findings.md)
 — its contents are published to a public PR"}
```

The only workaround is to copy the findings **into the repo root** and delete it afterwards — dropping an
untracked file into the tracked tree, which is exactly the kind of stray the guard's spirit is trying to
avoid. A forgotten `rm` leaves a findings file staged into someone's next tight-pathspec commit.

Options (pick one — this is the judgment half): widen the allowlist to a scratchpad root passed by an env
var the harness already sets; accept any path under `/private/tmp` **and** `/tmp` in addition to
`os.tmpdir()` (both are OS temp roots on darwin, so this does not weaken the leak guard); or — cheapest —
leave the guard alone and document the repo-root-then-delete workaround in the skill so nobody rediscovers it.

**Second sighting 2026-08-07 (WE PR #1073), reviewing agent, verbatim the same error** — the findings file
was written to the session scratchpad and refused identically. The agent worked around it by copying to
`os.tmpdir()` rather than the repo root, which avoids the stray-in-tracked-tree failure above but is not what
the skill documents. Two independent sessions rediscovering the same guard is the priority evidence: this is
not a one-off, it is on the default path of every agent review.

## 2. `renderReviewNotice` says `accept`, the CLI says `accepted`

The skill's step 4 uses `--to=accepted`; its step 6 uses `renderReviewNotice({ outcome })`, which rejects
that same word:

```
Error: renderReviewNotice: unknown outcome "accepted" — must be one of accept, changes
```

So the documented sequence throws when the operator carries the obvious value through. Fix: accept both
spellings in `renderReviewNotice`, or single-source the verdict vocabulary between
`we:scripts/lib/review-core.mjs` and `we:scripts/review-set-label.mjs` (the label side already uses
`accepted`/`changes`, so normalising toward the CLI's words is the smaller change).

## 3. No PR-state guard — a verdict on an already-merged PR reports `ok:true`

`we:scripts/review-set-label.mjs` never checks whether the PR is still open. `runReviewLabelCli` fetches
`labels,headRefOid` only, and `decideSetLabel` reasons purely from the label set, so every target
(`accepted` / `changes` / `rearm` / `clear-human`) applies cleanly to a **merged or closed** PR and the CLI
reports success.

Observed 2026-08-07 on **WE PR #1073**. Timeline from
`gh api repos/<owner>/<repo>/issues/1073/timeline`:

```
20:17:59  labeled ready-to-merge   (CI green → the drain arms it)
20:24:08  MERGED
20:30:05  labeled review:changes   ← the bounce, six minutes after the merge
20:30:06  commented                ← the verdict comment
```

The bounce returned `{"ok":true,"pr":1073,"to":"changes","labels":["ready-to-merge","review:changes"]}`. The
label was inert — the merge path never saw it — but nothing in the output said so.

**Why this is worse than a papercut.** The false success was read as a real bounce that the drain had ignored,
and reported as a live reproduction of **#2750** (`review:changes` must veto the merge). It was not: the label
post-dates `mergedAt`, so the merge gate was never involved. #2750 already carries five sightings and its
evidence bar does not require comparing the label timestamp to `mergedAt` — so a false sixth would have been
recorded on the strength of this CLI's `ok:true`. A tool that reports success for an act that did not happen
manufactures exactly this class of wrong conclusion.

**Fix.** Add `state` to the existing `gh pr view --json` call in `runReviewLabelCli` — one extra field on a
call already being made, no new `gh` hop — and fail closed on anything but `OPEN`, naming the state in the
error. Checked against the callers: `we:scripts/lib/disposition-land-seam.mjs` and
`we:scripts/lib/auto-land-seam.mjs` both route through `decideSetLabel` **before** the merge, precisely to
permit it, so no sanctioned path labels a merged PR and the refusal breaks nothing. A verdict that loses a
race to the drain is moot anyway — the merge has already happened.

Consider also having the refusal name the recovery: the findings belong on a **new PR**, not on the merged one.

## Why one item, not three

Same seam (`we:scripts/review-set-label.mjs` and the `/review` skill's documented steps), same discovery mode
(each surfaced by an operator following those steps on a real review), same fix session. Split only if (1)
turns into a real allowlist design discussion, or if (3) grows past the one-field state check into the wider
"freeze a PR while a review is in flight" question — that is a distinct design problem and is **not** in scope
here (see #2750 / #2751 for the merge-veto half).
