---
bornAs: xj86df4
kind: story
size: 5
parent: "3029"
status: resolved
scaffoldedBy: "rule3118"
dateScaffolded: "2026-08-26"
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs"]
dateOpened: "2026-08-26"
blockedBy: ["3165"]
dateStarted: "2026-09-02"
dateResolved: "2026-09-02"
relatedTo: ["3118", "3165", "3096"]
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# Route dispatch-lane's remaining two kinds — spawnFixes and spawnCiHeals have no card

`we:scripts/conveyor/tick-core.mjs` plans **five** dispatch kinds. `#3165` routes **three** of them through
`we:scripts/operations/dispatch-lane.mjs`. The remaining two — `spawnFixes` and `spawnCiHeals` — are planned
every tick, have agent briefs already written, and have no route and no card. This item is that card. It was
filed as a named cost of the `#3118` ruling (Fork 1 → (c), call the declared operation): (c) accepted a
coverage gap instead of waiving it, and this is the part of the gap nothing else carries.

## What is actually true today — measured, not recalled

All line numbers are against `main` at `3b2aeded`.

| where | what it says |
| --- | --- |
| `we:scripts/conveyor/tick-core.mjs:856` | `spawnBuilds: launched.spawn` |
| `we:scripts/conveyor/tick-core.mjs:858` | `spawnPrepareScope: prep.scopeSpawns` |
| `we:scripts/conveyor/tick-core.mjs:859` | `spawnPrepareDecision: prep.decisionSpawns` |
| `we:scripts/conveyor/tick-core.mjs:860` | `spawnFixes: fixPlan.spawns` |
| `we:scripts/conveyor/tick-core.mjs:861` | `spawnCiHeals: ciHealPlan.spawns` |
| `we:scripts/operations/dispatch-lane-io.mjs:139` | `launch: match(decisions.spawnBuilds)` — **builds only** |
| `we:scripts/operations/dispatch-lane-io.mjs:52` | `briefPath(root = REPO_ROOT)` takes **no kind** |
| `we:scripts/operations/dispatch-lane-io.mjs:53` | it returns exactly one brief, `we:skills-src/conveyor/delivery-agent-brief.md` |

**After `#3165` lands, three of five kinds dispatch through the operation and two still do not.** `#3165`
is a three-kind card, not a five-kind one: it names `'build' | 'prepare' | 'prepare-decision'` at its `:68`
and `:131`, and `grep -c 'spawnFixes\|spawnCiHeals\|ciHeal\|CI-heal'` over
`we:backlog/3165-tick-core-plans-auto-prepare-scope-dispatches-that-never-act.md` returns **0**.

**The mandates already exist and are unreachable** — the same shape `#3165` found for the prepare briefs:

- `we:skills-src/conveyor/fix-agent-brief.md`
- `we:skills-src/conveyor/fix-agent-ci-brief.md`

## This is NOT just "give briefPath two more kinds" — three seams `#3165` does not hit

`#3165`'s change is a kind argument on the brief selector and the session slug. These two kinds need more
than that, because a fix dispatch is keyed on a **PR**, not on an item alone.

**1. The brief fill set is too narrow.** `fillBrief` is called with exactly five tokens —
`ITEM_NUM`, `ITEM_SPEC_PATH`, `LANE`, `SESSION_SLUG`, `SCOPE` (`we:scripts/operations/dispatch-lane.mjs:515-521`).
The two fix briefs need tokens that are not in that set:

| brief | tokens it uses | missing from the fill set |
| --- | --- | --- |
| `we:skills-src/conveyor/fix-agent-brief.md` | `ITEM_NUM`, `LANE`, `LANE_REF`, `PR_NUM`, `SCOPE`, `SESSION_SLUG` | `LANE_REF`, `PR_NUM` |
| `we:skills-src/conveyor/fix-agent-ci-brief.md` | the above plus `REASON` | `LANE_REF`, `PR_NUM`, `REASON` |

An unfilled token is **reported, never fatal** (`we:scripts/operations/dispatch-lane.mjs:535-536`,
`briefUnknownTokens`), so a fix agent dispatched today would receive the literal string `{{PR_NUM}}` in its
brief and no error would be raised. That is the failure mode to close, and it is why this needs a test that
asserts the filled prompt, not only the argv.

**2. The planned rows carry a shape the build path does not.** A fix spawn is
`{ pr, num, lane }` (`we:scripts/conveyor/tick-core.mjs:413`); a CI-heal spawn is
`{ pr, num, lane, reason }` (`we:scripts/conveyor/tick-core.mjs:512`). Both carry `num`, so the operation's
`--num` key still selects them — but `pr` and `reason` have to reach the payload, and nothing carries them
today.

**3. The session slug collides.** `sessionSlugFor(num)` returns `conveyor-<num>`
(`we:scripts/operations/dispatch-lane.mjs:170-171`) with no kind in it. `#3165` already has to split this for
the two prepare kinds; fix and CI-heal add two more, and a fix is per-PR, so the slug likely has to key on
the PR rather than the item to stay unique when one item bounces twice.

**Open question for whoever takes this — do not assume it away.** `read` refuses an item with no `scope:`
(`we:scripts/operations/dispatch-lane.mjs:508`: *"the dispatcher never launches an unscoped item to build"*).
A fix dispatch targets an existing PR whose lane and scope are already established by the original build. The
refusal may be correct, wrong, or need a per-kind branch for these two. Settle it against the fix brief's own
`--scope` instructions before writing the guard.

## Resolution

