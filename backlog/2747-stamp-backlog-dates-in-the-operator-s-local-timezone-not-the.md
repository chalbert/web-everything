---
bornAs: x89thql
kind: task
status: resolved
dateOpened: "2026-07-28"
dateStarted: "2026-08-03"
dateResolved: "2026-08-03"
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

## Resolution — one deliberate deviation from the fix direction above

Shipped as `we:scripts/lib/local-date.mjs` (`localToday()` / `localDateString(date)`), routed through
`we:scripts/backlog.mjs`'s `today()` + `prepareStamp`, `we:scripts/check-backlog-workflow.mjs`,
`we:scripts/audit-backlog-health.mjs` and `we:scripts/check-standards.mjs`.

The "fix direction" bullet above proposed a `BACKLOG_TZ → TZ → host zone` ladder. **The `TZ` rung was
dropped**, on review evidence: `TZ` is a POSIX variable, not an IANA zone name, so looking it up as one
DIVERGES from the process's own local time for the offset spellings. With `TZ=GMT+5` (POSIX: UTC−5),
`Intl.DateTimeFormat().resolvedOptions().timeZone` normalises to the zone `"+05:00"` (UTC+5) — feeding
that name back stamps a day computed 10 hours from real local time, re-creating this item's own bug with
the sign flipped. `TZ=UTC+8` / `TZ=EST5` resolve to no zone name at all. Formatting with **no** `timeZone`
option uses Node's own local resolution and matched `Date` in every case, so that is what the helper does.
`TZ` is still honoured — by Node, one layer down. `BACKLOG_TZ` remains as the explicit IANA pin for a host
whose clock is already wrong (a UTC container), and an invalid pin now **throws** instead of being
silently ignored.

Enforcement: `we:scripts/lib/utc-day-slice-scan.mjs`, run from `check:standards`, fails any
`.toISOString()`-into-a-day slice left in `scripts/**` — the rule is a gate, not a docblock paragraph. The
remaining `.mjs` copies of the idiom were converted at the same time.
