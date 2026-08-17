# Calendar-day frame agreement — stamp the frame, don't pad the threshold

**Date**: 2026-08-17
**Point**: The born-active TTL's UTC-vs-operator skew (#2985) was already fixed by #2747 — every ageing site
reads `localToday()`. What survives is a *cross-machine* frame gap (CI runs the gate in UTC), and prior art is
uniform: make the two clocks agree, never pad the staleness threshold.
**Research page**: `/research/calendar-day-frame-agreement/`

---

## Question

/backlog/2985-does-the-born-active-ttl-need-a-grace-day-for-operator-timez/ asks whether the #670 born-active
TTL needs a grace day to absorb operator timezone skew. Its three options were: add a grace day, compare in the
operator's day rather than UTC, or leave it. Two sub-questions had to be answered before any of those could be
weighed:

1. Is the item's stated premise — that the ageing side still reads UTC while the stamping side reads the
   operator's day — true of the tree as it stands?
2. When a stamped calendar day and a "today" can be produced on different machines, what do established systems
   actually do?

## Recommendation

**The premise is stale, and the item's own recommended option 2 has already shipped.** What remains is a
narrower, genuinely open call: the gate also runs on machines that are *not* the operator's (CI), and those
machines compute a different calendar day from the same instant. The fix belongs at the **frame**, never at the
**threshold** — pin the ageing clock to the frame the stamps were written in (the `BACKLOG_TZ` knob #2747
already shipped for exactly the "host clock is already wrong / UTC container" case), and leave the pinned
boundary test alone.

## Key findings

### 1. Option 2 is already shipped — the item describes the pre-#1018 tree

Every clock read that feeds the born-active TTL already goes through the operator-local helper, and all four
moved in the *same commit* — `a0f7bcfb` (2026-08-03), #2747's own resolve:

| site | what it reads |
| --- | --- |
| `we:scripts/check-standards.mjs:866` | `const today = localToday();` |
| `we:scripts/check-backlog-workflow.mjs:24` | `const today = localToday();` |
| `we:scripts/audit-backlog-health.mjs:378` | `const TODAY = localToday();` (the O1 flag) |
| `we:scripts/backlog.mjs:89` → `we:scripts/backlog/scaffold.mjs:90` | `dateScaffolded` is stamped from `localToday()` |

So on any *single* machine the stamping frame and the ageing frame are identical and the skew is exactly zero.
`git merge-base --is-ancestor a0f7bcfb 1a4054ce` confirms the fix was already on `main` when #2985's file was
added (2026-08-07) — the card was written against a reading of the tree that #1018 had already invalidated.

The item's other cost claim is false for the same reason: it says a fix "costs a shared operator-day helper
reachable from the CJS invariants file." No such helper is needed. `we:scripts/lib/workflow-invariants.cjs:26`
takes `today` as an **injected** argument and its own line-25 comment says why — *"Injected (not read from a
clock) so the rule is pure and fixture-testable."* The rule has no clock to fix. The frame is a property of the
caller, and every caller is already ESM.

### 2. What actually survives — a cross-*machine* frame gap

"The operator's day" is defined by whichever host runs the check. The repo health gate runs in CI:

- `we:.github/workflows/ci.yml:200`, `we:.github/workflows/release-please.yml:71`, and
  `we:.github/workflows/publish-contracts.yml:49` all run `npm run check:standards`.
- None of the three sets `TZ` or `BACKLOG_TZ`; GitHub-hosted runners are UTC.

So in CI `localToday()` returns the **UTC** day while every `dateScaffolded` in `backlog/` carries the
**operator's** day. For an operator at UTC−4 scaffolding after 20:00 local, CI's "today" is already tomorrow and
the TTL warns a day early. Eastward operators get the mirror image (a day late).

Severity is genuinely low, and the reason is sharper than the card's: it is not just that the check is advisory,
it is that the false warning appears **only where nobody reads it**. `we:scripts/check-standards.mjs:2232` sets
`process.exitCode = errors.length ? 1 : 0` — warnings never affect the exit code — and the invariant pushes to
`warnings`, not `errors`. The operator's own local run of the same gate is correct. There are also **zero**
born-active unsettled items in the tree today, so the check is currently inert.

