---
kind: decision
status: open
locus: plateau-app
dateOpened: "2026-07-03"
dateStarted: "2026-07-04"
preparedDate: "2026-07-04"
relatedTo: ["1649", "1033", "2192", "2193"]
relatedReport: reports/2026-07-04-side-by-side-compare-prior-art.md
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [design-tool, compare, brand, dev-browser, decision]
---

# Side-by-side design-compare tool — scope + shape

## Digest

A reusable **design-compare** surface: view two rendered states (before/after, a/b,
current-vs-proposed) together, sighted, instead of hand-building a throwaway screenshot board each time.
Surfaced 2026-07-03 in the Plateau brand-alignment work — logo-vs-site, hero before/after, and mark a/b
were each hand-composited in scratch this session (the proven pain). A Brand Studio a/b card pattern and
`gen-branding`s before/after exist as skill/generator output, not as a reusable in-app tool.

This is a **validation-gate** decision (go / not-yet / no on a candidate), NOT a shape fork. The standing
test dissolves every apparent fork: **component-vs-tool** is composable (build a component, mount it in a
tool); **modality** is a set of coexisting view modes (the call is only the default); and **static-vs-live
is a timing deferral, not a design fork** — under a free-to-build screen a live dual-run strictly dominates
static, so the only thing making static "v1" is that live costs the #142 capture substrate we are not
paying for yet. That is a roadmap call, correctly recorded here as a deferral, not laundered as a fork.

**Recommended verdict: GO on a thin static compare whose keystone is a pixel-aligned reveal-slider
overlay; NOT-YET on a live dual-run (defer to #1649/#142).** Confidence: Medium. (Amended from an earlier
draft after a skeptic pass — see Skeptic, below.)

## What you are deciding

Does a reusable design-compare surface earn a slot now (**go**), gate on a trigger (**not-yet**), or stay
as per-surface bespoke boards (**no**)? There is no `## Fork N` — the shape questions are settled by the
standing test (below), and static-vs-live is a timing deferral, not a fork.

## Prior-art delta

Side-by-side/diff review is mature (Chromatic, Percy, reg-suit, Juxtapose, an img-comparison slider,
Playwright trace viewer). The delta: an **in-app, self-describing, design-judgment** compare wired to the
apps own routes/variants and feeding critique (#1033) + the design-AI reviewer (#2192) — not a hosted CI
pixel-diff service. Full table in the relatedReport.

## Supported by default (settled by the standing test — no ruling needed)

- **Component surfaced as a tool** — a reusable compare *view* (candidate **FUI component**, impl in
  FrontierUI per #96) mounted behind one "Design Compare" Tools entry in plateau-app. Composable → not a fork.
- **Modality: the pixel-aligned reveal-slider OVERLAY is the keystone default** (swipe / onion-skin
  registration of the two renders — the thing two browser tabs cannot do, and the whole reason a tool
  earns its slot). Side-by-side panes are the trivial fallback mode, NOT the default; diff-highlight is a
  later mode. (Corrected after the skeptic pass: defaulting to bare panes defaulted to the worthless mode.)
- **Input: two `iframe`s (live routes) or two captured images**, local-first / zero-server (#141).

## Scope boundary (timing deferral, not a fork): static now, live later

- **Ship now — static/light**: the reveal-slider overlay + panes over two `iframe`s or two images. Zero
  backend, no dependency on #142. Covers the proven need.
- **Deferred — live dual-run** (both branches running, input fan-routed to both, live divergence
  highlighters). This is #1649s substrate, not a rival modality.
- **Convergence = a firewall, not a promise.** There is no named shared interface between this and #1649
  today, so "converge later" would be a hand-wave. The real guarantee is: **build nothing here that
  presumes a live substrate** — the zero-backend static design already enforces that. All live-run work is
  deferred wholesale to #1649/#142; this card asserts *no live work here*.

## Home

`locus: plateau-app` — a dev/design tool ([#141](/backlog/141-dev-browser-vision/)), local-first /
zero-server. The compare *view* is a candidate FUI component (impl in FrontierUI per #96); the Tools
surface + route live in plateau-app.

## Recommendation

- **Verdict: GO on the static reveal-slider-first compare; NOT-YET on live dual-run.** Confidence Medium.
- **Un-gate trigger for live**: promote when the #142/#1649 capture substrate ships AND a real review needs
  synchronized live divergence static pairing cannot show — filed *under #1649*, not here.
- `Skeptic: SURVIVES-WITH-AMENDMENT.` A refute-only pass landed three fixes, all folded above: (1) the go
  survives, but static-vs-live was prioritization in fork costume → demoted from `## Fork N` to a timing
  deferral; (2) default modality flipped from side-by-side panes (= two browser tabs, fails the "why a
  tool" bar) to the **reveal-slider overlay** (the load-bearing value); (3) "converge with #1649" downgraded
  from a promise to a no-live-work firewall (no shared interface exists to converge on yet). No
  `codifiedIn` collision — this sets no platform statute (a product-tool go/no-go); statute-overlap with
  #1649 reconciled (that is the *semantic change-safety* diff, this is *design/aesthetic* compare; shared
  substrate only, which is why live is deferred there).
- `Screen: flagged(prio) → fixed.` The two-confusion screen refuted the merit-vs-prioritization test on
  static-vs-live (live strictly dominates free-to-build; only cost defers it); fixed by dissolving that
  fork into an explicit timing deferral. Implementation-detail screen: clear (the compare view is a
  consumer-visible FUI component; the FUI-vs-plateau placement is a build-time sub-question).
