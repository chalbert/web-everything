# Plateau↔WE embed/seed transport — prior-art survey for decision #788

> Prep research for [#788](/backlog/788-plateau-we-embed-seed-transport-contract-how-we-embeds-a-pla/)
> (blocking fork of the embedded technical configurator story [#752](/backlog/752/), under the Block
> Explorer epic [#746](/backlog/746/)). Question: **how does a WE/FUI docs surface embed a Plateau
> Technical Configurator view _seeded with a block's technical dimensions_** (render strategy, transport,
> trait lazy-load, chunk split), and report the chosen config / cost preview back?

## The seam as it stands today

- **Plateau side has no seed channel.** `mountTechnicalConfigurator(root)` takes only a host element —
  no seed argument (`plateau:plateau-app/src/technical-configurator/configurator.ts:581`). State is loaded from
  `localStorage` *only* (`loadState()` at `:81-94`, `STORAGE_KEY = 'plateau.technical-configurator.v1'`
  at `:70`), and the SPA route-stamps the mount with **zero URL-param reading**
  (`plateau:plateau-app/src/main.ts:327-337`, `tryMountTechnicalConfigurator` — gated only on
  `location.pathname === '/technical-configurator'`). So seeding from outside is genuinely undecided —
  nothing reads an inbound seed today.
- **WE side has one embed precedent: a pure-URL iframe.** The #701 `fuiDemo` Nunjucks shortcode
  (`we:.eleventy.js:38-50`) renders a sandboxed (`sandbox="allow-scripts allow-same-origin"`), `loading=lazy`
  `<iframe>` whose `src` is `${FUI_DEMO_BASE}/demos/<file>`, with a FUI-branded chrome wrapper and an
  "Open in Frontier UI ↗" link. The base is env-parameterized (`FUI_DEMO_BASE`, `:37`). **No seed, no
  postMessage** — it just points at a URL.
- **The constellation boundary is already ruled.** WE/FUI never import cross-repo runtime code: #700
  (DC-7) ruled out the WE→FUI module-import path, and #701 chose the iframe instead; the
  npm-scope-mirrors-layer rule keeps `@webeverything`/`@frontierui` from importing Plateau (the **product**
  layer). The "vision is a Plateau service consumed as a no-leakage client" ruling (#475) is the same
  shape: WE consumes Plateau across a process boundary, never in-process.

## What the embed-kit prior art does

Two mechanisms exist for parameterizing a cross-origin embed, and the leaders split cleanly by **job**:

| Mechanism | Job it solves | Who uses it | Properties |
|---|---|---|---|
| **URL query / hash params** in `iframe.src` | **Seed** the initial view; make it shareable/deep-linkable | **Google Maps Embed API** (`/maps/embed/v1/MODE?key=…&PARAMETERS`), CodeSandbox & StackBlitz embed options (`?view=…&initialpath=…`), oEmbed (embed HTML *discovered* from a URL) | Stateless, bookmarkable, no handshake, degrades to a plain link; **bounded by URL length**, one-way, schema is visible |
| **`window.postMessage`** | **Live control / readback** after load | **Figma Embed Kit 2.0** (parent posts navigate/restart; child posts events), YouTube IFrame API, **StackBlitz SDK** VM interface | Bidirectional, arbitrary payload size, enables readback + auto-resize; needs a **ready handshake** + strict `targetOrigin`/`event.origin` checks; **not shareable** (nothing in the URL) |

The load-bearing finding: **these are not rivals — the real-world default is to layer them.** Google Maps
needs no live control, so it is URL-only. Figma drives a live prototype, so it is postMessage-led. But
**StackBlitz and CodeSandbox offer _both_**: URL params seed the embed (and give a shareable link), and an
SDK over `postMessage` adds live control on top. The seed/deep-link job wants a URL; the readback/resize
job wants postMessage; a tool that needs both ships both, with the **URL as the canonical state** and
postMessage as the additive channel.

### postMessage security, if used (WHATWG / MDN)

The WHATWG cross-document-messaging spec and MDN are explicit about the two hazards, both relevant if the
additive channel is used: (1) a message posted to a just-navigated document is **likely to miss its
recipient** — the child should post a "ready" message to the parent first (the **handshake**); (2) the
sender must pass a **specific `targetOrigin`** (never `*`) and the receiver must **verify `event.origin`**
and validate payload shape. This is exactly the Figma Embed Kit pattern (it targets
`https://www.figma.com` explicitly). The handshake race is the recurring footgun and is the main reason a
URL seed (which has no timing) is preferred for the *initial* state.

## How this reshapes #788's fork

The item's original three branches do **not** survive the fork-existence test as a 3-way choice:

1. **Shared component (extract a package both repos import)** — **excluded, a broken branch.** It violates
   npm-scope-mirrors-layer (WE/FUI importing Plateau product code) and re-opens the exact cross-repo-import
   path #700 (DC-7) already ruled out for the *closer* FUI↔WE boundary; Plateau sits one layer further out.
   This is a forced invariant, not a weigh.
2. **Deep-link only (no embed)** — **not a rival; a companion.** #752 explicitly wants *both* the in-page
   mini-configurator **and** a deep-link to the full Plateau one. "No embed" deletes the story's reason to
   exist; but the deep-link itself is supported by default (every embed gets an "Open full configurator ↗"
   link, exactly like #701's "Open in Frontier UI ↗"). So it is a supported-by-default feature, not a fork.
3. **Iframe embed** — the surviving approach, now a **forced invariant** (the other two collapse).

So the card's *real* question — its own title, "embed/seed **transport** contract" — is what is genuinely
open: **within the iframe, how does the seed cross the boundary?** That is the one true fork:

- **A — URL query/hash params (canonical), postMessage additive.** The Plateau route reads its seed from
  the URL at mount; WE/FUI builds the URL. Shareable + deep-linkable *for free* (the "open the full
  configurator pre-seeded" link the card wants is the *same* param vocabulary), stateless, matches the
  #701 iframe precedent and the #754 permalink serialization, no handshake. postMessage is added *only*
  for the jobs a URL can't do — readback of the chosen config to the embedder's chrome, and auto-resize.
  **This is the StackBlitz/CodeSandbox layered model and the recommended default.**
- **B — postMessage handshake as the canonical seed.** Richer/larger payloads and bidirectional from day
  one (Figma model), but **no shareable URL**, a ready-handshake race, and — decisively — you would *still*
  need a URL vocabulary for the deep-link, so B is strictly more work for the same outcome and loses
  embed-permalink shareability. Worse on merit, not broken.

## Classification (the 7-question pass)

1. **Layer** — a **documented integration contract** authored in WE (the standard repo, locus
   `webeverything`): a small seed-param vocabulary both sides conform to. The *reader* is implemented in
   Plateau (product), the *writer* in the WE/FUI docs shortcode.
2. **Protocol, or just a contract?** — **NOT a minted WE Protocol.** A protocol is for *many independent
   vendors interoperating / swapping engines*; here there are exactly two parties (the embedder, the
   Plateau route) and no swappable-vendor story. Minting a `we:protocols.json` entry would be lock-in for zero
   interop gain (minimize-lock-in: a protocol is the single escapable lock, never reached for casually). It
   is a bilateral documented seam, owned at the Plateau route.
3. **Intent dimension?** — No. A transport/seed mechanism is a **technical** concern, never a UX intent
   dimension (intent-UX-only / technical→Configurator).
4. **Fixed mechanic or dimension?** — The seed *vocabulary* is a fixed contract; the seed *values* are
   per-block data, not a configurable design axis.
5. **DI-injectable?** — The Plateau **base URL** should be env-parameterized exactly like `FUI_DEMO_BASE`
   (`we:.eleventy.js:37`) — dev `localhost:4000` vs the prod host — plain config, not a registry.
6. **Most-permissive default?** — URL-param seed: shareable, deep-linkable, degrades gracefully (the
   deep-link is a plain anchor), and is a strict superset of B's reachable outcomes for the seed job.
7. **Seam between intents?** — It is a seam between **repos/layers** (WE-docs / FUI ↔ Plateau), not between
   two intents. The owner is the side that exposes the surface: **Plateau owns the route and its param
   contract; the embedder conforms.** Honours the separation bias — a thin documented vocabulary, not a
   shared runtime package.

## Reuse note — this seam is shared, design it once

The same contract serves **#751** (embedded theme/design-system creator — also a Plateau embed) and shares
its serialization with **#754** (permalink/export — URL-encodes the explorer's full state). The seed
vocabulary should be the same URL-state grammar #754 will read back, so the "deep-link pre-seeded" link and
the "permalink to this configured view" link are one mechanism, not two.

## Web-standards alignment

The contract borrows the platform's own vocabulary — `URLSearchParams` / URL-as-state for the seed
(Google Maps Embed API shape), `iframe` `sandbox` + `loading=lazy` from the shipped #701 wrapper, and
`window.postMessage` with `targetOrigin` + a ready handshake from the WHATWG cross-document-messaging spec
for the optional additive channel — rather than coining a bespoke wiring, in keeping with native-first /
minimize-lock-in.

## Sources

- [Window.postMessage() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [9.3 Cross-document messaging — WHATWG HTML spec](https://html.spec.whatwg.org/multipage/web-messaging.html)
- [Maps Embed API — Google Maps Platform](https://developers.google.com/maps/documentation/embed/embedding-map)
- [Embedding projects — StackBlitz Docs](https://developer.stackblitz.com/guides/integration/embedding) ·
  [Controlling embeds with the SDK's VM interface](https://developer.stackblitz.com/platform/api/javascript-sdk-vm)
- [Embedding — CodeSandbox Docs](https://codesandbox.io/docs/embedding)
- [Figma Embed Kit 2.0 example (postMessage)](https://github.com/figma/embed-kit-2.0-example)
</content>
</invoke>
