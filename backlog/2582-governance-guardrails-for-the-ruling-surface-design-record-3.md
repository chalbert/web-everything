---
bornAs: xzlknku
kind: story
size: 3
parent: "2565"
status: resolved
scaffoldedBy: "slice-2565"
dateScaffolded: "2026-07-20"
dateOpened: "2026-07-20"
dateResolved: "2026-07-21"
tags: [plateau-loop, console, decision-surface, governance, guardrails, slice-2565]
---

# Governance guardrails for the ruling surface (design record 3g-T2)

Fence where and whether a decision may be ruled from the ruling surface, per design-record §3g-T2. Three
guards: a decision only **opens** here and is never ratified inline in a biased launch frame; a
**statute-touching** decision cannot be ruled from a launch context and routes to the policy menu; and any
**per-launch waiver** is scoped, logged, and auto-expiring. This gates the write path from [#2581] so a
ruling can only be *recorded* where governance allows — the guard sits between the operator's verdict and the
`#2558` write port.

## Scope
- **Open, don't ratify inline (§3g-T2).** From a launch-review context the surface **opens** a decision for
  ruling — it never lets the operator ratify inline inside the biased launch frame. Ruling happens on the
  dedicated ruling surface ([#2580]/[#2581]), reached by an explicit open action, mirroring `#2555`'s
  Operator-actions rule ("open from a lane, never ratify inline").
- **Statute-touching → policy menu.** A decision that touches statute (mints or amends a rule in
  [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) or a `docs/agent/*.md` governor)
  **cannot be ruled from a launch context at all** — the surface detects the statute-touching flag and routes
  it to the policy menu instead of offering the verdict control. The classifier for "statute-touching" is the
  guard's core, and it must read a **pre-ruling** signal — one knowable *before* the verdict control is
  offered — **not** the ruling-time `codifiedIn` output (that anchor is the operator's choice made *at*
  ruling, so keying off it is circular: the gate would need the very output it is supposed to gate). The
  concrete pre-ruling source is the decision item's **own declared statute scope**: the fork's proposed
  codification target as authored on the rendered fork card ([#2580]) — a fork whose recommended rule
  names a `we:docs/agent/platform-decisions.md` / `docs/agent/*.md` anchor is statute-touching; a fork that
  proposes a narrow `one-off` call is not. **This declared target is net-new to author, not a free read** — no
  existing `we:`-side frontmatter field classifies an open decision as statute-touching (`codifiedIn` appears
  only on *resolved* items). If the fork cards from [#2580] do not already surface a machine-readable
  proposed target, adding that field to the decision/fork model is in scope for this slice.
- **Per-launch waivers — scoped, logged, auto-expiring.** Where a waiver lets a ruling proceed from a
  constrained context, it is (a) **scoped** to that one launch, (b) **logged** (an auditable record of who
  waived what, when, and why), and (c) **auto-expiring** (it lapses with the launch / a TTL, never a standing
  bypass). A waiver never silently persists across launches.

## Where the code goes (locus)
- The guard is a gate in the plateau-app ruling flow, between the verdict control and the write call:
  `plateau-app:src/backlog-view/`. It wraps the write action added in [#2581]
  (`plateau-app:src/backlog-view/write-action.ts`) — a blocked ruling never reaches
  `POST /api/backlog/write`.
- Statute-touching detection reads the decision item's **declared** codification target (the fork's proposed
  anchor, from [#2580]), evaluated *before* the verdict control is offered. It does **not** key off the
  resolve-time `codifiedIn` gate in [we:scripts/backlog.mjs](scripts/backlog.mjs) /
  [we:scripts/backlog/frontmatter.mjs](scripts/backlog/frontmatter.mjs): that gate only *requires* a
  `--codified-to` value at ruling time on the `resolve` branch (`validateCodifiedIn`) — it is a ruling-time
  requirement, not a pre-ruling classifier, and no open decision carries `codifiedIn` in frontmatter. The
  same real-anchor-vs-`one-off` distinction is applied here, but sourced from the declared target, not the
  ruling output. No new statute anchor is minted by this slice.

## Depends on / out of scope
- **Depends on** [#2581] — there must be a write path to guard.
- Rendering and evidence links are [#2580]; the verdict/override mechanics are [#2581]. This slice adds
  only the *may-I-rule-here* gate around them.

## Delivered (all three §3g-T2 guards)
The launch-context path (#2587's open-decision-from-a-lane) landed, unblocking the remaining two guards.
All three §3g-T2 fences are now built in `plateau-app:src/backlog-view/`:

- **Guard 1 — open, don't ratify inline.** The board's UC-A9 cell only *navigates* to `/console-ruling`
  (the sanctioned channel); it never offers a decision `resolve`/ratify. Delivered by #2587's navigation +
  the structural absence of a board ratify verb. No inline ratify from the biased launch frame.
- **Guard 2 — statute-touching → policy menu.** The list read port classifies each decision
  (`plateau-app:src/backlog-view/loader.ts` reusing `classifyStatuteTouching`) and carries
  `statuteTouching`/`statuteTargets` onto the board card; a statute-touching UC-A9 cell forks to a
  **policy-menu gate** (a full-viewport modal on the board) instead of quick-opening — it names what's
  blocked / why / the sanctioned path, and never writes. A non-statute cell opens directly. (plateau-app PR #92.)
- **Guard 3 — per-launch waiver.** From the gate, a **scoped, logged, auto-expiring** waiver
  (`plateau-app:src/backlog-view/write-action.ts` `LaunchWaiver` + `grantLaunchWaiver`; a `waiver` write verb;
  `GET /api/backlog/waivers`) lets one decision skip the gate for a 30-min TTL — logged (who/what/when/why),
  server-stamped TTL (no client-forged long-lived waiver), persisted to a git-ignored server-held JSON (NEVER
  lane→PR). A re-check after expiry gates again. The board drops the flag for a waived num so the cell routes
  direct until lapse. (plateau-app PR #93.)

The earlier-landed pre-ruling CLASSIFIER + its ruling-surface marker (below) is the read-side half that
Guard 2 keys off.

## Delivered earlier (the pre-ruling classifier)
`plateau-app:src/backlog-view/decision-forks.ts` `classifyStatuteTouching(body)` reads the decision's declared
codification prose (a `docs/agent/*.md` governor ref on a codif/amend/statute line — the pre-ruling signal, NOT
the ruling-time `codifiedIn`) and surfaces `statuteTouching` + `statuteTargets` on the DTO; the ruling surface
shows an amber "amends the governor — <targets>" badge (it MARKS, it never blocks). Conservative +
low-false-positive.

## Acceptance
- From a launch-review context the surface only **opens** a decision (no inline ratify); the verdict control
  is reachable solely on the dedicated ruling surface via an explicit open action.
- A **statute-touching** decision — classified from its declared codification target *before* the verdict
  control is offered (never from the ruling-time `codifiedIn`) — is refused a launch-context ruling and is
  routed to the policy menu (with the reason named), while a `one-off` decision is rulable.
- A per-launch **waiver** that permits a constrained ruling is recorded (who/what/when/why), scoped to the
  single launch, and expires automatically — a re-check after expiry shows the ruling blocked again.
- Every refusal names its reason and the fixing action (design-record error-copy invariant); `plateau-app`
  `npm test` and `we:` `check:standards` pass.
