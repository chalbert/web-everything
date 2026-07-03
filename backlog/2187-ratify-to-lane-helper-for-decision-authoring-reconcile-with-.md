---
kind: decision
size: 5
status: open
blockedBy: ["2183"]
relatedTo: ["2123", "2178", "911"]
dateOpened: "2026-07-03"
preparedDate: "2026-07-03"
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

## Prior art & readiness (prepared 2026-07-03)

Both options can be built almost entirely from machinery that **already exists** — the choice is about
ergonomics + how big a hole in #2123 is acceptable, not about new infrastructure:

- **Guard-exemption (the default) reuses the guard's own shape.** `we:scripts/guard-lane.mjs` already (a)
  path-tests every `Edit`/`Write` target and (b) ships a blunt full-bypass escape hatch (`LANE_GUARD_OFF=1`).
  A *scoped* exemption is the small, contained delta: allow a primary-tree edit **only** when the realpath is
  a `kind:decision` `backlog/*.md` file or `we:docs/agent/platform-decisions.md` (the codified-doc target),
  ideally gated behind a `DECISION_AUTHORING=1` the `/prepare`/decision skill sets so the hole is opt-in and
  loud. This is strictly narrower + safer than the existing `LANE_GUARD_OFF` blunt bypass it would largely
  replace for this use. **Risk to weigh:** any allowlist is a standing hole; the mitigation is the tight path
  scope + the explicit env gate + a log line on each exempted write.
- **Preview-lane (the alternative) reuses the #2139 lane-port proxy.** The pool already forwards a
  lane-claimed item's `/backlog/<NNN>/` page to the owning lane's dev server (`we:.claude/lane-ports.json` +
  `we:vite.config.mts` `lanePageProxy`, #2139) so `:3000` stays the single review URL, and `we:scripts/lane-pool.mjs`
  already provisions a persistent lane (+ the #2166 FUI sibling for SSR). So a reserved "decision-preview" lane
  is mostly wiring the skill to author there and `map` its page-port — no new render infra. **Cost to weigh:**
  the author edits a lane clone, not the exact primary tree the human is looking at, reintroducing the
  one-hop indirection direction-point 4 explicitly wanted to remove; and it needs a durable preview-lane
  reservation lifecycle.

**Recommended default — guard-exemption (scoped + env-gated).** It preserves the live-preview-*in-main*
authoring loop that motivated direction-point 4 verbatim, is the smaller change (the guard already has the
path-test + escape-hatch machinery), and replaces the *blunter* `LANE_GUARD_OFF` bypass for this path with a
*narrower* one — a net tightening, not just a new hole. Pick the preview-lane only if any standing
primary-tree write exemption is deemed unacceptable under the #2123 "uniform, no carve-out" ruling.

**Definition-of-ready:** the two options are stated with tradeoffs + a bold default, each grounded in the
exact existing mechanism it reuses; the residual is a single owner call (accept a tightly-scoped exemption vs.
hold #2123 fully uniform). Ready to ratify — the ratify turn is the call + codifying it, not more research.

## Acceptance

- The #2123 collision is decided and codified (guard exemption vs preview lane).
- A ratify produces an open ready-to-merge PR carrying the decision diff; the authoring surface ends clean;
  `main` only advances when that PR merges.
