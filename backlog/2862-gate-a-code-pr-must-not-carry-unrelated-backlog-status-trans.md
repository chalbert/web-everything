---
bornAs: xfczrac
kind: story
size: 3
parent: "2527"
status: open
dateOpened: "2026-08-02"
scope:
  - we:scripts/lane-drain.mjs
  - we:scripts/pr-land.mjs
tags: [drain, lane-hygiene, gate, backlog-workflow, conveyor]
---

# Gate: a code PR must not carry unrelated backlog status transitions

A lane's PR can pick up backlog **status transitions** that have nothing to do with its own change — the
tracker's source of truth riding along with a code diff, unmentioned in the PR body. Make the mix
script-detectable so it is caught before the PR is opened, not in review.

## Provenance

Filed from the independent `/review` of PR #974 (the CITATION-VERIFICATION gate). That PR's stated scope was
a new gate plus the one citation violation it caught. Its diff also carried **six new items**
(#2829–#2834) and **two live status transitions**: #2810 `open → resolved` (with `dateResolved`) and #2811
`open → active` (with `dateStarted`). None were named in the PR body. Accepted rather than re-split, with
this gate filed as the durable fix.

## Why it matters

Per MEMORY #105, claim ownership is `status:`, **not** the working tree — those status bytes are the
tracker's source of truth, not incidental noise. So the mix has three real costs:

- **Reverting the code reverts the tracker.** A revert of the gate would silently un-resolve #2810.
- **Merge conflicts on live state.** Any lane concurrently touching #2810/#2811 status conflicts.
- **Review scope inflation.** Reviewing a gate becomes reviewing a gate plus six unread stories, which is
  exactly how unreviewed items slip through a review that was scoped to something else.

## Root cause

The lane's working tree accumulates session artifacts — items filed mid-session, statuses flipped by
concurrent work — and the commit stages the whole tree rather than the change's own pathspec. Nothing at
PR-open time compares what was staged against what the PR claims to be.

## Approach

This is the same class as the existing lane-hygiene rules (MEMORY #104, and the drain's transient-file drop
in `40613f34`), so prefer **extending an existing lane check** over adding a new standalone gate.

- At PR-open / land time, detect a diff that mixes non-backlog file changes with **backlog status
  transitions** (a `status:` / `dateStarted` / `dateResolved` frontmatter change) on items the PR does not
  otherwise touch.
- Fail — or require the PR body to enumerate them explicitly, so the mixing is a stated decision rather
  than an accident.
- **New item filings are a softer case** than status flips: a lane filing spin-off items it discovered is
  normal and useful. Decide whether they warrant the same treatment or only a body-enumeration
  requirement. Status transitions on *other* items are the hard case.

## Acceptance

- A lane diff that flips `status:` on a backlog item unrelated to its change is refused (or forces a body
  enumeration) before the PR opens.
- Reproduce the #974 scenario: a gate PR carrying `#2810 open → resolved` and `#2811 open → active` is
  flagged.
- A PR whose *only* backlog change is its own claim/resolve is unaffected — the normal lane flow must not
  regress.
- The rule lives with the existing lane-hygiene checks, not as a separate one-off gate.
