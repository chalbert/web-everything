---
bornAs: xy0722q
kind: decision
size: 2
parent: "2505"
status: resolved
preparedDate: "2026-07-19"
dateOpened: "2026-07-19"
dateResolved: "2026-07-19"
codifiedIn: one-off
tags: [plateau-loop, console, placement, design-doc, constellation, design-forks]
---

# Where does the console design record live — plateau-app vs we:docs/design

The console design record (`we:docs/design/backlog-console-design.md` + the
`we:docs/design/mocks/console-ruling-surface.html` mock) was graduated to WE in Phase 0 ([#2556]) — my call,
with no decision. Per the WE-boundary rule (WE holds only reviewed shared primitives; no single-app business
logic; a placement call routes through a reviewed decision), that placement itself needs ratifying rather than
a unilateral re-home. This decides the doc's home. Prepared, ready to ratify.

## Fork 1 — the design record's home
*Fork exists:* the record is a single product's console design (role×lifecycle, scope-lease, the 37 states) —
app-specific content — but it is a *reference/record* (docs), and WE legitimately holds project docs
(`we:docs/agent/*`). The two homes genuinely exclude each other (one canonical location).

- **(a) plateau-app** *(recommended)* — move the doc + mock to plateau-app (its birthplace; it was an
  uncommitted plateau-app lane doc before Phase 0). It is one product's business logic/design record, so it
  lives with the product; WE holds none of it. Cost: the `we:docs/design/…` refs in the resolved decisions
  (#2554/#2556/#2557/#2558/#2561) become cross-repo pointers or need updating.
- **(b) stay in `we:docs/design/`** — treat it as a project *reference record*, not a standard or
  business-logic code. It is cited by resolved WE decisions (`codifiedIn` context) and holds the ratified
  grammar the reviewed mints (#2534–2538) referenced, so keeping it in WE keeps those cites local;
  `we:docs/agent/*` sets precedent for WE-held docs.

**Recommended default: (a) plateau-app.** The boundary rule is about *ownership*, and this record is owned by
one product; `we:docs/agent/*` documents the *constellation itself*, whereas this documents *one app's console*
— a different thing. The cite-churn is a one-time cost and the resolved decisions' rulings live in their own
resolved bodies (`codifiedIn: one-off`), not in the doc, so a moved-doc pointer suffices.

`Skeptic:` SURVIVES-WITH-AMENDMENT — attack: "it's a doc, not code/standard; WE holds docs; moving it breaks
live cites for marginal purity." Amendment folded: the deciding line is *ownership* (one product) not
*format* (doc vs code) — a product design record is app-owned regardless of being prose; and the cite-churn is
bounded (prose pointers, not gate-failing). If (b) is ruled, record *why* the app-owned exception holds so it
does not become a general "app docs in WE" loophole.
`Screen:` clear — the call is a visible ownership/placement property (which repo owns the record), not an impl
detail; both branches free-to-build differ on a real boundary-merit axis (app-owned vs shared-reference), not
prioritization.

## Acceptance
The doc's home is ruled; if (a), a follow-up moves the doc + mock to plateau-app and repoints the live refs
(#2553/#2555); if (b), the app-owned-doc exception is recorded so it is not a general loophole. Either way the
Phase-0 placement is on the record, not a unilateral call.

## Ruling (2026-07-19)
Ratified (a): the design record is app-owned → moved to plateau-app
(`plateau-app:docs/backlog-console-design.md` + `plateau-app:docs/mocks/console-ruling-surface.html`). WE holds
none of it. The two WE copies (`we:docs/design/backlog-console-design.md` and
`we:docs/design/mocks/console-ruling-surface.html`) are removed in this same lane; the moved `.md` carries a
one-line provenance note pointing back to this decision. Live `we:docs/design/…` cites in the resolved
decisions (#2554/#2556/#2557/#2558/#2561) now resolve as cross-repo pointers to the plateau-app home.
