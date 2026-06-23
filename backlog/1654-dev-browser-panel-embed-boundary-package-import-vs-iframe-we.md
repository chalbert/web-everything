---
kind: decision
status: open
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-1391-split-analysis.md
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 Fork 4-A (panel embed seam)" }
tags: [dev-browser, plateau, panel-embed, decision]
---

# Dev-browser panel-embed boundary — package import vs iframe/web-component mount for plateau-app panels (#141 Fork 4-A)

## Digest

Resolves #141 Fork 4-A — how the Plateau-owned dev-browser shell mounts plateau-app's Technical Configurator / Intent Configurator / Profiles panels — and unblocks slicing the #1391 shell epic (the panel-embed slice currently buries this fork). The forks below are grounded in the [dev-browser panel-embed boundary](/research/dev-browser-panel-embed-boundary/) research topic, each with a **bold** recommended default. The load-bearing finding is that the shell and the panels are the **same repo and same origin**, which dissolves the framing of the original question: a "direct import" here is an intra-repo function call, not a cross-constellation edge, so the import-vs-iframe either/or does not survive as a single ruling — it splits by trust/origin into support-both.

## Axis-framing

The dev-browser shell is Plateau-owned ([#1565](/backlog/1565-dev-tool-placement-across-the-constellation-devtools-belong-/) — an operated surface you run against your own build lives in Plateau), and the three panels it must surface already ship in the **same plateau-app repo** as plain DOM mount functions with no framework: `mountTechnicalConfigurator(root: HTMLElement)` ([plateau:src/technical-configurator/configurator.ts:639](https://github.com/)), `mountIntentConfigurator(root)` ([plateau:src/intent-configurator/configurator.ts:421](https://github.com/)), and `mountProfiles(el)` ([plateau:src/profiles/profiles-page.ts:165](https://github.com/)). They are one Vite bundle (plateau:package.json declares no react/vue) and are already called same-bundle from the SPA at [plateau:src/main.ts:437/481/527](https://github.com/). The shell directory [plateau:src/dev-browser/](https://github.com/) already exists. Because host and panel are the same origin, a "direct import" is a synchronous in-process call — it never crosses the WE→FUI→plateau DAG (a backward edge is a CODE import *upstream*; an intra-repo import inside the product layer is none). This is the inverse of the two prior plateau-embed transport decisions, which were cross-origin by construction and therefore *forced* iframe+postMessage: #788 (a WE/FUI docs surface embeds a Plateau configurator) and #887 (a Plateau creator iframe feeds a FUI switcher iframe). Where an iframe boundary *does* recur is the third-party app the browser loads — that surface is genuinely cross-origin and reuses the existing FUI embed bus, which origin-validates every message at [fui:embed/embed-host.ts:227](https://github.com/) against a versioned `fui-embed` envelope at [fui:embed/contract.ts:85](https://github.com/).

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · first-party panel mount** | direct package import / `mount*(el)` call | iframe/web-component boundary *(rejected for same-origin trusted panels)* | **High** — same-repo, same-origin, no isolation need |
| **2 · loaded third-party app surface** | reuse the existing origin-validated iframe + postMessage bus | mint a new WE Protocol *(rejected)* | **Med-High** — channel already exists, no interop gain from minting |

## Fork 1 — how the shell mounts its OWN (first-party) plateau-app panels

Fork-existence: import-vs-iframe is a *genuine* either/or only if the branches cannot coexist for the same surface — for the shell's own panels they cannot both be the default, so this is a real fork, but the merit is one-sided once same-origin/same-repo is established.

**Crux:** the Technical/Intent Configurators and Profiles are trusted plateau-app code in the same repo and origin as the shell ([plateau:src/technical-configurator/configurator.ts:639](https://github.com/), [plateau:src/main.ts:437/481/527](https://github.com/)) — there is no untrusted-content, independent-deploy, or CSS/JS-encapsulation driver that the iframe branch exists to serve.

- **(a — recommended) Direct package import / mount-function call.** The shell calls the existing `mount*(el)` functions in-process. Tightest coupling and the cleanest data flow: synchronous, no postMessage marshalling, shared bundle, single origin, no transport contract to version. Constellation-DAG clean — an intra-repo import inside the product layer is not an edge.
- **(b) iframe / web-component boundary.** Buys CSS/JS isolation and independent-deploy of each panel — neither of which the shell needs for its own trusted code — at the cost of a postMessage handshake, resource duplication, and cross-frame data marshalling for surfaces that share one bundle and origin. *Rejected* for the first-party panels: it imposes the isolation tax of #788/#887 where none of their forcing conditions (cross-origin, untrusted, runtime-authored) hold.

**Default: (a) direct package import / mount-function call.**

*Skeptic:* if the panels are later extracted into their own deployable package or a second origin, (a) would have to become (b) — but that re-extraction would itself be the trigger that flips the origin/trust property, at which point Fork 2's transport already applies; nothing is foreclosed.

## Fork 2 — the boundary mechanism for the LOADED third-party app's surface

Fork-existence: this is a distinct surface from Fork 1 (the conformant app the browser navigates to, not the shell's own panels) and is cross-origin/untrusted by construction, so it genuinely needs a transport — the fork is whether to reuse the existing one or mint a new contract.

**Crux:** the dev-browser's premise is loading *other people's* conformant apps; reading their introspectable surfaces is a cross-origin, untrusted boundary, exactly the case the FUI embed bus already handles — it rejects any message whose `event.origin` mismatches the validated frame origin ([fui:embed/embed-host.ts:227](https://github.com/)) over a versioned `fui-embed` envelope union ([fui:embed/contract.ts:85](https://github.com/)).

- **(a — recommended) Reuse the existing origin-validated iframe + postMessage bus.** Adding a message type to the established `fui-embed` envelope is a contract addition, not a new channel; isolation and origin-validation are already in place; consistent with how #788/#887 resolved the same cross-origin shape. Constellation-DAG clean — a runtime cross-origin boundary is not a backward code edge.
- **(b) Mint a new WE Protocol for the panel-embed transport.** A swappable-vendor protocol earns its keep only when independent parties must interop against a published contract; here the two parties are the shell and the loaded app's FUI-shipped surface, already covered by the documented `fui-embed` envelope. Minting one is lock-in for no interop gain. *Rejected.*

**Default: (a) reuse the existing origin-validated iframe + postMessage bus.**

*Skeptic:* if a future non-FUI implementation must embed into the shell, the `fui-embed` channel name reads impl-specific — but that is a rename/namespacing of an existing contract, not evidence a fresh Protocol is needed today.

## Context

- **Lineage:** resolves #141 Fork 4-A, whose #141 resolution explicitly deferred the embed seam ("package vs. iframe/web-component is a build detail, deferred"). Filed as a standalone decision per the [#1391 split analysis](reports/2026-06-22-1391-split-analysis.md), which could-not-split #1391 because this fork (and the free/paid line, filed separately) was buried in its panel-embed slice.
- **Sequencing:** ratifying #1654 unblocks the #1391 `S5` panel-embed slice (`blockedBy: S1 shell scaffold + this decision`). It does not block `S1` (the shell scaffold itself), which can proceed independently.
- **Constellation:** the shell is Plateau-owned (#1565); first-party import is intra-repo (no DAG edge); the third-party transport is a runtime cross-origin boundary (also no backward code edge). Both defaults keep the WE→FUI→plateau DAG clean.
