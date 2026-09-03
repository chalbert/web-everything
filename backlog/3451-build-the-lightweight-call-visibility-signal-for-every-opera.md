---
bornAs: xadrqhr
kind: task
parent: "3427"
status: resolved
scope: ["we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/http-adapter.mjs", "we:scripts/operations/call-log.mjs", "we:scripts/operations/call-log-store.mjs", "we:scripts/operations/__tests__/"]
dateOpened: "2026-09-01"
dateStarted: "2026-09-03"
dateResolved: "2026-09-03"
tags: [operations-engine, telemetry, observability]
---

# Build the lightweight call-visibility signal for every operation call

Fork 2 of [#3427](/backlog/3427-design-an-operation-manager-a-real-execution-chokepoint-ever/) ratified a
separate, purpose-built call-visibility signal for every operation call regardless of step kind —
access-log-shaped (operation name, timestamp, caller kind, outcome), structurally distinct from the
run-record store — so a `compute`-only call (e.g. `gate-health`, `suggest-next`, `verify`, `pr-status`)
stops leaving zero trace of being called. This closes the real, measured gap #3427's ruling names, without
touching the run-store's own "no landfill" property (`we:scripts/operations/run-store.mjs`'s
`we:.operations/runs/<id>.json` sidecar stays reserved for resumable multi-step runs).

## Storage shape

A rotated, append-only, prunable sidecar — the access-log half of the access-log/application-data split
#3427's ruling draws — **not** a run record. Mirror the existing `we:scripts/operations/run-record.mjs`
(pure core) / `we:scripts/operations/run-store.mjs` (io shell) split with a new pair:

- `we:scripts/operations/call-log.mjs` — pure core. Defines the line shape (one JSON object per call) and its
  parse/serialize/validate functions, unit-testable with no filesystem.
- `we:scripts/operations/call-log-store.mjs` — io shell. Appends one line per call to a gitignored sidecar
  under `we:.operations/calls/` (day-rotated, e.g. `we:.operations/calls/<YYYY-MM-DD>.jsonl`, mirroring
  `we:scripts/operations/run-store.mjs`'s `resolveRunsDir`/`OPERATION_RUNS_DIR`-style override so tests and
  out-of-tree callers can redirect it), plus whatever prune/read helpers the CLI or a future consumer needs.
  Nothing here is resumable and nothing here is keyed by `run+step` — no line in this store is ever read back
  to resume a suspended run, which is the schema-mismatch reason #3427's ruling gives for keeping it
  structurally distinct from `we:scripts/operations/run-store.mjs`.

**One line's fields:** `operation` (the declared op name), `timestamp` (ISO 8601), `callerKind` (`cli` |
`http`, the transport the call arrived through — not to be confused with the hosted-tier `callerId` #3400
threads onto run telemetry, a separate, later concern this item does not build), and `outcome`.

