---
kind: decision
status: open
researchTopic: build-kind-exec-vocabulary
relatedReport: reports/2026-06-22-build-kind-exec-vocabulary.md
preparedDate: "2026-06-22"
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
tags: [audit, backlog-health, governance, gate, kind-axis, decision]
---

# Audit isExec build-kind vocabulary — which kinds gate G2/G3 now that idea/issue are gone?

## Grounding digest

*No design is greenfield here — this decision **ratifies shipped/consistent code**. The canonical
build-kind rule already exists; the audit's exec predicate is the one place still on dead vocabulary.
The two forks below are grounded in a prior-art survey published as
[`/research/build-kind-exec-vocabulary/`](/research/build-kind-exec-vocabulary/) (session report:
[`we:reports/2026-06-22-build-kind-exec-vocabulary.md`](../reports/2026-06-22-build-kind-exec-vocabulary.md)),
each with a **bold** recommended default. Numbers reproduced live from this tree (1536 items).*

- **The bug:** the backlog-health audit's exec gate is `const isExec = it.type === 'idea' || it.type === 'issue'`
  (`we:scripts/audit-backlog-health.mjs:334`). The kinds `idea`/`issue` were removed in the kind-axis
  migration; the live set is `story / decision / task / epic` (`we:scripts/check-standards-rules.mjs:28`,
  `BACKLOG_KINDS`). So `isExec` is **always false** → G2 (built-ahead-of-ruling, `:354`) and G3
  (ungoverned-architecture, `:366`) **silently never fire**. Commit `e9c6fca` fixed only the *field read*
  (`fm.type → fm.kind ?? fm.type` at `:102`), not the *predicate*.
- **The canonical rule already exists, in three consistent homes** — the repair is *wiring*, not design:
  - `we:scripts/readiness/proposer.mjs:38` — `const isBuildable = (it) => it.kind !== 'decision'`
    (the proposer drafts a next-build for every non-decision kind; epic included as the umbrella).
  - `we:scripts/check-standards-rules.mjs:34` — `export const isExecKind = (kind) => kind !== 'decision'`,
    authored beside `BACKLOG_KINDS` with the explicit comment that it *is* the canonical form of the
    proposer's `isBuildable` and the backlog-health audit's G2/G3 exec gate (`:30-33`).
  - `we:scripts/__tests__/exec-kind.test.mjs` — pins `isExecKind` (every non-decision kind incl. `epic`;
    excludes `decision`; auto-covers a hypothetical new kind; guards the silent-death vector of renaming
    `decision`).
