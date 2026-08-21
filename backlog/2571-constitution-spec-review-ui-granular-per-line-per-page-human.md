---
bornAs: xj9mhx0
kind: story
size: 8
status: open
blockedBy: []
dateOpened: "2026-07-19"
tags: []
---

# Constitution/spec review UI — granular per-line/per-page human sign-off for approval & amendment

A plateau-app product surface (WE holds zero UI) for the human side of #2564's spec-based-programming gates: reviewing and approving/amending constitution- and spec-tier changes. Beyond the AI gating, the human gets GRANULAR approval — sign-off per line/section/page the way important legal documents are signed, not one blanket approve button. Renders the ratified policy over the shared review core: human-gates-spec (a spec/contract change routes here), the substantively-entrenched constitutional-amendment ceremony (Fork 5 — propose → red-team → separate ratification, cooling period, committed record), and the advisory per-principle constitutional-consistency critique (the dissolved-Fork-6 support-both build; AI surfaces candidate conflicts, human rules). Keeps the human ACTIVE per line, never a passive rubber-stamp (the #2563 automation-bias rule). Extends the ruling console (#2494/#2555).

## Design

**Locus: plateau-app.** WE holds zero UI; nothing in this item is a WE code change. The `scope:` and the
lane for it belong to the plateau checkout.

**Three things already exist and must be reused, not rebuilt.**

1. **The surface pattern.** `plateau:src/backlog-view/ruling-surface.ts` is the closest sibling — the #2580
   read-only ruling surface plus the #2581 write half. It is structured as a **pure HTML-string builder**
   (`renderRulingSurface(data)`: no DOM, no fetch, every value escaped, a missing optional field renders
   ABSENT rather than as an empty row) plus a thin `mountRulingSurface(el)` that paints a skeleton, fetches,
   then re-renders. Its test file `plateau:src/backlog-view/ruling-surface.test.ts` exercises the builder
   directly and stubs fetch for the mount — that split is what makes this kind of surface tier-1 testable at
   all, and this item should copy it exactly.
2. **The granular-marking mechanic.** `plateau:src/backlog-view/webcases-review-buffer.ts` is already a
   per-item human sign-off buffer: each mark is held **pending** (shown optimistically), mirrored to
   `localStorage` for crash safety, keyed by a compound id, and a single "Submit review (N)" flush POSTs the
   whole batch as ONE lane → PR. It even carries the lesson this item needs — a mark holds BOTH a status verb
   and a note, because "mark it, then say why" must survive as two verdicts rather than a naive
   last-verb-wins. Per-line constitution sign-off is that reducer with a different key. Reuse it; a second
   buffer with its own `localStorage` schema is the failure mode here.
3. **The write port.** Every console mutation goes through the backlog write endpoint, which opens a lane,
   runs the CLI, gates, and lands a `ready-to-merge` PR — never a direct write to main. The ruling surface's
   ratify already POSTs `{ id, verb, codifiedTo, note? }` there. A constitution amendment is strictly more
   consequential than a decision ratify, so it uses the same transport, not a shortcut.

**The read-port boundary is a hard rule, not a style note.** The ruling surface's own docblock states the
#2558 R2 rule: the surface consumes ONLY the served DTO and never touches the CLI, disk, or `gh` from the
browser — so an evidence link the projection could not ground is simply absent from the DTO and the view can
never render a dead anchor. Per-line sign-off sharpens this: the **line identity** must come from the server
side, grounded against the actual file, or a reviewer signs off on a line number that has since moved.

**What #2564 actually ruled, and what it forbids.** Fork 5 chose **substantive entrenchment** — three things
this UI must realize rather than decorate: **(i)** exemption from #911's ordinary supersede-with-lineage, so
the constitution can only change through *this* gate and never through a routine superseding decision;
**(ii)** a cooling period measured in **days, not sessions**, which means propose and ratify are two separate
visits with persisted state between them, not two clicks in one; **(iii)** a **committed external artifact** —
the amendment diff *and* its red-team transcript land as a durable record. The dissolved-Fork-6 build is
**advisory only** and must argue **for and against** consistency against **each** constitutional principle: a
filtered "candidate inconsistencies" list is explicitly ruled out, because it anchors the human and implies
the unlisted principles were checked.

