---
bornAs: xr8m6gs
kind: story
locus: plateau-app
size: 5
tier: pinned
status: resolved
scope: ["plateau-app:src/wip/types.ts", "plateau-app:src/wip/wip-read.ts", "plateau-app:src/wip/wip-model.ts", "plateau-app:src/wip/wip-view.ts", "plateau-app:src/wip/wip-view.css", "plateau-app:src/wip/wip-source.ts", "plateau-app:src/wip/wip-live.ts", "plateau-app:src/wip/progress-read.ts", "plateau-app:src/wip/progress-read.test.ts", "plateau-app:src/wip/wip-model.test.ts", "plateau-app:src/wip/wip-view.test.ts", "plateau-app:src/wip/wip-source.test.ts", "plateau-app:src/wip/wip-publish.ts", "plateau-app:src/wip/wip-publish.test.ts", "plateau-app:src/wip/wip-api.ts", "plateau-app:src/wip/wip-read.test.ts", "plateau-app:src/wip/wip-view.hostile.test.ts", "plateau-app:tools/drain-daemon/cli.mjs", "plateau-app:src/wip/wip-relay-contract.test.ts", "plateau-app:scripts/wip-publish.ts", "plateau-app:wip-relay.js"]
dateOpened: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "3762fa95fd94c655c8196cd047c820f3f09f4b67"
blockedBy: ["4756"]
dateResolved: "2026-10-01"
graduatedTo: "https://github.com/chalbert/plateau-app/pull/189"
tags: []
---

# Ship a progress-first Plateau overview that replaces the manual plan scoreboard

Automatically show what is moving, observed landings today, a short trend and current priorities before machine-owned blockers. This is the smallest useful replacement for the hand-maintained plan scoreboard; full design: we:docs/agent/plateau-progress-view.md.

## Split per ruling #4289 (2026-09-30)

The WE contract half (schema 2, examples, validation test) moved to its own card, 4756, which lands first; this card keeps only its plateau-app scope and waits on it. Re-prepare against the landed contract revision before building; keep every existing consumer, relay and compatibility proof here.

## Premise check (2026-09-30, against WE `3762fa95f` and plateau-app `1888d29`)

Still open and unbuilt. `we:contracts/plateau-progress-view.{schema,examples}.json` and `plateau-app:src/wip/progress-read.ts` do not exist. `WipSnapshot` is still `schema: 1` (`plateau-app:src/wip/types.ts:184`) and the relay and client both reject anything else (`plateau-app:wip-relay.js:211`, `plateau-app:src/wip/wip-source.ts:isSnapshot`). Nothing in `git log` for #4620 or `4620` has landed code. Decision #4619 is resolved, and its recorded fork 1 is not needed here: this slice reads only local caches (option A), so it ships without the budgeted shared producer. Fork 2 is also not blocking: slice 1 uses the external plan read-only with conflict warnings (option A), as the design doc says.

## Design

Follow we:docs/agent/plateau-progress-view.md. WE owns the declarative wire contract and examples; Plateau owns adapters, aggregation, relay and UI. Keep the existing publisher/relay, 120-second baseline (`PUBLISH_EVERY_MS`, `plateau-app:src/wip/wip-source.ts`), source ages and explicit unknown/partial states. No display-driven GitHub calls. One plain description per row, fully wrapped, never ellipsis. System-owned failures remain flow state.

Mechanism, in build order:

