---
kind: story
size: 2
parent: "586"
status: resolved
blockedBy: ["587"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/technical-configurator/seed-expressive-symbol.ts
tags: []
---

# Technical Configurator domain — expressive-symbol render strategy

Per #370 Fork 3 + the technical→Configurator rule: add a Technical Configurator domain (plateau-app; seed + provider entry) letting a project pick the inherited/extended render strategy — native-font | image-set, with a vendor sub-option (Twemoji / Noto / Fluent Emoji) when image-set. Flavor default = native-font. The platform-config schema ships with the intent (#587); this card is the Configurator UI. blockedBy #587.

## Progress

- **Resolved 2026-06-14.** Added the **Expressive-Symbol Render Strategy** domain to the plateau-app
  Technical Configurator (#370 Fork 3 + the technical→Configurator rule), the UI for picking the
  inherited/extended render strategy the #587 intent's platform-config schema declares.
  - **`plateau:src/technical-configurator/seed-expressive-symbol.ts`** — a `Domain` with 4 outcome **axes**
    (consistency per-platform↔uniform; payload none↔asset-set; freshness os-paced↔vendor-paced;
    aesthetic-control none↔vendor-styled) and 4 **strategies**: `native-font` (zero payload, per-platform
    — the **flavor default**) + the three image-set vendors `twemoji` / `noto-emoji` / `fluent-emoji`
    (uniform, vendor-paced, vendor-styled). Outcomes are what the dev picks; the native-font-vs-image-set
    + vendor choice is the answer (model convention).
  - Registered in `we:provider.ts` (`DOMAINS`) + 3 plain-language presets (`brand-consistent` /
    `zero-overhead` / `always-newest`) in `plateau:presets.ts`, wired into `plateau:configurator.ts` `PRESETS_BY_DOMAIN`.
  - **Verified:** plateau-app gate `npm test` green (102 tests); domain structurally complete (every
    strategy declares every axis; presets reference valid value ids). Pre-existing cross-repo plug tsc
    noise is unrelated (plugs aren't tsc-gated). Commit → plateau-app.

**Graduated to** `plateau:plateau-app/src/technical-configurator/seed-expressive-symbol.ts` — expressive-symbol render-strategy domain + presets.
