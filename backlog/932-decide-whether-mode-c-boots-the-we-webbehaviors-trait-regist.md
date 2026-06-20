---
kind: decision
size: 5
parent: "777"
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
preparedDate: "2026-06-18"
codifiedIn: docs/agent/platform-decisions.md#we-fui-embed-boundary
relatedReport: reports/2026-06-18-932-mode-c-boots-webbehaviors-registry.md
locus: webeverything
relatedProject: webdocs
tags: [dogfood, chrome, traits, webbehaviors, mode-c]
---

# Decide whether mode-C boots the WE webbehaviors trait registry in-document (compose traits vs hand-roll)

## ✅ Ratified 2026-06-18

- **Fork 1 → A.** Mode-C **boots** the webbehaviors `CustomAttributeRegistry` over its shadow root and the chrome
  **composes** the registered traits (`nav:section`/`nav:list`) instead of hand-rolling `addEventListener`. This
  is a *purpose* call, not a boundary call: #777's site is a conformance proof, so it composes the standard.
- **Fork 2 → Entitled (no violation).** Settled by the **website ≠ standard** distinction (now codified —
  `codifiedIn` → `we:docs/agent/platform-decisions.md` `#we-fui-embed-boundary` rule 6): the docs *website* is a consumer free to
  run FUI + WE standard runtimes at runtime; the boundary only constrains the *webeverything package* source
  direction, which the runtime-URL bundle preserves. The prepared "FUI extends CustomAttribute" rationale was
  replaced (it conflated author-time extension with running the engine — a skeptic pass + the user's reframe).
- **Fork 3 → Lean shared; settle empirically in #934.** Prepared per-mount default dropped after the skeptic
  showed its isolation is partly illusory (per-mount duplicates `nav:list`'s document-global listeners; the
  double-observe fear is neutralized by `upgrade()`'s disconnect-first).
- **Unblocks #934** — and #934 is **not a pure rebuild**: it must include the `nav:section` shadow-scoping fix
  (`document.querySelector` → `getRootNode()`) + a coordinator/menu trait (sibling-exclusive open, outside-dismiss,
  responsive gating, Escape). Re-confirm its size (13 may be light) at slice time.

The #865/#931 chrome blocks (`disclosure-nav`, `sectioned-nav`) hand-wire interaction behavior with imperative
`addEventListener`, re-implementing the W3C APG Disclosure Navigation pattern that **already exists** as
registered WE traits (`nav:section`, `nav:list`) — because the mode-C in-document mount "has no behavior
registry." But the registry *can* run here. This decides whether mode-C boots the webbehaviors
`CustomAttributeRegistry` over its shadow root so chrome **composes** real traits: the gate for #934 and what
makes #777's "site as conformance proof" true. **Prepared 2026-06-18** — three forks at ready-to-ratify;
residual is trait-gap + lifecycle, not direction.

## Grounding (verified both repos 2026-06-18 — see relatedReport for full refs)

- **The traits exist and implement the hand-rolled pattern.** `nav:section`
  (`fui:blocks/navigation/NavSectionBehavior.ts` — toggles `aria-expanded`/`aria-controls`, click + Enter/Space,
  show/hide via `ViewEngine`) and `nav:list` (`fui:blocks/navigation/NavListBehavior.ts` — roving tabindex),
  registered by `registerNavigation(attributes)` (`fui:blocks/navigation/registerNavigation.ts:16-19`).
- **The chrome hand-rolls instead.** `fui:blocks/disclosure-nav/DisclosureNav.ts` `wireDisclosure()` is raw
  `addEventListener('click'|'keydown'|'focusin'|'resize')`; its docstring names the cause: *"there is no
  behavior registry in-document."* The mode-C module `fui:embed/chrome-in-document.ts:106` composes it.
- **The registry already runs over shadow roots.** `CustomAttributeRegistry.upgrade(root: RootNode)` /
  `downgrade(root)` (`we:plugs/webbehaviors/CustomAttributeRegistry.ts:267,279`),
  `RootNode = Document | DocumentFragment | ShadowRoot` (`we:plugs/core/types.ts:11`). Working precedent:
  `applyScopedRegistryToHost` → `registry.upgrade(host.shadowRoot)` (`we:plugs/webregistries/declarativeRegistry.ts:271`).
  Booting is **wiring, not new capability**.
- **The load-bearing distinction: WE-the-website ≠ WE-the-standard.** The boundary (#700/#765/#817) governs
  what the *standard artifacts* and the *webeverything package* may depend on — never FUI impl, source-wise
  (unidirectional WE→FUI; `npm-scope-mirrors-layer`). The WE-docs **website** is a downstream *product/consumer*,
  not a standard artifact: it is free to render FUI and to run WE standards, exactly like any app. Verified the
  site honours this **at runtime, not at build**: it dynamically `import()`s the FUI-published bundle by URL
  (`we:src/_layouts/base.njk:26,417` — a `{{ links.frontierUrl }}/embed/…` FUI bundle URL), so the
  webeverything package takes **zero source dependency** on frontierui (every `@frontierui/*` in `we:src/` is
  documentation/manifest data, not a build import). Booting the webbehaviors registry therefore happens *inside
  the FUI runtime bundle* on a consumer page — a product running a WE standard + FUI impl, the definition of the
  dogfood, not a boundary crossing.
- **The residual invariant (don't overshoot the distinction).** "The website may use FUI" means *at runtime via
  the mode-C published bundle* — NOT `import '@frontierui'` into the eleventy build. That source-direction rule
  (#700/#239) still holds; mode-C's runtime-URL-import is exactly the mechanism that preserves it.

## The axis

One axis: **where the disclosure behavior comes from in a mode-C mount** — composed from the registered WE
traits via `registry.upgrade(shadowRoot)`, or re-implemented imperatively per block. Composing is
single-source-of-truth and makes the dogfood genuinely exercise the webbehaviors standard (#777's whole point);
hand-rolling is the smaller runtime but duplicates shipped behavior (already done twice) and reduces #777 to
"FUI renders a nav." The boundary and lifecycle sub-questions hang off this axis and are settled below.

## Recommended path at a glance

| Fork | Question | Options | Recommended default | Conf |
| --- | --- | --- | --- | --- |
| 1 | Boot the registry & compose, or stay hand-rolled? | A boot+compose · B hand-roll | **A — boot the registry; chrome composes traits** (purpose call: #777 = conformance proof) | ~88% |
| 2 | Does booting webbehaviors in-document cross the boundary? | violates · entitled | **Entitled — no violation** (website ≠ standard; runtime bundle, zero source dep) | ~95% |
| 3 | Registry lifecycle: per-mount or shared page? | per-mount · shared | **Lean shared; settle empirically in #934** | ~55% |

## Fork 1 — Does mode-C boot the WE trait registry (compose), or stay hand-rolled?

*Fork exists because:* the fork is now **purely a purpose call**, not a boundary call (Fork 2 cleared the
boundary). B "works" (the nav functions) and, as a *generic* product, a website using FUI's components however
FUI ships them is a perfectly coherent end-state. What makes B *broken here* is the site's declared purpose:
#777 is "site as **conformance proof**." A site that hand-rolls behavior proves "FUI renders a nav," not "WE's
standards stack composes one" — so under #777's own goal, B fails the reason the work exists. (The dependency:
if #777's goal were ever softened to "just a nice FUI-rendered site," B would stop being broken and this fork
would dissolve — so the call rests on keeping #777's conformance-proof intent. It is; A holds.) A and B cannot
coexist for one block.

- **A — Boot the registry; chrome composes traits (bold default, ~90%).** The mode-C module instantiates a
  `CustomAttributeRegistry`, calls `registerNavigation(registry)`, `registry.upgrade(shadowRoot)`; chrome blocks
  become trait-marked DOM (`<button nav:section="…">`, `<nav nav:list>`). Single source of truth; the dogfood
  exercises the standard. **Cost (the real residual, not a counter-argument):** today's traits cannot compose
  this nav as-is — `nav:section` is *inert inside a shadow root* (`controlledElement` uses `document.querySelector`,
  `fui:blocks/navigation/NavSectionBehavior.ts:47`, which can't see a sibling panel in the shadow tree → its
  `connectedCallback` early-returns), and the traits miss sibling-exclusive open / outside-dismiss / responsive
  gating / Escape (see "Build scope"). So A is a real **trait-platform build**, not a markup swap: it needs a
  shadow-scoping fix + a coordinator/menu trait. That is the dogfood doing its job (it surfaced a genuine gap in
  the trait library) and is #934's scope — but it means #934 is **not** a pure rebuild and must be sized for it.
- **B — Keep mode-C FUI-DOM-only; behavior stays hand-rolled.** Smallest runtime, no registry lifecycle. But it
  duplicates shipped behavior (twice already: `sectioned-nav`, then `disclosure-nav`) and overstates #777.
  Excluded as an end-state; retained only as the interim the chrome ships today.

*Residual:* the trait-gap + lifecycle, not the direction. Flag for the deciding agent's skeptic pass: the only
way A loses is if #777's conformance-proof is judged satisfied by a11y-clean FUI-rendered DOM alone — argue that
case before ratifying.

## Fork 2 — Does booting the webbehaviors runtime in-document violate the constellation boundary?

*Fork exists because:* the answer is load-bearing — a "violates" verdict would *force* Fork-1-B (you can't boot
what you're not allowed to run), so #934 cannot proceed until it is explicitly settled. It is a confirm-style
ratification with two named outcomes, not two design branches.

- **Entitled — no violation (bold default, ~95%).** Grounded on the **website ≠ standard** distinction (see
  Grounding): the boundary constrains the *standard artifacts / the webeverything package* (no FUI **source**
  dependency, unidirectional WE→FUI), not the *website*. The WE-docs site is a product/consumer that runs the
  FUI bundle at runtime by URL (`we:src/_layouts/base.njk:26,417`) — zero build dependency on `@frontierui`. A
  consumer page running a WE-standard runtime (webbehaviors) and FUI impl together is the **dogfood**, not a
  crossing. #817's placement test governs where a *symbol is homed* (which repo/package), not what *executes in a
  browser tab*; nothing moves repos here. (This *re-grounds* the prepared default: the original "FUI already
  `extends CustomAttribute`" rationale was weak — it conflated author-time class-extension with running the
  engine in-host, and a skeptic pass rightly knocked it over. The website≠standard framing is the correct, and
  stronger, footing.)
- **Violates — keep the WE behavior runtime out of the host.** Only coherent if the boundary is read as "no WE
  *runtime* may execute on a page that also shows FUI." But that misreads the boundary as being about *rendered
  pixels / runtime execution* when it is about *source-dependency direction between packages*. The website is a
  consumer; consumers run standards. No principle survives the trace. Rejected.
- **The one real guard (not a branch):** keep it the *runtime* mode-C path. If the chrome were instead wired by a
  **build-time `import` of `@frontierui`** into the eleventy site, *that* would invert the source-dependency
  direction (#700/#239) and genuinely violate the boundary. The verdict above holds **because** the bundle is
  loaded by runtime URL.

## Fork 3 — Registry lifecycle: one shared page registry, or per-mount?

*Fork exists because:* both are coherent and they cannot both be the model — a shared registry and per-mount
registries are different ownership/teardown shapes for the same shadow roots.

**Lower confidence than prepared — lean shared, settle empirically in #934 (~55% shared).** A skeptic pass
weakened the per-mount "isolation" case on real-code grounds, so this should be decided against a running mount,
not ratified cold:

- **Per-mount.** Each mode-C mount instantiates its own registry, `upgrade(shadowRoot)` on mount,
  `downgrade(shadowRoot)` in the teardown closure (`mountInDocument(root): () => void`). *But* its "isolation" is
  partly illusory until the shadow-scoping fix lands: `nav:list` adds **document/window-global** listeners
  (`window.addEventListener('popstate')` / `navigation` `currententrychange`, `fui:blocks/navigation/NavListBehavior.ts:218-225`),
  so N per-mount registries → N duplicated global route-change handlers; and `document.querySelector` selectors
  cross mounts anyway.
- **Shared page registry (lean).** One registry per page → one `MutationObserver` + one lazy-load cache; the
  feared double-observe on re-mount is already neutralized because `upgrade()` calls `#disconnect(root)` before
  re-observing (`we:plugs/webbehaviors/CustomAttributeRegistry.ts:270`). Cleaner global-listener story. Cost:
  teardown is per-root (`downgrade(shadowRoot)`) rather than dropping the whole registry.
- **Registration locus (settled, not a fork):** the FUI mode-C module (`fui:embed/chrome-in-document.ts`) owns
  `registerNavigation(registry)` either way — it already loads FUI block impl, so this is its natural home.

## Supported by default (not forks)

- **Trait names are the cross-seam contract.** The chrome template carries `nav:section`/`nav:list` (WE-standard
  names); FUI owns the impl classes. A FUI module referencing WE-standard trait names consumes the contract, not
  WE impl — the established seam, no new decision.
- **Registration happens in the FUI mode-C module.** Folded into Fork 3's locus note above.

## Build scope this unblocks (for #934 sizing — record, don't decide here)

Composing forces the trait layer to cover the full horizontal APG menu, which the current `nav:section` +
`nav:list` do **not**: (1) sibling-exclusive open, (2) outside click/focus dismiss, (3) responsive desktop-only
gating, (4) Escape→collapse+refocus, plus (5) shadow-scoped selector resolution
(`NavSectionBehavior.controlledElement` uses `document.querySelector` → must use `this.target.getRootNode()`).
Likely a dedicated trait-enhancement (coordinator/menu trait) child under #934; do not let #934 stay sized as a
pure rebuild. The responsive/presentational CSS stays in the block (genuinely not a trait).

## Decision criteria

- The boundary is settled by the **website ≠ standard** distinction (Fork 2): the docs *site* is a consumer free
  to run FUI + WE standards at runtime; only the webeverything *package* source-direction is constrained, and the
  runtime-URL bundle preserves it. This is the reusable ruling — cite it whenever "WE renders FUI" is raised.
- Fork 1 is a *purpose* call resting on #777's conformance-proof intent (not a boundary call). Fork 3 is a
  lifecycle detail to settle against a running mount in #934, leaning shared.

Builds on ratification: #934 (rebuild chrome blocks as trait-composing templates) — **not a pure rebuild**: it
must include a shadow-scoping fix to `nav:section` + a coordinator/menu trait, so re-confirm its size (13 may be
light). Confidence ~88% for the overall direction (A + entitled); the residual is the trait-platform build scope
and the per-mount-vs-shared lifecycle, not the direction.
