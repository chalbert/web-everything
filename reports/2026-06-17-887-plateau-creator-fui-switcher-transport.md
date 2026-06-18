# Plateau-creator → FUI-switcher manifest transport — prior-art survey (decision #887)

**Date:** 2026-06-17
**Grounds:** backlog #887 (decide the Plateau-creator → FUI-switcher manifest transport),
gating the #751 embed capstone ("Your theme" applies live), under the Block Explorer epic #746.
**Builds on the real trees:** the FUI block workbench + #749 switcher (`frontierui/workbench/`),
the FUI embed SDK's origin-validated postMessage channel (`frontierui/embed/`), the #747 manifest
shape, the #809 chrome-decoupled-from-distribution ruling, and the #775 creator open-core tiering.

## The question

The #751 capstone wants a **"Your theme" button** on the FUI block workbench that opens the
**embedded Plateau design-system creator** (an iframe — per the constellation, Plateau owns the
creator and FUI/WE embed it) and feeds the author's freshly-authored #747 manifest to the live
**#749 switcher** so the created theme applies to the *real* block immediately. The creator
(Plateau, cross-origin) and the switcher (FUI, `fui:frontierui/workbench/mount.ts`) live in **different
cross-origin iframes**. So **how** does a *runtime-authored* manifest cross the Plateau→FUI seam,
and should the FUI switcher consume an externally-supplied manifest at all (vs only its fixed
FUI-resident gallery)?

