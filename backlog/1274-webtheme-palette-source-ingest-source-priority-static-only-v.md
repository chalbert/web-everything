---
kind: decision
parent: "364"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-20"
relatedProject: webtheme
relatedReport: "reports/2026-06-20-palette-source-ingest.md"
crossRef:
  url: /research/palette-source-ingest/
  label: Palette-source ingest research topic
tags: [webtheme, design-tokens, dtcg, palette, adapter, decision-prep]
---

# webtheme palette-source ingest: ingest-boundary surface + generative-seed derivation

Two forks carved from the [#1252](1252-webtheme-load-palette-from-external-source-palette-source-in.md)
build (which is `blockedBy` this decision). The prior-art sweep — published as the
[Palette-source ingest](/research/palette-source-ingest/) research topic (session report
[we:reports/2026-06-20-palette-source-ingest.md](../reports/2026-06-20-palette-source-ingest.md)) — and
the per-fork classification pass **collapsed both original framings to forced invariants grounded in
ratified doctrine**: the carved "which sources first / at all" reduces to backlog prioritization over an
open parser registry, and "static-only vs static+generative" reduces to *support both* once you see
webtheme already derives from a seed. What survives are two **ratify** rows (each carries a recommended
default in **bold**), not open weighs. Settled #1252 constraints — DTCG-color pivot, mandatory value-type
normalization at the boundary, lossy-seed handling, role/name matching — are **not** reopened here.

## Axis framing

The import boundary decomposes into two orthogonal axes the research surfaced, each pinned to the real
tree. webtheme already adopts DTCG 2025.10 as its internal pivot
([we:webtheme/tokens.ts](../webtheme/tokens.ts)), already derives a tonal accent scale from a single seed
*natively* — `oklch(from var(--color-accent) L c h)` emitted verbatim, the literal computed only to gate
WCAG/APCA contrast ([we:webtheme/schemes.ts:261](../webtheme/schemes.ts#L261),
[we:webtheme/schemes.ts:290](../webtheme/schemes.ts#L290)) — and compiles with **no build-time value
baking and no second runtime** ([we:webtheme/compile.ts:9](../webtheme/compile.ts#L9)). So the two axes
are: **(1) the ingest-boundary surface** — file/snapshot parsers (pure local transforms) vs. a live
networked client; and **(2) generative-seed derivation** — reuse the native in-cascade derive vs. bake
swatches at ingest. Both are settled by the constellation's placement doctrine, not open preference.

### Recommended path at a glance

Both rows are forced invariants — ratify each (or override if you see a reason the excluded branch isn't
actually broken). The **confidence** column says where judgment is needed vs. where to nod.

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **1 · ingest-boundary surface** | file/snapshot parsers in WE via a default-less open registry (adapter-as-normalization-hub); WE owns the parser *contract* for live shapes | WE ships a live Figma REST client *(runtime + credential in a contracts-only standard)* | **High** — no-leakage + #817 placement + #889 precedent |
| **2 · generative-seed derivation** | reuse webtheme's native in-cascade derive (`deriveSchemeRuntime`); support static **and** generative ingest | bake derived ramps to literal swatches at ingest *(violates the #403/#405 no-baking invariant)* | **High** — we:webtheme/schemes.ts already ships this |

## Fork 1 — the ingest-boundary surface (file/snapshot vs live client)

**Why it's a fork (forced invariant):** the excluded branch — WE ships a live, credential-holding Figma
Variables REST client — is *broken*: it puts networked runtime + secrets inside a contracts-only standard,
violating no-leakage and the #817 contract/impl seam, and it duplicates the live fetch the product layer
already owns (#889). So the call is a ratify, not a weigh.

The candidate sources each need a normalizing parser into the DTCG color pivot: DTCG color file (already
the pivot — trivial), Tailwind `family→{shade:hex}`, Material 3 seed/scheme JSON, Figma Variables (0–1
float `{r,g,b,a}` over a REST API), flat swatch files (ASE / GIMP `.gpl`). Parsing a shape into the pivot
is a deterministic transform with **no swappable-vendor interop story** — so it is the ratified
*adapter-as-normalization-hub*, not a protocol, and the parser set is a **default-less open registry**
(Config-Extends-Platform-Default; cf. #370): projects register/extend parsers, WE mandates no fixed source
set. That dissolves the original "prioritized subset vs broad adapter set" framing — it is build-order
(backlog prioritization on #1252), never a design branch (#465).

- **(A — recommended) File/snapshot parsers in WE.** Every source *shape* — including a Figma Variables
  **JSON export** — parses locally into the DTCG pivot through the open registry. For a live source, WE
  defines the parser **contract** over the exported JSON shape; the project (or plateau) does the network
  fetch and hands WE a snapshot. Pure local transforms; no network, no credentials in the standard. Reuse
  / mirror plateau's existing `parseDtcg` + `parseFigmaVariables`
  (plateau:plateau-app/src/design-system-creator/importAdapter.ts) where they overlap.
- **(B) WE also ships a live Figma Variables REST client** (network call + API token). *Rejected* —
  runtime + credential in a contracts-only standard; violates no-leakage + the #817 placement test; and
  duplicates the live fetch plateau's design-system creator already owns (#889).

*Settles "which sources at all":* all file-expressible shapes via the registry; the natural build order
(DTCG trivial → Tailwind → M3 seed → ASE/GPL swatches) is #1252 prioritization, not a branch here.

## Fork 2 — generative-seed derivation strategy

**Why it's a fork (forced invariant):** the excluded branch — bake the derived ramp to literal swatches at
ingest time — is *broken*: it contradicts webtheme's ratified native-no-baking invariant
([we:webtheme/compile.ts:9](../webtheme/compile.ts#L9), #403) and discards the runtime-retint property
`deriveSchemeRuntime` exists to provide ([we:webtheme/schemes.ts:261](../webtheme/schemes.ts#L261), #405).
Again a ratify, not a weigh.

Sources split into two ingest modes: **static** sources persist swatches (Tailwind, Radix, Open Color,
ASE/GPL); **generative** sources persist *inputs* and derive ramps (Material 3 HCT seed, Adobe Leonardo
contrast ratios). Because webtheme **already** derives a scale from a seed natively
([we:webtheme/schemes.ts:282-294](../webtheme/schemes.ts#L282-L294)), supporting generative ingest is
nearly free — so "static-only" is reduced scope, not a rival end-state.

- **(A — recommended) Support both modes; a generative seed derives the native in-cascade way.** A static
  source ingests as literal primitive DTCG tokens. A generative source maps its seed + ramp + contrast
  policy onto `deriveSchemeRuntime` (with the existing `curated` override path,
  [we:webtheme/schemes.ts:244](../webtheme/schemes.ts#L244), for brand-precise steps), deriving in-cascade
  with the existing WCAG/APCA gate — one derivation path, identical to the platform default's.
- **(B) Bake derived ramps to literal swatches at ingest.** *Rejected* — violates the #403/#405
  native-no-baking invariant, loses runtime retint, and introduces a second derivation path divergent from
  the platform default's.

---

## Resolution (ratified 2026-06-20)

Both forks ratified as written — a double-ratify, no open weigh survived. Grounding traced to the real
tree before ratifying: native `oklch(from var(--color-accent) L c h)` derive + `curated` override at
[we:webtheme/schemes.ts:261](../webtheme/schemes.ts#L261), no-baking at
[we:webtheme/compile.ts:9](../webtheme/compile.ts#L9), and plateau's `parseDtcg` / `parseFigmaVariables`
at plateau:plateau-app/src/design-system-creator/importAdapter.ts:26,45 — all confirmed present.

- **Fork 1 → A (ingest-boundary surface).** File/snapshot parsers live in WE behind a **default-less
  open registry** (adapter-as-normalization-hub; Config-Extends-Platform-Default, #370). WE owns the
  parser **contract** for live source shapes (e.g. the Figma Variables exported-JSON shape); the project
  or plateau performs the network fetch and hands WE a snapshot. No network, no credentials in the
  standard. The live-REST-client branch (B) is **broken** — networked runtime + secret inside a
  contracts-only standard, violating no-leakage (#475) and the #817 contract/impl seam, duplicating the
  live fetch plateau already owns (#889). Confidence ~90%; residual is contract-shape authoring care
  (build detail, not a branch).
- **Fork 2 → A (generative-seed derivation).** Support **both** static-swatch and generative-seed
  ingest. A static source ingests as literal primitive DTCG tokens; a generative source (M3 HCT seed,
  Adobe Leonardo contrast ratios) maps its seed + ramp + contrast policy onto the existing native
  `deriveSchemeRuntime`, with the `curated` override path for brand-precise steps. One derivation path,
  identical to the platform default, under the existing WCAG/APCA gate. Baking ramps to literal swatches
  at ingest (B) is **broken** — violates the #403/#405 native-no-baking invariant, loses runtime retint,
  and forks a second derivation path. Confidence ~85%; residual = generative vendors use different
  perceptual models than oklch relative-color so exact vendor ramps aren't reproduced — the already-
  settled #1252 lossy-seed tradeoff, absorbed by `curated`, not a reason B wins.

**Unblocks** the [#1252](1252-client-storage-schema-versioning-migration-migrate-or-discar.md) build to
these rulings: implement the open parser registry (DTCG → Tailwind → M3 seed → ASE/GPL build order is
#1252 prioritization), the live-source parser contract, and the generative→`deriveSchemeRuntime` mapping.

## Context

**Supported by default (not decisions) — the fork-existence test moved these out of the call:**

- **Support all coherent source shapes** via the open parser registry (adapter-as-normalization-hub) — no
  mandated source set; build order is #1252 prioritization, not a fork.
- **Both static-swatch and generative-seed ingest modes** (Fork 2-A) — webtheme's existing derive path
  absorbs the generative case.
- **Value-type normalization at the boundary** (hex / ARGB int / 0–1 float / oklch → the DTCG structured
  color object) — already a settled #1252 constraint.
- **Match on role/name, not position** (M3 `--md-sys-color-*`, Radix step numbers, DTCG paths) — except
  Open Color, which is positional.
- **Lossy seeds** (ASE/ACO/GPL — flat colors, no scales/semantics/aliases/alpha) fill the primitive tier
  only, then synthesize ramps + semantic aliases on top via the existing derive path.

**Classification record (per-fork pass):** layer = **adapter** (deterministic parse-into-pivot, *no*
swappable-vendor interop → not a protocol; minimize-lock-in); shape = **default-less open registry** of
per-source parsers (Config-Extends-Platform-Default, #370); default = **most-permissive** (support every
shape; live-fetch is the project's opt-in, not WE's). These classifications are *why* the two original
forks collapsed to ratifies — the merit content fell out of the architecture once classified.

**Lineage.** Carved from [#1252](1252-webtheme-load-palette-from-external-source-palette-source-in.md)
(palette-source ingest adapter) on 2026-06-20 during a batch pre-flight — the story self-declared two
forks and asked them carved to a `type:decision` that blocks the build. Extends resolved
[#364](364-unified-design-token-theming-system/) (unified design-token / theming); sits beneath the #747
design-system bundle layer (a bundle could name an external palette source). Cross-track with #889
(resolved, locus plateau-app): that is the **product-layer** live import into a creator UI; this boundary
is the **standard-layer** import into webtheme's DTCG model — reuse #889's parsers, don't rebuild them.

At resolution each fork gains a dated ruling; resolving this unblocks the #1252 build to its ruling.
