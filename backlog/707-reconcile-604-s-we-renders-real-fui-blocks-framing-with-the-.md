---
kind: decision
size: 2
status: resolved
codifiedIn: docs/agent/platform-decisions.md#we-fui-embed-boundary
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-16"
graduatedTo: none
preparedDate: "2026-06-15"
relatedReport: reports/2026-06-15-604-iframe-boundary-reconciliation.md
tags: [frontier-ui, blocks, site, boundary, reconciliation]
---

# Reconcile #604's 'WE renders real FUI blocks' framing with the #700/#701 iframe boundary

**Prepared 2026-06-15 — ready to ratify.** No new design exists; this only realigns an existing epic to
an *already-ruled* boundary. Grounded in the prior rulings (#700 DC-7 · #701 `fuiDemo` · #705's
collapsed call) — see [relatedReport](../reports/2026-06-15-604-iframe-boundary-reconciliation.md). **No
fresh `/research/` topic**: there is no external prior art here, only internal ratification, so the
rubric's "ratify shipped ground skips the web survey" path applies. **2 forks, each with a bold default.**

## The concern, decomposed into axes

[#604](/backlog/604-migrate-the-we-site-to-render-real-frontier-ui-blocks-replac/) (epic, authored
2026-06-14, 13 pts) wants the WE site to **render the real FUI block composition**. Today WE block pages
(`/blocks/{id}/`) show only **static, Prism-highlighted code samples** and the `/demos/*` playgrounds are
self-contained harnesses — none import the actual block code from `frontierui/blocks/*`. #604 set out to
close that gap so the docs *run the real FUI implementation* — its acceptance requires "a live interactive
instance of the real FUI block" and "HMR on the FUI source updates the page", and its Fork-2 asks whether
to consume FUI "as a published `@frontierui` package surface". That **import** premise was overtaken one
day later by the **docs-rendering boundary**, established across three items (all resolved 2026-06-15):

