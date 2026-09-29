---
kind: task
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/backlog.mjs", "we:scripts/readiness/engine.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Harden needs-prepare preparedDate validation: calendar-aware, Date-object-safe, one shared isPreparedDate() helper

Card #4470's needs-prepare gate checks preparedDate with a bare /^\d{4}-\d{2}-\d{2}$/ regex. A converge round-2 panel (correctness/security/standards-conformance) found three related gaps: (1) an impossible calendar date like 2026-13-45 still reads as truthful; (2) if a backlog frontmatter loader ever parses an unquoted preparedDate into a real Date object rather than a string, a genuinely prepared card would fail the typeof-string check and hold needs-prepare indefinitely (the codebase's own we:backlog.mjs prepare-stamp writer always double-quotes the date, so this is currently only a theoretical loader-behavior risk, not an observed bug); (3) the same shape check is duplicated in spirit across we:backlog.mjs prepare-stamp, we:readiness/engine.mjs's own prepared derivation, and we:readiness/dispatch-plan.mjs's gate, asserted equivalent only in comments, never structurally. Fix: extract one shared isPreparedDate(value) helper (calendar-aware — reject an impossible day/month, not just the digit shape; accept a real Date by normalizing to its ISO date) and have all three call sites use it. Done when: a card with preparedDate: 2026-13-45 (or 2026-02-30) is held needs-prepare same as an absent one; a Date-typed value normalizes and is accepted when calendar-valid; the three call sites share the one helper (grep shows no second inline copy of the format check).

## Done when

1. **Executable** — a unit test feeding `preparedDate: "2026-13-45"` (and `"2026-02-30"`) through the shared
   validator/gate fails before this item lands (the bare digit-shape regex accepts it) and holds `needs-prepare`
   after.
2. A `Date`-typed `preparedDate` value that is calendar-valid is accepted (normalized to its ISO date), not held
   `needs-prepare` for being the wrong JS type.
3. `grep -rn "YYYY-MM-DD\|\\\\d{4}-\\\\d{2}-\\\\d{2}"` across `we:scripts/backlog.mjs`, `we:scripts/readiness/engine.mjs`
   and `we:scripts/readiness/dispatch-plan.mjs` shows ONE shared helper, not three independent inline checks.
