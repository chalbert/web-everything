---
bornAs: xyjz84p
kind: decision
status: open
dateOpened: "2026-08-15"
preparedDate: "2026-08-16"
relatedTo: ["2705", "2721", "2723", "2725", "2726", "2727", "2728", "2729", "2731", "2732", "3132"]
tags: []
---

# FT screen: name the cross-slice "slot" + delegated-jump mechanism at LEAST three producer files assume

**Widened during independent review (2026-08-15) — the first draft undercounted this.** It named only two
producer/consumer pairs; the real count across epic #2705 is at least three producer files and nine
registering consumers:

- **#2721 (S1b, the mount file)** pre-builds "the header banner slot" for **#2723** (S8, the bottleneck
  banner).
- **#2725 (S2, the detail shell)** pre-builds "the dependencies-tab content slot" for **#2729** (S7, the
  one-hop dependency DAG — its own text: "registers into S2's dep-tab slot — does NOT edit the detail
  shell"), AND separately pre-builds "a data-driven section registry" that **#2727** (S3, velocity),
  **#2732** (S4, burn-up), and **#2726** (S5, rollup) each independently "register into."
- **#2726 (S5, the rollup)**, once built, itself becomes a THIRD producer: **#2731** (S6a, ship-log markers)
  "registers via rollup's marker slot," and **#2728** (S6b, filmstrip markers) is `blockedBy` #2726 with
  near-identical deliverable shape to #2731 though its own card text does not use the word "registers."

