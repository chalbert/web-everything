---
kind: decision
size: 5
status: open
blockedBy: ["2183"]
relatedTo: ["2123", "2178", "911"]
dateOpened: "2026-07-03"
tags: [decision, pr-flow, lanes, lane-guard, decision-authoring]
---

# Ratify→lane helper for decision-authoring; reconcile with #2123 lane guard

Spin-off (a) of #2183 — backs **direction-point 4** (decisions are the special case: author-in-`main`, then
lane-at-ratify). A decision is worked **directly in `main`** (uncommitted) so its rendered effect is
live-previewable while authored; on **ratify**, the diff is **moved to a lane clone → ready PR** and `main`
reverts to clean. This item builds the helper AND settles the fork that carve-out opens.

## The fork to decide: how does "author-in-main" survive the #2123 lane guard?

The now-active #2123 guard (`we:scripts/guard-lane.mjs`) DENIES `Edit`/`Write` on the primary tree — which
is exactly what "author a decision directly in `main`" requires. (Note: the guard hooks only the `Edit`/`Write`
tools, not script/`git` writes via `Bash`, so this bites the *authoring* keystrokes specifically.) Two options:

- **Default — a guard exemption for decision-authoring.** Teach `we:scripts/guard-lane.mjs` to allow primary-
  tree edits when the target is a decision item + its codified docs (or under an explicit
  `DECISION_AUTHORING=1` the skill sets), so the live-preview-in-main loop is kept and only the *ratify*
  moves to a lane. Cost: a real hole in the uniform #2123 rule — must be scoped tightly (decision files +
  `we:docs/agent/platform-decisions.md` only) so it can't become a general escape hatch.
- **Alternative — decisions author in a dedicated preview lane.** No exemption; a decision is authored in a
  reserved "preview" lane whose dev server is the review URL, and ratify just opens its PR. Cost: loses the
  "edit the primary tree the user is looking at" immediacy that motivated the carve-out; needs the lane's
  render proxied to the primary review port.

## The helper (either way)

`ratify → lane`: take the decision's diff (uncommitted-in-main, or in the preview lane), apply it in a lane
clone, `resolve` (a `kind:decision` resolve requires `--codified-to`, #911), open a ready-to-merge PR, and
leave the authoring surface clean. Mirrors `we:scripts/pr-land.mjs` for the transport.

## Acceptance

- The #2123 collision is decided and codified (guard exemption vs preview lane).
- A ratify produces an open ready-to-merge PR carrying the decision diff; the authoring surface ends clean;
  `main` only advances when that PR merges.
