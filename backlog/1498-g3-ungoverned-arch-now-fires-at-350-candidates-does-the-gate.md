---
kind: decision
status: resolved
researchTopic: g3-ungoverned-arch-scope
preparedDate: "2026-06-21"
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
codifiedIn: "docs/agent/backlog-workflow.md#principle-conformance-pre-flight--readiness-is-conformance-not-just-mechanics-608"
tags: [audit, backlog-health, governance, gate, decision]
---

# G3 ungoverned-arch now fires at 350 candidates — does the gate need a recency scope or stronger lineage filter?

Repairing the dead `isExec` predicate (#1473) brought G3 (ungoverned-arch) from inert (0) to **350
candidates** — every resolved build that graduated to an entity with no governing `type:decision`
reachable. That is the gate working as designed (a judgment CANDIDATE class), but 350 is too voluminous
to action as a pre-flight signal. Decide how to make it actionable. Surfaced by #1473.

## Grounding digest

*(Numbers reproduced live from this tree, 1483 items, by re-running the G3 predicate; see
[`/research/g3-ungoverned-arch-scope/`](/research/g3-ungoverned-arch-scope/) for the full survey.)*

- **What G3 flags** (`we:scripts/audit-backlog-health.mjs:371`): a resolved non-decision build with
  `graduatedTo` set, **no** decision in its transitive `parent`/`blockedBy` lineage
  (`:282`), and **none** cited in prose (`:295`). It is read-only and non-blocking — a CANDIDATE pool a
  human/agent skims pre-flight (`check:health`), **not** a hard gate.
- **The pool is not noise from a too-narrow lineage walk.** Of the 350: only **11** mention
  `we:docs/agent/platform-decisions.md` in body, only **2** cite *any* decision (incl. open), **0** carry
  a `codifiedIn`. The #612-hardened walk isn't missing edges — these builds genuinely have no decision in
  any form.
- **The pool IS a subject-scope problem.** Of the 350, **306 graduate to a FILE PATH**
  (`we:scripts/autofix/engine.mjs`, `we:src/_includes/...` — routine impl) and only **45 to a named
  `<kind>:` entity**, of which **41 are standard-entity kinds** (block 27 · intent 4 · project 6 ·
  adapter 3 · protocol 1; plug/capability 0) and 4 are `demo:`. The 41 entity-graduations are the real
  violation class (`block:pagination` #36, `block:data-grid` #123, `block:dialog` #376,
  `intent:collection-operations` #60, `protocol:report-model` #431, `project:webcompliance` #351 …) —
  new named standard entities that shipped with no governing decision. G3 over-fires (350/827 graduated
  builds = 42%) because it counts routine file-path impl as "architecture."
- **Recency cannot discriminate here.** The whole backlog's resolved history is compressed into June
  2026 (1466/1483 items `dateOpened` 2026-06). Of the 350, only **253 are git-datable** (a real
  `status:resolved` flip — `:266`), all in 2026-06; the other **98 are import-born / born-resolved with
  no usable date**. And recent resolves *dominate*: **172 of 253** datable resolved in the last 3 days, so
  "resolved after the governance discipline began (`we:docs/agent/platform-decisions.md`, 2026-06-18)"
  still leaves ~181 datable + 98 undatable ≈ **279**.

## The axis — how does G3 become an actionable pre-flight signal?

The complaint is volume-as-noise: a pre-flight CANDIDATE pool must be (a) skimmable in count and (b)
actionable per hit. Three named directions: scope by **recency**, add a **stronger lineage filter**, or
demote to **full-pool audit-only**. The grounding reshapes them. *Recency* is data-disproven (no clean
temporal boundary in a compressed, partly-undatable history; the recent resolves are the bulk).
*Stronger lineage filter*, read as "detect more governance edges," shaves ~11 — but read as a stronger
**subject** filter it is the fix: the "ungoverned architecture" violation is a **new named standard
entity** with no decision, not a routine file landing in an existing subsystem. Scoping G3's subject to
entity-graduation (`graduatedTo` matches `^<kind>:` for a standard-entity kind, excluding file-path and
`demo:`) drops 350 → **~41**, actionable and principled. *Audit-only* is the coherent fallback but
abandons the pre-flight value; the subject-scope keeps it **and** restores actionability, with the full
350 still in the report as a G6-style legacy inventory.

Two within-repo precedents anchor this. **G6 is explicitly "the catch-up pool for the LEGACY decisions
resolved before this gate existed — it should only ever shrink"** (`we:docs/agent/backlog-workflow.md:196`):
a gate activated late lights up the whole pre-discipline history, and the sanctioned treatment is a
*shrinking legacy inventory*, not an action list — G3's 350 is the same phenomenon (resurrected by #1473
over history predating the decision-as-work-item discipline). And **`--scope=<batch-slug>`** (#957/#949,
`we:scripts/audit-backlog-health.mjs` scope mode) already demotes pre-existing `check:health` findings to
a non-failing note and surfaces only the session's claimed items — so within a batch the actionability is
already half-solved; the *unscoped summary count* is what still reads 350. G4/G5/G7 stay small precisely
because they key on a **narrow subject**; G3 is the only over-broad one.

## Recommended path at a glance

| Fork | Question | Options | **Recommended default** | Confidence |
|------|----------|---------|------------------------|------------|
| 1 | How is G3 made actionable? | (a) scope subject to entity-graduation (~41) · (b) recency scope · (c) full-pool, audit-only | **(a) scope subject to entity-graduation** | med-high (~75%) |
| 1·sub | Disposition of the excluded file-path pool | drop entirely · retain as non-counted audit INFO | **drop from the count; the report already retains the full list** | med (~70%) |

## Fork 1 — how should G3 be made actionable (350 is un-actionable as a pre-flight signal)?

*Fork-existence:* the **flawed/excluded branch is (b) recency** — positively disproven, not asserted: the
backlog's resolved history is compressed into June 2026 with 98 import-born undatables, and 172/253
datable resolves fall in the last 3 days, so a date boundary leaves ~279 and cannot classify the
undatables at all (grounding digest). That removes recency as a coherent end-state. The genuine
either/or is then **(a) narrow the subject** vs **(c) demote the role** — both coherent, but mutually
exclusive as *the* pre-flight treatment (you either keep G3 in the pre-flight count with a narrowed
subject, or you take it out of the count): which one defines the signal is the merit call.

- **(a) Scope the subject to entity-graduation.** Change the G3 predicate
  (`we:scripts/audit-backlog-health.mjs:371`) to fire only when `graduatedTo` names a **standard entity**
  — `^(block|intent|protocol|project|plug|capability|adapter):` and not a repo path — excluding the 306
  file-path graduations and the 4 `demo:` ones. *Result:* 350 → **~41**, a reviewable CANDIDATE pool of
  genuine "a new named standard entity shipped with no governing decision" cards. *Principle:* a
  governance gate's subject is **governable architecture** (a new named entity), not routine impl; a file
  landing in an existing subsystem implements already-settled arch and rarely warrants a fresh decision.
  Keeps G3's pre-flight value (catch a new ungoverned entity before it's buried) **and** restores
  actionability. The full 350 stays visible in the report (the section already lists up to 200 + an
  "…and N more" tail), so no inventory is lost.
