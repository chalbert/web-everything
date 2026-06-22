---
kind: decision
status: parked
parkedReason: deferred
locus: plateau-app
dateOpened: "2026-06-22"
relatedReport: reports/2026-06-07-dev-surface-feature-market-landscape.md
crossRef: { url: /backlog/140-dev-surface-product-feature-matrix/, label: "Dev-surface × feature matrix (#140)" }
tags: [product-strategy, monetization, product-surface, dev-browser, vscode-extension, chrome-extension, saas, deferred]
---

# Dev-surface monetization bet — extensions-as-funnel vs dev-browser/SaaS as the paid product

The single ratifiable call carved out of the #140 planning matrix: **which product surface is the
monetizable product, and which is the free funnel.** #140 stays the durable map (12 features × 4
surfaces + market gaps); this card holds the one decision so it isn't buried as prose inside an epic.

## What you have to decide (the human call)

Pick the surface that carries the **paid** product, with the rest as free funnel — under the fixed
cost-flat rule (a product either runs locally and is free, or is paid and may use a remote server;
never a free product carrying server cost). One choice, ratifiable in a sentence once the trigger fires.

## Parked — what unblocks it

**`deferred`: there is nothing to decide until real funnel data exists.** The bet is a market read, and
#140 explicitly defers funding the 12-feature triage "revisit with real funnel data." Un-park when
**either** trigger fires:

- **Funnel data exists** — an extension (VS Code / Chrome) is shipped and we can see whether it actually
  converts toward a paid surface; or
- **A dev-experience feature is funded for build** — the first feature that needs a home forces the call
  for real, regardless of funnel data.

Until then this is a real fork held open, not an un-prepared decision waiting on research.

## The fork (provisional default from #140, not yet ratified)

| Branch | Paid product | Free funnel | Case |
|---|---|---|---|
| **A — dev-browser flagship** *(provisional default)* | Dev browser (local, commercially licensed) + selective SaaS for server-needing features (flags, A/B, cloud-offload, translations) | VS Code + Chrome extensions | Dev browser is the integrative home (★ on 7/12 runtime-introspection features); local + licensable keeps server cost off us. |
| **B — SaaS flagship** | Hosted SaaS web app | Extensions + (optional) free local browser | Product-shaped, easiest to market/charge — but high ongoing cost + 24/7 support; #089 solo-founder lens defers it. |
| **C — extensions-only** | Paid extension tier | — | Easiest adoption, but extension culture expects free → weakest sell; flawed as the paid product. |

**Provisional lean: A**, per #140's stated bet (extensions = funnel/proving-ground, dev-browser +
selective SaaS = the monetizable product). Explicitly revisitable under the soft-monetization treatment
(never priced on a shifting category). Deep market detail per branch is in the related report.

## Why this is the *only* standards-vs-product decision here

The #140 rows are **not** "what should be standard" calls — they're product-surface placement +
prioritization (and prioritization is not a fork). The genuine standard kernels behind the features
(trace/replay artifact, introspectable app model, declared flags/variants/rule intents) live in their
own items (#086, #093, the webtraces/webcontexts/webevents family), not here. This card isolates the one
remaining *product* decision so #140 can stay a pure map.
