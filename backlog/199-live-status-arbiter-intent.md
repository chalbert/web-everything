---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: "intent:live-region-status (extended with the announcer/arbiter contract — Precedence & coalescing: single winner error>loading>count + ~150ms debounce; Through-the-DOM coordination: statuschange event-in + adopt-region-by-reference / no-double-announce; Reference implementation: frontierui:blocks/droplist/LiveStatus.ts; cross-cutting consumers #013/#056/#059/#115)"
tags: [intent, live-status, announcer, aria-live, a11y, cross-cutting, traits]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
crossRef: { url: /intents/, label: intents catalog }
---

# Extract `live-status` as a standalone cross-cutting announcer intent

Harvested from [#023](/backlog/023-droplist-composition-open-contracts/) contract (2). The status
announcer built for droplist (`LiveStatus`) is not droplist-specific — its shape (multiple sources
push status by event → one polite `aria-live` region → precedence resolves the winner) is identical
everywhere a composite widget announces transient state. Promote it from a droplist trait to a
**named composable intent** so the other surfaces stop each reinventing announcements.

The same pattern already recurs, uncoordinated, across the backlog:
[#013](/backlog/013-gap-6-focus-announcements/) (focus announcements),
[#056](/backlog/056-nav-focus-reset-home/) (nav focus reset),
[#059](/backlog/059-pagination-focus-announcement/) (pagination announce),
[#115](/backlog/115-data-table-interactivity-announcements/) (data-table announcements). Each needs
"route transient status/error/count to a single polite region without double-announcing" — exactly
what the droplist `LiveStatus` solves.

**The intent's contract** (per #023's ruling — the announcer owns *announcement policy*, never the
data model):

- **Input by event, not handle** — sources `dispatchEvent(new CustomEvent('statuschange', { bubbles:
  true, detail: { kind, message } }))`; the announcer listens on the host. No source references the
  announcer or `aria-live` directly (through-the-DOM coordination).
- **One region, adopted by reference** — resolve an existing `status=<id>` node first, else create one
  `role="status"` (implicit polite). Two sources MUST share one region (the no-double-announce
  invariant), proven by test.
- **Precedence + debounce** — resolve a single winner by kind (`error > loading > count`, extensible)
  and debounce (~150ms) so rapid updates don't spam the screen reader. Errors stay *polite* and win
  the slot via precedence rather than a separate `assertive` region.

**This item is the *intent spec*** (the meta-pattern: name, contract, authoring note, validator
surface — see how intents are catalogued). The concrete droplist build of the same behavior stays in
[#137](/backlog/137-live-status-windowed-trait-surfaces/); this graduates the reusable paradigm so
#013/#056/#059/#115 can compose it instead of hand-rolling live regions. Borrow platform vocabulary
(`role="status"`, `aria-live`, `aria-busy`) rather than inventing terms.

Acceptance: a `live-status` (or `announce`) intent exists in the intents catalog with the
event-in/single-region-out/precedence contract documented; at least the droplist `LiveStatus` is
identified as its first implementation; the cross-cutting consumers above are cross-referenced.

## Progress
- **Status:** resolved — graduated into the existing `live-region-status` intent (dedup finding below);
  no `live-status` sibling minted.
- **Branch:** docs/standard-authoring-workflow
- **Done:** enriched `live-region-status` in `src/_data/intents.json` — added **Precedence & coalescing**
  (single winner `error > loading > count`, polite-only, ~150 ms debounce), **Through-the-DOM coordination**
  (`statuschange` event-in + adopt-region-by-reference / no-double-announce invariant), extended the
  Interface Protocol (`StatusChangeDetail` + the dispatch contract), added `statuschange` to `events`,
  added a **Reference implementation** section (frontierui `LiveStatus.ts`) + cross-cutting consumers
  #013/#056/#059/#115; promoted the debounce researchGap into the contract. check:standards 0/0; clean
  11ty build renders all new sections on `/intents/live-region-status/`.
- **Next:** —
- **Notes — dedup finding:** the intents catalog already has **`live-region-status`** (Live Region
  Status Intent) — the UX-only aria-live announcer with urgency/role/relevance dimensions. It *is* the
  cross-cutting announcer #199 asks for under a more precise id; its open `researchGaps` already flag
  exactly the debounce/coalescing piece. Per the dedup rule (extend, don't add a near-duplicate
  sibling) and immutable-id discipline (don't rename an established intent), #199 graduates into
  `live-region-status` rather than minting `live-status`. The concrete droplist build is
  `frontierui:blocks/droplist/LiveStatus.ts` (per #137 graduatedTo).