No producer card (#2721, #2725, #2726) names a mechanism, and none of the nine consumer cards originally did
either.

Surfaced while preparing #2723 to build-ready (2026-08-15): a real ES import cannot point at a file that does
not exist yet, and the producer in each pair (S1b, S2) necessarily ships and lands BEFORE its consumer (S8,
S7-dag) — `blockedBy` orders it that way. So "the slot" cannot be a static import in the producer's own file
at the time the producer is built.

#2723's own preparation resolved this FOR ITSELF two ways, both grounded in existing code (not invented):

1. **Corrected its own `scope:`** to include a small additive touch to the mount file (S1b's own file) —
   one import plus one call in the render pass the mount file already owns — rather than inventing a
   zero-touch auto-discovery scheme. This is safe because the ordering guarantee (`blockedBy`) already rules
   out a concurrent-edit conflict: by the time S8 is built, S1b is already merged.
2. **Grounded the render-function shape and the click-delegation shape in a real precedent already in this
   codebase**: `renderInfraBanner(lanes): string` (`plateau-app:src/backlog-view/lane-board.ts:305`) — a pure
   function returning `''` when nothing to show, interpolated inline by its caller's own template
   (`plateau-app:src/backlog-view/lane-board.ts:1459`) — and one delegated click listener elsewhere in the
   same file resolving `data-cause`/`data-id` via `.closest()` (`plateau-app:src/backlog-view/lane-board.ts:1651`)
   rather than a bespoke per-button listener.

## Why this needs a decision, not just #2723's private choice

#2723's fix is scoped to its own banner module and the mount file only. #2729 hits the exact same shape of
problem against #2725's detail shell — and so do #2727/#2732/#2726 (against #2725's section registry) and
#2731/#2728 (against #2726's rollup marker slot), once each is prepared. None of #2725, #2726, #2727, #2728,
#2729, #2731, or #2732 has been prepared yet. If they are each prepared independently without reference to
#2723's resolution, they may invent DIFFERENT mechanisms across up to three producer files (a real
slot-registry object, or `import.meta.glob`-based auto-discovery — both plausible, both already used
elsewhere in this codebase for OTHER purposes, e.g. `plateau-app:src/component-assembler/authoring.ts:20`) —
which would mean the feature-tracking screen ships several incompatible "registration" conventions across its
nine registering slices, undiscovered until integration. This is the mirror image of the #2803/#2351 lesson
in the story-preparation checklist: an unnamed cross-card architectural assumption that independently built
slices could each resolve differently — now confirmed to span a larger surface than the first draft of this
item accounted for.

## Sibling-decision check — no duplicate exists (this prep's first task)

`grep -rl xyjz84p backlog/` finds only this file's own frontmatter (`bornAs: xyjz84p`) — `xyjz84p` **is** this
item's pre-JIT-numbering birth id, not a separate sibling. See #3132's own "Sibling-decision check" section
(`we:backlog/3132-decide-the-section-registrys-shared-row-dom-contract-before-.md`) for the full trace of how
that card, prepared the same day, initially misread this relationship and corrected it. No fully-duplicate
sibling exists; the two items are cross-linked and cover genuinely disjoint scope (boundary restated under
Recommendation, below).

## Prior art — grounded against the live tree, not the cards' own prose (2026-08-16)

**Layer check first.** Like #3132, this is a **plateau-app product-layer implementation contract** (rule 96:
WE=standard, FUI=impl, plateau-app=product), not a new WE intent/block/plug/protocol/adapter: grepped
`we:src/_data/intents/` for "slot"/"registry"/"jump"/"delegat" vocabulary — the only near-hit is
`we:src/_data/intents/navigation.json` ("the UX vocabulary for moving between views," citing a "lateral tab
set" as one example structure), which governs the **declarative** navigation vocabulary a view exposes
(deep-link, history, transition), not the **internal JS call chain** one already-built module uses to invoke a
sibling module's already-declared tab behavior — checked, not applicable, no owning intent bypassed. No
`codifiedIn` claim is planned by this decision (same conclusion #3132 reached for its own scope), so the
statute-overlap check has no live rule to reconcile against.

**What actually exists on disk right now (verified 2026-08-16, not inherited from the cards' own claims):**
`plateau-app:src/feature-tracker/` holds exactly one file, `plateau-app:src/feature-tracker/feature-tracking.webcases.ts`
(233 lines, the S0r taxonomy register) — confirmed by direct directory listing. None of the mount file
(#2721), the detail shell (#2725), the rollup (#2726), or any consumer module exists yet. Every citation below
into a not-yet-built FT file is therefore a citation of a **prepared card's own Decided-design text**, not of
live code — flagged the same way #2723/#2725/#3132 flag it.

**#2721 and #2723 (the S1b↔S8 pair) have BOTH already been independently prepared to build-ready, and their
Decided-design sections together already specify a complete, concrete mechanism** — re-read directly from
`we:backlog/2721-s1b-fleet-scan-frame-shell-header-read-only-feature-epic-shi.md:49` and
`we:backlog/2723-s8-fleet-bottleneck-banner-derived-single-source-multi-all-b.md:208-228` (not from this
item's own paraphrase, which pre-dates the deep detail now in those cards):

- S1b renders an empty, hidden placeholder with a stable id (`<div class="bottleneck" id="bottleneck" …
  hidden>`) — "the same plain-DOM-id handoff every other mount in this app uses (no bespoke registration API
  to invent; e.g. `plateau-app:src/main.ts:696` looks up the Backlog view's mount point by id)."
- S8 exports a pure `renderBottleneckBanner(state: BottleneckState): string` (mirroring
  `renderInfraBanner(lanes): string`, `plateau-app:src/backlog-view/lane-board.ts:305` — verified: returns
  `''` when nothing to show, real markup otherwise, interpolated by its caller's own template string at
  `plateau-app:src/backlog-view/lane-board.ts:1459`, `${renderInfraBanner(board)}`). S8's own mount-seam edit
  is `document.getElementById('bottleneck').outerHTML = renderBottleneckBanner(state) || '<div … hidden>'`.
- The jump button carries `data-jump-to="<hubId>" data-jump-tab="dag"`, mirroring the `data-cause`/`data-id`
  pattern on `renderInfraBanner`'s own buttons (`plateau-app:src/backlog-view/lane-board.ts:295`); the mount
  file's **existing** delegated click listener (verified: `el.addEventListener('click', …)` at
  `plateau-app:src/backlog-view/lane-board.ts:1555`, dispatching through a chain of
  `t.closest<HTMLElement>('[data-…]')` branches — the `.lb-infra-resume` branch at
  `plateau-app:src/backlog-view/lane-board.ts:1651` is one link in that same chain) gains ONE more
  `[data-jump-to]` branch.

This is real, shipped-design precedent — not a hypothetical — and it answers this item's own Option 1 for
exactly the one-producer/one-consumer case.

**#2725 (S2, the detail shell) has ALSO already been independently prepared to build-ready, and lands on a
*different*, though not incompatible, shape** — re-read directly from
`we:backlog/2725-s2-detail-shell-section-registry-tabs-sub-line-empty-leaf.md:161-224` (as amended in place by
#3132's own action item): a `Map<SectionId, SectionDef>` registry, `registerSection(def): void` (idempotent,
explicitly modeled on `registerTabs`'s "call once, safe if called again" idiom), with `render(container,
feature): void` — an **imperative** DOM-mutation callback, not a pure string-returning function. Grepped
`registerSection`/`SectionRegistry`/`renderers[` across `plateau-app/src`, the `frontierui` checkout, and this
repo's own `scripts`/`demos` (per #2725's own Grounding section, independently re-confirmed here): **zero**
hits anywhere — this Map-registry shape is genuinely new, invented by #2725's own preparation because it
serves four simultaneous-or-alternating registrants (velocity/burnup/rollup/dag), not one.

**So the two already-shipped-design pairs in this exact epic do NOT use the same mechanism** — the concrete
realization of the risk this item's own "Why this needs a decision" section warns about, though a defensible
one (see Fork 1). This is the live, unresolved core of what "ratify a convention" actually has to reconcile.

**The `import.meta.glob`-based "auto-discovery" idea this item's Option 2 names has exactly one precedent in
this codebase, and it is NOT a DOM-registration precedent** — `plateau-app:src/component-assembler/authoring.ts:18-20`
uses `import.meta.glob('../../../webeverything/src/_data/intents/*.json', { eager: true, import: 'default' })`
to eagerly load a directory of **build-time-known, static JSON data files** into a read-only catalog array —
the same pattern `plateau-app:src/component-assembler/authoring.ts:38` uses for the blocks directory. Neither
use case wires a **runtime UI slot handoff** between two source files that ship in different, `blockedBy`-
ordered PRs weeks apart; both glob calls resolve against files that already exist in full at every build. No
repo precedent — WE, FrontierUI, or plateau-app — auto-discovers a DOM-registration target this way. This
directly weakens Option 2's "already used elsewhere in this codebase for OTHER purposes" framing from this
item's first draft: the citation is real, but the "OTHER purposes" gap between it and what Option 2 proposes is
wider than the original phrasing implied.

**The delegated-jump mechanism's "switch tabs" half has a concrete, already-shipped public API this item's
first draft never located.** #2725's own Decided design (`we:backlog/2725-s2-detail-shell-section-registry-tabs-sub-line-empty-leaf.md:138-159`,
citing the codified `#first-party-dogfood` mandate, #1253) adopts FrontierUI's `<we-tabs>` (`registerTabs`,
`frontierui:blocks/tabs/TabsElement.ts`) for its own two tabs — **not** hand-rolled `role="tab"` buttons.
`TabsElement` (the custom element itself, not just its internal `TabGroupBehavior` kernel) exports a
first-class public method: `activate(name: string): boolean { return this.#behavior?.activate(name) ?? false;
}` (`frontierui:blocks/tabs/TabsElement.ts:74`), forwarding to the kernel's own `activate(name)`
(`frontierui:blocks/tabs/TabGroupBehavior.ts:115-119`, matched by `tab-trigger` attribute value). This is the
correct, documented entry point for "switch to tab X from outside the tabs element" — no reach into
`CustomAttribute`'s internal attachment registry is needed, and no card currently names it (Fork 2, below).

**Known occurrences (why "producer pre-builds a slot, consumer registers into it" is a supported, recurring
shape, not a novel invention):** the shipped-design precedent above (`renderInfraBanner`/`registerSection`) is
itself the strongest occurrence — this exact codebase has now independently reinvented compatible-in-spirit
versions of the pattern twice. Beyond this repo: native Shadow DOM's `<slot>` is the platform's own
producer/consumer content-distribution primitive (cited already in #3132's own prior art as the naming
precedent, not a candidate implementation — `plateau-app` renders light-DOM per house style, so `<slot>`
itself is not reusable here); WordPress's action/filter hook registry and VS Code's "contribution points" are
both shipped, widely-used instances of "producer names an extension point ahead of time; a consumer that ships
later registers into it by a stable key," the same shape this item's Option 1 already follows.

## Per-fork classification (7-question pass, summarized)

**Which layer?** Both forks are plateau-app product-layer (confirmed above). **Fixed mechanic or configurable
dimension?** Fork 1 is a forced pick, not a dimension: letting each producer choose freely (this item's own
excluded Option 3) is not a legitimate second end-state — it is the exact divergence-across-slices risk this
item exists to prevent, and the risk is no longer hypothetical (see Prior art: #2721/#2723 and #2725 already
landed on two different shapes). Fork 2 is also a forced-leaning choice once #1253's dogfood mandate is
applied: hand-rolling tab-switch state is excluded outright; the residual choice (call the public method vs.
simulate a click) is a genuine, narrower either/or. **Most-permissive default / DI-injectable?** Fork 1's
default (below) is the more DI-friendly of its two live options — it lets each producer choose the minimum
machinery its own registrant topology needs, declared locally at each producer's own call site, rather than a
single global shape imposed regardless of fit.

## Fork 1 — Cross-slice registration mechanism: one epic-wide convention, or free choice per producer?

**Fork-existence justification:** the excluded branch (this item's original Option 3, "leave it to each
slice's own preparation to decide independently") is not a second legitimate end-state — it is the concrete
failure mode this item was filed to prevent, and it has already partially happened once in this exact epic
(#2721/#2723 landed on a plain-id + pure-render-string shape; #2725 landed on a `Map`-keyed imperative-callback
registry — see Prior art). Left unratified, #2726's still-unprepared marker slot is free to invent a *third*
shape, discovered only at integration. A real either/or remains between the two live conventions below.

1. **Codify ONE rule with a built-in threshold, not two arbitrary shapes:** *register explicitly (never
   auto-discover); use the minimum machinery the producer's actual registrant topology needs* —
   - **Exactly one, fixed consumer, ever** (S1b↔S8): a stable-id placeholder + a pure `render<X>(state):
     string` function, filled via one `getElementById(...).outerHTML =` (or equivalent template
     interpolation) call in the producer's existing render pass. Matches #2721/#2723 exactly as shipped.
   - **Exactly one of several REGISTRANTS ever active at a time, mutually exclusive by a discriminant** (S5's
     rollup marker slot: #2731 ship-log XOR #2728 filmstrip, never both for one epic row — per #3132's own
     Fork-2 skeptic note, "mutually-exclusive per-kind dispatch... not simultaneous co-tenancy"): a small
     keyed lookup (`Map<MarkerKind, (epic) => string>` or equivalent), each entry added via one explicit
     `registerMarker(kind, render)` call, dispatched by the row's own `kind` field. Lighter than #2725's
     registry (no `group`/co-tenancy machinery — nothing ever shares a container) but still explicit, still
     keyed, still no auto-discovery.
   - **Two or more registrants that may render SIMULTANEOUSLY into shared real estate** (S2's `.velocity`
     row: velocity + burnup, per #3132's own ruling): the `Map<SectionId, SectionDef>` + `group`-key registry
     #2725/#3132 already shipped. Matches #2725 exactly as shipped.

   The dispatching test is **"how many registrants can be simultaneously active for one producer instance,"**
   not a raw headcount — this sharpens the item's own first-draft framing ("two-consumer vs four-consumer")
   into a principled rule rather than an arbitrary numeric cutoff (see Skeptic, below). Cheapest: zero rework
   for #2721/#2723 or #2725/#3132, both already shipped-design. #2726's marker slot is the case this rule's
   middle bullet is *for* — but see the flagged contradiction immediately below before treating it as settled.

   ```ts
   // The shape this fork's middle bullet recommends for a mutually-exclusive marker dispatch:
   export type MarkerKind = 'shiplog' | 'filmstrip';
   const MARKERS = new Map<MarkerKind, (epic: EpicRecord) => string>();
   export function registerMarker(kind: MarkerKind, render: (epic: EpicRecord) => string): void {
     MARKERS.set(kind, render); // idempotent — mirrors registerSection/registerTabs
   }
   // in the rollup's own render pass, per epic row:
   const render = MARKERS.get(epic.markerKind);
   markerSlotEl.outerHTML = render ? render(epic) : '<div class="marker" hidden></div>';
   ```

   **Flagged during this prep's skeptic pass (2026-08-16): #2726's OWN already-shipped-design Decided-design
   section does NOT use this shape, and directly contradicts #2731's/#2728's own scope.** Re-read directly:
   `we:backlog/2726-s5-epic-slice-rollup-with-connector-rails.md:97-98` has `plateau-app:src/feature-tracker/rollup.ts`
   itself write and own `filmstrip(epic)`/`shiplog(epic)` inline — "epic→slice rollup with connector rails
   (`renderOverview()`, `epicNode()`, `filmstrip()`, `shiplog()`)... per epic kind" — dispatched directly
   inside that file's own render pass, **not** behind an external `registerMarker`/keyed-lookup slot.
   Meanwhile `we:backlog/2731-s6a-ship-log-markers-build-epics-generic-fallback.md` and
   `we:backlog/2728-s6b-filmstrip-markers-visual-epics-empty-filmstrip.md` are both **unprepared stub cards**
   (title/deliverable/scope only, no Grounding or Decided-design section) that name their OWN separate scope
   files (`plateau-app:src/feature-tracker/markers-shiplog.ts`, `plateau-app:src/feature-tracker/markers-filmstrip.ts`)
   and state "Registers via rollup's marker slot" — assuming an external registration relationship #2726's own
   shipped design does not provide. **This is exactly the cross-card divergence this item exists to catch,
   found live rather than hypothetically** (surfaced by this prep's independent skeptic sub-agent, not caught
   during authoring). This item does not resolve which side is stale — that is a factual reconciliation
   between #2726 and #2731/#2728, not a mechanism-convention call — but names it explicitly so whoever next
   touches any of the three doesn't silently ship the contradiction: if #2731/#2728 stay separate files, this
   fork's ruling says #2726 should pre-build the `registerMarker` slot above (mirroring the shape #2721 already
   pre-builds for #2723) rather than inlining `filmstrip`/`shiplog` itself; if #2726's inline design stands,
   #2731/#2728 are redundant stub cards that should be folded into #2726's own scope instead of landing
   separately.

2. **Build a real, generic `import.meta.glob`-based slot-registry module** removing explicit registration
   calls everywhere, including rewriting #2721/#2723's and #2725/#3132's already-shipped-design call sites.
   No existing DOM-registration precedent anywhere in this codebase (the only `import.meta.glob` precedent
   found loads static, build-time-known JSON data — see Prior art); real new machinery to design, build, and
   prove idempotent/ordering-safe against `blockedBy`-staggered landings; zero benefit at the S1b↔S8 pair
   (exactly one consumer, nothing to auto-discover); active rework cost against two independently-reviewed,
   Medium-High/High-confidence cards.

**Recommended default: (1)**, restated as the single principled rule above (not "two shapes," one rule with a
topology-driven threshold). It costs zero rework against what's already shipped-design in this epic, it is the
only option consistent with the epic's own `blockedBy`-ordering guarantee (each producer's follow-up edit is
safe precisely because the consumer always lands after the producer merges — same reasoning #2723's own
Grounding already uses), and (2)'s strongest justification (four-plus registrants "amortising" the cost of a
generic registry) is now moot: #2725 already built and shipped-designed its own Map-registry by hand, at zero
marginal cost over a generic one, because the registrants' shapes differ enough (co-tenancy vs standalone) that
a truly generic auto-discovery scheme would still need per-registrant configuration.

**Skeptic: SURVIVES-WITH-AMENDMENT.** Attacked on: (0) classification — is "codify one rule with a threshold"
actually a config dimension in disguise (Q4: are the three topology cases just three "legitimate end-states" a
producer freely picks among, i.e., support-both, not a fork)? No: the topology is not a producer's free choice
— it is dictated by how many registrants a producer's real consumers require, discovered by reading the
consumer set, not selected for taste. The fork is genuinely between *this ONE rule* (whatever machinery its
topology test selects) and *(2)'s wholesale replacement*, not between the three topology cases themselves
(those are the rule's own internal branches, not alternatives the ratification picks between). (1) Merit — a
real attack landed and was folded into the rewrite above: the original framing ("consumer-count-gated, 1 vs
2+") is arbitrary and would have misclassified #2726's marker slot, which has TWO registrants (#2731, #2728)
but — per #3132's own Fork-2 skeptic note about that exact pair — they are mutually exclusive, not
simultaneous co-tenants, so the "2+ consumers → #2725's `group`-key co-tenancy registry" reading this item's
own first draft implied would have been wrong; #2726 needs the lighter keyed-dispatch shape (Fork 1's middle
bullet), not #2725's heavier one. Rewritten above from a headcount test to a simultaneity test, which now
correctly routes all three known cases. **A second, independent skeptic pass (2026-08-16) on this rewritten
default found a further real problem, folded in above rather than reopening the fork:** #2726's own
already-shipped Decided-design text does not actually use this rule's middle-bullet shape, and directly
conflicts with #2731's/#2728's own scope assumptions (see the flagged note under option 1's code snippet,
above) — the topology rule itself survives (it correctly identifies which shape #2726's marker slot *should*
use once #2726/#2731/#2728 are reconciled), but the item's first-pass claim that #2726 "gets a named default it
didn't have before" was inaccurate — #2726 already has a *conflicting* one, now named explicitly rather than
silently papered over. (2) Statute-overlap — none; no `codifiedIn` planned (Prior art,
layer check). (3) Citation-scope — #1253's dogfood mandate is cited in Prior art for Fork 2 (tabs), not Fork
1; not misapplied here (Fork 1 cites no anchor as authority, only shipped-code precedent). Default survives
with the topology-test amendment folded in.

**Screen: clear.** Observable, cross-file contract (which shape a producer must ship so a `blockedBy`-later
consumer's code actually compiles and wires correctly against it) — not an impl detail invisible across a
module boundary; every registering consumer card must code against whichever shape its producer commits to.
A real merit difference survives a zero-build-cost hypothetical too: even free to build and maintain instantly,
(1)'s topology-matched shapes are simpler at each producer's actual call site than (2)'s uniform generic
registry, and (2) still requires per-registrant `group`/co-tenancy configuration wherever registrants share
real estate — the generic mechanism doesn't eliminate that complexity, it just relocates it.

## Fork 2 — Delegated-jump mechanism: how does a producer's cross-navigation control switch to a tab a *different*, `blockedBy`-later file owns?

**Fork-existence justification:** #2723's own Decided design already names the attribute convention
(`data-jump-to`/`data-jump-tab`) and the delegation shape (one more `[data-jump-to]` branch on the mount
file's existing delegated listener — see Prior art) — that half is not open. What remains unnamed by any card
is the exact call this branch makes to actually flip the active tab. One branch is excluded as broken: mutating
ad hoc module state (mirroring the ratified v3 mock's own hand-authored `TAB="dag"` global + a full manual
re-render) directly contradicts #2725's own already-shipped-design adoption of `<we-tabs>`/`TabGroupBehavior`
under the codified `#first-party-dogfood` mandate (#1253, resolved) — "hand-rolled UI is a conformance defect"
when a FUI component already provides the interaction, and tabs is explicitly named as shipped-and-gated-in.
That leaves a genuine two-way choice for how the delegated listener reaches the already-adopted component.

1. **Call the tabs element's own public method.** `document.querySelector<TabsElement>('we-tabs.dt-tabs')
   ?.activate(tabName)` — `TabsElement.activate(name: string): boolean`
   (`frontierui:blocks/tabs/TabsElement.ts:74`), a first-class, documented public method that forwards to the
   internal `TabGroupBehavior` kernel's own `activate(name)` (`frontierui:blocks/tabs/TabGroupBehavior.ts:115-119`).
   No reach into the kernel's internals, no dependency on `CustomAttribute`'s attachment bookkeeping.
2. **Simulate a user click on the matching trigger.** `document.querySelector<HTMLElement>('[tab-trigger="'
   + tabName + '"]')?.click()` — relies on the trigger's own click handler (installed by `TabGroupBehavior`)
   firing as a side effect, rather than calling a documented entry point directly. Achieves the same visible
   result today, but is indirect (depends on an internal listener wiring, not a contract), and a real click
   also carries pointer-event semantics (implicit focus move, potential double-handling if a future revision
   adds other click-triggered side effects to the trigger) that a plain method call does not.

```ts
// mount.ts (S1b) — the delegated listener's new [data-jump-to] branch (Decided design §2 in #2723).
// ORDER MATTERS (flagged by this prep's independent skeptic pass, 2026-08-16 — see Skeptic below):
// #2725's own renderDetail(container, feature) is documented "replaces container's content each call,"
// and its template re-emits <we-tabs class="dt-tabs" default="overview"> fresh every render. A freshly
// (re)created custom element re-initializes to its `default` attribute on connectedCallback — so calling
// .activate() BEFORE selectFeature (which triggers that re-render) gets silently undone the instant the
// re-render lands. selectFeature must run FIRST; only THEN does .activate() target the settled element.
const jumpBtn = t.closest<HTMLElement>('[data-jump-to]');
if (jumpBtn) {
  const hubId = jumpBtn.getAttribute('data-jump-to');
  const tab = jumpBtn.getAttribute('data-jump-tab'); // e.g. 'dag'
  if (hubId) selectFeature(hubId, true); // the shared feature-selection fn, owned by S1b/S10 (#2719) — FIRST
  if (tab) (el.querySelector(`we-tabs.dt-tabs`) as TabsElement | null)?.activate(tab); // Fork 2 default — SECOND
}
```

**Recommended default: (1), call `TabsElement.activate(name)` directly.** It is the documented, first-class
public surface the component itself exports for exactly this purpose; (2) achieves the same visible effect
today only because of how `TabGroupBehavior` happens to be wired internally, which is not a contract the
producer file should depend on.

**Skeptic: SURVIVES-WITH-AMENDMENT.** Attacked on: (0) classification — is this actually a config dimension
(both call shapes are legitimate, freely swappable)? No: only one will exist in the shipped delegated-listener
branch: a `blockedBy`-later reader of the mount file's code needs one call to copy, not a documented choice
between two. (1) Merit — tried to find a reason (2) might actually be preferable (e.g., "clicking" also
handles some implicit focus-management #2725's card wants) — checked #2725's own acceptance line 4 ("a tab
switch keeps visual + ARIA in lockstep") and `TabGroupBehavior.activate`'s implementation
(`frontierui:blocks/tabs/TabGroupBehavior.ts:115-119`, which calls the same internal `#activateTab` a real
click does, setting `aria-selected`/`tabindex` identically) — no functional gap between the two paths exists
today, so (2)'s only "advantage" is illusory; the coupling cost against an undocumented internal wiring stands
unrefuted. **A second, independent skeptic pass (2026-08-16) found a real correctness bug in this fork's own
reference snippet, not in the choice between (1)/(2):** the first-drafted snippet called `.activate(tab)`
*before* `selectFeature(hubId, true)`; since `selectFeature` triggers #2725's `renderDetail`, which
"replaces container's content each call" and re-emits `<we-tabs default="overview">` fresh, an `.activate()`
call made before that re-render lands gets silently undone the moment the re-render fires — the exact
render-order failure class #2723's own Grounding already names for the v3 mock's `BOTTLENECK_ID` bug, now
found live in this item's own illustrative code rather than caught only in the abstract. Fixed in the code
snippet above (call `selectFeature` first, `.activate()` second) with the hazard documented inline; this
affects both (1) and (2) equally (a simulated click has the identical existence/ordering problem), so it does
not change which option wins, but the item was wrong to publish an example that wouldn't actually work as
written. (2) Statute-overlap — the cited authority is #1253 (`#first-party-dogfood`), used only to exclude
the hand-rolled-state branch, not to pick between (1)/(2) — re-checked #1253's own scope (component
**adoption**, not call-shape once adopted) and confirmed it does not reach far enough to settle (1) vs (2) on
its own; the merit argument above carries that part of the ruling instead, not an over-extended citation. (3)
Citation-scope — `TabsElement.activate`'s own doc comment ("Activate a tab by its tab-trigger name") is read
directly, not inferred, so no scope-stretching risk. Default survives, amended only in its worked example.

**Screen: clear, reframed.** A fresh-context screen (2026-08-16) correctly flagged the first draft's framing
as overstated: today this call shape lives in exactly ONE branch of ONE delegated listener in ONE file
(`plateau-app:src/feature-tracker/mount.ts`), not "every future handler" — no other prepared card currently
calls `.activate()` or simulates a click, and #2726 has no cross-navigation of its own scoped yet. Corrected
framing: this is a same-file robustness/precedent choice (which FUI entry point one function depends on), not
a many-caller cross-file contract — but that does NOT make it prioritization in disguise (question 2 still
holds): a genuine lock-in/fragility difference remains under a zero-cost hypothetical (documented public
method vs. undocumented internal click-wiring a future `TabGroupBehavior` revision could change without
notice), now reinforced by the render-order hazard above, which is a real correctness distinction, not a
stand-in for effort. Still `clear` on the merit axis; the observability rationale is narrowed to match what's
actually true rather than the broader "every future handler copies this" claim the first draft made. A merit
difference survives a zero-cost hypothetical: (1) depends only on a documented contract; (2) depends on
internal wiring that a future `TabGroupBehavior` revision is free to change without notice, a genuine
lock-in/fragility difference, not a stand-in for which is less code to write (both are one line).

## Recommendation

**Rule Fork 1(1) — the topology-driven explicit-registration rule — and Fork 2(1) — call `TabsElement.activate`
directly — together, as one ruling.** Both defaults survived two independent adversarial passes (an authoring-
session skeptic and a separate throwaway skeptic sub-agent) with real findings folded into each: Fork 1's
headcount test corrected to a simultaneity test (which changes #2726's own default shape) plus a live
#2726-vs-#2731/#2728 scope contradiction flagged, not resolved, by this item; Fork 2's worked example corrected
for a render-order bug (its choice of API unaffected) and its Screen framing narrowed from an overstated
many-caller claim to the true same-file scope. This item stays the one place that names the epic-wide
convention; #2721/#2723's and #2725/#3132's own cards already conform (no edit needed there), and #2726's own
future preparation should cite this item's Fork 1 middle bullet + flagged contradiction + code snippet
directly for its marker slot rather than re-deriving it.

**Cross-reference — the boundary with #3132 (added 2026-08-15, independent review; both items' correction
history is preserved in their own bodies).** `we:backlog/3132-decide-the-section-registrys-shared-row-dom-contract-before-.md`
(prepared the same day, independently, then cross-linked both directions) decided a narrower, different
question for #2725's registry: DOM-container ownership between registrants that already call #2725's existing,
explicit `registerSection()` — its Fork 2 rules a registry-owned `group` key over a static shell-owned shared
reference, so co-tenant registrants (velocity, burnup) share one DOM row without clobbering each other's
nodes. #3132's Fork 2 never evaluated auto-discovery, and never named the S1b↔S8 pair's or S5's own marker-slot
mechanism at all — both of its options assumed #2725's explicit `registerSection()` calls as a given. **This
item settles the epic-wide registration-mechanism question across all three producer files (including
ratifying #2725's already-shipped registry shape as correct for its own topology) and the delegated-jump
call-shape question; #3132 settles only the narrower DOM-container-ownership sub-question for #2725's shared
row.** The two items compose without overlap: #3132's ruling is the concrete `group`-key implementation Fork
1(1)'s third bullet above cites as already shipped for the simultaneous-co-tenancy case.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (system machinery feeding a 24-open-child epic, the same care band #3132 used for the
same epic; predicted touch-set: `plateau-app:src/feature-tracker/mount.ts`,
`plateau-app:src/feature-tracker/detail.ts`, `plateau-app:src/feature-tracker/rollup.ts`). This jury binds
against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
