---
type: idea
workItem: story
size: 3
parent: "746"
status: resolved
locus: plateau-app
relatedProject: webdocs
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: plateau-app/src/design-system-creator/creator.ts
tags: [webdocs, design-system, theme-creator, plateau, scaffold, lead-gen]
---

# Plateau design-system creator — domain scaffold

New plateau-app domain (route + mount + seedProvider, cloning the Technical Configurator) — the design-system creator authoring shell plus the sign-in-to-persist/share upsell CTA seam (the lead-gen funnel).

## Progress (resolved 2026-06-18) — locus plateau-app

New domain `plateau-app/src/design-system-creator/`, cloning the Technical Configurator's shape:

- **`we:types.ts`** — `DesignSystem` (theme token groups + intents bundle, the #747 shape) + the `CreatorProvider`
  swap seam.
- **`we:provider.ts`** — `seedProvider.getStarter()` serves a hand-authored starter design system (Color/Space/Type
  token groups + 3 intents); a future provider can read a real WE webtheme tier / intents registry behind the
  same interface (cloned from the configurator's `seedProvider`).
- **`plateau:creator.ts`** — `mountDesignSystemCreator(el, provider?, onUpsell?)` renders the authoring shell: an
  inventory panel (token groups + intents), a canvas placeholder (live workbench lands in #751), and the
  **sign-in-to-persist/share upsell CTA seam** — the lead-gen funnel. The seam is an `UpsellHandler` hook whose
  default dispatches a `design-system:upsell` event (the free local shell never hard-depends on auth; the #775
  free/paid line is cost/hosting — local authoring free, persist+share account-gated). Idempotent mount.
- **`plateau:creator.css`** — minimal shell styling.
- **Wiring** — `plateau:main.ts` (import + breadcrumb label + `route-change` mount + `tryMountDesignSystemCreator` +
  initial mount) and `we:index.html` (nav link + `/design-system-creator` route template with the mount container).
- **Tests** — `plateau:creator.test.ts` (5: inventory, canvas, CTA seam fires with intent, default event dispatch,
  idempotent). Full plateau-app suite green (211 tests). New code typechecks clean (the repo's pre-existing tsc
  errors are unrelated @frontierui-module / auth-union issues).

Authoring + ejection + hosted sync are later slices (#751/#749/#754); this is the route+mount+seedProvider+CTA scaffold.
