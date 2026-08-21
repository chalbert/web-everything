---
bornAs: xaq4sub
kind: story
size: 5
parent: "2551"
status: open
scope: ["plateau:src/backlog-view/", "plateau:vite.config.mts", "we:scripts/lane-pool.mjs", "we:scripts/readiness/conveyor-state.mjs"]
dateOpened: "2026-07-28"
tags: []
---

# Post-hoc review: forensics and take-over for stalled or failed lanes

For stalled/stopped/failed/orphaned lanes, show a post-mortem (last state, diff-so-far, why it stalled) so recover/retry/reassign/discard/take-over is an informed choice, and let the operator assume a build (holding the lane) and hand it back. The state classification already exists (card-state-read-model UC-A5/E1/E3); this adds a forensics detail panel + read endpoint, sourcing why-it-stalled from we:scripts/readiness/conveyor-state.mjs and diff-so-far/lease-hold from we:scripts/lane-pool.mjs. Take-over/release rides this review surface.

## Design

*Grounded against both live trees 2026-08-21 (`we:` at this lane's HEAD, `plateau:` at `c050cca`).*

### Almost every input already exists — the new build is one collector, one endpoint, one panel

| the panel needs | where it already comes from | status |
|---|---|---|
| the state classification (stalled / failed / orphaned) | `deriveCardState` + `CardSignals` — `plateau:src/backlog-view/card-state-read-model.ts` `:302` / `:42`. UC-E3 = `lease.held && lease.holderAlive === false` (`:189`), UC-E1 = `build.phase === 'failed'` (`:192`), UC-A5 = `isStalled(s.build)` off `build.stalledMs` (`:206`) | **rules exist; two of three are UNREACHABLE from live data — see below** |
| the verbs the panel sits behind | the card taxonomy already fixes them: UC-A5 primary *"Inspect lane"*, UC-E1 *"Retry"*, UC-E3 *"Reclaim lease"* — `plateau:src/backlog-view/card-taxonomy.webcases.test.ts` `:179` / `:206` / `:208` | **exists** |
| why it stalled | `assessHealth` — [we:scripts/readiness/conveyor-state.mjs](scripts/readiness/conveyor-state.mjs) `:376`, returning `{ verdict, stalled: [{lane, num, session, idleS}], degradedInfra, errors }`, and deliberately separating an **infra-blocked** lane (a known outage cause, clustered) from a real stall | **exists** |
| last state + lease hold | `laneStatus` — [we:scripts/lane-pool.mjs](scripts/lane-pool.mjs) `:629`, surfaced by `node we:scripts/lane-pool.mjs status --json` as `{ lane, path, head, branch, clean, behind, deps, lease, leased }` | **exists** |
| diff-so-far | `WORKING_TREE_TRANSPORT.readMaterial({ laneRoot, baseRef })` — [we:scripts/lib/converge-transports.mjs](scripts/lib/converge-transports.mjs) `:170-190`. Committed lane commits **and** uncommitted edits against the fork point, plus each untracked file as a `--no-index` add-diff | **exists** |
| take-over | `node we:scripts/lane-pool.mjs adopt --lane=N [--force] [--json]` — stamps `workerSession`, which is what arms `we:scripts/guard-lane.mjs`'s Edit/Write refusal against every other session (#2997 r2) | **exists** |
| hand it back | `node we:scripts/lane-pool.mjs release --lane=N [--session=<holder>] [--force]` | **exists** |
| **a per-lane forensics read** | — | **build** |
| **a read endpoint** | — | **build** |
| **the detail panel** | — | **build** |

So this item is *composition and exposure*, not new mechanism. Two consequences worth stating up front:
**take-over needs no new WE primitive** (the card's "let the operator assume a build (holding the lane) and
hand it back" is `adopt` + `release`, already shipped), and **the diff must not get a second reader**.

### THE BLOCKER: two of the three states this panel sits behind are unreachable from live board data

Independent review, 2026-08-21 — verified against `plateau:` at `c050cca`, and it changes the shape of the
work. `deriveCardState`'s UC-A5 / UC-E3 *rules* exist, but nothing in the live pipeline ever produces the
signals they key on:

- `overlayToSignals` in `plateau:src/backlog-view/lane-board-data.ts` hardcodes
  `lease = { held: true, heldByThisItem: true, holderAlive: true }` at **both** its call sites (`:75`, `:83`)
  — `holderAlive: false` appears nowhere outside
  `plateau:src/backlog-view/card-state-read-model.test.ts` (`:71`), i.e. only in a fixture.
- It never sets `build.stalledMs` or `phase: 'stalled'` — only `'failed'` (`:76`) and `'building'`
  (`:78`, `:82`).

So **UC-E1 (failed) is the only one of the three that a real board can render today.** A forensics panel
behind "Inspect lane" (UC-A5) and "Reclaim lease" (UC-E3) would have no entry point for exactly the two
failure modes this card's title names. That is not a detail — it is the difference between "wire a panel to
existing states" and "produce the states first, then wire the panel".

**This slice therefore owns a fourth piece the card did not name: the liveness/stall signals must reach
`overlayToSignals`.** The data exists on the WE side (`assessHealth`'s `stalled[]` entries carry `idleS`; the
lease marker carries `pid`, `acquiredAt` and a TTL that `isLeaseStale` already evaluates) — it simply is not
plumbed into the overlay the board reads. Decide explicitly whether that plumbing is in scope here or is its
own prerequisite slice, and say which. **Do not build the panel against states nothing can produce.**

*(One correction to the correction: the review cited an `OverlayState` type at `plateau:contracts/backlog.ts`.
No such file exists — `OverlayState` lives in `plateau:src/backlog-view/types.ts`, imported by
`plateau:src/backlog-view/lane-board-data.ts` at `:14`. The substantive finding is unaffected and was independently re-verified above.)*

### THE DIFF READER IS A LANDMINE — reuse `readMaterial`, never re-roll it

`WORKING_TREE_TRANSPORT.readMaterial` is the *fixed* form of a command that already caused real damage. An
earlier draft made untracked files visible by running `git ls-files --others -z | xargs -0 git add
--intent-to-add` and never restored the index — with intent-to-add entries present, `git restore <path>`
**truncates a swept file to 0 bytes**, `git stash` fails `Entry '<path>' not uptodate`, and every
`pull --ff-only --autostash` in the repo dies. The whole hazard is written up in
[we:scripts/lib/converge-transports.mjs](scripts/lib/converge-transports.mjs) `:141-148` and regression-pinned
in [we:scripts/lib/__tests__/converge-transports.test.mjs](scripts/lib/__tests__/converge-transports.test.mjs)
`:200-208` (*"leaves the INDEX byte-identical"*, *"leaves `git stash` working"*).

A forensics panel reads a lane a human may be actively editing, and reads it repeatedly. Writing a fresh diff
command here would re-open exactly that. Call `readMaterial` and inherit its tests.

### The WE half — a new per-lane collector, not an extension of the tick read

`we:scripts/readiness/conveyor-state.mjs` is the **whole-tick** read (~23 KB of JSON, all lanes, emitted in one
shot). Lane forensics is per-lane and on demand, and carries a potentially large diff — wrong shape to bolt on.
Add a sibling under the same stated contract (that file's header `:12-20` states it explicitly):

```
node scripts/readiness/lane-forensics.mjs --lane=N [--repo=<checkout>] --json
```

Same **pure-core / IO-shell** split as its two siblings (`we:scripts/readiness/conveyor-state.mjs`,
`we:scripts/readiness/scope-lease-collect.mjs`): a
pure `shapeLaneForensics({ laneStatus, health, diff, now })` unit-tested against fixtures with no git/network,
and a `main()` IO shell — gated on `import.meta.url === pathToFileURL(process.argv[1]).href` — that shells
`node we:scripts/lane-pool.mjs status --json`, imports `assessHealth`, and runs `readMaterial`'s command. Every read guarded:
a failing collector degrades to a null section plus an `errors[]` entry, never a crash.

Two things the shell owns that the endpoint must not:

- **The diff needs a shell; the endpoint must not have one.** `readMaterial` returns
  `{ kind: 'shell', command, cwd }` with `set -o pipefail` and a `while read` loop. Run it here (in the WE
  script) and return the diff as a JSON string field — so the plateau side stays on `execFile`, never
  `exec`/`shell: true`, exactly as `scopeLease()` does today.
- **Cap the diff.** `scopeLease()` runs with `maxBuffer: 8 MB` and `timeout: 12000`. A stalled lane's tree can
  be arbitrarily large; truncate with an explicit `{ truncated: true, bytes }` marker rather than letting the
  buffer blow and the whole read 502.

### The plateau half — copy `scopeLease()`, it is the same shape

`plateau:vite.config.mts` `:360-419` is a working precedent for precisely this: a dev-server middleware that
`execFileAsync('node', [<script in weRoot>, '--repo=…', '--json'])`, sets `Access-Control-Allow-Origin`, and
answers `502 { error, detail }` on failure — with the WE root resolved as a **sibling checkout path**, no npm
dependency between the repos. Add `GET /api/backlog/lane-forensics?item=<num>[&repo=]` (or a `laneForensics()`
plugin beside `scopeLease()`) on the same model.

The item→lane join is already solved and must not be re-derived: `we:.claude/lane-ports.json` via the
`laneToItemNums` helper `scopeLease()` already uses (`:392`).

**Cross-repo couple, and it degrades cleanly.** Because the plateau half shells the WE script by path, there is
no version coupling: if the plateau half lands first, the endpoint simply 502s until the WE collector exists.
That is the honest ordering statement — WE-first is preferable, but neither half breaks the other.

### Scope of the write verbs

Take-over (`adopt`) and hand-back (`release`) are **writes**, and the read endpoint above is read-only by
construction. Route them through the existing lane-gated write seam
(`POST /api/backlog/write`, `WriteJobStore`, `plateau:vite.config.mts` `:612-618`) rather than adding a second
write path — including its `Content-Type: application/json` CSRF guard.

**`release` is already taken, and means something else.** `WRITE_VERBS` (`plateau:vite.config.mts:618`)
already binds `'release'` to the item-claim release (`active` → `open`), wired through
`plateau:src/backlog-view/write-action.ts`. Naming the lane hand-back `release` would collide with an existing
verb of unrelated semantics. Pick distinct names — e.g. `lane-adopt` / `lane-release` — and add them to
`WRITE_VERBS` explicitly; do not overload the existing verb and do not open a bypass around the seam.

## Done when

- `npx vitest run` against the new `we:scripts/readiness/__tests__/lane-forensics.test.mjs` is green, covering
  the pure `shapeLaneForensics` against fixtures with no git/network: a stalled lane (an `assessHealth`
  `stalled[]` entry → a why-it-stalled reason with `idleS`), an **infra-blocked** lane (a `degradedInfra` cause,
  classified as NOT a stall — the distinction `assessHealth` `:381-390` already draws), an orphaned lane (a
  live lease whose holder is dead), a truncated diff (`{ truncated: true, bytes }`), and a failing collector
  (a null section plus an `errors[]` row, never a throw). Fails today — the module does not exist.
- `node we:scripts/readiness/lane-forensics.mjs --lane=1 --json` exits 0 and prints JSON carrying, at minimum,
  `laneStatus`, `why`, `diff` and `errors` keys — with the lane's git index untouched. Cheap proof:
  `git -C <lane> status --porcelain` and `git -C <lane> ls-files -s` are byte-identical before and after the
  run. This is the regression that matters most; assert it the same way
  `we:scripts/lib/__tests__/converge-transports.test.mjs` `:204-207` already does.
- `grep -rn "ls-files --others" we:scripts/readiness/lane-forensics.mjs` returns nothing, and the module
  imports `WORKING_TREE_TRANSPORT` (or `resolveTransport('working-tree')`) from
  `we:scripts/lib/converge-transports.mjs` — the diff reader is reused, not re-rolled.
- `npm test` in `plateau:` is green with a new suite covering the forensics panel's render for UC-A5 / UC-E1 /
  UC-E3 off fixture forensics payloads, asserting each renders its taxonomy verb (*Inspect lane* / *Retry* /
  *Reclaim lease*) — the vocabulary already pinned in `plateau:src/backlog-view/card-taxonomy.webcases.test.ts`.
- **UC-A5 and UC-E3 are reachable from live data, or the card records that producing them is out of scope and
  names the prerequisite.** Cheap check: `grep -n "holderAlive" plateau:src/backlog-view/lane-board-data.ts`
  shows at least one site that can yield `false`, and `stalledMs`/`phase: 'stalled'` appears in that file.
  Today both greps show only the hardcoded `holderAlive: true` (`:75`, `:83`) and no stall signal at all — so
  this criterion fails before and, if the plumbing is in scope, passes after. If it is NOT in scope, this
  bullet is replaced by a one-line statement of the prerequisite slice, and the panel ships covering UC-E1
  only. Either outcome is acceptable; silently building against unreachable states is not.
- `node we:scripts/check-standards.mjs` → 0 errors.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: prove the premise by mutation or reversion first) — Most 'already exists' citations (deriveCardState line numbers, assessHealth, laneStatus, readMaterial, scopeLease() shape) were checked against live plateau:c050cca and we:HEAD and hold. But the load-bearing premise — that UC-A5/UC-E3 are reachable classifications the panel can sit behind — was never verified against the live data path and turns out false; see findings.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — plateau:src/backlog-view/write-action.ts already consumes a WriteVerb 'release' with WRITE_TARGET release→'open' (releasing an item's claim). The card floats 'release' as a candidate name for lane hand-back (plateau:vite.config.mts WRITE_VERBS) without surfacing that this consumer already binds the name to different semantics — a one-grep check the card's own rigor elsewhere would have caught.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — No round-trip/contract test is asked for between we:scripts/readiness/lane-forensics.mjs's real --json output and the plateau fixtures the panel's render test will use — only independently-authored fixtures on each side. This mirrors the existing we:scripts/readiness/scope-lease-collect.mjs ↔ plateau:src/backlog-view/lane-board-data.ts precedent, which also ships with no such seam test, so this is a pre-existing repo pattern the card follows rather than a new gap.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The UC-A5/UC-E3 rules in plateau:src/backlog-view/card-state-read-model.ts fire on fields (`lease.holderAlive`, `build.stalledMs`) that plateau:src/backlog-view/lane-board-data.ts never sets from live data — only `plateau:src/backlog-view/card-state-read-model.test.ts`'s hand-fed fixtures exercise them. No named test would redden if this stays true after the card ships.
- **unmeasured-impact** (NOT addressed; strategy: measure the constraint before sizing) — The card sizes a 5-point build on the assumption that the panel will serve real stalled/orphaned-lane recoveries, without measuring whether those UC states ever actually render on the live board today (they don't, per the same evidence).
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Both the WE collector (guarded reads → null section + errors[], never a crash, tested explicitly in Done-when) and the diff cap (`{truncated, bytes}` marker instead of a blown buffer) make failures surface rather than hide.

**Corrections applied by this review:**

- The card's claim that UC-A5/UC-E3 classifications 'already exist' is true only at the deriveCardState rule layer: plateau:src/backlog-view/lane-board-data.ts's overlayToSignals hardcodes `holderAlive: true` at both its call sites and never sets `build.stalledMs`, and plateau:contracts/backlog.ts's OverlayState type carries no stall/liveness field at all — so neither UC-A5 nor UC-E3 is ever produced by live board data; only UC-E1 (failed) is.
- plateau:vite.config.mts's WRITE_VERBS already binds 'release' to a different write (WRITE_TARGET: release → 'open', an item-claim release, wired through plateau:src/backlog-view/write-action.ts), so the verb name the card floats for lane hand-back is already taken with unrelated semantics, not merely an open naming question.

The composition plan is well-grounded (nearly every cited file/line/mechanism checks out against the live repos and the diff-reader reuse is genuinely the safe path), but the card's central premise — that UC-A5 (stalled) and UC-E3 (orphaned) are live, reachable card-states this panel can sit behind — does not hold: the live board data pipeline never produces the signals those rules key on, so two of the three named failure modes have no board-level entry point today.

_Recorded through the declared `review-prep` operation._
