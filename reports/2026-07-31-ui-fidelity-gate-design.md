# UI-Fidelity Gate — converged design reference (RRFC)

> **Provenance.** Produced by a design + review committee (2026-07-31): 4 independent architects (distinct
> guiding values) → adversarial red-team per design → 3-judge panel → convergence. Winner unanimous: **RRFC —
> Real-Route Fidelity Contract**. Grafted the runner-up's low-friction/anti-mute engineering and the
> Assembled-Route Gate's registry-anchored target + whole-route owner. Motivated by the console-board post-mortem
> (every story "resolved", the live route poor — verified on a `?demo=1` fixture, never the embedded route).
> Ratified oracle-tightness: **B** (deterministic floor gates; perceptual diff advisory), with **C** parked.
> This report is the durable reference behind the "UI-Fidelity Gate" epic and its slices.

The one non-negotiable boundary — **WE holds zero implementation ([[6-we-holds-zero-standard-implementation]] / MEMORY #6)** — is preserved: WE *validates*, the product *renders*.

## 1. The design (end-to-end)

### Core shape
Every UI item is **born carrying a `fidelity:` contract** (scaffold pre-fills it) that names the **real product route**, the **real host shell**, a set of **data seeds spanning the regimes that actually break layout**, the **frozen webcase ids** it must render, and an **independently-authored, registry-anchored design target**. The product repo runs one **generic real-route harness** that boots the shipped shell at that route, seeds each regime, renders both themes, and asserts — on the assembled DOM — grammar presence, real **geometry**, singleton chrome by role, and theme cascade by computed value. WE **validates** the contract is complete and consumes a **signed conformance record**; it never boots the product.

Two structural invariants hold everything up:

- **INVARIANT A — the target is not the subject.** The visual baseline derives from a ratified design mock in an **independent target registry**, bound by an approval token over the mock's content hash. The gate rejects any target whose **perceptual distance** to a build screenshot is below a floor (defeats the one-pixel-nudge), and escalates any target introduced in the same lane/author/commit as the render code.
- **INVARIANT B — absence is failure, never skip.** For a UI item at/entering `resolved`, a missing target, a missing render record, a boot failure, or a stale record is a **hard ERROR**. The comparator's `baseline-missing: warn` is re-graded to error at this one caller. No silent free pass survives.

### The `fidelity:` contract (frontmatter schema)
The `route`/`host`/`webcases`/`target` values are repo-qualified loci; the example below uses placeholder paths.

```yaml
fidelity:
  route: "plateau:/console-board"        # REAL served route; validated against the app's
                                         # real route table, NOT a keyword blocklist.
                                         # Must be the ASSEMBLED route, not a leaf component.
  host: "plateau:src/app-shell"          # shipped shell that owns chrome -> forces embedded render
  assembledOwner: true                   # exactly ONE child of a sliced UI epic carries this;
                                         # its subject IS the whole route
  webcases:
    file: "plateau:src/backlog-view/card-taxonomy.webcases"
    required: [UC-A5, UC-A6, UC-B5]      # the FROZEN required-set; independently owned,
                                         # NOT editable by the build lane (see slice 9)
  seeds:                                 # each injected through the REAL data store, not a bypass
    empty:        "plateau:tests/fixtures/board-empty"      # MANDATORY — zero lanes
    populated:    "plateau:tests/fixtures/board-populated"
    overflow:     "plateau:tests/fixtures/board-overflow"   # MANDATORY — the mid/high-cardinality
                                                            # regime that collapses the grid;
                                                            # from a real production snapshot
  themes: [light, dark]                  # both mandatory
  target:                                # INVARIANT A
    registryId: "mock:console-board@v3"  # entry in the ratified-mock registry
    contentHash: "sha256:..."            # token is signed over THIS hash
    authoredInCommit: "<sha>"            # must PRE-DATE the build lane
  baseline:                              # committed PNG per seed x theme; absence = error at resolve
    template: "plateau:tests/visual/baselines/console-board/{seed}.{theme}"
```

**NOT-READY** (dispatch refused) if: any of `route`/`host`/`webcases`/`seeds` empty; `route` not resolvable in the app's real route table, or resolves to a leaf rather than the assembled route; `seeds` missing `empty` or `overflow`; `target` absent or authored in the build lane. **NOT-RESOLVABLE** if: no signed record, record stale/red, any required baseline missing, perceptual-distance or token check fails.

### The shared real-route render harness (product repo)
One generic script — `plateau:scripts/dev/fidelity-render.mjs` over a pure core — that knows **nothing per-page**; it loops the contract fields.

1. Boot the **shipped shell** (`host`) in a **real browser** (Playwright — **jsdom is forbidden** for any layout/theme assertion; it cannot compute a cascade or a grid).
2. For each `seed`: inject through the **real data store the live route reads** (not a `?demo=` param, not a bypass seam), then for each theme: mount `route` inside `host`, pin viewport/DPR/clock, disable motion, block network, await fonts+settle.
3. Emit per `seed x theme`: a normalized **DOM snapshot**, a **screenshot**, and a **layout report** (computed `grid-template-columns`, per-cell bounding boxes).
4. Write a **signed conformance record** bound to `(commit SHA x baseline hashes x route)` — so a stale green record can never satisfy a later broken commit.

### Gate lifecycle — deterministic floor vs visual layer

| # | Where it fires | Signal consumed | Layer |
|---|---|---|---|
| 1 | **Scaffold** (`we:scripts/backlog/scaffold.mjs`) — stamp contract skeleton when `isVisualTouch(scope)` fires | predicted scope touch-set | born-with-it |
| 2 | **Readiness** (`we:scripts/readiness/dispatch-plan.mjs`) — refuse incomplete contract / fixture route / missing empty+overflow seed / target authored in-lane | contract completeness + target provenance | pre-build |
| 3 | **Build self-review (Layer 1)** — agent runs `check:ui-fidelity --item NNN`, the **exact same code** the floor runs | harness verdict, local | advisory |
| 4 | **Pre-resolve floor** — pure `we:scripts/lib/check-ui-fidelity.cjs` folded into `we:scripts/check-standards.mjs --item NNN` | signed record + registry token + baseline existence | **DETERMINISTIC FLOOR (gates)** |
| 5 | **Product CI** — `plateau:tests/visual/real-route-fidelity.test.ts` rides plateau-app's test run | live render | **DETERMINISTIC FLOOR (gates)** |
| 6 | **Resolve judgment** — `/resolve` step 1a criterion "real route green, not a fixture" | record | judgment |
| 7 | **Scope reconciliation** at resolve — declared `scope` vs actual changed files | git diff vs scope | **FLOOR (gates)** |
| 8 | **On-land drain** (`planEpicResolveOnLand`) — escalate `ui-fidelity-unverified` | record freshness at merge | escalate |
| 9 | **Jury** (`we:scripts/lib/jury/design-pixels-adapter.mjs`) — `visual` mandatory **only** for contract items | `hasTarget:true` | perceptual backstop |

**The gating layer is entirely boolean/deterministic** — contract well-formed, record present+fresh+green, baseline exists, token valid, geometry integers on the correct side, scope reconciled. Booleans don't flake, so the gate can't be muted back to square one. The **perceptual pixel diff rides above as a non-gating backstop** feeding the jury.

### UI-item classifier (dependency-aware — closes the data-layer dodge)
`isVisualTouch(item.scope)` widened from its WE-only knowledge into a general repo-qualified presentation predicate. **Critically**, it is no longer pure path-regex: for each real route, its **import graph** is resolved, and a change to **any module the route transitively renders through — including its data mappers/store** — classifies the item as UI-affecting for that route. This catches the actual console-board root cause (a *data-layer* change that emptied the lanes), which every path-regex classifier misses.

Two anti-evasion locks:
- **Scope-lease `coversFile`** already refuses edits outside declared scope — to edit the board you must scope the board, and scoping it trips the classifier.
- **Resolve-time reconciliation** (slice 11) diffs declared `scope` against actually changed files; an under-scoped item that touched a presentation/route-graph surface it didn't declare is a hard error. Together these close the master-bypass.

## 2. How it defeats the 6 failures

1. **Fixture-not-route** → harness can only mount `route` resolved against the app's **real route table** and seeds through the **real store**; the empty+overflow seeds render the exact live collapse. *(gate 5, invariant B)*
2. **Circular oracle** → target is registry-anchored, token-signed over a content hash, must pre-date the build lane, and must sit **above a perceptual-distance floor** from any build shot. Each item's own route must be green at its own resolve — proof is un-deferrable. *(gate 4, invariant A)*
3. **Delivered-by-shell** → "no build needed" produces **no render record**; missing record = hard error. *(gate 4, invariant B)*
4. **Tests-green ≠ fidelity** → the real-route test renders DOM + **geometry** + pixels, orthogonal to the structural suite. *(gate 5)*
5. **No assembled-page owner** → exactly one `assembledOwner` child; the epic cannot resolve until the **whole-route** render is green. *(gate 8 + slice 14)*
6. **Standalone vs embedded** → `host` forces embedded render; **singleton chrome by landmark role** (one banner, one brand slot) plus **theme cascade by computed-value equality** against host tokens. *(gate 5, slice 6)*

## 3. Red-team holes closed

**Fatal:**
- **Master bypass / self-declared scope** → scope-lease `coversFile` + **resolve-time declared-vs-actual diff reconciliation** (slice 11). You cannot edit the surface without declaring it, and declaring it arms the gate.
- **Circular oracle already committed in-repo (fixture photo)** → **independent target registry + token + perceptual-distance floor**. A perturbed screenshot of the fixture fails the distance floor; a self-issued token fails registry anchoring.
- **WE-holds-zero-impl violation** → render + conformance test live **in the product repo** and ride *its* test run. WE only validates contract completeness and **reads a signed record** — no browser, no product boot, no committed product screenshots in WE.
- **Stale conformance cache** → record bound to `(commit SHA x baseline hashes x route)` and re-verified on-land; boot failure = hard RED, never downgraded to skip.

**Serious:**
- **Existence ≠ layout (2px collapsed grid passes a count check)** → real **geometry assertions** (computed `grid-template-columns` yields N columns each above a min width; per-cell boxes non-overlapping and non-zero). jsdom forbidden.
- **Data-layer root cause dodges the classifier** → dependency-aware classification over each route's import graph.
- **Self-authored seeds miss the breaking regime** → `empty` **and** `overflow` mandatory, from real production snapshots where one exists.
- **`rendered=yes` downgraded to `pending` to escape the floor** → required-set frozen independently of the build lane (slice 9).
- **jsdom render defeats geometry/theme** → forbidden; real browser only.
- **Singleton chrome evaded by non-matching markup** → assert by **landmark role**, not tag selector.
- **Non-cascading theme passes a luminance-side check** → **computed-value equality** against host theme tokens.
- **Coarse comparator misses small defects** → geometry + DOM-grammar backstop catch structure; perceptual diff advisory; finer-grid on flagged regions is a later add.

**Residual, accepted:** a lazily-drawn *design mock* that is itself wrong is faithfully reproduced (the gate proves fidelity-to-target, not good design) — pushed to the jury's target-free usability/design lenses. Seed coverage beyond empty+overflow is author discretion.

## 4. Slice plan (build order)

**Umbrella epic — "UI-Fidelity Gate: real-route conformance, born-with-contract to on-land."** Foundation first; WE-validation and product-render slices kept on separate sides of the #6 boundary.

| Slice | Side | Scope (one line) | Size | blockedBy |
|---|---|---|---|---|
| 1. Contract schema + validator | WE | `fidelity:` frontmatter block + well-formedness in `we:scripts/check-standards.mjs` | 5 | — |
| 2. Dependency-aware UI classifier | WE | widen `isVisualTouch` + route import-graph (data-layer) classification | 5 | — |
| 3. Scaffold stamp + readiness refusal | WE | `we:scripts/backlog/scaffold.mjs` stub; `we:scripts/readiness/dispatch-plan.mjs` refuses incomplete/fixture/missing-seed | 3 | 1, 2 |
| 4. Product seed seam | plateau-app | data-injection point into the real store the live route reads | 5 | — |
| 5. Real-route render harness | plateau-app | boot-shell + seed + both themes + emit DOM/screenshot/layout + signed record | 8 | 1, 4 |
| 6. Geometry + theme assertion lib | plateau-app | computed grid-columns / bbox non-overlap + host-token computed-value equality | 5 | 5 |
| 7. Target registry + token + perceptual floor | WE + shared | ratified-mock registry, token over content hash, perceptual-distance check | 8 | 1 |
| 8. Real-route conformance test | plateau-app | required-set + geometry + singleton-role + theme; rides the product test run | 8 | 5, 6 |
| 9. Required-set freeze guard | plateau-app | own the `rendered=yes` required-set; block build-lane `yes→pending` downgrade | 3 | 8 |
| 10. WE floor: record consumption + warn→error | WE | `we:scripts/lib/check-ui-fidelity.cjs` into the gate; missing/stale/boot-fail = ERROR | 5 | 7, 8 |
| 11. Resolve-time scope reconciliation | WE | declared `scope` vs actual changed files; under-scope of a route-graph surface = error | 5 | 2 |
| 12. Jury flip (advisory-until-trusted) | WE | `we:scripts/lib/jury/design-pixels-adapter.mjs` — `visual` for contract items; **advisory at launch (choice B)** | 3 | 10 |
| 13. On-land escalate reason | WE | `planEpicResolveOnLand` → `ui-fidelity-unverified` | 3 | 10 |
| 14. assembledOwner whole-route guard | WE | exactly one child owns the assembled route; epic resolve blocked until its route green | 5 | 1, 13 |
| 15. build-ui method + judgment criterion | WE | one command local==CI; never auto-update baselines; `/resolve` step 1a fidelity criterion | 3 | 8, 10 |

**Build waves:** `{1,2,4}` → `{3,5,7}` → `{6,8}` → `{9,10,11}` → `{12,13,14,15}`.

## 5. Ratified: oracle tightness = B (C parked)

- **A — floor only.** DOM-grammar + geometry + chrome-role + theme-equality. Never flakes; blind to within-tolerance miscolor / wrong glyph.
- **B — floor gates + perceptual diff advisory (RATIFIED).** The boolean floor is the only thing that blocks resolve; the pixel diff surfaces to a reviewer/jury but never gates. Catches more, still un-mutable — the floor stands even if pixels are ignored. Slice 12 ships the jury `visual` lens **advisory-until-trusted**.
- **C — floor + perceptual mandatory in the jury (PARKED).** Hardest guarantee, but a tolerant pixel lens in a *blocking* seat rots under drift pressure. **Reopen trigger:** once the registry target has a known false-block rate. May land as a **configurable** oracle-tightness dial rather than a hard flip.

Rationale: the deterministic floor is the part that structurally cannot be argued out of or muted, and it already catches all six failures. Promote toward C only on evidence.