- **(c) Full-pool, demote to audit-only.** Keep all 350 but drop G3 from the pre-flight candidate count —
  report-only inventory, like a frozen G6-style legacy pool. *Tradeoff:* honest and zero-tuning, but it
  **abandons the pre-flight signal entirely** — a *new* ungoverned entity shipped tomorrow sinks into a
  350-line report instead of surfacing. (a) achieves the same "don't action 350 retroactively" outcome
  while *keeping* the forward signal, so (c) is strictly weaker on the thing that matters.
- **(b) Recency scope** — *Rejected* (fork-existence flawed branch): data-disproven above; cannot
  separate signal from noise in this history and can't classify the 98 undatables.

**Recommended default: (a) scope the subject to entity-graduation.** ~75% confidence. Rationale: it is
the only option that both shrinks the pool to actionable (~41) **and** preserves the forward pre-flight
value, and it rests on a reusable principle (subject = governable architecture, not impl) rather than a
tuning knob. *The residual ~25%:* a genuine new subsystem shipped as a **file-path** `graduatedTo`
(autofix engine #95, `<component>` transform POC #48, the webanalytics plug runtime #1003) escapes the
entity filter — accepted, because such subsystems are normally governed one epic-hop up and the judgment
skim (catalog A–E pre-flight) catches the rest; if that miss is observed to matter, widen the subject to
include a curated set of "new-subsystem" path roots, a cleanly reversible tightening.

**Skeptic:** SURVIVES-WITH-AMENDMENT. The skeptic attacks: "entity-vs-file-path is a noisy proxy — you'll
miss the real arch (#95, #48, #1003 are new subsystems shipped as paths)." Counter: true, and that is the
stated ~25% residual — but the alternative is a 350-pool nobody actions, where those same items are
*also* lost in the noise; (a) makes 41 reviewable while keeping the full list in the report, strictly
dominating the status quo. The amendment the attack forces: **do not silently drop** the 306 — keep them
in the report (handled by the sub-fork) so the residual stays visible, not erased. The default holds.

### Fork 1 sub-fork — disposition of the excluded file-path pool

Given (a), the 306 file-path graduations leave the *count*. Two coherent ends: **drop them entirely**
(not a governance violation — impl needs no decision) vs **retain them as a non-counted audit INFO
sub-list** (preserve the inventory for an occasional sweep). **Recommended: drop from the count, but rely
on the report already retaining the full G3 list** — i.e. the predicate narrows what's *counted/flagged
as G3*, while the report can still show the broader graduated-without-decision set under the existing
section if desired. ~70%. Rationale: a standing 306-line INFO block nobody actions is exactly the noise
this decision removes; the file-path class is *impl*, and "impl needs no governing decision" is the
principle — so it should not read as a violation at all. *Residual:* if periodic visibility of the
file-path pool proves useful, add it as an explicitly-labeled `INFO`/audit-only sub-section (the G1 INFO
demotion at `:352` is the existing pattern to copy), never back into the counted pool.

## Ruling — RATIFIED 2026-06-21

**Fork 1 → (a) scope G3's subject to entity-graduation.** Sub-fork → drop the file-path pool from the
count (no standing INFO block). Ratified after live re-grounding: the predicate was reproduced
(G3 = 353 at claim, up 3 from the 350 at prep via concurrent resolves) and the entity-vs-file-path split
confirmed independently (of 864 resolved+graduated items, 700 file-path / 155 entity / 9 demo — file-path
dominates 81%, the structural claim holds). The skeptic's entity-vs-path-proxy attack (path-shipped
subsystems #95/#48/#1003 escape) is the booked ~25% residual, reversibly widenable; attack failed, default held.

**Shipped this turn** (G3: 353 → **41**):
- `we:scripts/check-standards-rules.mjs` — `isEntityGraduation` + `STANDARD_ENTITY_KINDS` (homed beside
  `isExecKind`, the importable/pinnable rules module).
- `we:scripts/audit-backlog-health.mjs` — G3 predicate gates on `isEntityGraduation`; doc comment + summary
  `desc.G3` + section head updated.
- `we:scripts/__tests__/exec-kind.test.mjs` — 4 new cases pin entity-vs-file-path (kinds, locus paths, bare
  paths/demo/free-text/none, the `:`-anchor discriminator).
- `we:docs/agent/backlog-workflow.md` — codified the reusable rule (the `codifiedIn` target).

## Implementation on ratify

- Edit the G3 predicate at `we:scripts/audit-backlog-health.mjs:371` to gate on an
  `isEntityGraduation(graduatedTo)` helper (`^(block|intent|protocol|project|plug|capability|adapter):`
  and not a repo path); update the G3 doc comment (`:24`, `:369`) and the summary `desc.G3` (`:493`) to
  "graduated to a **new standard entity** with no governing decision."
- Extend `we:scripts/__tests__/exec-kind.test.mjs` (or a sibling fixture) to pin the entity-vs-file-path
  classification so a future `graduatedTo` grammar change can't silently re-broaden or re-kill G3.
- **Codify the rule** (`codifiedIn` on resolve): "a governance gate's subject is *governable
  architecture* — a new named standard entity — not routine impl (a file-path graduation)." Statute-layer
  material for `we:docs/agent/platform-decisions.md` or the `check:health` section of
  `we:docs/agent/backlog-workflow.md`. This is a reusable rule, not a one-off.

## Context

- **Surfaced** 2026-06-21 by #1473 (the `isExec` repair that resurrected G2/G3). G3 went 0 → 350; this
  item scopes it. The sibling attribution mechanism (`--scope`, #957/#949) is complementary, not a
  substitute — it scopes *by changeset owner*; this scopes *by subject* (what counts as arch). Both can
  apply: a batch run already sees only its own G3 hits; this fix makes the *unscoped* count meaningful.
- **Classification:** repo-internal backlog devtools/workflow tooling — **not a WE standard**
  (impl-is-not-a-standard, minimize-lock-in). No protocol minted; only the codified *rule* crosses into
  the statute layer.
- **Not a fork:** whether G3 should *exist* (settled — an existing gate being scoped, not removed); the
  `--scope` changeset mechanism (already shipped, orthogonal axis).
