---
kind: decision
size: 3
parent: "746"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#we-fui-embed-boundary
locus: webeverything
relatedProject: webdocs
relatedReport: reports/2026-06-16-plateau-we-embed-seed-transport.md
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
preparedDate: "2026-06-16"
crossRef: { url: /backlog/701-iframe-based-component-viewer-embed-fui-hosted-standard-demo/, label: "Precedent — #701 fuiDemo iframe" }
tags: [webdocs, plateau-embed, technical-configurator, cross-repo-seam, decision]
---

# Plateau↔WE embed/seed transport contract — how WE embeds a Plateau Configurator view seeded with a block's dimensions

> **Decision (ratified 2026-06-16) — Fork 1 = A.** Seed transport is **URL query/hash params canonical + optional `postMessage` for readback/auto-resize**. The seed vocabulary is the same typed URL-state grammar #754 reads back (typed params mirroring the block's four #789 dimensions, not an opaque blob), so seed / deep-link-pre-seeded / permalink are **one mechanism**. Forced invariants stand: embed via the #701 `fuiDemo`-style sandboxed iframe (shared-component rejected — boundary violation); **Plateau owns the route + its seed-param vocabulary, the embedder writes the URL**, base URL env-parameterized like `FUI_DEMO_BASE`. *Red-teamed:* B (postMessage-canonical) is strictly more work (still needs a URL vocab for the deep-link/permalink) with a ready-handshake race, and its only edge (bidirectional/large payloads) is preserved by A's additive channel — attack failed.
>
> **Unblocks:** #752 (embedded configurator build), shared by #751 (theme-creator embed) + #754 (permalink/export). No new entity minted — the ruling is a documented bilateral contract the downstream builds implement (`graduatedTo: none`).

**Grounding (✓ ready to ratify):** no design existed for how a WE/FUI docs surface embeds a Plateau Configurator view *seeded with a block's technical dimensions*. Surveyed the embed-kit prior art (Google Maps Embed API, StackBlitz/CodeSandbox, Figma Embed Kit, YouTube IFrame API) + the platform messaging standards (WHATWG cross-document messaging, MDN `postMessage`/`URLSearchParams`) and published `/research/plateau-embed-seed-transport/` (report: `we:reports/2026-06-16-plateau-we-embed-seed-transport.md`). The survey **collapsed the original 3-way fork**: *shared-component* is a broken branch (boundary violation) and *deep-link* is a supported-by-default companion the #752 story wants anyway — so **iframe embed is a forced invariant (ratify)**. **One genuine fork** remains — the **seed transport mechanism** — with a **bold** default below.

## The axis

What's undecided is the **transport** by which the embedded Plateau Configurator receives its seed (and reports a chosen config / cost preview back). The seam today has **no inbound channel**:

- `mountTechnicalConfigurator(root)` takes only a host element and reads no seed — [`plateau:plateau-app/src/technical-configurator/configurator.ts:581`](../../plateau-app/src/technical-configurator/configurator.ts). State loads from `localStorage` **only** (`loadState()` at `:81-94`, `STORAGE_KEY` at `:70`), and the SPA route-stamps the mount with **zero URL-param reading** ([`plateau:plateau-app/src/main.ts:327-337`](../../plateau-app/src/main.ts), `tryMountTechnicalConfigurator`).
- The only WE embed precedent is a **pure-URL sandboxed iframe** with no seed: the #701 `fuiDemo` shortcode — [`we:.eleventy.js:38-50`](../../.eleventy.js) (`sandbox="allow-scripts allow-same-origin"`, `loading=lazy`, base parameterized via `FUI_DEMO_BASE` at `:37`).
- The dimensions to seed are the block's four technical settings from #789 (render-strategy #079, transport #455, trait-lazy #448, chunk-split #719/#720); the **same URL serialization is the #754 permalink payload**, and the same embed transport serves the #751 theme-creator embed.

The prior art splits the two transport mechanisms **by job**: URL query/hash params *seed* the initial view and make it shareable/deep-linkable (Google Maps is URL-only; CodeSandbox/StackBlitz seed via URL); `window.postMessage` drives *live control/readback* after load (Figma/YouTube/StackBlitz SDK), needing a ready-handshake + strict `targetOrigin`/`event.origin` checks. The real-world default (StackBlitz, CodeSandbox) ships **both, layered — URL canonical + postMessage additive.**

### Per-fork classification (the 7-question pass)

