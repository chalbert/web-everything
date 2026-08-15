---
bornAs: xs9t6l5
kind: story
size: 2
parent: "2606"
status: open
blockedBy: ["2605"]
dateOpened: "2026-07-27"
scope:
  - plateau:tools/drain-daemon/lib.mjs
  - plateau:tools/drain-daemon/lib.test.mjs
  - plateau:tools/drain-daemon/daemon.mjs
  - we:scripts/conveyor/pr-watch.mjs
  - we:scripts/conveyor/__tests__/pr-watch.test.mjs
  - we:scripts/merge-ai-prs.mjs
tags: [conveyor, delivery, drain, drain-daemon, wake]
---

# Complete the event-driven wake: shorten drain poll default + fire /nudge on PR-ready

Deliver the WAKE half of the ratified **#2692** (event-driven land is WAKE-only —
[we:docs/agent/platform-decisions.md#event-driven-land-is-wake-only](../docs/agent/platform-decisions.md#event-driven-land-is-wake-only)):
shorten the drain-daemon poll default (60s → ~5–10s) and wire the just-landed **#2605** `POST /nudge` to fire on a
PR-reaching-ready event, so the **one** polling writer wakes near-instantly — **no second writer, no fence**. This is
the cheap immediate win #2692 sanctioned independent of the deferred merge-queue build (which stays gated behind
tripwire #2740).

## What remains (the seam is mostly already there)

- **#2605 (landing) delivered the seam** — the drain-daemon `POST /nudge` (coalescing) + `GET /events` SSE + the
  `nudge` / `watch` CLI verbs. And **#2683 (resolved)** already fires the single-PR fast-drain from the conveyor's
  `we:scripts/conveyor/pr-watch.mjs` on the `isReadyToLand` (CI-green ∧ non-author sign-off) transition.
- **This item closes the daemon-side remainder:**
  1. **Shorten the drain poll default.** Lower `plateau:tools/drain-daemon` `DEFAULTS.intervalSec` from `60` to
     ~5–10s (one constant). The interval floor **stays** — push is an accelerator, not a replacement (#2605).
  2. **Fire `/nudge` on a PR-reaching-ready event.** Wire the daemon's own `POST /nudge` to fire when a PR reaches
     the last land-precondition (whichever of {CI-green, review-sign-off} completes last — the #2683 predicate), so
     the resident writer wakes on the event rather than only on the next poll tick, for PRs that arrive by any path
     (a hand-applied label, a producer that never nudged), not just the in-conveyor watcher.

## Invariants held (from #2692's ruling)

- **One logical writer.** The wake only shortens the perceived poll gap; it never adds a second writer or a fence.
  The full merge-queue build (speculative merge-commit + per-step CAS guards + batching) stays **deferred** behind
  the measured `land-serialization` saturation tripwire #2740 — this item does **not** touch it.
- **Authority ≠ serialization.** The nudge triggers the daemon's own land path; the pre-land gate is still
  re-derived server-side (`we:scripts/lib/pr-merge-gate.mjs`). A nudge is a wake signal, never a trusted land order.

## Definition of done

- Drain-daemon poll default is ~5–10s with the interval floor intact.
- A PR reaching its last land-precondition fires `/nudge` (the resident writer wakes on the event, not only the tick).
- No second writer / no fence introduced; the deferred build gate (#2740) is untouched.

## Lineage

Builds on #2605 (drain-daemon `/nudge` seam, landing) and #2683 (conveyor fast-drain trigger, resolved). Delivers
the WAKE half ruled ship-now in decision #2692 (codified
[#event-driven-land-is-wake-only](../docs/agent/platform-decisions.md#event-driven-land-is-wake-only)). Program #2606
/ epic #2612. Latency lever; whether it moves #2606 throughput is provisional on #2680's serial-land-vs-wall-clock
regime finding (same caveat as #2683).

---

## Prepared (2026-08-15) — verified against live code in both repos

Both halves were re-verified against the checked-out source, not assumed from the card's own prose. One material
correction to the card's own framing came out of that check (see Task 1 below): "one constant" undersells what
Task 1 actually has to touch to be correct, not just to compile.

### Task 1 — shorten the poll (plateau-app)

**The literal ask** is real and small: `plateau:tools/drain-daemon/lib.mjs:22`, `DEFAULTS.intervalSec: 60`.
**Decided value: `10`** (seconds) — the top of the ratified 5–10 s band
([#event-driven-land-is-wake-only](../docs/agent/platform-decisions.md#event-driven-land-is-wake-only) clause 2),
and the exact value the ratifying design report's own rate-limit math was computed against
(`we:reports/2026-07-27-lever-c-landing-merge-queue-design.md:31`: "~720 `gh` calls/h" only equals
360 passes/h (3600s ÷ 10s) × ~2 calls/pass — i.e. that math assumed 10 s, not the midpoint). A fresh, conservative
recount here: `we:scripts/merge-ai-prs.mjs:2676` (`listOpenPrs`, the per-repo `gh pr list` the daemon's sweep calls
once per repo in the default 3-repo constellation set) plus per-open-PR review/manifest reads — call it 3–6 `gh`
calls on a typical idle pass (no re-derivation of an exact figure attempted; independently spot-checked during
review — line `:1169` cited in an earlier draft of this note was wrong, it's inside `buildDrainVerdicts`'s pure
verdict logic, not a `gh` call; the real `gh pr list` sweep call sites are `:2569`, `:2676`, `:2831`). At 360
passes/h that is ~1,080–2,160 calls/h, still comfortably under GitHub's 5,000/h authenticated REST budget
(22–43%). 10 s keeps the safety margin `check:standards` and a human would want without re-opening the 5–10 s
band as a fork — it's a value pick inside an already-ratified range, not a new decision.

**What a naive one-line change would silently break (found by de-risking the risky part now, not during the
build — checklist item 8).** `plateau:tools/drain-daemon/lib.mjs:401-420` defines the daemon's health/alerting
thresholds as raw **pass counts**, and the code says outright why: *"Thresholds are set against the real 60s
cadence... so a normal CI wait (~8 min ≈ 8 passes) legitimately shows `considered>0, merged 0`"*
(`plateau:tools/drain-daemon/lib.mjs:401-404`). Concretely:

```
export const STALL_WARN_PASSES = 15;              // ~15 min unlanded despite ready candidates → degraded
export const STALL_CRIT_PASSES = 40;               // ~40 min → stuck (the we #477 deadlock class)
const ZERO_MERGE_WINDOW = 5;                        // ~5 recent passes weighed against a live merge plan
const FAIL_WINDOW = 10; const FAIL_WARN_COUNT = 3; const FAIL_CRIT_COUNT = 6;
const TIMEOUT_WINDOW = 10; const TIMEOUT_WARN_COUNT = 3;
export const PARK_STALE_PASSES = 20;                // ~20 min a park sits unreviewed → degraded
export const CONSIDERED_NEVER_MERGED_PASSES = 20;   // ~20 min (×2 → critical) considered-but-never-landing
```

If `DEFAULTS.intervalSec` drops 60→10 (6×) and these stay literal, their WALL-CLOCK meaning shrinks by the same
6×: the report's own worked example — an ordinary ~8-minute CI wait — goes from "8 passes, well under the 15-pass
warn floor" to "~48 passes, past both the 15-pass warn floor AND the 40-pass critical line," so every routine
CI-pending PR would spuriously read `stuck` and fire a desktop alert (`plateau:tools/drain-daemon/daemon.mjs:119-138`)
within minutes of a completely normal wait. That is a real behavioral regression this story would ship, not a
hypothetical.

**Decided fix:** convert each threshold from a hardcoded literal to an expression derived from
`DEFAULTS.intervalSec`, preserving the documented minute value instead of the pass count:

```
export const STALL_WARN_PASSES  = Math.round(15 * 60 / DEFAULTS.intervalSec);
export const STALL_CRIT_PASSES  = Math.round(40 * 60 / DEFAULTS.intervalSec);
export const PARK_STALE_PASSES  = Math.round(20 * 60 / DEFAULTS.intervalSec);
export const CONSIDERED_NEVER_MERGED_PASSES = Math.round(20 * 60 / DEFAULTS.intervalSec);
const ZERO_MERGE_WINDOW  = Math.round(5  * 60 / DEFAULTS.intervalSec);
const FAIL_WINDOW        = Math.round(10 * 60 / DEFAULTS.intervalSec);
const TIMEOUT_WINDOW     = Math.round(10 * 60 / DEFAULTS.intervalSec);
```

(`export` is preserved on the four that are exported today — `plateau:tools/drain-daemon/lib.mjs:405,406,419,420`
— since `plateau:tools/drain-daemon/daemon.mjs`'s `RECENT_CAP`, `plateau:tools/drain-daemon/cli.mjs`'s
`HEALTH_HISTORY_TAIL`, and `plateau:tools/drain-daemon/lib.test.mjs`'s imports all reference them by name; the
other three were already module-private `const`, unchanged.)

At `intervalSec=10` (6× fewer seconds/pass than 60) this yields `STALL_WARN_PASSES=90`, `STALL_CRIT_PASSES=240`,
`PARK_STALE_PASSES=120`, `CONSIDERED_NEVER_MERGED_PASSES=120` (its own `×2` critical escalation then lands on 240,
matching `STALL_CRIT_PASSES` — consistent), `ZERO_MERGE_WINDOW=30`, `FAIL_WINDOW=TIMEOUT_WINDOW=60`. No exported
name or function signature changes — every call site (`plateau:tools/drain-daemon/lib.mjs:379,471,547,550,565,594,608,627,634,652,657,659`)
keeps reading the same constants, just now correctly valued. `plateau:tools/drain-daemon/daemon.mjs:110`'s
`RECENT_CAP = STALL_CRIT_PASSES+10` and `plateau:tools/drain-daemon/cli.mjs:63`'s
`HEALTH_HISTORY_TAIL = STALL_CRIT_PASSES+10` update automatically (250, was 50) because they already reference the
exported constant rather than a literal — no separate edit needed there, just note the larger (still cheap)
history-tail read.

**Verified safe against the existing test suite** (the checklist-8 "measure the blast radius" step, done rather
than asserted): every test in `plateau:tools/drain-daemon/lib.test.mjs` that exercises these thresholds imports and
drives them **symbolically** — `runOf(STALL_WARN_PASSES)`, `consideredRun(CONSIDERED_NEVER_MERGED_PASSES, [12])`,
etc. (confirmed at `plateau:tools/drain-daemon/lib.test.mjs:733,737,741,746,751,768,771,792,841,871,875,879,884,890,898,905,912,915,919,928,935,943,944,1075,1082`)
— never a bare literal. So the rescale is a pure value change the existing suite already tolerates; only one spot
hardcodes `'60s'` in a way that's actually WRONG after the change: `plateau:tools/drain-daemon/lib.test.mjs:20,24`
— the "60s interval" test name + `resolveConfig(...).intervalSec` assertion, which reads the real default and
must become `10`/`'10s interval'`. `:688-696`'s `describeDaemonPolicy` suite is a red herring, checked and ruled
out during independent review: its `cfg` fixture at `:688` is a HAND-BUILT literal (`{ intervalSec: 60, ... }`)
local to that one `describe` block, never derived from `DEFAULTS` — so `:692`'s `byLabel['pass interval']` →
`'60s'` and `:695`'s `byLabel['lease heartbeat']` → `'60s'` assertions are UNAFFECTED by the `DEFAULTS.intervalSec`
change and need no edit; they exercise `describeDaemonPolicy`'s formatting given an arbitrary config, not the
resolved default.

**Two accepted, documented side effects (not defects — stated so nobody re-discovers them as a surprise):**
- `plateau:tools/drain-daemon/history.jsonl`'s ~2 MB rotation (`plateau:tools/drain-daemon/lib.mjs:860-865`,
  `HISTORY_MAX_BYTES`) triggers proportionally more often at a faster pass rate (same bytes/pass, 6× more
  passes/day) — the on-disk **evidence window** shrinks from the code's own "~9 days... ~18 days [with the one
  retained archive]" estimate (`plateau:tools/drain-daemon/lib.mjs:858`) to roughly 1.5–3 days.
  `plateau:tools/drain-daemon/state.json`'s lifetime counters remain the authoritative complete record per the
  code's own existing main/lifetime split (`plateau:tools/drain-daemon/lib.mjs:80-84`) — this changes an
  operator's after-the-fact troubleshooting window, not correctness. Out of scope to fix here (no ask in this
  card to change retention policy).
- `decideNextDelaySec` (`plateau:tools/drain-daemon/lib.mjs:268-273`) seeds its exponential backoff from
  `intervalSec`, so an ordinary transient merge failure (exit 2/null) now starts at `intervalSec × 2¹ = 20s` (was
  120s) and takes ~7 failed passes to reach the unchanged `maxBackoffSec` ceiling (900s), vs ~4 today — faster
  early retries, same ceiling. `exit 3` (globally red main, `plateau:tools/drain-daemon/lib.mjs:270`) is
  unaffected: it parks straight at `maxBackoffSec` regardless of `intervalSec`. Not a regression; noted for
  completeness.

### Task 2 — fire `/nudge` on the ready-to-land transition (webeverything)

**Grepped first, not assumed:** `isReadyToLand` exists in exactly one place in the whole repo —
`we:scripts/conveyor/pr-watch.mjs:178` (`#2683`'s predicate) — and no WE script anywhere references
`DRAIN_DAEMON_PORT` or port `4599` today. So there is no existing cross-repo nudge caller to extend; this is a new
(small) wire, not a bug fix to one.

**Decided design:** on the SAME false→true `isReadyToLand` transition that already drives `fireFastDrain`
(`we:scripts/conveyor/pr-watch.mjs:248-255`, `#2683`), also fire a new, independently-toggleable, best-effort
`POST /nudge` to the resident daemon (the `#2605` seam), mirroring
`plateau:tools/drain-daemon/cli.mjs:480-496`'s own `nudge()`:

```
async function fireNudge() {
  const port = Number(process.env.DRAIN_DAEMON_PORT) || 4599; // must mirror plateau:tools/drain-daemon/lib.mjs DEFAULTS.port
  try {
    await fetch(`http://127.0.0.1:${port}/nudge`, { method: 'POST', signal: AbortSignal.timeout(2000) });
  } catch { /* no resident daemon reachable here (e.g. a CI runner) — harmless, the interval floor is the backstop */ }
}
```

Reusing we:pr-watch.mjs's existing predicate — rather than building a new watcher — is the decided approach, not a
default: it is the ONLY place in the repo that already computes this transition; the design record this card's
own decision (`#2692`) rests on explicitly names `we:scripts/conveyor/pr-watch.mjs`'s "own green-detection poll"
as the mechanism a nudge would ride (`we:reports/2026-07-27-lever-c-landing-merge-queue-design.md:34`, the "A3
nudge/wake-file" note); and the ratification's own clause 2 scopes this to "one constant plus one event wire" —
singular, small, not a new repo-wide watcher.

**Scope boundary, stated so it isn't silently narrower than the card's own prose implied:** a hand-applied
`ready-to-merge` label, or any PR that reaches ready OUTSIDE a conveyor-spawned `we:pr-watch.mjs` process (e.g. a
solo `/pr`-landed PR the conveyor never watched), gets **no event-wire nudge** from this story — it is caught only
by Task 1's now-10s interval floor. That is the same "push is an accelerator, not a replacement" invariant
`#2605`'s own card already states, applied consistently, not an oversight. Building a mechanism that observes
EVERY PR's readiness regardless of path is exactly the webhook-shaped (A5) work `#2692` clause 3 defers behind the
`#2740` tripwire — out of bounds for this size-2 story.

**Wiring, precisely:**
- `watchPr({ ..., fireFastDrain, fireNudge, requiredCheck, log })` (`we:scripts/conveyor/pr-watch.mjs:215`) gains
  an optional `fireNudge: () => Promise<void>` parameter, called best-effort (awaited, errors swallowed, same
  pattern as the existing `fireFastDrain` catch at line 252) on the same transition.
- The transition-tracking gate at `we:scripts/conveyor/pr-watch.mjs:248` (`if (fireFastDrain) { const readyNow =
  ...`) must widen to `if (fireFastDrain || fireNudge)` so nudge still fires when `--no-fast-drain` is passed, and
  vice versa — two independent accelerators over one detected transition, not one bundled on/off feature. **Named
  interface trap for the builder:** the existing `await fireFastDrain(pr)` call INSIDE that branch (line 252) must
  stay guarded by its own `if (fireFastDrain) { ... }` (or an equivalent `fireFastDrain &&`) — widening only the
  outer `if` and leaving that inner call unconditional calls `null` as a function the moment `--no-fast-drain` is
  passed with nudge enabled. The Done-when acceptance ("`--no-nudge` and `--no-fast-drain` can each be passed
  independently and the OTHER accelerator still fires") is exactly the test that catches this if missed — call it
  out here so it isn't caught only at review time.
- `main()` (near `we:scripts/conveyor/pr-watch.mjs:411`'s existing `fireFastDrain` closure) builds the `fireNudge`
  closure above, gated behind a new `--no-nudge` flag (mirrors `--no-fast-drain`); update the usage string
  (`we:scripts/conveyor/pr-watch.mjs:384`).
- The daemon's `POST /nudge` response contract (`plateau:tools/drain-daemon/lib.mjs:1177-1184`) is `{ok:true,
  coalesced:<bool>}`; the caller here doesn't need to read the body — success and failure are both fire-and-forget.
- **Named interface risk, not solved here:** the `4599` port default is duplicated across repos (WE cannot
  cross-repo-import plateau-app code — the two are separate git checkouts). Add a one-line comment in both
  `we:scripts/conveyor/pr-watch.mjs`'s `fireNudge` and `plateau:tools/drain-daemon/lib.mjs:27`'s `DEFAULTS.port`
  cross-referencing the other, so a future port change is a deliberate two-repo edit, not a silent desync. This is
  the honest residual the checklist asks to name rather than hide.

**Doc cleanup (non-blocking, but left in the same PR since it's the file being touched):** six comments in
`we:scripts/conveyor/pr-watch.mjs` describe the daemon's floor as "≤60s" (lines 13, 21, 174, 224, 245, 405) and
one in `we:scripts/merge-ai-prs.mjs:2644` says "resident-daemon 60s sweep" — reword to interval-agnostic phrasing
(e.g. "the resident daemon's next poll") so they don't silently go stale the moment Task 1 lands in the sibling
repo.

### Tasks, in order

**plateau-app:**
1. `plateau:tools/drain-daemon/lib.mjs:22` — `DEFAULTS.intervalSec: 60` → `10`.
2. `plateau:tools/drain-daemon/lib.mjs:401-420` — convert the seven pass-count thresholds to
   `Math.round(<minutes> * 60 / DEFAULTS.intervalSec)` expressions (exact list above); no signature/export shape
   changes.
3. Run plateau-app's `plateau:tools/drain-daemon/lib.test.mjs` — confirm it's still green (the empirical check
   for step 2, not a re-derivation by inspection).
4. `plateau:tools/drain-daemon/lib.test.mjs:20,24` — update the "60s interval" test name and the
   `resolveConfig(...).intervalSec` assertion to the new default. Leave `:688-696`
   (`describeDaemonPolicy` suite) untouched — its `cfg` fixture is hand-built, not derived from `DEFAULTS`.
5. Reword the "60s cadence" prose in `plateau:tools/drain-daemon/lib.mjs:401-404,685-687,858` so the comments
   describe the relationship (thresholds derive from `DEFAULTS.intervalSec`) rather than a now-wrong absolute
   number.

**webeverything:**
6. `we:scripts/conveyor/pr-watch.mjs:215` — add the `fireNudge` param to `watchPr()`'s signature + JSDoc (lines
   204-214).
7. `we:scripts/conveyor/pr-watch.mjs:248` — widen the transition gate to `if (fireFastDrain || fireNudge)`; call
   `fireNudge` alongside `fireFastDrain` inside the branch, its own try/catch.
8. `we:scripts/conveyor/pr-watch.mjs:411` (near) — build the CLI `fireNudge` closure, wire `--no-nudge`, update
   the usage string at line 384 and the file-header docstring (UPGRADE SEAM note, lines 67-72) with this story's
   scope boundary.
9. `we:scripts/conveyor/__tests__/pr-watch.test.mjs` — extend the `describe('watchPr — fires the fast drain on
   the ready-transition (#2683)')` block (lines 207-272) with the `fireNudge` equivalents of its five existing
   cases: fires once on transition; no re-fire while still ready; re-fires after a ready→not-ready→ready dip; a
   nudge failure never kills the watch; `fireNudge: null` never fires; a parked PR never fires either accelerator.
10. Reword the six stale "≤60s" comments in `we:scripts/conveyor/pr-watch.mjs` (lines 13,21,174,224,245,405) and
    the one in `we:scripts/merge-ai-prs.mjs:2644`.

### Done when

- `plateau:tools/drain-daemon/lib.mjs`'s `DEFAULTS.intervalSec` is `10` (within the ratified 5–10s band), and
  `resolveConfig({env:{}, ...}).intervalSec` reflects it in a test.
- `STALL_WARN_PASSES`, `STALL_CRIT_PASSES`, `PARK_STALE_PASSES`, `CONSIDERED_NEVER_MERGED_PASSES`,
  `ZERO_MERGE_WINDOW`, `FAIL_WINDOW`, `TIMEOUT_WINDOW` are each derived from (not independent of) the new
  `DEFAULTS.intervalSec`, and plateau-app's full `plateau:tools/drain-daemon/lib.test.mjs` suite is green.
- `we:scripts/conveyor/pr-watch.mjs`'s `watchPr()` calls a supplied `fireNudge` exactly once per false→true
  `isReadyToLand` transition — unit-tested — independently of whether `fireFastDrain` is enabled.
- A `fireNudge` rejection/throw never changes `watchPr`'s returned exit code — unit-tested (mirrors the existing
  `fireFastDrain` failure case at `we:scripts/conveyor/__tests__/pr-watch.test.mjs:243-251`).
- `--no-nudge` and `--no-fast-drain` can each be passed independently and the OTHER accelerator still fires.
- `npm run check:standards` is green in webeverything (repo-locus prefixes, no dangling `#NNN`) after the doc
  edits; plateau-app's own equivalent gate is green after its edits.

### Delivery shape

**Two independent PRs, one per repo — no `blockedBy` edge needed between them.** Verified, not assumed: neither
change imports, calls, or otherwise depends on the other's code (zero cross-repo import path exists between WE and
plateau-app checkouts); the only relationship is the duplicated `4599` port default noted above, which is a
runtime coincidence, not a build dependency. Either PR can land first, in either order, each gated by its own
repo's `test` check. Within webeverything, Task 2 lands as one small, additive, incremental PR behind `main`
(default-on, opt-out via `--no-nudge`) — no feature flag beyond that needed.

### Preparation-checklist compliance (`we:agent-memory-src/story-preparation-checklist.md`)

Items 1–8 are carried above (scope+consumers grepped not assumed; testable Done-when; decided design for both
tasks with the reuse-vs-new-watcher fork named and resolved rather than left inline; exact interfaces/signatures;
ordered tasks; delivery shape justified from a verified absence of cross-repo coupling; the risky part — the
pass-count/cadence coupling — was de-risked now, by reading the threshold code and its tests, not deferred to the
build).

**Item 9 — independent review, run and incorporated (2026-08-15).** A fresh, independently-sessioned reviewer
re-derived every path:line citation above against the live checked-out source in both repos (not this author's
own claims) and returned Medium confidence with two citation errors and one interface gap, all fixed in this
draft: (a) the "Decided fix" code sample had silently dropped `export` off four constants two other files import
by name — restored; (b) the `we:scripts/merge-ai-prs.mjs` rate-limit citation pointed at a line with no `gh` call
— corrected to the real `listOpenPrs` sweep site (`:2676`) plus the other two call sites found on re-check; (c)
the `if (fireFastDrain || fireNudge)` widening left an unconditional inner `fireFastDrain(pr)` call as a
`TypeError`-on-`null` trap — now called out explicitly as a task risk. The reviewer also flagged `size: 2` as
optimistic once the threshold-derivation work is counted — noted here rather than silently overridden: a builder
finding this genuinely runs past a "2" should re-open sizing, not force it, but the work stayed decomposable
enough that a re-slice did not look warranted at prep time.
