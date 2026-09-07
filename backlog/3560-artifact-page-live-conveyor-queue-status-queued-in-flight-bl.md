---
bornAs: xonyel7
kind: story
size: 3
parent: "2612"
status: open
blockedBy: ["3277"]
dateOpened: "2026-09-07"
tags: []
---

# Artifact page: live conveyor queue status (queued, in-flight, blocked/parked, priority order)

A conveyor-queue-status Artifact page, consuming #3277's publish/refresh operation rather than a new publish mechanism: shows queued items with priority order, in-flight/leased items (lane, agent, elapsed), and blocked/parked items with why, refreshed by wiring a periodic publish call into the runner's tick loop.

## Why a second consumer, not a second publish path

`we:scripts/conveyor/status-artifact.mjs` already proves the pattern this page needs — read live conveyor
state, render self-contained HTML, hand it to the Artifact tool — but that generator is the *interim, whole-board*
surface (KPIs, four-stage flow, lane pool, per-epic rollup, buildable table) and is itself hand-published on a
~5-min heartbeat by whichever session is running the conveyor skill, not by a declared operation. [#3277] is
exactly the gap that closes: "publish/refreshes a decision or architecture artifact" as one declared operation
instead of a hand-driven Artifact-tool call. This item does **not** wait to reinvent that; it defines a second,
narrower **page** (content/template only — queue observability, not full conveyor health) and wires its refresh
through #3277's operation once that operation exists. `blockedBy: ["3277"]` for exactly that reason: there is
nothing to wire the periodic call into until the operation is declared.

## What state already exists to show (grounded in the live scripts, no new store)

- **Queued, in priority order** — `we:scripts/readiness/dispatch-plan.mjs --json`'s `queue` field is *already*
  rank-ordered (highest-priority first, via `we:scripts/lib/build-queue.mjs`'s `orderQueueDetailed`); its `launch`
  array is the subset assigned a free lane this tick, also in rank order. `we:scripts/conveyor/queue-store.mjs`'s
  `we:.conveyor/queue.json` sidecar is the underlying "cleared for build" set (`{num, addedAt}`) the dispatcher
  reads from, but it carries no rank of its own — the page reads the already-ranked
  `we:scripts/readiness/dispatch-plan.mjs` output, it does not re-derive rank from the sidecar.
- **In-flight / leased** — `we:scripts/conveyor/tick-core.mjs`'s in-flight dispatch guard tracks one
  `{ num, lane, spawnedTick }` entry per spawned delivery agent (session-ephemeral, never a committed store);
  `we:scripts/lane-pool.mjs status --json`'s per-lane `lease`/`leased` fields carry the holder session and can
  derive elapsed time. `we:scripts/readiness/conveyor-state.mjs --json`'s `lanes` field is the existing single
  read that already joins "which item, which lane" for the status-artifact/status-board renderers — reuse it
  rather than re-deriving from the guard bookkeeping directly.
- **Blocked / parked, and why** — `we:scripts/readiness/dispatch-plan.mjs --json`'s `held` array carries the
  reason a cleared item didn't launch (rank-order semantics documented in the script: blocked-by,
  unscoped/needs-decision, rival-pair overlap, no free lane); `we:scripts/readiness/conveyor-state.mjs --json`'s
  `clearedNotReady` and `unshaped` fields cover a cleared id that isn't a ready build-queue row and a
  scope-unshaped item respectively. "Parked" in the PR sense (`review:human` / `review:pending`) is a separate
  signal already read by `we:scripts/conveyor/status-artifact.mjs` via `gh pr list … --json labels`.
- **Recently completed (cheap to include)** — `we:scripts/conveyor/status-artifact.mjs` already computes
  `mergedToday` from `git log origin/main --since=midnight`; reuse that window rather than adding a new git-log
  query.
- **Runner-checkout correctness** — the queue sidecar and lane state are per-checkout; the page's read must
  resolve the *live* runner's checkout (`we:scripts/conveyor/resolve-runner-checkout.mjs`, the fix
  #3478/`we:scripts/conveyor/queue-work.mjs` already made for the write side) rather than assume the reading
  process's own cwd, or the page silently shows a different runner's queue.

## Scope

- The page's **content/template**: a pure render function (mirroring `we:scripts/conveyor/status-artifact.mjs`'s
  HTML-string approach) whose input is the JSON already produced by `we:scripts/readiness/dispatch-plan.mjs --json`
  + `we:scripts/readiness/conveyor-state.mjs --json` (+ lane-pool lease data for elapsed time), and whose output
  is the self-contained queue-status HTML — queued (priority-ordered), in-flight (lane, agent, elapsed),
  blocked/parked (with reason), recently-completed.
- Wiring a **periodic publish call** into the runner's tick loop (or a dedicated lightweight pass alongside it)
  that calls #3277's publish/refresh operation with this page's template, so the page republishes on its own
  cadence without an operator manually re-running the Artifact tool.
- Both light and dark theme rendering, per the artifact-design skill.

## Not in scope

- **A new publish/refresh mechanism.** This item is strictly a second consumer of #3277's operation. If #3277
  lands with a shape this page's needs don't fit, that is a finding against #3277, not license to build a
  parallel path here.