- **Epic edge, grounded:** 121 epics; 37 resolved with `graduatedTo` set; **6 graduate directly to a
  named standard entity** (#049→`block:component`, #351→`project:webcompliance`, #468→`project:webblocks`,
  #570→`project:webcharts`, #618→`project:webediting`, #1023→`project:webreporting`). Of those, **4 are
  unique to the epic** (no child carries the same noun) and only 2 are duplicated by a child (#351↔#436,
  #618↔#629) — see Fork 2.

## The axis

The concern decomposes into two orthogonal axes the survey surfaced. **Axis 1 — vocabulary repair:**
replace the dead `idea|issue` enumeration; the broken branch (`idea`/`issue`) literally does not exist
in `BACKLOG_KINDS` (`we:scripts/check-standards-rules.mjs:28`), so this is a *forced invariant* — the
only live sub-question is whether to **import** the canonical `isExecKind` (`we:scripts/check-standards-rules.mjs:34`)
or inline a fresh `!== 'decision'` literal in the audit. **Axis 2 — kind breadth:** does the gate count
*all* non-decision kinds (story/task/**epic**), matching `we:scripts/readiness/proposer.mjs:38`, or
narrow to leaf builds (story/task) and exclude **epic** umbrellas? This is the one genuine small call,
and it is a *kind*-axis question — distinct from the orthogonal *subject*-axis question of which
`graduatedTo` values are governable architecture (the G3 predicate at `we:scripts/audit-backlog-health.mjs:366`,
owned by the resolved sibling #1498).

## Recommended path at a glance

| Fork | Question | Options | **Recommended default** | Confidence |
|------|----------|---------|------------------------|------------|
| 1 | How is the dead `idea\|issue` predicate replaced? | (a) import canonical `isExecKind` · (b) inline a fresh `!== 'decision'` literal | **(a) import `isExecKind` from `we:scripts/check-standards-rules.mjs`** | high (~95%) |
| 2 | Which kinds count as exec/build for G2/G3? | (a) all non-decision incl. epic (story/task/epic) · (b) leaf builds only (story/task), exclude epic umbrellas | **(a) all non-decision, include epic** | med-high (~80%) |

## Fork 1 — how is the dead `idea|issue` predicate replaced?

*Fork-existence:* the **flawed/excluded branch is the status quo** (`it.type === 'idea' || it.type === 'issue'`)
— a *forced invariant*, not a judgment call: `idea`/`issue` are not in `BACKLOG_KINDS`
(`we:scripts/check-standards-rules.mjs:28`), so the predicate is dead code that can only evaluate false.
What remains is a genuine either/or on *form*: import the shared rule vs re-declare it locally — two
coherent implementations that cannot both be the source of truth.

- **(a) Import the canonical `isExecKind`** from `we:scripts/check-standards-rules.mjs:34` into
  `we:scripts/audit-backlog-health.mjs`, replacing line `:334`'s literal — passing the kind value, which
  the audit already computes as `it.type = fm.kind ?? fm.type` (`:102`). *Why:* single source of truth,
  already consumed by `we:scripts/readiness/proposer.mjs:38` and pinned by `we:scripts/__tests__/exec-kind.test.mjs`.
  Verified: the import is acyclic and side-effect-free — `we:scripts/check-standards-rules.mjs` runs no
  `process.exit` / registry load at module scope (those live in its consumer
  `we:scripts/check-standards.mjs`).
- **(b) Inline a fresh `!== 'decision'` literal** in the audit. *Tradeoff:* creates a *second, untested*
  copy of the rule — exactly the silent-death vector the canonical home was created to kill; the test
  pins only the `we:scripts/check-standards-rules.mjs` copy, so an inlined literal could drift again
  unnoticed. Strictly weaker.

**Recommended default: (a) import `isExecKind`.** ~95%. The repo deliberately homed this rule once
(`we:scripts/check-standards-rules.mjs:30-33`) precisely so the audit consumes it rather than re-declares
it; (b) re-introduces the drift class. *Residual:* none material — the call site passes `it.type` (the
already-resolved kind), a one-line wiring detail.

**Skeptic:** SURVIVES. The skeptic attacked the import on coupling/cycle/load-cost grounds and could not
break it — `we:scripts/check-standards-rules.mjs` is standalone-importable, side-effect-free, and the
audit→rules edge is one-directional (no cycle). Its only residual was the wiring note (pass `it.type`,
already `fm.kind ?? fm.type`), folded into option (a) above. Default held.

## Fork 2 — which kinds count as exec/build for G2/G3 (include epic, or leaf builds only)?

*Fork-existence:* both branches are coherent and mutually exclusive as *the* exec predicate — you either
keep epic in the gate or you don't; the **excluded branch on the merits is (b) exclude-epics**, whose
premise ("an epic is an umbrella; its governance lives in its children, so flagging the umbrella is
redundant") is **empirically false** for epic-level entity graduations (data below). It is a legitimate
small call someone could make wrongly, kept as a fork so the decision turn sees the refutation, not a
bare assertion.

- **(a) All non-decision kinds (story/task/epic).** Matches `we:scripts/readiness/proposer.mjs:38`'s
  `isBuildable` and the canonical `isExecKind` (`we:scripts/check-standards-rules.mjs:34`). *Grounding:*
  of the 6 epics that graduate to a named standard entity, **4 carry a noun no child carries** — #049
  `block:component` (children are file-paths/decisions), #468 `project:webblocks` (children carry the
  *different* nouns `block:checkbox`/`toggle-switch`/`radio-group`, never `project:webblocks`), #570
  `project:webcharts` (children carry no graduation), #1023 `project:webreporting` (child is a demo
  file-path). Excluding epics would **blind G3** to exactly these "a whole new project/block shipped"
  graduations, which legitimately live at the epic level (a project *is* naturally an epic).
- **(b) Leaf builds only (story/task), exclude epic umbrellas.** *Rationale (the skeptic's):* an epic's
  `graduatedTo` is a roll-up of its children's, so counting both double-counts the same architectural
  noun. *Refuted by data:* only **2 of 6** epic→entity graduations are duplicated by a same-noun child
  (#351↔#436 `project:webcompliance`, #618↔#629 `project:webediting`); the other 4 are unique. Excluding
  epics loses 4 high-value signals to suppress 2 *harmless* duplicates (the leaf still fires, so keeping
  the epic loses nothing). It also applies a *kind*-axis lever to a *subject*-axis problem.

**Recommended default: (a) include epic (all non-decision).** ~80%. It is the only option that keeps the
4 unique epic-level entity graduations in G3, it matches the proposer's already-shipped `isBuildable`
(one consistent build-kind rule across the repo), and G2 is epic-safe regardless — it guards
`if (!isDecision(p)) continue` (`we:scripts/audit-backlog-health.mjs:356`), so an epic's `blockedBy`
edges to non-decisions never misfire. *Residual (~20%):* the real 2-case double-count (#351↔#436,
#618↔#629) — but the right lever is **subject dedup** (dedup entity nouns across the parent/child closure)
on the G3 *subject* predicate (#1498's axis), not narrowing the kind gate; routed to a residual card, see
*Residual & co-dependencies*.

**Skeptic:** SURVIVES-WITH-AMENDMENT. The skeptic's strongest attack was "exclude epics — they
double-count children, losing zero coverage," with #351/#436 and #468/#471-474 as evidence. Tested
against the tree: the claim is mostly false — #468's children carry *different* nouns (`block:checkbox` ≠
`project:webblocks`), so #468 is *not* a duplicate; only 2 of 6 epic→entity graduations are true
duplicates, and 4 are unique to the epic. The default holds. The amendment the attack forces: the genuine
2-case double-count is real and must not be ignored — it is folded in as the subject-dedup residual
(routed to #1498's axis), not as a reason to flip to (b).

## Residual & co-dependencies (for the decision/implementation turn)

- **Subject-dedup residual (from Fork 2's skeptic).** When G3 counts both an epic and a child carrying
  the *same* entity noun (#351↔#436 `project:webcompliance`, #618↔#629 `project:webediting`), the
  ungoverned-arch count is inflated. The fix is dedup-by-entity across the parent/child closure on the G3
  *subject* predicate (`we:scripts/audit-backlog-health.mjs:366`) — the #1498 axis, not this kind gate.
  Recommend a small follow-up card under the G3 subject scope; left for the decision/implementation turn
  to file.
- **Implementation co-dependency with #1498.** The audit consumes **neither** canonical helper today: G3
  at `we:scripts/audit-backlog-health.mjs:366` does **not** call `isEntityGraduation`, despite the
  resolved sibling #1498's "shipped this turn" list claiming that wiring landed. So wiring `isExecKind`
  *alone* resurrects G3 at full volume (~350 candidates + epics); **#1498's entity-subject scope must
  land in the same change** or G3 is un-actionable. Worth verifying whether #1498 needs reopening for the
  unlanded wiring — flagged, not actioned here (prep of #1473 does not touch a resolved sibling).

## Classification

Repo-internal backlog devtools / workflow tooling — **not a WE standard** (impl-is-not-a-standard,
minimize-lock-in). No protocol minted. The reusable rule it codifies on resolve — "the repo has *one*
canonical build-kind predicate, `kind !== 'decision'`, with a single importable home" — is statute-layer
material for `we:docs/agent/platform-decisions.md` or the `check:health` section of
`we:docs/agent/backlog-workflow.md` (set `codifiedIn` on resolve).

## Context

Surfaced 2026-06-21 while validating the G4 merit-vs-effort tell sharpening; the kind-field fix
(`e9c6fca`) already resurrected G4-G7 (G4 now auto-flags #1457) but left the exec *predicate* dead. The
resolved sibling #1498 scoped G3's *subject* (entity-graduation) and authored the canonical helpers +
test ahead of this repair — so this decision is the *kind*-axis half; the two land together.