### 3. Prior art is one-sided: fix the frame, not the tolerance

A web survey (MDN/TC39, IETF, git, Noda Time, GitHub docs) found a consistent model and, notably, **no**
authoritative endorsement of the grace-day approach:

- **Temporal** (`Temporal.Now.plainDateISO(timeZone)`) makes the zone an explicit argument, and MDN's own worked
  example shows one instant reading as `2021-10-01` with no argument and `2021-09-30` for `America/New_York`.
  There is no zone-free "today." Temporal reached Stage 4 in March 2026 (ES2026); Chrome/Edge 144 and Firefox
  139 ship it, Safari does not, so it is not Baseline.
- **RFC 9557** exists because a bare offset is not a zone — the offset records one instant's relation to UTC,
  but calendar reasoning needs the named zone (DST and political redefinitions move the offset).
- **Git** stores `<epoch seconds> <offset>`: the instant is canonical, the offset is a rendering hint
  (`--date=local` changes the displayed zone, never the stored seconds).
- **Noda Time** formalises the asymmetry: `Instant` → `LocalDate` is always unambiguous, `LocalDate` → `Instant`
  is not. Comparing two naked local dates from different clocks sits on the ambiguous side.
- **Grace windows:** no citable source recommends padding a staleness threshold to absorb timezone skew. The
  closest neighbours (dbt's `warn_after`/`error_after`) buffer *pipeline latency*, not day framing, and the
  standing advice is to normalise the frame. Report this as *absence of evidence*, not a prohibition.

Two corrections the survey forced on the framing I went in with:

- Temporal's docs do **not** say a bare calendar date is meaningless without a zone — `PlainDate` is a
  deliberate, valid concept for zone-independent things (birthdays, alarms). The zone becomes mandatory only
  when you ask "what is today" or cross to/from an instant. That is the narrower, correct claim.
- The GitHub contributions-graph story is **not** settled and should not be cited: GitHub's current docs say
  contributions are timestamped in UTC, while GitHub's own 2014 announcement describes per-commit
  offset-aware bucketing. Two first-party sources, unreconciled.

### 4. Why a threshold bump is the broken branch

Three independent reasons, all grounded rather than aesthetic:

1. **It does not make the clocks agree** — it makes the check tolerate *any* one-day disagreement, including the
   real second-day staleness the TTL exists to catch. The signal it removes is exactly the signal it was
   protecting.
2. **It is not even sufficient in general.** Two calendar frames can differ by **two** days, not one: at UTC+14
   it can be 2026-01-02 while at UTC−12 it is 2025-12-31. A one-day pad is a guess at the maximum skew; a frame
   pin is exact.
3. **It pays globally for a local artifact.** The laxity lands on every born-active item on every machine —
   including the operator's own, where the frames already agree and the warning is the one actually read.

It also flips a deliberately-pinned boundary: `we:scripts/__tests__/workflow-invariants.test.mjs:68-77` pins
born `2026-07-01` + today `2026-07-02` ⇒ exactly one warning, and the sibling case is labelled *"grace: its
creating day."*

### 5. The knob already exists

`we:scripts/lib/local-date.mjs:27` documents `BACKLOG_TZ` as *"an explicit IANA pin … for the operator whose
HOST clock is already wrong, typically a UTC container."* A GitHub-hosted runner **is** that host. So pinning
CI is the use the knob was designed for, not a new mechanism — and #2747 deliberately reduced the ladder to this
**one** knob on review evidence (`TZ` is POSIX, not IANA; `TZ=GMT+5` resolves to the zone `"+05:00"`, ten hours
off). Any fix that adds a second rung re-opens what #2747 closed.

## Files created/modified

| File | Action |
| --- | --- |
| `we:reports/2026-08-17-calendar-day-frame-agreement.md` | created (this report) |
| `we:src/_data/researchTopics/calendar-day-frame-agreement.json` | created (registry entry) |
| `we:src/_includes/research-descriptions/calendar-day-frame-agreement.njk` | created (write-up) |
| `we:backlog/2985-does-the-born-active-ttl-need-a-grace-day-for-operator-timez.md` | rewritten to the prepared-fork shape; `preparedDate` stamped |
