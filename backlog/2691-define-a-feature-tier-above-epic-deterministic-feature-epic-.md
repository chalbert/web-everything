---
bornAs: xtucvux
kind: decision
parent: "2505"
status: open
dateOpened: "2026-07-26"
preparedDate: "2026-07-28"
relatedReport: reports/2026-07-28-feature-tier-above-epic.md
tags: [backlog, taxonomy, data-model, hierarchy, tooling]
---

# Define a "feature" tier above epic — deterministic feature→epic→slice rollup

**Prepared — ready to ratify.** This is a data-model call over the shipped backlog, not a greenfield
standard. The ratified feature-tracking screen ([#2705](/backlog/2705-feature-tracking-screen-ratified/))
rolls up `slice → epic → feature`, but the backlog has **no tier above epic**: `kind ∈ story | epic |
task | decision` (the single-axis end state of [#466](/backlog/466-collapse-backlog-type-workitem-into-one-kind-axis-retire-the/);
SoT `we:scripts/check-standards-rules.mjs:40`), and the largest grouping is `epic`. Decide how a
feature is defined so the rollup is deterministic.

Prior art: `/research/feature-tier-above-epic/` (report `we:reports/2026-07-28-feature-tier-above-epic.md`)
surveyed the tier-above-epic in Jira / Linear / Shortcut / Azure DevOps / GitHub / Asana and found one
hard invariant: **that tier is always an explicitly-marked node (an issue type/level or a first-class
entity), never "whichever ancestor a graph walk reaches."** Trackers that expose deep arbitrary nesting
(GitHub sub-issues) deliberately decline to name a fixed "feature" level, because a derived level is
ambiguous. This mirrors [#466](/backlog/466-collapse-backlog-type-workitem-into-one-kind-axis-retire-the/)
one tier up: hierarchy-role rides the one structural `kind` axis, not a re-derivation and not a second field.

## Grounding — the real backlog model (not assumed)

Measured over `we:backlog/*.md` (2717 items, 205 epics):

- **The `parent` chain is deep and multi-level.** 88 epics carry a `parent`; **81 of those parents are
  themselves `kind: epic`.** Max `parent`-chain depth = **5**. So an epic sits at an *arbitrary* level
  of a deep tree — there is no fixed "features are at depth N" rule.
- **Roots are uneven and huge.** 105 distinct roots over open items; the largest, `#2445`, has **87
  descendants**; the next, `#089`, has 20. 124 epics have no epic-parent. Neither "root" nor "top epic"
  is a curated product grouping.
- **The screen wants separate rows.** `#2505` and `#2527` are *distinct* feature rows in the ratified
  mock, yet **both carry `parent: "2445"`** (an `epic`) — so "feature = epics reachable from a root"
  folds them into **one 87-item mega-feature** (the red-team's "grouped under different roots"
  instability, restated). This same fact drives Fork 2 below.
- **Grouping/tier is `kind`-keyed all over the loader + gate**, and every site must learn the new kind:
  the tier deriver treats any non-`decision` open item as buildable Tier-A (`we:src/_data/backlog.js:186`
  — a raw `kind: feature` would wrongly surface as agent-ready work); scope-pill/sliceable/board
  bucketing key on `kind === 'epic'` (`we:src/_data/backlog.js:75`, `:476`, `:524`, `:870`); the
  parent-deadlock guard (`we:scripts/check-standards.mjs:794`), epic↔child status coherence (`:833`,
  `:863`), the kind-vocabulary **drift guard §10** (`:1488` — a kind added to `BACKLOG_KINDS` but not to
  every kind-filter list in `we:src/backlog.njk` renders items **permanently invisible**, the
  `type: review` #602/#610 failure), and per-item kind validation (`we:scripts/check-standards-rules.mjs:172`).

Decisive fact: **the `parent` chain alone cannot say which ancestor is "the feature."** Determinism
requires an *explicit marker*, not a walk.

## Settled — not forks (rulings prep already closed)

These were screened as **prioritization/precedent, not merit** (a fresh-context two-confusion pass
dissolved two would-be forks) — so they are rulings with a default, not open calls:

- **Representation: reuse the existing `parent` field, NOT a new `feature:` field.** `featureOf`
  (below) is the *only* reader, and it returns byte-identical output whichever field carries the edge —
  so there is no merit tradeoff, only "one more field to hand-sync." #466 forbids the parallel field
  outright. Ruling: reuse `parent`; a dedicated `feature:` field is rejected.
- **Shape: features are FLAT now; nesting is a non-breaking future extension.** `featureOf` returns the
  *nearest* feature ancestor, so it stays deterministic **whether or not features nest** — nesting is
  not a determinism question. Flat-vs-nested is purely "model an initiative tier now?"; the sole
  consumer (#2705) rolls up 3 levels and reads only the nearest feature, so build flat now and add a
  `feature → feature` "initiative" tier if/when a consumer for it appears (flat ⊂ nested, so it is
  non-breaking to add). `check:standards` enforces flatness meanwhile: a `kind: feature` may not have a
  `kind: feature` ancestor. (The #2445 → {#2505, #2527} initiative shape already exists in the data — it
  simply has no reader yet.)
- **Feature assignment is opt-in — zero new required fields.** A feature-less epic rolls into an
  **"Unassigned"** bucket; nothing forces a backfill of the 124 top epics. The derivation stays *total*
  because "nearest feature ancestor **or null**" is defined for every epic. (This stands on its own
  ergonomics + the item's stated zero-new-required-fields posture — *not* on native-first #75, whose
  scope is web-platform defaults, not backlog schema.)
- **Fix/feature *nature* stays on `tags`.** #466 already demoted nature to `tags`; this "feature" tier
  is a *hierarchy grouping*, a different axis from the nature flavour that reuses the same word.

## Fork 1 — the tier mechanism: explicit `kind: feature` node

*Fork exists because:* the three mechanisms **genuinely cannot coexist** as the source of truth, and
two are broken on the grounded tree — (a) derive-from-chains is **non-deterministic** (deep multi-level
chains + uneven roots ⇒ no canonical "which ancestor"; `#2445` becomes one mega-feature and `#2505`/`#2527`
stop separating), and (c) a parallel grouping field **reintroduces the second axis #466 retired** and is
redundant with `parent`. Only (b) is coherent; the alternatives are real proposals, so this is a live fork.

- **(a) Derive from `parent` chains** — feature = the set of epics reachable from some root. *No new
  field.* **Rejected:** non-deterministic over the real tree (see Grounding); no stable feature identity.
- **(b) A new `kind: feature` node above epic — DEFAULT.** Extend the single `kind` axis
  (`story | epic | task | decision | feature`). A feature is an ordinary backlog item with `kind:
  feature`; epics point up to it via the existing `parent` chain. Matches every surveyed tracker's
  explicit-node invariant and #466's single-axis principle.
- **(c) An explicit grouping field on epics** — e.g. `feature: "<NNN>"`. **Rejected:** a second
  structural axis parallel to `parent` (the exact redundancy #466 collapsed), kept in sync by hand.

**Default: (b) explicit `kind: feature`.** The only mechanism that is deterministic *and* single-axis
*and* matches prior art. Honest cost (not hidden): unlike (a)/(c), a new structural kind must earn
**epic-parity plumbing** at every `kind`-keyed loader/gate site (the deriver + grouping list in
Grounding), or a feature mis-tiers as buildable work — see Validation. The deterministic feature→epic
rule it enables:

> **Epic E's feature = its nearest `kind: feature` ancestor walking `parent` upward; if none, E is
> Unassigned.** Total and deterministic: it handles epics that do not share an immediate parent (they
> may still share a nearer feature ancestor) and the `#2445` mega-root (a feature is a *marked* node,
> not the top root).

```
# A feature item (top tier) — an ordinary item, kind: feature
---
kind: feature
status: open
---
# Feature-tracking screen

# An epic under it — points up via the SAME `parent` field already used for story→epic
---
kind: epic
parent: "2691"      # nearest kind:feature ancestor along parent  =>  this epic's feature
---
```

```js
// The deterministic derivation the tracker rollup consumes (pure; kind + parent only).
// featureOf(epicNum) walks `parent` upward to the first kind:feature node; null => Unassigned.
function featureOf(num, byNum) {
  const seen = new Set();
  let cur = byNum.get(String(num))?.parent;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const it = byNum.get(String(cur));
    if (!it) return null;
    if (it.kind === 'feature') return cur;   // nearest feature ancestor
    cur = it.parent;
  }
  return null;                               // no feature ancestor => Unassigned bucket
}
```

Skeptic: SURVIVES-WITH-AMENDMENT. Determinism attack failed (single-valued `parent` + `seen`-guard ⇒
unique linear walk, total). Re-route to "config dimension" failed (`feature` is a structural kind
value, not a knob). But the attack found a real hole, now folded in: the "cheap, just add a value"
framing hid the **epic-parity plumbing tax** — `deriveTier` (`we:src/_data/backlog.js:186`) would place
a raw `kind: feature` in Tier-A/buildable, and ~4 `kind === 'epic'` grouping sites need the analogue.
Validation §3 now names each. Statute-overlap with #466 reconciled below (it *extends* the single axis).
Screen: clear — the fork rules on WE's own backlog schema (visible in the markdown), not a plateau
render detail, and derive-vs-explicit is a correct-vs-ambiguous *merit* gap, not cost.

## Fork 2 — is a feature's `parent` tier-constrained (top-tier), or unconstrained?

*Fork exists because:* reusing `parent` (settled above) lets a `kind: feature` sit structurally *below*
an epic. On the real tree, promoting the sibling rows `#2505` and `#2527` (both `parent: "2445"`, an
`epic`) to features leaves an **epic (`#2445`) as the structural parent of two features** — a tier
inversion. `featureOf` only walks *up*, so **determinism survives either branch**; what differs is
whether "feature is the top tier" is *enforced* or merely nominal. The two branches cannot both hold.

- **(a) Tier-monotonic — a `kind: feature`'s `parent` must not be a `story`/`epic`/`task`; DEFAULT.**
  Features are structurally the top of the hierarchy. Combined with the flat ruling (no feature parent
  either), a feature is effectively a **root**. Promoting an existing epic (e.g. `#2505`) to a feature
  is therefore a *re-parent* (detach from its epic parent `#2445`), not a bare kind-flip.
- **(b) Unconstrained `parent` — tolerate a feature sitting under an epic.** No migration; `featureOf`
  still deterministic (`#2445` stays an Unassigned epic that *contains* features). But the board then
  renders an epic structurally **above** features — a shape a human reads as "epic ▸ feature," the exact
  inversion of the tier this decision introduces.

**Default: (a) tier-monotonic.** The point of the tier is a *legible* top-of-hierarchy; tolerating
inversion makes "feature is above epic" true only inside the rollup and false on the board — reintroducing
the ambiguity the decision exists to remove. Cross-tracker precedent (Jira/Linear enforce a real level
hierarchy) backs the invariant. **Honest cost (not undersold):** (a) + flat makes a feature a strict
**root**, so promoting an existing epic like `#2505` to a feature *deletes* its `parent: "2445"` edge —
and that edge is real information (`#2445` is a program-level container: **program ▸ features ▸ epics**
is a *second* tier above epic this one-tier decision does not model). That program relationship is
exactly what the deferred `feature → feature` **initiative/nesting** extension is for (settled ruling
above) — so under flat-now it is *intentionally out of scope for the 3-level screen*, not silently lost;
if preserving program containers becomes load-bearing before the screen needs it, that is the trigger to
build nesting (relaxing the root-check to allow a feature parent) or to pick (b). A decider who values
edge-fidelity over board legibility *now* should override to (b) — which is why this is a live call.

```js
// check:standards addition (Fork 2a): a feature is structurally top-tier ⇒ a ROOT.
// A blacklist ({story,epic,task}) leaks — `feature → decision → epic` and a dangling parent both slip
// through, and it drifts whenever a kind is added. The decision's own conclusion ("a feature is
// effectively a root") is enforced directly and hole-free: a feature simply carries no `parent`.
for (const it of backlog) {
  if (it.kind === 'feature' && it.parent !== undefined)
    err(`Backlog item "${it.id}" is a kind:feature with parent #${it.parent} — a feature is the top tier and must be a ROOT (#2691 Fork 2). Drop its parent when promoting; the program/initiative grouping is the deferred feature→feature nesting extension, not an epic/decision parent.`);
}
```

Skeptic: SURVIVES-WITH-AMENDMENT. A hostile focused attack (classification + merit + the validation
rule) confirmed it is a *real merit* fork (both branches deterministic, but they yield permanently
different trees — root-features vs preserved program edges — so not prioritization, not
settled-by-precedent, not support-both). Two fixes folded in: (1) the blacklist check **leaked**
(`feature → decision → epic` passed, since `decision ∉ {story,epic,task}`; a dangling parent passed;
and it was a §10-style drift footgun) → replaced with the hole-free **root-check** above; (2) the
"bounded re-parent" language undersold a real **edge deletion** (`#2445`'s program membership) → the
default now states it plainly and routes the program tier to the deferred nesting extension. Not
refuted: the top-tier-legibility + cross-tracker rationale holds; (b) stays the honest override.
Screen: clear — a WE backlog data-model/gate concern (visible in frontmatter, enforced in
`we:scripts/check-standards.mjs`), not a plateau render detail; and a permanent structural (merit)
difference survives the "free + instantly maintained" test, so it is a genuine fork.

## Validation — what `check:standards` enforces (codified rule)

Ratifying Fork 1(b) + Fork 2(a) + the settled rulings codifies: **`feature` is a valid `kind` above
epic; an epic's feature is its nearest `kind: feature` ancestor along `parent` (else Unassigned);
features are flat and structurally top-tier.** The buildable child that implements it (carved at
close-out, scope below) adds:

1. **Extend the kind vocabulary** — `BACKLOG_KINDS` in `we:scripts/check-standards-rules.mjs:40` gains
   `feature`; the `--kind` guards in `we:scripts/backlog.mjs:524,681` accept it.
2. **Kind-vocabulary drift guard §10** (`we:scripts/check-standards.mjs:1488`) — add `feature` to every
   kind-filter list in `we:src/backlog.njk` (both facets), or feature items render invisible. This is
   the load-bearing seam the drift guard exists to catch; it fails the gate until the template lists cover it.
3. **Grouping-tier parity (the epic analogue) — the plumbing tax Fork 1 named.** `feature` is a
   grouping tier like `epic`, NOT buildable work: fix `deriveTier` (`we:src/_data/backlog.js:186`) so an
   open `kind: feature` is not Tier-A, and give `feature` epic-parity at the `kind === 'epic'` grouping
   sites (`we:src/_data/backlog.js:75` scope-pill, `:476`, `:524` sliceable, `:870` board bucket). Miss
   one and a feature mis-renders as agent-ready or vanishes from its lane.
4. **Feature↔child coherence** — generalize the epic↔child blocks (`we:scripts/check-standards.mjs:833`,
   `:863`) so a `resolved` feature with an open epic child is flagged, mirroring the epic rollup.
5. **Parent-deadlock guard** (`we:scripts/check-standards.mjs:794`) — a child must not list its own
   `kind: feature` parent in `blockedBy` (extend the `kind === 'epic'` scope to include `feature`).
6. **Flat + top-tier invariants** — the two `check:standards` additions above: no `kind: feature`
   ancestor over a feature (flat), and a `kind: feature` carries no `parent` at all (top-tier root —
   the hole-free form of tier-monotonicity; relaxing this to allow a `feature` parent is the future
   nesting extension).

## Statute reconciliation — composes with #466 (no collision)

If this sets `codifiedIn`, it writes on the **same turf** as #466 (the backlog `kind` axis). They
**compose, not collide**: #466's rule is *"one structural `kind` axis; no second parallel nature/role
field."* Fork 1(b) **adds a value to that same axis** (`feature`), and the settled reuse-`parent` ruling
**mints no field** — so it *upholds* #466 (the whole reason (c)/the dedicated field are rejected). #466
is `codifiedIn: one-off` (no named anchor in `we:docs/agent/platform-decisions.md`), so there is no
anchor to amend; the ratification note should cite #466 as the governing precedent and record that the
feature tier extends the single axis it established.

## Preview — the forks

| Fork | Question | Default | Main alternative (excluded) |
|---|---|---|---|
| 1 | Tier mechanism | **explicit `kind: feature` node** | derive-from-chains (non-deterministic) / grouping field (2nd axis, #466) |
| 2 | Feature's `parent` | **tier-monotonic (feature is top-tier / a root)** | unconstrained (tolerate an epic structurally above features) |

Settled (no fork): reuse `parent` not a new field (#466); flat now, nesting a non-breaking future
extension; opt-in assignment with an Unassigned bucket.

## Close-out — the buildable child

Ratifying carves one buildable child (the six validation additions), scoped:
`we:scripts/check-standards-rules.mjs`, `we:scripts/check-standards.mjs`, `we:scripts/backlog.mjs`,
`we:src/backlog.njk`, `we:src/_data/backlog.js`, plus the plateau-app rollup consumer under
`plateau-app:src/backlog-view/`. #2733 (REFREEZE, `blockedBy: 2691`) then re-baselines the screen.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| a11y#1 | a11y | axe-scan | The rendered UI passes an accessibility scan and stays keyboard-reachable with correct roles and labels — no new accessibility regression. |
| visual-vs-target#1 | visual-vs-target | screenshot-diff | The rendered UI matches its target/baseline design in both light and dark themes — no unintended visual drift. |
| perf#1 | perf | lighthouse | The page stays within its load budget — the change adds no new render-blocking cost or hot-path regression. |
