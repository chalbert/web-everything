---
bornAs: x6gp3oa
kind: story
size: 2
status: open
blockedBy: ["2895"]
relatedTo: ["2555", "2470"]
priority: low
scope:
  - we:scripts/review-console.mjs
  - we:scripts/review-detail.mjs
tags: [review, console, gate-self, devx, interim]
dateOpened: "2026-08-06"
---

# Minimal local review console: a page whose accept button clears a gate-self PR

A one-page local server that renders a parked PR's review context and clears it on a button click, for the
times the operator is NOT in a session with an agent. Purely an ergonomics surface: [#2895] already makes the
clearance possible and recorded from the CLI, and in-session the fastest correct path is saying "accept
&lt;PR&gt;" and letting the agent run it. This exists for out-of-session clearance and as the natural place a
human-presence gesture ([#2946]) would later attach.

## Why it is owed, and why it is LOW priority

Filed out of the PR #1046 clearance, where the operator asked for "a minimal UI screen with accept button,
even if full screen is not ready — AI could open it". The idea is sound, but the reasoning that made it feel
urgent does not survive scrutiny, and the item should say so rather than inherit the urgency:

- **It is not a security boundary.** An agent with shell access on the same machine can `curl` the page and
  scrape any token it holds, so a click proves nothing a CLI flag does not. That was ruled on [#2895]; the
  genuinely unforgeable option is [#2946].
- **In-session it is worse DevX, not better.** The operator is already in a terminal talking to the agent. A
  browser context-switch to click one button is more friction than saying two words. [#2895]'s
  `/review &lt;PR&gt; accept` covers that case better.

What is left is a real but narrow need: clearing a park when no session is open, and having somewhere for the
gesture to live later. That is worth building, and worth building small.

## Build

- `node we:scripts/review-console.mjs &lt;PR&gt;` starts a local server, prints the URL, serves ONE page. No
  framework, no build step, no bundler.
- The page renders `we:scripts/review-detail.mjs`'s existing contract ([#2470]) — escalation reasons, the
  drain's advisory comment, any prior human verdict, the derived disposition, the diff stat. Consume that
  contract; never re-read a park's shape, or the console and the CLI will drift on what a park means.
- Two actions: accept (→ `we:scripts/review-set-label.mjs --to=clear-human`) and request changes
  (→ `--to=changes`). Both go through the module, so the `reviewed-sha` stamp and the attributed comment come
  for free.
- The actor comes from git config; the stated reason is a required field in the form, matching [#2895]'s
  requirement that a clearance always carries one.
- The page states plainly what a clearance record proves — that the sanctioned path was followed, not that a
  human followed it — for as long as [#2946] is unbuilt.

## Home, and the condition on it

Build it in WE, next to the contract and the CLI it drives, with **no cross-repo hop**. This is agent/dev
tooling, not product code, so it does not breach the zero-implementation rule — the same reasoning
`we:scripts/review-detail.mjs` already records for itself.

**The condition: this must be superseded, not maintained in parallel.** The real operator surface is the
launch-review console board ([#2555], in plateau-app), whose "Operator actions" sub-slice already owns the
review modal with merge/bounce/take-over. When that lands, this page is deleted, not kept as a second console.
Say so in the file header so the next reader does not treat it as a surface with a future.

## Acceptance

- An operator with no session open can clear or bounce a parked PR from the page, and the resulting PR comment
  is byte-identical in shape to the one the CLI produces (same builder, not a re-implementation).
- The page reads its data only from `we:scripts/review-detail.mjs`; a test pins that it holds no second copy
  of how a park is read.
- The page and the file header both state that this is interim and superseded by [#2555].
