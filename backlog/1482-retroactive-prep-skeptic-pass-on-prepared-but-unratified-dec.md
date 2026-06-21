---
kind: task
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
tags: []
---

# Retroactive prep-skeptic pass on prepared-but-unratified decisions

The prep-time skeptic sub-agent pass (`we:docs/agent/backlog-workflow.md` → *Red-team the default* → "the skeptic's primary seat is prep"; the `prepare-decision-item` skill, pass 4) was added **after** #1450 / #1457 / #1467 / #1469 were already prepared. Their fork defaults therefore carry **no `Skeptic:` line** and were never adversarially attacked at prep — only flagged ("flag for the skeptic"), which deferred the attack to the decision turn.

**Do:** run a throwaway refute-only skeptic sub-agent on each open `## Fork N` of these four items, fold the verdict in (`REFUTED` → flip the default + rewrite rationale; `SURVIVES` / `SURVIVES-WITH-AMENDMENT` → record what it beat / amend), and stamp each fork with a closing `Skeptic:` line so the eventual decision turn sees an already-attacked default rather than a raw assertion. No ratification — this is a prep-remediation pass, not a decision.

**Scope:** #1450, #1457, #1469 (status `active`), #1467 (status `open`). Resolved prepared decisions are already ruled (out of scope); #1437 was handled live (its skeptic ran at the decision turn).

**Why:** surfaced when #1437's prep-deferred skeptic let the decision turn wobble Fork 2 the *wrong* way (a bad discussion-born flip on the serialized-layout-tree protocol timing) — only the ratify-time skeptic recovered the prepared default. Front-loading the attack into prep is the fix; this item back-fills the four already prepared without it.

## Resolution (batch-2026-06-21-1429-1487) — moot: all four targets resolved → out of scope

Claimed and re-checked the four targets' live status. **All four are now `status: resolved`**
(`#1450`, `#1457`, `#1469`, `#1467` — every one ratified since this item was filed). This item's own
**Scope** rule says *"resolved prepared decisions are already ruled (out of scope)"*, and its action is to
attack each **open** `## Fork N` — but there are **no open forks left** across the four. A *prep*-skeptic
is, by definition, a **pre-ratification** remediation (front-load the attack into prep so the decision
turn sees an already-attacked default); once a decision has had its ratify turn, the attack window has
closed — its ratify-time red-team already ran (the very recovery mechanism the *Why* cites). Re-attacking a
ratified decision is the separate **reopen/reversal** path (decisions are reversible — reopen re-runs the ratification gate),
not this pass.

So the item is **overtaken by events** — its entire scope evaporated as the four decisions ratified. No
forks to remediate, nothing to stamp. Resolving as obsolete (`graduatedTo: none`); the prep-skeptic
*practice* it generalizes is already codified (the `prepare-decision-item` skill pass 4 +
backlog-workflow's "skeptic's primary seat is prep"), so the durable fix persists for *future* preparations.
