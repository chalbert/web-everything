---
type: decision
workItem: story
size: 3
parent: "746"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#we-fui-embed-boundary
relatedProject: webdocs
relatedReport: reports/2026-06-17-887-plateau-creator-fui-switcher-transport.md
preparedDate: "2026-06-17"
crossRef: { url: /backlog/881-decide-the-we-fui-mode-c-host-config-transport-for-dogfooded/, label: "Rhyming fork — WE→FUI chrome-config transport (#881)" }
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-18"
tags: [webdocs, block-explorer, design-system, theme-creator, plateau-embed, fui, transport, cross-origin]
---

# Decide the Plateau-creator to FUI-switcher manifest transport

How a cross-origin Plateau-authored #747 manifest reaches the FUI-resident #749 switcher (no WE↔FUI channel), and whether the switcher should consume a user-supplied manifest at all vs its fixed gallery. The **cross-origin, runtime-authored** cousin of the #881 WE→FUI chrome-config fork. Gates the #751 "Your theme" embed capstone.

## Grounding digest

Verified against the real trees (2026-06-17); full survey in [`we:reports/2026-06-17-887-plateau-creator-fui-switcher-transport.md`](../reports/2026-06-17-887-plateau-creator-fui-switcher-transport.md), research topic [`plateau-creator-fui-switcher-transport`](/research/plateau-creator-fui-switcher-transport/).

- **An origin-validated `postMessage` channel already exists in the FUI embed SDK.** [`fui:frontierui/embed/embed-host.ts:142`](../../frontierui/embed/embed-host.ts) **rejects any message whose `event.origin` ≠ the frame's validated origin**, matches `event.source` to a live `contentWindow` (`:120-137`), and sends host→guest via `postToGuest` targeted at the validated origin (`:74-75`); [`fui:embed-guest.ts:59,75`](../../frontierui/embed/embed-guest.ts) posts to its embedder's origin and origin-gates inbound. The wire contract [`fui:embed/contract.ts:82-133`](../../frontierui/embed/contract.ts) is a versioned `EmbedEnvelope` (`channel:'fui-embed'`, `v:1`), a `GuestMessage | HostMessage` union (`:116-118`), an `isEmbedMessage` guard (`:121`), and an `envelope()` helper (`:132`) — **already an extensible, origin-validated message bus** (`ready`/`resize`/`overlay-open`/`overlay-close`/`init`). Adding an `apply-design-system` type is a **contract addition, not a new channel**.
- **The switcher's apply path is one already-factored function.** [`fui:frontierui/workbench/mount.ts:277-292`](../../frontierui/workbench/mount.ts) `applyDesignSystem(preset)` sets `themeTokens` as custom properties, sets `data-intent-*`/`data-trait-*` (`:289-290`), and re-renders the same block with no code change; the gallery wires each chip to it (`:300-305`). **Consuming an external manifest = build a `DesignSystemPreset` from the payload and call the existing `applyDesignSystem()`.**
- **The wire shape is the resolved/inline #747 manifest, not a DTCG-path manifest.** The workbench presets [`fui:frontierui/workbench/designSystems.ts`](../../frontierui/workbench/designSystems.ts) carry `themeTokens` resolved inline as a `{ '--custom-prop': value }` map *"because the workbench … has no WE↔FUI channel … it consumes the #747 manifest shape with its own preset data."* The WE catalog form [`we:src/_data/designSystems.json`](../src/_data/designSystems.json) uses a `manifest` **path** ref. Cross-origin, the FUI switcher **cannot dereference a `themeTokens` path** on a Plateau/WE origin (no channel + CORS), so the creator serializes the **fully-resolved** manifest (token *values* inlined). This is #887's analogue of #881's serializable-`ChromeConfig` load-bearing constraint.

## Why this is a decision, not a build

