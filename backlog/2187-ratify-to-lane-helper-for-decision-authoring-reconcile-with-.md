---
kind: decision
size: 5
status: resolved
blockedBy: ["2183"]
relatedTo: ["2123", "2178", "911"]
dateOpened: "2026-07-03"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
codifiedIn: "docs/agent/platform-decisions.md#pr-flow-rollout-mechanism"
preparedDate: "2026-07-03"
tags: [decision, pr-flow, lanes, lane-guard, decision-authoring]
---

# Ratify→lane helper for decision-authoring; reconcile with #2123 lane guard

Spin-off (a) of #2183 — reconciles **direction-point 4** (decisions live-previewable while authored) with the
now-active #2123 guard, which DENIES primary-tree `Edit`/`Write`. This was the one genuine fork #2183 left.

## Ruling (2026-07-03) — preview lane, #2123 stays uniform

**Decisions author in a dedicated PREVIEW LANE — no guard exemption; #2123 stays uniform (no
decision-authoring carve-out).** The live-authoring loop is preserved by *tooling*, not by poking a hole in
#2123: at a decision **claim** the skill provisions/reuses the preview lane, `map`s it to the #2139 page-port
proxy (so `:3000` stays the single review URL), launches its dev server, and **opens the rendered
`/backlog/<NNN>/` page** — the exact flow demoed by hand 2026-07-03. Edits land in the lane with live HMR;
**ratify** runs the `ratify → lane` helper to open the ready-to-merge PR.

**Rejected — a scoped `DECISION_AUTHORING=1` guard exemption.** Even tightly scoped to decision `backlog/*.md`
+ `we:docs/agent/platform-decisions.md`, it re-opens the exact content-session carve-out #2123 ruled *against*;
the preview lane holds the rule uniform at the cost of one auto-managed dev server (cheap, and the auto-launch
tooling is broadly useful — any claim can auto-open its rendered page). Codified as a rider under
[we:docs/agent/platform-decisions.md#pr-flow-rollout-mechanism](../docs/agent/platform-decisions.md).

## The helper (either way)

`ratify → lane`: take the decision's diff (uncommitted-in-main, or in the preview lane), apply it in a lane
clone, `resolve` (a `kind:decision` resolve requires `--codified-to`, #911), open a ready-to-merge PR, and
leave the authoring surface clean. Mirrors `we:scripts/pr-land.mjs` for the transport.

## Prior art & readiness (prepared 2026-07-03)

Both options can be built almost entirely from machinery that **already exists** — the choice is about
ergonomics + how big a hole in #2123 is acceptable, not about new infrastructure:

- **Guard-exemption (rejected) reuses the guard's own shape.** `we:scripts/guard-lane.mjs` already (a)
  path-tests every `Edit`/`Write` target and (b) ships a blunt full-bypass escape hatch (`LANE_GUARD_OFF=1`).
  A *scoped* exemption is the small, contained delta: allow a primary-tree edit **only** when the realpath is
  a `kind:decision` `backlog/*.md` file or `we:docs/agent/platform-decisions.md` (the codified-doc target),
  ideally gated behind a `DECISION_AUTHORING=1` the `/prepare`/decision skill sets so the hole is opt-in and
  loud. This is strictly narrower + safer than the existing `LANE_GUARD_OFF` blunt bypass it would largely
  replace for this use. **Risk to weigh:** any allowlist is a standing hole; the mitigation is the tight path
  scope + the explicit env gate + a log line on each exempted write.
- **Preview-lane (the default) reuses the #2139 lane-port proxy + `we:scripts/lane-pool.mjs`.** The pool already
  provisions a persistent lane (+ the #2166 FUI sibling for SSR), and the #2139 proxy already forwards a
  lane-claimed item's `/backlog/<NNN>/` page to the owning lane's dev server (`we:.claude/lane-ports.json` +
  `we:vite.config.mts` `lanePageProxy`) so **`:3000` stays the single review URL**. So a "decision-preview"
  lane is mostly wiring the decision claim to author there + `map` its page-port — no new render infra. The
  indirection worry is gone: at claim the skill provisions/reuses the preview lane, **launches its dev server,
  and opens the decision's rendered page** — either at `:3000` (via the #2139 proxy) or a lane port. Live HMR
  on `.md`/`.njk` edits reloads it exactly as the primary tree would. **Residual cost:** a dev server per
  active decision (cheap, and auto-managed) + the claim-time launch/open tooling (small, and broadly useful —
  ANY item claim could auto-open its rendered page).

### The claim-time mechanism (spec for the default)

On a **decision claim** (`claim <NNN>` for a `kind:decision`, or `--as=preparing`): (1) provision/reuse the
reserved preview lane (`we:scripts/lane-pool.mjs`), `reset --hard origin/main`; (2) `map` the item → the lane's
page-port (#2139) so `:3000/backlog/<NNN>/` proxies to it; (3) launch the lane's dev server if not already up;
(4) **open the rendered `/backlog/<NNN>/` page** in the browser. Authoring edits land in the lane (HMR live);
**ratify** runs the `ratify → lane` helper (below) to open the lane's ready-to-merge PR and clear the preview.
The auto-open is generalisable — a nice DX default for any claim — but for decisions it IS the review loop.

## Acceptance

- The #2123 collision is decided and codified (preview lane; #2123 uniform, no exemption). ✓ (this ruling)
- A ratify produces an open ready-to-merge PR carrying the decision diff; the authoring surface ends clean;
  `main` only advances when that PR merges.
