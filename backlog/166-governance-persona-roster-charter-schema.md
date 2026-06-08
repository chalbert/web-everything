---
type: decision
workItem: story
size: 5
status: active
dateOpened: "2026-06-07"
tags: [personas, profiles, governance, plateau, dev-browser, review-approve-manage, dev-experience, vision]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "Profiles: predefined personas (#141)" }
---

# Canonical governance-persona roster + charter schema — one family, two lenses

The platform's stakeholder **personas** (developer, designer, manager, translator, analyst/QA, security, legal, …) are referenced in two places that have so far described them only in prose, with no shared model. This item canonicalizes them as **one persona family** with **one schema**, surfaced through **two lenses**, and tracks fleshing out the full roster.

## The two lenses (same family, different surface)

A persona is not tied to a product. It manifests in two complementary ways:

- **Governance charter** (plateau-app, the SaaS management plane) — *what this role reviews, approves, and manages* across the platform's domains (apps, dependencies, intents, deploys…). This is the "review / approval-gate / manage" framing from the original request. Implemented at `/profiles` in plateau-app.
- **Dev-browser toggle-map** ([#141](/backlog/141-dev-browser-vision/)) — *which introspection surfaces this role turns on* in the conformant-app dev browser (state/trace explorer, bug capture, platform rollups…). A profile there is a feature-toggle map over the surface matrix ([#140](/backlog/140-dev-surface-product-feature-matrix/)).

These are not two rosters. The **charter drives the toggle-map**: what a role *cares about* (charter) is what determines which *surfaces* it wants lit up (toggle-map). Decision: **keep a single canonical roster + schema; each lens is a projection of it.**

## The roster

| Persona | Title | Primarily governs / cares about |
|---|---|---|
| Developer | Platform / App Engineer | Build & CI, dependencies, code standards, app health, traces & state |
| Designer | Design Systems Lead | Design system, components, design-drift, intents, visual conformance |
| Manager | Eng Lead / Platform Manager | Portfolio rollups: conformance, test health, throughput, productivity |
| Translator | Localization Manager | Translations/i18n, locale coverage, string drift, jurisdictional copy |
| Analyst / QA | Quality & Support Analyst | Test status, bug capture, rule coverage, repro fidelity, releases |
| **Security** | Application Security Engineer | Supply chain, third-party scripts, CSP, auth, secrets, MFE isolation |
| **Legal** | Legal, Privacy & Compliance Counsel | OSS licenses, privacy/consent, processors/DPAs, accessibility, IP, jurisdiction |

(**Security** and **Legal** are implemented as full charters; the rest are to be fleshed out to the same depth.)

## The charter schema

A profile is pure data (see `plateau-app/src/profiles/profiles.ts`):

- **Profile** — `id`, `name`, `title`, `accent`, `glyph`, `mission`, `signals[]`, `reviewAreas[]`, `artifactsOwned[]`, `escalation`.
- **ReviewArea** — `title`, `platformArea` (pins it to a real Plateau domain), `why`, `reviews[]`, `gates[]`, `manages[]`.
- **Gate** — `trigger`, `blocksDeployment` (true ⇒ blocks a prod deploy), `sla`.
- **Signal** — `label`, `value`, `status` (ok | watch | risk).

`platformArea` is the join key to the existing platform domains, so a profile is a *lens over the platform*, not a parallel structure. The same schema is intended to feed the dev-browser toggle-map (a persona's `reviewAreas` → the surfaces it enables).

## Status

- ✅ Schema defined; Security + Legal charters implemented and rendering at plateau-app `/profiles`.
- ⬜ Flesh out developer, designer, manager, translator, analyst/QA to the same depth.
- ⬜ Decide the canonical home of the roster data (today: hand-authored in plateau-app; candidate: a shared `personas` registry both the SaaS page and the dev-browser read).

## Open questions

- **Shareable / team-templated profiles?** Are personas purely product-defaults, or can an org publish its own ("release-manager", "support") — inherited from #141, now also relevant to the governance lens.
- **Free/paid tiering interaction** — does profile scope gate behind tiers (also from #141).
- **One registry or per-product?** Should the roster live in WE as a standard entity (like intents/protocols), or stay a plateau-app data file with the dev-browser importing it?
- **Gate enforcement** — in plateau-app the gates are currently descriptive; do they ever become *enforced* checks (CI/deploy integration), or remain a documented charter?
