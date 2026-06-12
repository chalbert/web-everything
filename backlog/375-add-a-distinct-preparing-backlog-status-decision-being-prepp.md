---
type: idea
workItem: story
size: 3
status: open
dateOpened: "2026-06-12"
tags: [backlog-tooling, workflow, agent-coordination]
crossRef: { url: /backlog/083-agent-file-lock-coordination/, label: "Adjacent — agent claim/coordination (#083)" }
---

# Add a distinct 'preparing' backlog status (decision being prepped, not built)

When an agent runs /prepare on a decision it claims the item to `status: active` — which already stops a second agent preparing it (selection skips non-open items), so this is not new safety, it is a legibility gap: on the /backlog/ card a decision being *researched* is indistinguishable from a story mid-*build*. Add a distinct `preparing` status — shown as its own card chip, dropped from selection like active, set by the prepare skill and released to open with `preparedDate` at the end. Design note below weighs new-status vs reuse-active.

## Build

- **Status enum** — add `preparing` to the backlog status set (`scripts/check-standards-rules.mjs`, where the `checkStatus` enum lives) so the validator accepts it. Treat it as a *non-open, in-flight* state.
- **Loader (`src/_data/backlog.js`)** — `isOpen` already gates selection on `status === 'open'`, so a `preparing` item drops out of the ready pool automatically (same as `active`). Confirm readiness/tier code that branches on `active` (none currently special-cases it) also treats `preparing` as in-flight, not resolved.
- **Card (`src/backlog.njk` + status styling)** — render a distinct `preparing` chip (e.g. a "prepping" badge) so a decision being researched is visually distinct from a story mid-build.
- **Prepare skill (`.claude/skills/prepare-decision-item/SKILL.md`)** — claim to `preparing` instead of `active`; the close-out already releases to `open` + stamps `preparedDate`. Add a `backlog.mjs` verb or `--as=preparing` flag so the race-safe flip sets `preparing` (and `release` returns `preparing → open`).
- **`scripts/backlog.mjs`** — teach `claim`/`release` (or a new `prepare`/`unprepare` pair) the `preparing` state.

## Acceptance

- A decision claimed for prep reads `status: preparing`, shows a distinct card chip, and is absent from `check:readiness --select`.
- `npm run check:standards` accepts `preparing` and still errors on any other unknown status.
- Releasing a prepared item returns it to `open` with `preparedDate` intact (current behavior, re-verified).

## Design note — new status vs. reuse `active`

The collision the request worries about is **already prevented**: `claim` is race-safe and selection drops any non-`open` item, so a second agent never double-preps. So the value here is **not** safety — it is **legibility**: today `active` conflates "being built" (has a branch, code in flight) with "being researched" (a decision with no code yet), and the `/backlog/` card can't tell them apart. A dedicated `preparing` state makes the board honest about what kind of work is underway and lets a human see "3 decisions are being prepped" at a glance. The alternative — keep `active` and derive the distinction from `type: decision` + `preparedDate == null` + `status: active` — works without a schema change but leaves the card logic to infer the state rather than read it. Lean toward the explicit status; confirm before building.