**`outcome` carries a compact digest of the result, not bare success/failure** — the skeptic's debuggability
amendment folded into #3427's Done-when #2. Concretely: `{ status: 'ok'|'error', digest: <short string> }`,
where `digest` is a bounded-length (e.g. ≤200 char) summary derived from the operation's own outcome payload
(the same `outcomePayload` shape `we:scripts/operations/cli-adapter.mjs`'s `--json` already prints) — enough
to tell two failures apart at a glance without persisting the full result. The exact truncation/summarization
rule is implementation detail below this contract, not a fork.

## Caller surfaces that must emit it

Both derived callers, since both are declared over the same registry and neither may special-case an
operation:

- `we:scripts/operations/cli-adapter.mjs` — emit one line per invocation (every `advance` loop that reaches
  `complete`, `failed`, or a terminal suspend), regardless of whether the declaration is read-only
  (`compute`-only) or stateful.
- `we:scripts/operations/http-adapter.mjs` — emit one line per request, on **both** branches named in its own
  header: the read-only `compute`-only branch (`runReadOnly`, which today has no store, no sinks, and writes
  nothing — confirmed live: its compute-only path records nothing today, same as the CLI's) and the stateful
  branch (`handleOperationRequest`'s run-record path). This is the four-shipped-`compute`-operation gap
  (`gate-health`, `suggest-next`, `verify`, `pr-status`) #3427's ruling measures directly.

## A third option to consider, not foreclosed by (a)/(b) alone

Per #3427's ruling: also weigh, as a named third option (not exhaustive with the run-record-vs-lightweight-log
framing), **a per-declaration opt-in to full run-record persistence for specific high-value `compute`
operations** — e.g. a declaration-level flag a small number of expensive or high-stakes `compute` operations
could set to also persist a full run record despite completing in one `advance` sweep, layered on top of (not
instead of) the lightweight signal every call gets unconditionally. Whether any operation actually needs this
today, or it is recorded and left unused, is this item's call to make — #3427 requires only that the option be
named and considered, not that it be built.

## Progress

- **Status:** built — we:scripts/operations/cli-adapter.mjs and we:scripts/operations/http-adapter.mjs both emit one call-log line per invocation now (compute-only and stateful alike); we:scripts/operations/call-log.mjs/we:scripts/operations/call-log-store.mjs shipped as a pure-core/io-shell pair mirroring we:scripts/operations/run-record.mjs/we:scripts/operations/run-store.mjs.
- **Wiring:** the write is dependency-injected (a `callLog` handle, exactly like `store`) rather than hard-imported into either adapter — importing the file-backed store directly would have made every existing test that drives `runOperationCli`/`handleOperationRequest` (there are dozens) start touching real disk as an unannounced side effect. we:scripts/operations/run.mjs wires the real file-backed store (`createFileCallLogStore()`) for actual CLI use; a caller that omits `callLog` gets today's behaviour unchanged.
- **Third option (per-declaration high-value-`compute` opt-in to full run-record persistence):** considered, deferred as unnecessary for now. None of the four shipped `compute`-only operations (gate-health, suggest-next, verify, pr-status) need resumability — they settle in one `advance` sweep by construction — and the lightweight call-log line already answers "was this called, and how did it go". Revisit if a future `compute`-only operation turns out to need a full replayable record.
- **Notes:** verified end-to-end with a real CLI invocation (`suggest-next --scanOpenPrs=false`) — one line landed in `we:.operations/calls/<day>.jsonl` with a non-empty, bounded digest.
- **Follow-up filed:** we:scripts/backlog.mjs's `claim` command and we:scripts/operations/review-loop-cli.mjs both call the engine's `driveRun` directly, bypassing both derived-caller adapters this item instruments — so those two call sites still leave no call-log trace. Out of this item's declared scope (its `scope:` frontmatter names only the two adapters + the new store pair), so scaffolded as a follow-up rather than folded in here.

## Done when

1. **Executable** — a new test in `we:scripts/operations/__tests__/` (mirroring the existing
   `we:scripts/operations/run-record.mjs`/`we:scripts/operations/run-store.mjs` test shape) asserts: (a)
   `we:scripts/operations/call-log.mjs`'s pure functions round-trip a line with all four fields; (b) a
   fixture call through `we:scripts/operations/cli-adapter.mjs` for a `compute`-only declaration (e.g. a
   fake read-only op) produces exactly one appended line whose `outcome.digest` is non-empty and whose
   length stays under the bound; (c) a fixture call through `we:scripts/operations/http-adapter.mjs`'s
   `runReadOnly` branch does the same — the test that would have failed today, since that branch currently
   writes nothing.
2. **Observable** — `we:.operations/calls/` exists as a directory distinct from `we:.operations/runs/`, is
   `.gitignore`d the same way, and a manual CLI invocation of any shipped `compute`-only operation
   (`gate-health`, `suggest-next`, `verify`, `pr-status`) produces a new line in the day's log file.
3. **Assertable** — the PR body names, for the record, whether a per-declaration high-value-`compute` opt-in
   (the third option above) was built, deferred, or judged unnecessary, and why — so #3427's Done-when #2
   requirement to *consider* it is traceably closed, not silently dropped.
