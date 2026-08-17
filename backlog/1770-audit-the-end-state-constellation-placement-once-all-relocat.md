---
kind: decision
status: open
blockedBy: ["1294", "1245", "872"]
relatedProject: webcomponents
relatedReport: reports/2026-08-17-zero-impl-boundary-enforcement.md
dateOpened: "2026-06-24"
preparedDate: "2026-08-17"
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/check-standards.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
  - we:scripts/__tests__/check-standards.test.mjs
  - we:docs/agent/platform-decisions.md
tags: [placement, constellation, zero-implementation, devtools-placement, review-gate]
---

# Audit the end-state constellation placement once all relocations land — confirm the zero-impl / standard·impl·product line is tight

## Digest

This is a **go** — build the instrument — pending a one-glance batch-confirm rather than a ratify turn, at high
confidence. Nothing here is a not-yet: the work is buildable the moment the nod lands.

This card asked *"is the line tight (A), or are there residuals (B)?"* That is a **measurement, not a fork** —
which branch obtains is a fact about the tree, settled by counting, and nobody chooses it. So prep did the
counting. **The line is not tight**: ≈6,263 lines of delivery runtime remain under `we:blocks/` and a further
5,883 across nine subsystem roots, one vendored generator has silently drifted behind its canonical twin
(`we:scripts/gen-wrapper/genWrapper.mjs` 228 lines vs `fui:tools/gen-wrapper/genWrapper.mjs` 417; whole-directory
437 vs 1,270), and — the finding that matters — **nothing anywhere would have reported any of it**.

