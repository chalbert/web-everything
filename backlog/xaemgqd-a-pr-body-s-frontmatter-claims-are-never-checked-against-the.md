---
kind: story
size: 2
status: open
relatedTo: ["3147", "3035"]
dateOpened: "2026-08-25"
tags: [operations, review, pr-transport, prevention]
---

# A PR body's frontmatter claims are never checked against the diff it describes

Gate every backticked `key: value` span in a PR body against the value the PR's own diff writes, so a stale description cannot survive a review round.

## The observation this is filed from

PR #1560 (preparing #3147) was bounced four consecutive rounds, and three of those bounces were the same
defect: **the description asserted something the diff did not do.**

| round | the body said | the diff wrote |
| --- | --- | --- |
| r3 | `scope:` gains `we:skills-src/conveyor/runner.mjs` | `scope:` is `we:skills-src/conveyor/SKILL.md` alone |
| r4 | this card is now `blockedBy: ["3165"]` | `blockedBy: ["3118", "3165"]` |
| r5 | *(the same `blockedBy` sentence, still uncorrected)* | `blockedBy: ["3118", "3165"]` |

Both are the *same shape*: a backticked `key: value` span in the body, naming a real backlog frontmatter key,
quoting a value the diff contradicts. The r4 bounce is the sharpest evidence that a human pass does not catch
this — the body **was** edited that round, to fix the `scope:` instance, and the `blockedBy` sentence three
paragraphs above it was not re-read. Both instances are mechanically detectable from data the transport
already has.

## Why a gate rather than a rule

A rule ("re-read the body against the diff") already exists in every fix-agent brief and has now failed four
times on one PR. The check is cheap and total where a re-read is neither: the body is one `gh pr view --json
body` call, the diff is one `git diff`, and backlog frontmatter is already parsed by
`we:scripts/check-backlog-item.mjs` and the whole-repo gate. Nothing here needs judgment.

## Sketch

For each fenced-or-backticked span in the PR body matching `<key>: <value>` where `<key>` is a known backlog
frontmatter key (`blockedBy`, `scope`, `status`, `kind`, `parent`, `relatedTo`, `size`, `tier`, …):

- find the backlog item(s) the PR's diff touches;
- read that key's value at the PR head;
- fail when the two differ, printing both.

Silent when the body quotes no frontmatter key, which is the common case — so it costs nothing on a PR that
does not make this class of claim.

## Not in scope

Prose claims that are not `key: value` spans. Those are the sibling class, filed separately as
"A claim corrected at one site while the same claim stands at another has no gate". This item deliberately
takes only the mechanically-decidable half.

## Done when

1. **Executable** — a check exists that, given PR #1560's r4 body and r4 head, exits non-zero and names
   `blockedBy` with both values (`["3165"]` in the body, `["3118", "3165"]` in the diff). Run against a body
   whose spans all match, it exits 0.
2. **Mutation** — editing the fixture body's `blockedBy` span to match the diff turns the check green;
   editing the diff's frontmatter instead turns it red again. The check must fail on the *disagreement*, not
   on the presence of the key.
3. It is wired into the same place the review transport already runs, so a bounce for this class cannot be
   reached by a body nobody re-read.
4. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
