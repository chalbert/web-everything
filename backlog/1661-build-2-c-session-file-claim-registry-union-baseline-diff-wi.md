---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "we:scripts/readiness/claimScope.mjs"
tags: []
---

# Build 2-C: session file-claim registry — union baseline-diff with explicit Edit/Write + CLI touches

Close #953's ratified fail-unsafe hole in gate attribution. Extend the session claim registry (we:.claude/skills/batch-backlog-items/claims.json, already session-keyed + TTL-pruned) to record each file a session actually touches, then compute mineFiles = (currentFiles − baseline) ∪ (explicitly-recorded touches) — a MONOTONIC tightening of 2-A that can never be worse than the shipped baseline-diff. Record touches two ways: a PostToolUse hook on Edit/Write, AND direct appends from the backlog CLIs (claim/resolve/scaffold) so Bash-path mutations of the shared registries are covered. Document the raw-sed residual honestly.

## The hole this closes

2-A (#952) attributes a gate failure to a session only when its file is dirty *now* but **not** in the
claim-time baseline ([we:scripts/readiness/claimScope.mjs:153](../scripts/readiness/claimScope.mjs)). So a
file already dirty at claim that **this** session then breaks stays `external` → demoted to a note →
stepped over (own real red mistaken for foreign). The modal trigger is the shared registries concurrent
batch sessions touch every claim/release. See #953's *Ratification* for the full ruling + red-team.

## Build plan

- **Record explicit touches.** Add an `editedFiles` (or `touched`) array per session row in
  [we:scripts/readiness/claimScope.mjs](../scripts/readiness/claimScope.mjs) (pure module — extend the
  parse/serialize/record/prune surface, keep it fs-free). A small `recordTouch(state, {session, files,
  nowIso})` appends de-duped paths to the session row.
- **Compute mineFiles as a UNION.** `mineFiles = (currentFiles − baseline) ∪ touched`. This is the only
  behavioural change — and it is **monotonic**: the registry can only *add* files to "mine", so the gate
  can never red *less* than 2-A, only catch the own-edit-of-baseline-file case it currently misses.
- **Two recording paths so Bash mutations are covered:**
  1. A `PostToolUse` hook on Edit|Write in [we:.claude/settings.json](../.claude/settings.json) that
     appends the edited path(s) for the active session.
  2. Direct appends from the backlog CLIs — [we:scripts/backlog.mjs](../scripts/backlog.mjs)
     `claim`/`resolve`/`scaffold` already write through one module; have them record the files they splice
     (the backlog `.md`, the registries) against the session, no hook needed.
- **Honest residual.** A mutation path outside *both* Edit/Write and the CLIs (raw `sed`/`node -e` on a
  registry) still rides the baseline-diff with 2-A's residual — document this in the module header
  (and correct the existing "NEVER a foreign red mistaken for clean" line, which #953 found inaccurate).
- **Session keying.** The PostToolUse hook needs the active session slug. Resolve how it learns it
  (env var set at claim, the chat-rename slug, or the single most-recent claim in `we:claims.json`); pick
  the cheapest reliable signal and document it.

## Acceptance

- Unit tests in [we:scripts/__tests__/claimScope.test.mjs](../scripts/__tests__/claimScope.test.mjs)
  cover the union: a file in the baseline that is also a recorded touch is classified `mine` (blocks),
  while a baseline file with no touch stays `external`.
- `npm run check:standards` green; the new hook adds bounded latency only (no gate behaviour change for the
  default no-flag run).

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Built all four parts of the plan:

- **Registry surface (`we:scripts/readiness/claimScope.mjs`)** — added a per-session `touched` array
  (parse/serialize/recordClaim preserve it), `recordTouch(state, {session, files})` (de-duped append,
  **no-op on an unknown session** — a touch is meaningless without a baseline), and `mostRecentSession(state)`
  (the touch-attribution signal). The header's inaccurate "NEVER a foreign red mistaken for clean" line is
  corrected to the honest 2-C stance + the raw-shell residual.
- **Union `mineFiles`** — now `(currentFiles − baseline) ∪ touched`. The only behavioural change, and
  **monotonic**: it can only add to "mine", so it never reds less than 2-A, and it catches the
  own-edit-of-a-baseline-file case 2-A missed.
- **Two recording paths.** (1) A `PostToolUse(Edit|Write)` hook — `we:scripts/readiness/record-touch.mjs`,
  wired in `we:.claude/settings.json` — reads the tool payload, maps the path repo-relative, and appends it
  to the most-recent session's `touched`; **fail-silent by construction** (never breaks the edit). (2) Direct
  CLI appends — `we:scripts/backlog.mjs` records every spliced backlog `.md` via a `recordCliTouch` helper on
  the single `writeBacklogMd` write-point (covers claim/resolve/scaffold/settle), best-effort.
- **Session keying** — the **most-recent claim** (`mostRecentSession`) is the chosen signal: cheapest +
  reliable for a single active batch. Documented residual: two concurrent batches can mis-attribute a touch
  to the other's session, which only ever *adds* a file to the wrong "mine" (an extra safe stop), never hides
  a red. Raw `sed`/`node -e` registry mutations stay invisible to the toucher (the honest 2-A residual).

**Acceptance met:** `we:scripts/__tests__/claimScope.test.mjs` grew a 2-C union block (25 tests total, all
green) — a baseline file that is also a touch → `mine` (blocks); a baseline file with no touch → `external`;
monotonicity; recordTouch dedup/no-op; round-trip; mostRecentSession. The hook was smoke-tested end-to-end
(seeded session → payload → `touched` recorded; out-of-repo path + empty registry both clean no-ops).
`check:standards` green (0 errors).
