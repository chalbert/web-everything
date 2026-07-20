---
bornAs: xodf5cq
kind: epic
parent: "2505"
status: open
dateOpened: "2026-07-18"
relatedReport: reports/2026-07-20-slice-2565-console-ruling-surface.md
tags: [plateau-loop, console, decision-surface, rule-interface, mock-before-build, sliced]
---

# Console decision-ratify surface — the visual rule interface

A dedicated in-console surface for **ruling prepared decisions** — the fuller realization of the "open the
decision from a lane, never ratify inline" affordance listed under [#2555]'s Operator-actions slice. Captured
from a working ruling-console mock built to rule the four console decisions ([#2561]/[#2557]/[#2558]/[#2554],
2026-07-18) — it "has strong bones for a soon-coming rule interface" (Nicolas). This item preserves that mock
as the **mock-before-build UI-design seed** (design doc §6c) and records what's strong to keep and what's
missing to make it a real rule interface (not just a static explainer). **Candidate — refine/split before
build.**

## The seed (mock-before-build UI-design input)
- Tracked mock: [we:docs/design/mocks/console-ruling-surface.html](docs/design/mocks/console-ruling-surface.html)
  — a self-contained, both-theme HTML ruling console (the decision-explainer-as-ruling-channel form, ratified
  design doc §6).
- Published artifact (same content): https://claude.ai/code/artifact/02e9ffd7-11bc-4f06-8e71-028b188b1ff5

## Strong bones (keep)
- **The fork card** as the unit: question → Option A / Option B panes → recommended badge → the surviving
  counter-argument (skeptic verdict) → downstream implication. One scannable card per fork.
- **Product color-grammar echoed** (green delivered · teal leverage · purple waits-on · amber needs-a-human ·
  red failure) so the ruling surface speaks the same language it rules.
- Summary strip (decisions / forks / prep-PRs / self-ruled=0), sticky per-decision nav, both-theme token shell,
  no-horizontal-scroll responsive panes.
- Honest provenance framing: skeptic-attacked defaults vs lighter grammar-derived picks are visibly distinct.

## Gaps to build (what makes it a *rule interface*, not an explainer)
- **Live data** — pull prepared decisions + their forks/defaults/`Skeptic:`/`Screen:` lines from the backlog
  read port ([#2558]), not hardcoded HTML.
- **The ruling action** — record a per-fork verdict (accept-default / override-with-X / defer) and write it via
  the lane→PR **write port** ([#2558]): `resolve --codified-to` on ratify, capturing the operator's override.
- **Governance guardrails** (design doc §3g-T2): a decision **opens** here, is never ratified in a biased
  launch frame; **statute-touching** decisions can't be ruled from a launch context (route to the policy menu);
  per-launch waivers are scoped + logged + auto-expiring.
- **Override capture** — a first-class "override" path that records the human's alternative, not just
  accept/reject of the recommendation.
- **Deep-links** — each fork's evidence (prep PR, `/research/` topic, the prepared item, the skeptic/screen
  verdicts) is one click away (research rule R5: evidence cited, not asserted).

## Relations (not hard blockers)
- Consumes/extends [#2555] Operator-actions "decision surface" (open-from-a-lane) — this is its dedicated,
  full-page sibling.
- Renders per the visual grammar ([#2554]) and writes via the adapter seam ([#2558]) — hence `blockedBy` both.
- Whatever [#2554] rules folds into the taxonomy/grammar the surface renders; the spec home is [#2553].

## Sliced into (2026-07-20)
This candidate is now shaped — it is a **sliced epic**, no longer a size-8 story. The "gaps to build" above
map onto three independently-deliverable stories (read-half stands alone; write-half builds on it; governance
gates the write):

- **[#2580] Render the ruling surface from the live read port** (size 8) — kills the hardcoded mock;
  renders live prepared decisions + forks through the [#2558] read port; evidence deep-links per fork. The
  read-only half.
- **[#2581] Rule a fork through the write port with first-class override** (size 5, after `#2580`) —
  accept-default / override / defer, written via the [#2558] write port (`resolve --codified-to` on a
  lane→PR); override captures the operator's alternative.
- **[#2582] Governance guardrails (§3g-T2)** (size 3, after `#2581`) — open-not-ratify-inline,
  statute-touching → policy menu, scoped/logged/auto-expiring per-launch waivers.

Rationale + what was deliberately *not* split: [we:reports/2026-07-20-slice-2565-console-ruling-surface.md](reports/2026-07-20-slice-2565-console-ruling-surface.md) (exposed via `relatedReport`).

## Acceptance (epic)
All three child stories resolve: the surface renders live decisions from the [#2558] read port with evidence
deep-links, a real ruling writes a verdict (incl. a first-class override) through the [#2558] write port, and
the §3g-T2 governance guardrails fence where/whether a decision may be ruled. The seed mock remains the cited
UI-design input (design-record §6c).
