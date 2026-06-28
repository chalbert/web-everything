---
kind: epic
status: open
dateOpened: "2026-06-27"
relatedProject: webplugs
relatedReport: reports/2026-06-27-backlog-split-analysis.md
tags: [plugs, unplugged, maas, parity]
---

# Make every plug public API functional unplugged — parity matrix, MaaS mode adapters, per-plug packages, workbench toggle

The unplugged plug surface is suspected broken: per the #635 runtime audit only webbehaviors has dual-mode coverage, so most public plug APIs likely do not actually work without window-patching. This epic makes every plug public API functional in unplugged mode (the safe-now real product surface), publishes a doc-site parity table comparing plugged vs unplugged per API, adds MaaS mode adapters that serve each component in the chosen form, ships an npm package per plug, and puts a plugged/unplugged toggle in each workbench. Default delivery is unplugged — imported then converted through the MaaS/build transform.

## Why this is suspected broken

Two modes exist in the runtime today (`fui:plugs/bootstrap.ts` patches `window` singletons in **plugged** mode; `fui:plugs/unplugged.ts` is the side-effect-free `register`/`upgrade`/`downgrade`/`attach`/`detach` functional API). But the #635 per-plug audit ([we:reports/2026-06-14-plugs-runtime-audit.md](/reports/2026-06-14-plugs-runtime-audit.md)) found **only `webbehaviors` has dual-mode automated coverage** — so for every other plug the unplugged path is unproven and probably non-functional for parts of its public surface.

The structural reason is the **method-attachment problem**. In plugged mode a plug can patch a method straight onto the element (`el.someMethod = …`, or a patched prototype). Unplugged mode may not touch globals or prototypes it doesn't own, so the same capability has to attach **out-of-band**, keyed by the element — i.e. a **WeakMap from element → plug-state/methods** owned by the plug instance, consulted by the plug's own API rather than read off the DOM node. Expect heavy WeakMap use across the unplugged ports; this is also why a *few* capabilities may be genuinely impossible unplugged (see "Plugged-only residue" below). The goal is to make the public API work unplugged everywhere it *can*, and to make the residue explicit and minimal.

## Constellation boundary

Per [#606](/backlog/606-where-does-the-plugs-platform-layer-runtime-live-web-everyth/) the plugs **runtime is FUI-owned**; WE owns the plug **contracts** (`we:src/_data/plugs/`) and the doc-site spec. So the children split by locus: the per-plug unplugged ports + per-plug packages + workbench toggle land in **FUI**; the published parity table is a **WE** doc surface; the MaaS mode adapters + default-unplugged IR live where MaaS lives today (**WE** — `we:blocks/renderers/module-service/`). Umbrella homed under `webplugs`; children carry their own locus and `blockedBy` edges. This is an **unsliced** epic — `/slice` it into the workstreams below before batching.

## Workstreams (sliced — carved 2026-06-27, see [we:reports/2026-06-27-backlog-split-analysis.md](/reports/2026-06-27-backlog-split-analysis.md))

- **W1 — Per-plug unplugged conformance** → re-audit slice [#1840](/backlog/1840-re-audit-the-actual-unplugged-functional-state-of-every-publ/) (#726 is resolved-claims-done; resolved ≠ proof, so verify first and spawn a fix card per real gap). *Locus: FUI.*
- **W2 — WeakMap method-attachment pattern** → [#1842](/backlog/1842-shared-weakmap-element-attachment-pattern-for-unplugged-meth/). *Locus: FUI.*
- **W3 — Doc-site parity table** → [#1844](/backlog/1844-publish-a-doc-site-plugged-vs-unplugged-parity-table/) (auto-rendered + drift gate, relate `#1309`). *Locus: WE.*
- **W4 — MaaS mode adapter** → [#1841](/backlog/1841-maas-mode-adapter-serve-a-component-plugged-or-unplugged/). *Locus: WE (MaaS).*
- **W5 — Default IR = unplugged** → [#1843](/backlog/1843-make-the-default-maas-served-ir-unplugged/). *Locus: WE (MaaS).*
- **W6 — Per-plug npm packages** → [#1846](/backlog/1846-ship-each-plug-as-its-own-npm-package/) (gated on decision #1837). *Locus: FUI.*
- **W7 — Workbench plugged/unplugged toggle** → [#1845](/backlog/1845-add-a-plugged-unplugged-toggle-to-the-block-workbench/) (relate `#746`). *Locus: FUI.*

The per-plug *fix* cards are intentionally not scaffolded yet — #1840 discovers which plugs are actually broken and spawns them.

## Decisions to ratify (carved as `decision` children — not baked)

Each collides with, or extends, an existing ruling, so each is its own `kind: decision` slice:

1. **Per-plug npm packages vs the monolith** → [#1837](/backlog/1837-decide-per-plug-npm-packages-vs-the-single-frontierui-plugs-/). `#1045`/`#606`/`#170` ship **one** `@frontierui/plugs` with locked scope for dedup; W6 wants one package per plug. Real fork. Gates #1846.
2. **Default IR = unplugged** → [#1838](/backlog/1838-ratify-default-maas-served-ir-is-unplugged/). Aligns with the plug doctrine ([#1826](/backlog/1826-decision-prep-doctrine-a-plug-is-a-proposed-missing-standard/)/[#1807](/backlog/1807-declarative-custom-state-surface-how-a-component-declares-to/)) but is a new MaaS-level default. Gates #1843.
3. **Plugged-only residue policy** → [#1839](/backlog/1839-decide-the-plugged-only-residue-bar-and-how-the-parity-table/). The set that genuinely cannot work unplugged ≈ the genuinely-missing-standard set ([#1826](/backlog/1826-decision-prep-doctrine-a-plug-is-a-proposed-missing-standard/)). Gates #1844.

## Acceptance

- Every active public plug API has dual-mode tests and a proven unplugged path (or is explicitly, justifiably marked plugged-only); `PLUG_UNPLUGGED_TEST_ENFORCED` is `error`.
- The doc-site parity table renders from a live registry and is covered by a drift gate.
- MaaS serves any component in plugged or unplugged form; the default served IR is unplugged.
- Each plug is consumable as its own npm package (pending decision #1 above).
- Each workbench has a working plugged/unplugged toggle.
- The plugged-only residue is enumerated and minimal.

## Related existing work

Audit/grounding: `#635` (resolved, the per-plug matrix report). Test backfill: `#726`, `#951`, `#1109`, `#1002`, `#649`. Lifecycle contract: `#1350`, `#1413`. Packaging/repoint: `#1045`, `#1234`. Drift gate: `#1309`. Workbench: `#746`. Doctrine: `#1826`, `#1807`. `/slice` should reconcile these — relate or re-parent rather than duplicate.
