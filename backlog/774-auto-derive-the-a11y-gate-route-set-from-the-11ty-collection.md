---
type: decision
workItem: story
size: 3
status: open
blockedBy: ["770"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
tags: []
---

# Auto-derive the a11y gate route set from the 11ty collection/sitemap

Replace the hand-maintained route allowlist (#770/#771) with auto-derivation from the 11ty collection/sitemap so every published page is gated automatically. Fork 3's deferred alternative in #763 — a genuine nice-to-have that becomes more attractive once the page set is component-generated and stable (post dogfood-rework), but couples the gate to the build graph and scans churn-y in-progress pages, so it's a later enhancement, not the day-one shape.

## Open fork — surfaced 2026-06-16 (batch-2026-06-16, claimed then released)

Picked this up to build and hit a buried design fork that #763 left open (it deferred the whole alternative) and that **#793 sharpened** — #793 just established a per-route **enforce** ratchet on the hand-maintained allowlist (9 routes flipped to `enforce: true`, `/backlog/` warn-only → #805). Auto-deriving the route *set* now has to answer two coupled, non-mechanical questions before any code:

1. **Route-set scope — what does "every published page" resolve to?**
   - **A — literally every published route** (all `/blocks/{id}/`, `/intents/{id}/`, ~790 `/backlog/{n}/`, …). Matches the item's wording and is maximally self-maintaining, but runs axe over *hundreds* of pages every CI run (minutes of wall-clock) and scans churn-y in-progress detail pages — the exact cost #763's body flagged.
   - **B — auto-discover the catalog *index* surfaces only** (the class the current 10-route list holds: `/`, `/intents/`, `/blocks/`, …), derived from the 11ty collections so a *new* index surface is gated without a hand-edit, but detail pages stay out. Fast, stable, but narrower than "every page."
   - *(Leaning B as the most-flexible-yet-practical default — auto-discovery removes the hand-maintenance seam #774 targets without the all-pages CI blow-up — but this is a real end-state choice, not a default to set silently.)*

2. **Derivation mechanism — there is no sitemap** (`/sitemap.xml` 404s; none authored). So this also decides the source: enumerate the built `_site/**/index.html`, author a `sitemap.njk` and parse it, or reconstruct permalinks from the `_data` collections. Each couples the test to a different artifact.

3. **Enforce reconciliation:** auto-derivation must preserve #793's earned per-route enforce posture — the obvious shape is *auto-derived set defaults warn-only + an explicit `ENFORCED_ROUTES` override seeded with #793's 9* (most-permissive default, #763 Fork 2 A), but it needs ratifying alongside the scope call.

**Needs a `/decision` (or `/prepare`) pass** to settle scope (1) + mechanism (2); then it's a clean build. Released back to `open` from batch-2026-06-16 rather than ratifying these by fiat.
