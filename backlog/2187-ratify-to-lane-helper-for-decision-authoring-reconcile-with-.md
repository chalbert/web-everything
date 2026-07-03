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

- **Default — decisions author in a dedicated preview lane.** No exemption to #2123: a decision is authored in
  a reserved "preview" lane, and **at claim the lane's dev server is auto-launched and its rendered
  `/backlog/<NNN>/` page auto-opened** (the manual flow demoed 2026-07-03, which "worked well enough"). Ratify
  just opens the lane's PR. The one-time cost that made this look clunky — "you'd review a lane URL, not the
  primary tree" — is a *tooling* problem now solved two ways (see below), so #2123 stays **uniform, no
  carve-out** — the exact stance #2123 ratified.
- **Alternative — a guard exemption for decision-authoring.** Teach `we:scripts/guard-lane.mjs` to allow
  primary-tree edits when the target is a decision item + its codified docs (gated behind an explicit
  `DECISION_AUTHORING=1` the skill sets), keeping the live-preview-*in-main* loop with zero extra process.
  Cost: a **standing hole in #2123** — it literally re-opens the content-session carve-out #2123 ruled
  *against*; even scoped to decision files + `we:docs/agent/platform-decisions.md`, an allowlist is a
  permanent exception to maintain.

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

**Recommended default — preview-lane (with claim-time auto-launch + auto-open).** It keeps #2123 **truly
uniform** (no decision-authoring carve-out — the stance #2123 ratified), reuses machinery that already exists
(the pool + the #2139 proxy), and the ergonomic gap that once favoured the exemption is closed by the
claim-time tooling (validated live 2026-07-03). Pick the guard-exemption only if the extra dev-server /
claim-tooling is judged not worth avoiding a *tightly-scoped, env-gated* standing exception.

**Definition-of-ready:** the two options are stated with tradeoffs + a bold default, each grounded in the
exact existing mechanism it reuses; the residual is a single owner call (accept a tightly-scoped exemption vs.
hold #2123 fully uniform). Ready to ratify — the ratify turn is the call + codifying it, not more research.

## Acceptance

- The #2123 collision is decided and codified (guard exemption vs preview lane).
- A ratify produces an open ready-to-merge PR carrying the decision diff; the authoring surface ends clean;
  `main` only advances when that PR merges.