This is the explicit **cross-origin, runtime-authored cousin of #881**. #881 ruled the *same-origin,
static* case (WE hands server-emitted nav/brand/footer to a FUI mode-C mount in WE's own DOM) and
landed on **DOM-mediated data on the mount point** — because same-origin DOM is readable and the
config is emitted by the server at build time. #887 flips **both** distinguishing properties:

| | #881 (resolved) | #887 (this card) |
|---|---|---|
| Origin relationship | **same-origin** (FUI mounted in WE's DOM) | **cross-origin** (Plateau iframe ↔ FUI iframe) |
| When config exists | **static**, server-emitted at build | **runtime**, user-authored in the creator |
| Resolved channel | DOM data on the mount point (no message) | **`postMessage`** (DOM-scrape is structurally impossible cross-origin) |

The rhyme resolves *oppositely on the channel* precisely because origin + timing both flip: same-origin
static config can ride the DOM; a cross-origin runtime artifact cannot — the same-origin policy blocks
all cross-frame DOM/`contentDocument` reads, so a cooperating message channel is the only carrier.

## Grounding the real trees

1. **An origin-validated `postMessage` channel already exists in the FUI embed SDK.**
   `fui:frontierui/embed/embed-host.ts` installs a `window.addEventListener('message', …)` router that
   **rejects any message whose `event.origin` ≠ the frame's validated origin** (`fui:embed-host.ts:142`),
   matches `event.source` to a live `contentWindow` (`:120-137`), and sends host→guest via
   `postToGuest` targeted at the validated origin (`:74-75`). The guest side
   (`fui:frontierui/embed/embed-guest.ts`) posts to its embedder's origin (`:59`) and origin-gates inbound
   messages (`:75`). The wire contract is in `fui:frontierui/embed/contract.ts`: a versioned
   `EmbedEnvelope` (`channel:'fui-embed'`, `v:1` — `:82-86`), a `GuestMessage | HostMessage` union
   (`:116-118`), an `isEmbedMessage` type-guard (`:121`), and an `envelope()` helper (`:132`). The
   protocol is **already an extensible, origin-validated message bus** carrying `ready`/`resize`/
   `overlay-open`/`overlay-close`/`init` — adding an `apply-design-system` message type is a
   contract addition, not a new channel. **This is the load-bearing reuse: #887-A is not greenfield.**

2. **The switcher's apply path is one function, already factored.**
   `fui:frontierui/workbench/mount.ts:277-292` `applyDesignSystem(preset)` sets the manifest's
   `themeTokens` as custom properties on the stage, sets `data-intent-*` / `data-trait-*`
   (`:289-290`), stamps `data-ds`, and re-renders the same block with no code change. The gallery is
   built by iterating the FUI-resident `DESIGN_SYSTEM_PRESETS` and wiring each chip to
   `applyDesignSystem` (`:300-305`). **Consuming an external manifest = building a `DesignSystemPreset`
   from the incoming payload and calling the *existing* `applyDesignSystem()` — the injection point is
   already there.**

3. **The transported manifest must be the *resolved/inline* #747 form, not a DTCG-path manifest.**
   The workbench's presets (`fui:frontierui/workbench/designSystems.ts`) carry `themeTokens` **resolved
   inline** as a `{ '--custom-prop': value }` map — explicitly *"because the workbench … has no WE↔FUI
   channel … it consumes the #747 manifest shape with its own preset data"* (header comment). The WE
   catalog form (`we:src/_data/designSystems.json`) instead uses `manifest: "design-systems/….json"`
   **path** refs. Cross-origin, the FUI switcher **cannot dereference a `themeTokens` path** on a
   Plateau/WE origin (no channel + CORS), so the creator must serialize the **fully-resolved** manifest
   (token *values* inlined) into the payload. This is #887's analogue of #881's "serializable
   `ChromeConfig`" load-bearing constraint: the *shape that crosses the wire* is the resolved manifest,
   not a reference.

4. **Topology is constrained by the #809 "no WE↔FUI channel" ruling.** #809 ratified that the workbench
   is a FUI-owned, FUI-hosted iframe+chrome distribution with **no WE↔FUI manipulation channel**; #746
   states the workbench opens *"embedded Plateau configurators"* as Plateau iframes. So the FUI
   workbench hosts the Plateau creator as a **nested child iframe**, making creator→switcher a **direct
   Plateau↔FUI parent-child message**. The alternative — the WE docs page hosting the FUI workbench and
   the Plateau creator as *sibling* iframes and relaying between them — reconstitutes exactly the
   WE↔FUI channel #809 forbids (WE becomes the broker). That alternative is **excluded by #809**, not
   weighed.

## Prior-art families for a cross-iframe runtime handoff

The cross-origin embed-editor → host-render handoff space splits three ways:

1. **`postMessage` (runtime push, ephemeral).** The platform-standard cross-origin channel and the
   dominant pattern for *embedded editor → live preview* loops: Stripe Elements posts tokenization
   results to the host on submit; Figma/CodeSandbox/StackBlitz embeds drive their preview over
   `postMessage`; Storybook's manager↔preview sync (surveyed in the #809 topic) is the same shape.
   Always origin-validated. Carries a serializable payload; no backend, no persistence, no reload.
   **This is the live-apply channel.**
2. **Persist-to-backend + fetch-by-id (durable, network-mediated).** The creator POSTs the manifest to
   a hosted service, receives an id/permalink, and the consumer fetches it (CORS). This is the
   *share/persist* pattern (Tokens Studio Pro sync, zeroheight/Supernova hosted libraries) — and per
   **#775 it is the *paid* tier** (hosted persistence/credential-holding). Right for "save & share a
   design system across sessions"; wrong as the *live-apply* channel — it drags a free, local,
   zero-friction loop behind hosted infra and a round-trip.
3. **URL / navigation handoff (encode in the URL, reload).** Encode the manifest in a URL param and
   navigate the consumer to it. WE already has the serialization in **#754** (the permalink
   round-trip) — but #754 encodes a **manifest *ref*** (`ds=carbon-like`), not an inline token set, and
   a full reload per theme tweak destroys the live-authoring loop. A share/deep-link mechanism, not a
   live channel.

## How this maps onto #887's forks

- **Fork 1 (live-apply transport channel).** Family 1 = **Option A** (origin-validated `postMessage`
  over the *existing* FUI embed channel, extended with an `apply-design-system` message + the Plateau
  creator's trusted origin). Family 2 = **Option B** (persist + fetch-by-id) — the right mechanism for
  the **paid** share/persist path (#751/#775), but a structural defect as the live-apply channel
  (couples a free-tier loop to hosted infra). Family 3 = **Option C** (URL/#754 reload) — a
  share/deep-link mechanism that breaks live iteration. → **A holds, strengthened by the existing
  origin-validated channel being directly reusable.**
- **Forced invariants the survey hardened (not forks):** (a) **Plateau→FUI direct, WE never brokers**
  (forced by #809); (b) **the switcher consumes the runtime manifest** — fixed-gallery-only is the
  broken branch (severs #751's capstone loop), and the injection point is the existing
  `applyDesignSystem()` at `fui:mount.ts:277`; (c) **the wire shape is the resolved/inline manifest** (token
  values inlined), forced by the cross-origin inability to dereference a `themeTokens` path.

## Net effect on the decision

The survey **confirms the postMessage channel and dissolves any "is this greenfield?" doubt** — FUI
*already ships* an origin-validated, versioned message bus (`fui:embed-host.ts`/`fui:embed-guest.ts`/
`we:contract.ts`) and a one-call switcher injection point (`fui:mount.ts:277`). It also pins the load-bearing
constraint the build inherits: the payload that crosses the wire is the **fully-resolved #747 manifest**
(inline token values), not a path ref — #887's analogue of #881's serializable-`ChromeConfig` shape.
The contrast with #881 is the headline: the *same* rhyming question resolves to **DOM-data when
same-origin + static** (#881) and to **`postMessage` when cross-origin + runtime** (#887).

## Sources

- MDN: [`Window.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) ·
  [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) (cross-origin
  `contentDocument` reads are blocked — a cooperating message channel is the only carrier)
- [Stripe.js & Elements — cross-origin iframe + postMessage event model](https://docs.stripe.com/js)
- [CodeSandbox / Sandpack embed messaging](https://sandpack.codesandbox.io/docs/advanced-usage/client) ·
  [StackBlitz SDK postMessage API](https://developer.stackblitz.com/platform/api/javascript-sdk) — the
  embedded-editor → live-preview handoff reference designs
- WHATWG HTML: [cross-document messaging](https://html.spec.whatwg.org/multipage/web-messaging.html)
- Prior WE survey it rhymes with: `we:reports/2026-06-17-881-mode-c-host-config-transport.md`
  (`/research/mode-c-host-config-transport/`)