What is left for a human is one-sided: commit to building the instrument that reports it, or not. That is a
**validation gate**, not a fork. And per #2092 the merit half is **flatly conceded, not conditional** — the rule
is ratified statute (#1246/#1282) whose operative clause is enforced *nowhere*, and prep found four verified
instances of the absence biting. Stripping timing, effort and demand leaves no merit unknown, so **this gate
dissolves**: it is recorded as accepted-on-merit plus a scheduling edge, and the human turn compresses to a
batch-confirm of that concession. It stays `open` because #2092 is explicit that a prep author's prose
concession is not the human validation — the nod is compressed, never deleted, and never auto-resolved on
prep's say-so.

## What you're deciding

Commit to a **three-part instrument**, each part scoped deliberately narrowly:

1. **Re-point the dormant byte-parity gate at the real duplicate set.**
   `validatePlugWeFuiDrift` + `PLUG_SHARED_CORE_FILES` (`we:scripts/check-standards-rules.mjs:1857`, wired at
   `we:scripts/check-standards.mjs:1586` §8f) is a **built, unit-tested, `PLUG_DRIFT_ENFORCED = true`
   cross-repo byte-identity gate**. It is currently **vacuous**: its subject `we:plugs/` was deleted by #1047,
   so its `existsSync` guard is false and it checks nothing. This is the *only* mechanism that catches the
   gen-wrapper and ingest-adapter defects, and it already exists.
   **The declared pair list is authored by hand, not derived** — path equality cannot find these pairs, because
   the two headline generators sit at *different* relative paths (`we:scripts/` vs `fui:tools/`). Seeding it is
   part of this child's scope, from the inventory below.
2. **A new-path check over the named debt roots only**, with a **path-set ratchet**: a path may leave the debt
   list, never join it. The roots are `we:blocks/` plus the nine subsystem roots the inventory measures —
   `we:capabilities/`, `we:validation-generation/`, `we:guard/`, `we:validity-merge/`,
   `we:validator-resolution/`, `we:commitment-policy/`, `we:source-resolution/`, `we:module-resolution/`,
   `we:conformance-evidence/`. Explicitly **not** a whole-tree classifier (see *Why the obvious answer is wrong*
   below). Because it is a **new-path** check, existing debt is grandfathered structurally rather than by
   policy — there is no strictness dial to rule on.
   *The ratchet records ownership; it does not pre-judge disposition.* The anchor
   ([constellation-placement](../docs/agent/platform-decisions.md) `:172`–`:174`) assigns the non-engine
   subsystems to the deferred decision **#1784**, so their debt entries carry #1784 as owner and #1784 remains
   free to rule they stay.
3. **A coverage tripwire** — any `existsSync`-guarded check whose subject path has vanished must **ERROR**
   ("this check now covers nothing"), never silently skip. **This is the best-evidenced of the three, not the
   weakest:** the four-instance table below *is* its evidence base, and it is the only part that protects the
   other two. Note in particular that **part 1's own subject is scheduled for deletion** — #872 is what retires
   the byte-replication that produced the vendored generator pair, so when it lands the re-pointed gate goes
   vacuous exactly as it did when #1047 deleted `we:plugs/`. Only part 3 catches that recurrence. It is
   therefore **not** a carve-off candidate.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or — no rival "instrument shape A vs shape B" where one branch is flawed. The rule
itself is **already ratified** (#1246/#1282, [constellation-placement](../docs/agent/platform-decisions.md) rule 1);
what is missing is a carrier. So the call is one-sided: build it or don't, on merit and readiness.

**Prep drafted three candidate forks and both independent passes dissolved two of them; the third dissolved on
scope.** Recording that, because the dissolution is the substance of this card:

| Candidate fork | Disposition |
| --- | --- |
| *Codified placement map vs fail-closed classifier* | **Dissolved — support-both.** Fails the composability probe: the matcher set is the kernel and the prose table is a generated facade over it. The prior art uses exactly that shape (below). The draft had written the composition out itself, then labelled it a fork anyway. |
| *Closing condition: clean tree vs live instrument* | **Dissolved — not a fork.** Both branches reach the same end-state; the residuals graduate to #1245/#1294 either way. Routine item hygiene, already governed by the graduation and blocker-DAG rules — no ratifiable judgment, no broken branch to name. |
| *Debt policy: hard error / ratchet / warn-only* | **Dissolved — the question stops being askable.** Its fork-existence was manufactured by the whole-tree scope of the first candidate. Part 2 is a **new-path** check, so pre-existing debt is grandfathered *structurally* — there is no strictness dial left to set, and the ratchet is simply what a new-path check *is*, not one of three policies competing for the slot. |

## Why the obvious answer is wrong — the whole-tree classifier does not work

The intuitive move is to widen #2052's fail-closed `classifySurfacePaths`
(`we:scripts/check-standards-rules.mjs:2095`) from its `src/` zone to the whole tracked tree. Prep drafted that,
then ran it. **It fails on four independent counts, all measured:**

- **The repo already considered and rejected it, in writing, in the file being cited as precedent.**
  `we:scripts/check-standards-rules.mjs:2048`–`:2052`: *"Scope is deliberately the render-tree zone, NOT literally
  every tracked path… classifying them would be noise and would **red-gate the whole repo**."*
- **It red-gates on the certified-clean set.** Running the drafted matcher set verbatim over all 6,980 tracked
  paths yields 712 site / 1,114 standard / 124 impl / 4,256 neutral and **774 hard errors** — including 41 under
  `we:contracts/`, 26 under `we:conformance-vectors/`, 12 under `we:capability-manifest/` and 11 under
  `we:webcases/`, i.e. exactly the set the inventory below certifies as correctly placed.
- **It misclassifies the contracts it promises to protect.** All 13 contract and types modules under
  `we:blocks/` classify as errors, because the standard-surface matchers only reach `we:src/_data/`.
- **It is green on both defects that motivate it.** `we:scripts/gen-wrapper/` would be allow-listed as known
  debt, and the observed drift is **FUI growing while WE stands still** — the WE-side count never moves, so the
  check stays green forever. A path classifier cannot see file *content* and cannot see the sibling repo. It is
  categorically the wrong instrument for the headline defect.

## The real failure mode — silent scope-loss, not stale prose

Prep's first draft argued *"prose rots, code stays true."* **That is false in this repo, and the counter-evidence
is decisive.** The recurring defect is neither documents nor code — it is an **instrument whose subject
disappears without anyone noticing**. Four instances, all verified:

| Instance | How it lost its subject |
| --- | --- |
| `validatePlugWeFuiDrift` (#1304/#1350) | A real cross-repo byte-parity gate, `PLUG_DRIFT_ENFORCED = true` — went **vacuous** when #1047 deleted `we:plugs/`. Guarded by `existsSync`, so it reports success while checking nothing. |
| §9c codegen-placement invariants (#964) | `we:scripts/check-standards.mjs:1787` reads a MaaS module under `we:blocks/renderers/module-service/` that #1730 deleted. `existsSync`-guarded — arm (2) silently went dead. |
| The gen-wrapper reference fixture | Sanctioned as a "reference fixture" by #892 on **2026-06-18**; #1282 withdrew the reference-implementation tier *wholesale* on **2026-06-20**. It **survived its own repeal by two days**, because a ruling changes a rule but enumerates nothing. |
| #1245's slice coverage | Its plan named 16 block families; four were carved into items. All four resolved, so the epic reads done while its declared *first, load-bearing* target is untouched. |

This is why the instrument must be narrow and **coverage-reporting**, not broad and silent. A check that cannot
say *"I currently cover N paths, down from M"* is one deletion away from being decorative — which is what
happened twice already.

## The inventory, run 2026-08-17

Against [constellation-placement](../docs/agent/platform-decisions.md) rule 1. Method: `git ls-files`, so local
build debris is excluded (a working-tree sweep produced three phantom "orphaned copy" findings that vanish under
`git ls-files` — the classifier's input matters).

**The four soft spots this card named in June:**

| Soft spot | Status 2026-08-17 |
| --- | --- |
| `we:tools/maas/vite-plugin.ts` | ✅ **Gone.** `we:tools/` holds only `we:tools/trait-enforcer/traitManifestContract.ts` (plus its `__tests__/` companion). Canonical is `fui:tools/maas/vite-plugin.mjs`. Deleted by #1730. |
| `we:scripts/ingest-adapter/ingestComponent.mjs` vs `fui:tools/ingest-adapter/ingestComponent.mjs` | ⚠️ **Byte-identical today** (md5 `fc13d68d…`, 208 lines each) — but **ungated**, and identical only by luck; both have been frozen since June. |
| `we:scripts/gen-wrapper/` vs `fui:tools/gen-wrapper/` | ❌ **Drifted, at both scales.** *Per file:* `we:scripts/gen-wrapper/genWrapper.mjs` is **228 lines** against `fui:tools/gen-wrapper/genWrapper.mjs`'s **417** (263 diff lines) — FUI gained the whole #1518 live-mount variant system, absent from WE. *Per directory:* WE holds **437 tracked lines across 3 files**, FUI **1,270 across 11** — FUI additionally carries `fui:tools/gen-wrapper/surfaceContract.mjs`, `fui:tools/gen-wrapper/wrapperFormCatalog.mjs`, a `fui:tools/gen-wrapper/templates/` emitter, `fui:tools/gen-wrapper/ADDING-A-TARGET.md` and three `.d.ts` files that WE has no counterpart for. WE's copy last touched 2026-06-17, FUI's 2026-06-22. Its header self-declares `⚠ REFERENCE FIXTURE, NOT A STANDARD` — the tier #1282 withdrew. |
| `we:blocks/renderers/module-service/` | ✅ **Contract-only** — a 204-line pure data-and-types IR module ("no imports"), a 126-line OpenAPI projection, and the OpenAPI/golden JSON. Its reference fetch handler went with #1730. |

**The residual mass** (tracked, non-test, TypeScript). Under `we:blocks/` the total is **8,960** lines; deducting
1,147 lines of fixtures, 1,220 lines of contract and types modules, and the 330 contract-only lines of
`we:blocks/renderers/module-service/` gives **≈6,263 lines of delivery runtime**.

*Per-family totals below are **whole-family** figures — they include each family's own contract, types and
fixture lines, so they deliberately sum above the 6,263 runtime aggregate rather than partitioning it.*
`we:blocks/router/` 2,843 (19 files, including a 619-line custom element under `we:blocks/router/elements/`,
plus the sitemap/prerender/speculation-rules emitters; ~741 of the 2,843 are its types and fixtures),
`we:blocks/renderers/` 3,970, `we:blocks/resource-loader/` 784, `we:blocks/adapters/` 588,
`we:blocks/trusted-html/` 201, `we:blocks/stepper/` 141 (header: *"reference runtime for the draft `stepper`
block"*).

Outside `we:blocks/`, **nine subsystem roots hold impl totalling 5,883 lines**: `we:capabilities/` 2,418,
`we:validation-generation/` 1,570 (header: *"This is the **impl** half… kept in WE for now"*), `we:guard/` 397
(header: *"the runtime-impl half"*), `we:validity-merge/` 373, `we:validator-resolution/` 346,
`we:source-resolution/` 264, `we:commitment-policy/` 255, `we:conformance-evidence/` 143,
`we:module-resolution/` 117 — each a provider-plus-registry pair, which is rule 2's *literal* example of what
goes to FUI.

**Corroboration that `we:blocks/` is runtime, not contract:** 10 non-test files under `we:blocks/` carry a static
`from '@frontierui/…'` import. Contracts do not need a plug platform to import.
`we:scripts/guard-backward-edge.mjs:13` exists to deny that edge but is scoped to WE's own `src/**`, so all 10 sit
outside it.

**Cross-repo duplication:** counting tracked files at the **same relative path** in both repos across the
TypeScript, JavaScript, JSON, CSS and HTML extensions — **91 pairs, 30 byte-identical, 61 drifted**. (A wider
file-set definition yields 109/30/79; the count is definition-sensitive, so the method is stated rather than the
number asserted. Either way the drifted set is large and ungated.) Note this excludes the two headline
generators, which sit at *different* relative paths — `we:scripts/` versus `fui:tools/` — which is precisely why
part 1's gate needs an explicit declared pair list, not a path-equality sweep.

**Correctly placed, no action:** `we:contracts/`, `we:conformance-vectors/`, `we:capability-manifest/`,
`we:webcases/`, `we:wrapper-conformance/`, `we:tools/trait-enforcer/`, and the ~23 subsystem roots now reduced to
a single contract module each — `we:webpolicy/`, `we:webtheme/`, `we:webcompliance/`, `we:process/`, `we:intl/`,
`we:reliability/` and the rest. **The relocations that ran, ran well.** `we:plugs/` is gone (#1047). The failure
is not the moves; it is that nothing holds the line between them.

## Context & prior-art delta

The category is well-populated, and the delta is *what the instrument does with a file it has never seen*:

| Prior art | What it shares | What it lacks / the WE delta |
| --- | --- | --- |
| **`import-linter`** (`exhaustive = true`) | The cleanest statement of "an unclassified module is an error" | Python import graph only; `exhaustive` is off by default and `exhaustive_ignores` is the hole |
| **`eslint-plugin-boundaries`** (`no-unknown-files`) | The only surveyed tool that classifies *files*, which is what a placement rule needs | Anything under its ignore list is never analysed; JS/TS import graph only |
| **ArchUnit** + `FreezingArchRule` | An all-classes-contained assertion plus a violation-store **ratchet** that auto-shrinks | Java only — no confirmed port in ArchUnitNET or ts-arch, so the ratchet is ours to build |
| **Nx `enforce-module-boundaries`** | Fail-closed by construction — an untagged project may depend on nothing | Routinely defeated by the documented `sourceTag: '*'` escape; sees TS imports only |
| **Bazel visibility · Go internal · JPMS · Rust** | Compiler-enforced default-deny, zero config | Single structural axis; cannot express "this repo holds no runtime" |
| **web-platform-tests** | Carries the only *named* anti-implementation rule found anywhere — a lint banning Chromium Mojo bindings from the shared repo | Deny-list semantics; a rule per known-bad artifact, not a positive classification |
| **OpenFeature spec repo** | The closest analogue: a spec repo that normatively holds no evaluation logic, consumed as a submodule by every SDK | Its honest carve-out is the lesson — it *does* ship code under a tools directory. "Zero implementation" is only enforceable once the exceptions are written down |
| **OpenFeature + test262 gate shape** | **Generator + diff gate**: classify every path against a declared ignore list → regenerate a canonical artifact → CI fails on the diff | This is the shape that dissolves the doc-vs-check fork — the map becomes a *projection* of the classifier, so it cannot go stale |

**The synthesis the survey converges on**, and the reason the first candidate fork dissolved: Murphy, Notkin &
Sullivan's *Software Reflexion Models* (FSE-3, 1995) — high-level models *"are almost always inaccurate with
respect to the system's source code"*, and the fix is not a better document but to **keep the map, demote it from
truth to hypothesis, and let a tool compute the divergence**. ADR practice agrees from the other side: an ADR is
built to survive becoming false (dated, immutable, superseded), which is exactly why a *current-state inventory*
does not belong in one — Zimmermann names it the "Mega-ADR" / "Blueprint in Disguise" anti-pattern, and Microsoft's
guidance is blunt: *"Avoid making decision records design guides."*

**Correction worth carrying**, since the folk version of this argument is commonly mis-cited: in *Building
Evolutionary Architectures* a CI check is a **triggered** fitness function, not a *continual* one (continual means
production monitoring). The axis that actually carries the argument is **automated vs manual**. The general
technique also never reached "Adopt" on the ThoughtWorks Radar — only the narrow, concrete instantiations did.
That is itself an argument for the narrow instrument recommended here.

**One structural caveat.** A path classifier can only classify paths in the repo it runs in. In a multi-repo
constellation the *direction* of dependency is enforced structurally by package publishing — that is free. But
"this repo contains zero runtime implementation" is a **within-repo** property that the repo split does not
enforce. The split gives the arrow; only a within-repo instrument gives the emptiness.

## Dependencies & lineage

- **`blockedBy` — all three live edges retained.** Prep pruned only the three **already-resolved** edges
  (#1730/#1577/#1768), the mechanical normalization `check:readiness` itself flags as a `stale-edge`. The live
  edges stay: **#1294** (35/38; remaining is #2298/#2299/#2300, three prepared low-priority placement decisions),
  **#1245** (four filed children all resolved, ~6,600 lines of declared targets never carved into a slice;
  readiness lists it `sliceable`, and its own `blockedBy: [1353]` is itself stale), and **#872**.
- **#872 stays, and prep records why it reconsidered dropping it.** A first draft argued #872 governs
  *distribution*, not *residence*, and should be dropped on merit. The statute says otherwise, twice:
  [constellation-placement](../docs/agent/platform-decisions.md) `:175`–`:179` gates a **residence** end-state
  (the website's extraction to a product-tier surface) on #872 explicitly, and rule 3 at `:194`–`:196` states
  *"byte-replication is the interim"* — so #872 is precisely what retires the byte-replication that produced the
  two vendored generators. Dropping it would have contradicted the anchor this card exists to enforce.
- **Instrument precedent:** #2006 (the WE-website is a mis-homed product) → #2052 (the fail-closed
  `classifySurfacePaths` classifier, `we:site/README.md`). Cited as **precedent for the instrument question**, not
  as authority over the impl axis — #2052's ruling scope is the website surface, and its own source comment
  rejects the whole-tree widening. Authority for the impl axis is rule 1 + #1282 directly.
- **Ownership of the debt roots:** [constellation-placement](../docs/agent/platform-decisions.md) `:172`–`:174`
  assigns the non-engine subsystems to the deferred conformance-model decision **#1784**, not to #1294/#1245. Any
  seeded debt list must carry #1784 as owner where the anchor does.
- **Deliberately excluded from this card's scope — carried forward verbatim in substance from the pre-prep
  body, so the record of what this audit does *not* cover is not lost to the rewrite:**
  - **The WE-docs dogfooding migrations** (#777, #866, #1599–#1613, #1208). Those move the docs *site* onto FUI
    components — a **consumer-dogfooding axis**, not a question of where a tool or runtime is homed. They would
    be folded in only if this audit were widened to cover docs-surface consumption, which it is not.
  - **#1743** (re-home the geometry core into a shared region-select module). Listed here at filing, then
    **removed on 2026-06-24 with reasons**: it is a FUI-internal marquee-select refactor (parent #1734), not a
    cross-constellation tool/runtime relocation, so it does not bear on the zero-impl / standard·impl·product
    line this gate audits. The removal stands — it is recorded, not re-opened.
  - **The 2026-06-29 prep note.** An earlier `/prepare all` pass assessed this card *"not preppable ahead —
    deliberately deferred, not skipped"*, on the premise that the A/B answer **is** the constellation-wide
    inventory and so could not be run until the relocations landed. That premise is now **superseded, not
    contradicted**: prep ran the inventory anyway (2026-08-17) and found the answer is B, which is exactly what
    reveals that the ratifiable question was never A-vs-B but *what instrument reports it*.
- **Surfaced** 2026-06-24 during a constellation-wide WE-vs-FUI tool-placement review — the inventory that
  *cleared* gen-wrapper, ingest-adapter and MaaS as "on the right side of the line". Grounds:
  `we:docs/agent/platform-decisions.md` (#1246/#1282 zero-impl; #1565/#1566/#1771 the carve-out bounds), #1747.
  Research: [/research/zero-impl-boundary-enforcement/](/research/zero-impl-boundary-enforcement/).

## Recommendation — GO, on the narrow instrument

**Verdict: ACCEPTED ON MERIT — all three parts, none carved off.** Merit is conceded rather than open: the rule
is ratified statute (#1282) whose operative clause, *"no **new** WE-resident delivery runtime may be added"*, is
today enforced **nowhere**, and four verified instances show the absence biting. Per #2092 that concession
dissolves the gate — the human turn is a **one-glance batch-confirm**, not a weigh, and the card stays `open`
until that nod because a prep author's prose concession is not the human validation.

Part 3 was initially ranked the weakest and offered as a carve-off; **that was wrong and is withdrawn.** Its
evidence base is the four-instance table above, and it is the only part that protects the other two — including
against the case where part 1's own subject is retired by #872.

**Un-gate trigger — and the `blockedBy` consequence, stated precisely so the card is not both blocked and
buildable.** As filed, this card's deliverable was an *audit of the relocations*, which genuinely had to wait for
them; that is why the edges exist. Under this verdict the deliverable changes to *an instrument that reports on
the relocations*, which does not. **So on a GO, two of the three `blockedBy` edges drop as a direct consequence
of the verdict — #1294 and #1245 — while #872 stays.** #1294 and #1245 are relocation epics: they become what
the instrument *reports on*, not what gates it. **#872 does not drop**, for the reason recorded in *Dependencies
& lineage* above: [constellation-placement](../docs/agent/platform-decisions.md) `:175`–`:179` gates a residence
end-state on #872 explicitly, and rule 3 at `:194`–`:196` holds that *"byte-replication is the interim"* — #872
is precisely what retires the byte-replication that produced the vendored generator pair part 1 gates. Dropping
it would contradict the anchor this card exists to enforce. Prep has **not** enacted any of this: the frontmatter
still carries `blockedBy: ["1294","1245","872"]`, because dropping edges is the verdict's consequence, not prep's
to apply. (Prep pruned only the three *already-resolved* edges, which is mechanical normalization.) Until the
batch-confirm, the card reads blocked, and that is correct.

**The original resolve-status trigger is withdrawn as unsound, which needs no ratification** — it is a finding.
#1245's four filed children are all `resolved` while `we:blocks/router/` stands untouched, so "all `blockedBy`
resolved" would have fired on a false all-clear. **The corrected trigger for the eventual "is it tight?" answer
is the instrument's own coverage report reaching zero debt paths** — an evidence condition, not a status one.

**Buildable children** (carved at ratification, `blockedBy` this decision, each pre-scoped per #2619 — each gets
its **own** slice of the touch-set, never the whole set, per #2609):

| child | scope |
| --- | --- |
| Re-point the byte-parity gate at a hand-authored WE↔FUI duplicate pair list | `we:scripts/check-standards-rules.mjs`, `we:scripts/check-standards.mjs`, `we:scripts/__tests__/` |
| New-path check over the named debt roots + path-set ratchet | `we:scripts/check-standards-rules.mjs`, `we:scripts/__tests__/` |
| Coverage tripwire for subject-less guarded checks | `we:scripts/check-standards.mjs` |
| Amend the constellation-placement anchor to name the carrier | `we:docs/agent/platform-decisions.md` |

**Graduated findings — routed to a named owner each, and the routing is enacted, not promised.** Neither is a
child of this card; both are filed elsewhere, so neither graduates to nobody:

| Finding | Owner (filed) |
| --- | --- |
| All four of #1245's filed children are `resolved` while its declared *first, load-bearing* target `we:blocks/router/` (2,843 lines, 19 files) is untouched; its own `blockedBy: [1353]` is stale (#1353 resolved 2026-06-27) | **`we:backlog/xyp34m5-blocks-router-2843-lines-was-1245-s-declared-first-target-an.md`** — filed 2026-08-17, `relatedTo: ["1245","1770"]`, `scope: ["we:blocks/router/"]`. A `## Re-slice note` pointing at it is added to `we:backlog/1245-reference-runtime-blocks-router-navigation-are-duplicated-an.md` in this same change. **Merge-order caveat:** that item is not in this PR — it lands via the separate open PR **#1431** (`lane/filing-pass`). If #1431 is abandoned the citation goes dead and this finding graduates to nobody again, so #1431 must land (or the item be re-filed here) for the routing to hold. Filing it as a child of *this* card would be circular — #1245 is one of this card's own blockers. |
| 91 same-path WE↔FUI file pairs, 61 drifted, no reconciliation gate in either repo — part 1's hand-authored pair list targets the *different*-path generators and does not cover this set | **`we:backlog/xq9zmea-gate-the-61-drifted-same-path-we-fui-file-pairs-nothing-reco.md`** — filed 2026-08-17, `relatedTo: ["1770","872"]`. Deliberately kept out of part 1: widening the pair list to all 91 would re-import the breadth this card rejects, so it gets its own triage-then-gate item instead. |

**Skeptic:** REFUTED-AND-REBUILT — the verdict survives, the original proposal did not. An independent
attack-only pass verified the grounding against both trees and broke the first draft on four counts, all folded
in above. **Axis 0 (classification):** the draft's three `## Fork N` sections were re-routed — the instrument fork
fails the composability probe (matcher set as kernel, prose table as generated facade), the closing-condition fork
is item hygiene with no broken branch, and the debt-policy fork's existence was manufactured by the first fork's
whole-tree scope. The item was re-shaped to the validation-gate archetype accordingly. **Axis 1 (merit):** the
draft's load-bearing inference — *"prose rots, code stays true"* — was refuted **by this repo**, which contains
**two machine checks that already rotted into no-ops** (`validatePlugWeFuiDrift`, vacuous since #1047 deleted
`we:plugs/`; §9c arm 2, dead since #1730 deleted its subject file). That reframed the whole card: the defect is
**silent scope-loss**, not staleness, which is why part 3 exists and why the recommendation flipped from a
whole-tree classifier to a narrow one. The attack further showed the drafted classifier produces **774 hard
errors on the certified-clean set** and is **green on both motivating defects**, and identified the dormant
`PLUG_SHARED_CORE_FILES` gate as the instrument that actually catches them — now part 1. **Axis 2
(statute-overlap):** two collisions found and reconciled — the proposed drop of #872 contradicts
[constellation-placement](../docs/agent/platform-decisions.md) `:175`–`:179` and `:194`–`:196` (edge retained,
reasoning recorded above), and hardcoding tool paths as `impl` by string would freeze the *conclusion* of
[devtools-placement](../docs/agent/platform-decisions.md)'s consumer test into a path match on the same turf by a
different test (dropped — part 2 is scoped to declared debt roots, and tool placement stays with the judgment
test). **Axis 3 (citation-scope):** two citations downgraded — #2006 Fork 2's "mutually exclusive mechanics"
concerns two *physical carriers* and does not reach description-vs-enforcement, so it is now supporting context;
and a claimed precedent at `we:scripts/check-standards-rules.mjs:2109` was **false** (that line is the #2180
untracked-artifact guard, which names its *watched* set — the opposite pattern) and has been removed rather than
re-cited. Two of the attack's own numbers did not reproduce and are handled honestly above: the cross-repo pair
count is definition-sensitive (91/30/61 at same-relative-path, stated with its method), and the ratchet's seeded
line budgets were dropped entirely in favour of a **path-set** ratchet, which removes the class of error the
attack found (9 of 14 budgets wrong, and a line budget perversely fails the build for adding a unit test).

**Screen:** flagged(prio) → **gate dissolved to accepted-on-merit; item re-shaped twice.** Two independent
fresh-context passes ran, neither having seen the authoring.

*Pass 1, on the three-fork draft:* flagged **all three** — the instrument fork on question 1 (the ruling would be
invisible to any consumer across the WE↔FUI boundary, and what it turned on was a function signature, four
regexes and fourteen constants: reviewable code, not ratifiable statute), and the closing-condition and
debt-policy forks on question 2 (strip cost and timing and both differences evaporate). Its verdict on the
re-framing was that prep had substituted three questions it preferred for the one asked. **Fix applied:** code
shapes re-layered out of the decision into the children's scope, the three forks dissolved rather than stamped
over, and the item rebuilt to the validation-gate archetype.

*Pass 2, on the rebuilt gate (the #2092 partition):* **flagged(prio)** — merit is *flatly conceded*, not
conditional, so the gate dissolves to accepted-on-merit plus a scheduling edge with the human turn compressed to
a batch-confirm. It judged the three dissolutions sound and **not** over-corrected, but found five real defects,
**all fixed before stamping**: (1) the headline runtime figure did not reconcile with its own per-family
breakdown — recomputed from `git ls-files` to ≈6,263 lines, with family totals now labelled as whole-family
figures that deliberately do not partition it; (2) the card read as both blocked and buildable — the `blockedBy`
consequence is now stated as a consequence *of the verdict*, un-enacted by prep, so the card correctly reads
blocked until the confirm; (3) a listed child re-sliced #1245, one of this card's own blockers — circular, so it
is now a graduated finding filed as its own item (`we:backlog/xyp34m5-…`) rather than a child; (4) "the six subsystem roots" was never
enumerated and the inventory named five — measured and corrected to **nine**, listed explicitly; (5) part 3 was
ranked least-evidenced while the four-instance failure-mode table *is* its evidence — promoted, the carve-off
offer withdrawn, and its strongest argument surfaced (part 1's own subject is retired by #872, so only part 3
catches that recurrence). It also caught that the debt list would otherwise pre-judge the deferred **#1784**;
the entries now record #1784 as owner without ruling its disposition. Pass 2's residual position — that a card
which concedes merit should not consume a decision turn at all — is **agreed and applied**: the gate is dissolved
and the turn compressed, and the item stays `open` only because #2092 forbids auto-resolving on prep's say-so.

### Review jury (provisional — pre-registered #2638)

Care level: `high` (touches the statute anchor and `check:standards` itself). This jury binds against the item's
predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

**Predicted touch-set (#2619):** `we:scripts/check-standards-rules.mjs` · `we:scripts/check-standards.mjs` ·
`we:scripts/__tests__/` · `we:docs/agent/platform-decisions.md`.
