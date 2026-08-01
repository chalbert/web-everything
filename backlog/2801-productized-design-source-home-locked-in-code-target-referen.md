---
bornAs: x6dpgdu
kind: decision
parent: "2527"
status: open
dateOpened: "2026-08-01"
relatedReport: reports/2026-08-01-design-source-home-locked-target.md
tags: [plateau-loop, conveyor, ui-fidelity, design-source, decision]
---

# Productized design-source home + locked in-code target reference (post-artifact)

**Prepared 2026-08-01.** No productized design-source home exists yet; today the UI-Fidelity Gate's locked
target is a throwaway **claude.ai artifact** link. The four forks below are grounded in a prior-art survey
published as [`/research/design-source-home-locked-target/`](/research/design-source-home-locked-target/)
(Figma REST version-pinning + webhooks, W3C Design-Tokens/DTCG + Style Dictionary, Chromatic/Percy locked
baselines, `jest-image-snapshot` committed baselines, Git content-addressing, pixelmatch/SSIM/pHash oracles,
Storybook `play`-function interaction tests). Each fork carries a **bold recommended default**. This decision
sets the *productized* form of RRFC INVARIANT A's registry — not whether to lock (that is settled). It extends
the target-registry slice [#2806](/backlog/2806-target-registry-approval-token-perceptual-distance-floor/)
under the UI-Fidelity Gate epic [#2804](/backlog/2804-ui-fidelity-gate-real-route-conformance-born-with-contract-t/).

## The need (unchanged from capture)
- **A real design-source home** to save and render UI design iterations — versions, history, side-by-side
  compare, interactions/prototyping — not a one-off artifact link.
- **Multiple design SOURCES** — external services (Figma) alongside our own authored designs (today's
  claude-artifact path).
- **The locking invariant (non-negotiable, already ratified).** However sourced, once a story is created it
  references a **LOCKED, ideally in-code** design that is its immutable target — RRFC INVARIANT A
  (`we:reports/2026-07-31-ui-fidelity-gate-design.md:20`, contract at `:45-51`). This decision is the
  *productized* form of that registry, not the choice to lock.

## Axis-framing — four orthogonal axes the survey surfaced
The concern decomposes into four axes that do not interact: **(1) what a locked target is *made of*** (stored
form), **(2) how an *external* source becomes one** (import→freeze), **(3) *who mints a registry version* — a
product surface or a minter-agnostic WE contract** (the identity `registryId@vN` + `contentHash`), and **(4)
*which* interactions are gated — the deterministic-vs-perceptual cut**. (Two framing corrections the prep
review forced: axis 3 was first written as "where the versioning *UI* lives" — that is product-internal
architecture, not a standards fork; the real cross-boundary call is *who owns the minting contract*. Axis 4 was
first written as "gate interactions or not" — the real call is *the cut line*, not a defer.) Each is pinned to
the real tree:

- The contract they productize: the `target:` block of the `fidelity:` schema —
  `registryId` / `contentHash` / `authoredInCommit` — defined and validated in the resolved schema slice
  [#2805](/backlog/2805-ui-fidelity-contract-schema-validator/) (reference at
  `we:reports/2026-07-31-ui-fidelity-gate-design.md:45-51`).
- The WE-side registry + token + perceptual floor that consumes it: slice
  [#2806](/backlog/2806-target-registry-approval-token-perceptual-distance-floor/) ("WE + shared").
- The product surface that would host authoring/versioning: the Plateau **design-studio** loop
  [#2676](/backlog/2676-plateau-design-studio-request-a-screen-change-ai-design-comm/).
- The hard boundary all four respect: **WE holds zero implementation** (MEMORY #6) — WE defines + validates the
  registry *contract*; the product *renders, imports, stores*.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| 1. Canonical stored form | **In-code artifact is the *sole* content-hashed canon; the rendered baseline is a non-canonical, tolerance-compared product-repo artifact for the advisory perceptual layer (never hashed, never in WE)** | Rendered image is (a co-)canonical hashed anchor | High |
| 2. External-source import→freeze | **Normalize every source into one source-agnostic in-code artifact + provenance; *also archive the raw native payload* (opaque, non-canonical) for lossless offline re-normalization** | Per-source native target format the gate special-cases | High |
| 3. Version-minting authority | **A minter-agnostic WE *contract* (id scheme + hash rule + append-only ledger + token-over-hash); any client mints, the studio #2676 is one client** | A product surface (studio "ratify" button) is the minting authority | Med-high |
| 4. Interactions: what is gated | **Cut on *assertability*: gate deterministic post-interaction states (focus / `aria-*` flips / loading-error) now via the boolean floor; perceptual/timing/motion stays advisory** | Gate *all* interactions now (incl. motion) · or defer *all* interactions to advisory | Med-high |

---

## Fork 1 — Canonical stored form of a locked target

**Why a fork:** the branches genuinely cannot coexist as *the source of truth the content-hash is taken over* —
a hash over rendered pixels and a hash over an in-code artifact are different identities with different drift
behavior, and exactly one can be canonical. (a) is also *broken*, not merely worse — see Rejected.

**Crux.** RRFC INVARIANT A needs two properties at once: a **content-hash** identity (so the target is
immutable + the approval token can sign it) *and* a **perceptual-distance** comparison against a build
screenshot (which needs pixels). The item's non-negotiable adds a third: the target should be **in-code**. What
is stored, and what is the hash over?

- **(a) Rendered image is canonical** — commit a PNG per seed×theme; hash the PNG bytes. *Rejected.* A hash over
  pixels is not stable under font-hinting / DPR / anti-aliasing, so a benign re-render spuriously changes the
  identity; a PNG is opaque (not diffable — you cannot see *why* a target changed), drifts from no source, and
  violates the item's "ideally in-code" requirement. Storing product screenshots in WE would also breach
  WE-holds-zero (the RRFC reference forbids "committed product screenshots in WE",
  `we:reports/2026-07-31-ui-fidelity-gate-design.md:100`).
- **(b) In-code artifact only, render on demand** — commit only the in-code artifact (HTML + DTCG tokens/spec),
  hash *it*, and render the comparison image at gate time. Keeps identity clean and diffable, but puts a
  deterministic-render dependency inside every gate run (font/DPR/browser must be pinned or the floor flakes).
- **(c) In-code artifact is the *sole* content-hashed canon; a rendered baseline is a non-canonical
  product-repo artifact for the advisory perceptual layer.** *(DEFAULT.)* The **in-code artifact is the single
  source of truth and the `contentHash` is `sha256` over its canonical bytes** — the *only* hashed anchor the
  token signs. A rendered baseline PNG exists **only in the product repo** (per seed×theme, where the RRFC
  already keeps baselines) and feeds the **advisory** perceptual layer, compared with **tolerance** (SSIM /
  pixelmatch), never as a co-anchor. This is the design-world analogue of a **lockfile entry**
  (`{registryId, versionId, integrity}`) over the in-code source, and mirrors `jest-image-snapshot`'s
  committed-baseline model on the product side — identity is diffable + drift-stable, the render is a
  regenerable convenience for the tolerant oracle + human review.

**Recommended default: (c), amended (see Skeptic).** Grounded: content-addressing (Git blob = `sha256(content)`;
npm lock `integrity`) supplies immutable identity over the in-code bytes; the perceptual layer (pixelmatch YIQ /
SSIM `>0.99`) is *tolerance*-based and already **advisory** under ratified oracle-tightness B, so its reference
image is not part of the hashed contract. Canonical = in-code (the "ideally in-code" non-negotiable +
diffability); the render is a product build-output, never the identity, never in WE.

```yaml
# registry entry (WE-validated contract; the product produces the render)
target:
  registryId: "console-board"
  version: 3                       # registryId@v3
  contentHash: "sha256:9f2c…"      # over canonicalArtifact bytes ONLY — the token signs THIS
  canonicalArtifact: "plateau:src/design-targets/console-board/v3/target.html"  # in-code, diffable — the canon
  advisoryBaselines:               # NON-canonical, product-repo, tolerance-compared, NOT hashed, NOT in WE
    template: "plateau:tests/visual/baselines/console-board/v3/{seed}.{theme}.png"
```

**Skeptic:** SURVIVES-WITH-AMENDMENT — the attack (correct, folded in): a rendered baseline is **not
byte-deterministic** (font hinting, anti-aliasing, GPU/CPU raster, CPU arch all move pixels — the very reason
the perceptual oracle exists instead of hashing the screenshot), so my first draft's "deterministically-derived,
re-verify by byte-hash" was self-contradictory and would false-block across machines; and a rendered PNG is
render *output* (FUI/plateau), so hashing it as a co-anchor or storing it in WE breaches WE-holds-zero.
Amendment: **the in-code artifact is the sole hashed canon; the baseline is non-canonical, product-repo,
tolerance-compared, and feeds only the advisory perceptual layer.** The excluded (a) (image is a hashed anchor)
is now doubly refuted — pixels aren't a stable identity *and* it is a layer leak. Merit axis: drift-stable
identity + diffability + WE-zero, not cost. **Screen:** clear (both questions) — the ruling is observable across
the boundary and the merit difference (in-code identity vs opaque, non-deterministic pixels) survives free build.

## Fork 2 — How an external source (Figma) is imported and frozen

**Why a fork:** the branches cannot coexist as *the registry's target contract* — either the registry stores
**one** normalized artifact shape (and import adapters differ per source) or it stores **per-source native**
shapes the gate must special-case; a single registry cannot be both. The composability probe fails: a
Figma-native target cannot be a facade over the normalized artifact without first normalizing (which *is*
branch (a) of Fork 1 applied to Figma).

**Crux.** A design arrives from Figma (or tomorrow another tool). INVARIANT A forbids the target being a **live
external URL** — Figma-hosted render URLs are ephemeral (community-reported ~30-day expiry) and the file drifts
under you. So the external source must be **imported and frozen** into the registry. What does "freeze" produce?

- **(a) Reference a live Figma node URL as the target.** *Rejected (broken).* The entire point of INVARIANT A is
  that the oracle never points at something that can drift; a live URL drifts and its render URL expires.
- **(b) Per-source *native* frozen format** — store Figma node JSON + an exported PNG in a Figma-specific target
  kind the gate branches on. *Rejected.* Forks the registry contract per source (the gate grows a special case
  for every design tool), which is lock-in and a composability loss for no interop gain — every consumer of the
  registry must now understand N native formats.
- **(c) Normalize every source into one source-agnostic in-code artifact — *and archive the raw native
  payload* as non-canonical provenance.** *(DEFAULT.)* **Figma is an *importer*, not a target kind.** The
  importer pins an immutable Figma version, pulls the frozen bytes, and *materializes the same canonical in-code
  artifact (Fork 1 (c))* a home-authored design produces. **It also archives the raw native import payload**
  (Figma node JSON + the fetched PNG) as an **opaque, non-canonical** blob beside the artifact — not a second
  target kind the gate reads, purely provenance — so re-normalizing (when the normalizer improves) is a
  **local, lossless, offline** operation, not a re-fetch from an external system that may have dropped the
  version. All downstream machinery (token, perceptual floor, jury) still sees **one** target shape.

**The freeze pipeline (default):**
1. **Pin an immutable version** — `GET /v1/files/:key/versions` → pick a named version `id`; every fetch uses
   `?version=<id>` so it is a frozen historical state, never "current".
2. **Pull frozen bytes, don't keep the URL** — `GET /v1/images/:key?ids=<node>&format=png&scale=2&version=<id>`
   returns an *ephemeral* CDN URL; download the bytes immediately (they expire). Node structure/tokens via
   `GET /v1/files/:key/nodes?ids=<node>&version=<id>` (Dev-Mode-style visual props) → DTCG tokens.
3. **Materialize the canonical artifact + archive the raw payload** — write the normalized in-code target
   artifact + tokens (Fork 1's `canonicalArtifact`), hash it, mint `registryId@vN`; store the raw Figma node
   JSON + fetched PNG as an opaque provenance blob.
4. **Record provenance** (metadata + a pointer to the archived raw payload, not a second contract):

```json
{
  "registryId": "console-board", "version": 4,
  "contentHash": "sha256:…",
  "source": {
    "kind": "figma",
    "fileKey": "Abc123", "nodeId": "1:23", "figmaVersionId": "9876543210",
    "importedAt": "2026-08-01T…", "importerVersion": "figma-import@1.2.0",
    "rawPayload": "plateau:src/design-targets/console-board/v4/.import/figma-raw"
  }
}
```
5. **Drift is a *notification*, never an auto-update** — a Figma `FILE_VERSION_UPDATE` webhook can surface
   "upstream moved, re-import to mint `@v5`?"; the frozen `@v4` never changes under a story.

**Recommended default: (c).** Grounded: the industry consensus is freeze-to-an-in-repo artifact (DTCG tokens,
committed baselines) — Figma's `version` param gives the pin, but permanence is on the importer (ephemeral CDN
URLs force byte-download). Normalizing keeps a **single-substrate contract** (the guardrail from `#native-first`
plug doctrine) and honors *separate-and-decouple*: the source-import concern is its own swappable adapter, the
target form stays source-agnostic.

**Skeptic:** SURVIVES-WITH-AMENDMENT — attacked on "discarding the native payload makes import lossy +
unrepeatable: when the normalizer improves, re-deriving must re-fetch from Figma, an external mutable system
that may have dropped the version." Correct — amendment folded in: **keep the normalized artifact canonical
*and* archive the raw native payload as opaque, non-canonical provenance**, so re-normalization is local +
lossless. This does *not* flip the default (normalized stays the one target shape the gate reads; the raw blob
is never a per-source target kind). Classification attack ("normalize-to-one is settled ports-and-adapters, only
the *never store native* clause is live") granted — the live crux is exactly that clause, and it is the half
that gets amended. **Screen:** clear — normalized-vs-native is observable in the registry contract and turns on
lock-in/reproducibility, a merit axis, not effort.

## Fork 3 — Who *mints* a registry version: a product surface, or a minter-agnostic WE contract

**Why a fork:** the branches cannot coexist as *the authority that produces registry identity* — either the
minting mechanism (id scheme + hash rule + append-only ledger + token-over-hash) is a **neutral WE contract any
client calls**, or a **single product surface** (the studio's button) *is* the authority. Exactly one can own
the contract's source of truth; a product-owned identity forecloses every other minter.

**Reframe (prep review forced it).** This axis was first written as "where does the versioning *UI* live —
standalone vs fold into #2676." A fresh-context screen flagged that as an **implementation + prioritization**
question: once "in WE" is rejected (MEMORY #6), *which product surface hosts the authoring UI* is
product-internal architecture invisible to a WE consumer, and with both free to build the case collapses to
"don't rebuild it" (effort). The genuinely cross-boundary, merit-bearing call is a different one: **who owns the
minting *contract*.** The UI-placement half is demoted to a settled recommendation (below); this fork rules the
contract.

**Crux.** A saved iteration becomes a registry identity `registryId@vN` + `contentHash`. What issues that
identity + the approval token?

- **(a) A product surface is the minting authority** — the design-studio "ratify" button *is* what mints a
  version and issues the token. *Rejected.* This puts the source of contract truth **inside one product**:
  (i) lock-in — FUI, a CI import job, or a future tool cannot mint or extend a target version without routing
  through the studio UI, though anyone who can produce `artifact + hash` should be able to; (ii) the contract's
  integrity now depends on a product's uptime/behavior; (iii) it overloads "ratify" (a governance term in this
  constellation) onto a product button.
- **(b) A minter-agnostic WE *contract* any client calls.** *(DEFAULT.)* WE (the `#2806` registry slice) defines
  the **mechanism**: the id scheme (`registryId@vN`), the hash rule (`sha256` over the canonical in-code
  artifact), the **append-only ledger** format, and the **token signed over the content hash**. Any client — the
  design-studio #2676, a Figma import job, a CI step, a hand-authored commit — can produce `artifact + hash` and
  **append a version + obtain a token**. The *trigger* (a studio button, a webhook, a CLI) is a product concern;
  the *identity mechanism* is the contract.

**Identity mapping (the mechanism this fork settles):**
- `registryId` = a **stable surface id** (e.g. `console-board`), independent of any version.
- `@vN` = the **Nth ratified target** for that surface — **append-only + immutable** (forced by INVARIANT A: the
  target must pre-date the build lane and cannot change under a story), the same Obsoletes/Obsoleted-by model
  the research registry uses. Un-ratified iterations are **drafts**, not registry versions.
- `contentHash` = `sha256` over `@vN`'s canonical in-code artifact (Fork 1); the token signs **that hash**.
- Chromatic/Percy prove the promote-on-accept model but keep identity **server-side, inside their product**;
  the WE-owned, in-repo content-hash + ledger is the minter-agnostic, auditable version of the same idea.

**Settled recommendation (product-internal, not a WE ratification):** the **human** authoring / versioning /
side-by-side-compare UI should fold into the design-studio loop #2676 rather than a standalone surface — #2676
already composes the visual-diff adapter, jury-core, comparator, and convergence trace, and versioning is
intrinsic to its propose→compare→ratify loop. This is a reversible product-architecture call, *not* part of what
the decider ratifies here (it does not own the identity contract).

**Recommended default: (b).** Grounded: the registry token + floor already live "WE + shared" (#2806); making
minting a neutral contract keeps it there and matches *impl-is-not-a-standard* + minimize-lock-in. Confidence
med-high because the exact ledger format + the studio↔registry client seam are build details.

**Skeptic + Screen (converged — both reviews flipped the original framing):** the same-session default (fold
the surface into #2676, minted by its "ratify" button) was refuted on **layer leak** by the skeptic ("minting
contract identity from a product button locks all other consumers behind one product; the mechanism belongs in
the neutral contract layer, the studio is one client") **and** flagged `impl + prio` by the fresh-context screen
(surface-placement is product-internal, and version-identity is the same either way so the delta was effort).
**Both are folded in by the reframe above:** the minting **mechanism** moved to a WE contract (fixes the layer
leak + the impl flag) and is now ruled on **lock-in merit** (fixes the prio flag); the surface **placement** is
demoted to a settled, reversible recommendation. Statute-overlap: sets no `codifiedIn` here (mechanism is #2806's
schema territory), so no `we:docs/agent/platform-decisions.md` anchor collision. **Skeptic:**
SURVIVES-WITH-AMENDMENT (mechanism → WE contract, studio → one minter). **Screen:** flagged(impl+prio) → fixed
by re-layering the contract to WE and demoting the UI-placement to a recommendation.

## Fork 4 — Which interactions are gated: the deterministic-vs-perceptual cut

**Why a fork:** the launch posture draws a **cut line** through interactions, and the two coherent lines cannot
coexist — you either cut on **assertability** (gate what a boolean oracle can decide) or on **static-view-vs-
interaction** (gate only whole renders, defer everything an event triggers). One cut excludes the other. The
"gate *all* interactions incl. motion" extreme is separately *broken* (no deterministic oracle for motion → a
tolerant lens in a blocking seat, the class ratified oracle-tightness B/C already rejected).

**Crux.** A design is more than a static render — an event produces new **DOM/ARIA/focus state** (deterministic)
*and* **motion/timing/prototype feel** (perceptual, non-deterministic). Where is the gating cut?

- **(a) Gate *all* interactions now, including motion.** *Rejected (broken).* Figma prototypes are **advisory by
  design** (no API returns an executable, assertable interaction contract); a tolerant motion/timing lens in a
  *blocking* seat rots under drift — exactly why oracle-tightness ratified **B** and **parked C**
  (`we:reports/2026-07-31-ui-fidelity-gate-design.md:139-145`).
- **(b) Defer *all* interactions to advisory; gate only end-states that are distinct renderable *views*.**
  *Rejected.* This was the prep's first default; the review refuted it. Its cut ("a distinct rendered view") is
  a **visual** criterion, so it silently drops the deterministic, highest-a11y-value states that *don't* produce
  a distinct full render — a focus ring, a single `aria-expanded` flip. Under-gates the part a boolean gate
  exists for.
- **(c) Cut on *assertability*.** *(DEFAULT.)* **Gate the deterministic post-interaction state *now*** — focus
  order + `focus-visible`, `aria-expanded`/`aria-selected`/`aria-checked` flips, disabled / loading / error
  states after an event — through the **existing boolean floor**, driven by a minimal event step
  (Storybook `play`-function / Playwright-style: dispatch the event, then assert DOM/ARIA/focus). These need
  **no perceptual oracle** and are the highest-value a11y checks a gate can make. **Motion / timing / prototype
  feel stays advisory** (surfaced to reviewer/jury, never gating) — it has no deterministic oracle, and gating
  it would be a false-block factory.

**Recommended default: (c).** Grounded: the RRFC already gates only boolean-deterministic signals, and a
post-interaction ARIA/focus state **is** boolean-deterministic — so it *belongs* in the floor, not in advisory
limbo. The enforceable prior art (Storybook `play` + `expect`) is exactly a deterministic post-event assertion,
which we fold into the frozen `webcases` floor; the perceptual half stays advisory under ratified choice B.
The advisory half never "reopens" — motion is perceptual by nature; there is no deferred deterministic oracle
waiting.

**Skeptic + Screen (converged — both refined the cut):** the same-session default (b) (all interactions
advisory, only distinct-view end-states gated) was **flagged(prio)** by the fresh-context screen ("the delta is
gating transitions now vs later — cost/timing") **and** refuted by the skeptic ("the cut is drawn in the wrong
place: deterministic post-interaction ARIA/focus states are boolean and a11y-critical, and a *visual* filter
drops them"). Both fold into the reframe: the cut is now **assertability, not timing** — deterministic states
gate *now* (merit: they're decidable + high-a11y-value), perceptual motion stays advisory *permanently* (merit:
no sound oracle, blocking would rot). That removes the prio flag (the reason is gate-reliability + a11y merit,
not build cost) and the under-gating. **Skeptic:** SURVIVES-WITH-AMENDMENT (cut on assertability). **Screen:**
flagged(prio) → fixed by re-deriving the cut on merit (deterministic → gate; perceptual → advisory).

---

## Context (below the call — framing, not decisions)

### Supported by default (not decisions)
- **Multiple importers** (Figma today, others later) are all *supported* — that is not a fork; Fork 2 only
  rules the *stored form* (normalized), leaving the importer set open.
- **The claude-artifact path stays valid** as one authoring source during transition; it normalizes into the
  same canonical artifact (Fork 1/2). This decision does not delete it, it productizes its successor.
- **Both themes + all seeds** in the baseline set are inherited from the RRFC contract, unchanged here.

### Per-fork classification (recorded — it is much of the ruling)
- **Layer.** The **registry contract** — schema (`registryId`/`contentHash`/`canonicalArtifact`/`source`
  provenance) **plus the minting mechanism** (append-only ledger + minter-agnostic token-over-hash, Fork 3) →
  **WE** (a conformance contract + validator; matches #2806 "WE + shared"). The **importer, renderer, human
  versioning UI, stored artifacts + raw-payload archive, post-event assertion harness** → **product**
  (FUI/plateau) per MEMORY #6.
- **Protocol or intent dimension?** Not a protocol — no multi-vendor interop/engine-swap story for the registry
  contract; it is a validated schema + ledger WE owns. The importer *seam* is a swappable adapter
  (source-agnostic), not a ratified protocol.
- **Config dimension?** No — none of the four forks is "two values of one knob"; each names an *excluded/broken*
  branch (image-as-hashed-anchor / per-source-native / product-owned-minting / gate-all-incl-motion).
- **Default = most permissive / minimize-lock-in** holds within each fork (in-code + diffable canon;
  source-agnostic + raw-payload-retained; minter-agnostic contract; gate-the-deterministic + advise-the-rest).

### Dependencies & lineage
- **blockedBy in spirit:** the productized form should not land before the launch RRFC target-registry
  ([#2806](/backlog/2806-target-registry-approval-token-perceptual-distance-floor/)) and schema
  ([#2805](/backlog/2805-ui-fidelity-contract-schema-validator/), resolved) prove the artifact-as-target path
  is the bottleneck — this is the decision's own "Not now" gate, not a DAG edge to add now.
- **Re-home:** on ratification, this item should re-parent from #2527 under the UI-Fidelity Gate epic
  [#2804](/backlog/2804-ui-fidelity-gate-real-route-conformance-born-with-contract-t/) (its natural home).
- **Spin-off builds (post-ratification, `blockedBy` this decision):** (i) WE — extend the registry schema with
  `canonicalArtifact` + `source` provenance + the append-only `@vN` ledger + minter-agnostic token issuance (WE
  side, near #2806); (ii) plateau — the Figma import→freeze importer (pins `?version`, archives the raw
  payload); (iii) plateau — fold the human versioning/compare UI into design-studio #2676 as one minter-client;
  (iv) plateau — the post-event assertion harness (gate deterministic ARIA/focus/loading states) + advisory
  motion spec. Each carries its own slice of the touch-set below.

### Predicted touch-set (#2619 — seeds each spin-off child's scope)
- WE: `we:scripts/lib/` (registry/token/floor) + `we:src/_data/` (schema) — the `canonicalArtifact`/`source`/`@vN`
  contract extension.
- plateau: `plateau:src/` (design-studio surface #2676) + a `plateau:scripts/` importer for the Figma freeze +
  `plateau:tests/visual/baselines/` (derived baselines).

### Review jury (provisional — pre-registered #2638)
Care band: **elevated** (system machinery + cross-repo WE↔plateau contract; not statute-codifying, so not
`high`). Provisional roster the eventual review should meet, aligned up front so no juror invents a new bar at
review time: **architecture-boundary** (WE-holds-zero: is any impl on the WE side? is the registry contract
free of product concerns?), **contract/schema** (is `registryId@vN`+`contentHash`+`source` well-formed,
append-only, and does the token sign the right bytes?), **drift/immutability** (can a frozen target change under
a story? does the oracle ever touch a live URL?), and **composability/lock-in** (is the target form
source-agnostic; does Figma stay an adapter?). Provisional — re-checked against the real diff at PR open (#2636);
it is the bar to align on, not a contract.
