---
kind: task
status: open
dateOpened: "2026-07-28"
tags: []
---

# Stamp backlog dates in the operator's local timezone, not the runtime's UTC clock

Backlog date-stamping reads the AI runtime's UTC clock, so `dateOpened` / `dateStarted` / `dateResolved` / `preparedDate` land a calendar day ahead when the operator is in a UTC-behind timezone (still "today" locally, already tomorrow in UTC). Derive the date-only stamp from a configured operator-local timezone (a `TZ` env or a small date helper) instead of raw `new Date().toISOString().slice(0, 10)`.

## The failure

The date-only stamp comes from the runtime's UTC clock. When the operator sits in a UTC-behind timezone, there is a window each evening where it is still "today" for them but already "tomorrow" in UTC. Every date stamped in that window lands one calendar day ahead of the operator's real local date.

This is not hypothetical — it reproduced while filing this very item. Today is **2026-07-27** in the operator's local timezone, yet the scaffold stamped this file's own frontmatter as `dateScaffolded: "2026-07-28"` and `dateOpened: "2026-07-28"` — a day ahead. Two reviewers separately flagged a `dateResolved: 2026-07-28` as a day ahead on 2026-07-27. The operator confirmed: *"the AI time is not the same as my time"* and *"timezone correct handling might just be needed here."*

## Stamping sites (the real loci)

All backlog date-only stamps funnel through one helper and one inline copy:

- `we:scripts/backlog.mjs:68` — `const today = () => new Date().toISOString().slice(0, 10);` — the shared date-only helper. Feeds `claim` (`dateStarted`, line 317), `resolve` (`dateResolved`, via `applyTransition` at line 284 → line 348), and `scaffold` (passed as `today` into `renderItem`, line 554). This is the dominant fix locus.
- `we:scripts/backlog.mjs:428` — `const today = new Date().toISOString().slice(0, 10);` inside `prepareStamp` — stamps `preparedDate`. A second inline copy of the same UTC-only pattern; fix alongside the helper.
- `we:scripts/backlog/scaffold.mjs:99` — stamps `dateOpened` / `dateScaffolded` from the `today` value passed in by `we:scripts/backlog.mjs`. Covered once the source helper is fixed, but confirm no independent `new Date()` sneaks in here.

Related date-vs-"today" comparisons that read the same UTC clock and would mis-compare against a locally-stamped date (fix for consistency, not strictly the stamp):

- `we:scripts/check-backlog-workflow.mjs:22` — `const today = new Date().toISOString().slice(0, 10);` (workflow validation).
- `we:scripts/audit-backlog-health.mjs:349` — `const TODAY = new Date().toISOString().slice(0, 10);` (born-active-orphan TTL, #670).

## Fix direction

Derive the date-only stamp from the operator's local timezone instead of raw UTC:

- Introduce one small date helper (e.g. `we:scripts/lib/local-date.mjs` exporting `localToday()`), and route the `we:scripts/backlog.mjs:68` helper, the `prepareStamp` inline copy, and the workflow/health comparisons through it.
- Resolve the zone from a configured source — a `TZ` / `BACKLOG_TZ` env var, falling back to the host's `Intl.DateTimeFormat().resolvedOptions().timeZone` — and format the calendar date in that zone (e.g. `en-CA` locale → `YYYY-MM-DD`, or `Intl.DateTimeFormat('sv-SE', { timeZone })`), rather than slicing a UTC ISO string.
- Keep timestamp fields that legitimately want an instant (the claims-ledger `nowIso: new Date().toISOString()` at `we:scripts/backlog.mjs` lines 146/310/458/487) as full UTC ISO — only the **date-only** frontmatter stamps need the local-zone treatment.

This is a straightforward fix (not a contested fork): one helper, a handful of call sites, no competing design.