The Plateau creator (cross-origin, runtime-authored) and the FUI switcher (cross-origin) must hand a manifest across a frame boundary, and the **canonical channel is an undecided, reusable cross-repo convention** — every future Plateau→FUI runtime handoff (technical configurator #752, future embedded tools) inherits it. The same-origin DOM-scrape #881 chose is structurally impossible here (the same-origin policy blocks cross-frame DOM reads), so a different mechanism is forced and *which* is a genuine call. Picking it silently would be a quiet design call (design forks are work items, not in-flight calls).

## How this rhymes with #881 — and resolves oppositely

#881 ruled the **same-origin, static** case and landed on **DOM-mediated data on the mount point** (no message). #887 flips **both** distinguishing properties, so the rhyme resolves *oppositely on the channel*:

| | #881 (resolved) | #887 (this card) |
| --- | --- | --- |
| Origin relationship | **same-origin** (FUI in WE's DOM) | **cross-origin** (Plateau iframe ↔ FUI iframe) |
| When config exists | **static**, server-emitted at build | **runtime**, user-authored in the creator |
| Resolved channel | DOM data on the mount point | **`postMessage`** (cross-frame DOM reads blocked) |

## Recommended path at a glance

| Fork | Question | Options | Recommended default | Confidence |
| --- | --- | --- | --- | --- |
| 1 | Live-apply transport channel | A origin-validated `postMessage` · B persist-to-Plateau + fetch-by-id · C URL/#754 reload | **A — reuse the FUI embed channel's origin-validated `postMessage`, + an `apply-design-system` message + the creator's trusted origin** | ~80% |

Supported by default (forced invariants, not forks):

- **Plateau→FUI direct; WE never brokers.** The FUI workbench hosts the Plateau creator as a **nested child iframe** (the sanctioned #746 "embedded Plateau configurators" pattern), so creator→switcher is a direct Plateau↔FUI parent-child message; WE, two frames up, is never a participant. *(Fork-existence: the sibling-iframe topology where the WE docs page hosts both and relays between them is the broken branch — it reconstitutes exactly the WE↔FUI channel #809 forbids. Excluded, not weighed.)*
- **The switcher consumes the runtime manifest.** Fixed-gallery-only is the broken branch — it severs #751's capstone loop ("a theme authored in the embed applies live to the block via the #749 switcher"). The injection point already exists: the created theme is built into a `DesignSystemPreset` and applied through the existing `applyDesignSystem()` ([`fui:mount.ts:277`](../../frontierui/workbench/mount.ts)). Whether it shows as a transient "Your theme" preview vs a persistent gallery entry is a #751 build detail, not decided here.
- **The wire payload is the resolved/inline #747 manifest** (token values inlined), forced by the cross-origin inability to dereference a `themeTokens` path. FUI consumes a #747-*shaped* (a WE standard contract) payload with externally-supplied data — contract-mediated, not code-coupled; the #809 boundary is on WE↔FUI specifically, and a Plateau→FUI channel is the sanctioned constellation pattern.

## Fork 1 — the live-apply transport channel (the core call)

*Fork-existence: A and B are genuinely-exclusive **canonical** channels for delivering the manifest the switcher applies right now — a push over `postMessage` (ephemeral, no backend) **xor** a pull of a persisted record by id (durable, hosted). The switcher needs one source of truth for "the theme to apply now"; it can't treat both as canonical. B is also a structural defect for the *live-apply* requirement (it couples a free-tier loop to paid hosted infra per #775), not merely slower — so this is a real merit either/or, not prioritization.*

- **A (bold default) — origin-validated `postMessage` over the existing FUI embed channel.** The Plateau creator posts the resolved #747 manifest to the FUI workbench parent on "apply"; the workbench validates `event.origin` against the creator's registered trusted origin (the existing [`fui:embed-host.ts:142`](../../frontierui/embed/embed-host.ts) pattern + a `setTrustedOrigins`-style registration for the Plateau creator origin), validates the #747 shape, builds a `DesignSystemPreset`, and calls [`applyDesignSystem()`](../../frontierui/workbench/mount.ts) (`fui:mount.ts:277`) — live, no reload, no backend. *Reuses FUI's already-shipped versioned, origin-validated message bus ([`we:contract.ts:82-133`](../../frontierui/embed/contract.ts)) as a contract addition (`apply-design-system`), keeps the free live-apply loop free (no hosted infra), matches the dominant embedded-editor→live-preview convention (Stripe Elements, Figma/CodeSandbox/StackBlitz embeds drive their host over `postMessage`), and degrades gracefully (invalid origin/shape → ignored, gallery unchanged).* Residual: the creator must serialize a fully-resolved manifest (forced anyway, see invariants) and the workbench must register the creator's origin as trusted — both mechanical.
- **B — persist-to-Plateau + fetch-by-id.** The creator POSTs the manifest to a hosted Plateau service, gets an id/permalink, and the switcher fetches it (CORS). *Cost:* introduces a backend round-trip + a hosted-persistence dependency into what #775 ratified as the **free** live-apply loop — a structural coupling of a free capability to paid infra, plus latency for a handoff that is a local cross-frame message. **This is the right mechanism for the *paid* save/share path (#751/#775 hosted persistence) — a complementary durable channel, not the canonical live-apply one.**
- **C — URL/permalink round-trip (reuse #754).** Encode the manifest in a URL param, navigate/reload the workbench to apply. *Cost:* a full reload per theme tweak destroys the live-authoring loop, and #754 ([754](/backlog/754-block-explorer-permalink-export-as-code/)) encodes a manifest **ref** (`ds=carbon-like`), not an inline token set — it'd need extending to carry resolved tokens. A share/deep-link mechanism, not a live channel.

Recommendation: **A**, confidence **~80%**. The survey confirmed A and dissolved the "is this greenfield?" doubt — FUI *already ships* the origin-validated message bus and a one-call injection point. The residual is the serialize-and-register-origin step (mechanical); B remains the right *separate* channel for the paid persist/share path, and C for deep-linking. *Red-team note for the deciding turn:* the attack on A is "`postMessage` is an ad-hoc channel — persist-and-fetch (B) is a cleaner, durable contract." The rebuttal grounded in the tree: B drags the **free** live-apply loop behind **paid** hosted infra (#775 ratified live-apply as free) for a handoff that is structurally a local cross-frame message; A reuses an already-origin-validated, already-versioned bus and keeps the free loop free. B isn't rejected — it's the *complementary* paid persist channel, just not the canonical live one.

## Out of scope (follow-on build, this card only decides)

The creator build itself (#886 scaffold, #888 authoring, #889 import) is Plateau-side; the transient-preview-vs-gallery-entry presentation and the `apply-design-system` message's exact field list are #751/#886 build details constrained by — not decided by — this fork.

## Context

- **Builds on:** #747 (the manifest shape both sides speak), #749 (the switcher + its `applyDesignSystem` injection point), #809 (no WE↔FUI channel — the topology constraint), #775 (live-apply is free, persist is paid — what makes B a defect for the live channel). Does not re-open any.
- **Consumed by:** #751 (the "Your theme" embed capstone this transport feeds — `blockedBy: [887, …]`).
- **Rhymes with:** #881 (same-origin/static → DOM-data); this is the cross-origin/runtime case → `postMessage`.
- **Prepared 2026-06-17:** prior-art survey + classification done; `/research/plateau-creator-fui-switcher-transport/` published (report `we:reports/2026-06-17-887-plateau-creator-fui-switcher-transport.md`). One genuine fork at DoR with a bold default; three forced invariants recorded — `✓ ready to ratify`. Making the call is `/next decision`'s job.

## Resolution — ratified 2026-06-18 (A)

The Plateau-creator → FUI-switcher manifest is applied over **FUI's existing origin-validated postMessage bus** — the sanctioned direct Plateau→FUI channel, with no new hosted infra in a free loop (option B put paid infra in a free path — the defect). Confirmed by the we-fui-embed-boundary rule + the monetization linear-cost rule. Unblocks #751. Reversible.