**The refusal applies to `fix`/`ci-heal` exactly as it does to `build` — no per-kind exemption.** A fix/ci-heal
dispatch repairs code an earlier BUILD already wrote inside the item's own declared `scope:` frontmatter; unlike
a `prepare`, it is never dispatched BECAUSE the item lacks a scope, so there is no "unscoped item being
repaired" case for the refusal to accommodate. Both fix briefs' own `--scope={{SCOPE}}` instruction already
assumes a non-empty value, which the refusal is what guarantees. Implemented as one shared condition in
`shapeDispatchRead` (`we:scripts/operations/dispatch-lane.mjs`) covering `build`, `fix` and `ci-heal` together,
with the refusal's own message text widened so it no longer reads as build-exclusive.

## Done when

1. **Executable** — `node --test we:scripts/operations/__tests__/dispatch-lane.test.mjs` covers a `fix` and a
   `ci-heal` dispatch: the right brief is selected, the filled prompt contains no `{{…}}` residue (empty
   `briefUnknownTokens`), the session slug is distinct from the build slug for the same item, and `pr`
   (plus `reason` for CI-heal) reaches the effect payload. All five of `tick-core`'s planned lists reach a
   launch path.
2. The scope refusal question above is answered in this card's body before the guard is written, not after.

## Progress

- `we:scripts/operations/dispatch-lane.mjs`: `LAUNCH_KINDS` grew to five (`fix`, `ci-heal` added); `BRIEF_PLACEHOLDERS` is now the
  full cross-kind set (8 names) and a new `BRIEF_REQUIRED_BY_KIND` map says which of those each kind actually
  validates/substitutes; `fillBrief` takes a third `requiredNames` param (defaults to
  `BRIEF_REQUIRED_BY_KIND.build` — the original five — so every pre-#3332 caller is byte-identical);
  `sessionSlugFor` takes a third `pr` param and keys `fix`/`ci-heal` slugs on the PR (`fix-<pr>` /
  `ci-heal-<pr>`), documented against the card's own reasoning above; `shapeDispatchRead` extends the scope
  ternary and refusal to `fix`/`ci-heal` (see Resolution above), builds the `fillBrief` values per-kind, and
  threads `pr`/`reason` onto the `read` finding; the `dispatch` effect payload now carries `pr`/`reason`.
- `we:scripts/operations/dispatch-lane-io.mjs`: `BRIEF_BY_KIND` maps `fix`/`ci-heal` to the two existing brief files; `readTick`'s
  `LAUNCH_LISTS` grew to five (adds `spawnFixes`/`spawnCiHeals`); its `dispatchedGuard` selection now covers
  `fixGuards`/`ciHealGuards` (separate flat lists, no `kind` filter needed) alongside the existing
  `buildGuards`/`prepareGuards`; added `laneRefForPr` (default `defaultLaneRefForPr`, a `gh pr view --json
  headRefName` shell, argv-pinned) — called ONLY for a `fix`/`ci-heal` launch that carries a `pr`, feeding the
  new `laneRef` field on `readTick`'s return.
- Tests: `we:scripts/operations/__tests__/dispatch-lane.test.mjs` gained a `#3332` describe block mirroring `#3165`'s own (fix/ci-heal spawn
  once with the right brief byte-exact, distinct session slug, `pr`/`reason` on the effect payload, the scope
  refusal is not build-exclusive), extended the `LAUNCH_KINDS` 5-distinct-briefs assertion, and added
  `defaultLaneRefForPr`/`laneRefForPr` argv-and-laziness coverage to the existing tick-reader block. Two
  pre-existing tests were adjusted to the new (correct) shapes they now exercise: the delivery-brief mangling
  test scopes its per-token loop to `BRIEF_REQUIRED_BY_KIND.build` instead of the now-wider
  `BRIEF_PLACEHOLDERS`, and the build-refusal assertion matches the widened (not build-exclusive) message text.
- Filed follow-up `#3458` for the known, out-of-scope gap: `we:scripts/conveyor/tick-core.mjs#releaseSessionForNum`
  has no `fix`/`ci-heal` branch, so a merge-time auto-release of a fix/ci-heal agent's OWN lane (were one ever
  wired up) would use the wrong session slug. `blockedBy: ["3332"]`.
- `node --test`-equivalent (`npx vitest run we:scripts/operations/__tests__/dispatch-lane.test.mjs`, this repo's
  actual test runner for this file — it imports from `vitest`, not `node:test`) is green: 112/112.

## Reconciliation note (2026-09-02)

Landed as `PR #1844` ("WE #3332: route dispatch-lane's remaining two kinds — spawnFixes and spawnCiHeals"),
merged `2026-09-02T21:12:37Z` — its diff and description match this card's own "Progress" section above
line for line (`LAUNCH_KINDS` to five, `BRIEF_REQUIRED_BY_KIND`, `sessionSlugFor` keyed on `pr`, the
scope refusal widened to `fix`/`ci-heal`, 112/112 tests). The card's own `status:` frontmatter had not been
flipped to `resolved` despite the merge — the exact "merged but never reconciled" gap `#3383` documents
recurring (see its card for prior examples: `#3403`, `#3404`, `#3406`, `#3416`, `#3418`, `#3439`, `#3434`,
`#3433`). Resolved here as a straight reconciliation, not new work.

## Lineage

Filed 2026-08-26 as a named, non-waived cost of the `#3118` ruling
([#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation)).
`blockedBy: 3165` — that card moves `briefPath`/`sessionSlugFor` to a kind axis, and this one extends the
same axis rather than opening a rival one. Related: `#3096` routes the conveyor's *build* dispatch through
the operation.