1. **Contract first (WE).** `we:contracts/plateau-progress-view.schema.json` (JSON Schema for schema 2, slice-1 subset of the design's envelope: `snapshotId`, `publisherId`, `sequence`, `observedAt`, `timeZone`, `coverage`, `sources`, `summary`, `runs`, `holds`, `actions`, `policy`, plus `deliveries` limited to observed drain merges) and `we:contracts/plateau-progress-view.examples.json` (named fixtures: partial drain history, stale PR cache, missing trend baseline, conflicting plan sections, cold history, pending-review/red-CI with no human action). Every source carries `{observedAt, lastSuccessAt, expectedEveryMs, staleAfterMs, status, complete, reason}`; null means unknown, zero means observed none.
2. **Consumers before publisher.** `plateau-app:wip-relay.js` validation (today a hard `schema must be 1` at :211) accepts schema 1 and 2, rejects unknown majors, and rejects older `sequence` values from the same `publisherId`. `plateau-app:src/wip/wip-source.ts` `isSnapshot` and `plateau-app:src/wip/types.ts` accept both; a schema-1 snapshot projects the new sections as unknown, never zero. Deploy relay and client before the publisher emits schema 2.
3. **New adapter `plateau-app:src/wip/progress-read.ts`.** Pure, injectable-IO readers, each wrapped by `attempt()` in `plateau-app:src/wip/wip-read.ts` so one failure degrades only its section:
   - *moving*: count logical work (distinct card/`logicalWorkId`) and jobs separately from the existing `runningNow` rows (`plateau-app:src/wip/wip-read.ts` `readRunningNow`); units are never summed.
   - *landed*: read drain pass history rows (`readHistoryTail`/`readFullHistory` in `plateau-app:tools/drain-daemon/cli.mjs` are NOT exported — that file is a top-level script — and the `status --json` tail Plateau shells today holds only `STALL_CRIT_PASSES+10` rows, too few to reach Toronto midnight; so add a small read-only `history --json --since=<iso>` command to that same drain-daemon CLI reusing `readFullHistory`, which stitches the live file plus ONE archive generation, so coverage is bounded by rotation and the adapter compares the oldest returned row's `at` with the window start to decide `collecting history`/partial; rows carry `at`, `merged`, `mergedPrs` numbers but no repo — `plateau-app:tools/drain-daemon/lib.mjs:373`). Count confirmed local-drain merges between America/Toronto midnight and now (DST-aware), plus trailing 60 min vs the preceding 60 min. Rows have no repo, so they are NEVER turned into repo/PR-keyed deliveries; the tally is labelled "observed by local drain" with `complete:false` coverage. Session completions and card resolutions are not merges.
   - *trend baseline*: derived only from the same history window; if the window does not cover the preceding hour (cold start, rotation, gap) the comparison is `collecting history`, not zero.
   - *PR state*: read persisted snapshots through `we:scripts/lib/pr-snapshot-store.mjs` (`readSnapshotFile`/`snapshotPath`) only; never `readSharedOpenPrs`, which refreshes through GitHub when stale (`we:scripts/lib/pr-snapshot.mjs`, TTL 75s). A missing/old file yields `unknown` with its age.
   - *policy*: read the external operator plan (host file, mtime/hash-cached), extract operator-designated sections verbatim with source date; when the older Standing-rules/Overnight text and the newer limits disagree, emit both with a `conflict` warning and no precedence. Never present a limit as actual runtime state.
4. **Classification (`plateau-app:src/wip/wip-model.ts`).** Extend `buildWipSnapshot` so `actions` holds only explicit human review, ready decision forks (existing `plateau-app:src/wip/decision-forks-source.ts`, links preserved) and human-only escalation. Pending review, red CI and bookkeeping stay in Flow (the existing groups). Precedence follows the design's primaryWait rule.
5. **View (`plateau-app:src/wip/wip-view.ts` and `plateau-app:src/wip/wip-view.css`).** Order: Progress header, Moving, Landed (with trend and provenance/coverage line), Policy, Needs you, then Flow behind disclosure (compose the existing disclosure traits, don't hand-roll). Descriptions use `overflow-wrap`, no `text-overflow`/`line-clamp`. Every count prints its unit and source age; cold history says "collecting history"; partial merge coverage never says "all repos".
6. **Publisher.** `plateau-app:scripts/wip-publish.ts` assembles the new sections from the same single collector used by the dev API; stays single-flight, 120 s.

## MVP

Musts only:

- Schema 2 + declarative examples in WE, first.
- Relay/client accept schema 1+2, `sequence` ordering, schema-1 → unknown projection.
- Moving (logical-work and jobs counts), Landed today (local-drain tally, trailing-hour comparison, provenance, partial coverage), policy priorities/rules read-only with date and conflict warnings.
- Needs-you narrowed to the two human sources that exist today: `review:human` PRs and ready decision forks (there is no producer for a separate human-only escalation, so that kind is out until one exists); pending review/red CI/bookkeeping in Flow; existing fork links intact. The hard-coded "edits the gate rules" text for `review:human` (`plateau-app:src/wip/wip-model.ts:222`) is replaced by an explicit-reason line.
- Full-text descriptions: remove the 200-char `…` title clip (`plateau-app:src/wip/wip-model.ts:157-158`) and the `line-clamp`/`overflow:hidden` rules on description selectors (`plateau-app:src/wip/wip-view.css:45,113,146-147`), for both new rows and Flow rows.
- Schema 2 keeps the `items` array so the existing `isSnapshot` guard and Flow rendering keep working.
- Relay keeps the latest `sequence` per `publisherId` in Durable Object memory only; it resets on eviction, which is acceptable because a new boot always starts a fresh sequence and the source ages stay authoritative.
- The collector's existing `gh pr list` and merged-sweep reads are kept unchanged; this slice adds no new GitHub call.
- PR data from persisted snapshots only; missing is unknown.
- View order and 320/390 px full-text wrapping.

Deliberately OUT (see Follow-ups): per-PR delivery records and kinds, repo-keyed merge dedup, seven-day/durable history store, executor/model projection and standalone Codex/agy runs, every-open-PR list, health/GitHub-budget/overnight panels, structured policy document, cached paging. The trailing-hour trend is computed from drain history already on disk; no new persistent store is added.

## Done when

1. Fixture-backed rendering places Progress, Moving and Landed before Flow/Needs you; a pending-review/red-CI fixture produces no human action without escalation.
2. Every first-screen count has explicit units and source freshness; cold history says collecting history, and incomplete merge coverage never says all repos complete.
3. The plan projection is read-only and source-labelled; no copied limit is asserted as actual runtime state.
4. At 320px and 390px descriptions wrap in full with no ellipsis or line-clamp; existing decision links work.

## Test plan

Each case is written test-first and fails red before the change for the stated reason:

- `we` contract: examples validate against the schema; a deliberately bad example (negative count, unknown major, missing source freshness) is rejected. RED: neither file exists.
- `plateau-app:src/wip/wip-relay-contract.test.ts`: relay accepts a schema-2 fixture (RED: `schema must be 1`); rejects unknown major; rejects a lower `sequence` from the same `publisherId` while accepting a new publisher boot; still accepts schema 1; a schema-2 payload over the 900,000-byte bound is rejected. Assert exact status and message, not just "rejects".
- `plateau-app:src/wip/progress-read.test.ts` (pure, fixture IO):
  - drain history with rows lacking repo → tally present, `complete:false`, zero repo-keyed deliveries (RED: adapter absent).
  - ET midnight and DST-change day boundaries bucket merges into the right day.
  - trailing-hour vs preceding-hour; history not covering the prior hour → `collecting history`, not 0%.
  - a session-completion/resolved-card row is not counted as a merge.
  - stale or missing PR snapshot file → `unknown` with age; a spy proves `readSharedOpenPrs` and `gh` are never invoked.
  - two plan sections with different limits → both emitted with a conflict warning and no chosen winner; a limit is never placed in a runtime-state field.
  - unknown enum/run state is retained as visible unknown with raw code.
- `plateau-app:src/wip/wip-model.test.ts`: pending-review + red-CI PR produces zero `actions` and sits in Flow; explicit human-review and ready-fork each produce one action; fork link preserved; schema-1 input projects new sections as unknown (not zero). RED: today these PRs land in Needs you.
- `plateau-app:src/wip/wip-view.test.ts`: section order Progress, Moving, Landed before Needs you/Flow; units and ages on each count; "collecting history" text; no "all repos" string when partial. RED: the current view has none of these sections. RED: computed-CSS check that every description selector (new rows and Flow rows) has no `text-overflow: ellipsis`/`line-clamp` fails today on `plateau-app:src/wip/wip-view.css:45,113,146-147`, and a long title renders unclipped (today clipped at 200 chars, `plateau-app:src/wip/wip-model.ts:157`). The axe pass at 320/390 px is a Playwright check (`@axe-core/playwright`), not a vitest unit; it is part of the Proof plan, not asserted green today.
- `plateau-app:src/wip/wip-source.test.ts`: `isSnapshot` accepts schema 2 and rejects schema 3 (RED: it accepts only schema 1 today); schema 1 is still accepted (preservation, green today; mutation proof: narrowing the check to `=== 2` turns it red).

## Proof plan

Real-surface evidence, recorded on this card, not in shared docs:

1. Before/after screenshots at 390 px from the running Plateau dev server (detect the already-running instance, don't restart it) against a real publisher snapshot, compared with the manual plan scoreboard for the same observed window.
2. Publisher → relay → phone-path browser probe: publish schema 2 to the relay (consumers deployed first), load the same-origin page, then stop the publisher and confirm the page shows "Not live" with aged data rather than fresh.
3. GitHub spend: read `we:scripts/lib/gh-spend.mjs` ledger totals before and after two full 120 s publish cycles plus a second open tab; the delta is compared with the same two cycles on the unmodified collector (which keeps its existing `gh pr list`/merged-sweep): the slice adds zero NEW calls and the second tab adds none. Also run the axe check at 320 and 390 px with Playwright against the running dev server.
4. A live cold-history check (fresh state dir) shows "collecting history", and a real drain history without repo identity shows "observed by local drain, partial".

## Follow-ups

Named for the eventual BUILDER to file if not already covered: the sibling slices #4624 (running/holds with executors), #4623 (all-repo open PRs grouped by wait), #4621 (delivery kinds and durable trends), #4622 (health/budget/overnight and the ruled policy home). Additional items not owned by a sibling:
- Cached paging through the existing read-only ask channel for bounded payloads (needed once PR lists ship).
- Wire the real publisher heartbeat/`completedPassAt` distinction into the header once #4622 lands.
- Upgrade the merged-today source from drain history to the PR event ledger (#4281) when it is available.

## Readiness

Prepared 2026-09-30 by `prepare-stamp`. Scope lists predicted files including new adapters and tests; `plateau-app:src/wip/wip-publish.ts` (`publishOnce`) may also need a small schema-2 touch and should be added to scope if so. Record testing lessons and uncovered producer gaps here, not in shared agent docs.

Design-job verification (2026-09-30): all six scoped card checks passed and the diff whitespace check passed. The required lane verifier was invoked, but the sandbox refused its marker write under we:.git/; its documented marker-free run also failed acquiring the host-wide admission lock outside the writable checkout. The standards command hit the same lock restriction. Full lane/standards verification remains required in a permitted environment; no admission bypass or test weakening was applied.
