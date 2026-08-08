---
bornAs: xbzq6pc
kind: decision
size: 3
status: active
scaffoldedBy: "agent-operation-catalog"
dateScaffolded: "2026-08-08"
dateOpened: "2026-08-08"
preparedDate: "2026-08-08"
tags: [guard, agent-surface, orchestrator-mechanization, security]
relatedTo: ["2986", "2994", "2749", "2788", "2302"]
relatedReport: reports/2026-08-08-agent-command-surface-sizing.md
scope:
  - we:scripts/guard-bash.mjs
  - we:docs/agent/platform-decisions.md
---

# Should agents call named operations instead of writing shell?

Rule whether agent sessions keep writing free-form shell guarded by a deny-list, or call a typed,
allow-listed **operation catalog** the mechanical layer executes — and how an agent reports a capability gap
when no operation covers what it needs. **Two coupled forks** below, each carrying a recommended default in
**bold**, grounded in a measurement of all 64,752 `Bash` calls across 4,485 local sessions
([the sizing report](reports/2026-08-08-agent-command-surface-sizing.md)).

### Recommended path at a glance

| | recommended default | main alternative | confidence |
| --- | --- | --- | --- |
| Fork 1 | **(c) split by mutation — reads free and sandboxed, mutations only via typed operations** | (a) keep free shell behind the deny-list guard | med-high |
| Fork 2 | **(a) capability-gap notes ride the existing learnings pool** | (b) a dedicated gap channel | high |

## Why this is live now

The end-state direction is a web UI that mechanically drives the work, with Claude launched to *operate*. That
makes "how does a session run a command" a design question rather than an accident of tooling.

The forcing evidence is the command guard. Six review rounds tried to enumerate every way a command hands a
hidden script back to the shell; each round found more. The sixth reviewer found why: the fuzz generator's
wrapper list *was* the list of classes the previous fix had implemented, so three million generated pairs could
only re-prove what was already handled. **An enumeration cannot be completed from inside the thing being
enumerated.** A deny-list over shell is unbounded; an allow-list over operations is finite by construction.

The question was never which is safer in principle. It was whether the finite list is small enough to build.

## Fork 1 — How does an agent session run a mutating command?

*Why this is a fork:* the branches cannot coexist. Either the unknown command is allowed by default (deny-list)
or refused by default (allow-list). That single choice decides whether every future gap arrives as a **hole
found later** or as a **stalled agent reporting it now**, and it is not a cost question — it is where authority
sits.

**The crux, measured.** Across 295,923 classified command segments:

- **6.7%** of what agents run mutates anything at all (19,845 segments). Reads are 72.2%, `cd` another 12.9%.
- **25 named operations cover 90%** of all mutations; 34 cover 95%; the full tail is 232.
- **Shell re-entry — the whole subject of the six guard rounds — is 74 segments in 295,923 (0.03%).** Counting
  generously from raw text, every re-entry-ish spelling together reaches 1.7% of calls, and the genuinely
  unparseable forms are ~120 calls in 64,752.
- **~83 named operations already exist** — 18 slash commands plus 65 `we:scripts/*.mjs`.

- **(a) Keep free-form shell behind the deny-list guard.** The status quo. No migration, and every existing
  workflow keeps working. But the unknown case falls **open**: an unlisted spelling is allowed, so each gap is
  discovered as an incident. Six rounds is the evidence that closing the list is not convergent.
  *Rejected as the default* — the failure mode is structural, not a matter of more effort.
- **(b) A typed operation allow-list for everything, reads included.** Maximum control and a single audited
  surface. But reads are 72% of volume and carry no catastrophic failure mode, so the coverage burden lands
  almost entirely where the risk is not. *Rejected* — this is where operation-catalog designs usually die.
- **(c) Split by mutation.** **RECOMMENDED DEFAULT.** Reads and inspection stay free, broad, and sandboxed —
  the agent runs them itself. Anything that mutates state **outside the agent's own lane clone** (writes to the
  primary checkout, `git push`, `gh`, network, installs, deploys) goes only through a named operation with
  **typed parameters**, executed by the mechanical layer, failing **closed**. This buys the fail-closed
  property where it matters at roughly 6.7% of the coverage cost.

**Sub-decision (ratify with the fork): parameters are strictly typed.** An operation like
`run(script, args)` that passes strings through to a shell re-imports the entire enumeration problem behind a
friendlier name; `pr.merge(number: int)` does not. This is the difference between an allow-list and a rename,
and it should be ratified as part of (c) rather than left to implementation.

**Sandboxing is not an alternative branch.** A sandbox bounds *damage*; an allow-list bounds *authority*. A
sandbox does not stop a force-push to `main` or a `gh pr merge` — legal actions with real credentials, and the
ones that hurt here. Both are wanted; neither substitutes for the other.

**Open sub-question, not ratified here:** `curl` at 593 observed uses. `net.fetch` needs a host allow-list, or
it becomes the escape hatch that reopens everything (1).

## Fork 2 — How does an agent report that no operation covers what it needs?

*Why this is a fork:* an allow-list with no gap-reporting is a prison that silently degrades — the agent works
around the denial and the catalog never learns. The branches differ in whether the report is adjudicated
in-session, and that is the same seam the harvest split already settled.

- **(a) Capability-gap notes ride the existing learnings pool.** **RECOMMENDED DEFAULT.** Same shape as the
  harvest pipeline: the session **emits** (what it was trying to do, what it would have run, what it did
  instead) and never adjudicates; a periodic pass dedups, ranks by recurrence, and routes survivors to
  catalog additions. No new machinery, and denials become a **ranked, demand-driven build list** — the exact
  inverse of the six-round failure, where the enumeration was generated from inside itself.
- **(b) A dedicated gap channel.** Cleaner separation and a purpose-built schema, at the cost of a second
  emit/dedup/route pipeline to maintain alongside one that already works. *Rejected* — real, but it duplicates
  a solved seam.
- **(c) No channel; denials are just denials.** Cheapest, and wrong: it is what makes an allow-list degrade
  into a workaround generator. *Rejected.*

## Bearing on the open guard call

This item does **not** rule the guard decision — that call stands on its own. It supplies one measured input:
the cost of *"refuse what the guard cannot resolve"* falls on under 0.2% of calls, so the false-deny sweep that
sizes it is cheap; while a further round of enumeration would be investment in an asset this direction
demolishes.

## Notes

(1) `curl` is counted as a mutation in the sizing report because it reaches the network, not because it always
writes. The host-allow-list question is filed here as an open sub-question rather than a ratifiable fork —
it needs its own survey of what agents actually fetch.

**Measurement caveat.** The command splitter used for the sizing is approximate by design — it sizes a
catalog, it does not enforce anything. Its errors run toward over-counting mutations, so the real catalog is
likely smaller than the figures above, not larger.