**The honest residual #2564 recorded, which this UI must not paper over:** solo, the author still ratifies,
so the constitution's own non-author invariant cannot be fully satisfied; the headcount quorum (Fork 5 (b))
is adopted only on polity growth. The surface should state that limitation on screen rather than presenting
a solo ratify as if it satisfied the ceremony.

**WHICH document is "the constitution" is an unruled fork — and an earlier draft of this card got it
wrong.** That draft named `plateau:constitution.md` as "the target artifact". It is almost certainly not:

- `plateau:docs/backlog-console-design.md` — the design record this card extends — defines the constitution
  tier as the statute plus the WE standards plus the agent charter — i.e.
  `we:docs/agent/platform-decisions.md` + the WE standards + `we:AGENTS.md`. A **WE-side** artifact.
- `plateau:constitution.md` self-describes in its closing section as holding *"goals and business objectives
  — not technical decisions"*, and points technical decisions at the backlog and at
  `we:docs/agent/platform-decisions.md`. It is the product's north-star document, not the invariant floor
  #2564 Fork 5 entrenches.
- It is also already **published**: `plateau:packages/saas/src/marketing/constitution.ts` bundles it with
  `?raw` and renders it at the public `/constitution` route (in `PUBLIC_ROUTES` in `plateau:src/main.ts`,
  beside `/pricing`, `/terms`, `/privacy`). Gating an unauthenticated marketing page behind a
  cooling-period amendment ceremony is a different product decision from gating the statute.

So **rule this before anything else**: which artifact does the sign-off surface review? The likely answer is
the WE statute, which makes this a plateau UI over a **WE-side** document and pushes the read port and the
write port back through the same WE lane → PR transport the ruling surface already uses. (Raised by the
independent review below.)

**There is already prior art for the line-identity fork, in the same repo.**
`plateau:packages/saas/src/marketing/constitution.ts` implements a heading `slug()` scheme and emits
`<hN id="...">` anchors for exactly this file. Whatever the answer to "what is a line", that renderer is
where the stable-anchor question has already been half-answered — read it before inventing a scheme.

## Forks this card does NOT settle — decide them before building

- **Which document is the constitution** — see the Design section above. This one gates the rest: the
  answer decides whether the surface reads a WE artifact or a plateau one, and therefore which read port
  and which write transport it uses.
- **What a "line" is.** Markdown source line, rendered paragraph, or a named anchor/section? A source line
  number is the easiest to render and the worst to persist — it moves on every edit above it. An anchor is
  stable but coarser than "per line". The existing ruling surface records its own version of this limitation
  ("the ruling is ITEM-level, not per-fork"), so this is a known and unsolved axis in this console.
- **Where a per-line sign-off is recorded.** Frontmatter cannot hold it; the webcases path writes verdicts
  through the write port into a committed ledger. Pick the analogue and say which.
- **How a cooling period is enforced by a UI.** A timestamp the surface merely displays is not entrenchment.
  Whatever enforces it must be server-side and must survive a page reload.

An agent that opens this card and starts writing a component has skipped the work. Size 8 is mostly these.

## Done when

- The pure render builder covers per-line sign-off state — unsigned, signed, amended, and a note attached —
  with every value escaped and absent optional fields rendering ABSENT rather than as empty rows. Pinned in a
  new test file beside `plateau:src/backlog-view/ruling-surface.test.ts`, following its builder-direct /
  fetch-stubbed split. Fails before, passes after (`npm test` in the plateau checkout).
- Marks coalesce: N per-line sign-offs produce exactly ONE write-port submission, and the pending set
  survives a reload — proven over the reducer in `plateau:src/backlog-view/webcases-review-buffer.ts`, not by
  a second buffer. Cheap check: no new `localStorage` key schema is introduced.
