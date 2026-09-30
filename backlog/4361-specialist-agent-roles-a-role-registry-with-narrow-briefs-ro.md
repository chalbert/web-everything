---
bornAs: xs57vx3
kind: story
size: 3
parent: "4305"
status: resolved
scope: ["we:skills-src/conveyor/role-test-soak-author-brief.md", "we:skills-src/conveyor/delivery-agent-brief.md", "we:skills-src/conveyor/brief-rule-ledger.json", "we:skills-src/conveyor/__tests__/role-test-soak-author-brief.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-09-30"
dateResolved: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "75d78f50e9b0e1f5c9daeccca8aa902db1cae9f2"
tags: []
---

# Specialist agent roles: a role registry with narrow briefs, routed by complexity — first role: test & soak-break author

Operator direction (2026-09-28 ~3:50 PM ET). Parent #4305 (configurable, combinable delivery and testing strategies) needs a strategy registry; this slices out its role-side counterpart.

### Roles as data
Model a role registry — brief path, model tier by complexity, provider eligibility under the probation gate — alongside #4305's strategy registry. Candidate roles, with today's own evidence: **test & soak-break author** (every daemon fix landed today skipped its soak break and took a waiver); **gate-red test fixer** (#4309's build went gate-red on subprocess-test timeouts); **proof collector** (runs the card's acceptance command before/after and writes the PR evidence); **mechanical-edit role** (model pins, renames — Haiku / Codex / agy-Gemini); **PR-body & statute-wording role**.

### How they are called (operator question, answered)
Mechanically, never as in-session subagents — an in-session subagent inherits the parent's session id and leaves no durable record, so nobody outside the session can see it ran. Instead: the builder (or its wrapper, we:scripts/operations/deliver-item-wrapper.mjs) writes a durable REQUEST marker for a role on its own lane, the same pattern we:scripts/verify-lane.mjs's `request` verb already uses toward the verify daemon. A dispatcher — a NEW launch kind inside the build daemon's tick/dispatch-lane (we:skills-src/conveyor/build-dispatch-daemon.mjs, we:scripts/operations/dispatch-lane.mjs) — starts the specialist as its OWN session with its own brief and model, hands the lane over, and hands it back when done.

### Observability
Every role run is a job record on the job-model core that just landed (#4125, we:scripts/lib/daemon-jobs.mjs): role, item, model, provider, start/end, outcome, tokens. Feed it to the run rating (#4304) and to Plateau /wip (we:backlog/4340-wip-shows-the-daemons-and-what-they-are-really-doing.md, the daemons panel / "running now") so the operator sees each specialist live.

### Phasing
Phase 1 (this card): instructions only — a brief file for the role, plus the builder brief (we:skills-src/conveyor/dispatched-agent-system-prompt.md) telling the builder WHEN to request this role. Phase 2: mechanical dispatch + job records (the REQUEST-marker + dispatch-lane launch kind above). Phase 3: routing by complexity and provider trials.

Start with the **test & soak-break author** role.

## Design

**Premise check (2026-09-30, `main` @ 75d78f50e):** still true. `we:skills-src/conveyor/` holds no role brief for a
test/soak-break author (the only soak-break text is the two one-paragraph bullets at
`we:skills-src/conveyor/delivery-agent-brief.md:149-153` and `we:skills-src/conveyor/fix-agent-brief.md:555-569`), `git log --grep=4361`
shows only the JIT-number commit, and no role registry exists. Phase 1 ("instructions only") is therefore the
whole card; Phases 2-3 (request marker, `dispatch-lane` launch kind, job records, routing) stay future cards.

Mechanism: a new standalone brief, `we:skills-src/conveyor/role-test-soak-author-brief.md`, written for a
*separate session* that is handed a builder's lane after the fix is coded. It states, in steps: (1) read the
builder's diff and decide whether it is a daemon fix (the daemon-fix path list is at `we:skills-src/conveyor/fix-agent-brief.md:555-558`); (2) author the soak break in `we:scripts/conveyor/soak/breaks/` (module + its soak test wrapper
+ registration in the breaks index), mirroring an existing break such as
`we:scripts/conveyor/soak/breaks/prevention-card-lands-in-daemon-clone.mjs`; (3) prove it with `we:scripts/conveyor/soak/red-green.mjs --break=<id>`
(RED pre-fix, GREEN post-fix); (4) hand the lane back with the evidence, or — only for a genuine non-reproducible
case — write the `soak-waiver: <reason>` line for the PR body. The brief names the Phase-2 request/hand-back
contract as *intended* (a REQUEST marker on the lane, like the `request` verb documented at `we:scripts/verify-lane.mjs:48` (handler at `we:scripts/verify-lane.mjs:305-327`))
but does not implement it.

The pointer lands in `we:skills-src/conveyor/delivery-agent-brief.md` (not the standing system prompt the original card named — line 149 is where the soak rule already lives; that is a deliberate deviation). It is a pure ADDITION, never a reword of an existing line: that file has ~138 ledger entries keyed by a hash of each imperative line, so rewording re-keys and breaks them. The builder brief gets one short pointer in the existing soak bullet (`we:skills-src/conveyor/delivery-agent-brief.md:149`): when the
fix is a daemon fix, request/consult this role's brief ("WHEN to request"), falling back to today's inline
instruction until Phase 2 exists. `we:skills-src/conveyor/brief-rule-ledger.json` gets entries (written LAST, once the brief text is final — any later edit re-keys them; status `judgment`, since no script decides these) for the new brief's imperative lines
(the ledger `--check` fails on unlisted lines).

## MVP

Musts only:
- `we:skills-src/conveyor/role-test-soak-author-brief.md` — the role brief (steps above, exits, guardrails).
- One added (not reworded) pointer in `we:skills-src/conveyor/delivery-agent-brief.md` telling the builder when to request the role.
- Ledger entries for the new brief's imperative lines (`status: judgment`). NB: the global `--check` is ALREADY red on main (45 unlisted lines in the prepare-item briefs, 1 stale v2-brief entry) — that is pre-existing and out of scope; this card only owes zero unlisted/stale lines for its own brief.
- A vitest test pinning the above.

OUT of scope (see Follow-ups): registry data file, REQUEST marker, dispatch launch kind, job records, routing, the other four roles, cleaning the pre-existing ledger reds.

## Test plan

`we:skills-src/conveyor/__tests__/role-test-soak-author-brief.test.mjs` (vitest, like `we:skills-src/conveyor/__tests__/bug-fix-before-after-proof-rule.test.mjs`):
- *role brief exists and carries its anchors* — reads the file; asserts it contains the anchors: `we:scripts/conveyor/soak/red-green.mjs`, `soak-waiver`, `we:scripts/conveyor/soak/breaks/`, and the daemon-fix paths (`we:skills-src/conveyor/`, `we:scripts/conveyor/`, `we:scripts/lane-pool`). RED today: file missing (ENOENT).
- *builder brief points at the role* — asserts `we:skills-src/conveyor/delivery-agent-brief.md` links `we:skills-src/conveyor/role-test-soak-author-brief.md`. RED today: no link.
- *ledger covers the new brief* — calls `auditLedger(readBriefs(), loadLedger())` from `we:scripts/conveyor/brief-rule-ledger.mjs`, filters to the new brief's path (and `we:skills-src/conveyor/delivery-agent-brief.md`), asserts no unlisted/stale line. RED if the brief is added without entries; vacuously guarded by case 1 today.

## Proof plan

Before/after on real surfaces: `grep -c "soak-waiver" we:skills-src/conveyor/role-test-soak-author-brief.md` (file missing before, >=1 after); `grep -c role-test-soak-author-brief we:skills-src/conveyor/delivery-agent-brief.md` (0 before, >=1 after); `node we:scripts/conveyor/brief-rule-ledger.mjs --json` filtered to the new brief shows no unlisted line; `npx vitest run we:skills-src/conveyor/__tests__/role-test-soak-author-brief.test.mjs` fails on the parent commit and passes on the PR head.

## Follow-ups

- Phase 2: REQUEST marker + `dispatch-lane` "role" launch kind + job records on `we:scripts/lib/daemon-jobs.mjs` (#4125).
- Phase 3: complexity routing and provider trials under the probation gate.
- Role registry data file alongside #4305's strategy registry.
- Remaining roles: gate-red test fixer, proof collector, mechanical-edit role, PR-body/statute-wording role.
- Feed role runs to run rating (#4304) and Plateau /wip (#4340).
- Clear the pre-existing global ledger reds (45 unlisted, 1 stale).

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/role-test-soak-author-brief.test.mjs` fails before this item lands and passes after.
