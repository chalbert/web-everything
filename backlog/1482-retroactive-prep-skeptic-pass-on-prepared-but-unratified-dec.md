---
kind: task
status: open
dateOpened: "2026-06-21"
tags: []
---

# Retroactive prep-skeptic pass on prepared-but-unratified decisions

The prep-time skeptic sub-agent pass (`we:docs/agent/backlog-workflow.md` → *Red-team the default* → "the skeptic's primary seat is prep"; the `prepare-decision-item` skill, pass 4) was added **after** #1450 / #1457 / #1467 / #1469 were already prepared. Their fork defaults therefore carry **no `Skeptic:` line** and were never adversarially attacked at prep — only flagged ("flag for the skeptic"), which deferred the attack to the decision turn.

**Do:** run a throwaway refute-only skeptic sub-agent on each open `## Fork N` of these four items, fold the verdict in (`REFUTED` → flip the default + rewrite rationale; `SURVIVES` / `SURVIVES-WITH-AMENDMENT` → record what it beat / amend), and stamp each fork with a closing `Skeptic:` line so the eventual decision turn sees an already-attacked default rather than a raw assertion. No ratification — this is a prep-remediation pass, not a decision.

**Scope:** #1450, #1457, #1469 (status `active`), #1467 (status `open`). Resolved prepared decisions are already ruled (out of scope); #1437 was handled live (its skeptic ran at the decision turn).

**Why:** surfaced when #1437's prep-deferred skeptic let the decision turn wobble Fork 2 the *wrong* way (a bad discussion-born flip on the serialized-layout-tree protocol timing) — only the ratify-time skeptic recovered the prepared default. Front-loading the attack into prep is the fix; this item back-fills the four already prepared without it.