- The advisory consistency critique renders one verdict per constitutional principle, for **and** against,
  with **no** principle omitted — the rendered row count equals the enumerated-principle count of whichever
  artifact the fork above selects. That enumeration must be **defined** first: neither candidate has a
  section literally listing "principles" (`plateau:constitution.md` has a north-star paragraph, 3 CURRENT
  goals, 6 TOWARD goals and 4 business objectives), so the criterion is unmeasurable until the unit is
  named. A filtered candidate list fails it by construction.
- An amendment cannot be proposed and ratified in one visit: the ratify control is unavailable until the
  cooling period has elapsed, enforced server-side, and the surface says why. A page reload does not reset it.
- The four forks above are ruled and recorded on this card before any component is written — WHICH
  document, line identity, sign-off record location, cooling-period enforcement.

## Independent review — 2026-08-21

Confidence: **Low**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed; strategy: verify by mutation or reversion, ahead of implementation) — The card states 'The target artifact exists: plateau:constitution.md ... is a real document to render and sign off against, not a hypothetical' as settled fact, but `plateau:docs/backlog-console-design.md` (the design record #2571 says it extends via #2494/#2555) defines 'the Constitution' as WE's `we:docs/agent/platform-decisions.md` + WE standards + `we:AGENTS.md` — not `plateau:constitution.md`. The card never ruled this as a fork despite modeling exactly that pattern for line-identity/record-location/cooling-enforcement.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The card's 'three things already exist and must be reused, not rebuilt' survey omits a fourth live consumer of `plateau:constitution.md`: `plateau:packages/saas/src/marketing/constitution.ts`, routed publicly at /constitution (`plateau:src/main.ts`, in PUBLIC_ROUTES beside /pricing/terms/privacy). That renderer already implements a heading-based slug() anchor scheme for this exact file, directly relevant prior art for the card's own unresolved 'what is a line' fork, and it is never cited.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The card correctly requires ruling 'where a per-line sign-off is recorded' (the ledger analogue to `plateau:src/backlog-view/webcases-reviews-ledger.ts`) before any component is written, rather than letting two halves guess independently.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The card explicitly names the failure mode: 'A timestamp the surface merely displays is not entrenchment. Whatever enforces it must be server-side and must survive a page reload' — a guard against exactly the no-op-cooling-period trap #3103 catalogs.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card requires the solo-ratify residual (non-author invariant unmet) to be stated on screen rather than papered over, and requires cooling-period enforcement to survive reload — failures must surface, not silently pass.

**Corrections applied by this review:**

- The claim that plateau:constitution.md is settled as 'the target artifact ... not a hypothetical' does not hold: `plateau:docs/backlog-console-design.md` (the design record this card claims to extend) defines 'the Constitution' as `we:docs/agent/platform-decisions.md` + WE standards + `we:AGENTS.md`, a different, WE-side artifact — this needs to be ruled as an explicit fork, not asserted.
- `plateau:constitution.md` is currently wired as an unauthenticated public marketing page (`plateau:packages/saas/src/marketing/constitution.ts`, `plateau:src/main.ts` PUBLIC_ROUTES) and self-describes as holding 'goals and business objectives — not technical decisions' (`plateau:constitution.md`), in tension with treating it as the entrenched, ceremony-gated governance document Fork 5 describes.
- The 'Done when' criterion 'the count of rendered principle rows equals the count of principles in plateau:constitution.md' is not well-defined against the live document: `plateau:constitution.md` has no section literally enumerating 'principles' — only a North Star paragraph, 3 CURRENT goals, 6 TOWARD goals, and 4 business objectives (13 bullets total across three differently-purposed lists).

The card's central premise — that `plateau:constitution.md` is "the target artifact" for #2564's constitutional-amendment/sign-off ceremony — is unverified and appears to conflict with both the live repo and the card's own cited prior art, undermining the "Done when" criteria built on top of it.

_Recorded through the declared `review-prep` operation._