**(1) Layer** — a **documented integration contract** authored in WE (locus `webeverything`): a small seed-param vocabulary; the *reader* is implemented in Plateau (product), the *writer* in the WE/FUI docs shortcode. **(2) Protocol, or just a contract?** — **NOT a minted WE Protocol**: two parties, no swappable-vendor story → a bilateral contract owned at the Plateau route; minting a `we:protocols.json` entry would be lock-in for zero interop gain (minimize-lock-in). **(3) Intent dimension?** — no; a transport/seed is a *technical* concern, never a UX intent (intent-UX-only / technical→Configurator). **(4) Fixed mechanic or dimension?** — the seed *vocabulary* is a fixed contract; the seed *values* are per-block data. **(5) DI-injectable?** — the Plateau **base URL** is env-parameterized exactly like `FUI_DEMO_BASE` (dev `localhost:4000` vs prod host) — plain config, not a registry. **(6) Most-permissive default?** — URL-param seed (shareable, deep-linkable, degrades to a plain anchor; a superset of B's reachable outcomes for the seed job). **(7) Seam between intents?** — it is a seam between **repos/layers** (WE-docs / FUI ↔ Plateau); the owner is the side exposing the surface — **Plateau owns the route + its param contract; the embedder conforms** (a thin documented vocabulary, not a shared runtime package — separation bias).

## Recommended path at a glance

| Element | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Embed mechanism | **iframe** (#701 `fuiDemo` pattern) | — *(forced invariant; shared-component excluded by the boundary)* | High |
| Deep-link to the full configurator | **supported by default** ("Open full configurator ↗") | — *(companion, not a fork)* | High |
| **Seed transport** *(Fork 1)* | **URL query/hash params canonical + optional postMessage for readback/auto-resize** | postMessage handshake as the canonical seed | Med-high |
| Contract owner | **Plateau owns the route + documented param vocabulary; the embedder writes the URL** | — *(forced; the surface owner owns its contract)* | High |

## Ratify (forced invariants — not weighed)

- **Embed via the #701 `fuiDemo`-style sandboxed iframe.** *Shared component* (extract a package both repos import) is the **broken branch**: it violates npm-scope-mirrors-layer (WE/FUI importing Plateau *product* code) and re-opens the cross-repo-import path #700 (DC-7) already ruled out for the *closer* FUI↔WE boundary. Ratify the iframe; reject shared-component.
- **The Plateau route owns the seed-param contract; the embedder conforms.** The side that exposes the surface owns its vocabulary (classification Q7). Plateau implements the reader; WE/FUI builds the URL. The base URL is env-parameterized like `FUI_DEMO_BASE` (`we:.eleventy.js:37`).

## Supported by default (not decisions)

- **A deep-link to the full Plateau Configurator, pre-seeded** — every embed carries an "Open full configurator ↗" link (the #701 chrome pattern). It is a companion to the embed, never a rival; with Fork 1-A it is the *same* URL vocabulary, so it costs nothing extra.
- **Sandbox + lazy-load + FUI/Plateau-branded chrome** — inherited from the #701 wrapper.
- **A `postMessage` readback/auto-resize channel** — *additive*, used only for what a URL can't do (reporting the chosen config / cost preview to the embedder's chrome, iframe auto-height). Allowed by default under Fork 1-A; with a ready-handshake + `targetOrigin`/`event.origin` checks per the WHATWG spec.

## Fork 1 — Seed transport mechanism

**Crux:** the embedded configurator must receive the block's dimensions across an origin boundary, and (for #752/#754) be deep-linkable and shareable. Nothing reads an inbound seed today ([`plateau:configurator.ts:581`](../../plateau-app/src/technical-configurator/configurator.ts), [`plateau:main.ts:327-337`](../../plateau-app/src/main.ts)). The two transports solve different jobs (seed vs live readback); the call is which is **canonical**.

- **A. URL query/hash params canonical, postMessage additive** — the Plateau route reads its seed from the URL at mount; WE/FUI builds the URL (e.g. `…/technical-configurator?block=droplist&render=…&transport=…&chunk=…`). Shareable + deep-linkable *for free* (the "open the full configurator pre-seeded" link is the **same** vocabulary), stateless, matches the #701 iframe precedent and the #754 permalink serialization, no handshake. `postMessage` is added *only* for readback/auto-resize. **← default.**
- **B. postMessage handshake as the canonical seed** — the iframe loads "empty," the parent posts the seed after a ready ping (the Figma Embed Kit model). Richer/larger payloads and bidirectional from day one.

**Default: A.** It is the most-permissive value (shareable, deep-linkable, degrades to a plain anchor) and the dominant layered model (StackBlitz, CodeSandbox both ship URL-canonical + an additive SDK). It reuses the #701 iframe and the #754 permalink grammar, so the seed, the deep-link, and the permalink become **one mechanism**. *Rejected (worse on merit, not broken):* **B** — loses the shareable URL, carries a ready-handshake race (a message to a just-navigated document misses its recipient — WHATWG), and **still needs a URL vocabulary for the deep-link**, so it is strictly more work for the same outcome. B's strength (bidirectional, large payloads) is preserved by A's *additive* postMessage channel without making it the seed.

> **Sub-decision (settled by A):** the seed vocabulary is the **same URL-state grammar #754 reads back** — typed params mirroring the block's four named dimensions (#789), not an opaque blob — so deep-link-pre-seeded and permalink-to-this-view are the same serialization.

---

## Context

- **Carved out of the #752 build** (its blocking fork de-buried per *Decisions Are Work Items*); #752 is `blockedBy` this card. Siblings under #746: #789 (the four Configurator domains), #790 (cost-preview model).
- **Reuse:** the contract is the general WE/FUI→Plateau seeded-embed transport — **#751** (theme-creator embed) uses the same iframe+seed mechanism, and **#754** (permalink/export) shares its URL serialization. Design once.
- **Boundary lineage:** #700 (DC-7) ruled out cross-repo import for FUI↔WE; #701 chose the iframe; #475 treats Plateau as a no-leakage service consumed across a process boundary. This decision extends that boundary to the further WE/FUI↔Plateau (product) hop.
- **Prepared 2026-06-16:** prior-art survey + classification done; `/research/plateau-embed-seed-transport/` published (report `we:reports/2026-06-16-plateau-we-embed-seed-transport.md`). The one live fork is at DoR with a bold default — `✓ ready to ratify`. Making the call is `/next decision`'s job.
- **At graduation:** the documented transport is a technical setting → it pairs with a Technical Configurator surface (the #752/#789 domains), and the seed/permalink grammar is shared with #754. Spin-off builds turn agent-ready against this contract via the existing `blockedBy` chain.
</content>