- **[#700](/backlog/700-component-converter-playground-placement/)** — the component-converter playground
  *placement* decision. Its ruling **DC-7** said WE must **not** build a cross-repo import path into FUI;
  it embeds FUI-hosted demos through an **iframe** instead.
- **[#701](/backlog/701-iframe-based-component-viewer-embed-fui-hosted-standard-demo/)** — *built* that
  mechanism: the `fuiDemo` Eleventy shortcode (`we:.eleventy.js:38`) renders a sandboxed, **FUI-branded**
  `<iframe>` pointing at FUI's own surface — no import, FUI keeps provenance.
- **[#705](/backlog/705-fui-site-s-own-block-surface-7-of-21-its-relationship-to-the/)** — *applied* the same
  iframe boundary to FUI's **own** block catalog, where the strong "render the impl" dogfooding signal now
  lives.

The net rule (the standing docs-rendering boundary): WE never imports or renders FUI block code; it only
*embeds* FUI-hosted demos through an iframe. The reconciliation separates into two orthogonal axes:

- **Direction (Fork 1) — is there any coherent exception?** The exception ("WE genuinely renders FUI
  source") needs exactly the import seam #700 ruled out. **There is none in the tree:** `vite.config.mts:167-180`
  aliases only `@core`/`@web*` → `/plugs/*`, with no `frontierui` alias in `vite.config.mts` or
  `we:.eleventy.js`. So WE cannot resolve FUI block source today, by design.
- **Realisation already exists.** The `fuiDemo` shortcode (`we:.eleventy.js:38`) renders a sandboxed,
  FUI-branded iframe to `FUI_DEMO_BASE`; `we:src/_includes/block-descriptions/component.njk:235` **already
  calls it** (`{% fuiDemo "fui:component-converter.html", … %}`). Since `we:src/block-pages.njk:35` includes
  `block-descriptions/{id}.njk`, every block page can host a FUI demo via the same one-liner. Realigning
  #604 is *extending a working pattern*, not building a seam.
- **Shape (Fork 2) — what's left of #604 once "render the impl" is removed?** The strong dogfooding
  rationale ("page breaks when the impl breaks") only holds if WE renders the impl; under the iframe it
  migrates to FUI's own derived catalog (#705's build). #604's `blockedBy: ["170"]` also dissolves —
  #170 (unified WE↔FUI runtime) was a prerequisite *for importing FUI code*; an iframe needs no shared
  runtime. What survives is "embed a live FUI-hosted demo next to each block's code sample" — a real but
  much smaller body of work. Whether that residual stays a 13-point epic or resolves to a thin story is
  the genuine call.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|--------------------|------------------|------------|
| 1 — Direction | **Realign #604 to the iframe boundary** | Carve a WE-renders-FUI-source exception | High (near-confirm; alternative is ruled out by #700) |
| 2 — What #604 becomes | **Rescope #604 in place as the iframe-embedding epic** (drop #170 blocker + Fork-2 import; rewrite Why/acceptance) | Resolve #604 as superseded → graduate a thin follow-on story | Medium (both coherent; the real judgment) |

## Fork 1 — Reconciliation direction

**Crux:** Does any coherent branch let WE render FUI block source, or is the only honest move to realign
#604 to the iframe boundary? The exception branch requires the cross-repo import seam that
[#700](/backlog/700-component-converter-playground-placement/) explicitly ruled out, and which does not exist in
`vite.config.mts:167-180` (no `frontierui` alias).

- **A — Realign #604 to the iframe boundary.** Rewrite #604 so its block-page "live demo" is a
  FUI-hosted demo embedded via the `fuiDemo` iframe (`we:.eleventy.js:38`), exactly as #705 ruled for FUI's
  catalog. Consistent with the constellation (impl + its display → FUI), reuses the already-built #701
  mechanism, no new WE→FUI seam.
- **B — Carve a justified exception where WE renders FUI source.** Keep #604's "render the real
  composition" premise for block pages as a deliberate carve-out from #700.

**Default: A — realign.** B is **rejected**: it reintroduces precisely the cross-repo import #700 killed,
has no seam in the tree to stand on, and would re-impose the #170 runtime-unification prerequisite for no
benefit the iframe doesn't already deliver. The decider ratifies A unless they intend to *reopen #700*,
which is out of scope here.

## Fork 2 — What #604 becomes after realignment

**Crux:** Once "WE renders the real impl" is struck, #604's surviving deliverable is "embed a FUI-hosted
demo next to each block's code sample" — already proven small by `we:component.njk:235`. Is that still a
13-point epic, or a thin story?

- **A — Rescope #604 in place as the iframe-embedding epic.** Keep #604's number/history and its
  per-block-coverage slicing note, but rewrite it: premise → "every block page gains a live FUI-hosted
  demo via `fuiDemo`"; **drop `blockedBy: ["170"]`** (no shared runtime needed); **drop Fork-2** (import
  surface — ruled out); rewrite *Why* so the strong conformance signal is noted as living on FUI's
  derived catalog (#705), WE's being "the demo loads next to the spec"; re-size down from 13. Stays an
  epic because extending demos across ~21 block families (each needs a FUI-hosted demo to exist + a
  per-block mapping) is genuine multi-slice work.
- **B — Resolve #604 as superseded; graduate a thin follow-on story.** Treat the rendering premise as
  the whole point of #604; with it gone, file one small story ("embed `fuiDemo` on `/blocks/{id}/` pages,
  starting with droplist") and mark #604 `resolved`, `graduatedTo` that story. Cleaner if the residual is
  judged too thin to be an epic and the per-block rollout is seen as routine repetition of `we:component.njk:235`.

**Default: A — rescope in place.** It preserves #604 as the planning bucket for "live demos on every
block page" (its original coverage intent survives the realignment intact — only the *mechanism* changed
from import to iframe), and avoids a resolve-then-refile churn. B is the right move only if the decider
judges the realigned residual genuinely sub-epic; surfaced because that's a legitimate read.

- **Sub-decision (settled either way): drop `blockedBy: ["170"]`.** The iframe embeds a FUI-hosted demo
  served by FUI's own vite (`:3001`) with FUI's own plugs — no shared WE↔FUI runtime — so #170 is no
  longer a #604 prerequisite under any branch above. Remove it during the rewrite.

## Ruling (2026-06-15)

- **Fork 1 → A (realign to the iframe boundary).** Confirmed. Challenge applied: for the WE→FUI case the
  iframe isn't merely *simplest*, it's the **only** mechanism consistent with #700 — every non-iframe embed
  (Shadow-DOM mount, DI component) needs FUI code loaded into WE's runtime, i.e. the cross-repo import #700
  killed. So "move off iframe" is gated on *reopening that seam*, out of scope here.
- **Fork 2 → A (rescope #604 in place).** #604 stays the WE-docs *application* epic — a live FUI demo on
  every block page — and **consumes** the embed capability at v1 = iframe. `blockedBy: ["170"]` dropped;
  Fork-2 (import surface) struck.
- **New: the embed *mechanism* is its own epic — [#728](/backlog/728-component-embedding-capability-embed-a-live-component-exampl/).**
  Embedding a live component example is a general, cross-cutting concern (many use cases —
  YouTube/Facebook-style third-party embeds and our component-example case — and many mechanisms), so it
  gets its own home rather than being baked into one consumer (#604). v1 = iframe (`fuiDemo`); #728 owns
  the v1→alternatives→DI-mount evolution.
- **Known limitation recorded (→ a #728 slice): overlay/modal components.** An iframe clips to its box, so
  a demo's modal/popover/toast can't cover the host docs page. Worth a dedicated alternatives investigation
  (oversized frame · `postMessage`-to-parent overlay · the DI-mount future). #604's overlay-heavy blocks
  may soft-depend on it; the iframe v1 ships for the rest regardless.

## Acceptance (decision done when)

- [x] Fork 1 ratified — **A, realign**; exception recorded as ruled out by #700 (and now: iframe is the
      only #700-consistent mechanism, not just the simplest).
- [x] Fork 2 ratified — **A, rescope #604 in place**.
- [x] Embed-mechanism epic filed — **#728** (component embedding capability; iframe v1 + modal-alternatives
      + DI-mount future).
- [x] #604 edited to match: premise/Why/acceptance rewritten to the iframe-embedding framing, `fuiDemo`
      named as the mechanism, Fork-2 (import surface) struck, `blockedBy: ["170"]` removed, #728 named as
      the mechanism owner it consumes.
