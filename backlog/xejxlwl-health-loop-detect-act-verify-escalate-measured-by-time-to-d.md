---
kind: epic
parent: "4075"
status: open
dateOpened: "2026-09-28"
tags: []
---

# Health loop: detect, act, verify, escalate — measured by time-to-detect and time-to-recover

Operator ruling (2026-09-28 ~8:35 PM ET): tracking of health and automatic rapid action must improve. Six incidents today were each found and fixed by a person even though we:scripts/conveyor/health-watch.mjs (#4077/#4078, ratified #4065) had already flagged several of them (draft-not-promoted, red-pr-unattended, daemon-silent) and nothing consumed or acted on the flag: builder frozen then idle for hours (fixed by hand); Codex advisory review seats out of quota crashed every review job, twice (~2h, workers); lanes reset while owners were still alive (~1h, daemons paused by hand); plateau#187 never promoted on a cross-repo --repo bug (~1h, promoted by hand); misleading awaiting-ci labels; stale builder claims released only in an emergency. This epic closes the loop: user-felt SLO checks (not just internal daemon signals), each with a declared FIRST ACTION in a policy-data playbook (re-dispatch, switch provider, release a stale claim, pause a daemon, promote, relabel, or open a #4078 diagnose-only investigation), a VERIFY step after the action, an ESCALATE path when not recovered in N minutes (the orchestrator via card xjnidoc's live health stream once it lands, then an operator push notification today via the existing we:scripts/conveyor/health-watch.mjs desktop-notify path), and time-to-detect/time-to-recover METRICS per incident. The playbook is policy DATA, mirroring the we:backlog/xv0h3mp-*.md delivery-policy-as-configurable-dimensions direction (#4305) and rule 51 (hookable vs judgment), never hand-rolled per-incident code. MVP cut (below) ships two checks end-to-end; every other evidence-row check and design axis is a follow-up slice filed separately.

## Today's evidence (2026-09-28, the operator's own review)

| Incident | Found by | Time to fix | How fixed | Already flagged by the health daemon? |
| --- | --- | --- | --- | --- |
| Builder frozen, then idle | Operator | Hours | By hand | Partially — `daemon-owed-no-dispatch` alerts, never acts |
| Codex advisory review seats out of quota crashed every review job (twice) | Operator | ~2h | Workers | No — no check on review-job completion at all |
| Lanes reset while owners still alive | A worker | ~1h | Daemons paused by hand | No |
| `plateau#187` never promoted (cross-repo `--repo` bug) | Operator | ~1h | Promoted by hand | Yes — `draft-not-promoted` flagged it |
| Misleading `awaiting-ci` labels | Operator | — | — | No |
| Stale builder claims | Orchestrator | — | Emergency releases | No |

The last column is the actual gap this epic closes: `we:scripts/conveyor/health-watch.mjs` (#4077, ratified
#4065) already runs 23 registered smells (`we:scripts/conveyor/health-smells/index.mjs`) that alert, diagnose,
or (per #4078) dispatch a read-only investigation — but **nothing acts, verifies, or escalates past a desktop
notification**. `daemon-silent`/`daemon-owed-no-dispatch`/`red-pr-unattended` all fired their share of tonight's
incidents and produced only a report line nobody consumed until reviewing this session's own transcript.

## Full design

**1. User-felt SLO checks, not just internal signals.** Every check in this epic states a symptom the operator
or a downstream consumer actually experiences, not merely "this internal counter moved":
- "no review completed in N min while reviews are owed" (new — MVP, below)
- "builder dispatched 0 in N ticks while work is queued and not frozen" (existing `daemon-owed-no-dispatch`,
  `we:scripts/conveyor/health-smells/daemon-owed-no-dispatch.mjs` — MVP wires its first action)
- "provider allowance exhausted" (partially covered today by `gh-graphql-budget`/`gh-call-failures`,
  `we:scripts/conveyor/health-smells/gh-graphql-budget.mjs` / `we:scripts/conveyor/health-smells/gh-call-failures.mjs`,
  neither of which reads the per-review-seat quota/cooloff `we:scripts/operations/review-extra-seats.mjs`
  already tracks — the MVP's "reviews not completing" check is the first to read that signal)
- "label contradicts state" (new — a follow-up; the misleading `awaiting-ci` label incident names it directly)
- "lane reset while owner alive" (new — a follow-up; distinct from `lane-starvation`,
  `we:scripts/conveyor/health-smells/lane-starvation.mjs`, which measures free-lane COUNT, not a live owner's
  lane vanishing under them)
- "PR idle > N min" (new — a follow-up; distinct from `red-pr-unattended`'s CI-red-specific trigger)

**2. Each check has a declared FIRST ACTION in a playbook (policy data).** The action is a `{command, args,
timeoutMs}` shape — the SAME shape `we:scripts/conveyor/health-watch-core.mjs`'s existing `diagnose` field
already uses for its read-only diagnoses (`planActions`, `we:scripts/conveyor/health-watch-core.mjs`) — not
hand-rolled per-incident code. This mirrors both rule 51 (hookable vs judgment: a script-decidable action
belongs in data, not re-derived by an agent each time) and the direction the sibling
`we:backlog/xv0h3mp-*.md` epic (delivery policy as configurable dimensions, #4305) is taking process rules in
general: a named, enumerated policy dimension, not a rule scattered across a smell file and an agent's memory.
This epic does not build that engine (xv0h3mp's own scope) — it ships the first two concrete playbook actions
as smell-local data, in the same place `diagnose` already lives, so xv0h3mp's future engine has real examples
to generalize from rather than a blank slate.

**3. VERIFY after the action.** A new step in the episode lifecycle
(`we:scripts/conveyor/health-watch-core.mjs`'s `stepEpisodes`): after an `act` plan entry runs, the NEXT
tick(s) re-evaluate the same smell; the episode closes normally (existing `closeAfter` hysteresis) if the
symptom cleared. If it has not cleared after a configured `verifyAfterMs`, the episode is marked unrecovered
and ESCALATES — never a second automatic retry without new evidence (an action that didn't work is a signal
to tell a human, not to hammer the same lever again).

**4. Escalate.** Two rungs, per the operator's own text: (a) the orchestrator, via `we:backlog/xjnidoc-*.md`'s
live health-events push stream, once that card's `/health/ws` endpoint exists — this epic's escalation wiring
publishes to it the moment it lands, no separate integration card needed; (b) an operator push notification —
today that is the existing best-effort desktop notification (`notifyDesktopChecked`,
`we:scripts/conveyor/health-watch.mjs`), already real and already wired for any smell id in
`we:scripts/conveyor/health-smells-notify-list.mjs`'s `NOTIFY_EVEN_IN_SHADOW`.

**5. Metrics: time-to-detect and time-to-recover, per incident.** An episode already carries `firstBreachAt`
and `openedAt` (detect delay = `openedAt - firstBreachAt`, the `openAfter` hysteresis) and, once closed,
`closedAt` (recovery time = `closedAt - openedAt`) — `we:scripts/conveyor/health-watch-core.mjs`'s
`stepEpisodes`. This epic names those two derived numbers explicitly (rather than leaving them implicit in
timestamps a consumer must re-derive) and is the first surface to actually show them anywhere — the plan
page / Plateau `/wip`, mirroring the same "record it once several examples exist" discipline
`we:backlog/xtw16qn-*.md` (the prepare rule this epic itself was filed under) applies to its own
`reviewRounds`/`scopeGrowthCount` measurement fields.

**6. Every incident class from today gets its check + playbook entry** — see the evidence table's last column
above; the two rows without a "Yes/Partially" are follow-up slices (below), never silently dropped.

## MVP cut (this epic's first slice — Musts only)

**Must** — the MVP story pinned under this epic (`we:backlog/x3td0r6-*.md`): two checks — "reviews not
completing" and "builder idle while work queued" — each get automatic first action + verify + escalate
end-to-end, escalation rung (b) only (desktop notification; rung (a), the live stream, rides along
automatically once `we:backlog/xjnidoc-*.md` lands, with no new work here since the publish call is
best-effort and additive).

**Must** — the generic action+verify+escalate mechanism on the episode model
(`we:scripts/conveyor/health-watch-core.mjs`) is built ONCE, generically, not duplicated per check — every
later check (the follow-ups below) reuses it by supplying its own `action`/`verifyAfterMs`, never its own
copy of the verify/escalate control flow.

**Must** — the mechanism ships gated OFF by default (mirrors #4078/#4079's own "stays off in shadow until the
operator turns it on" discipline) since this is the health daemon's first-ever capability to WRITE into
another subsystem's state rather than only read and report.

**Could (real, already designed above, not built now) — filed as follow-up slices under this epic once the
MVP is live and proven:**
- "provider allowance exhausted" as its own general check (today's MVP only reads the review-seat allowance
  gate for the one check that needs it).
- "label contradicts state" and "lane reset while owner alive" — two of today's six incidents, new smells.
- "PR idle > N min" — a general staleness check distinct from `red-pr-unattended`.
- The `we:backlog/xv0h3mp-*.md` policy-as-configurable-dimensions ENGINE generalizing this epic's playbook data
  shape (WE ships the shape as data here; xv0h3mp ships the schema/engine/settings-UI).
- Escalation rung (a)'s consumer-side proof once `we:backlog/xjnidoc-*.md` ships its Worker routes (this
  epic's own publish call is Must; the end-to-end live proof depends on that sibling card's own delivery).
- Time-to-detect/time-to-recover shown on the plan page / Plateau `/wip` (the MVP only NAMES and records the
  two numbers on the episode; a dedicated display surface is separate, real, product work).
- Phone push (subscriber 3 of `we:backlog/xjnidoc-*.md`'s own full design) once a push-provider is chosen.

**Review gate:** blocks only on an MVP Must above being unmet, or genuine harm (an automatic action that
mutates state with no verify/escalate backstop) — never on a Full-design item being deferred to a follow-up.

## Done when

This is a vision epic with no single executable acceptance check — same shape as its parent #4075 and sibling
`we:backlog/xv0h3mp-*.md` — so it resolves the normal way, by every sliced child card resolving (rule:
resolve-epic-by-parent-edges). First child is the pinned MVP story `we:backlog/x3td0r6-*.md`; the follow-up
slices above are filed separately as the MVP proves out live.