- **Push-based / real-time updates.** The queue's live state lives in a file inside the live runner's own
  checkout, not a web service, so this is necessarily "refreshed on each publish call republishes the page," not
  push-based. A later `db` capability (viewers see updates without a republish) is a plausible future
  enhancement, noted here but **not scoped into this item** — it is not a trivial add on top of a file-backed
  sidecar read.

## Forks (ratified — see Ruling below)

1. **Exact page layout.** `we:scripts/conveyor/status-artifact.mjs`'s existing five-section layout (KPI row,
   four-stage flow, lane pool, per-epic progress, buildable table) is proven and stylistically established, but
   this page's job is narrower (queue observability, not full conveyor health) — reusing that layout wholesale
   may over-render sections this page doesn't need (per-epic rollup, buildable-items table) while under-serving
   the "why is this blocked" detail an operator actually wants here. Whether to extend
   `we:scripts/conveyor/status-artifact.mjs` with a queue-focused section, add a dedicated leaner template, or
   fork the CSS/shell and write fresh sections is a real design call for the build session, not decided here.
2. **How much history to show.** `mergedToday` (`we:scripts/conveyor/status-artifact.mjs`'s existing window) is
   the obvious cheap default for "recently completed," but whether that's the right window (vs. e.g. last N
   items, or last hour) for THIS page's purpose is an open call — flagged rather than decided.

## Ruling (ratified 2026-09-07, operator)

Both forks decided by the operator; neither is an open question for the build session anymore.

- **Fork 1 → reuse `we:scripts/conveyor/status-artifact.mjs`'s existing five-section layout as-is, for now.**
  No new template, no dedicated leaner shell, no CSS/section fork — ship the proven five-section layout (KPI
  row, four-stage flow, lane pool, per-epic progress, buildable table) unchanged for the first cut of this
  page. Iterate on layout later if it under- or over-serves the queue-observability job; that iteration is
  explicitly deferred, not blocking this item.

- **Fork 2 → show the last 24h of completed items by default, plus a button to reveal/fetch more/older
  history beyond that window.** Default view is a rolling trailing-24h window (deliberately not
  `we:scripts/conveyor/status-artifact.mjs`'s `mergedToday`/since-midnight window, which varies in size by
  time of day).

  **Mechanism constraint for "fetch more" (read before building #3277/#3560):** this item deliberately does
  **not** use the Artifact `db` capability (see "Not in scope" above — that's a later-enhancement option) and
  is `blockedBy: #3277`; the page is republished fresh on each conveyor tick, not live-queried. So the "fetch
  more" button **cannot** be a live server/query call — there is no live backend for it to call. It must work
  one of two ways:
  1. **(Recommended default.)** At publish time, embed a wider bounded history window (e.g. the last 7 days of
     completed items, or the last N completed items, whichever is smaller — cap it for page size) as inline
     JSON/data in the static HTML, alongside a rendered default view limited to the trailing 24h. The button
     reveals/paginates through that already-embedded data client-side (a plain JS slice / show-hide over data
     already on the page) — no network call, no new capability, nothing further needed from #3277 beyond what
     this item already asked for. This is the mechanically clean option: it fits the file-backed,
     tick-republish model exactly as-is, at the cost of a bit more embedded HTML/JSON per publish.
  2. Widen how much history gets embedded *at the next publish* (e.g. a stored per-viewer or per-page
     preference nudges the next tick's publish to embed a wider window). Not recommended as the default: it
     doesn't let a viewer actually see more history within the page they're looking at, only after the next
     tick republishes — worse interaction than (1) for no mechanical benefit.

  Default to (1) unless #3277's actual declared operation shape makes (2) meaningfully cheaper — that would be
  a finding against this ruling, not a silent substitution.

## Placement note (2026-09-07)

This page is an interim WE-side prototype for the conveyor's own operational use, not the permanent home
for these mechanics. we:backlog/3595 tracks generalizing it (alongside we:backlog/3562's docket and
we:backlog/x7wehz2's ledger) into a real plateau-app console feature under the existing Plateau Loop epic
(we:backlog/2445/2505), per we:docs/agent/platform-decisions.md#constellation-placement. Build this page
as the operational prototype it is; don't treat it as the product-side end-state.

## Done when

1. **Executable** — TODO: the literal command depends on #3277's operation shape (not yet declared) —
   `node we:scripts/operations/run.mjs <the #3277 operation> --page=conveyor-queue-status …` once it exists.
   Until then, this item cannot be made concretely executable; #3277 is the blocker for exactly that reason.
2. A pure render function exists (vitest-covered against fixture `we:scripts/readiness/dispatch-plan.mjs`/
   `we:scripts/readiness/conveyor-state.mjs` JSON, no live git/gh calls in the test) that produces the
   queue-status HTML: queued items in priority order, in-flight items with lane/agent/elapsed, blocked/parked
   items with their reason, and the recently-completed window.
3. The page republishes on its own cadence through a call wired into the runner's tick loop (or a dedicated
   lightweight pass) that invokes #3277's declared operation — never a bespoke Artifact-tool call the operator
   drives by hand.
4. Both themes render correctly; `check:standards` passes.
