---
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["3108"]
relatedTo: ["3576", "3562", "3305"]
scope: ["we:scripts/conveyor/scope-staleness-watch.mjs", "we:scripts/conveyor/__tests__/scope-staleness-watch.test.mjs", "we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-07"
tags: [conveyor, staleness, readiness, prepare]
---

# A standing mechanical pass periodically re-verifies queued/prepared items' scope against current repo reality

Operator finding, 2026-09-04/07: once we:backlog/3576 and we:backlog/3562 close the reactive "unshaped-no-scope"
gap by proactively preparing items, a SECOND distinct risk remains — a prepared/queued item's own declared
scope can go stale as the codebase moves under it (the same night, #3174's own card carried scope line-numbers
already drifted by re-verification time). we:backlog/3108-story-preparation-gets-its-own-staleness-signature-prepareda.md
designs the exact mechanical primitive (`preparedAgainstSha` + `checkPrepStaleness`) but ships it as a
standalone CLI, never a standing watch. This item is that missing standing half — see *Why this is a new
item* below for how it avoids duplicating #3108/#3305/#3576/#3562/the live `blockedBy` stale-block guard.

## Why this is a new item, not an edit to #3576/#3562/#3108/#3305

- **#3576 and #3562 are "should this get prepared" — this is "once prepared, is it still accurate."**
  Re-read both in full before filing this. Their own stated purpose is proactively dispatching
  `prepare-scope`/`prepare-decision` for high-leverage items that are NOT YET prepared — a one-shot push at
  first-preparation time. Neither re-examines an item that is already `preparedDate`-stamped and sitting in
  the queue; nothing revisits it as the tree moves under it. That is a distinct failure mode and this item's
  whole job.
- **#3108 designs the exact check this needs, but deliberately stops short of running it.** Its own "Delivery
  shape" and "Tasks" sections build `preparedAgainstSha` (the stamp) and `we:scripts/readiness/prep-staleness.mjs`'s
  `checkPrepStaleness` (the diff), then say in design point 3: *"Standalone CLI first, not auto-wired into the
  readiness dispatcher... wiring `we:scripts/readiness/dispatch-plan.mjs` to refuse launch on a
  stale-and-unchecked prep is a natural fast-follow, explicitly NOT bundled here."* Nobody had filed that
  fast-follow. This item is it — though as a WARN-surfacing watch pass, not a launch-refusing gate, per #3108's
  own explicit guidance (see *Design* below).
- **#3305 covers a different, narrower drift signal, already continuously.** #3305 is a `check:standards`
  content-lint rule (unbuilt) that flags a `path:line` citation beside a quoted token when the cited line no
  longer holds that token — the exact shape of the #3174 anecdote's line-number drift. Once built it runs
  corpus-wide on every `check:standards` invocation (`we:scripts/check-standards.mjs` scans ALL of
  `backlog/*.md` every run — verified live, `readdirSync(join(ROOT,'backlog'))` at four call sites), which is
  effectively continuous given how often the gate runs in this repo's own delivery loop. So citation-token
  drift is ALREADY a "periodic recheck" once #3305 ships — this item does not re-cover it. What #3305 cannot
  see is whether a story's declared `scope:` FILES themselves have moved/changed since prep — a coarser, cheaper
  signal `checkPrepStaleness` already computes and this item's only job is to run on a schedule.
- **`blockedBy` target-resolved staleness is already live today, no gap.** `we:scripts/check-standards.mjs`
  (~:873-879) already warns when a non-resolved item's `blockedBy` targets are ALL resolved (the "stale-block
  guard" #1231 swept the historical backlog against, still active) — corpus-wide, every run. Not re-filed here.
- **The scope-path-typo check (#3337, live in `we:scripts/check-standards-rules.mjs`'s `scopeBasenameMismatches`)
  is adjacent but deliberately narrower than what this item needs.** It only flags a `scope:` entry whose exact
  path doesn't resolve BUT whose basename exists elsewhere (a typo/moved-file shape) — it is deliberately
  SILENT when a path resolves to nothing anywhere, because that is indistinguishable from a legitimate
  not-yet-created file at author time. This item's population (already-`preparedDate`-stamped, already-queued
  items) does not have that ambiguity the same way — by the time an item is queued its scope files should
  already exist — but this item reuses `checkPrepStaleness`'s git-diff signal rather than re-deriving a second
  existence check; see the *Open fork* below on how far to push this.

## Design

1. **A new standing mechanical pass — `we:scripts/conveyor/scope-staleness-watch.mjs`** — built to the SAME
   pure-core/IO-shell template as `we:scripts/conveyor/duplicate-pr-watch.mjs` /
   `we:scripts/conveyor/parked-pr-conflict-watch.mjs`, wired into `we:skills-src/conveyor/runner.mjs`'s
   `makeCliMechanicalPasses` beside them — no new cron/daemon. Each tick:
   - Walk every OPEN backlog item carrying both a non-empty `scope:` and a `preparedAgainstSha` (from #3108;
     items without the stamp are silently skipped — additive only, matching #3108's own "no retroactive
     migration" rule).
   - Call `checkPrepStaleness({ scope, preparedAgainstSha })` (`we:scripts/readiness/prep-staleness.mjs`,
     reused directly, not re-implemented) for each.
   - For any `stale: true` result, surface a finding naming the item and its `changedFiles` — see *Open fork*
     for where.
2. **WARN/surface only — never auto-refuse dispatch, never auto-re-prepare.** Matches #3108's own explicit
   guidance ("a false-stale... blocking a real, still-correct build would be the same false-deny shape #2997's
   Gap 1 round 1 shipped and had to walk back") and the "alert, don't auto-resolve content decisions" doctrine
   the two structural templates already document in their own headers. A human or a dispatched fix decides
   what to do with a stale flag; this pass never decides FOR them.
3. **Config knobs, following #3562/#3576's exact convention:** an enable/disable env var
   (`WE_SCOPE_STALENESS_WATCH_DISABLED`, presence-checked, mirroring `WE_DECISION_DOCKET_WATCH_DISABLED` /
   `WE_SCOPE_PREP_DOCKET_WATCH_DISABLED`) checked first in the pass's own entrypoint.

## Open fork — flagged, not decided silently: where do findings surface?

The two structural templates (`we:scripts/conveyor/duplicate-pr-watch.mjs`,
`we:scripts/conveyor/parked-pr-conflict-watch.mjs`) both operate on OPEN PRs and surface findings as a `gh`
label/comment on that PR. This pass's target population — already-queued, already-prepared BACKLOG ITEMS —
has no open PR yet in the common case (prep happens before a build lane is even dispatched), so there is
nothing to label. Whoever claims this item must pick a real surface and record why, rather than silently
borrowing the templates' PR-comment shape where it does not apply. Realistic options, with a bold default:

- **(a) A refreshed report file under `we:reports/`** (e.g. one row per stale item, rewritten each tick) —
  cheapest, matches the existing `--dry-run` report-first shape #3562/#3576 already use for their own smoke
  mode, and needs no new artifact/board machinery. **Bold default: start here.**
- **(b) A note spliced into the item's own `backlog/<NNN>.md` body** — highest-visibility (a claiming agent
  sees it without a separate lookup) but mutates a file this pass does not own, and needs its own idempotent
  splice/update contract (write-once, refresh-in-place) to avoid duplicate notes piling up across ticks.
- **(c) Piggyback onto an existing board/status-artifact surface** (`we:scripts/conveyor/status-artifact.mjs`,
  or the emerging Decision Board / queue-view family #3562/#3576/#3595 already feed) — most consistent with
  where this repo is already centralizing conveyor-observability, but couples this item to whichever of those
  surfaces is furthest along, which today is none of them (all confirmed unbuilt in this same research pass).

Option (a) is the bold default because it needs nothing else to land first and gives a human something to
read immediately; (b) or (c) are legitimate fast-follows once a real consumer wants item-embedded or
board-embedded visibility instead of a standalone report.

## Open fork — flagged, not decided silently: how deep does the check go?

`checkPrepStaleness` (#3108) answers ONE question: has ANY file in the item's declared `scope:` changed at
all since `preparedAgainstSha` (a file-level git diff, presence-only — no content-level judgment). This item
inherits that shape as its bold default (cheapest, already fully designed by #3108, matches #3108's own
"PRESENCE only, never SEVERITY" rule). A deeper, content-aware version — did the SPECIFIC fact/line the prep
actually relied on move, versus an unrelated formatting change to the same file — is explicitly NOT this
item's job: that is #3305's citation-drift shape, generalized to a schedule, and is real follow-on work
if file-level presence proves too noisy in practice (mirroring #3108's own "if it is still at 0 firings...
the honest move is to fold it in or delete the branch" self-correction discipline for its resolve-time
sibling #2803).

## Done when

1. **Executable** — `node we:scripts/conveyor/scope-staleness-watch.mjs --dry-run` fails before this item
   lands (file doesn't exist) and, after, reports every open, prepared (`preparedAgainstSha`-stamped) item
   whose declared `scope:` files have changed since prep, without writing/labeling/dispatching anything.
2. **Executable** — `we:scripts/conveyor/__tests__/scope-staleness-watch.test.mjs` covers: a stamped item
   whose scope files are unchanged produces no finding; a stamped item whose scope files changed produces
   exactly one finding naming the real `changedFiles` (via `checkPrepStaleness`, reused — not re-implemented);
   an item with no `preparedAgainstSha` is silently skipped (not an error, not a finding); an item with no
   `scope:` is silently skipped.
3. Wired into `we:skills-src/conveyor/runner.mjs`'s `makeCliMechanicalPasses` — confirmed by a smoke check
   that the pass is present in that list.
4. The chosen findings-surface (per the first *Open fork* above) is implemented and covered by a test
   asserting a finding actually reaches it — not just that the pure core computes one.
5. `WE_SCOPE_STALENESS_WATCH_DISABLED` set to any value makes the pass's entrypoint a no-op (no scan, no
   surface write) — covered by a test.
6. `npm run check:standards` shows no new errors and no new warnings against the baseline at build time.

## Grounding

- `we:backlog/3108-story-preparation-gets-its-own-staleness-signature-prepareda.md` — the un-built primitive
  this item schedules: `preparedAgainstSha` + `we:scripts/readiness/prep-staleness.mjs`'s `checkPrepStaleness`.
  Confirmed unbuilt (`we:scripts/readiness/prep-staleness.mjs` not found on disk; no PR/branch for `x8t2w4w`/
  `#3108` beyond its own independent-review commit).
- `we:backlog/3305-a-backlog-card-cites-a-path-line-and-the-cited-line-no-longe.md` — the citation-drift sibling
  this item deliberately does not duplicate. Confirmed unbuilt (no citation-check hits in
  `we:scripts/check-standards-rules.mjs`; only its own JIT-numbering commit in `git log --all`).
- `we:scripts/check-standards.mjs:873-879` — the live `blockedBy`-all-resolved stale-block guard; not
  re-covered here.
- `we:scripts/check-standards-rules.mjs`'s `scopeBasenameMismatches` (#3337) — the live, deliberately-narrow
  scope-path-typo check; adjacent, not re-covered here.
- `we:scripts/conveyor/duplicate-pr-watch.mjs`, `we:scripts/conveyor/parked-pr-conflict-watch.mjs` — the
  structural templates (pure-core/IO-shell split, `makeCliMechanicalPasses` wiring, alert-don't-auto-resolve
  doctrine).
- `we:backlog/3576-generalize-the-leverage-ranked-auto-prepare-docket-pass-beyo.md`,
  `we:backlog/3562-a-standing-mechanical-pass-keeps-the-5-highest-leverage-open.md` — confirmed unbuilt (no
  `we:scripts/conveyor/scope-prep-docket-watch.mjs`/`we:scripts/conveyor/decision-docket-watch.mjs` on disk, no
  PR/branch for either `bornAs`), and the
  proactive-preparation siblings this item's re-verification concern is distinct from.
- `we:backlog/1231-sweep-the-stale-blockedby-edges-items-marked-blocked-whose-b.md` (resolved) — historical
  confirmation the `blockedBy` stale-block guard already existed and was already swept once.
