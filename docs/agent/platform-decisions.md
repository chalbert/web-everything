# Platform Decisions — the standing rules (statute)

This file is the **source of truth for cross-cutting platform rulings**: the reusable rules that
govern *how* the constellation is built, promoted out of the ratified decisions in `backlog/`.

**Two layers, one discipline:**
- **Case law** — `backlog/*.md` `type: decision` items. Each records *one* call and *why* (the
  deliberation, the forks, the lineage). Immutable history.
- **Statute (this file + the topical `docs/agent/*.md`)** — the *rule* a decision established,
  stated once, named, and citable. This is what you read and cite when a new question lands.

> **Why this exists:** a 2026-06-18 sweep of all 166 resolved decisions found **64% were
> "case-law-only"** — the rule lived *only* in its backlog file, so each new instance re-derived
> the same axis instead of citing it. The worst offender was constellation placement (10 decisions
> re-deciding one test). The fix is this file plus a promotion discipline, below.

> **⚖️ THIS DOC IS THE SINGLE SOURCE OF TRUTH FOR SETTLED ORIENTATION — read and cite _it_, not the
> backlog decision chain.** When you need to know *the rule* (a placement / naming / boundary /
> monetization orientation), read **this file** and cite the **named anchor**
> (`platform-decisions.md#<anchor>`). **Do NOT reason from, or cite, the `backlog/*.md` `type:decision`
> items (`#NNN`) unless you specifically need the _history_** — the deliberation, the forks, the
> lineage behind a rule. The case-law items are an **archive**, not the reference; a bare `#NNN`
> citation of an already-codified rule is a smell (swap it for the anchor). This doc **must be kept
> complete and current** — if a settled rule is missing or stale here, that is a **codification gap to
> fix** (promote/repair the rule in this file, per the discipline below), never a licence to fall back
> to citing the work item. `#NNN` is correct in exactly two places: this doc's own **`Lineage:`**
> footers, and when you *genuinely mean the historical call* (e.g. a reversal that supersedes it).

## How to use this file

1. **Before opening a new `type: decision` for a placement / naming / monetization / boundary
   question, check here first.** If a named rule covers it, the "decision" is just *applying* the
   rule — cite it, don't re-litigate. If the rule genuinely doesn't reach your case, the new
   decision records only the *novel* wrinkle and then extends the rule here.
2. **When you ratify a decision that establishes (or refines) a reusable rule:** state the rule in
   the relevant section here (or the topical doc), then set `codifiedIn:` on the decision's
   frontmatter pointing at it. The decision item keeps the lineage; this file carries the rule.
3. Rules are **reversible** (see [backlog-workflow.md](backlog-workflow.md) → reversibility). A
   reversal supersedes the rule here *with lineage* ("supersedes #NNN because …") — never erase it.

## Promotion discipline (enforced)

- `codifiedIn:` is a frontmatter field on `type: decision` items. Value = the guideline path that
  carries the rule (e.g. `docs/agent/platform-decisions.md#constellation-placement`), **or** the
  sentinel `one-off` for a narrow call that establishes no reusable rule (the analogue of
  `graduatedTo: none`).
- **Hard gate at resolve.** `node scripts/backlog.mjs resolve <NNN>` **refuses a `type: decision`
  that has no `codifiedIn`** — pass `--codified-to=<doc#anchor>` (the CLI stamps the field) or
  `--codified-to=one-off`. You cannot resolve a decision and walk away from its rule; the orientation
  is captured at the moment the deliberation is freshest, not in a later sweep.
- **`check:health` (`scripts/audit-backlog-health.mjs`) flag G6** is now the catch-up pool for the
  **legacy** decisions resolved *before* the gate existed. The count is the un-promoted backlog; it
  should only ever shrink. (New decisions can't add to it — the gate blocks them.)
- **Cite the rule, not the case.** When a work item leans on a settled orientation, link the **named
  rule here** (`platform-decisions.md#<anchor>`), not the originating `#NNN`. The decision file holds
  the lineage for an archaeologist; day-to-day work cites the statute so the rule, not the deliberation,
  is what propagates. A bare `#NNN` reference to a *codified* decision is a smell — replace it with the
  anchor.
- The full per-decision codification status is the register at
  `audits/2026-06-18-decision-codification-register.md` (regenerate via the
  `decision-codification-sweep` workflow).

---

## The standing rules

### The primary checkout is read-only; every change lands via a lane→PR {#primary-read-only-lanes-only}

The shared PRIMARY checkout of a constellation repo (web-everything / frontierui / plateau-app) is **read-only**:
no source, no content, no backlog-item creation, and **no direct push to `main`**. Every change — including new
backlog items — reaches `main` through a `lane/*` ref → PR → CI-gated merge, so *nothing lands on `main`
ungated* holds by construction. Coordination writes that need immediacy (claims/reservations) happen **in-lane**
(claim-in-lane, #2123/#2183), not in the primary. Enforced in depth: `guard-lane.mjs` (PreToolUse Edit/Write on
the primary tree), `guard-bash.mjs` (PreToolUse Bash — an agent-typed direct `git push` to `main`; `lane/*`
allowed; `MAIN_PUSH_OK=1` overrides), and a git `pre-push` hook for script-internal pushes (#2217). Ruled #2203
after a `/workflow` scaffolded items + direct-pushed them to `main`, landing an ungated `check:standards` error
that stalled the queue. (The one structural need — publishing scaffolded items so lanes can claim them — routes
through a gated lane→PR, #2215, never a direct push.)

### Constellation placement {#constellation-placement}

**The test — where does a thing live (WE / Frontier UI / Plateau)?**
1. Code that **defines a contract** (types, protocol, conformance vectors) **or is consumed by a
   WE-side conformance gate** (`check.ts`) → **Web Everything**. Code that **delivers a capability
   at runtime** (registry-dispatching, artifact-producing, a running handler — incl. `assert*`,
   constants, engines, native-default strategies) → **Frontier UI**. A served, credential-holding
   product → **Plateau**. **WE holds zero implementation — contract / protocol / interface only.** WE
   never hosts delivery runtime, not even as a "reference implementation." The former
   reference-implementation tier (a WE-repo reference runtime kept so WE conformance demos had something
   real to run) is **withdrawn** — it conflated the WE *website* with the WE *project*. A conformance
   demo is a **website** artifact: the WE-docs site is a downstream *consumer* that **surfaces FUI**
   (mode-C runtime bundle / `fuiDemo` iframe — [we-fui-embed-boundary](#we-fui-embed-boundary) rule 6),
   so it exercises **FUI's** runtime, never a WE-project copy. Delivery runtime
   (`fui:webpolicy/enforcement.ts`, block engines, parser/proof logic, …) is **FUI-canonical**; the WE
   project keeps the **contract + conformance vectors (data)** only. The `@webeverything` *package*
   stays types-only (rule 3); the source arrow is WE→FUI, never inverts. **The one runtime-ish thing
   that stays WE is conformance *tooling* a WE-side `check.ts` gate consumes** (e.g.
   `we:capability-manifest/check.ts` + its `assert*`) — it *checks* conformance, it does not *deliver* a
   capability, so it is interface/conformance, not implementation. **(#1566 bounds this: the carve-out
   covers tooling that checks WE's *own declarative artifacts* — manifests, golden-corpus
   completeness/schema-validity. A verifier that judges a running *implementation's* output is executable
   + neutral → Plateau, not WE; see [devtools-placement](#devtools-placement). **#1771 sharpens the
   bound:** a *generator that runs an implementation* over WE's own artifacts — e.g. a renderer that
   lowers `<component>` to emit committed source data — is itself implementation → FUI, even though its
   input is WE's own corpus. The carve-out is for declarative *checks* (schema-validity, completeness),
   never for *executing the impl* to produce data; that the impl runs at build time, in-repo, and is
   drift-tested does not make it tooling. The generated data stays WE only if WE no longer runs the
   generator — FUI runs its own transform and either commits the data or WE consumes it across the seam
   as data.)** **Interim state (honest):** a set of
   WE-resident logic reference runtimes predate this rule and **violated** it — the ~10 subsystems #1078
   covered. **webpolicy is the first fully relocated** (#1294 cascade W1–W4: engine → `fui:webpolicy/`
   #1799, binding + WE vector corpus #1800, plateau-hosted conformance docs surface #1801, WE runtime
   deleted #1802) — both gates that held the move are now cleared: a FUI home exists, and the WE-website
   conformance demo surfaces FUI *headless* logic through the **plateau-hosted conformance iframe** (the
   #899 vector-runner, built #1790/#1801, drives the WE vectors against the FUI binding cross-origin).
   **webcompliance (#1815) and webtheme (#1294 T5 #1910: runtime → `fui:webtheme/`, WE-side consumers —
   the reproduction-parity harness + the docs/CEM component-token resolver — repointed to the
   `@frontierui/webtheme` dev-time alias) have since reached the same #1282 end-state.** The
   **remaining subsystems** stay put **as tracked relocation debt** under this rule (the non-engine ones
   gated on the deferred conformance-model decision #1784), **not** a sanctioned standing tier — and
   crucially **no _new_ WE-resident delivery runtime may be added.** Relocation tracked by #1294; the rule
   is #1282. **#2006 extends this debt list to the WE *website*:** the 11ty+Vite render (`we:.eleventy.js`,
   `we:vite.config.mts`, `we:src/*.njk`, `we:src/_data/*.js` loaders, `we:src/_includes/*-descriptions/`,
   `we:src/assets/`) is artifact-producing delivery = a **mis-homed product**, not standard — ratified
   end-state is extraction to a product-tier surface (own repo / package, e.g. `webeverything-docs`)
   consuming the published standard as FUI does, **gated on #872**. **Interim classifier (#2006 Fork 2b):**
   the website files lift under a `site/**` root while the standard `.json` defs + shared assembler-loader
   seam (`we:scripts/lib/*`) stay classified in place, enforced by a **fail-closed `check:standards` rule**
   — every tracked path classifies as exactly one of {standard-surface, site-surface}; an unclassified path
   is a hard error, so new site code can never masquerade as standard. The conformance gate/tooling
   (`we:capability-manifest/check.ts`) is **not** part of the website and stays WE regardless.
   **#2053 bounds the #2006 website extension to the WE repo:** a reference-implementation library's
   self-showcase docs-site (FUI's Eleventy render, `fui:src/` + `fui:.eleventy.js`) is render-not-product
   and **co-locates in FUI** — artifact-producing code is what this rule routes *to* FUI, and the
   [product-frontend](#identity-semantic-look-composable) "WE website" product example does not reach it (the site
   composes no product) — provided the site surface stays cleanly separated from the library dirs;
   extraction re-opens only if the site grows genuine independent product features (#2053's reserved
   trigger, incl. a real abstract-framework/concrete-design-system repo split).
2. **The file seam is the cut:** `contract.ts` (pure types, compile-erased) → WE; `provider.ts` +
   `registry.ts` (runtime) → FUI. Split mixed modules *mid-file* at this seam.
3. **Distribution end-state:** FUI consumes WE contracts via a WE-published type-only package
   (`@webeverything/contracts`, one entry per subsystem); byte-replication is the interim. The
   contract crosses the seam; code never does. `@webeverything` = standard artifacts only, never
   imports FUI.
4. **Managed offerings decompose** across the constellation — there is no single "home" decision:
   standard→WE, primitives/adapters→FUI, served product→Plateau, open-core by usage.
5. **An impl/substrate is not a standard** (e.g. a native `base-select`): it registers as a
   `capabilityMatrix` resolver impl, not a new protocol; the work it implies is a deferred build.
6. **Relocating the runtime does not retire the WE project that owns the contract.** When a
   standard/impl split moves a subsystem's *runtime* to FUI (the #606 move), the WE project
   *survives* on its contract surface (spec page + interface defs + conformance) — you reconcile its
   status drift, you do not delete it. A project whose surface ships as **spec + data defs** (not a
   `relatedProject`-tagged resolved item) can read as `concept` despite being live; bump it **off**
   `concept` (`poc` is the convention — project `status` is not enum-validated; the `LIFECYCLE` set
   governs *descriptors*, not projects). *Retire* is only on the table if WE owns **no** contract
   surface distinct from the moved runtime.
7. **The public compat table lists every impl as a peer — no privileged/reference column.** The
   `capabilityMatrix` catalog (capability-row × impl-column, rendered publicly) broadens from native
   substrates to incumbent libraries (Floating UI, Mousetrap, TanStack, FUI, …); **FUI is one column
   like any other**, its strength *earned and visible* (greenest column), never status-declared. No
   "reference / recommended impl" column — that reintroduces the single-lib perception the table
   exists to dispel and conflicts with minimize-lock-in. An adoption pointer, if wanted, lives in
   clearly-editorial getting-started prose, not the neutrality grid (matches BCD / caniuse /
   wpt.fyi / OpenFeature). Ruling #1450.

8. **Relocate at the granularity of dependency-readiness; a relocated module never reaches back.**
   {#relocation-granularity} When moving impl WE→FUI, relocate every piece whose cross-family deps are
   *already FUI-satisfiable now*, and defer **only** the pieces whose deps are *not yet FUI-resident* —
   as an explicit `blockedBy` slice on the dep's own relocation, never as "keep it WE-resident for now".
   Keeping a piece in WE "until later" leaves a **live WE-resident value-import**, so the relocation
   resolves *without* clearing the downstream blocker it was supposed to clear (a false unblock). A
   relocated FUI module satisfies a lagging dep by **(a)** using FUI's own equivalent (e.g. its canonical
   renderer/util), **(b)** inlining a small pure util, or **(c)** deferring that one feature — **never**
   by importing back into WE (a FUI→WE backward edge, the same ban as the runtime boundary). Pre-flight
   the *full* import graph before scoping: the "only dep is X" claim from a partial read is a hypothesis,
   not a plan. #1777 (upgrader family: `serve()` deferred to #1730 via #1781; `jsxToHtml` rewired to FUI's
   own via a browser-safe subpath; `compareSpecVersions` inlined — all kernel pins removed, clearing #1775).

*Soft sub-rule — locus tagging:* backlog items carry an explicit `locus:` field (WE / frontierui /
plateau-app / exercise-app); items gate in their own locus so cross-repo batches stay locus-agnostic.

**Lineage:** #730 #817 (the per-file define-vs-deliver holding) · #606 (plugs runtime → FUI) ·
#1248 (relocating the runtime does not retire the contract-owning project — `webplugs` survives #606) ·
#641 (block-protocol impl boundary) · #779 #426 #799 #497 #834 · #804 #872 #239 (contract package) ·
#091 (managed-offering decomposition) · #020→#291 (impl-is-not-a-standard) · #1078 (introduced a
WE-resident reference-implementation tier — **superseded by #1282**: conflated WE-website with
WE-project; WE holds zero implementation) · #1246 (blocks → FUI, reverses #697) · #1282 (**withdraws
the reference-implementation tier wholesale** — webpolicy + all delivery runtimes → FUI; WE = contract +
vectors only; demos are a *website* concern that surfaces FUI) · #1771 (**sharpens the #1566 carve-out
bound** — a generator that *runs* an impl over WE's own artifacts is impl → FUI, not tooling; resolves the
MaaS serve-core seam as a forced mapping, reversing #954's "WE runs `serve()`", unblocking #1730) ·
#1777 (**relocation granularity** — relocate deps-satisfiable-now, defer not-yet-FUI deps as `blockedBy`
slices, never reach back into WE; see [relocation granularity](#relocation-granularity)).

### WE ↔ Frontier UI rendering & embed boundary {#we-fui-embed-boundary}

**WE never imports or renders FUI block code.** FUI owns the implementation *and* its rendered
display (its own site + demos, FUI branding).
1. **iframe-only:** WE embeds FUI-hosted demos via the `fuiDemo` iframe convention — no
   `frontierui` Vite alias, `@frontierui/*` never in WE `node_modules`. Cross-repo *import* is ruled
   out.
2. **Narrow relaxation (sanctioned, gated):** a future trust-gated, WE-FUI-only, runtime-SDK,
   Shadow-DOM-isolated **mode C** is allowed; it does not puncture impl ownership (FUI still
   renders) — only the iframe *mechanism* requirement relaxes. iframe stays the default.
3. **Escape/overlay** (modals breaking the iframe box) is host-side over an origin-validated
   `postMessage` channel via a **FUI-owned embed SDK**; seed transport is URL-canonical + additive.
4. **No block runtime in WE (#1246, reverses #697):** **every** block's runtime is FUI-canonical —
   *none* stays in WE, not even one whose demo exercises a WE standard. (This is the rendered-UI
   instance of the general rule in [constellation-placement](#constellation-placement) rule 1 — *WE
   holds zero implementation*, #1282.) Its demo is
   **FUI-hosted and iframe-embedded** (or consumed as a mode-C runtime URL-bundle per rule 6); WE owns
   only the block **protocol + conformance vectors** (#817/#899, data not impl). The former "stays in
   WE *iff* it is the standard's reference runtime" partition is **withdrawn** — the headline above
   ("WE never imports or renders FUI block code") now holds without exception.
5. **Chrome / workbench is FUI-owned**, decoupled from distribution; WE keeps only its
   standards-panel overlay.
6. **The WE *website* ≠ the WE *standard*.** The boundary constrains the *standard artifacts* and
   the *`webeverything` package* (no FUI **source** dependency; unidirectional WE→FUI) — **not** the
   WE-docs *website*, which is a downstream product/consumer free to render FUI **and** to run WE
   standard runtimes (e.g. booting the webbehaviors `CustomAttributeRegistry` in a mode-C shadow
   mount), exactly like any app. The test is **source-dependency direction, not runtime execution or
   rendered pixels**: a consumer page running FUI impl + a WE standard together is the dogfood, not a
   crossing. The one guard — the site consumes FUI by **runtime URL bundle** (mode C), *never* a
   build-time `import '@frontierui'` into its build; that import would invert the direction (#700/#239)
   and is the only thing that actually violates the boundary. So "does running a WE runtime in-document
   cross the boundary?" is answered *no* by construction — don't re-open it.
7. **Mount-model selection (#1621):** within a consumer page (rule 6), pick the mount by the component's
   nature, not one-size-fits-all. **Heavy / interactive / trusted** embeds → **mode-C** (one shadow root +
   one dynamic `import()` per mount point, `fui:embed/in-document.ts`) — e.g. the #865 chrome shell.
   **Many-small, behavior-free, server-rendered** components (a board of hundreds of pills) → the FUI
   **transient custom element** (`registerBadge()`-style, §7.7 of block-standard.md): register the element
   **once** via a runtime cross-origin import from the FUI origin, emit `<we-*>` server-side, let each
   upgrade in place (light-DOM, no shadow root, no per-instance import); inject the block's exported CSS
   (`BADGE_CSS`-style) globally and ship a `we-*{}` SSR baseline to kill the upgrade flash (the #865
   baseline pattern). Per-instance mode-C for many-small pills is **rejected** (N shadow roots + N imports
   per page). Cross-surface categorical styling resolves through design tokens + the taxonomy provider
   (#1670), never per-component palettes. **Applied (#1748):** the *published* WE-docs backlog-pill board
   loads this way — a FUI-served `fui:embed/badges-in-document.ts` entry registered via a second
   cross-origin `import(...)` in `we:src/_layouts/base.njk` (alongside the #865 chrome import at :418) +
   the `we-*{}` SSR baseline. Confirms there is **no #872/#907 publish gate** for this: the docs consume
   FUI by the already-live `links.frontierUrl` origin (URL bundle), not an npm package. Bundling the FUI
   package into the docs build was rejected as the lone rule-6 violation. Build: #1758.

**Lineage:** #604 #701 #707 (iframe boundary; "WE renders real FUI blocks" is mis-framed) · #700 ·
#1621 (rule 7 — mount-model selection: transient CE + cross-origin import for many-small server-rendered, mode-C for heavy/interactive) ·
#1748 (rule-7 applied to the published WE-docs pill board: cross-origin import from `links.frontierUrl`, no publish gate; build #1758) ·
#1246 (withdraws the rule-4 reference-vs-impl partition + reverses #697: no block runtime stays in WE) ·
#1282 (general rule — WE holds zero implementation; demos are a website concern that surfaces FUI) ·
#705 · #732 (escape SDK) · #765 (mode-C relaxation) · #788 (seed transport) · #791 (reference-vs-impl
partition) · #809 (workbench locus) · #932 (website≠standard; consumer may run WE runtimes in-document).

### SSR external I/O is a language-agnostic WE standard; renderers conform behind the wire-format seam {#ssr-external-io-standard-renderers-conform}

**A rendering surface's *externally-observable I/O* is a WE standard; the *renderer* that produces it is a
conforming, swappable impl.** The instance of [WE #6](#constellation-placement) for server-render/SSR
(#2030, under #1971/#2005). Split every rendering decision by one test — *can anything outside the render
boundary observe the difference?*

1. **Observable ⇒ WE standard.** The emitted wire format (marker grammar, `data-key`, state-token layout),
   the zero-JS baseline, and the client hydration handshake are pinned in the WE standard
   (`we:src/_includes/project-webdirectives.njk`) **precisely enough that a renderer in any language
   produces conformant output the single client hydrates identically.** New observable I/O is codified into
   WE, never settled per-impl.
2. **The wire format is the swap seam.** One client hydrates *any* server's output because all servers
   emit the identical standard. A Go/Rust/PHP/JS renderer is a drop-in behind the same client — there is no
   per-language client.
3. **Conformance vectors are WE-owned data, not impl** (the `#817/#899` protocol-plus-vectors pattern): a
   fixture set `(input tree + data) → exact expected HTML bytes` (markers incl. space-padding, `data-key`,
   state tokens). **Every** language's renderer passes the same vectors; that — not code reuse — is what
   makes renderers interchangeable. A **reference renderer** (Node first) defines the vectors and is their
   oracle; later languages validate against them.
4. **Render internals are a per-impl black box.** How a given server builds the tree before emitting the
   fixed wire format (DOM shim, string concat, template engine) has no external observer — each impl (and
   each language) may choose differently and swap later behind the seam; only the emitted bytes are fixed.
   A JS-only trick (e.g. reusing the client's DOM stamp logic via a server DOM shim) is a legitimate
   *reference-impl* choice but confers no cross-language rule.
5. **Per-impl ≠ standard change.** Escalating an internal encoding to something observable (e.g. moving
   state from in-marker tokens to a `<script type="application/json">` side-channel) is a *standard*
   amendment (+ vector update), not a silent per-impl move.

**Lineage:** #2030 (foundational call — the five prepped "forks" collapse: four are conforming black-box
impl, the external I/O is the standard) · #1971/#2005 (webdirectives SSR epic + foundational surface) ·
#817/#899 (protocol-plus-vectors, data-not-impl) · #1282 ([WE holds zero implementation](#constellation-placement)).

### Catalog tiles adopt `<we-card>`/`<we-badge>`/`<we-tag>` by-intent; relocate the anchor outward {#catalog-tile-by-intent-mapping}

**A docs catalog tile maps to FUI block vocabulary by-intent — never a bespoke palette wrapped in a
cosmetic card shell.** This is the card-frame instance of [we-fui-embed-boundary](#we-fui-embed-boundary)
rule 7 + the #1621 badge/chip ruling: a tile's status pill → `<we-badge>` (the #1319 Status-Indicator
intent), its dimension/type chips → `<we-tag>` (the Tag intent), and the tile frame → `<we-card>` — all
server-emitted `<we-*>`, upgrading in place. A frame-only "shallow wrap" that leaves the bespoke
badge/chip vocabulary inside is **rejected**: it re-introduces the docs-palette-on-a-shared-component
conflation #1621 retired, and buys nothing — see the anchor mechanic below.

**The anchor-relocation mechanic.** `<we-card>` resolves to a non-linkable `<article>` and
`replaceChildren`-es the original node (`fui:blocks/card/CardElement.ts`, `excludedAttributes =
['title','heading-level']`). So when the tile **is** a single click-through `<a>` (the `we:src/intents.njk`
/ `we:src/blocks.njk` pattern: `class` + `data-status` + `data-haystack`/`data-search` + `href` on one
element, queried directly by the per-page filter IIFE), preserving click-through requires **relocating**
the `<a>` + filter `data-*` + tile class to an *outer* anchor wrapping the `<we-card>`; the filter JS then
queries that outer anchor. This relocation is unavoidable **even for a frame-only swap**, which is why the
shallow wrap is strictly dominated (same relocation cost, zero intent dogfood, statute violation). The
filter mechanism stays attribute-driven off `data-*` — it never reads a card model.

**Non-anchor surfaces carve out.** Structurally-distinct catalog surfaces get their own by-intent rulings,
not this one: `we:src/design-systems.njk`'s non-anchor `<div>` tiles (no click-through, no relocation) and
the `.status-meter` *bar* macro (`we:src/_includes/project-status.njk`, a status-bar not a pill). Folding
them into one "tile→card" rule re-merges surfaces #1319 split.

**Lineage:** #1820 (this ruling) · #1621 (`<we-badge>`/`<we-tag>` map-by-intent precedent) · #1319 (the
status/tag vocabulary split into owning intents) · #1786 (`<we-card>` embed wiring) · unblocks #1607 (the
three core catalog pages) + #1608 (the 14 `project-*.njk` includes).

### Dev-tool placement: the consumer test {#devtools-placement}

**Where does a dev/test tool live across the constellation?** A user ruling — *dev-tools belong in
Plateau, not FUI* — does **not** mean "move every tool." It **refines** [constellation-placement](#constellation-placement)
into **one positive test**, the *consumer* of the surface (the same axis as
[conformance-verifier-vs-subject](#we-fui-embed-boundary) / #1467):

> **A developer-operated surface a human runs — to inspect / switch / explore / configure an
> implementation, against your OWN build — is a developer *product* → Plateau.**

The other buckets:

1. **Conformance — split by *what runs* (amended 2026-06-22, #1566).** The earlier "reads output as
   DATA → stays WE (a verifier implements no standard)" reading is **overturned**: judging is
   executable, and WE holds **zero executable** (#1282). Split three ways:
   - **The conformance *contract* — the verifier *interface*, the vector/golden **corpus**, and the
     golden/vector **schema** (declarative data) → stays WE.** The standard owns the *definition* of
     conformance — the WPT/Test262 expected-files archetype. Per #1467/#817 and rule 1 of
     [constellation-placement](#constellation-placement).
   - **The verifier *implementation* (the code that judges a running implementation's output) and the
     conformance *run* → Plateau** (#1566). **Neutrality** — the reason the verifier cannot live in FUI
     (the contestant) — is preserved by **Plateau** (a non-implementer product layer; the home of the
     #427 conformance dashboard / #1577 explorer product), not by WE. The implementation under test is
     reached through a per-target **binding** its owner ships (FUI is one target among many).
   - **Carve-out (unchanged):** conformance tooling a WE-side `check.ts` gate consumes to check **WE's
     own declarative artifacts** (e.g. `we:capability-manifest/check.ts` + `assert*` over the manifest;
     golden-corpus completeness/schema-validity) **stays WE** — it checks WE-owned *data*, needs no
     external implementation, delivers no capability. #1566 moves only the verifier of an
     *implementation's runtime output*, which WE cannot run once the impl is deleted.
   - **Load-bearing constraint:** the conformance *rules* must be expressible declaratively in WE (the
     interface + schema) so Plateau's verifier is a faithful *interpreter*, not the *author* of "what
     conformance means."
2. **Build-time implementation transform / reference-impl generator** (codegen, CSS lowering, bundler
   plugins, serve-time impl) → **stays FUI.** Per impl-is-not-a-standard (#020/#291).
3. **Operator-facing surface run against your own build** (workbench chrome¹, spec/dev-panel,
   autonomous-explorer CLI chrome, configurators, dev-browser, mock-server) → **Plateau.**

**Two carve-outs the blanket reading gets wrong** (both ratified under #1565):

- ¹ **The block-explorer / workbench stays FUI** — it is *impl, not a tool*. It ships as an embeddable
  `<iframe>` distribution showing *how FUI is consumed* on third-party / customer sites (chrome + block
  intra-frame, **no postMessage protocol**). Routing it through Plateau re-introduces the cross-origin
  boundary [#809](#we-fui-embed-boundary) (rule 5) dissolved — same-origin only holds *on plateau.app*.
  The distinguishing **third-party-embed test**: *ships embedded on customer sites = FUI distribution;
  runs against your own build = Plateau dev-tool.*
- **A conformance ENGINE splits into contract / impl / binding / product (amended 2026-06-22, #1566).**
  The generic vector-runner + trace-judge **interface** + the vector corpus is the standard's
  implementer-agnostic **contract → WE** (it must define how *any* WE implementer is tested). The runner +
  judge **implementation** (the executable engine) → **Plateau** (#1566 — neutral, non-implementer; the
  home of the #427 dashboard / #1577 explorer product). The per-target **binding** that drives a concrete
  implementation is the **subject adapter → the implementer** (FUI ships its own; a customer ships theirs).
  Layer-3 vision → Plateau ([#475](#no-leakage-client)). This **re-points #1565's** autonomous-explorer
  split: engine **interface** → WE, engine **impl** + product CLI chrome → Plateau (#1576/#1577), bindings →
  each implementer. Distinct from [reproduction-conformance](#reproduction-conformance)'s *deterministic-diff*
  engine (#1225), which is FUI (it diffs FUI's own reproductions, not a cross-implementer conformance suite).
- **The autonomous explorer is a closed Plateau PRODUCT — engine included (amended 2026-06-24, #1747).** The
  explorer (the autonomous browser-driving *tester*: `playwrightDriver`, heuristic oracles incl.
  `genericInvariants`, harnesses, `stateFlowGraph`, `gate`, CLI, report-bundling) is **not** the standard's
  verifier and **not** the reference impl — it is an operator-facing surface you run against your own build
  (rule 3), and being generic (it tests *any* app) makes it product value, not adoption bait. So the **whole
  tool → Plateau, closed-source** (#1577; free/paid on the assembler model #775; open-sourcing later is
  Plateau's option). This corrects the earlier "engine stays FUI / only chrome moves" reading: FUI does **not
  consume** the explorer (it imports zero explorer code — it is only a browser *subject* the tool points at),
  so nothing forces the engine to stay FUI. **WE keeps exactly one artifact: the explorer result/output-format
  interchange schema** (#1769 — SARIF-compatible core + extension slot, per #1467; temporal rule met by
  convergent prior art — SARIF / axe / Lighthouse) so other tools and CI can consume explorer output without
  depending on the closed product. A *different* engine from the conformance engine above — the #1747 finding.

**Embed mechanism *inside* a Plateau dev-tool (#1654).** Once a tool is placed in Plateau, how it mounts
its *own* surfaces is a trust/origin question, not an iframe-by-default one. A Plateau dev-tool's chrome and
its own same-bundle, same-origin trusted panels (e.g. the **dev-browser shell** mounting plateau-app's
Technical/Intent Configurator + Profiles via `mount*(el)`) use a **direct in-process import** — an iframe
there is pure tax *and* would forbid the DevTools-style docked-chrome control that is the point of the tool.
iframe + origin-validated `postMessage` (the [we-fui-embed-boundary](#we-fui-embed-boundary) bus) is reserved
for genuinely **cross-origin / untrusted** surfaces. The **app under test** the dev-browser loads is *not*
such a web iframe: per [#141](../../backlog/141/) the dev-browser is a **Chromium/extension** shell, so the
loaded app is a real privileged page introspected via the source-awareness substrate (#562) + live-patch
(#410) — a privileged-introspection boundary, not a `fui-embed` channel.

**The "every developer tool → Plateau" reading is *mostly* right, with one WE residual:** the conformance
**contract** — the verifier *interface* + the vector/golden corpus + schema (declarative data) — stays in
the standard layer (#1467/#817, [constellation-placement](#constellation-placement) rule 1). What moves to
Plateau is the verifier **implementation** + the **run** (#1566); what stays FUI is the per-target
**binding**. The only thing the blanket reading still gets wrong is dragging the *contract/vectors* out of WE.

**Lineage:** #1565 (ratified 2026-06-22; research topic `/research/devtool-placement-constellation/`);
**amended by #1566** (ratified 2026-06-22) — verifier *implementation* + conformance *run* move WE→Plateau;
WE keeps the declarative *contract* (interface + vectors + schema) only; this overturns the prior "verifier
stays WE" carve-out and re-points the engine split above. Composes
[constellation-placement](#constellation-placement), [we-fui-embed-boundary](#we-fui-embed-boundary)
(#809), [no-leakage-client](#no-leakage-client) (#475), [reproduction-conformance](#reproduction-conformance)
(#1225), and `project_conformance_verifier_vs_subject` (#1467, amended). Unblocks #1553.
**Refined by #1654** (ratified 2026-06-23) — the embed-mechanism rule above: a Plateau dev-tool's own
same-bundle trusted panels mount by direct import; the dev-browser's loaded app is a privileged-introspection
boundary (#141/#562/#410), not a web iframe. Unblocks the #1391 `S5` panel-embed slice.

### Non-verdict conformance compares by a closed matcher vocabulary {#non-verdict-conformance-matcher}

**A relocated runtime whose conformance output is *not* a verdict does not get a new conformance model — it classifies onto one of the two suite shapes WE already ships and picks a comparison matcher.** The two shapes: the interaction-script `ConformanceVectorSuite` (`we:conformance-vectors/schema.ts`) for provider/behavioral surfaces, and the Doc-Spec golden suite (#1163, `we:conformance-vectors/webdocs.vectors.ts`) for pure `(input)→output` transforms. The comparison is a **closed four-member matcher set**, carried as a per-`expect`-key tag in the WE schema and interpreted by the Plateau judge:

1. **`exact`** — strict `===` (today's default; scalars, e.g. webcompliance `violationCount`).
2. **`deep-equal`** — structural equality (object returns: webtheme's resolved token map, reliability `RecoveryResult`).
3. **`resolved-options/parts-structure`** — assert `resolvedOptions()` + `formatToParts` part types/order, whitespace/separator classes as equivalence classes (intl `Number`/`DateTime`/`RelativeTime` — never raw strings, which drift with host ICU/CLDR).
4. **`predicate`** — a boolean over the observed surface: contains / subset / count / absence / sign-order (analytics' `void`-returning recorded-call log; `Intl.Collator`, which has no `formatToParts` — assert `compare()` sign + sort order).

The set is closed and exhaustive over what these runtimes emit; widening it is a fork to re-open, not a default. **Placement** (composes [constellation-placement](#constellation-placement), [we-fui-embed-boundary](#we-fui-embed-boundary)): the contract + vector/golden corpus + the `matcher` vocabulary stay **WE**; the per-key matcher **dispatch** in the judge is **Plateau** (`plateau:src/conformance-engine/conformanceVectors.ts`, today hardcoded strict `!==` — the seam does not yet exist); the per-target binding is the **FUI** subject. No new WE→FUI code edge; #1282 (WE holds zero executable) holds. **What this is NOT:** not strict-equality-only (false-negatives for intl and all object returns), not per-shape binding judges (driver proliferation — a matcher is a comparison *tag*, not a new driver).

**Lineage:** #1816 (ratified 2026-06-27; research `/research/non-verdict-conformance-model/`, report `we:reports/2026-06-27-non-verdict-conformance-model.md`; parent #1294). Two-pass red-team widened the set from three to four (`predicate` added for analytics + collator) and pinned webtheme's subject to the `resolveTokens` map, not `compileToCss` text. Complements #1784 (facts→verdict KIT) · grounds #899/#1789 (vector model + binding) · #1163 (golden precedent) · #404 (webtheme) · #1282 (zero-executable). Build mechanism: #1847.

### Is it a Project / Protocol — or just an intent? {#project-protocol-bar}

**Not every gap is a Project or a Protocol.**
1. Mint a **Protocol** only when independent vendors must conform to one contract — i.e. there is a
   real **provider seam** *or* an **interchange schema**. Otherwise it is an intent + block.
2. Mint a **Project** only for a genuine cross-cutting domain with orchestration. "Already homed in
   an existing project" is a valid resolution — do not spawn a project per homed gap.
3. **Temporal rule:** ship as a Block now; extract a Protocol only once a *second* independent impl
   exists and the contract has stabilised.
4. A paradigm with no provider seam and no UX dimensions is a **semantics term**, not a
   protocol/intent.

**Temporal-rule clarification — "a second independent impl" counts _external convergent_ impls, not only WE-internal ones (#1437).** Rule 3 exists to avoid freezing an *unvalidated* contract; for an **interchange schema** (not a provider seam) that validation can come from **convergent prior art in the world**. When N≥2 independent incumbents already emit the same shape (dockview / FlexLayout / golden-layout all serialize a `row→column→stack-of-tabs` tree), the temporal rule's "second impl + stabilised contract" precondition is **already met** — mint the **core schema now + an open extension slot** for the parts that still diverge (don't wait for WE itself to ship two impls). The deck case (#1175) is the contrast that proves the rule: it got "no protocol" precisely because it had **no** convergent external interchange schema. Caught when a decision-turn flip to "protocol-later" mis-read the rule as requiring WE-internal impls; the skeptic refuted it.

**Lineage:** #015 #016 #011 #014 #409 #616 #634 · #041 (protocol-extraction timing) · #258
(paradigm → semantics) · #020→#291 · #1175 (deck placement: a deck is composition, not a domain —
no `webdecks` project; novel surface is a *cross-media advanceable-sequence* family homed in webintents,
shared with video/carousel; rule 2 + temporal rule 3 applied) · #1437 (temporal rule counts external convergent
impls; `dockable` layout-tree minted core-schema-now + extension-slot).

### Portfolio project tiering — the named-consumer evidence bar {#portfolio-project-tiering}

**Every project carries a `tier` — an importance axis orthogonal to the `status` maturity axis —
assigned by the named-consumer evidence bar, never by vibe or proxy metric.** Website-app /
portfolio-governance turf (no standards-layer entity is shaped). The three tiers are **ordered
evidence classes** (both-qualify → the higher wins):

1. **`core`** — a benchmark design system or major framework demonstrably depends on the domain:
   the capability appears in the gap-analysis corpus (`we:src/_data/benchmarkCoverage.json`) or a
   named framework ships the equivalent surface. Stated asymmetry: the benchmark corpus is
   component-shaped, so `utility`-category projects reach core only via the named-framework clause.
2. **`contextual`** — a *named* constellation consumer's build/runtime uses the project's surface,
   **shipped and functional today** (Frontier UI, plateau-app, an exercise app, the WE site's own
   chrome). Catalog listing never qualifies (the site renders all 45 — it would empty tier 3);
   planned/aspirational dogfooding never qualifies (#777).
3. **`exploratory`** — no named consumer yet; a hypothesis about a missing standard. Deliberately
   an evidence-state word (the W3C strategy-funnel stage name), **not** scheduling vocabulary like
   "deferred" — a merit partition, not a prioritization.

**Mechanism:** an explicit, enum-validated `tier` field on each `we:src/_data/projects/<id>.json`,
plus a required non-empty `tierEvidence` one-liner *naming the consumer* on every non-exploratory
project — the falsifiability hook (a challenge is "that consumer doesn't depend on this", never "I
feel differently"). Deriving the tier from data is rejected on merit: the bar is a judgment over
heterogeneous evidence no dataset holds (Baseline derives only because browser support is one
homogeneous dataset).

**Surfacing:** in-place — the tier renders as a `we-tag` cue per
[#catalog-tile-by-intent-mapping](#catalog-tile-by-intent-mapping) (classification → Tag intent;
`we-badge` stays the *status* pill), grids group core → contextual → exploratory (an SSR default,
client re-sortable), and exploratory stays on the main catalog, never hidden or segregated.

**Invariants:** tier and status render side by side (orthogonal — a `core`+`concept` project still
demotes dependent builds via the D3-readiness rule, which keys off *status*); a tier is
re-assignable only through a review turn against the same bar with a rewritten `tierEvidence`,
never a silent free edit; a tier never gates what a consumer may use (mandate-nothing) — it directs
investment and narrative only; intents carry no tier of their own (per-project stamping surface only).

**Lineage:** #2088 (this ruling; forks + skeptic passes in the item) · filed by the 2026-07-01
external consultant review (program #2090) · research topic `portfolio-project-tiering` ·
[#project-protocol-bar](#project-protocol-bar) is upstream (what earns a Project at all) ·
`we:docs/agent/platform-decisions.md` placement-test rule (project `status` outside `LIFECYCLE`)
scopes the *status* axis and is untouched — the status-vocabulary drift is a separate
statute-amendment decision.

### Intents are UX-only; technical strategy → Configurator {#intents-ux-only}

Intents describe desired interaction (what/why) at project level — dimensions, states, events,
per-level contracts only. They carry **no implementation refs** (no conformance tiers, DI, type
shapes, registries — those belong to the block). Technical strategies become a **Technical
Configurator** domain. Borrow official platform vocabulary (`aria-sort`, `Intl.Collator`), never
coin away from native terms. Intents are an **open, never-finished system**: custom non-standard
intents must coexist conflict-free — standardize the meta-schema, not the list. Defaults are the
**most permissive** value; restriction is the author's opt-in.

**Corollary — technical machinery splits off into a composed contract, and an upstream-bundled data
model does not force a monolithic one.** When a UX intent needs durable/technical machinery
(serialize/re-resolve/fuzzy/orphan, etc.), that machinery is its own contract the intent *composes*
(referenced, not owned) — the same seam an intent already uses for a native capability. A canonical
upstream model that bundles several concerns into one object (e.g. W3C Web Annotation's
`target`+`selector`+`body`) is a **serialization-vocabulary** fact, *orthogonal to the runtime
ownership seam*: adopt the wire format wholesale while still splitting which artifact owns the
machinery. #1408 (annotation = UX intent composing a separate durable-range-anchor contract; the
platform itself split quote-anchoring into `#:~:text=`). #2029 (the `suggestion` motivation's
accept/reject mutation transaction = a composed `suggested-edit` contract — annotation supplies the
proposal body, the Editor Engine protocol the apply, record-only over read-only hosts; "rich-text owns
it" was a classification collapse, since the rich-text intent is itself UX-only and its engine is
already a separate protocol).

**Converse guard — "technical strategy → Configurator" does *not* license a Configurator domain that
re-homes axes the config already carries.** When the technical axes already ride a `we:`-layer registry +
config-flavors (e.g. the credential-creation policy slots on `CustomCredentialProvider` + #483), minting a
`plateau:` Configurator domain over them is redundant cross-layer duplication, not the rule's intent. The
UX intent **references** those axes as constraints; it neither owns them nor justifies a second product-layer
home for them. The free *authorial* UX choices the ceremony leaves open (when to prompt, skippability, tone,
surface) are what the intent standardizes. #499 (credential-enrollment intent = the `create()`/enrollment
UX layer; technical creation axes stay on the #483 config, referenced not re-homed; the plateau Configurator
domain dissolved as redundant — re-judged on pure merit after a zero-consumer demand-gate "hold" was rejected).

**Lineage:** #030 (intent-vs-trait channel split) · #063 (native vocabulary) · #129 (guard intent
re-framed) · #499 (enrollment intent; converse-guard) · #634 · #1408 (durable-anchor contract split) ·
#2029 (suggested-edit contract split) · intents-open-design.

### Intent-conformance is compliance of a block against the intent contract — not a runtime gate {#intent-conformance-is-block-compliance}

An **intent is an interface; blocks (components/behaviors) implement it** — indirectly, via the
build-time resolver ([`we:webtraits/intentProfileResolver.ts`](../../webtraits/intentProfileResolver.ts)):
the intent never names a trait, the resolver maps the active profile → traits (keeps intents UX-only,
traits technical). An intent with no implementer does nothing, like an unimplemented interface. So
"**conformance** of an intent" means *does the implementing block satisfy the intent contract* — **not**
a runtime DOM watcher, and faking a tie is forbidden. It splits two ways:

- **Static / contract conformance** — does the block declare the required `intentDimension`s / bundle the
  required traits? Checkable in **WE at build time** (resolver / `we:webcases/requirementValidator.ts` shape).
- **Behavioral conformance** — does the *rendered* component behave per the intent? Needs a running
  subject: **contract → WE**, **runner/verifier → Plateau** (neutral, so *any* implementer consumes it —
  FUI is one subject, not the verifier's home), **subject → FUI**.

Never smuggle a conformance run into a *consumer* of traits (e.g. docs chrome) — that is silent
scope-expansion. The active intent profile is already present in the runtime DOM as `data-intent-*`
(plus element-level `action-intent` etc.), so *surfacing* an intent for inspection is a read-only,
near-zero-cost dev-tool, distinct from *checking* conformance.

**Lineage:** #947 (this semantic call) · #1566/#1576/#1597 (verifier→Plateau placement) · #934 (the
descope that triggered it) · #1657 (intent-inspector card) · [[project_conformance_verifier_vs_subject]].

### Monetization line *(soft — explicitly revisitable)* {#monetization}

> Tiering/pricing rulings get a **lighter, revisitable** treatment than standards. Fix the
> *structural partition principle* firmly; treat specific knob placements as provisional.

1. The paid line is a **structural property — per-call cost OR hosted/credential-holding — never a
   category** (never price on a shifting axis like proprietary-vs-open).
2. **Open-core:** the open standard + open reference impl are free; hosted/managed/collab is paid.
3. **Plateau linear-cost rule:** cost must scale ~linearly with revenue — no uncapped per-call SDK
   inside flat-rate pricing; prefer owned **on-device fixed-cost** capability; BYO-key is a tier,
   not the floor.
4. **Vision / AI is never a WE standard** → see [§ no-leakage client](#no-leakage-client).
5. **Dev-surface paid flagship (#1590):** the paid product is the **licensed local dev-browser
   (fixed-cost, JetBrains/Sublime model)**, not a SaaS — *recurring* server/support cost is the
   dominant solo-dev risk, so the on-device fixed-cost surface leads; SaaS is an optional *later* tier
   (its recurring cost is a liability, not a reason to lead). Extensions are the free funnel. **Build
   is decoupled from release timing**: pursue the product now, switch on paid release later.
   - **In-shell free/paid line (#1655, soft-accepted):** two **orthogonal** gates, not a
     per-capability map. **Gate 1 — commercial-use license:** the *whole local browser* (every
     local fixed-cost feature) is free for **non-commercial / individual / OSS / learning** use,
     paid for **commercial** use — a use-context license, not a feature split (no Community/Pro
     local subset: fixed-cost features give no structural hook to split). **Gate 2 — server-cost
     tier:** any capability that **requires a server to run** (hosted sync/collab/share-links,
     per-call AI) is **paid for everyone**, non-commercial included, as cost-recovery. Local
     persist/export/write-back (local repro export, fixtures, safe-edit→PR) stays **free** — only
     the *server-backed* variant is paid (faithful to #775's "deterministic+local = free; hosted =
     paid" line; the "persist/write = paid" read-vs-act framing over-reached).

**Lineage:** #098 #185 (licensing / GTM) · #089–#093 #086 (open-core constellation) · #182 #183
(licensing/payments) · #451 (MaaS tier) · #775 (assembler open-core) · #410 #141 #166 · #665 #690
(self-driven framing) · #1590 (dev-surface paid flagship = local fixed-cost browser; build
decoupled from release). *Confidence: principle firm; specific knobs provisional.*

### A separate product brand is earned by structural product-distinctness, not appetite {#brand-on-distinctness}

> A positioning sibling to [§ monetization](#monetization): *never brand on a shifting category*. A
> sub-component gets its **own marketed product brand only when it has a real standalone consumer
> surface** — not to *drive* the adoption that would *create* the case (the circular, appetite-based
> move the monetization rule forbids).

1. **Structural test:** a thing earns a separate brand when ≥1 consumer depends on it **without**
   depending on the parent product — the `ReactDOM`/`Rollup` case (shipped to millions directly), not
   the `@lit/reactive-element` case (a sub-package Lit does **not** separately market).
2. **Default is fold.** A sub-package identity under the constellation/Frontier-UI brand is the
   *cheapest* path to a later split — folding forecloses nothing; the npm scope + contracts already exist.
3. **webplugs ruling (#642):** `@frontierui/plugs` **folds** — no separate brand. Per #606 the plugs
   runtime is a POC with no standalone product surface and one consumer (plateau-app). **Un-park** only
   on the structural event: webplugs gains ≥1 external consumer that depends on it *without* depending on
   `@frontierui/blocks` / FUI components. Brand on that event, never on appetite.

**Lineage:** #606 (code home + brand deferral) · #775 (soft/revisitable monetization) · #642 (this
ruling). *Confidence: high — structural test + un-park trigger firm.*

### npm scope = one per audience/layer; product = package name; restricted-until-an-explicit-go {#npm-scope-audience-layer}

The constellation's npm scopes map to the **layer/audience**, and products within a layer are differentiated
by **package name**, never by minting a second scope. Six orgs are held (`@webeverything`, `@frontierui`,
`@frontier-ui`, `@plateaujs`, `@plateaudev`, `@plateauapp`); this rule fixes which go live and how they
publish. It extends the #855 npm-scope-mirrors-layer family under
[constellation-placement](#constellation-placement) (WE↔FUI half already there — this adds the Plateau half
and the access posture) and **composes** the [monetization statute](#monetization) (rule 5 #1590) and
[brand-on-distinctness](#brand-on-distinctness) rather than colliding with them. npm has **no scope rename**,
so every live scope is a permanent identity — the lock-in axis dominates and the *reversible* posture is the
default.

1. **Canonical FUI scope = `@frontierui`** (no hyphen); **`@frontier-ui` is a permanent defensive hold that
   publishes nothing**. The code already names 13 `@frontierui/*` packages and every statute citation uses
   the no-hyphen spelling — the published name equals what the ecosystem reads in code and docs. The
   "multiword scopes hyphenate" ecosystem norm is genuinely mixed (`@webcomponents`/`@vitejs` smash), so
   there is no platform norm to align to; the governing precedent is the constellation's own shipped
   spelling. (#1991's smash-not-hyphenate rule is HTML-attribute-scoped and is **not** the authority here.)
2. **One live Plateau scope = `@plateaujs`**; **`@plateauapp` and `@plateaudev` are defensive holds.** All
   Plateau npm packages ride `@plateaujs`, customer-facing products differentiated by **package name**; a
   never-npm-published internal package, if one ever is, rides the same scope as `--access restricted`. A
   second scope buys a *label*, not an enforcement boundary — npm access is **per-package**
   (`--access restricted`), not per-scope, and org-level separation (2FA, teams, granular/OIDC tokens) is
   achievable within one org. An audience-boundary scope split (`@plateaudev` = internal) is **rejected**:
   its name-level signal is hypothetical while its misclassification surface is structural (the
   `@angular-devkit` "dev ≠ internal" trap), and the lock-in asymmetry favors one scope (a wrong single
   scope moves a *restricted, dependent-less* package cheaply; a wrong second scope republishes a public
   package with external dependents). The `@plateaujs`-over-`@plateauapp` spelling is **ruled**: the
   project-scope precedent (`@vitejs`/`@vuejs` — a "js" scope names the *project* whose packages consumers
   install) fits a scope that distributes installables, while `@plateauapp` names the SaaS app, which is
   **deployed, never npm-published**. `@plateaudev` re-opens **only** on one of two named triggers: (i) a
   genuine publish-policy channel emerges (a `@lit-labs`-style experimental tier); or (ii) a
   [brand-on-distinctness](#brand-on-distinctness) structural earn — a sub-component gains ≥1 consumer that
   depends on it *without* the parent product. Never merely to hide internal packages — privacy is
   per-package access, not a scope.
3. **Access posture = restricted-until-an-explicit-go for impl/product scopes; public + provenance for the
   WE standard surface.** `@frontierui/*` and `@plateaujs/*` publish `--access restricted` (no provenance)
   until an explicit go; `@webeverything/*` publishes public + provenance (settled by #907 — a standard's
   adoption requires tokenless, provenance-attested install). Disclosure is a **one-way door** (npm's
   unpublish fencing protects dependents; re-restricting un-discloses nothing) while restricted → public is a
   one-flag flip, so the reversible value is the honest default. "**Go**" is a **per-package-set event, not
   one launch date** — the first external consumer who cannot reasonably hold a read token flips that set
   public (#2128's pilot channel is exactly such an event for the pilot-scoped FUI blocks/plugs). The rule
   is **total**: restricted is the standing default for every non-`@webeverything` package; a flip to public
   is always an explicit decision (a paid `@plateaujs` product simply never gets flipped without its own
   ruling). For `@plateaujs/*`, restricted **implements** the ruled monetization line (#1590 licensed local
   flagship — public npm code would contradict it); for `@frontierui/*` (open-core-committed end-state), the
   merit is reversibility + not freezing pre-1.0 surfaces into public dependents. **Provenance-gap rule:**
   restricted versions never gain provenance retroactively and `npm access public` exposes the *entire*
   restricted history at once — so each go event ships a fresh provenance-attested version and treats pre-go
   versions as unattested.

**Settled inputs (not part of the fork):** `@webeverything` carries **WE standard artifacts only**
(type-only distribution, never imports FUI — [constellation-placement](#constellation-placement) rule 3 +
#907's public+provenance mode); the WE **website** app never publishes to `@webeverything` (if ever
packaged, it takes a product-tier name — #2006). Defensive holds publish nothing, ever — the first package
into a hold converts it to a live scope, which only a ratified amendment here can do.

**Human-action contingency:** all defaults assume the same npm account owns all six orgs (anonymous probe
proves existence, not ownership). If a scope turns out not to be held by the owner, its slot falls back to
the nearest held spelling and this rule re-opens for that scope only.

**Lineage:** #2155 (ratified 2026-07-03 — Fork 1 (a) `@frontierui` canonical [skeptic SURVIVES vs the
hyphenate-norm attack]; Fork 2 (b) one scope `@plateaujs` [SURVIVES-WITH-AMENDMENT — **flips the item's
original two-scope bold**: the second-scope rationale rested on per-scope access npm lacks]; Fork 3 (a)
restricted-until-go [SURVIVES-WITH-AMENDMENT vs the config-dimension and launch-timing re-routes]; prep
`/research/npm-scope-audience-naming/`, session report `reports/2026-07-02-npm-scope-audience-naming.md`).
Extends #855 npm-scope-mirrors-layer under [constellation-placement](#constellation-placement); composes
[monetization](#monetization) (#1590 — Fork 3 restricted *implements* it) and
[brand-on-distinctness](#brand-on-distinctness) (Fork 2's second re-open trigger *is* the structural earn).
Edges: #907 (WE public+provenance, delegates the rest here) · #2128 (first Fork 3 "go" event) · #2157
(publish lag) · #2154 (OIDC trusted publishing). Unblocks naming the #2128 pilot set's packages.
*Confidence: high (Fork 1/3) / med-high (Fork 2 — the reversal); lock-in asymmetry carries the close call.*

### Plug distribution unit = one `@frontierui/plugs`, subpath exports — never per-plug packages {#plug-distribution-unit}

The plug **distribution unit is one `@frontierui/plugs` package** with per-domain subpath exports
(`@frontierui/plugs/<domain>`), **never one npm package per plug**. Consumers get minimal-*import*
granularity via subpaths + tree-shaking; they do **not** get independently-versioned per-plug packages.

1. **Why not per-plug:** three independent grounds. (a) *Currently impossible* — the domains have dense
   cross-domain imports reaching private files (`fui:plugs/webregistries/ScopedRegistryAttribute.ts:17` →
   `../webbehaviors/CustomAttribute`; `fui:plugs/webexpressions/CustomTextNode.ts:7` →
   `../webinjectors/InjectorRoot`), so no domain ships standalone without first severing those edges. (b)
   *Reintroduces a closed hazard* — N independently-versioned packages sharing runtime registries/contexts
   let a consumer pin `webbehaviors@2` against `webregistries@1` and break the seam at runtime: the exact
   cross-monorepo skew #1045/#1006 closed. (c) *Against the industry* — Radix/Chakra/React Aria all
   consolidated *away* from per-package granularity post-2024, citing this very pain.
2. **Minimal-install ≠ minimal-import.** Subpath exports already deliver minimal *import*. A future
   external `npm install` consumer (#872/#907) wanting smaller *install* gets it by adding a build step +
   `sideEffects: false` to the **one** package — not by splitting into N.
3. **The only sanctioned split is a `-labs` stability tier** (Lit's `@lit-labs/*` model): split a plug out
   *only* when its API is genuinely experimental — axis = **stability, never per-feature** — and only after
   a decoupling pass severs the cross-domain edges. Not a free escape hatch.

**Lineage:** #1837 (this ruling) *upholds* #1045 (single-package) + #1006 (exports-lock) + #606 (plugs
FUI-owned); reframes #1846 (W6) into a subpath-export conformance check. Grounded in
`/research/unplugged-plug-parity/` Survey 1. *Confidence: high — impossible-today + closed-hazard +
industry consolidation converge; red-team failed.*

### Vision / AI = a Plateau no-leakage service client {#no-leakage-client}

Any **implementation capability** (vision, AI model inference) is **never a WE standard**. It is a
**Plateau service** that the WE project consumes as a **no-leakage client** — only the *outputs*
reach the standard, never the capability. Interim thin client seams repoint to Plateau. Harvested
candidates promote only through the human-ratified `/new-standard` flow.

**Lineage:** #475 #488 (#488: on-device fixed-cost floor + BYO-key bridge) · #396 · #086 + #314
(exercise-app conformance loop as the forcing function).

### Vision capability tiers — the on-device-first cascade {#vision-tiers}

The vision service (a [no-leakage client](#no-leakage-client)) ships as **three layered tiers**, not
interchangeable models — pick by job, and let the cheap tier gate the expensive one:

1. **Tier 1 — verdict classifier** (≤10 MB, on-device, free at any volume, **benchmarkable/gateable**):
   the always-on triage/router. Reach for it when the work is high-volume, must run everywhere/offline,
   must be instant, or needs a deterministic gate. Closed label set, whole-screen only — no "why/where".
2. **Tier 2 — small VLM** (device-gated, an opt-in download in the dev browser): open-ended describe /
   localize / tag — the "what's wrong and where" a real review needs. Generative → no clean agreement
   metric, so it is **never** deterministically gated the way Tier 1 is.
3. **Hosted** — richest, but **per-call cost**, so never the free floor: a dev tool / BYO-key bridge /
   premium upgrade only (the [linear-cost rule](#monetization)).

**The cascade is the load-bearing rule:** Tier 1 runs on every frame and decides *whether it's even
worth* an expensive call; only escalated frames reach Tier 2 / hosted. That filter is what makes the
heavy tier affordable under flat pricing. **Deployment floor:** Tier 1 bundled, on by default (in-browser
via ONNX Runtime Web + WebGPU); Tier 2 an opt-in dev-browser download on capable devices only; hosted
BYO-key / premium, never on mobile. Every tier registers behind the one `registerVisionProvider` seam —
swapping a tier is a provider swap, not new plumbing. The design-critique rubric (#1034) is the service's
*output contract*, not a published `@webeverything` artifact, and rides the same seam.

**Still deferred (a later call, not a fork):** whether a Tier-2-class critique model is ever built
on-device vs. stays hosted — the architecture holds either way and the provider seam absorbs the choice.

### WE-compliance validation = a dev-browser lens, not a hosted SaaS {#compliance-validation-home}

WE-compliance validation (run the conformance vectors against a design system, get a report) lives as a
**dev-browser lens** ([#141](../../backlog/141-dev-browser-vision.md) Chromium/extension shell;
[#1636](../../backlog/1636-role-scoped-lenses-over-one-dev-browser.md) role-scoped lenses; Plateau-layer
per [constellation-placement](#constellation-placement) / #1565), **not** a hosted upload SaaS. We **just
analyse the page in front of us**: the conformance engine runs consumer-side (#891/#954), so the lens runs
WE vectors against the loaded subject *in the user's own browser* — no upload service, no server-side
execution, **no per-uploader credentials held by us** (any auth to reach the user's own page is the user's
own credential in their own password manager). It consumes WE vectors+runner as a
[no-leakage client](#no-leakage-client) (#475); standard + engine never leave WE (#855).

**Two distinct products — separate them:** (1) the **self-validation lens** above is the non-speculative
product and where compliance validation lives; (2) a **trusted third-party badge/attestation SaaS** (an
independent party vouches to the market) is a *different*, demand-gated product. A self-run lens can only
self-attest, so a trusted badge is not the same thing. **Only product (2) would ever need the
plateau-app-domain-vs-own-constellation-project granularity call** — revive it (and the structural
identity/credential test in #966) only if a hosted attestation product is actually demanded.

**Lineage:** #966 (this ruling) · #141/#1636/#1565 (dev-browser home) · #891/#954 (consumer-side engine) ·
#475 (no-leakage client) · #855 (standard/engine stay in WE). *Confidence: high — fits a settled surface,
reversible, trigger-armed.*

**Lineage:** #1033 (interactive design-review loop) #1034 (critique rubric) #490 (build epic) · #475
#488 (on-device fixed-cost floor) · #511/#512/#513 (Tier 1 tooling/training) #1073 (Tier 2 epic) #485
(hosted teacher bridge) #141 (dev-browser home) #514 (ONNX/WebGPU runtime). Promoted from
[vision-tiers.md](vision-tiers.md) per #1244. *Confidence: architecture firm; on-device-vs-hosted for
the rich tier provisional.*

### Trainable judge — portable corpus, Plateau-owned learning, advisory output {#trainable-judge}

The autonomous explorer's judge ([#1552](../../backlog/1552/)) is made **trainable** from human feedback
on real runs, without ever becoming a gate or leaking the capability. Four rulings, all extending
[no-leakage-client](#no-leakage-client) + [vision-tiers](#vision-tiers) and cross-referencing
[devtools-placement](#devtools-placement):

1. **Two composable feedback channels, both captured.** A *verdict on a candidate* trains precision +
   severity; a *missed-issue capture* (a human authors a finding the judge never flagged) is the **only**
   channel that trains **recall**. Verdict-only is a strict subset that caps the perceptual ceiling — so
   capture both. **Label anchor:** a frozen-frame corpus keyed on `stateId` for eval/training (no spatial
   replay), plus a composite spatial anchor for missed-issue authoring — `stateId` gates the match, **bbox
   primary, a11y-role/text tiebreak, DOM-path debug-only**.
2. **Learning mechanism = k-NN → probe → parked fine-tune.** k-NN over **cached DaViT vision-encoder
   embeddings** at cold-start (on-device, free, works from the first label) → **linear/logistic probe** on
   the same cache at ~tens of labels (eval-gated) → full VLM fine-tune parked past ~1k labels (server-side).
3. **Agent-portability is a hard constraint** (the zero-lock-in seam extended from inference to training):
   the **asset is the model-agnostic corpus** (`{frozen frame, domSnapshot, stateId, verdict, anchor, label
   vocab}`); **embeddings are a re-derivable cache** keyed `(encoder-id, frame)`; **the recipe is
   encoder-parameterized**, so swapping the judge agent ⇒ re-embed + retrain, zero data loss. A
   train-disjoint, variant-rich **held-out regression benchmark** (bad-pattern catalogue + false-positive
   traps) scores *outputs*, so it validates any judge agent and is **CI-gated on accuracy** — distinct from
   the judge's *output*, which stays advisory and **never gates an explored run** ([#1172](../../backlog/1172/)).
4. **Constellation boundary (three-way split, per [devtools-placement](#devtools-placement)):** **Plateau
   owns the implementation** (model/embeddings/store/training/#490 distillation — extends the
   #1073/#475/#490 vision service); **WE owns only the contract** (the `JudgeModel` type / judgment schema,
   never any impl, per [#1282](../../backlog/1282/)); **the explorer dev-tool produces the signal + hosts
   the seam** from its Plateau-side orchestration/report tier (the human + `improve-explorer` loop is the
   actual consumer). Only outputs cross the seam; a FUI-local judgment provider is the fragmentation #475
   forbids.

**Lineage:** #1553 (this decision) · #1552 (epic) · #1565 ([devtools-placement](#devtools-placement)) ·
#489 (frame/verdict pairs) #1168 (DOM-signature stateId) #1034 (critique rubric) #490 (distillation) ·
#1073/#475 (vision service). *Confidence: architecture firm; escalation-trigger label count provisional.*

### Custom-element tagName naming {#tagname-naming}

1. **Element-ness is opt-in / authored:** a block declares `tagName` (0 / 1 / N tags); never
   auto-derived from type.
2. **Value = `<prefix>-<id>`**, default prefix `we-`, configurable via Config-Extends-Platform-
   Default (`fui-` excluded). FUI's irregular names migrate to conform.
3. Registration is **parameterized** (tag = contract default, never a hard-coded literal); the
   override hatch is consumer-side.
4. The convention **binds only global-registration modes** — deep JSX / compile-time consumption
   stays totally flexible.
5. The custom-element surface (`tagName` + attributes/properties/slots) is a **WE-owned contract in
   `blocks.json`**; FUI is one conforming implementation (not WE mirroring FUI's
   `customElements.define`).

Plus the standing naming rules (machine-checked): traits `with[Capability]` (never `use*`),
registries `Custom[Name]Registry`, injector domains start with `@`, event attrs `on:event`. WE
never *mandates* conventions — it ships a default vocabulary projects customize, enforced via
`webcompliance`. See [conventions.md](conventions.md).

**Lineage:** #841 (tagName convention) · #822 (CEM surface as contract) · #045 #046 · #063 #030 ·
#436/#437 (conventions-fold-into-compliance).

### Host back-reference property naming {#host-backreference-naming}

A host-attached object names its back-reference to the host **by the relationship's native /
semantic name — never a universal `target`**. `target`/`currentTarget` are reserved for transient
dispatch/observation (`Event`, `MutationRecord`), not persistent ownership, and collide with the
`e.target` a behaviour reads in its own listeners.

1. An `Attr`-derived host object (`CustomAttribute` + subclasses, which chain to `Attr.prototype`)
   uses **`ownerElement`** — the exact native `Attr.ownerElement`.
2. A non-attribute host-attached object (`Injector`, `CustomContext`, controllers) uses **`host`**
   (matches `ShadowRoot.host`, Lit `ReactiveControllerHost`, Angular host element).
3. **Name by semantics, not by uniformity:** two right names (`ownerElement` for `Attr`, `host`
   elsewhere) beat one wrong-but-uniform name — the web platform itself diverges this way
   (`Attr.ownerElement` vs `ShadowRoot.host`). A permanent dual name for one class is excluded; a
   deprecated alias getter for one cycle is a rollout tactic, not a second canonical name.

**Lineage:** #1121 (`CustomAttribute` → `ownerElement`, scoped to `Attr` subclasses) · #1042
(sibling `Injector`/`CustomContext` → `host`, open) · derived from [native-first
baseline](#native-first-baseline).

### Registry name-validation guards the host-shared namespace, not every `define()` {#registry-name-guard-namespace}

A `CustomRegistry.define()` name-validation throw is justified **iff the registry's keys enter a
namespace shared with the host platform** — never by a flat "every `define()` call validates the
same way" rule.

1. **The test is namespace sharing, not the `define()` call.** A key is guard-worthy iff it lands in
   a namespace where a bare name collides with a host built-in. Today that is the **HTML-attribute**
   namespace (`CustomAttributeRegistry` → DOM attributes, where `title`/`value`/`type` are taken).
   Element tags are the other host-shared namespace, but the platform **already** hyphen-forces them.
2. **Framework-internal keys are not guarded** — *with one amendment for grammar-keyed registries (#2112,
   2026-07-03).* Parser / expression / text-node / store / context registry keys never reach the DOM, so their bare
   grammar tokens (`value`, `pipe`, `call`, `mustache`, `polymer`) stay bare — no guard, no rename. The base
   `CustomRegistry` stays guard-less; the throw is a deliberate per-registry override, not a base invariant.
   **Amendment:** when the registry key *is a delimiter grammar* (the #2074 `customNodes` recipes, keyed by
   `static open` rather than by a name), a **narrow slice of that keyspace is host-shared** — an `open` rooted in the
   HTML tokenizer's tag-open set (`<` + `!`/`/`/`?`/letter) is claimed by the parser before text scanning, so it
   *does* touch a host surface. That slice — and only that slice — is guarded (a `ReservedDelimiterError` at
   `define()`), per [#2112](/backlog/2112-reserved-delimiter-family-policy-which-opens-are-platform-re/) Fork 1
   ([custom-node-recipes](block-standard.md#custom-node-recipes) rule 6). The exemption still holds for name-keyed
   internal registries; it is *narrowed, not removed*.
3. **This is the web platform's own rule.** Native `customElements.define` guards *only* element tags
   (the one host-shared namespace) and imposes nothing on internal JS registries — so scoping the
   guard generalizes the platform; a flat uniformity rule would be **stricter than the platform's
   own**, on namespaces it never guards.
4. **The separator set tracks what each namespace permits** (not uniformity): tags are hyphen-only
   (a colon isn't a valid tag char); attributes accept hyphen **or** colon (`xml:lang`, `nav:list`).
5. **One-line statement to cite:** *guard the namespace you share with the host.* This is an instance
   of the same "name/guard by semantics, not by uniformity" discipline as
   [host back-reference naming](#host-backreference-naming) and derives from the [native-first
   baseline](#native-first-baseline).

**Lineage:** #1347 (scope of #1120's guard → `CustomAttributeRegistry` only; sets #1348 rename
scope) · #1120 (the `CustomAttributeRegistry` `#assertValidName` guard) · #2112 (rule-2 amendment:
grammar-keyed registries guard the host tag-open slice of their delimiter keyspace) · derived from
[native-first baseline](#native-first-baseline).

### Guard / Gate vocabulary {#guard-gate}

**Guard** gates a *transition*; **Gate** gates *presence*. Protocolize only the **provider +
predicate seam** as the single lock; each member (exit-guard #273, access #178) owns its
deny-outcome family. Enforcement is **server-side, never in the UX intent**. The next gate-shaped
feature is a *member* of the open Guard protocol, not a fresh abstraction.

**Lineage:** #272 (protocol) · #129 (navigation/exit guard) · #178 (access/authorization gate).

### `<component>` declarative-component (DC-N) decisions {#component-dc}

The `<component>` build-time transform's design calls are consolidated as a **DC-decisions
reference table in `src/_includes/block-descriptions/component.njk`** (the canonical block home).
Read the table before re-opening a `<component>` question. Covers: tag name (DC-1), shadow attr
(DC-2), registration timing (DC-3), reactive depth / binding (DC-4 / #792), scripting hook (DC-5),
toggle (DC-7), implicit/explicit template (DC-9/10/11), `attachInternals` (DC-12/13/14),
preserve-on-move (DC-15), scoped registration **off** `<component>` (#854 → carves #900/#901/#902),
toolchain reach (#127).

> Key sub-ruling (#854): `<component>` is a *build-time* transform (gone by runtime) so it **cannot
> host a runtime registry** — scoped registration lives off it, as a runtime declared-registry
> (`<script type=registry>`) + IDREF association + a CustomAttribute binding behavior. The
> `{{ }}` / `[[ ]]` expression-binding layer (`webexpressions`) already exists — reuse its grammar,
> not a new runtime.

**Lineage:** #039 #040 #042 #043 #044 #045 #046 #047 #074 #082 #084 #127 #792 #854 · #853 (default-aria-*) · #1807 (DC-14 custom states — `states=` declarative surface + per-instance toggle, delivered plugged/unplugged via the custom-states plug per #1826).

### Compose an existing trait — don't hand-roll a covered pattern {#compose-dont-handroll}

A block/component **MUST compose an existing WE trait/behavior/contract for any capability a
standard already covers** (disclosure → `nav:section`, roving focus → `nav:list`). Hand-rolling an
interaction a registered trait provides (ad-hoc `addEventListener` re-implementing the pattern) is a
**conformance defect, not a style choice**. New behavior is allowed — but authored as a *new trait*
(a `CustomAttribute`), never as per-block event wiring.

**Advisory alone is insufficient** — the rule existed in spirit (authoring skills + `AGENTS.md`) and
still failed twice (`sectioned-nav` #870, `disclosure-nav` #931), so a **mechanical gate is
required**, not just a checklist. Enforced by two orthogonal mechanisms:
1. **Declaration** — a block records the traits it *consumes* in a `composesBehaviors` field
   (distinct from the `traits` it *provides*), projected into CEM `x-webeverything` and asserted to
   resolve against `src/_data/traits.json`. Mirrors the existing `composesIntents` field.
2. **Detection** — a `check:standards` gate (`validateBlockComposesTraits`, beside
   `validateBlockImplConformance`) runs a **curated "source-pattern → required-trait" deny-list**
   over FUI source (e.g. click/keydown on an `aria-expanded` head → must compose `nav:section`),
   **warn-first → ERROR** once curated (the #840/#844/#477 rollout precedent). Open-ended
   `addEventListener` sniffing is *rejected* (false-positive factory); declaration-only is *rejected*
   (can't catch a block that declares nothing and hand-rolls — the #931 mode). A *rendered* axe check
   **cannot** substitute: a hand-rolled disclosure is a11y-clean, so the defect is visible only in
   source + declaration → the gate is static.

The authoring pre-flight ("search the trait registry before wiring an interaction; compose, don't
re-implement") ships as the gate's **complement**, never as the enforcement. The declarative-only
end-state (trait-marked templates with no behavior code to hand-roll) is the long-term fix, sequenced
after #932/#934 — it removes the *temptation*; the gate catches what slips *now*.

**Lineage:** #933 (ratified 2026-06-18) · incidents #870 #931 · precedent #436/#437 (conventions
fold into compliance), #840/#844/#477 (warn-first rollout).

### Gate-rollout ratchet: promote-on-green, then flip-to-enforce-by-default at the drained milestone {#gate-rollout-ratchet}

How a per-route/per-target quality gate (the axe a11y lane is the reference case) rolls from
warn-only to build-blocking. Two orthogonal axes, both ratified #867:

1. **Promotion tracks measurement only, not any upstream rework.** A route/target enters the
   enforced set the moment it *measures green*, decoupled from whether its dogfood/UI conversion has
   landed. Enforcing early means every later rework of that surface lands **under** the guard — the
   proof made structural. Holding promotion until the rework lands is the **broken branch**: it
   removes the guard at the single riskiest edit (the rework itself). This is a forced invariant, not
   a weigh — it restates #774's green-only criterion; a rework precondition is not one the gate ever
   asserts (it measures rendered output, never provenance, and re-measures every run).
2. **Warn-only is a stage you exit, not a resting posture — flip to enforce-by-default once
   drained.** Keep the warn-only *entry* posture (#774) while a largely-unmeasured site is draining;
   once the enforced set equals the derived set and the lane is green (a mechanically-decidable
   predicate over repo state), **invert**: a derived route is build-blocking **unless** listed in an
   explicit, reviewable `WARN_ROUTES` opt-out (new/experimental surfaces opt *out*, visibly and
   temporarily). Fail-closed is what "the site is the conformance proof" means once the debt is
   drained; perpetual warn-entry is fail-open by construction, and measured evidence shows warn
   output is ignored in practice. Rejected alternatives: flip-everything-now (yields a permanently
   red lane that trains the repo to ignore it) and a violation-level baseline snapshot
   (churn-sensitive, and snapshotted debt rots with no drain forcing-function).

Two rollout obligations the flip carries: the drained-milestone trigger must be **self-announcing**
(a lane meta-check that flags "drain complete — execute the flip" when the enforced set equals the
derived set, shipped *ahead* of the milestone so it can't rot unnoticed — a red enforced lane once
went unnoticed for a week), and the flip **supersedes #774's warn-only-entry rider as a plain
successor-ruling-on-changed-facts** (preserving #774's explicit-set discipline; record the
supersession lineage beside the #774 entry, never a retro-edit). Applies **per repo** ("mirrored,
not shared", #774/#849) — each gate drains against its own enforced set.

**Lineage:** #867 (ratified 2026-07-09, parent #777) · #774 (auto-derivation + warn-only-entry
rider, superseded part (ii)) · #763/#770/#793/#805 (axe lane built + first enforce flip) · #849 (FUI
mirror) · precedent #840/#844/#477 (warn-first → ERROR), fail-closed `check:standards`
classifier ([constellation-placement](#constellation-placement) cluster).

### A composition artifact is owned by its *new* substance; referenced parts stay home {#composition-artifact-ownership}

When a new artifact is a **composition of capabilities that already exist** across the constellation (a
record that *binds* an existing snapshot + journal + trace + identity into one consumable thing), do
**not** mint a new project or duplicate any part's format. The artifact is a **thin envelope that
references** the existing protocols; each referenced **payload schema stays owned by its existing
project**. Ownership of the *envelope* goes to the project of the artifact's **new substance** — the
one capability the composition actually adds (e.g. an *ordered timeline* of spans → the tracing
project) — **not** to the project that owns the heaviest referenced payload, and never to a brand-new
"consumer-composition" project (that fragments the constellation for no interop gain —
[minimize-lock-in](#constellation-placement)). When a fork asks "which project owns this composite?",
the answer is: locate the single new substance, own it there, reference the rest.

Corollary (determinism/observation records): when such a record must *replay*, anchor the determinism
guarantee on the **recorded state-diff journal** (re-apply diffs, run no app code) — bounded explicitly
to *journaled* state, with a snapshot↔journal consistency precondition and an off-journal-state-out-of-scope
boundary. Action/event **re-fold through handlers is not the determinism anchor** (it assumes handler
purity the platform can't guarantee); it is a valid *optional* behavioral-replay mode, and event-identity
is load-bearing only there and for **correlation**, never for journaled-state determinism.

**Lineage:** #992 (trace/replay substrate — envelope owned by webtraces, journal stays webstates,
determinism anchor = state-diff A; ratified 2026-06-19) · #1411 (treegrid = a `hierarchy` projection on
`data-grid`, not a new block — the new substance is the Right/Left arbitration rule, homed on data-grid's
movement-engine seam; hierarchy's flatten-to-visible projection is referenced, not duplicated; ratified
2026-06-21) · #1423 (bulk-action = a thin `bulk-action` **intent** composing `selection` + `command` over a
target set, not an assemblerPreset/trait — the new substance a preset can't carry is fan-out across the live
selection set + the select-all `matching` predicate + the partial-failure outcome + the count-announce
binding; selection/command/#1409 toolbar are referenced and stay home; ratified 2026-06-21) · #1420
(offline-first sync = a composition over four already-ratified orthogonal axes — webrealtime transport +
webreliability durable outbox + change-tracking merge-strategy + `mutation` apply/rollback — so **no new
WE artifact**; the replay-on-reconnect *choreography* (FIFO + exactly-once + sync-cursor) rides a FUI
`sync-coordinator` **block** the `draft-persistence` way, never a 5th standard. **Deferral-bar corollary:**
don't mint an orchestrator over already-homed axes until a *real cross-cutting consumer* appears — that is
`storage.json`'s own bar, and it is unmet by the current exercise-app roadmap (loan/insurance/healthcare/
government/logistics are form/workflow apps, not collaborative-realtime). Presence stays its own render
intent (bias-to-separation; `CoEditCoordinator` "does not merge state"); ratified 2026-06-21). Kin to [constellation-placement](#constellation-placement),
[compose-dont-handroll](#compose-dont-handroll), [surface-contract-not-computation](#surface-contract-not-computation).

### An interchange Protocol whose family is project-less gets a thin protocol-host project — never owner-less, never mis-homed {#protocol-host-project}

A WE Protocol entry (`src/_data/protocols/*.json`) **structurally requires** an owning project: `validateProtocol`
(`scripts/check-standards-rules.mjs:772-789`) makes `ownedByProject` + `anchor` required fields, rejects an owner that
doesn't resolve in `projects.json`, and demands a `<section id="protocol-<id>">` anchor in the owner's
`src/_includes/project-<id>.njk` — its rendered catalog home. There is **no project-less escape hatch** (all 39
protocols are owned). So when a ruling makes a *family* project-less (intent + block, no orchestration domain) yet
also extracts its serialized form as a first-class Protocol, the two collide at mint time. **Resolution: mint a thin
*protocol-host* project that owns only the schema** — the Protocol entry, its anchor, and its round-trip conformance
vectors, **nothing behavioural.** The intent + block stay project-less; only the interchange *schema* gets a home.

This is **not** a re-open of the family's no-project ruling: a host owning *only* the schema is a different category
from the impl/orchestration domain a "no project" ruling rejects — the standards world homes interchange formats in
dedicated host/registry surfaces (glTF→Khronos 3D Formats WG, OpenAPI→OpenAPI Initiative), **never owner-less**, and
docking-style incumbents share *no* coordinating body, so WE must home the schema itself. **Do not** attach the
Protocol to an unrelated existing project (mis-homing — conflates entity classes, blurs that project's meaning), and
**do not** relax the required-owner invariant to serve one protocol (erodes a rule all others satisfy on exactly the
surface — the escapable lock — that most needs to stay crisp). The model-relaxation path (`ownedByProject` optional
iff `ownedByIntent` resolves + an intent-anchored rendering path) is the **dormant escape**, engaged only if the
host-vs-reopen category split is rejected.

**Lineage:** #1653 (dockable layout-tree Protocol → owned by a new thin `weblayout` protocol-host; #1437 Fork 1's
project-less family + Fork 2's first-class Protocol both honoured; skeptic SURVIVED — host ≠ reopen; ratified
2026-06-23; unblocks #1486's mint). Kin to [composition-artifact-ownership](#composition-artifact-ownership),
[constellation-placement](#constellation-placement), [minimize-lock-in](#constellation-placement).

### Data-shape evolution is a storage facet, not a reliability concern {#data-shape-vs-mechanism-failure}

When persisted client state **outlives the schema that reads it** (a stored value predates the shape the
current code expects — a renamed key, a changed field), the capability that detects + migrates/discards it
is a **webstates storage facet**, *not* a webreliability concern. webreliability owns **mechanism /
operation failures** (network timeout, server error, DB unreachable, computation crash) and is ratified
"distinct from validation — not input invalidity"; a schema-shape mismatch is **data evolution**, which
falls on the same far side of that line. The discard-to-defaults fallback merely *rhymes* with graceful
degradation — that resemblance does not move the home. **Test:** if the trigger is "the stored shape
changed", it's webstates; if the trigger is "an operation failed", it's webreliability.

Corollary (decision shape): such a placement question splits cleanly into **WE-internal architecture forks**
the developer never sees (which project owns it; how it attaches to the contract — WE must pick one on merit)
and **developer-facing behavior axes** with two legitimate end-states each (detection, mismatch policy,
on-disk granularity — *support both, record a most-flexible default*, never a mandate). Don't promote a
support-both axis to a fork. See [config-extends-platform-default](#config-extends-platform-default).

**Lineage:** #1251 (client-storage schema versioning + migration; home = webstates, granularity = configurable
dimension defaulting to per-key envelope; ratified 2026-06-20). Kin to [constellation-placement](#constellation-placement),
[composition-artifact-ownership](#composition-artifact-ownership), [config-extends-platform-default](#config-extends-platform-default).

### Mandate the surface contract, not the computation {#surface-contract-not-computation}

A WE standard normatively pins the **observable surface contract** — the hand-off shape, the regions,
the stable-id events — and **never the computation behind it**. Competing "models" that emit the same
surface are not separate models; they are **swappable provider strategies** (e.g. a `ValidityMergeRegistry`
resolver) that conform *iff* they leave the surface unchanged. So a state-derived engine, an event-driven
engine, and a degenerate/flat strategy all conform — conformance is the observable contract, never the
internal computation. When a fork looks like "which algorithm/model do we mandate?", the answer is almost
always: mandate neither, pin the surface, register both as strategies.

**Lineage:** #4 (validation validity-model & conformance-tier). Relates to [native-first-baseline](#native-first-baseline),
[forward-generation-adapters](#forward-generation-adapters) (both are "contract is the authority, impl is swappable").

### Export-shape drift: classify by coherence, resolve per-symbol by trim-or-build {#export-shape-drift}

When the export-shape gate (#170/#927) flags a `we:` contract `exports` symbol absent from the resolved
FUI barrel, it is a **source-of-truth call decided per symbol** — never one verdict for the whole block.
Classify each declared-but-absent symbol on **merit**: is it **load-bearing to the block's promised
coherence** — it delivers a capability the shipped core lacks (a *different mechanism*, not the same one
re-wrapped) → **build** the `locus: frontierui` impl and keep it declared — or is it
**additive/superseded/aspirational over an already-complete core** — sugar the impl never chose, or a
design it superseded → **trim** the contract `exports` array in place? The tell: a symbol that re-exposes
the *same* mechanism the core already ships (an optional element wrapper, a mixin form of a shipped base
class) is additive → trim; a symbol that adds a *capability the core cannot do* is load-bearing → build.
Cost (build size) is **excluded** from the classification — it only schedules a spawned build, never
selects the branch (an instance of *fork-is-not-a-prioritization-tool*). Reverse drift — the barrel exports
a symbol the contract omits — is a forced **add** (contract = barrel in both directions).

**Lineage:** #1165 (`tabs`/`transient-component` → trim; `view` show/if/switch → build via #1217; under
#904). Specializes [surface-contract-not-computation](#surface-contract-not-computation) for the
#1164/#927 export-shape arm.

### Native-first baseline floor {#native-first-baseline}

Standards **assume modern web-platform primitives are present** (Baseline-2024: FACE/`ElementInternals`,
`popover`, `:state()`/`CustomStateSet`, `:user-invalid`, anchor positioning) and treat anything below the
floor as **out of scope**. A spec stays **single-substrate** — it never carries a dual native-vs-shimmed
contract — and **polyfills are an opt-in enhancement layer the consumer adds**, never part of the standard.
This is the standards-level statement of the native-first default (`AGENTS.md` hard rule 6 carries the
day-to-day form; cite whichever fits).

**Polyfill-surface fidelity (corollary).** When you *do* ship a polyfill, its contract **is** the native
surface — it mirrors what the platform deliberately *omits*, not just what it provides. Don't add a method
the platform refuses to (e.g. no `downgrade()` on a `CustomElementRegistry` polyfill: native upgrade is
one-way and the registry is append-only with no `undefine`, so the symmetry the name implies doesn't
exist). A real per-subtree/teardown need is designed *then* as a **named, explicitly non-standard
extension** with documented semantics — never a mystery method whose name overpromises. The fidelity rule
applies **one level up too**: a *shared contract* that polyfills implement (an interface, a type guard, an
abstract base) must not **mandate** a method the platform omits — relax the requirement to optional
(`downgrade?`) so the native-faithful implementation is conformant, even when API symmetry (`upgrade`/`downgrade`
"look like a pair") tempts otherwise. Real implementers that genuinely need the method still ship it; only the
*requirement* relaxes.

**Lineage:** #31 (polyfill baseline floor); #1103 (polyfill-surface fidelity / `downgrade()` omission on the
`CustomElementRegistry` surface); #1350 (the corollary at the shared `Plug` contract — `isPlug`/`HTMLRegistry`
drop the `downgrade` *requirement*, `downgrade?` optional; build #1413). Mirrors `AGENTS.md` rule 6 + the
native-first authoring default.

**Plug = a proposed missing standard; unplugged = safe-now (corollary).** The floor rule above governs capabilities the platform *has* (assume present; below-floor is out of scope). Its mirror is the capability **elemental to web applications but absent from every spec**. WE can neither wait for standards bodies nor force adoption, so it ships **two postures over one contract**: **unplugged** — safe-today usage of only what the platform ships, non-invasive and enforcement-free (the supported product surface, #606); **plugged** — the *proposed standard materialized as runnable code* (the prollyfill / upstream candidate, carrying enforcement + polyfill). This is the Extensible Web Manifesto move (expose primitives, prototype in JS, standardize what wins); the ecosystem already names the split — **ponyfill** (non-global, side-effect-free) = unplugged, **polyfill / prollyfill** (global; a not-yet-standardized API) = plugged. **Guardrail (what reconciles this with the single-substrate floor):** the *contract* stays single-substrate — plugged/unplugged is a **delivery+enforcement** axis over one contract (enforcement-on vs enforcement-off, the `--strict` analogy), **not** two native-vs-shimmed contracts; and the plugged impl is still implementation (→ Frontier UI), never a `@webeverything` standard artifact (#606). So "plugged = the proposed standard" names the impl's *upstream-candidate role* — it does not make the polyfill a standard, and the floor rule is preserved. **Partition grain:** decompose a capability into layers and classify **each layer** present-vs-absent against a shippable browser — a present layer → native (this floor); a layer absent from every spec → the plug. (#1807 is the worked example: `:state()`/`CustomStateSet` primitive present → native; the custom-state *declaration/validation* layer absent from every spec → plugged.) The `/prepare` lens that applies this at decision time lives in [backlog-workflow.md](backlog-workflow.md).

**Decision-discipline corollary (#1892) — a plug decision ratifies the *contract*, never the implementation mechanism.** Because the plug **is** the contract and the impl is FUI-local + swappable, a plug decision ratifies only the **WE-level contract** — the API shape + observable semantics as a future first-class web-platform proposal. The **implementation mechanism** — *how* FUI realizes it: a prototype-method patch vs an out-of-band WeakMap, the [residue](#plugged-only-residue-bar) classification, the emitted-ESM shape, install ordering — is **secondary, FUI-canonical, and replaceable**: a *different* library could supply the plug (e.g. a more performant one) and be **equally valid as long as it conforms to the same WE contract**. So an impl-mechanism question must **never** be elevated into a WE ratification — it is not a standards fork, it is an FUI build detail (record candidates non-bindingly; decide it in FUI). The **only** implementation constraint the contract carries is a **feasibility floor**: the contract must be *implementable*, not implemented a particular way. **Worked miss (#1892):** *"how does the plugged form intercept an undeclared `internals.states` toggle — patch vs out-of-band?"* was framed as the **standard** decision and consumed a whole session of reframes + a red-team — but it is pure FUI implementation; the only WE call was the `declareStates(internals, vocab, {severity?})` **contract** itself (a closed, validated state vocabulary as a platform proposal). The signal you mis-scoped: the "fork" turns on *residue / patch / polyfill shape* (impl words), not on observable contract.

**Lineage:** #606 (unplugged-is-product / plugged-is-POC; plug impl → FUI) generalized into this corollary; #1826 (the doctrine decision); #1807 (first application); #1892 (the decision-discipline corollary — ratify contract, not mechanism). Prior art: the ponyfill / polyfill / prollyfill triad + the Extensible Web Manifesto.

### The plugged-only residue bar — contract-portability, not capability-portability {#plugged-only-residue-bar}

A capability is **plugged-only** (genuine residue ≈ the missing platform standard) — rather than merely **not-yet-ported** — **iff both**: **(i)** its observable contract requires intercepting a native method/constructor the *consumer* calls directly on a node the plug holds **no handle to** (e.g. tagging every `document.createElement` result), **and (ii)** that **observable contract** — *including transparency* — cannot be reproduced by WeakMap-keyed out-of-band state consulted through the plug's own API (`attach`/`upgrade`/getter). The clause-(ii) test is over the **contract**, not the bare **capability**: a capability whose kernel ports (a verb re-expressible as an explicit factory + WeakMap) but whose contract demands *transparent interception of call-sites the plug does not own* is still residue, because there is no standard hook to replace the interception. The bar is **mechanical and strict** — the DX/ergonomics bar ("possible but worse unplugged ⇒ plugged-only") is rejected: it inflates the residue the epic exists to minimise. The capability-class allowlist is rejected *as the gate* (it ossifies as the platform grows) but kept as explanatory prose. **Discharge rule:** a residue declaration must cite *which* unowned global it patches, *why* no handle reaches the node, **and name the missing platform hook** the residue stands in for — so the verdict stays auditable and falsifiable (if the platform ships that hook, the capability moves *out* of residue and the mechanical test notices). Worked example: webinjectors' `createElement` creation-context tagging (`fui:plugs/webinjectors/Node.injectors.patch.ts:88-94`) and webcontexts' transparent `Node.prototype.createElement` dispatch (`fui:plugs/webcontexts/Node.contexts.patch.ts:52-70`) are the **same mechanism** — both residue; the missing standard is a *construction/insertion lifecycle hook*.

**Parity marking (how the residue is recorded):** per-public-API-member state uses the caniuse-shaped **3-state** vocabulary — `works` (≈ `y`), `works-with-caveat` (≈ `a` / BCD `partial_implementation`, **mandatory note**), `plugged-only` (≈ `d`, gated — references the residue justification). A 2-state binary is rejected (drops the real caveated-but-working middle). The verdict is a **measured fact about the FUI runtime**, so it is stored **FUI-side** (e.g. `fui:plugs/<plug>/parity.json`) and surfaced to the doc-site table via the existing cross-origin data path; WE exposes **at most a type-only schema** — never the values (#606/#1282 zero-impl: a measured impl verdict in a WE contract file is a FUI→WE leak).

**Lineage:** #1839 (this ruling — both forks ratified 2026-06-27); refines #1826 ("residue minimal + justified") and [native-first-baseline](#native-first-baseline)'s plug corollary; grounds the #1840 re-audit (the bar = its per-API verdict) and #1844 (the parity-table schema). Prior art: caniuse `y`/`a`/`n`/`d` + MDN BCD `partial_implementation` + note. *Confidence: high — both alternatives are defeated by forced invariants (the epic's minimise-residue goal; the #1282 contract↔impl cut), and the contract-vs-capability discriminator is grounded in two real cases.*

### Observe-only posture spectrum between unplugged and plugged — semantics never altered; deferred-not-sync; pure-observation folds into unplugged {#observe-only-posture-spectrum}

Between **unplugged** (manual `register`/`upgrade`, zero global footprint) and **plugged** (full prototype
patching that reaches true residue) sits a family of **observe-only postures** whose **invariant is that native
method semantics are never altered** — they only observe and, at most, schedule a deferred `upgrade(root)`.
Three forced rules govern this band:

- **Substrate is a prototype-method wrapper, not a `Proxy`.** Mirror what plugged already does — `const o =
  proto.m; proto.m = function(…){ observe(this); return o.apply(this,…) }` — because plugged itself reassigns
  prototype members (there is **no `new Proxy` in the plugs tree**). This is strictly safer than a `Proxy` (no
  identity break, no `instanceof` surprise). The observation **instrument is global, never per-root**: per-root
  cannot see roots unowned code never hands you (whatwg/dom#1287 "extremely wasteful"; native
  `customElements.upgrade` uses a realm-level candidate registry).
- **Upgrade scheduling is deferred (microtask-batched), never synchronous-on-detect.** Synchronous upgrade
  mid-call is **behaviorally equivalent to plugged** — it re-enters the page's own mutation with the same
  construct-and-swap — so choosing it **dissolves the posture boundary** that justifies the band existing. Batch
  into a dirty-`Set`, flush once per microtask over a snapshot; ship a synchronous **`flush()`** escape hatch for
  the foreseeable live-read-before-flush window. (Dedup is **cost-load-bearing**, not cosmetic: `upgrade` re-walks
  every plug with no early-return.)
- **Pure-observation that patches *nothing* belongs inside unplugged, not as a separate rung.** A capability
  recoverable by a **global `MutationObserver`** alone (any connected insertion, post-hoc) patches no prototype
  member, so it does **not** violate unplugged's no-patching invariant and should **fold into unplugged** as a
  config-selectable `autoUpgrade` knob (candidate default-on, but always overridable — a global observer is
  semantics-safe yet **not footprint-free**). A posture only earns separate-rung status when it **must** patch a
  method to do its job (e.g. **diagnostic** needs call-site + creation-time attribution that `MutationObserver`
  cannot give). The boundary with plugged stays the [residue bar](#plugged-only-residue-bar): true residue
  (`createElement`-at-creation tagging) is reachable only by patching, so it stays plugged-only.

**Lineage:** #1872 (this ruling — both forks ratified 2026-06-27), under epic #1836 (every plug functional
unplugged). Builds on the [residue bar](#plugged-only-residue-bar) (the live portability predicate this band
applies) and [native-first-baseline](#native-first-baseline); the selected-posture value is a
[config-extends-platform-default](#config-extends-platform-default) dimension (enum/contract → WE type-only,
instrument + queue → FUI, value → project config). Successor build #1899. *Confidence: high — per-root and
sync-on-detect are each defeated by forced invariants (un-handed roots; the posture-boundary collapse); the
wrapper-vs-`MutationObserver` instrument split is left to a measured capture investigation in #1899.*

### Shape a new contract's surface by platform idiom, not capability {#contract-surface-platform-idiom}

When inventing a **new** protocol surface, pick the API shape the platform already uses for that *kind* of
thing — and never justify a shape by a capability difference that does not exist. A relationship to another
element that is **declared by an IDREF attribute** is a **writable element-reference property**
(`popovertarget`/`popoverTargetElement`, `for`/`htmlFor`), **not** a method; only the **derived/resolved
chain** stays read-only (`parentNode`, `assignedSlot`, `label.control`). A new propagation/visibility concern
that is **orthogonal** to an existing platform flag gets its **own flag** — never an overload of the existing
one (`composedLogical`, not a reinterpreted `composed`). "Use a method so we get validation/events" is a
**non-reason**: an accessor's setter validates and fires events exactly as a method does, so decide on idiom,
not capability.

**Lineage:** #1000 (Web Portals contract shape — `logicalParent` writable element-reference property +
`composedLogical` separate flag; the capability-not-idiom trap was caught by author review). Refines
[native-first-baseline](#native-first-baseline) (this shapes *new* surfaces to the platform; that floors on
*existing* features) and relates to [surface-contract-not-computation](#surface-contract-not-computation) and
[compose-intent-dont-duplicate](#compose-intent-dont-duplicate) (Web Portals composes Focus Containment, Q3).

### Behavior activation lifecycle — connected ≠ active {#behavior-activation-lifecycle}

A behavior (webtraits `CustomAttribute`) has **two orthogonal states**: **connected** (in the DOM, via
`connected/disconnectedCallback`) and **active** (should actually run, via a shared `activate()`/`deactivate()`
lifecycle). They are independent — a connected behavior can be dormant. Activation boundaries **reuse native
attributes** (e.g. `inert` marks a dead-zone) rather than inventing markers; **auto-dormancy is scoped by
meaning** to interaction-driven behaviors only; and a per-usage `<trait>-active` override re-enables. The
lifecycle contract is specified **once** and consumed by every activation gate (visibility #221, inert
dead-zone #222) — gates don't each re-derive what "active" means.

**Lineage:** #221 #222 (behaviour activation / inert dead-zone). Distinct from [guard-gate](#guard-gate)
(predicate-gated *transitions*; this is behavior *run-state*).

### Persistent-B element over a data-array kernel: source by typed property, not markup parse {#persistent-b-data-source}

A **persistent-B** `we-` element (the styled, light-DOM, **no-shadow** element hosting a kernel — per #1457)
whose kernel **renders the semantic DOM from a data array** (e.g. `TreeSelectBehavior(host, nodes, opts)`,
which does `host.innerHTML = ''` then builds) sources that array from a **typed property** (`.nodes` /
`.items` / `.rows`), mirroring `fui:blocks/wizard/WizardElement.ts` (property-sourced render-from-data) —
**not** by parsing author light-DOM markup. Markup-parse-as-primary is rejected *for this kernel shape*: peers
that treat markup as source-of-truth (native `<select>`, Open UI, `<sl-tree>`) do so behind a **shadow root**;
a no-shadow render-from-data kernel **destroys** any parsed markup on its first `innerHTML=''`, so the parse is
ceremony with negative payoff. The typed property is the floor. An **optional** declarative form is a binding
expression on the element's **own** observed attribute (`nodes="[[ data.tree ]]"`), resolved in the element's
own lifecycle by reusing `we:plugs/webexpressions/CustomExpressionParser` as a library — explicitly **not** a
globally-registered `CustomAttribute` over arbitrary elements (that is a framework-grade any-element binding
surface WE avoids); for data-array content, binding a *reference to a data source* is the right declarative
form, not hand-authored structural markup. **Scope guard:** this is specific to **render-from-data** kernels;
a **light-DOM-scan** kernel (`CustomAttribute` enhancing authored markup in place — type-ahead, data-grid,
stepper) has *no* data-source fork and mirrors `StepperElement` verbatim.

**Lineage:** #1570 (ratified — tree-select data-source; #1568/#1569 confirmed fork-free). Consumer refinement
of #1457 (support-both, element-over-behavior). Builds: #1567.

### Block data-ingestion: one `[[ ref ]]` form, resolved by determinism × interactivity {#block-data-ingestion}

A render-from-data `we-` block (per [persistent-b-data-source](#persistent-b-data-source)) sources its complete
data (rows/options/config) from **one declarative form** — an attribute web-expression `rows="[[ ref ]]"`
binding to a **context**, with the typed JS property `.rows`/`.config` as the imperative floor it sets. There is
**no second ingestion shape**; what varies by situation is *where the binding resolves* and *whether the resolved
data is shipped to the client*, set by two orthogonal axes:

1. **Determinism** — is the context **build-known**? The `webexpressions` evaluator is **DOM-free**
   (`CustomExpressionParser.evaluate(ResolvedValues)` takes a pre-resolved `contexts` map; the DOM coupling is
   only the *runtime* text-node binding layer), so a **deterministic** binding **resolves at build time**: the
   server supplies the context, evaluates, renders a plain `<table>`, and drops the binding. A **non-deterministic**
   (client-only) context can only resolve in the client.
2. **Interactivity** — does the client **re-render** (sort/filter)? If not, nothing is shipped. If so, the resolved
   typed data is shipped to the client.

|  | **non-interactive** | **interactive** |
|---|---|---|
| **deterministic** | server resolves → plain `<table>`, ship nothing | `<table>` baseline **+ serialized resolved context** (inert `<script type="application/json">`) for client re-render |
| **non-deterministic** | client resolves + renders once | ship binding **+ runtime context hydration (#1827)** — the app case |

The familiar paths are **derived consequences, not separate forms**: a "simple SSR table → plain `<table>`" is the
deterministic + non-interactive cell; a "JSON island" is the deterministic + interactive cell (the island *is* the
serialized resolved context — same source of truth, no hand-authored twin); runtime injector hydration is only the
non-deterministic cells. **Correctness invariant:** the server-resolved / serialized payload always carries the
**raw typed values**, so any client sort runs on raw `field` values — **nothing reparses rendered `<td>` text**
(a key recovered from rendered text is silently wrong on cells like `Baseline 2026` or `✅`).

**Precedence.** The typed JS property is **authoritative**; `[[ ref ]]` is the declarative path that sets it, and an
explicit imperative property set **wins over** a binding (a late-resolving async binding must observe this and no-op).
Raw author markup is **never** a data source for a render-from-data kernel (its kernel attaches a freshly-built tree
via `replaceChildren`, discarding any parsed markup) — markup-as-source stays exclusively the **light-DOM-scan**
kernel's contract; the two kernel shapes never mix in one element.

**Lineage:** #1818 (this decision — ratified) extends [persistent-b-data-source](#persistent-b-data-source) (#1570)
with the resolution-locus + client-payload axes. Surfaced by #1787 / the #1600 table→data-table family (all
deterministic, ship without #1827). Follow-on: #1827 (SSR injector-context hydration, app-facing) — its
production-consumer slice #1928 landed the runtime seed (`seedDeclarativeInjector`) wired to a real
non-deterministic client-only surface (a live board whose polled `rows` resolve `[[ @rows ]]` at upgrade),
plus the `@name → customContexts:name` key-derivation sugar so a consumer seeds under the exact key a live
context-query reads. Open impl
residuals (mechanism may flex, goal fixed): the determinism predicate, the build-time evaluation harness, the
serialized-context format — **all three filled by #1867** ([#ssr-data-table-build-harness](#ssr-data-table-build-harness)),
which refines the "JSON island" sketch above to a **`data-*`-on-cell + in-place enhancer** interactive format (the
raw-typed-value correctness invariant is preserved; only the transport mechanism changed).

### Forward (generation) adapters for polyglot reach {#forward-generation-adapters}

A WE standard projects **outward** into non-JS / enterprise runtimes (.NET, Java, Go) via a
**forward/generation adapter** — the inverse of an ingest adapter. The authority is a **language-neutral
contract/IR** (no language, *including JS*, is privileged); **generation is deterministic** (byte-identical
output; AI assists only at adapter-*development* time, never in the gen path or the gate); and a **shared
cross-language conformance suite gates every target's release**. The forward adapter is a WE `webadapters`
standard artifact; the generated origins are ecosystem impl, and any served product is Plateau (per
[constellation-placement](#constellation-placement)).

**Lineage:** #463 (ratified — polyglot MaaS origin generation) · builds #505/#506/#507. Relates to
[surface-contract-not-computation](#surface-contract-not-computation) (neutral contract is the SoT).

#### Browser-component emit substrate is a dedicated emit-purpose IR, not the ingest rep {#forward-emit-dedicated-ir}

For the **browser-component** member of the forward-generation family — emitting idiomatic per-framework
source (Vue/Svelte/Angular) — the canonical substrate is a **dedicated emit-purpose IR (Option C)**, a neutral
`@webeverything` contract authored for generation, **not** a bidirectionally-extended ingest `ComponentIR`.
**Direction ratified** (#939): the ingest rep is a deliberately *lossy* subset (its `notes` field records what
it **drops** — exactly the styling/event/slot/reactivity detail emit must preserve), so reusing it as the
high-fidelity emit substrate degrades the fidelity the fork exists to deliver and forces two conflicting
invariants into one schema (violating *bias-toward-separation*). The lone shipping precedent (Mitosis) built an
emit-shaped `MitosisComponent` rather than reuse its ingest rep. The per-framework serializers are forward-adapter
artifacts (each #506-gated); the live render stays FUI-hosted.

**Shape held, not the direction.** Option C's *contract shape* (its fields/grammar) is held on an **evidence
trigger** — designed once the idiomatic Vue/Svelte/Angular emitters accumulate real cases showing where the flat
declarative `<component>` subset stops stretching, rather than guessed today (#811's "decide with cases, not
guess"). Tracked as the parked residual.

**Lineage:** #939 (direction ratified) — de-buried from #818, grounded in #811 Fork 2
([report](../../reports/2026-06-16-forward-component-emit-substrate.md)). Applies
[bias-toward-separation](#bias-toward-separation) and synthesizes [forward-generation-adapters](#forward-generation-adapters).

#### New-target start gate: every new generation target/form starts by citing current external-adopter evidence {#forward-target-start-gate}

The **start-gate sibling** of the release condition above ("the conformance suite gates every target's
*release*"): **every *new* polyglot-widening item — by predicate, not item list: an item that adds a new
generation target or emit form (a further language target, a new wrapper form, any new forward-generation
scope) — may not start until it cites *current* external-adopter evidence** about the forward-generation
contract surface. Encoded as a hard `blockedBy` edge at scaffold time; the bootstrap instance is the Gate-A
pilot retro (#2129 — one criteria-bound external pilot whose required generated-artifact leg touches an
existing emit target), and later targets cite evidence *current at their filing*, never the stale first retro.
Rationale: the serve-path IR and target idioms have never met a consumer who didn't write them — widening
without external evidence risks standardizing the wrong contract; every surveyed graduation process (TC39
Stage 4, W3C CR exit, IETF RFC 6410, Kubernetes GA, Rust stabilization) makes independent experience a hard
input, encoded structurally, never as a memo. **Out of the gate by the same predicate:** maintenance of
shipped artifacts, and work that consumes existing emit forms without adding a target/form (the workbench
live-test family). **Exempt:** the emit-purpose IR widening (#1735) — it is governed by the ratified
empirical trigger in [forward-emit-dedicated-ir](#forward-emit-dedicated-ir) ("not a backlog edge"); the two
gates agree in kind (both adoption-evidence triggers) and compose by scope (this edge governs new
targets/forms; that trigger governs the IR widening). The gate is **prospective** — it governs the next
widening, never retracts shipped increments.

**Lineage:** #2089 (ratified 2026-07-02 — external-validation sequencing, from the 2026-07-01 external-review
finding 2). Composes with [forward-generation-adapters](#forward-generation-adapters) (start condition beside
its release condition) and [forward-emit-dedicated-ir](#forward-emit-dedicated-ir) (exemption above).

### Standard consumability: author to the standard, ship removable agnostic adapters {#standard-consumability}

**How a WE standard reaches consumers with zero lock-in.** A standard is a *guarantee*; making it work today
is a separable, removable concern. **Three layers, never conflated:** **(1) contract** = the guarantee (WE);
**(2) authoring source-of-truth** = the standard's *own form* — write to the platform (e.g. `@scope` CSS),
**never a tooling/impl format**; when the native form ships, the adapters drop and the authored source is
unchanged (minimize-lock-in / graceful-degradation applied to *authoring*, not just runtime); **(3)
impl/lowering** = removable *make-it-work-today* adapters (build-transform / runtime polyfill).

The lowering is **one pure, agnostic transform core + thin adapters**, and the adapters span every
consumption axis — which are **orthogonal**: **timing** (build / serve / runtime) ⟂ **host/bundler** (vite /
rspack / webpack / esbuild / rollup / CLI — *none privileged*; a project must consume **uncompiled** source
with **its own** bundler) ⟂ **guarantee-strength** (the Configurator dimensions). Expose these as **config**,
never as authoring choices — that is what "more than one valid way available to the user" means. The
trait-enforcer is the reference shape (pure functions + per-bundler shims over a WE-resident contract).

The **only lock is the contract + conformance** (the single escapable protocol lock); reference tools are
optional and swappable. **Placement:** contract + conformance vectors → WE; the reference transform + adapter
family → published impl/tooling (FUI-owned, zero-lock-in), **never `@webeverything`** — the contract crosses
the seam, the tool does not. Conformance is what makes the standard adoptable *independent of* the reference
tool.

**Lineage:** synthesizes [forward-generation-adapters](#forward-generation-adapters),
[framework-free-core-vendor-segregation](#framework-free-core-vendor-segregation) (the bundler-agnostic
axis), [native-first-baseline](#native-first-baseline),
[config-extends-platform-default](#config-extends-platform-default), and the #855 generator-is-a-tool /
npm-scope-mirrors-layer rules under [constellation-placement](#constellation-placement). First worked
instance: #1377 (webisolation L2 — author base `@scope`; pure PostCSS core + per-bundler adapter family).

### Authoring form ids are distinct from consume-mode wrapper ids; served source emits as data, the endpoint owns transpile {#authoring-form-id-distinct-from-consume-wrapper}

An **authoring form** (lowers a `<component>` definition to a target shape — e.g. `functional`, `wc-class`)
and a **consume-mode wrapper** (wraps an *already-built* artifact for a framework — e.g. `react-wrapper` via
`genWrapper`) are **distinct artifact kinds in disjoint id-spaces**, reached by different endpoints. One
stable id per authoring form; **never alias an authoring form id onto a consume wrapper** — that is exactly
the ambiguity #977 removed. WE owns one neutral catalog-gated `form` param; the value-set is the serving
runtime's injected catalog ([impl-is-not-a-standard](#)).

The served authoring artifact follows a **data-emit-for-display / endpoint-for-execution split**: WE's
deterministic `serve()` emits the authoring *source* as data (#954 channel →
`we:src/_data/authorModeSource.json`) for the panel to *display*; the *mountable* artifact is transpiled at
the FUI endpoint via the injected `compilerRegistry` (the delivery layer registers the compiler), the same
rule as `genWrapper` transpile. FUI reads the emitted data and **never imports WE's `serve()`**.

**No-consumer corollary:** a backward-compat shim (e.g. a retired-form alias served as a deprecation
redirect) with **zero real callers** is dead weight — verify the consumer graph, then **drop it rather than
design around it** (e.g. rename a colliding id). No consumer ⇒ no backward-compat obligation.

**Lineage:** #1619 (ratified — FUI functional-component adapter shape) · #954/#956 (data-emit channel) ·
#974/#977 (wrapper-form catalog + `functional` retirement) · #700 (emit placement). Refines
[runtime-DI-seam](#runtime-di-vs-devtools-provider-seam) (the `compilerRegistry` endpoint seam) and
[constellation-placement](#constellation-placement) (contract+data → WE, serving endpoint → FUI).

### The MaaS origin serves only self-contained modules; plug-mode is a consumer-side axis, never the served form {#maas-serves-self-contained-modules-only}

Plug-mode (global-patching `bootstrap` vs functional) and the MaaS serve catalog are **orthogonal axes**.
The served catalog is **delivery-shape** only — `?form=react-wrapper|vue-wrapper|react-live|vue-live`
(`fui:tools/maas/vite-plugin.mjs`) and `?variant=functional|live` on the separate `/_maas/fn/` route
(`fui:tools/maas/functionalServeHandler.mjs`, #1681); `plugged`/`unplugged` is **not a member of either
catalog**. The serve-path invariant: **every `form`/`variant` the origin serves must be a self-contained
module** — imported without patching host globals, self-registering scoped. The host consumes by cross-origin
`import(servedUrl)` then `document.createElement(tag)` (`fui:workbench/loader.ts:63-67`); the served bytes
register their own element as an import side effect.

A **plugged / host-global-patching served form is forbidden because it is incoherent**, not merely
dispreferred (forced-invariant — one branch is mechanically impossible): a module fetched by cross-origin
`import()` runs in its **own realm**, so its `window`/prototype patches (`fui:plugs/bootstrap.ts` patches the
importer's `window.WebEverything`) never reach the *host*, and the host's `createElement` path never reads
patched globals. Plugged therefore stays a **consumer-side** dev entry — the app imports
`@frontierui/plugs/bootstrap` itself, never over the wire. A genuinely plugged-only capability is
**marked-and-omitted**, never served plugged: the served module sets `X-MaaS-Lossy`
(`we:blocks/renderers/module-service/servePathIR.ts:57`) and the parity table records it `plugged-only`
([#1839](#)). The invariant is a guarantee about the **protocol's wire behavior** (every cross-origin
consumer relies on it) so it homes on the neutral serve-path contract (`we:servePathIR.ts`), validated by
the FUI serve handlers/catalog ([impl-is-not-a-standard](#); same contract/subject split as #1467). It
**constrains what any catalog entry may be**, not a default `form` value (the `form` value-set stays an
injected catalog the contract deliberately leaves open — [authoring-form-id-distinct-from-consume-wrapper](#authoring-form-id-distinct-from-consume-wrapper)).

**Lineage:** #1838 (ratified 2026-06-27 — Fork 1a; forced-invariant, the plugged-served branch is broken
across `import()`; skeptic REFUTED-AND-REGROUNDED→SURVIVES [re-grounded the original `?form=plugged` framing
onto the real seam]; red-team impl-is-not-a-standard FAILED [the invariant is contract-level]; prep
`we:reports/2026-06-27-unplugged-plug-parity.md`). Parent epic #1836 (W5); build slice #1843. Reconciles
#1841 (resolved `graduatedTo: none` — the incoherent plugged-serve axis was never shipped). Sub-fork — the
plugged-only residue bar — delegated to #1839. Sibling of
[authoring-form-id-distinct-from-consume-wrapper](#authoring-form-id-distinct-from-consume-wrapper) and
[we-data-crosses-via-fui-served-route](#we-data-crosses-via-fui-served-route) in the MaaS serve cluster;
instances of [constellation-placement](#constellation-placement) (contract → WE, serving → FUI) and
[impl-is-not-a-standard](#).

### A workbench/explorer block may be source-only — relax the host contract, never manufacture an unused live instance {#source-only-workbench-block}

When a host surface (the FUI workbench / block-explorer) wants to present a case whose real content is **emitted source + diagnostics** — a declarative `<component>` author-source case, no imperative element — host it as **exactly what it is**: let the block carry `authorSource`/`cem` with **no runnable `load`/`create`**, and have the shell render the source/CEM panels while **skipping the live-instance panels** (theme/trait/inspect). Do **not** wire a `<component>`→live-element lowering just to manufacture an instance the source panel never reads — the author-source renderer consumes `{name, definition, forms[]}` **data only** (`fui:workbench/authorMode.ts` `renderAuthorModePanel`, gated on `block.authorSource` in `fui:workbench/mount.ts`), so a synthesized instance is coupling no consumer reads (bias-toward-separation; faithful-shape). The relaxation is **additive** — the live-instance path stays mandatory for blocks that have one; a live-declarative-render runtime remains a **separate** capability, filed when a consumer that mounts the declarative case live actually exists. This rule fixes the host **contract** (a block *may* be source-only); the **acquisition mechanism** (hardcoded `WorkbenchBlock` literal vs resolved from the FUI `/_maas/` serve URL) is a distinct axis decided separately.

**Lineage:** #1701 (ratified 2026-06-24 — Fork 1 → (a) source-only `WorkbenchBlock`; (b) live-`<component>`-runtime excluded on the unneeded-coupling axis, no #746 consumer reads an instance; skeptic SURVIVES; prep `we:reports/2026-06-23-workbench-declarative-component-hosting.md`). Unblocks the #1618 Attachment slice. Acquisition-mechanism axis → #1731. Refines [authoring-form-id-distinct-from-consume-wrapper](#authoring-form-id-distinct-from-consume-wrapper) (data-emit-for-display split) and [constellation-placement](#constellation-placement).

### One authoring source-of-truth; a serializable form is a derived projection, never a second authoring home {#single-authoring-sot-derived-projection}

When a standard has a **native declarative authoring form** (HTML/DOM — `<template route>`, `<component>`, declarative markup) and a non-DOM consumer wants a serializable view of the same data, keep the **declarative form canonical** and **derive** the serializable form from it (DOM→data); do **not** make the data form a *second authoring home* (authoring-SoT-is-the-standard's-own-form, HTML-first). Two authoring homes for the same artifact = drift and violates single-SoT — and the fork-existence test usually finds a consumer for a *derived* data form but **none** for a data *authoring* form (incumbents author in code arrays only because they **lack** a native declarative form; we have one). The derived projection still **decides something now even when its builder is deferred**: it **forbids the dual-authoring branch** and **fixes the projection shape as the cross-consumer contract**, while the *builder* is folded into the first consuming slice ([build-when-a-consumer-exists](#)). Derivation need not be DOM-free (a headless DOM to run the existing parser is fine); the projection covers **statically-authored** entries only, and a serializable *input* path for **runtime/dynamic** entries is a **separate, non-conflicting** capability that reuses the *same* schema as its input contract (static vs dynamic are disjoint sets → single-SoT-per-entry holds). The projection stays an internal WE schema + conformance vectors until a 2nd independent impl conforms ([impl-is-not-a-standard](#); protocol temporal rule).

**Lineage:** #1685 (ratified 2026-06-23 — webrouting route-format: declarative `<template route>` is the authoring SoT, derive a serializable route-map for sitemap/prerender; prep `/research/route-table-authoring-source-of-truth`; skeptic SURVIVES-WITH-AMENDMENT; runtime/lazy ingestion split to #1720). Refines [authoring-form-id-distinct-from-consume-wrapper](#authoring-form-id-distinct-from-consume-wrapper) (data-emit-for-display split) and [configurability-partition](#configurability-partition) (declarative = the portable standard).

### A faithful derivation excludes what it cannot derive and realizes a declared axis — never fabricates a missing input, never re-derives a second home {#faithful-derivation-exclude-not-fabricate}

When a standard ships an **open registry of emitters/derivers** that each project the *same* canonical source ([single-authoring-sot-derived-projection](#single-authoring-sot-derived-projection)) into a downstream artifact, the registry is **support-all behind a default-less pluggable set** (the composability probe passes — each emitter is a facade over the one kernel and cannot conflict; new emitters join without a decision per [config-extends-platform-default](#config-extends-platform-default)). Build-order across emitters is **burndown, not a fork** (both orders agree on the end-state — all emitters exist). Two faithfulness rules govern any single emitter:

- **Exclude, never fabricate, at a lossy boundary.** Where the projection is lossy (a parametric `/users/:id` template has no concrete URL without an external value source), a concrete-output emitter **excludes** the un-derivable entries **by default** and reopens them via an **opt-in author-supplied source** (`generateStaticParams`-shaped); pattern-preserving emitters consume the template form directly. **Fabricating** a placeholder (`/users/0`, literal `:id`) is the named broken branch — it emits artifact-invalid fictions (SEO-poisoning, 404-prone). Requiring a source on *every* emitter is over-restrictive (punishes pattern-preserving emitters that never need concrete values) → most-flexible-default: the restriction is the author's opt-in. A skip is **surfaced** (build-time notice), not silent — but the notice changes no artifact, so it is an ergonomic affordance, not a third branch.
- **Realize a declared axis; never stand up a second home for it.** When a derived artifact describes the *same* structure a declared intent axis already owns (an IA nav-tree vs the Navigation Intent's `structure` axis), the emitter **realizes** the declared axis (one composed home: intent = UX declaration, emitter = derived artifact); deriving an independent artifact that can silently contradict the declaration is the two-unreconciled-homes drift [single-SoT](#single-authoring-sot-derived-projection) forbids. The fallback to a self-derived shape applies **only when nothing is declared** (the degraded case of realize, not the rejected independent-derivation branch).

**Lineage:** #1688 (ratified 2026-06-24 — webrouting route-table derivations: emitter set support-all; Fork 1 → (a) exclude-by-default + opt-in param-source + pattern-predicate + build-time skip notice; Fork 2 → (a) IA-tree realizes the Navigation Intent `structure` axis + intentless path-nesting fallback; both skeptics SURVIVE; prep `/research/webrouting-route-table-derivations`; reads now-resolved #1685). Build slices graduate to epic #1684 via `/slice 1684` (emitter registry + four emitters as separately-prioritized items + the Fork-1 param-source hook). Sibling of [single-authoring-sot-derived-projection](#single-authoring-sot-derived-projection) and [url-as-state-per-component-seam](#url-as-state-per-component-seam) in the webrouting cluster; instances of [config-extends-platform-default](#config-extends-platform-default), most-flexible-default, and [native-first-baseline](#native-first-baseline) (Speculation Rules / `sitemaps.org/0.9` substrates).

### URL-as-state is a per-component router-agnostic seam behind a typed codec lock; write-coordination lives at the component, never a central provider {#url-as-state-per-component-seam}

When a stateful component projects state to/from the URL (a grid's filters/sort/page, a tab, a wizard step, pagination), the canonical seam is **per-component declaration**, not a central router-coupled provider. A component **declares which slices sync** router-agnostically — so it syncs whether or not a router is mounted (the pagination precedent already writes the URL router-free; a central provider would couple every stateful block to a mounted router and break the standalone case). Three facets ratify together:

- **Codec is a typed per-slice strategy-lock, not raw strings.** Each syncable slice has a declared `serialize/parse` + coercion contract (number/boolean/enum/date/array, raw-string escape hatch) — a registry like [`CustomStorageStrategy`/`CustomChangeStrategy`](#) so Zod/nuqs *plug in* behind it; WE ships the contract, never the parser. Raw `URLSearchParams` strings are provably insufficient (they force the per-component coercion drift already visible in pagination's ad-hoc `Number(raw)`), and no existing layer owns string↔typed URL coercion (webexpressions is a `{{ }}` binding layer; the storage protocol self-excludes non-durable facets).
- **Write-coordination is scoped to two mechanisms, both component-side.** Intra-component **microtask coalescing** (always — one write per component per tick, History-presence-guarded for SSR/no-DOM) plus an **optional coordinator** that batches *cross-component* concurrent writes into one history entry (the nuqs batching model). Both write paths share the **same** per-slice codec — only the commit (one entry vs N) differs — so there is one encoding, not two. A pure-per-component variant with no coordinator is rejected (re-creates cross-component history-spam).
- **Placement: webrouting owns the URL persistence facet.** The "URL or not" axis is the navigation intent's `persistence` (`url | session | memory`, `we:src/_data/intents/navigation.json`) generalized per slice — never a webstates storage strategy (the storage protocol is scoped to durable structured-record stores ONLY and carves out the shareable/navigable/history-tied URL). Sync is **never forced**: per-slice opt-in with a permissive non-URL default (most-flexible-default). Contract clauses spelled out at build: namespaced query keys (collision arbiter), popstate/navigate is the read source of truth (back/forward restores true state), pure codec + History-presence-guarded writes.

**Lineage:** #1686 (ratified 2026-06-23 — Fork 1 → (c) per-component declaration + shared codec + optional coordinator; Fork 2 → (b) typed per-slice codec; both skeptics SURVIVE; prep `/research/url-as-state-component-seam`; reads now-resolved #1685). Build slices carve under epic #1684 (codec contract + declaration/coordinator seam + conformance vectors; pagination's ad-hoc `urlSync` migrates onto the seam). Sibling of [single-authoring-sot-derived-projection](#single-authoring-sot-derived-projection) in the webrouting cluster; instances of [runtime-di-vs-devtools-provider-seam](#runtime-di-vs-devtools-provider-seam) (the codec is a runtime strategy-lock) and most-flexible-default.

### Runtime/dynamic route ingestion reuses the injector seam with a distinct runtime route-object shape — not the serializable projection; resolution is name-by-DI default / inline override; precedence is config-extends-default, not a knob {#webrouting-runtime-route-ingestion}

`route-view` ingests static `<template route>` children today; the **runtime/dynamic** path (dynamic route objects + lazy component-from-URL) reuses the **injector-context DI mechanism** (`fui:plugs/webinjectors/InjectorRoot.ts`) — a new sibling `customContexts:routes` key — carrying a **distinct runtime route-object shape** `{ path, guard?, guardLeave?, loader?, outlet?, isErrorBoundary?, component? }`. That shape is **not** the #1685 serializable projection: `buildRouteMap` drops the non-serializable `pattern`/`template` and its closed `ENTRY_KEYS` rejects a component field, yet the engine must have a `template`/component to stamp (`fui:blocks/router/elements/RouteViewElement.ts:498`) — so #1685 is the **serialization/transport** contract, *never* the live engine input. (This **refines** [single-authoring-sot-derived-projection](#single-authoring-sot-derived-projection), which had anticipated the runtime input "reuses the *same* schema" — it reuses the *mechanism*, with its own runtime shape.) Four facets ratify together:

- **Reuse the mechanism, add a value shape (not a new contract).** `customContexts:routes` is set/read exactly like `customContexts:routeLoader`; only the value shape is new. A brand-new provider API is rejected (forks the seam for no payoff).
- **Resolution is name-by-DI *default*, inline-fn *override*** — for loader/guard and component alike. A route object references a callable by **name** (resolved through the inherited injector maps) *or* carries an **inline function/thunk** used as-is. The serializable/DOM form stays **string-only** (names + specifiers); inline fns are a JS-runtime affordance the #1685 projection drops — so the serialization contract is untouched. This is most-flexible-default: name-DI and inline are both *optional*, never a *mandatory* registry (the rejected branch).
- **Lazy component = `route:component`** inline `() => import()` thunk (JS) / bare specifier string (DOM); the data `route:loader` stays independent and eager. Named `route:component` (not `route:module`) to disambiguate from the data loader and match Angular/Vue (`loadComponent`).
- **Three authoring surfaces, all merging under one precedence config.** (i) DOM `<template route>`; (ii) the `customContexts:routes` injector provider; (iii) a settable `routes` property on `<route-view>` (the getter already exists, `fui:blocks/router/elements/RouteViewElement.ts:48`). Merge precedence is **not a bespoke knob** — it is a `mergePrecedence` field on the platform default config ([config-extends-platform-default](#config-extends-platform-default)): default `static-first` (static-first concatenation, first-match-wins, + a `console.warn` shadowing diagnostic mirroring `[Router] Invalid route pattern`, `we:blocks/router/types.ts:213`), a project config *extends* to override (`dynamic-first`). Adding an unused per-view/per-provider knob ahead of a consumer is the rejected anti-pattern. A nested `route-view` must **merge** the resolved `customContexts:routes` with its local static parse, never let `getProviderOf`'s first-found-wins **shadow** it (shadowing a route *set* is data loss, unlike a benign fn-map).

**Lineage:** #1823 (ratified 2026-06-27 — Fork 1 → (a) reuse injector + runtime shape + merge-not-shadow [skeptic REFUTED→flipped off the #1685-as-input branch]; Fork 2 → (a) `route:component` inline/specifier + name-DI/inline-override resolution + settable `routes` property [skeptic SURVIVES-WITH-AMENDMENT]; Fork 3 reframed fork→dimension delivered by config-extends-default [skeptic SURVIVES-WITH-AMENDMENT→REFRAMED]; prep `/research/webrouting-runtime-route-ingestion`; reads ratified #1685/#1721). Unblocks build story #1720 (`blockedBy: ["1823"]`). Sibling of [single-authoring-sot-derived-projection](#single-authoring-sot-derived-projection), [faithful-derivation-exclude-not-fabricate](#faithful-derivation-exclude-not-fabricate), and [url-as-state-per-component-seam](#url-as-state-per-component-seam) in the webrouting cluster (epic #1684); instances of [config-extends-platform-default](#config-extends-platform-default), most-flexible-default, and [runtime-di-vs-devtools-provider-seam](#runtime-di-vs-devtools-provider-seam).

### A lazy `route:component` module→tag contract is the auto-define dimension; preset-flavor default is on-import self-register + tag-on-route, engine stays default-less {#lazy-route-component-auto-define-default}

#1823 settled that a runtime route object carries `component` = `() => import()` thunk (JS) / bare specifier (DOM) but **deferred how that module becomes a stampable tag** (the engine stamps by cloning a concrete `template`, `fui:blocks/router/elements/RouteViewElement.ts:498`; a lazy module yields neither a template nor — by default — a tag). This is **not a three-way fork** — `on-import` self-registration and `engine-defines` are both named end-states on the ratified **`auto-define` configurable dimension** ([config-extends-platform-default](#config-extends-platform-default), #227), so the call is to set the *default*, not bake a mechanism:

- **The route-engine code is default-less** — it resolves the auto-define strategy from settings, never a constant in the engine (the `CustomRegistry.extends` precedent; core stays default-less).
- **The platform-preset flavor ships `on-import self-register + tag-on-route`** — the lazy module **defines its own element as an import side-effect** (dominant ESM idiom); the **`tag` rides on the route value** (a companion field / `route:component-tag` attr in DOM, never read off the module); the engine `await`s the load then `createElement(tag)` and **never calls `customElements.define`**. Mirrors the ratified block loader field-for-field (`await load()` → `createElement(shape.tag)`, `fui:workbench/loader.ts:56-68`, #1731) and Vaadin (tag-on-route + self-registering import).
- **`engine-defines` (default-export ctor → engine `customElements.define`) is the per-scope override**, reachable through `CustomAutoDefineRegistry` / config-extends-default — **never foreclosed**. It is not the default because it must invent a tag (generation/collision policy), is non-idempotent across navigations (re-`define` throws), and double-defines when the module also self-registers (the common case). The thunk-returns-tag variant folds into the default as a JS-only shorthand (tag arrives as the thunk's resolved value).
- **tag-on-route, NOT a `mod.tag` module export** — no cited precedent reads the tag off the module, and a `mod.tag` export force-fails on third-party elements (you can't add an export to vendor bytes; you can write the tag on your own route).

**Lineage:** #1897 (ratified 2026-06-27 — decision over not-yet-shipped code; Fork 1 reframed fork→dimension; skeptic SURVIVES-WITH-AMENDMENT [`mod.tag`-export sub-default REFUTED→tag-on-route]; statute COLLISION reconciled — worded as the engine's *default*, not an "engine never defines" invariant; prep `/research/webrouting-lazy-component-module-to-tag`). Unblocks the lazy half of build story #1720. Sibling of [webrouting-runtime-route-ingestion](#webrouting-runtime-route-ingestion) in the webrouting cluster (epic #1684); **instances** [config-extends-platform-default](#config-extends-platform-default), reusing the self-register-on-import + tag-on-descriptor precedent of the block loader (#1731).

### Framework-free core; vendor frameworks segregated at the package boundary {#framework-free-core-vendor-segregation}

Frontier UI's **framework-free principle scopes to the core/floor packages only** — *not* identity-wide.
A framework-coupled vendor adapter lives in its **own published `@frontierui/<block>-<vendor>` package**, with
that vendor's framework as a **normal dependency of that package alone**, loaded **opt-in via a plain dynamic
`import()`** so the core's dependency tree stays *provably* framework-free. The whole mechanism is "a published
package + a dynamic import" — **no Module Federation**. If cross-deploy runtime sharing is ever needed, it uses
web-standard import-maps / Native-Federation, never webpack Module Federation (per the bundler-agnostic axis).

**Lineage:** #963 (Slate/React optional-dep fork). Refines — does not duplicate — [constellation-placement](#constellation-placement)
(WE/FUI/Plateau division); this is *intra-FUI* framework containment.

### WE-owned generated data crosses to FUI by build-emit + a FUI-served route, never a bundled read of WE's tree; the executable serve contract stays executable-only {#we-data-crosses-via-fui-served-route}

WE owns the generator for a derived artifact (component **source/CEM**, etc.), but FUI carries **no
`@webeverything` package dependency** and its dev-only sibling aliases vanish at deploy. So WE-generated data
reaches FUI's runtime by a **build-time CLI/copy emit into FUI's own deployable**, then a **FUI-served HTTP
route** the consumer fetches — **never** a bundled/aliased read of WE's tree (deploy-broken) and **never** a
runtime dependency on a live WE-hosted service. One route contract, two byte sources: **dev** runs the WE
generator in FUI's MaaS dev-server *middleware* in-memory (per-request / on file-watch — never stale);
**prod** serves the build-emitted committed copy. This honours #954 (FUI never imports the runtime `serve()`
engine into its bundle — fetching pre-emitted JSON over HTTP is consuming data, not running the transform)
and #700 (no WE package dep). Corollary: the **executable** serve contract (`servePathIR`, `javascript`/
`html`/`error` media + `?form=`) stays **executable-only**; inspection artifacts (source/CEM) get a
**distinct** data route (esm.sh `?raw`-style), never a widening of the executable catalog.

**Lineage:** #1731 (workbench source/CEM crossing). Refines [constellation-placement](#constellation-placement)
(WE/FUI/Plateau division) and #1499 (cross-origin FUI serve); applies #954/#1701 (author-mode data placement).

### Inert workbench display data rides as a static descriptor slot read directly (like `cem`); the FUI-served `/_maas/data/` route is the dev-freshness HMR seam, not the primary transport {#workbench-inert-data-static-slot}

Once a derived **inert display artifact** is generated wholly inside FUI (e.g. author-mode **source** text after #1730/#1282 deleted WE's generator), the workbench consumes it as a **static slot on the thin descriptor** (`authorSource?`/`cem?` in `fui:workbench/registry.ts`) **read directly** for first render (`block.cem`, `block.authorSource`) — synchronous, no fetch. The **primary transport is the static slot**, not a runtime route. Dev freshness rides the **existing `/_maas/data/<tag>.json` HMR re-fetch**: a dev-only watcher (`fui:vite.config.mts` `cemHotReload` pattern) fires an HMR event on fixture change and the workbench demo (`fui:demos/workbench.ts`) re-fetches the data route and calls `refresh()` — never stale, no registry rebuild. `/_maas/`'s **executable** serve role stays reserved for **transpilable live modules** (polyglot React/Vue forms loaded by cross-origin `import()`, `fui:workbench/loader.ts`); static display text never routes through it as its baseline transport. This is not a *live instance*: serving rendered text is "consuming data, not running the transform" (#954), so the slot is inert data, not a behavioural closure, and does not reintroduce the imperative `load`/`create` the workbench banished.

**Caveat — ratified ~80% (#1865).** Revisit if the MaaS layer matures such that `/_maas/data/` becomes the routine transport for *all* descriptor data; the static-slot-as-primary call may then flip to serving author-source directly. Reversal is cheap — the consumer reads `block.authorSource` either way; only where the baseline value comes from changes.

**Lineage:** #1865 (author-mode source generation-home, ratified-with-caveat). Refines [#we-data-crosses-via-fui-served-route](#we-data-crosses-via-fui-served-route) (static-slot baseline vs route-as-dev-seam for inert data); applies #1730/#1282 (WE generator deleted → generation is a FUI concern), #1731 (`cem`/source crossing) and #954/#1701 (author-mode data placement).

### FUI-resident table compute reaches WE's offline build via a pinned subprocess (FUI-compute → WE-build), never a served route; the interactive cell carries its raw sort key as a `data-*` attribute on the SSR `<table>`, never a re-rendering payload {#ssr-data-table-build-harness}

The `<we-data-table>` evaluator and renderer both live in **FUI** (`CustomExpressionParser.evaluate`,
`renderDataTable`); WE's Eleventy build **cannot import** them (a WE→FUI code import is a banned backward DAG edge
per [constellation-placement](#constellation-placement)). So WE's offline build resolves a deterministic
`rows="[[ ref ]]"` binding into an SSR `<table>` across a **process boundary**, on two settled facets:

1. **Boundary mechanism (Fork 1 → a).** WE's Eleventy build **shells out to a FUI build-CLI** — deterministic context
   in (stdin), SSR `<table>` HTML out (stdout) — homing the harness in **FUI** (`locus`/`relatedProject: frontierui`);
   WE orchestrates over the subprocess. This is the **inverse direction** of
   [#we-data-crosses-via-fui-served-route](#we-data-crosses-via-fui-served-route) (that rule is WE-data → FUI-runtime;
   this is **FUI-compute → WE-build**), and it is a **subprocess, not a served route** — the offline-build sibling.
   Three forced amendments: the CLI is a **locked FUI build-artifact version** (incl. the DOM-shim/serializer),
   **never PATH-resolved** (else the build is non-reproducible); the request is **one batched process, keyed-array in
   / keyed-array out**, so one malformed table fails in isolation and is attributable; and **the build never reads the
   dev `/_maas/data/` route** — that route is the dev-freshness HMR seam ([#workbench-inert-data-static-slot](#workbench-inert-data-static-slot)),
   not a build transport. A build-time *fetch from a running origin* is the rejected branch (Bazel-style hermeticity:
   network-during-build breaks reproducibility); a WE→FUI *runtime package* dep is excluded (inverts the DAG).
2. **Interactive-cell format (Fork 2 → c).** The deterministic + **interactive** cell carries its **raw typed value as
   a `data-*` attribute on the SSR cell** (`<td data-sort-value="2026">Baseline 2026</td>`,
   `<th data-type="number" data-sortable>`); a small **in-place DOM enhancer** (the `<we-data-table>` CE's own FUI-homed
   client behavior) reorders/hides the **existing** rows. There is **no JSON island and no client re-render** — so the
   build↔client **render-skew class is structurally gone** (only one rendered table ever exists; nothing can drift).
   This **refines** [#block-data-ingestion](#block-data-ingestion)'s anticipated "serialized resolved context / JSON
   island" sketch (#1818 left the format open — "mechanism may flex, goal fixed"): the goal it fixed is preserved
   (the client sorts on **raw `field` values, never reparsed `<td>` text** — the correctness invariant), with a
   **native-first** ([native-first-baseline](#native-first-baseline)) mechanism — the raw key rides the cell as plain
   HTML (GOV.UK `data-sort-value` / `tablesorter` lineage). The cell text and its `data-*` key are **two attributes of
   one build-time projection** ([single-authoring-sot-derived-projection](#single-authoring-sot-derived-projection)),
   emitted in a single pass so the displayed value and its sort key can never disagree. In-place **grouping** is
   fiddlier than re-render; a surface that ever needs heavy grouping may opt *that surface* into an island — a localized
   exception, not a reopening of the default.

**Pinned artifact + build ordering (#1946).** The "locked build-artifact, never PATH-resolved" amendment
resolves to a concrete pin: FUI's `npm run build:tools` typechecks the CLI (`fui:tsconfig.tools.json`) then
esbuild-bundles it to **one self-contained ESM file at the fixed path
`../frontierui/dist/tools/data-table-build/cli.mjs`** (the main `build:plugs`/`tsconfig.json` cannot emit it —
its `@webeverything/*` sibling path-aliases root the program at the workspace parent, so `tools/` would land at
an unstable `dist/frontierui/tools/…`). `node_modules` deps stay external (happy-dom's CJS transitive deps
can't be ESM-bundled), so the artifact is invoked **from within the FUI checkout** against FUI's locked
lockfile — reproducible, not PATH-resolved. WE's Eleventy orchestration (#1905) resolves this **fixed relative
path** (no PATH lookup, no version probe) and shells `node <that> < batch.json > out.json`. **Build ordering:**
FUI `build:tools` MUST run before WE's `build:docs` (Eleventy) — WE's build assumes the pinned artifact already
exists; it does not build FUI. (A missing artifact is a hard build error, never a silent skip.)

**Lineage:** #1867 (ratified 2026-06-27 — Fork 1 → (a) FUI build-CLI subprocess, keyed-batch, version-pinned
[skeptic SURVIVES-WITH-AMENDMENT]; Fork 2 → (c) `data-*`-on-cell + in-place enhancer [skeptic SURVIVES-WITH-AMENDMENT];
prep `reports/2026-06-27-ssr-data-table-build-harness-boundary.md`). Fills the [#block-data-ingestion](#block-data-ingestion)
(#1818) build residuals (determinism predicate / build harness / interactive format). Inverse-direction sibling of
[#we-data-crosses-via-fui-served-route](#we-data-crosses-via-fui-served-route); shares the offline-vs-dev-seam line with
[#workbench-inert-data-static-slot](#workbench-inert-data-static-slot). Prerequisite for the #1600 table→data-table
family (#1609–#1613, repointed off #1867 onto the build story). The non-deterministic app case is #1827.

### Runtime-DI seam vs devtools provider seam {#runtime-di-vs-devtools-provider-seam}

A capability is a **runtime-DI standard seam** — a mandated `CustomXRegistry` or protocol — **only if
the running app or standard consults it at runtime** (#052/#081). A capability consulted by a **tool at
author / build time** (an upgrader analyzer, a version-migration *input adapter*, #094/#191) is a
**devtools provider seam**: plain injected providers, **never** a global mutable singleton or a mandated
protocol. The cargo-cult tells are a kinship doc-comment + a global mutable registry where a passed
provider would do — demote build-time providers *out* of the runtime-registry surface.

**Lineage:** #052/#081 (runtime registries the standard consults) · #094/#191 (upgrader analyzer / migration adapter = devtools provider seam).

### A declarative author-facing seam over an already-built provider is a non-rendering behavior/directive — not a new intent or protocol {#declarative-seam-over-existing-provider}

When a standard **already ships the transport** — a contract + a runtime-DI provider ([runtime-DI seam](#runtime-di-vs-devtools-provider-seam)) + a controlled vocabulary — and the only unbuilt piece is the **author-facing declarative seam** (a `data-*`-style annotation that says "do X on interaction I" *without* sprinkled imperative calls), that seam is a **non-rendering behavior/directive that consumes the existing provider**. It is **not** a new [Intent](#intents-ux-only) (intents are UX-only and *render a surface*; an emission/binding seam renders nothing, so an intent would be the catalog's lone non-rendering member) and **not** a new Protocol (the contract + vocabulary already exist — the seam adds *vocabulary entries*, never a new transport, like [compose-don't-duplicate](#compose-intent-dont-duplicate)). Whether to ship the seam at all is a genuine support-vs-not call (imperative-only is coherent, not broken), decided on **end-state merit** (every scaled prior-art ships the `data-*` binding) with the build filed as **separately-prioritized** ([fork-is-not-a-prioritization-tool](#)); two emission concerns sharing the emit-to-a-sink shape stay **two homes that compose** (one emits *through* the other), never an umbrella ([bias-toward-separation](#bias-toward-separation)). Native-first floor: unconfigured provider → silent no-op default.

**Lineage:** #1415 (telemetry declarative emission seam → behavior/directive over the built `CustomTracker` sink + Analytics Event Vocabulary; #1414 experiment-exposure composes through it). Sibling of [runtime-DI-vs-devtools-provider-seam](#runtime-di-vs-devtools-provider-seam) and [intents-ux-only](#intents-ux-only).

### A boolean flag is an access-control gate; a multivariate flag is the experiment intent — same provider shape, different outcome family {#flag-gate-vs-experiment-selector}

"Feature flag" is an **overloaded incumbent word** that splits by outcome family ([decompose-overloaded-vocabulary](#decompose-overloaded-vocabulary-by-semantic-source)). A **boolean** flag (on/off) **IS the access-control gate**: it is `authority: feature-flag` on the [access-control](/intents/access-control/) intent over the **Guard** provider seam — its outcome is **allow/deny**, a trust-crossing authz mirror. A **multivariate** flag (one of N arms) is the separate **[experiment](/intents/experiment/) / variant-assignment intent**: its outcome is **pick-one-of-N** (a rendering choice, **no security semantics** — an arm is not an authz verdict), resolved by a *distinct* evaluation provider (`@webeverything/contracts/experiment`, returning `{value, variant, reason}`). The two **reuse the same provider *shape*** (native-first default → project override → custom plug) but must **never re-conflate**: different outcome families, different trust boundaries. OpenFeature's own typed-flag distinction is the upstream precedent — a **boolean** flag is a gate, a **string/object** flag is a selector.

**Lineage:** #1414 (placement: feature-flags vs experiments) · #1481 (this note) · #1479 (experiment intent + evaluation-provider contract). Sibling of [decompose-overloaded-vocabulary](#decompose-overloaded-vocabulary-by-semantic-source) and [intents-ux-only](#intents-ux-only).

### A multi-strategy concern is a configurable dimension; default extends the platform {#config-extends-platform-default}

When a concern has **more than one legitimate end-state** (e.g. auto-define: explicit / eager-barrel /
on-import / on-first-use / build-parse / declarative-map / convention / SSR), model it as a
**configurable strategy dimension** — never bake one mechanism (the *dimension-vs-fixed-mechanic* rule).
The **default is the most-permissive / native-first** value, with the restriction as the author's opt-in.
Defaults live in a **project config that *extends* a fully-defined platform default** (flavors); the core
tool/registry itself stays **default-less** (core `CustomRegistry` `extends`; the JSX render-strategy axis
is the precedent).

**Where those values materialize (#1662).** Storage is **per-dimension**: each dimension stores its value +
its own `extends`-to-flavor chain independently (the `CustomRegistry.extends` shape generalized — an
*open-set* dimension *is* a `CustomRegistry` subclass; a *scalar/mode* dimension realizes the same chain as a
plain config object). **File-count ≠ schema-coupling**, so the project **author surface defaults to one keyed
file** (`webeverything.config.{ts,js,json}` — one key per dimension, any key *extractable* to its own file;
`most-flexible-default`). A **unified config file as the authoritative SoT is rejected** (god-schema coupling
+ project-facing-format lock-in); a unified surface is supported **only as a derived, non-authoritative
discovery view** (a resolver that *reads* the per-dimension configs). `extends` is an ordered **nearest-wins
array** (lazy lookup, *not* a destructive merge); the same chain nests platform→project→app→fragment, so
settings scope to any subtree (runtime DI) and unregistered strategies tree-shake out. The discovery-view and
config-loader *builds* are separately prioritized, not triggered by this ruling.

**Lineage:** #227 (auto-define strategy axis) · #080 (render-strategy precedent) · #1662 (materialization:
per-dimension storage + one-keyed-file author surface + discovery-view). Process forms in [conventions.md](conventions.md) / [architecture.md](architecture.md).

### Compose an existing intent — don't duplicate an owned model {#compose-intent-dont-duplicate}

The intent-level analogue of [compose-don't-hand-roll](#compose-dont-handroll). When a standard needs
async / lifecycle / interaction behavior a **registered intent already owns**, it **composes that intent
and cross-references it — it never spins up a parallel model**. `<Resource>` resolves *through* the Loader
Intent's state machine (`idle|pending|success|error|stale|loadingMore`) rather than re-implementing one
(#124); a Menu block composes the owned anchor / focus / type-ahead / selection / disclosure intents and
builds **only the one genuinely-missing intent** (command invocation), not a fresh interaction stack
(#173). Build only the irreducibly-new vocabulary; wire the rest.

**Lineage:** #124 (Resource → Loader Intent) · #173 (Menu → existing intents + the one missing `command`). Sibling of [compose-dont-handroll](#compose-dont-handroll).

### A thin role-container over a shared primitive stays a preset/parameter until a 2nd consumer; graduate to a block then {#thin-container-graduation-trigger}

The placement face of [compose-intent-dont-duplicate](#compose-intent-dont-duplicate), for APG
composite-widget *containers* (toolbar, menubar, tabs-container). The roving/managed-focus algorithm is
**not** the container's — it is the owned `focus-delegation` intent + its `composite-widget` behavior
block, which the container *consumes* (`strategy=roving; orientation=…`). What the container actually adds
is a thin role surface — a `role` value (`role="toolbar"`), separators, a label, grouping — too small to
justify a first-class artifact on its **first** consumer. **The rule:** carry that role surface as
**assemblerPreset config + a `role` parameter on `composite-widget`**, *not* a new intent (no UX dimension
of its own) and *not* yet a new block. **Graduation trigger:** the moment a **second** container consumer
wants shared *container* concerns (separators, overflow, label), promote the preset into a **thin block**
composing `focus-delegation` + `action`. One consumer → preset; two → block. Matches Radix/Ariakit/React
Aria (thin role wrapper over one shared focus primitive; the algorithm is never re-homed per container).

**Tell:** a candidate "new roving control-group standard" names a role but supplies no focus mechanic of
its own (it delegates arrow-nav wholesale) — that's a consumer of `focus-delegation`, not a new standard.

**Lineage:** #1409 (Toolbar — roving unit = `focus-delegation`+`composite-widget` consumer (Fork A,
resolved invariant); container semantics = the webdocs `toolbar` assemblerPreset + promoted
`composite-widget`, thin `toolbar` block gated on a 2nd container consumer (Fork B)). Surfaced by the
ARIA-APG lens #1400; sibling of [compose-intent-dont-duplicate](#compose-intent-dont-duplicate) and
[intents-ux-only](#intents-ux-only).

### Decompose an overloaded incumbent word by semantic source; never widen one intent to absorb a foreign family {#decompose-overloaded-vocabulary-by-semantic-source}

The split-side complement of [compose-intent-dont-duplicate](#compose-intent-dont-duplicate). Incumbent
design systems overload a single word (classically **"badge"**) across **distinct semantic families** —
a decorative/categorical label (author-supplied tone, static, no provider), a lifecycle/state status (an
entity's state machine), a count/dot notification marker (a number overlaid on a host). The word lands in
a *different* family per system (shadcn's Badge is decorative; Ant's Badge is a count marker). The rule:
**carve one intent per semantic family along the semantic-source axis**, and **never widen an existing
intent to admit a foreign family** — widening *dilutes* the absorbing intent (a decorative label has no
provider/transition/state, so a lifecycle intent's machinery would have to go optional and hollow,
falsifying its own contract). The unhomed family earns its **own** home; the name must avoid colliding
with a token or element already owned by a sibling family (`badge` is a `shape` token; `label` collides
with the form-label intent **and** the HTML `<label>` element). Interactivity is **composed** (Action /
Selection), not baked in.

**Tell:** an incumbent component maps "close enough" onto an existing intent but supplies none of that
intent's defining inputs (no provider, no state, no transitions) — that's a foreign family asking for its
own home, not a widening candidate.

**Lineage:** #009 (Notification Marker — split the count/dot family off "badge") · #1319 (Tag Intent —
split the decorative label family off "badge"; Status Indicator keeps lifecycle) · #1395 (Mutation Intent —
the word **"optimistic"** is overloaded across two axes: a *read/blocking* strategy on `loader` ("don't
block the UI, sync in background") vs a *write apply-then-rollback* lifecycle; carve a first-class `mutation`
intent (symmetric to `loader` for reads) rather than widen the visual-weight `action` intent — `action`
supplies none of the write-lifecycle's inputs, the foreign-family tell). Inverse face of
[compose-intent-dont-duplicate](#compose-intent-dont-duplicate); kin to [reproduction-conformance](#reproduction-conformance)
(the gap sweeps that surface these overloads) and [intents-ux-only](#intents-ux-only).

### Configurability partition — declarative vocabulary is the portable standard; imperative is the per-impl escape hatch {#configurability-partition}

A runtime-agnostic standard's **author-facing configuration** splits along the **declarative/imperative
line**, *not* along "the reference impl vs others." A **declarative strategy vocabulary** (options expressed
as *data* — `sort by field, desc`; `group by tag`; an order pin) is **part of the standard**: portable,
golden-vector-locked, honored identically by **any** conforming implementer. An **imperative custom
function** (a JS/C# sort fn) is **inherently non-portable** (code, not data), so it is a **per-implementer
escape hatch**, never in the standard — and reaching for one is an explicit, **graceful-degradation** opt-out
of cross-implementer reproducibility for that aspect (another implementer declares non-support and falls
back to the declarative default, never silently differs). Consequences: configurability is **unbounded at
two levels** (portable declarative + per-impl imperative) without bloating the contract; the named
implementer is the **reference** impl, not "the engine" — the standard stays runtime-agnostic so a second
generator (`.NET`/Go) is a first-class possibility; the declarative vocabulary **starts minimal and grows on
demand** (promote a popular escape-hatch option into the vocabulary when real demand / a second implementer
appears — grow the *vocabulary*, not an impl's private knobs). Reproducibility (e.g. #091 no-drift) holds
across *any* implementer over the declarative surface, degrade-gracefully over the imperative one. **Tell:**
when "we must let people customize X" tempts a vendor-injected plugin *inside* the contract, the right move
is a declarative vocabulary entry (if expressible as data) **plus** an imperative escape hatch outside the
contract — never an imperative seam folded into the standard.

**Lineage:** #1163 (webdocs Doc Spec — declarative `docs.*` vocabulary in WE, custom `SortStrategy` fn as a
per-impl escape hatch; FUI = reference impl); #1687 (webrouting technical-config — the serializable route-config
schema admits *every* setting with merit + real-app use, placed by serializability: serializable deploy-shaped
settings → the config schema, author-in-code forms (a `scrollBehavior` fn, a per-route `import()`) → the block/markup
escape hatch; the set is open and grows as apps surface settings — never an exclusion). Composes [surface-contract-not-computation](#surface-contract-not-computation)
(pin surface / swap impl), [intents-ux-only](#intents-ux-only) + Intents-Open-Design (standardize the
meta-schema, not the list), and the minimize-lock-in / escapable-lock principle; the config-surface analogue
of [forward-generation-adapters](#forward-generation-adapters) (contract is the authority, code crosses no seam).

### Presentational variants are an open-numbered axis off one semantic contract {#open-numbered-variants}

When two things differ **only in presentation** — same semantics, same behavior, same DOM — that
variation is an **open-numbered axis**, never a closed enum. WE standardizes the **variant contract**
(*a value names a purely-presentational treatment that leaves the semantic meaning and behavior
unchanged*) **plus a recommended core set**; authors **mint as many members as they want from that
contract** (Intents-Open-Design applied to the presentational axis — standardize the meta-schema, not
the list). Membership is a **semantic test**, not a vote: *differs only in presentation* → a valid
member; *differs in semantics* (changes role, behavior, navigation) → a **different contract**
(different intent/dimension), never folded in. The axis lives **on its owning intent** (value sets are
intent-specific — a button's `ghost`/`link` ≠ an input's `borderless`), never as a shared cross-cutting
intent that would flatten the divergent vocabularies. Name the axis for the *treatment*, not the
attention it draws (`variant`/`treatment`, not `emphasis` — prominence is a separate semantic axis).

**Ceiling — variant vs block polymorphism.** The rule is bounded to **presentational treatment of one
rendering**. Three tiers: (1) **intent** = the semantic contract; (2) **variant** = a value the *same
block, same DOM* renders differently, CSS/token-reachable; (3) **block polymorphism** = when materially
**different DOM/markup** is required (one single-select intent as radios *vs* a segmented control *vs*
card-tiles), which is interchangeable *blocks* under one intent or a *structural/layout* axis — **not**
a variant value. **Diagnostic:** *can I reach it with CSS/tokens on the same markup?* — yes → variant;
no → block/structure layer. This stops "everything visual is a variant" sprawl. Generalizes beyond
Action to **sectioning and layout**: define the semantic contract once, expose presentational variants
as an open-numbered axis. Surface is a **plain attribute consumed by CSS** (`button[variant]`) — no
wrapper required, because a behavior-free axis needs none.

**Lineage:** #1318 (Action Intent `variant` axis — `fill | outline | ghost | link`, open vocabulary;
`link` in the core set; named `variant` not `emphasis`; renders via plain attribute, no wrapper).
Composes [intents-ux-only](#intents-ux-only) + Intents-Open-Design, [compose-intent-dont-duplicate](#compose-intent-dont-duplicate)
(divergent vocabularies stay on their owning intent), and the most-permissive-default / native-first
floor. Follow-ups: #1320 (build) · #1321 (FUI variant-surface packaging) · #1323 (sectioning/layout
application) · #1324 (`level`-as-outcome-role).

**Tone extension (#1427).** Applied a third time, to the cross-intent **`tone`** axis (semantic
color/severity). Same holding — the **value enum stays per-intent** (action `neutral | danger`; message
`neutral | positive | caution | negative`; status-indicator `+progress`; tag `+categorical`;
feedback/sys-notif `info | success | warning | error`), a flat shared enum is **rejected** (flattens; the
Bootstrap `btn-warning` smell). The tone axis adds **one nuance variant lacks: a shared DRY token layer.**
Because tone *is* color, the shared layer is two things, not one: (1) a shared tone **meta-contract** (*a tone
value names a semantic color/severity family the theme resolves — never a hex; open-numbered; membership test
= differs only in semantic color, not behavior/lifecycle*), and (2) a shared **`--tone-*` token palette** in
webtheme. The palette is **severity-family only** (`neutral · danger · success · warning · info · critical`);
values that fail the membership test stay **intent-local tokens** — `progress` (a lifecycle state) and
`categorical` (non-severity identity color) never enter the shared palette. Dimension name standardized to
**`tone`** with a canonical synonym table (`danger ≡ negative ≡ critical ≡ error`; `success ≡ positive`;
`warning ≡ caution`); `info` and `neutral` stay **distinct** (collapsing them is lossy). Action keeps
`neutral | danger` regardless (#1337, non-negotiable). Realized by #1458 (palette + statute) / #1459 (rename
sweep). Composes [intents-ux-only](#intents-ux-only) (tone is UX-only; the theme owns the hex).

### The presentation/style axis is intent-owned — never a parallel cross-cutting style vocabulary {#presentation-axis-is-intent-owned}

A standing temptation is to mint a **cross-cutting presentation vocabulary** — a `finishes`/style sibling to
intents (`rounded=md`, `shadowed=heavy`, `bordered`, `hover=shine`) that applies to *any* surface. **Rejected on
merit.** The presentation/style axis is owned by **intents** (one open model for *all* UI/UX config); a parallel
vocabulary over an axis an intent already homes is the *second home* that [realize a declared axis; never stand
up a second home](#) forbids, and the lone-card consumer never met the *real cross-cutting consumer* bar. Two
clarifications make this operative:

- **"UX-only" means semantic/declarative (what/why, no impl refs — the #030 intent/trait split), NOT
  "non-presentational."** `texture=glass` / `elevation=3` are legitimate **presentational intents** because each
  carries a semantic story; the trait resolver maps them to CSS. Presentation-as-declared-semantic belongs in
  intents.
- **The pure-decoration edge → theme tokens, not a vocabulary.** A CSS knob whose "what/why" is genuinely thin
  (a raw corner radius with no semantic role) stays a **theme token** (`--radius-*`), owned by webtheme. "Belongs
  to no intent" argues *token*, never *new intent-sibling vocabulary*. Where a presentation value **does** carry
  semantics, **extend the owning intent's dimensions** (add `radius`/`border` to `surface`) — standardize the
  meta-schema, not the list.

So every presentation concern routes to one of two existing homes — **intent dimension** (semantic) or **theme
token** (decoration) — never a third cross-cutting style home. **Reversibility:** a *future* real consumer that
needs one vocabulary spanning **multiple** intents, and **proves** intent-owns-the-axis cannot carry it, reopens
this as a fresh merit fork (a hypothesis of cross-cutting need is not such a proof).

**Lineage:** #1884 (ruled NO to a parallel presentation-trait vocabulary; prep's NOT-YET reframed to a merit
ruling — prioritization is not a fork branch). Composes [intents-ux-only](#intents-ux-only) (open never-finished
system; custom intents coexist), [open-numbered-variants](#open-numbered-variants), realize-a-declared-axis, and
no-orchestrator-until-real-consumer. Follow-ups: #1911 (realize `surface`) · #1912 (extend for `radius`/`border`
residual) · #1913 (realize app-authored custom intents — the open-system promise).

### App-authored custom intents — namespace by ownership, at the intent *and* value layer {#custom-intents-namespace-by-ownership}

Realizes the [intents-ux-only](#intents-ux-only) promise that intents are *"an open, never-finished system — standardize the meta-schema, not the list."* A product may **mint and use its own intents** through one meta-schema, with collision-freedom guaranteed by **namespacing by ownership** (RFC 6648: never by *status* — `x-`/`custom-` lie on promotion and force an interop-breaking rename). Three settled axes:

- **Namespacing (intent id).** A custom intent id is **scope-prefixed `owner:intent`** (e.g. `acme:lozenge`); **standard ids stay bare** (`action`, `navigation`). The `:` plays the custom-elements-dash role — a bare standard id can never collide with a scoped custom id, current or future — and is free of the `.`-delimited dimension keyspace (resolver `lastIndexOf('.')`). Promotion to standard = **drop the prefix** (an alias/registration), never a rename. (Colon chosen over the npm-scope `@owner/intent` spelling: `:` needs no path-like ceremony and is keyspace-safe.)
- **Unknown-intent behavior = most-permissive ignore (forward-compat).** An id the engine doesn't recognize **degrades to most-permissive** (its traits are simply ungated), per the **must-ignore discipline** of every extensible format (HTML unknown tags, CSS unknown properties, JSON unknown fields): a manifest authored against a *newer* vocabulary must degrade, not hard-break, on an *older* engine. Per-intent **`mustUnderstand: true`** is the author's fail-fast opt-in (SOAP/`Prefer: handling=strict` precedent); a **build-time `warn`** on an unrecognized *non-namespaced* id closes the silent-typo footgun without re-breaking forward-compat (a throw would). *This is forward-compat, not the value-default rule — `:385` is supporting, not dispositive.*
- **Composition (`extends`) is additive, never override.** A custom intent may **add wholly-new (namespaced) dimensions**, and may **add values to a standard dimension iff that dimension is open-numbered AND the value is namespaced (`owner:value`)** — e.g. a consuming lib adds `acme:caution` to an open severity axis with its own style/ordering; promotion = drop the prefix. It may **not** override/shadow an inherited dimension (the *second-home* drift [presentation-axis-is-intent-owned](#presentation-axis-is-intent-owned) forbids), and **closed enums stay untouchable by anyone** (#1337, e.g. action `neutral|danger`) — a closed set is closed because it is **semantically load-bearing** (a downstream consumer — a11y live-politeness, alert routing, log-severity — must understand every member). **Open-vs-closed is the gating judgment:** open when nothing downstream *reasons over* the values (pure presentation), closed when a finite set drives behavior/a11y/semantics. Bare (non-namespaced) cross-author values and closed-enum widening are **rejected at validate-time**.

This is the **value-level corollary of [open-numbered-variants](#open-numbered-variants)**: #1318 opens values *within* a standard intent for the **single WE authority**; this extends that openness to the **cross-author** case via ownership-namespacing (`owner:value`), since #1318's flat unnamespaced model was never written for multiple authors. **Placement (#1282):** the meta-schema *definition* + the `validateIntent` extension live in **WE** (the sanctioned definitions-plus-validate-script carve-out); the product-manifest **glob loader** and any **runtime register-API** are runtime impl → **FUI / the product** (the register-API is a demand-gated follow-up — declarative build-time manifest is the existing seam now). **Disambiguation (#1948):** the reusable build-time *substrate* that assembles `{standard catalog + product manifest}` and **invokes** the #776 WE resolver is a **bundler plugin → FUI** (`fui:tools/intent-resolver/`, the structural twin of `fui:tools/trait-enforcer/`) per [devtools-placement](#devtools-placement) rule 2; the product (plateau-app) supplies only its `owner:intent` manifest (product data) and wires the FUI substrate into its own build; the operator-facing intent-*configurator* is the part that is Plateau (rule 3). A *new* WE-resident substrate is excluded ([constellation-placement](#constellation-placement) rule 1 + #1771 — WE holds zero impl); "FUI = the substrate, product = the manifest + configurator" fills the single ambiguity #1913's "FUI/product" left. Composes [intents-ux-only](#intents-ux-only), [open-numbered-variants](#open-numbered-variants), [presentation-axis-is-intent-owned](#presentation-axis-is-intent-owned), and the #1337 closed-enum line.

**Lineage:** #1913 (surfaced by #1884 — the presentation axis is intent-owned *only if* apps can extend the model). Prior-art survey (7 systems: custom elements, CSS `--`, DTCG `$`, npm scopes, reverse-DNS, ARIA states, RFC 6648). Forks ratified 2026-06-28. **#1948** (ratified 2026-07-01 — the reusable resolution substrate → FUI; default (a), skeptic SURVIVED with two amendments folded in prep: rule 2 re-based as primary FUI-vs-product authority, rule 1/#1771 demoted to "excludes WE"). Gates #1930.

### Component composition lives on three substrates — WE contract / FUI primitive / product component {#identity-semantic-look-composable}

**Every "how do we build component X" question reduces to one: which substrate owns the responsibility.**
Fix the boundary once and the 100s of downstream calls (does a card have a title? what namespace? section
or article? where does the heading go?) become **mechanical placements, not decisions**. The card is this
principle's worked example.

**The substrate boundary.**

| Substrate | Owns | Deliberately does NOT own |
|---|---|---|
| **WE** — *standard* | the **contract**: semantic identity + the minimal invariant; names what a thing *is*. **Under-specifies on purpose** — any "a card has a title" claim is contradicted by the next design. | concrete structure, optional parts, look values |
| **FUI** — *implementation* | the **primitive**: the reusable mechanism realizing the contract — transient root-binding, root resolution, the tokenized base style hook (`.fui-card`, token-driven `CARD_CSS`), slot/prop machinery. Product-agnostic. | any product-specific design opinion (titles, footers, menus) |
| **Product** — *composition* | **concrete, semantically-named, namespaced components** composing primitives into what *this* product needs (title, footer, items, menus, behaviors). Lives in the **product's own frontend** (e.g. the WE website), **not** WE/FUI. | the standard/primitive — it *consumes*, never re-mints |

**Two consequences of "identity = semantic element, look = orthogonal style":**

1. **Different semantic value ⇒ different element.** A card (`<article>`, a self-contained composition)
   and a section (`<section>`, a thematic region) have different semantic value → different elements.
   They may share a *look*; that shared look is a **style**, never a shared element. (Role/variant minting
   restated: *different arrangement → distinct entity; same arrangement, different look → variant* — see
   [tagname-naming](#tagname-naming)'s "name by semantics, not by uniformity".)
2. **Native elements are the semantic standards; WE recognizes, it does not re-mint.** Settling thought
   experiment: *if HTML had no `<article>`/`<section>`, would WE mint standards for them? Yes.* So they
   are semantic standards the platform already provides — [native-first](#native-first-baseline) means WE
   builds the style layer on top, never wraps a custom element around a sufficient native one.

**Delivery is a composed web component — never a classname.** At *both* the FUI-primitive and
product-composition layers the deliverable is a custom element (own tag, multiple elements, props, slots,
behaviors), **not** a hand-authored class. `<section class="fui-card">` is only the degenerate look-only
*runtime residue*, never the authored artifact. **Native-first is preserved as a constraint *on the
composition*:** each component composes the correct native root internally (landmarks/roles/a11y) and never
reinvents a sufficient native primitive — but the unit delivered is the component.

**The card, worked example (#1886).**

- **WE** — the card *contract* only: "a styleable surface bound to a self-contained-composition root." No
  title/footer claim.
- **FUI** — the **transient primitives**: `we-card` (`resolveTag(): 'article'`,
  `fui:blocks/card/CardElement.ts:17-21`) and `we-section-card` (`resolveTag(): 'section'`). Authored as
  tags, they **erase to** `<article class="fui-card">` / `<section class="fui-card">` at runtime (transient
  — composition, not subclassing). Base style hook `.fui-card` (`fui:blocks/card/Card.ts:34` `BASE_CLASS`),
  token-driven `CARD_CSS`.
- **Product** — the WE website composes `standard-card` (`= we-card` + title + footer + items + …) and a
  section-rooted `standard-section` (`= we-section-card` + …), keeping each `<hN id>` heading verbatim so
  in-page anchors survive. **These live in the website, not WE/FUI.** The FUI-vs-product line, when it
  blurs, is settled by [reusable-against-all-implementers → neutral home](#reusable-neutral-home):
  product-agnostic + reusable ⇒ graduate to an FUI primitive; product-specific ⇒ stays in the product.

**Root polymorphism — intrinsic-yes / extrinsic-author-fiat-no (#1886 Fork 1).** Reject the *extrinsic
author-fiat* `<we-card as="section|article">` — one tag whose DOM root is an author *override* that can
contradict content. It imports React's `as=` (a workaround for JSX's lack of element-erasure; WE has
`TransientElement`, so the author just writes the right primitive — `we-section-card`). **But not**
polymorphism *per se*: **intrinsic, evidence-based** resolution where the element reads its **own** content
to pick its tag is **blessed** and shipped — `ButtonTransientElement.resolveTag()` returns
`this.hasAttribute('href') ? 'a' : 'button'` (`fui:blocks/button/ButtonTransientElement.ts:17-18`). The line
is **who chooses the root**: intrinsic evidence = blessed; extrinsic author-fiat = rejected.

**Where the look *values* live — FUI tokenized base + product values (#1886 Fork 2).** **FUI** ships the base
card's **tokenized neutral surface**, already token-driven (`CARD_CSS` = `var(--color-border, …)`,
`var(--radius-md, …)`, `var(--color-surface-card, …)`, `fui:blocks/card/Card.ts:90-103`), reskinnable by
*setting tokens*, never forked; the **product layer** supplies token *values* (and composes the concrete
components above) per [managed-offering constellation layering] (standard→WE, primitives→FUI,
product→plateau/site; default ships **zero** flavors). **Hardcoding the look in FUI core is rejected.** The
card surface is one *recipe* of the broader presentation-trait vocabulary (#1884); it ships on **plain tokens
now**, so #1884 does not block it.

**Namespace.** `we-*` is reserved for the standard+primitive layer; the **product** owns its own namespace
via a **config knob (default empty)** — the WE website uses unprefixed `standard-card`/`standard-section`;
the config lets any *published* product namespace its components without code change.

**Lineage:** #1886 — prepared + ratified 2026-06-27, then **reopened the same day and re-ratified** when the
human ruling corrected the delivery vehicle (a component is not a classname) and surfaced the real principle:
the **substrate boundary**. Parent #1287; `relatedReport`
`reports/2026-06-27-project-include-we-card-migration.md`. Grounds the #1871 docs migration (which authors
the product `standard-card`/`standard-section`) and spawns the FUI `we-section-card` primitive. Refines
[native-first-baseline](#native-first-baseline), [tagname-naming](#tagname-naming), and the constellation
three-layer split; uses [reusable-neutral-home](#reusable-neutral-home) as the FUI-vs-product tie-breaker.
Sibling of [composition-preserves-a11y-contract](#composition-preserves-a11y-contract) (#1832). *The original
"a section wears the look as `<section class="fui-card">`" framing is **superseded** — that bare class is the
runtime residue of the transient primitive, not an authored deliverable.*

### Composition preserves the base block's a11y contract; changing it means a new component {#composition-preserves-a11y-contract}

The a11y contract of a block (its roles, focus order, keyboard model, aria surface) is
**single-sourced on the base block**. Every sanctioned HTML-first re-skin strategy must be
**add-only** to that contract — it may *extend* the surface, never *override or remove* it.

**The contract clause (citable; #1832):** for each of the four sanctioned composition strategies —
**slots, behavior/decoration, sub-component (scoped) replacement, abstract-piece split** — the composed
result MUST be **non-destructive** over the base block's a11y contract across all four dimensions:
it MAY *add* roles, *add* to the focus order, *add* keyboard bindings, and *add* aria attributes/state;
it MUST NOT *override* or *remove* a base role, reorder/drop a focusable, rebind/suppress a base key,
or strip/contradict a base aria attribute. Crossing any of those is, by definition, no longer a re-skin
of the base block but the authoring of a **new** block (the developer test below). The invariant is a
**forced** property of the strategy set, not a per-variant opt-in.

**The developer test (cite this to inform any block/component-shape API):** *does the variation need
to **change** the base's a11y contract — different roles, focus order, or keyboard model?* **Yes → a
new component** (structural; a distinct block under the same intent). **No, it only adds → the same
block, re-skinned** via composition. This is the third tier below [open-numbered-variants](#open-numbered-variants)'s
diagnostic: *CSS/tokens-reachable on the same markup* → a **variant**; *not CSS-reachable but add-only
to a11y* → the **same block re-skinned by composition**; *requires changing the a11y contract* → a
**new block**. (Example: slotting an icon/badge or decorating a child with `aria-current` keeps one
`<nav-item>`; `as="menubar"` — which forces `role=menuitem` and a different arrow-key model — is a new
component, not a config flag.)

**The four sanctioned add-only strategies** (none excludes another — support-all, per
[compose-dont-handroll](#compose-dont-handroll)): **slots** (shadow `<slot>` + imperative
`HTMLSlotElement.assign()`, the `<component>` authoring form); **behavior/decoration** (a
`CustomAttribute` on a child — the HOC analog, the most mature; e.g. `route:link` adds `aria-current`);
**sub-component replacement** (scoped custom-element registry + IDREF per [`#component-dc`](#component-dc) —
sanctioned but its runtime is **blocked on the webregistries FUI re-home**); and **abstract-piece split**
(a userland *convention* — distinct tags + tree-shakable traits — WE ships no primitive for it).
**Context-driven config** (webinjectors/webexpressions) is sanctioned for **non-visual** wiring only
(locale, data, flags); for *visual* variation it is the rejected "configure-one-block" shape — a
combinatorial a11y matrix, the [open-numbered-variants](#open-numbered-variants) ceiling restated for a11y.

**Where a11y is verified:** WE owns the **contract statement** (add-only non-destructiveness); whether a
given composed variant honors it is a **FUI/Plateau conformance-run concern**, not a WE-shipped
per-strategy proof matrix — composed tuples aren't expressible in the vector schema, and verifier/impl
live downstream per [conformance-verifier-vs-subject] / WE-zero-standard-implementation.

**Lineage:** #1795 (HTML-first composition strategies — Fork 1 = compose-over-base; a11y
non-destructiveness ratified as a forced invariant; the support-all set classified). Extends
[open-numbered-variants](#open-numbered-variants) (adds the a11y-contract tier below the CSS-reachable
diagnostic) and composes [compose-dont-handroll](#compose-dont-handroll). The composition
non-destructiveness **contract clause** above was landed by #1832 (the add-only invariant stated across
the four roles/focus/keyboard/aria dimensions as a citable conformance target). Remaining build
follow-ups: the `nav-list` a11y vector corpus, the strategy seams (scoped-replace blocked on the
webregistries re-home), and a current-block-interface compliance review.

### A layout role's identity is its composition-intent; CSS-mechanism is impl, landmark is annotation {#layout-role-composition-intent}

A **layout role** is identified by its **composition-intent** — the semantic arrangement the author
wants ("even vertical flow with consistent spacing" = stack; "fixed+fluid split that collapses when
narrow" = sidebar) — **impl-agnostic**. The **CSS mechanism** that realizes it (margin-flow vs `gap` vs
auto-fit grid) is **FUI's impl detail**, never the identity; the **ARIA landmark**
(`navigation`/`complementary`/…) is an **optional author annotation** bound to the content, never the
role. Keying identity on CSS-mechanism is **rejected** — it violates
[surface-contract-not-computation](#surface-contract-not-computation) (Impl-Is-Not-A-Standard) and makes
the taxonomy brittle to browser releases (when CSS `masonry` ships, "masonry" must **not** merge into
"grid" — they stay distinct *intents*). Keying on landmark alone is **under-determining** (stack,
cluster, grid, center all map to *no* landmark).

**Minting contract — role vs variant vs annotation.** The role set is **open-numbered** (a ratified
core + this contract), [open-numbered-variants](#open-numbered-variants)/Intents-Open-Design applied to
roles. A candidate earns a **new role** iff it is a *distinct composition-intent* (a different semantic
arrangement). It is a **variant** if it differs only in presentation (MUI ImageList
standard/quilted/woven = one grid role + variants; Chakra HStack/VStack = an axis variant of stack). It
is an **annotation** if it differs only in content meaning (a `navigation` sidebar vs a `complementary`
sidebar = one sidebar role + a landmark annotation). **Diagnostic:** *different arrangement* → role;
*different look, same arrangement* → variant; *different content meaning, same arrangement* → annotation.

**Two altitudes.** Primitive region roles (stack, cluster, grid, box, center, sidebar, frame, …) are the
per-role taxonomy where **FUI ships exactly one block per role**. **Page archetypes** (app-shell,
list-detail, feed, holy-grail) are *compositions of* region roles and live in a **separate
composition-intent tier** — impl'd as FUI *blocks* composing region components + plateau assembler
presets, **never** admitted as atomic roles (that would make "one component per role" re-implement the
regions it should compose). The line is *atomic composition-intent* (sidebar = one fixed+fluid split) vs
*page-spanning arrangement of multiple region roles* (app-shell). The shipped `layout` intent
(we:src/_data/intents/layout.json) is the **charter member** of the composition-intent tier — reclassified,
**not retracted**.

**Lineage:** #1680 (taxonomy decision — Fork 1 composition-intent identity, flipped from CSS-mechanism by
the skeptic; Fork 2 separate composition-intent tier with `layout` as charter member). Prep survey
we:reports/2026-06-23-semantic-layout-role-taxonomy.md (Every Layout, WAI-ARIA, Tailwind, MUI, Radix,
Chakra, Carbon, MD3, Open UI). Composes [surface-contract-not-computation](#surface-contract-not-computation),
[open-numbered-variants](#open-numbered-variants), [intents-ux-only](#intents-ux-only), and bias-to-separation. Seeds per-role mint items (intent + FUI block per core role).

### Reproduction-conformance: reproduce incumbents as theme+intents; the copy is a forcing function {#reproduction-conformance}

Reproducing a third-party design system (Material, Ant, Carbon, Fluent, shadcn…) on the constellation is a
**forcing function, never a product**. The hypothesis under test is that the only difference between any two
top design systems is `theme tokens + intents`; everything structural/behavioral is shared WE-standard over
FUI primitives (the headless-library thesis — React Aria/Radix/Ark/Base — applied as a conformance probe).
Each target yields three buckets: a **theme pack** (DTCG tokens), an **intent set**, and a **gap list** — the
residue reproducible *only* by escaping the standard. **The gap list is the deliverable.** The governing
discipline mirrors [exercise-app *active-bypass = FAIL*](#) : a divergence you can only hit by hand-rolling
outside WE/FUI is a **gap to file, never a hack to add** — per-library escape hatches buy the screenshots and
learn nothing. Three consequences, all forced:

1. **No assumed quality — parity is a measured fact.** No parity claim may rest on eyeballing; each gates on a
   confirmed measurement. The oracle is **layered** (support-all, not a fork): **fuzzy-tolerance pixel**
   (WPT-reftest model — max per-channel color delta + max differing-pixel count, *not* naïve pixel-diff, which
   throws 30–40% false positives), **structural DOM/ARIA/focus-order diff** (deterministic), and an
   **advisory VLM/semantic judge** (never the sole gate). Reproduction-as-conformance *is* the WPT/reftest
   method: the incumbent's own render is the reference, the FUI-themed repro is the test.
2. **Validation-engine ownership splits at the capability seam** (the load-bearing rule). The **deterministic
   diff engine** (drives + captures + compares) is **FUI** (impl/devtool, like the #809 block-explorer); the
   **VLM/vision judgment** is **Plateau** ([no-leakage-client](#no-leakage-client) — #475 is categorical: a
   tool containing a vision capability cannot fold it into FUI); **WE consumes only the verdict + gap deltas**
   (never renders FUI, never runs the judge). The Plateau→WE delta protocol stays **deliberately thin**
   (pass/fail + gap list, not a fat schema).
3. **The instrument need not be finished before reproduction starts** (prioritization, not a fork). "No claim
   without measurement" is the invariant; *when* the validator reaches parity-grade relative to the first
   target is a scheduling call — the validator co-evolves, specified by a concrete adversarial target, with
   the claim-gate (not a hard `blockedBy`) carrying the correctness guarantee.

**Lineage:** #1225 (program charter — reproduction-conformance; ratified 2026-06-20; research topic
`/research/reproduction-conformance/`). Composes [no-leakage-client](#no-leakage-client) (vision → Plateau),
[we-fui-embed-boundary](#we-fui-embed-boundary) (FUI owns impl + render, WE consumes outputs),
[constellation-placement](#constellation-placement), and the backlog *fork-is-not-prioritization* rule
(sequencing demoted out of the fork set). Sibling forcing-function to the exercise-app conformance loop (#314).

### First-party dogfood: our own products render only from FUI components + WE intents, differentiated solely by a theme {#first-party-dogfood}

The internal twin of [reproduction-conformance](#reproduction-conformance). Where that program proves the
`theme + intents` thesis against **incumbents**, this rule proves it on **our own product surfaces**. A
first-party product (plateau-app today; the same bar reaches any served product) composes its UI **only** from
FUI components driven by WE intents; the **sole** thing distinguishing its look from WE-docs or any other
first-party surface is its **theme (DTCG tokens) + intent set** — nothing structural or behavioral is
hand-authored. Three consequences:

1. **Hand-rolled UI is a conformance defect, not a style choice.** Reaching for `document.createElement` /
   bespoke CSS to build an interaction a FUI component already provides is the product-layer analogue of
   [exercise-app *active-bypass = FAIL*](#) and [compose-don't-hand-roll](#compose-dont-handroll). The
   residue — anything the product *can't* build from `theme + intents` — is a **standards/FUI gap to file,
   never a hack to keep** (the forcing-function thesis: the product is a probe for FUI + intent coverage).
2. **Preserve once it lands (the load-bearing clause).** Once a surface migrates onto FUI, regressing it back
   to hand-rolled UI is a **gated defect, not a tradeoff**. This is *why* the goal is codified to the statute
   layer rather than living only as epic scope: the epic delivers the state, the rule keeps it durable.
3. **Unblocked by the WE↔FUI boundary.** Unlike the WE-docs dogfood (#777, which waits on a mode-C relaxation),
   a served product is the **product layer** and already consumes FUI directly ([constellation-placement](#constellation-placement)
   — served product → Plateau, free to render FUI). No boundary gate applies; the only gate is FUI shipping
   the parts (#658 promoted `@frontierui/blocks` canonical, so the floor exists).

**Lineage:** #1253 (charter — plateau-app dogfooding mandate; ratified 2026-06-20; lands via epic #1254).
Internal twin of [reproduction-conformance](#reproduction-conformance); parallel to the WE-docs dogfood
mandate #777; kin to the exercise-app conformance loop (#314). Composes [compose-don't-hand-roll](#compose-dont-handroll)
and [constellation-placement](#constellation-placement). Enforcement (a `check:`-style plateau-app render
conformance gate giving "preserve once landed" teeth) is a filed follow-up, not a precondition for the rule.

---

### Visualization-family shape: placement & seam count key on whether position is *derived* or *invented* {#viz-family-shape}

A visualization standard (charts, graphs, maps, timelines, …) is a family with a settled skeleton: a
**semantic profile** (data + meaning, presentation-free) + a **renderer-swap protocol** with a
**native-first SVG default** + **3-axis conformance** (semantic fidelity · theme · a11y), with
contract→WE / runtime→FUI per [constellation-placement](#constellation-placement) and adapters deferred
per-engine. Two recurring forks resolve by a single test — **is a mark's position *derived* from its datum,
or *invented* by an algorithm?**

1. **Own project vs sub-profile.** A family earns its **own project** iff it has a positioning **degree of
   freedom** the host family lacks — most often a **layout-algorithm axis**. Charts derive position from
   data via scales (`x = f(field)`); a graph *invents* position via a layout algorithm (force / layered /
   tree / radial) — that axis can't ride as a webcharts sub-profile without bolting a foreign dimension on,
   so graph is its **own** project. No new positioning axis → a sub-profile of the existing family.
2. **Protocol seam count.** Position **derived** from the spec (charts) → a **single** renderer seam
   (`CustomChartRenderer`: spec → output). Position **invented** by a swappable algorithm (graphs) →
   **split into two seams**: a layout protocol (`CustomGraphLayout`: spec → positioned coordinates) ⟂ a
   render protocol (`CustomGraphRenderer`: positioned + theme → output). This is
   [dimension-vs-fixed-mechanic](#config-extends-platform-default) applied to position: an independently
   swappable layout (ELK layered + SVG render) is a legitimate end-state, so it's its own dimension. A
   single-seam precedent from a *derived-position* family is **not** evidence for one seam in an
   *invented-position* family.
3. **Native-first default.** The default layout/renderer must be **deterministic** (pure: same input →
   same coordinates) so it is **conformance-assertable**; non-deterministic engines (force-directed) ship
   as **adapters** behind the layout contract, never as the default. ([native-first-baseline](#native-first-baseline).)

**Lineage:** #1352 (webgraph shape — ratified 2026-06-21; builds via scaffold epic #1351), generalizing the
webcharts family (`CustomChartRenderer`). Composes [constellation-placement](#constellation-placement),
[config-extends-platform-default](#config-extends-platform-default), [native-first-baseline](#native-first-baseline).

### A readout's home keys on its value-type; presentation is a dimension, not a home {#readout-placement-by-value-type}

A status/quantity readout gets its **own** intent for each distinct **value-type**, and the native ARIA
roles draw the lines: a **discrete-state enum** (`status-indicator` — `tone`/`shape`/`affordance`, a
lifecycle state), a **position in a known range** (`meter` / `role=meter` — `value`/`min`/`max`/`low`/
`high`/`optimum`, always determinate, has zones), and **task completion over time** (`progress` /
`role=progressbar` — `value`/`max`, may be indeterminate, drops `aria-valuenow`, no zones; its **own thin
intent** per #1469, with `loader.progress` and `flow-progress` as *consumers* — a determinate bar shown
*during* a pending op is a `progress` readout under a loader strategy, not `loader`'s to define). These are
**incompatible contracts** — folding a continuous bounded scalar into the discrete-state enum or the
task-over-time progress role **mis-types it** (the documented Chakra defect: a measurement that renders
`role="progressbar"`), so a home that has to mis-type the value is the genuine either/or. **Test:** *is
the value an enum, a position in `[min,max]`, or a completion fraction over time?* — three answers, three
homes. **Presentation is never a home:** a gauge (radial) is the meter contract rendered as an arc — a
`presentation` dimension value, not a separate intent (rating / password-strength are likewise meter
*presentations*, consumers not standards). This is [open-numbered-variants](#open-numbered-variants) +
[decompose-overloaded-vocabulary-by-semantic-source](#decompose-overloaded-vocabulary-by-semantic-source)
applied to the readout family, with WE owning the intent contract and FUI the block per
[constellation-placement](#constellation-placement).

**Lineage:** #1410 (meter placement — ratified 2026-06-21; surfaced by the #1400 ARIA-APG lens). Realizing
build #1468 (`meter` intent + FUI block). Sibling progress placement #1469 (ratified 2026-06-21 → `progress`
gets its own thin intent; `loader.progress`/`flow-progress` are consumers); realizing build #1488. Composes
[native-first-baseline](#native-first-baseline) (adopt `<meter>`/`<progress>` vocabulary verbatim).

### Tone is a shared token palette + a meta-contract, never a flattened cross-intent enum {#tone-meta-contract}

A semantic **tone** (an intent's `neutral`/`danger`/`success`/… value) names a **semantic color/severity
family the theme resolves — never a per-component hex** and never a behavior. Sharing happens at **two**
layers, and only those: (1) a shared **token palette** in webtheme — `--tone-{neutral · danger · success ·
warning · info · critical}`, the **severity family only**, scheme-aware via native `light-dark()`; and (2) a
shared **meta-contract** (the dimension is named `tone`; a canonical synonym table normalizes spellings —
`danger ≡ negative ≡ error`, `success ≡ positive`, `warning ≡ caution` — so the theme resolves any synonym
to one token; `neutral` and `info` stay **distinct**, collapsing them is lossy). The **value enum stays
per-intent** — never a single flat cross-intent vocabulary (the Bootstrap `btn-warning` smell). **Membership
test for the shared palette:** a value enters `--tone-*` only if it *differs only in semantic color, not in
behavior/lifecycle* — so `progress` (a lifecycle state, status-indicator) and `categorical` (non-severity
identity color, tag) **fail it** and stay **intent-local tokens**, never absorbed into the palette. This is
[open-numbered-variants](#open-numbered-variants) applied a second time (variant → tone): DRY where it's real
(palette + contract), divergent where it's real (the per-intent enums). **Test:** *does the value differ only
in color, or also in behavior/lifecycle? and is the difference a synonym of a canonical token?* — color-only +
synonym → the shared palette; behavior/lifecycle → intent-local.

**Lineage:** #1427 (cross-intent tone vocabulary — ratified 2026-06-21; #1337 spinoff, surfaced by the #1400
ARIA-APG lens). Realizing builds: #1458 (the `--tone-*` webtheme palette + this statute), #1459 (the per-intent
`severity`→`tone` rename + synonym normalization sweep). Second application of
[open-numbered-variants](#open-numbered-variants); composes [native-first-baseline](#native-first-baseline).

### Theme tokens are JS-first; the injector is the source of truth, CSS custom properties are a one-way projection {#tokens-js-first}

The **runtime source of truth** for a resolved theme token (colour, layout, spacing, font, radius — **every**
CSS-relevant value, not just colour) is **JS, held in the injector** WE already ships (`we:plugs/webinjectors/`
+ `webcontexts`). Any JS reads it **synchronously, off-DOM, with no cascade and no loop**. From that one
source a CSS custom property (`--token-*`) is **emitted one-way (JS→CSS)** for the declarative **paint** path
— cascade, light-DOM scope (the `scoped-token-override` semantic), dark-mode, zero render cost. **Direction is fixed:**
JS→CSS only; CSS custom properties are **never the source** and are **never hand-authored in parallel** (single
source ⇒ the two projections cannot drift). **Components read the injector to *know* their theme; CSS vars
exist only to paint** — `getComputedStyle` is **never** in the compute path. **Why CSS cannot be the source
(browser-validated #1682):** a detached element resolves an inherited/scoped var to `""` (no constructor /
pre-attach read); a worker/OffscreenCanvas, a `console.log("%c", …)`, SSR, and a test have **no element at
all**; and the `connectedCallback` read, even when it resolves, is a forced sync style recalc and the earliest
possible point (deferring to a later loop reintroduces FOUC). **Test:** *does JS need this value before/without
a painted element?* → read the injector, not CSS. This **refines the `design-tokens` protocol's runtime tier**:
"each resolved token compiles to a custom property" now reads — the **injector is the runtime source; the
custom property is the derived projection**. The categorical-taxonomy work (#1670) is one consumer: category
vocabularies are a JS-first token family (`--cat-*`), **not** a new provider/registry.

**Lineage:** #1682 (ratified 2026-06-23 — JS-first token SoT + one-way CSS sync; emerged from the #1670
categorical-taxonomy discussion). Realizing build: #1683 (injector resolves the theme; one-way CSS sync;
migrate the hand-authored `we:src/css/style.css` `:root` vars). Consumer: #1670 (categorical taxonomy).
Refines the `design-tokens` protocol; composes [tone-meta-contract](#tone-meta-contract) (the `--tone-*`
palette is one such emitted token family) and [native-first-baseline](#native-first-baseline).

### The semantic-alias tier is part of the component contract; the injector co-emits it at every themed scope {#semantic-alias-co-emit}

FUI components read **semantic role names** (`var(--color-border)`, `var(--radius-md)`, `--tone-*`) as
ratified by **#1886 Fork 2** (the tokenized-base ruling above) — the reskinnable surface *is* that semantic
role set, so the
semantic names are the **component contract**, not an optional app override. Canonical
`--token-<family>-<name>` values ([tokens-js-first](#tokens-js-first)) reach a component only through a
**semantic-alias tier** (`--color-border: var(--token-color-border)`). **Browser-validated placement rule
(#2026):** `var()` substitutes at the element that *declares* the alias, so a `:root`-only alias forwards
only root-level canonical values and can **never** carry a component-scoped `--token-*` override (Chromium
`getComputedStyle`: a child setting only `--token-color-border` renders the root colour until it
re-declares the alias). **Therefore the alias tier must be co-emitted at every scope a theme targets, and
its owner is FUI — the component-contract owner — not the consuming app or the website build.** The FUI
injector (`fui:plugs/webtheme/` `applyTokenVars`) emits `--token-*` **and** the `--<family>-*` alias tier
onto whatever scope element it themes (`:root` or a component host), both **derived from the single
`LEGACY_ALIASES` source** (relocated into `fui:plugs/webtheme/`), never hand-authored in the emitter — this
**satisfies** [tokens-js-first](#tokens-js-first)'s single-source / one-way rule (the alias is a JS→CSS
projection off the same SoT, not a parallel map). **Rejected:** a **canonical-fallback read**
(`var(--color-border, var(--token-color-border))`) that demotes the semantic tier to an app-optional
override — it strips role-indirection from the default build and reclassifies the semantic read as
app-owned, which #1886 declined; and **canonical-only reads** (no semantic tier), which discard role-remap
entirely. The website-build alias (#1824) stays valid as build-time `:root` transport; this ruling
**extends** the same single-sourced alias into the FUI runtime emit at *any* scope — a platform-runtime
ruling #1824 explicitly did not make.

**Lineage:** #2026 — prepared + ratified 2026-07-01 (Fork 1 = injector co-emit at every themed scope; Fork
2 = badge tones bind to the `--tone-*` severity palette). Refines/composes
[tokens-js-first](#tokens-js-first) (single source, one-way projection) and
[tone-meta-contract](#tone-meta-contract) (the badge severity family). Follow-on builds — relocate
`LEGACY_ALIASES`→FUI + runtime co-emit, close the three untokened card props, badge `--tone-*` migration,
`#2017` loader acceptance — are `blockedBy` #2026. Deferred merit forks: full per-component theme isolation
(F-iso) and per-slot theme inheritance (F-slot).

### Categorical vocabularies are a closed-set token-family meta-schema; behaviour-owned axes (status) are excluded {#categorical-taxonomy}

An app's **categorical vocabularies** (`kind`/`tier`/`size` — closed lists reused across many surfaces:
badge, tag, numbered circle, link-pill, filter chip, border) are **one JS-first token family** — each
`(set, value)` row carries `{ token-ref, icon, shape }`, realized as `--cat-<set>-<value>-*` on the
[tokens-js-first](#tokens-js-first) runtime and synced to CSS. **There is no new "taxonomy provider" or
runtime registry** — the contribution is the **meta-schema + closed-set discipline** (a value resolves to a
token, never an author-supplied hex; the set vocabulary is *open* — an app adds `size` without touching
components), layered on the existing injector. Surfaces consume by `(set, value)`, blind to the rest; this is
what lets a category be **defined once** and read identically everywhere instead of re-hardcoded per macro.
**Membership test — what is a categorical set:** a *pure-presentation* axis with **no behavioural owner**.
**`status` fails it and is excluded:** the Web Lifecycle protocol owns which status values exist + their
transitions, and `lifecycle.json`'s `realizesIntent: status-indicator` already assigns status *presentation*
to the **Status Indicator intent** — so status lives end-to-end in lifecycle + Status Indicator, and
cross-surface reuse comes from **sharing that component**, not smuggling a status colour-row into the
categorical taxonomy (which would fork lifecycle authority + recreate a two-place join). Same boundary as
[tone-meta-contract](#tone-meta-contract)'s palette-membership test (`progress`/lifecycle ⇒ intent-local, not
the shared palette), applied to the categorical layer.

**Lineage:** #1670 (ratified 2026-06-23 — Fork 1 dissolved into [tokens-js-first](#tokens-js-first); Fork 2:
status excluded, lifecycle/Status-Indicator-owned). Consumers: #1669 (`we-tag`), #1598/#1208 (taxonomy-surface
migration). Composes [tokens-js-first](#tokens-js-first) and [tone-meta-contract](#tone-meta-contract).

### Curated-corpus credibility weighting: two-stage admission⟂weight, GRADE-shaped, config-extends-default {#credibility-weighting}

When WE curates a corpus of external sources and must rank them by authority (the design-knowledge
corpus is the first; the shape generalizes to any admitted-and-weighted source set), settle it as
**three orthogonal axes**, never a frozen source list (open-design: custom/project sources must
coexist). **(1) Admission ⟂ weight = two-stage.** A permissive **provenance/content admission floor**
(identifiable + traceable-to-origin + on-topic — **not** a quality bar; "authoritative" means
*attributable*, not *credible*) gates in/out; a **separate scalar weight** is computed only for
admitted sources. A low-credibility custom source is *admitted-but-downweighted*, never excluded —
collapsing admission into a weight-≥-threshold test breaks the open posture. **(2) Weight = GRADE-
shaped.** A **baseline tier from source-`kind`** + a **small fixed, named, *optional* set** of up/down
modifiers; each *applied* modifier records a **rationale + attribution** (only staleness is
deterministic). Flat-tier-by-type is the *degenerate config* (no modifiers), not a rival; a free
per-source number is rejected (un-auditable). The named-vocabulary + mandatory-rationale constraint is
exactly what keeps it auditable rather than re-inventing the free number. **(3) Governance =
[config-extends-platform-default](#config-extends-platform-default).** WE ships the **meta-schema**
(kind enum + modifier vocabulary + computation function) **+ a default flavor**; a project extends
weights / adds kinds & modifiers. **Freeze the meta-schema as the comparable spine**; **cross-project
*absolute* weight comparability is a non-goal** (intra-corpus *ordering* is the only contract — revisit
only if a cross-corpus consumer lands); add a **nonzero floor** on admitted sources so weight-to-zero
can't covertly re-exclude (mirror of axis 1's guarantee). Specializes
[surface-contract-not-computation](#surface-contract-not-computation) and
[config-extends-platform-default](#config-extends-platform-default); internal precedent is
`benchmarkCorpus.json`'s `selectionCriteria`+`inclusionRule` multi-criteria gate (binary inclusion for
coverage, here extended with a weight axis for credibility).

**Lineage:** #1588 (ratified 2026-06-22; child of the #1585 design-knowledge intake program; prep
survey `reports/2026-06-22-design-knowledge-source-admission-credibility.md`). Graduating build: #1591
(meta-schema + computation function + default flavor); tunable-weights Configurator: #1592; consumers
#1586 (ledger weight column) #1587 (rubric provenance) #1589 (distillation). All three forks survived a
refute-only skeptic pass.

### One canonical introspection slot — render alternate subject forms into it, never duplicate the surface {#single-introspection-slot}

An explorer / workbench has **one** canonical render target (the "stage") that its introspection panels
(inspector, event-log, anatomy) read **generically off the rendered DOM**. When an *alternate form* of the
subject must be shown — a cross-origin framework live-mount, a different framework's wrapper, a future
device-frame — it **renders into that same slot**, not into a second pane with its own parallel
introspection wiring. Prior art is unanimous (Storybook / Histoire / Ladle / Bit all read one canvas
framework-agnostically; a separately-wired second introspection target is the surveyed anti-pattern). The
enabler is that the live wrapper mounts the **real custom element** and forwards attrs+events, so native
bubbling + computed-style + the CEM declaration all keep working — the alternate form is *the same subject
re-mounted*, not a new one. A "render beside source" view is **additive** (a non-introspected display), not
a rival target, so it never forks the slot. **Tell:** a proposal to "add a preview pane" that re-derives
events/computed-style/anatomy — that's duplicating the introspection surface; route it through the stage and
resolve the nested subject node instead. Cost is the **subject-node resolution** + **prop-routed control** +
**`unmount()` lifecycle** seams, materially less than a second surface.

**Lineage:** #1594 (ratified 2026-06-22; render the `?form=react-live` live-mount into the stage, not a
separate pane; prep survey `reports/2026-06-22-workbench-live-render-target.md`; skeptic
SURVIVES-WITH-AMENDMENT — the three seams fold into the #1030 build). Under polyglot-sandbox #912; sibling of
[compose-intent-dont-duplicate](#compose-intent-dont-duplicate) (reuse-don't-duplicate, render-target face).

---

### Live-page detection probes for tool-observed presence; the printed claim escalates with its evidence tier {#detection-claim-matches-evidence-tier}

A tool that decides whether a stranger's *running* page uses our platform must **passively probe** —
read tool-observed runtime signals with **zero app cooperation and zero page mutation** — because the
two alternatives are structurally ineligible for an always-on gate: a *declared* manifest is build-time
convention with no runtime footprint (no app ships one, and the level is self-asserted-and-trusted, never
behaviour-verified), and a *verify* pass that runs the conformance corpus **mutates the inspected page**,
so it can never silently decide whether to light up. This is the universal framework-devtool pattern
(React's global hook, Vue's `__VUE__`, Angular's `ng-version`). **The load-bearing rule:** the strength of
the claim the tool prints must **match the evidence tier it actually has** — passive probe ⇒ *presence*
only ("detected"), a self-declared manifest ⇒ the asserted level **badged unverified**, an on-demand verify
run ⇒ the **only** tier permitted to print a *verified* result. Tiers escalate the **assertion, not the
toolset** (the same panels may surface at every tier; what grows is the word the panel is allowed to use).
Conformance is a *verified* word; presence is what a probe knows — never let a passive signal print a
verified claim. **Tell:** a "light up as conformant on detection" proposal — that asserts what only verify
earns; downgrade the headline to "detected" and gate the verified word behind the mutating on-demand action.
**Caveat (probe reach):** only signals readable across an extension's isolated content-script world count —
a DOM marker (`script[type="registry"]`) does; a module-private `Symbol()` or closure state does **not**, so
a public global probe-marker is the load-bearing enabler that widens passive reach beyond the declarative
minority (the move React/Vue made with `__REACT_DEVTOOLS_GLOBAL_HOOK__`).

**Lineage:** #1673 (ratified 2026-06-23; probe-first tiered detection for the conformance-lit extension
MVP; prep topic `reports/2026-06-23-live-page-we-conformance-detection.md`; two skeptic passes both
SURVIVES-WITH-AMENDMENT — the false-positive attack collapsed, the ratification red-team re-sized the probe
reach and promoted the public-marker follow-up #1722). Buried fork under #1656; faithful MVP composition of
#141's "gate on a capability manifest, degrade gracefully" end-state.

### A standard's vocabulary dimension is designed in full up front when its member-set is settled in prior art — completeness-early, not consumer-at-a-time {#vocabulary-completeness-early}

Once an intent's existence is warranted on merit, design its **dimension's full member vocabulary** up
front rather than admitting members one real-consumer-at-a-time. For a **standard** (the intent/vocabulary
layer), the platform's value *is* the coherence of the whole space, so a named-but-incomplete dimension is
an outlier waiting to break the contract: the modifier/intersect/composition rules get proven against the
*whole* member-set instead of being retrofitted when a late shape appears and forces a breaking change.
**The rule:** when a dimension's full member-set is already **settled and specifiable from prior art**,
name and design every member now (`shape: rect | lasso | polygon | nearest`), even if only one is realized
today. This does **not** license inventing speculative members with no prior art — completeness is bounded
by what incumbents prove, not by imagination.

**Tension — and the precise line — vs [thin-container-graduation-trigger](#thin-container-graduation-trigger)
and [judge-on-merit](#judge-on-merit):** the graduation trigger governs minting a new *implementation
artifact* (a block/home) whose **reuse is unproven** — that waits for a 2nd consumer. This rule governs a
*standard's vocabulary completeness* whose **members are already proven in incumbents** — that ships
complete. Artifact reuse is demand-gated; vocabulary design is merit-gated. The marquee case is the
worked example: NOT-YET (wait for a 2nd recognizer shape) was **demand-gating a merit question**, which
judge-on-merit forbids — the shapes are all specifiable from settled geometry, so the dimension ships whole.

**Lineage:** #1463 (ratified 2026-06-24 GO, reversing the prepared demand-gated NOT-YET; merit reframe —
region-select is a coherent intent and `shape` a real dimension whose members all ship in incumbents and
are specifiable now). Fork-1 residual of #1406 (`marquee-select` placement); parent #099 (the intent
layer); graduated to build epic #1734. Prep topic
`reports/2026-06-23-region-select-recognizer-shape-vocabulary.md`.

---

### A reactive handle is never a thenable — expose `.value` + `await .next()` + async iteration, never `get then()` {#reactive-handle-not-thenable}

A reactive handle (the return of a future reactive `consume()`, or any value-plus-future-updates primitive)
must **not** be a thenable. Reading the current value is a synchronous pull — `handle.value` (re-reads live,
matching TC39 Signals `.get()` and RxJS `BehaviorSubject.value`); waiting for the next update is the
*explicit* `await handle.next()`; streaming future updates is `for await…of` via `Symbol.asyncIterator`. A
`get then()` is forbidden because `await handle` after an internal update **hangs forever** — `await` follows
the thenable and waits for the *next* settle that never comes (you also cannot return a thenable from an
`async` function: the Promise Resolution Procedure unwraps it and the outer promise *follows* its pending
state). The hang is thus eliminated **by construction**, not documented-around — the footgun-elimination +
native-first stance. The one spelling sacrificed (`await handle` meaning "wait for next") is *itself* the
ambiguity (now-vs-next collide on one object), so dropping it is the point, not a loss. Rejected alternatives:
keeping `consume()` sync and warning in prose (leaves the footgun); a `{ consumable, value }` wrapper (clunky
destructure + `value` is a consume-time snapshot, a quiet staleness footgun, where `.value` re-reads live).

**Lineage:** #1798 (ratified 2026-06-26 GO; default (a) survived the skeptic pass with amendment — the
value-first `.value` read is retained, only the thenable spelling is removed). Build filed as #1829
(`blockedBy: [1798]`), impl in `fui:plugs/webinjectors` + `fui:plugs/webcontexts`; WE keeps only the
consume/provide contract shape. Prep topic `reports/2026-06-26-consumable-await-footgun.md` +
`/research/reactive-consume-handle-shape/`. Coheres with
[framework-free-core-vendor-segregation](#framework-free-core-vendor-segregation) (native primitives over
vendor reactive libs).

### Bias toward separation — on any combine-vs-split fork, default to two composable homes {#bias-toward-separation}

On any "one combined thing vs. two composed things" fork, **default to separation**: split a reusable axis into
its own intent/protocol/plug that others *compose*, rather than absorbing it into a larger one. The **burden of
proof is on combining**, not separating — couple only when the split has a concrete, named cost. The test for a
distinct paradigm is **recurrence without its neighbour**: a concept that shows up without the thing it was
bundled with (disclosure without a tree; positioning without a droplist) is its own home; folding it in forces
unrelated consumers to drag in a host they don't need. The hazard the rule guards is **schema/ownership
coupling**, not file count — two concerns in two files but one shared schema are still coupled, and one concern
split across many files is not (see [file-count-not-schema-coupling](#categorical-taxonomy) framing). Worked
example: #064 → `disclosure` (open/closed) is its own intent that `hierarchy` *composes*, not absorbed into it.

**Lineage:** #064 (disclosure⟂hierarchy) and the standing per-fork classification pass in
[backlog-workflow.md](backlog-workflow.md); the composition-over-monolith logic the WE constellation is built
on. Coheres with [most-flexible-default](#native-first-baseline) and the harvest-cross-cutting-paradigms pass.

### Reusable-against-all-implementers → the neutral home; fix the surface, not the home {#reusable-neutral-home}

A tool/runtime **reusable against every implementer** belongs in the **shared, neutral home (plateau)**; code
**specific to one implementer** belongs in that implementer (FUI for FUI's own). When a placement decision is
pressured by *one* consuming surface's constraint (a trust-gate, an origin requirement, a backward-edge),
**fix the surface, not the home** — never relocate shared infrastructure to satisfy a single consumer. A
multi-surface tool (run via `npx` inside the impl under test, from the dev browser, from the SaaS exerciser,
and as the docs demo) is shared infra **by construction**; "neutrality is about who-hosts, not where-source-
lives" is a rationalization this rule rejects. The per-implementer piece is the **thin adapter** (the binding's
`dispatch`/`observe`), never the generic engine — distinct from "runnable backends → FUI" (#899), which means
the *impl-specific* backend, not the generic runner/judge.

**Lineage:** #1788 (ratified — the prepared default to re-home the conformance *runner* into FUI was
overturned; the runner is multi-surface shared infra). Refines [constellation-placement](#constellation-placement)
and relates to the backward-edge module-import boundary.

### Cross-origin import keeps the dev server clean — serve heavy/vendor deps from a second origin {#cross-origin-dev-server-hygiene}

When a live-test/workbench feature needs a heavy or vendor dependency (`react`/`react-dom`/`vue`), serve the
generated wrapper module from a **separate origin** and **cross-origin-import** it
(`await import('http://localhost:<port>/<block>.js?form=react-wrapper')`) rather than importing the dep into
the running dev-server tree. ES dynamic import is origin-agnostic and the imported module still mounts
**same-document** (the cross-origin *iframe* is what's forbidden, not a cross-origin fetch), so the dep lives
only on the serving origin — **never in the main dev tree or the shipped bundle** — and the running dev server
never resolves/pre-bundles it (no re-optimize, no reload, no don't-restart-the-server violation). Before
flagging "needs the dev server restarted" because a feature pulls a heavy dep, ask whether it can be served
from a *second* origin and cross-origin-imported (CORS in dev is trivial); two framework copies (one per
origin) is fine when the consumer is framework-free and the mount is isolated. The excluded fork — same-origin
via the running Vite middleware — both reloads the server and leaks vendor deps toward the main tree.

**Lineage:** #1499 (ruling — the workbench live-test #1030/#912 serves the wrapper cross-origin; this is why
#1030's `setup` human-gate was wrong and was removed). Coheres with the FUI vendor-deps-quarantined-to-a-
sub-package rule and [framework-free-core-vendor-segregation](#framework-free-core-vendor-segregation).

---

### Pool-root constellation siblings are real, pushable, built clones — one clone serves both render and the drain, not a render-only symlink {#pool-siblings-real-built-clones}

The lane pool provisions each **other** constellation repo (`frontierui`, `plateau-app`) as a **real, pushable
git clone at pool-root** (`<pool>/frontierui`, `<pool>/plateau-app`), fetched/reset to `main` and **built via
that repo's `build:tools`** (where it has one) on provision/refresh. The **one** clone serves both consumers at
the same `../<name>` path a lane resolves: **WE-lane render** reads its built `dist/`, and the **drain's
cross-repo rebase-drop** fetches/pushes its `origin`. This is safe to share because rebase-drop is **pure git
plumbing — merge-tree → commit-tree → push, no checkout** (`we:scripts/merge-ai-prs.mjs`), so it mutates only
git objects/refs while render reads only `dist/` — disjoint filesystem regions. `siblingCloneName`/
`siblingCloneDir` already resolve `../<name>`, so **no path fork is added**.

This **supersedes the render-only symlink** (#2166, `ensureFuiSibling` → primary's `~/workspace/frontierui`).
The symlink's one lost behavior: WE-lane render no longer reflects **uncommitted primary-FUI WIP** — it tracks
the clone's committed ref (`main`). **Freshness ownership moves to the provisioner** (it rebuilds `dist/` on
refresh; ~1.2s for FUI). Rejected alternative: keep the symlink + a *separate* push path — its only merit is
insulating a mutable push clone from a stable render source, which guards a **future non-plumbing** drain op the
"no checkout" design is committed against; **don't add that abstraction until a real requirement forces it** —
split `siblingCloneDir` (one function) *then*. A plain `plateau-app` clone also un-breaks the lane's Vite
dev-panel import (`vite.config.mts` → `../plateau-app/…`).

**Lineage:** #2282 (ruling — option a; foundational slice of the #2275 drain-on-lane migration; build carried by
the successor provisioner-generalization item). Supersedes the #2166 symlink. Coheres with
[pr-flow-rollout-mechanism](#pr-flow-rollout-mechanism) (the drain is the sole `main` writer) and the #2123
edit-work-runs-in-a-lane-clone rule.

---

### A plugged-vs-unplugged faithfulness surface needs a clean realm per mode; same-document direct injection is the isolation *showcase*, the iframe is a consumer-distribution mode {#plug-gap-clean-realm-per-mode}

When a surface exists to **show the gap** between a plugged (proposed-standard) and unplugged (safe-now)
rendering, a same-document re-mount toggle is **unfaithful**: plugging irreversibly patches realm globals with
no teardown, so an "unplugged" re-mount inherits the lingering plugged globals and **falsely reports "works"** —
faking the very result the surface exists to expose. Faithfulness therefore requires a **clean realm per mode**,
and the cheapest correct mechanism is a **reload-scoped param** (`?plug=on|off` selecting the boot path at load,
reusing the surface's existing URL-state serialization) — ship that first. Two corollaries: **(1)** keeping the
stage *same-document* (no iframe) is itself the honest **isolation showcase** — it demonstrates *the platform's*
isolation, whereas an iframe demonstrates the *browser's* sandbox and masks whether the platform isolates; so
prefer same-document for the demo. **(2)** The iframe-isolated stage is not the toggle mechanism but a separate
**consumer-distribution mode** — sandboxed embedding for *untrusted/third-party* blocks, where isolation is the
product and the async postMessage DOM bridge cost is justified — filed as a follow-up that reuses the
reload-scoped `?plug` param as its per-iframe seed. Governed by most-flexible-default: ship the cheapest correct
clean-realm mechanism now; the richer iframe mode is opt-in later.

**Lineage:** #1845 (ruling — the FUI block-workbench plug toggle; (c) reload-scoped chosen, (b) same-document
re-mount excluded on the lingering-globals correctness bug, (a) iframe reframed as the consumer-distribution
follow-up #1901, build slice #1900). Builds on the plug = proposed-missing-standard lineage and the
same-document-stage contract (`fui:workbench/mount.ts:6-11`).

---

### The authoritative gate runs once, on the merged tree; the lane gate is a best-effort scoped fast-fail {#gate-on-merged-tree-lane-fast-fail}

In a lane-to-central parallel pipeline (agents work in lane clones, push `lane/*` branches, a central broker
merges + gates + pushes `main`), the **binding verdict gate runs once, centrally, on the *merged* tree** — the
full no-flag `npm run check:standards` (+ tests) after the broker merges `lane/*` into `main`, before pushing to
`origin`. This is the "Not Rocket Science Rule" invariant every mature merge queue enforces (Bors fast-forwards
only a green *merged* commit; GitHub gates the speculative merge commit; Zuul gates the assembled DAG), and it is
the **only** place a consistent — and, for cross-repo lanes, *assembled multi-repo* — tree exists. A **lane gate
cannot be the authority**: an isolated lane tree *false-reds* on whole-repo consistency rules that can't pass
without sibling lanes present (live-measured: #1153's 4-of-7 lanes red'd in isolation, green on merge). The lane
**may** run a gate, but only the **scoped** `check:standards --local --files=<lane's edited files>` (#1159's
partition, which demotes global-consistency findings) as a **best-effort pre-push fast-fail** — it catches the
author's own file-local mistakes before a wasted push+merge round-trip, but is an *optimization, not a
correctness gate*: skipping it costs only a round-trip, never correctness. The two halves are non-overlapping by
construction (#1159 deliberately removed the global rules from the lane gate and defers them to the unflagged
central gate), so this is a clean file-local-fast vs global-authoritative split, not redundant double-running.

**Lineage:** #1937 (ruling — Fork C adopted: central full gate = authority/mandatory, lane scoped fast-fail =
best-effort; report `we:reports/2026-06-28-gate-location-lane-central.md`). Under parent #1933 (the parallel-batch
pipeline); lane fast-fail build = follow-up #1939. Reuses the #1159 gate-partition (`we:scripts/check-standards.mjs:1385-1410`).

### Merge-risk = optimistic-by-default, lock only the irreducible shared set, derived static ∪ dynamic {#merge-risk-optimistic-with-targeted-lock}

In the same lane-to-central pipeline, a lane must **reserve (pre-lock) a file before editing it iff** the file is on a **static denylist OR ≥2 active lanes' probed touch-sets both name it** (static ∪ dynamic double-declaration); everything else relies on optimistic git-merge, with a merge conflict as the last-resort backstop (replay that lane serially). Optimism is the floor — pessimism is added *only* where a wrong guess is expensive — because the DB literature ("combine optimistic + pessimistic"), the merge-queue/monorepo "serialize only the shared scope" critique, and WE's already-disjoint **per-entry registries** ([#1145/#1146/#1157](backlog-workflow.md)) all converge there. The static set is **derived by category, not a fixed file list** (the list is operational and drifts): a candidate shared file is (①) a **splittable collection** → split to per-entry, leaves the lock-set; (②) **purely-derived** (a deterministic generator reproduces it from source) → regenerate-on-merge, leaves the lock-set; or (③) an **irreducible residual** (structured registration doc / hand-curated *sweep input* / hand-authored prose) → **locked**. **③ excludes flat config (#1952/#2149 Fork 1):** a **flat, developer-unique-keyed config** (`tsconfig.json`, `vite.config.mts`, `vitest.config.ts`) merges optimistically — distinct-line edits are trustworthy and a genuine clash is a real git conflict — so it is **not** ③. A **keyed manifest** (`package.json`) is likewise optimistic, *not* locked: its only clean-but-wrong class is two lanes adding the **same key** (order is irrelevant to npm; distinct-key adds merge clean and correct), which is fully enumerable and machine-checkable — so it rides the floor behind a **deterministic duplicate-key merge-gate lint** (`validateNoDuplicateManifestKeys`, run by check:standards on the merged tree), per the hookable-vs-judgment rule (a script-decidable class gets a hook, not a lock). What **stays ③** is a **registration monolith** (`.eleventy.js`: same-name / ordering-sensitive `addFilter`/`addShortcode`/… registrations clean-merge into a silent last-wins and are **not** deterministically lintable) — locked until a proven fragment split moves it to ① (order-insensitivity established, per #2149 Fork 2). The discriminator for ②-vs-③ is *purity*: a `lastSwept`/`selectionCriteria`-style **curated** artifact is **not** purely-derived (no generator reproduces a human's curation) and stays locked; a hand-authored doc with an embedded auto-generated block is **locked prose + a regenerated sub-block**, never a wholesale regenerate. The dynamic layer extends coverage to the unenumerable long tail (ordinary `*.ts`/`*.njk`/shared-test overlaps the static list can't name); a static-only interim re-exposes optimism on that *common* surface, so dynamic-B ships **promptly**, not deferred.

**Lineage:** #1935 (ratified 2026-06-28 — Fork 1: optimistic-floor + pre-lock layer [D-alone rejected]; Fork 2: Option C static[③] ∪ dynamic-B, static-first→B-promptly rollout [skeptic SURVIVES-WITH-AMENDMENT → AGENTS.md is locked-prose-not-output, curated-sweep stay locked, B prioritized not deferred]; report `we:reports/2026-06-28-merge-risk-file-determination.md`). Under parent #1933; format-change precursor = #1938 (`blockedBy: ["1935"]`, shrinks the at-risk set). Sibling of [gate-on-merged-tree-lane-fast-fail](#gate-on-merged-tree-lane-fast-fail) in the #1933 cluster.

**Amendment — deferred-landing lock lifetime + a whitelisted-additive carve to the ③-stays-locked rule (#2138 Fork 3, ratified 2026-07-02).** Deferred landing (the [#pr-flow-rollout-mechanism](#pr-flow-rollout-mechanism) merge-queue rider) reopens the clean-but-wrong structured-merge window *between push and drain*: a lane's write-time lock (`we:scripts/readiness/file-locks.mjs`) releases when the producing session ends at push, but the change then sits **queued and unmerged**, so a later lane can edit the same ③ file against a `main` that does not yet contain it. Ruling: the **drain detects denylist overlap among queued lanes and serial-replays the second — this is primary**, consistent with the "③ stays locked" floor and enforced anyway by the per-merge merged-tree gate. Holding the lock across the whole human-paced queue wait is **rejected** — a queued item may wait hours, far past the 15-min `DEFAULT_LEASE_MINUTES` ([`we:scripts/readiness/file-locks.mjs`](../../scripts/readiness/file-locks.mjs)), so the lock either expires and reopens the hazard or wedges the file under a dead owner. As an **opt-in optimization only**, an early **expand/contract micro-slice** ([ParallelChange](https://martinfowler.com/bliki/ParallelChange.html) *expand* phase) may land a lane's ③-file delta ahead of its bulk lane and release the lock early **iff** the hunk matches a **whitelist of provably-safe additive regions** (appending a new `we:package.json` script key; a new per-entry `we:.eleventy.js` registration line) — authored by the **drain** (not the producing agent — it alone sees sibling lanes' overlapping deltas), and cherry-picked **verbatim** so the bulk lane's later re-add onto post-drain `main` is a **byte-identical no-op** (a reformat between applies would break byte-identity → a real conflict). This is **not** a general line-diff classifier: a **dependency add / version bump**, an `"overrides"` block, or a side-effectful/ordering-sensitive registration is line-additive yet semantically load-bearing and is **NOT whitelisted** → serial-replay (ParallelChange authorizes additive-lands-ahead only *when a human judged it additive*, never a mechanical line diff). The carve narrows "③ stays locked" for the whitelisted regions only; the residual ③ set stays locked. Composes with **#2148** (removes the FUI directive barrels from the denylist entirely) and **#2149** (declares the irreducible `we:package.json` / `we:.eleventy.js` residual). Report `we:reports/2026-07-02-deferred-merge-queue-substrate.md`.

**Amendment — the two root files split asymmetrically, and the ③ "build config" wording is corrected (#2149, ratified 2026-07-03).** A batch story to blacklist `we:package.json` + `we:.eleventy.js` was retyped to a decision because the edit appeared to reverse #1952's line-structured demotion. The prep found (a) *neither path was ever actually listed* — both were swept in only by the code header's generalized "BUILD CONFIG" parenthetical, and #1952's real removals were `we:tsconfig.json` + `we:vite.config.mts`; and (b) the statute's ③ literal ("build config → locked") already contradicted those ratified removals. Ruling: the two files are **not symmetric**. **Fork 1 — `we:package.json` stays optimistic** (a keyed manifest whose sole clean-but-wrong class, duplicate keys, is deterministically lintable) behind a new duplicate-key merge-gate lint (`validateNoDuplicateManifestKeys`, `we:scripts/check-standards-rules.mjs`, shipped in this ruling's changeset — no unguarded interim window); declaring it ③ was **rejected on merit** — its only edge over the lint is replay-*speed* (prioritization wearing merit's clothes, #1961), and the lint has broader coverage (every landing, not just orchestrator-packed lanes). **Fork 2 — `we:.eleventy.js` is declared ③ merge-risk now** (a registration monolith whose same-name/order-sensitive registrations clean-merge silently and are un-lintable), listed in both mirror homes (`we:scripts/readiness/lane-partition.mjs` + `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`); its future off-ramp is the **already-standing category-① split-and-exit** (delist iff a fragment split proves order-insensitivity — the split is an ordinary backlog story, *not* pre-blessed here). The ③ category line above is corrected in the same change (flat/keyed config → optimistic; registration monolith → ③). `we:tsconfig.json` / `we:vite.config.mts` stay optimistic under every branch. Report `we:reports/2026-07-02-merge-risk-blacklist-package-json-eleventy.md`.

### Lane ownership is a minted per-holder slug, asserted per op, checked at the guard — never inferred from ambient process identity {#lane-ownership-minted-slug-per-op}

In the parallel `/workflow` topology every sibling lane shares the top-level `CLAUDE_CODE_SESSION_ID` (a
spawned subagent inherits the parent's id verbatim; shell exports don't survive an agent's separate Bash
calls), so **no ambient env/process property can distinguish siblings** — a lease stamped from ambient
identity makes every sibling read as owner in every lane. The ruling adopts the fencing-token pattern the
prior art converges on (Kleppmann's fencing tokens; Kubernetes Lease `holderIdentity`): identity is a
**minted string per logical holder** (`<batchSlug>-<laneKey>`, already minted deterministically by the
orchestrator), carried **with each operation** (inline `LANE_SESSION=<slug>` in the command string — the
one per-op channel with both ends in-repo), and checked **by the arbiter at the point of use**
(`we:scripts/guard-bash.mjs`). Concretely: (1) each parallel lane's step-1 prep becomes an explicit-lane
`acquire --lane=N` under its per-lane slug — replacing the manual `reset --hard`/`clean -fd` prep, with a
short TTL (~60–90 min), an explicit slug-carrying release at close-out, an acquire per affected impl
repo, and invocation pinned to the primary; (2) the workflow acquire sets a dedicated `workflowLane`
lease field (a contract field, not `purpose` free text), and for a **live marked** lease the guard
requires the command string to assert the lease's own slug, denying on mismatch **or absence** —
fail-closed, with precedence over the degraded no-id fail-open (which is thereby rescoped to unmarked
leases; all serial-topology semantics unchanged). The hook-payload `agent_id` channel (ambient,
per-subagent, experimental) is **excluded on principle**: it is process identity — pid-shaped, ephemeral,
third-party-owned — with an unbridgeable mint/check split and silent fail-open degradation; any repair
routing it through the command string collapses into the minted-slug design with a worse token.

**Lineage:** #2413 (ratified 2026-07-11 — Fork 1 (a) in-lane acquire; Fork 2 (b) per-op slug assertion
fail-closed in marked lanes; two skeptic rounds incl. a refuted `agent_id` default-flip; report
`we:reports/2026-07-10-per-lane-ownership-signal-parallel-workflow-lanes.md`). Extends the #2367 guard
(cross-session protection) to sibling lanes. Build carried by #2427.

### Automated closeout is non-destructive and changeset-scoped; the writer operating model targets PR-flow / multi-session {#non-destructive-closeout-prflow}

Two rulings on *where* the constellation's work happens and what an automated closeout may touch.

**(Rung 1 — forced invariant) Non-destructive, changeset-scoped closeout.** Any agent / closeout / integrator
acts **only** on files in its own recorded manifest (the orchestrator ledger's `changedFiles`, or a session's
own edits), **never reverts or deletes a file it did not itself write**, and **never reads the dirty working
tree as ownership truth**. The shared primary checkout's dirty state is the normal baseline (other sessions'
uncommitted work lives there); inferring "what I own" from `git status` cannot tell your residue from a
stranger's live edits, so any destructive reaction (`checkout`/`rm`/`stash`) can erase another session's work —
which is exactly what happened (`batch-2026-06-29e` clobbered a concurrent `/prepare`'s in-progress #1983
files). It is a **forced** invariant, not one option: the alternatives (a session-scoped lock; a
commit-before-closeout discipline) both require cooperation the colliding **stranger** session cannot be made
to give, so "act only on your own manifest" is the only no-bad-actor-needed mechanism. Practised by the scoped
close-out gate in [backlog-workflow.md](backlog-workflow.md) (*Closing out a completed item* / pre-flight) and
the durable rule `we:agent-memory-src/closeout-never-infers-ownership-from-dirty-tree.md` (SoT relocated out of
`.claude/` by #2266; a back-compat symlink at `we:.claude/agent-memory/` still resolves the old spelling).

**(Rung 2 — operating-model direction) Writers collaborate through the remote in a PR-flow.** The
constellation's writers — **agent *and* human sessions, not just `/workflow` parallel batches** — target
collaborating **through the remote** (each works in its own clone/ref → push → gate → review → merge) rather
than sharing one dirty primary checkout, so multiple concurrent sessions can work together. The **`lane/*`
push-ref transport is the general primitive** (made reliable by #1995's bounded push-retry on transient
ref-lock contention), not a `/workflow`-only mechanism. This is a *direction*; the rollout **mechanism** —
clone scope (every session vs substantive-work-only), per-clone dev server/HMR, landing gate
(auto-merge-on-green vs human review), branch-protection shape (observe-only `main`, reconciled with the #1153
branch guard + the removed never-push default), and the visual-verification harness (Rung 3's #1895
acceptance test) — is **prepared as its own decision, #1996**, not ratified here.

**Lineage:** #1985 (ratified 2026-06-30 — Rung 1 forced invariant; Rung 2 direction *adopt PR-flow*, reframed
in discussion from the prep's "don't generalize" once the goal was set as a multi-session operating model, not
incident-remediation; Rung 3 folds into #1996; report `we:reports/2026-06-30-automated-writer-isolation.md`).
Under parent #1933; extends its clone model with closeout safety + the operating-model direction. Push
reliability = #1995. Mechanism to prepare = #1996. Sibling of
[gate-on-merged-tree-lane-fast-fail](#gate-on-merged-tree-lane-fast-fail) and
[merge-risk-optimistic-with-targeted-lock](#merge-risk-optimistic-with-targeted-lock) in the #1933 cluster.

---

### Visual-regression substrate — self-hosted Playwright, in-repo baselines, no hosted SaaS {#visual-regression-substrate}

The visual gate is **self-hosted Playwright in a pinned container** — never a hosted visual-review SaaS
(Argos/Chromatic/Percy). Baselines are committed `-linux` PNGs generated in the pinned
`mcr.microsoft.com/playwright:vX-jammy` image; review is the PR's rendered image diff (decision #2233,
ratified 2026-07-09; parent epic #2232, slices #2234–#2240 target this substrate). Rationale: Playwright is
already the incumbent (`@playwright/test` + `check:visual` + `tests/visual/` committed baselines), so the
real choice was keep-the-incumbent vs rip-it-out-for-a-vendor mid-epic — a migration buys a review-UX gain
for a token/secret, off-repo baseline storage, and a third party seeing rendered pages, all against the
self-contained / [native-first](#native-first-baseline) ethos. **Two evidence-gated escape hatches stay
live — revisit only on evidence, not pre-emptively:** (1) layer **Argos as a diff-review UI only** while
baselines remain in-repo, *if* in-PR image-diff review proves too coarse in practice (#2233 fork 2); (2)
**graduate baselines off committed PNG** when git churn weighs (#1967). Both are opt-in later moves, not the
default now.

### Skill/memory replay substrate — an ephemeral throwaway clone, never the shared lane pool {#skill-memory-replay-substrate}

The skill/memory validation suite (#2268) replays a **mutating** script/skill case inside an **ephemeral
throwaway clone** — `mkdtempSync` + `git init`/`git clone` off the fixture corpus, run the *real* mutation,
assert the invariant-catalogue checks on the resulting tree, `rmSync` in teardown — **never** the shared lane
pool (decision #2274, ratified 2026-07-09; parent epic #2268; unblocks #2272, sibling #2273 owns the Tier-A
snapshot on the same substrate). This is the pattern already shipping in
`we:scripts/__tests__/lane-drain-numbering.test.mjs`, so it generalizes a proven shape rather than inventing a
primitive. The shared `we:scripts/lane-pool.mjs` is **excluded as the substrate** because it is production
infra: `acquire` exits 1 in CI (no pool exists, `we:scripts/lane-pool.mjs:474`), `reset --hard origin/main` +
`clean -fd` destroys any seeded synthetic fixture (`:508-511`), and a red test strands a 4-hour lease that
contends with the live drain. **This holds even when the case under test *is* the lane tooling:** point the
real `we:scripts/lane-pool.mjs` at a fabricated `LANE_POOL_ROOT` under a `mkdtemp` dir (a throwaway origin +
reference + pool), never at allocated production lanes — the pattern shipping in
`we:scripts/__tests__/lane-pool-refresh-guard.test.mjs`. **`--dry-run` stays an operator-preview feature, never
the suite's fidelity substrate** — a dry-run of a mutating op asserts the *preview* branch, not the real
commit/rename/merge the suite regression-guards, so "faithful dry-run" is self-contradictory (the universal
`--dry-run` retrofit was parent-excluded on that fidelity gap). Scope caveat: this settles only *where the
mutation runs*; driving an LLM *judgment* (Tier-B) skill deterministically enough to assert on is a separate,
unsolved #2272 problem that no substrate choice resolves.

### PR-flow rollout mechanism — automation isolates, human writes `main`, landing is fully automatic {#pr-flow-rollout-mechanism}

The **mechanism** implementing [#1985 Rung 2](#non-destructive-closeout-prflow)'s adopt-PR-flow direction (that
anchor is the governing direction; this one is the how). Five ratified calls (#1996, ratified 2026-06-30):

- **Isolate-by-default for automation; the human writes `main` directly.** Every **automated** writing session
  (agent / `/workflow`) works in a **clone** (branches are guard-blocked in the shared checkout, #1153, so
  isolation = a clone), gates itself, pushes a `lane/*` ref, and converges via the integrator's auto-merge —
  `main` is **convergence-only for automation**. The **human** is the single trusted writer and keeps direct
  commit/push to `main`. Rationale: an ad-hoc agent `main` edit cannot be *proven* disjoint from a live lane
  (the orchestrator's disjointness partition only covers items *it* dispatches), so isolation is the only
  race-free posture for automation; a lone trusted human has no one to race.
- **Per-lane dev-server ports = pure deterministic offset by lane index, `strictPort:true`, with per-repo
  thousands-bands.** A squat surfaces as a loud boot failure, never a silent re-scan (no linear probe — a probe
  is dynamic discovery and dissolves the determinism). Bands: **WE `3000+` / 11ty `8080+`, plateau-app
  `4000+`, Frontier UI `6000+`** (`5000`/`7000` are macOS AirPlay/ControlCenter-reserved). Ports **and** the
  11ty proxy `target` are env-driven (`WE_VITE_PORT` / `WE_ELEVENTY_PORT`, `changeOrigin:true`) via a generated
  per-clone `.env.local`; FUI needs no port inside a coupled WE+FUI lane (relative path-alias resolves it).
- **Landing is fully automatic: auto-merge on gate-green, no manual merge, no mandatory human review.** The
  automated gate (`check:standards` + build + tests + the visual check below) is the sole landing authority;
  per-item human review is opt-in but never required.
- **Branch posture is asymmetric: `main` writable by the human, observe-only for AI/agents.** Agents PR-flow
  only; enforcement is convention now (isolate-by-default + the commit/closeout guards) and a bot-principal
  branch rule later. Full observe-only `main` stays a future flip for when a second human appears.
- **Visual changes land safely by an automated render-check in the gate (not a human).** A visual-touching lane
  (`*.njk`/`*.css`/template surfaces) auto-merges **only when** a headless Playwright render check passes on its
  booted WE+FUI cross-origin pair; the harness is a v1 deliverable, bounded "done" by reproducing the #1895
  transparent-`.fui-card` regression *and* its fix from the CLI. (Fallback if descoped: agents don't auto-land
  visual changes and the human owns visual surfaces via the direct-`main` path.)

**Enforcement ladder for the asymmetric posture (#1998 — spec of the "convention now, bot-principal later"
bullet).** The isolate-by-default + human-writes-`main` posture tightens in three rungs; only Rung 1 is live:

- **Rung 1 — convention (live now).** No server-side gate. Automated writers isolate by *practice* (the
  `/workflow` orchestrator clones + converges via `lane/*`; the serial `/batch` still commits on the current
  branch per Rule 104 as the interim), backed by the existing **commit/closeout guards** — the #1153 branch
  guard (denies `git switch`/`checkout -b`/`worktree add` in the shared checkout, forcing clones), the
  broad-stage `git add -A` denial, and the non-destructive-closeout invariant ([#1985](#non-destructive-closeout-prflow)).
  The removed never-push default still authorizes the **human's** direct `git push origin main`. Interim risk:
  nothing *prevents* an agent committing `main` directly — the floor is discipline, not a rule.
- **Rung 2 — server-side bot-principal branch rule (the specced future flip).** Agents authenticate to the
  remote as a **distinct GitHub principal** (a bot identity — a machine user or GitHub App installation token,
  never the human's credentials). A branch-protection rule on `main` **requires a PR** (blocks direct pushes)
  for that principal, while the human account is **exempt** (or holds a bypass allowance). Mechanically: the
  integrator's converge-to-`main` merge either runs under the human/owner identity (so it lands) or the bot
  principal is granted the narrow "merge own green PR" bypass; lane pushes to `lane/*` refs stay open for the
  bot (they are not `main`). Net effect: an agent *cannot* write `main` directly even by mistake — the
  convention becomes a server-enforced invariant — while the human's direct path is untouched. This rung needs
  a real GitHub remote + org/app setup, so it is **not** agent-executable (a human `setup` gate).
- **Rung 3 — symmetric observe-only `main` (deferred).** When a *second human* writer appears, the human's
  direct-`main` path also closes and everyone PR-flows. By then agents are already off direct `main` (Rung 2),
  so only the human's exemption is removed — nearly free. Deferred until the second-writer need is real (a lone
  trusted writer has no one to race, so forcing them to PR buys friction with no safety).

**Lineage:** #1996 (ratified 2026-06-30; report `we:reports/2026-06-30-pr-flow-rollout-mechanism.md`; research
topic `pr-flow-rollout-mechanism`); enforcement ladder specced by #1998 (Forks 1+4). Implements
[#1985 Rung 2](#non-destructive-closeout-prflow); builds on the #1933 clone model + #1995 push-retry; composes
with the #1153 branch guard and the removed never-push default (both unchanged). Visual harness files under
#1933 / #1167 / #1552.

**Rider — close-out is not a direct-`main` write path; session-meta is the one sanctioned-direct carve-out
(#2191, under the #2203 strict lock).** Post-#2183/#2203 **every edit-shaped change already landed via a
lane→PR during the session**, so a session's close-out must not re-open a direct-to-`main` path for it:
- **Close-out auto-commit is edit-work-free.** The `closing-session` clean auto-commit **no-ops on already-PR'd
  work** (the common case now — nothing edit-shaped is left uncommitted at close). Anything genuinely
  uncommitted-and-finished that IS edit-action work (source, content, a backlog item/resolve) routes through
  the **lane→PR** helper (`we:scripts/pr-land.mjs`), never a `git commit` on `main`. The serial `/batch` and
  `/workflow` producers already close this way (they land as open ready-to-merge PRs and touch no `main`).
- **Agent-memory *content* rides a lane→PR — it is not the carve-out.** Substantive **agent-memory** writes
  (`we:agent-memory-src/**` — the SoT #2266 physically relocated out of `.claude/`; a back-compat symlink
  remains at `we:.claude/agent-memory/`, so either spelling names the same durable content) are durable content,
  so under the lane machinery they **land via a lane→PR**
  (each candidate red-teamed first; the survivors ride the one PR the close opens) — never an agent
  direct-`main` commit. **The sanctioned-direct carve-out is `claims.json`-class *local signals* ONLY**
  (`claims.json`/`queued.json`/`reservations.json`): these are session bookkeeping the #2138-Fork-4 rider
  already treats as a direct *local* signal (read offline, Rule #105), written to disk for the local checkout
  and never pushed. The carve-out is **local signals only**; it never widens to memory content, source, content,
  or backlog edits (all of which take the lane→PR path).
  **(#2266 re-anchor.)** Relocating this SoT out of `.claude/` is a **physical path move only**: the
  lane→PR-only landing rule and the "never widens" carve-out above are **unchanged** and now attach to
  `we:agent-memory-src/**` (they do **not** grow a back-door direct-`main` path for the new spelling).
  Auto-approving the VS Code `.claude` permission prompt (via the personal redirect hook #2266 adds) is a
  **permission-gate event, not a landing-path change** — the write still lands in the working tree and lane→PR
  still governs how it reaches `main`, so it creates **no** new sanctioned-direct carve-out.
- **No other close-out path direct-commits edit work.** `/batch` close, `calibrate`, and the cost-on-card splice
  either fold into an already-PR'd lane commit or are session-meta under this carve-out. The `check:health` /
  closeout audit reports any residual uncommitted edit work for awareness — it does not auto-commit it to `main`.

**Rider — solo/interactive sessions lane uniformly (#2123, ratified 2026-07-02).** The "every automated
writing session" scope above covers **solo** agent sessions too — a lone `/next` build, a `/prepare`, a
`resolve` — not just `/workflow`: the writer in an agent session *is* the agent, so the human-writes-`main`
carve-out does not rescue them. Ruling: **every edit-action session runs in a lane clone and lands via the
flow, with no permanent content-session (`backlog/`/`reports/`/research) carve-out** — a "content" session
that then codifies a doc or regenerates a derived artifact silently crosses the line mid-session, and the
proven collision (`batch-2026-06-29e` clobbering a live `/prepare`) sat on that very file class, so
misclassification-safety beats the carve-out's live-observability edge. **Phase-1 trigger (capability, not
calendar):** code-only writing sessions lane **now**; interactive/content sessions stay on the shared primary
until a lane can boot its own WE dev-pair on its band ports (the `.env.local` env-load link), then flip — a
when-the-capability-lands trigger, not a permanent exemption. This **ends the Rung-1 interim for solo
sessions**. The claim-locus and lane before-state-soundness *mechanics* are session-tooling carried in the
#2138 merge-queue line — which also owns the self-approved-PR / GitHub-merge-queue landing substrate (#2138
Fork 5 → #2151 CI-on-PR, #2152 branch protection, #2153 PR drain) — not part of this scope ruling.

**Rider — decision-authoring uses a preview lane; #2123 stays uniform (#2187, ratified 2026-07-03).** #2183
direction-point 4 carved decisions as *author-in-`main`, then lane-at-ratify* so a decision's rendered effect
stays live-previewable while it is authored — but the now-active #2123 guard blocks primary-tree `Edit`/`Write`,
so that carve-out needed reconciling. Ruling: **decisions author in a dedicated PREVIEW LANE — no guard
exemption; #2123 stays uniform (no decision-authoring carve-out).** The ergonomic case for an exemption
(edit/review the exact primary tree the human watches) is a **solved tooling problem**: at a decision **claim**
the skill provisions/reuses the preview lane, `map`s it to the #2139 page-port proxy (so `:3000` stays the
single review URL), launches its dev server, and **opens the rendered `/backlog/<NNN>/` page** — the
live-authoring loop, in a lane (validated by hand 2026-07-03). This realizes the #2123 rider's
"flip interactive/content sessions to a lane once it can boot its own WE dev-pair" trigger for the decision
case. **Rejected:** a scoped `DECISION_AUTHORING=1` guard exemption — even tightly scoped to decision
`backlog/*.md` + this file, it re-opens the exact content-session carve-out #2123 ruled *against*; the preview
lane holds the rule uniform at the cost of one auto-managed dev server. The **ratify → lane** helper (apply the
decision diff in a lane clone → `resolve --codified-to` → ready-to-merge PR; mirrors `we:scripts/pr-land.mjs`)
is the landing transport. Spin-off (a) of #2183; siblings #2189 (/workflow PR fan-out), #2190 (per-path
routing), #2188 (/merge↔drain label convergence) delivered the rest.

**Rider — pre-PR independent review at the landing seam (#2170, first layer of the lane review design).**
Before **any** lane opens its self-approved PR (`we:scripts/pr-land.mjs`) — a parallel `/workflow` lane **or**
a solo `#2123` lane — the lane session spawns an **independent subagent review over its diff** (the
/code-review model, given the diff and nothing else, no author framing). Findings are **fixed in the lane,
pre-PR** (the cheapest place — the author context is loaded), and findings the lane **dismisses** are
**recorded in the PR body** (never silently dropped): both the audit trail and a first-class input to the
drain's escalation rubric (#2171). Mechanized by [`we:scripts/lane-review.mjs`](../../scripts/lane-review.mjs)
(`diff` = the exact `base…HEAD` diff to hand the reviewer; `body` = render dismissals → the PR-body block)
feeding `pr-land --body-file`; the two mechanical halves live there so the seam is identical everywhere,
while the judgement half (spawn reviewer, accept-vs-dismiss, fix hot) stays the session's. The rationale: a
fresh subagent has the same independent-eyes property as a separate review session for *finding* issues; the
residual gap (the author judging its own findings) is covered by recording dismissals + the #2171
escalation/sampling layer. Wired at the workflow-lane seam (`laneItemPrompt` step 3a, dismissals →
`dismissedFindings`) and the solo-lane landing seam alike. The `{findings, verdict}` shape any of these
reviewers renders — and the accept/changes/needs-human derivation from a findings list — is the ONE canonical
contract in [`we:scripts/lib/review-core.mjs`](../../scripts/lib/review-core.mjs) (#2325): `/code-review` is
Claude Code's own built-in surface (no source in this repo, so it can't import the module directly), but every
reviewer this repo spawns or scripts renders into that same shape rather than a hand-rolled per-caller copy.
The drain auto-review re-point + the new `/review` human-verdict skill (#2326) consume it directly.

**Rider — deferred merge queue: producers stop at lane-push, a human-drained unified command lands (#2138, ratified 2026-07-02).** The "auto-merge on gate-green" landing above binds the merge **authority** (the gate is the sole landing decision — no per-item human review, no hand-resolved merge) and its green **precondition** — **not the trigger *instant*.** Drain *cadence* (inline / deferred-batch / later-scheduled) is a separate dimension the #1996 clause never addressed; **default deferred-batch**: every lane-producing session — parallel `/workflow` and solo #2123 lanes alike — stops at "lane pushed + marked ready-to-merge" and **never touches `main`**, and a **human-launched unified drain** lands the accumulated queue serially under the existing integrator contract (full gate on the merged tree per merge, impl-first/WE-last, rebase-and-retry). This removes the two-concurrent-run race on the shared primary checkout and decouples a session's end from the 20–70-min integration. A future reader citing the "auto-merge **on gate-green**" bullet must read it as authority + precondition, **not** a timing binding. Sub-mechanics: **(Fork 2)** each item's cross-repo shape lives in a standalone `we:.lane-manifest.json` committed in the WE lane commit (a one-sided add that preserves the #1869 conflict-free WE-lane merge; the drain deletes it at landing); **(Fork 4)** "ready-to-merge" is a **local** queued token written at push (`we:claims.json`-adjacent, read offline — preserves Rule #105 "claim ignores git state"), with `lane/*` refs deleted at a **single point** after the whole couple's WE resolve is confirmed reachable on `main` (no `ls-remote` on the ownership hot path, no `status:queued` main-write during the queued window); **(Fork 5)** ready lanes open **self-approved PRs** (0 required reviewers + a required CI check) purely as the review/CI surface, but the **GitHub native merge queue stays OFF** — it is a *branch-level* setting that would grab a couple's WE-half PR out of impl-first/WE-last order and split the gate into two non-identical environments — and the **custom drain owns every merge** in couple-order; pure local `git merge` is the retained fallback. **Fork 3** (merge-risk lock lifetime under deferred landing) is codified as an amendment against [#merge-risk-optimistic-with-targeted-lock](#merge-risk-optimistic-with-targeted-lock). Successor to #2123's carried claim-locus + lane before-state mechanics and owner of the #2138 Fork-5 substrate arm (#2151 CI-on-PR, #2152 branch protection, #2153 PR drain). Report `we:reports/2026-07-02-deferred-merge-queue-substrate.md`.

**Rider — all edits behind ready-to-merge PRs; the drain is fully decoupled (#2183, ratified 2026-07-03).**
Generalizes the deferred-queue rider to its endpoint. **Every** edit path — `/workflow`, `/next`, serial
`/batch`, `/slice`, `/pr` — routes edit work through a lane clone → **ready-to-merge PR**; the producer
**never** integrates inline, **never** commits to `main`, and **never** launches or waits on the drain. A run
completes when every item is an open ready-to-merge PR, and the system is **correct with zero drains running**
— the PRs sit until *some* drain (`/merge`, `/drain`, or CI auto-merge) lands them, after which local `main`
pulls. This gives a **stable live-preview `main`** that changes only on merge (never churned mid-edit — the
core simplification). **Supersedes** #2138's / #2174's default-OFF-until-proven *inline-fallback* stance
(there is no inline integrate to fall back to once edits are PR-only) and **retires the disjoint-partition
producer machinery** (#1933) — with PR-per-item + a serial drain that rebase-retries, git-at-drain-time is the
sole arbiter. The ready-to-merge **signal is a PR label** (F1), so `/merge` and the drain converge on one
label-scoped lander that merges in cross-item `blockedBy` order (#2188). **Decision-authoring** is the one
special case — see the #2187 rider (preview lane; #2123 stays uniform). Delivered by **#2189** (/workflow PR
fan-out, drop partition), **#2190** (per-path routing for `/next` / serial `/batch` / `/slice`), **#2188**
(/merge↔drain label-lander convergence), **#2187** (decision preview lane). Reshapes #104
(commit-on-current-branch → lane-clone-HEAD; `main` advances only via PR merge).

**Rider — the solo frontmatter lifecycle rides the lane→PR; the prepare-window lock re-homes to a
hard-excluding local token (#2219, ratified 2026-07-04).** Residual of #2123: that ruling laned the solo
skills' *work* but left their **frontmatter lifecycle** straddling two trees — `/prepare`'s `claim`/`release`
status splice ran on the **primary** tree via the guard-exempt CLI, while the body + `preparedDate` could only
land via the **lane PR**. **Ruling (Fork 1, direction): every item-file frontmatter transition — `status` *and*
`preparedDate` — is authored in the lane and lands in the one PR; nothing splices to the primary item file.**
The item stays `open` on `main` through the prepare window and flips to `open + preparedDate` (= "✓ ready to
ratify") atomically when the PR lands — the same net-state shape #2138 Fork 4 ratified for the batch
`active→resolved` case, lifted to the solo `open→preparing→open` / `preparedDate` case. **Option (a) — keep a
primary-tree status splice — is REFUTED:** the item-file `status` is git-tracked backlog content, which #2191
rules onto the lane→PR path ("never widens to … backlog edits"); the CLI's `guard-lane` exemption is a property
of the enforcement hook, **not** a licence in the rule, and (a) reintroduces the primary↔`main` divergence
[#primary-read-only-lanes-only](#primary-read-only-lanes-only) forbids. **Ruling (sub-fork, concurrency):**
dropping the `open→preparing` splice removes a **hard selection-exclusion** (`we:scripts/readiness/engine.mjs`
filters selection to `status==='open'`), not a cosmetic board-state — and no existing local signal replaces it
(`claim` *clears* the reservation; a `reserve` hold only *deprioritizes*, TTL 120 min, local-only). So the
guarantee is **re-homed into a strengthened *local* prepare-hold token that HARD-excludes** — the
#2138-Fork-4 queued-token shape (selection skips it + `claim` refuses it, read offline per Rule #105) with a
lease longer than a real prepare, owned by a small **lane-run CLI verb** (`prepare-hold`/`prepare-stamp`/
`prepare-release`). The bare `reserve` soft-hold is the **named fallback / interim** only (its thin-pool,
TTL-expiry, and cross-clone double-prepare gaps are real, not hand-waved). **Downstream (forced):** the
`/prepare`, `/next-backlog-item`, `/resolve` close-out prose is rewritten to the (b) flow — *hard local
prepare-hold → provision/enter lane → author body + research + `status`/`preparedDate` in-lane → land the one
PR → release the hold*; the item-file `status` splice drops. Anchored on **#2123's defer-clause** (which hands
the claim-locus mechanics to this line) + **#2138 Fork 4** (the queued-token precedent); #2191's carve-out is
the general backlog-edit-scope authority. **Build arm:** #2264 (**shipped 2026-07-07**) delivers the token
(`we:scripts/readiness/prepare-hold-state.mjs` — a lease-bearing, offline, self-pruning hold), the three
lane-run verbs (`we:scripts/backlog.mjs` `prepare-hold`/`prepare-stamp`/`prepare-release`), the selection
HARD-exclusion (`we:scripts/check-readiness.mjs` drops a live-held item from every `--select` surface) + the
`claim` refusal, and the guard classification — `prepare-stamp` (the in-lane `status`/`preparedDate` splice)
joins the `we:scripts/guard-bash.mjs` primary-mutation set (blocked from a primary cwd, allowed in a lane —
the actual gate for a CLI splice, since `guard-lane` only sees the Edit/Write tools), while
`prepare-hold`/`prepare-release` write only the local token and stay unguarded. The bare `reserve` (b-plain)
soft-hold is retired as the named interim. Same lifecycle applies, weaker-form, to solo `/next` (`resolve`).
Report `we:reports/2026-07-02-deferred-merge-queue-substrate.md`.

**Rider — self-modifying items never edit the run's own executing tooling in the checkout a live run executes it from (#2077, ratified 2026-07-10).** A `/workflow` run may not apply a self-modifying item's edits — edits whose touch-set includes the run's *own* executing tooling — to a checkout that run is executing that tooling from; the observed wedge (`batch-2026-07-01-1947-2071`, commit `34a26a39`: #2073's lane edited the live orchestrator file mid-run, sandbox-locked, 5/17 landed) is structural, not bad luck. **The invariant:** the run's own executing tooling is never modified in the checkout a live run executes it from — the *edit itself* is ordinary work that lands like any other change and takes effect on the **next** run (the uniform CI prior art: pin the run's definition at run-start, land tool changes for the next run). **Fork 1 (detection) — ruling (a):** the predicate is a declared **`RUN_TOOLING` pathspec** in the canonical, unit-tested partition module ([`we:scripts/readiness/lane-partition.mjs`](../../scripts/readiness/lane-partition.mjs)), inline-mirrored in the workflow sandbox per the #2086 mirror pattern, matched against the **probe's predicted touch-set** at Phase 1 **after probes, before the Phase-2 pre-claim** (nothing claimed/pushed when a flagged item is turned away). Scope = the full run-tooling surface: the `.claude/skills/batch-backlog-items/` skill dir (the executing script) **plus** the scripts the run shells out to mid-run (`we:scripts/backlog.mjs`, `we:scripts/lane-pool.mjs`, `we:scripts/readiness/*`, `we:scripts/push-if-green.mjs`, `we:scripts/backlog-renumber-collisions.mjs`, `we:scripts/dev/render-check.mjs` + `we:scripts/lib/render-check.mjs`) — **not** the batch state files (already governed: lanes never touch `we:claims.json`) and **not** build config (#2149's separate merge-risk axis). Three detection seats + a drift test: (i) the probe-time match is the authoritative front door; (ii) a **post-hoc** check over each lane's reported `changedFiles` at integrate time catches a probe-under-reported self-modifier (carry the refs, don't merge in-run); (iii) the serial-lane agent prompt gains a hard *stop-revert-report-`dropped`* instruction closing the `mustSerialize` probe-less residual; and (iv) a **coverage-parity unit test** derives the run's shell-out set from the workflow source and asserts `RUN_TOOLING` covers it — fails-open-at-runtime → fails-closed-at-test-time, with the declared list staying authoritative (#2074). **Amendment folded at ratification:** the coverage-parity test must walk **transitive** shell-outs (a script invoked by another `RUN_TOOLING` script, not only those named directly in the workflow source), else the drift gap it closes re-opens. **Rejected:** a frontmatter `selfModifying` flag (**fails open** on omission — the unflagged orchestrator-feature item is exactly the failure case); a loader/engine `batchable:false` (**over-excludes** — blocks safe serial `/batch`, where no run executes the file). **Fork 2 (routing) — ruling:** **today (a)** the probe-time drop reports the item `dropped: "self-modifying"` pre-claim; it is then worked **solo or as the LAST item of a serial `/batch`** (a mid-batch edit to a shelled script changes what later items' seams execute — same mixed-version hazard, minus the sandbox lock), costing only scheduling. **Steady state (c)** — an *entailment of the #2138 deferred-queue rider above*, cited not re-ruled: once the drain substrate holds, a producing session never touches `main`, the clone edit never touches the executing file, and the drain lands it for the next run — no special routing needed. **Sunset (a)→(c) is capability-keyed**, not dated: the #2153 PR drain is live **and** the in-run integrator + serial lane are retired onto the queue (#2153 currently `blockedBy: 2160`, so not imminent). **Rejected (b):** the in-run serial lane — the observed wedge; unfixable by ordering (later phases still shell out to the just-edited tooling). **Drain-era residual (recorded for the #2153 build):** the drain is itself a live run that shells out to `RUN_TOOLING` (`we:scripts/push-if-green.mjs`, `we:scripts/readiness/*`), so within a drain pass `RUN_TOOLING`-touching queued items land **last** (or a dedicated final pass) and the drain invokes no `RUN_TOOLING` script after landing one; likewise an interim serial/solo re-route must not land a `RUN_TOOLING` change into the primary while a `/workflow` run is live (the sandbox lock makes that fail loud). Composes with [#merge-risk-optimistic-with-targeted-lock](#merge-risk-optimistic-with-targeted-lock) (different failure class — mid-run self-modification, not clean-but-wrong merges — disambiguated in the `RUN_TOOLING` code comment). Related but orthogonal to epic #2289 (NNN id allocation). Build arm: successor item filed at ratification. Research topic `self-modifying-run-tooling-exclusion`; report [`we:reports/2026-07-02-self-modifying-run-tooling-exclusion.md`](../../reports/2026-07-02-self-modifying-run-tooling-exclusion.md).

---

### PR ci-lifecycle state is a total, deterministic label function — no state read from a label's absence {#ci-lifecycle-total-label-function}

**Ratified 2026-07-10 (#2281).** The **directive** (a 2026-07-04 user call, settled statute): a PR's lifecycle status is always reflected by a **deterministically-applied label**, never inferred from the *absence* of one. Today three ci-lifecycle states break this — a `--no-wait` open PR is left **unlabelled** (`we:scripts/pr-land.mjs:577-579`), a red required check is left **unlabelled** (`we:scripts/pr-land.mjs:603`), and **blocked-ness carries no label at all** (it lives only in the uncommitted `we:.lane-manifest.json`, re-derived per drain pass at `we:scripts/merge-ai-prs.mjs:756-758`). **Scope:** this governs the **ci-lifecycle dimension** (checks / blocked) — a *different axis* from the `ready-to-merge` **landing-gate**, whose absence-semantics (#2183 F1 "the signal is a PR label"; #2138 F4 "a local queued token") are **preserved, not overridden**; the two compose. **Fork 1 (granularity) — ratified (b) total coverage:** every ci-lifecycle state carries a deterministic label — `checking` (in-flight) / `ci:failed` (red) / `blocked` (manifest `blockedBy` open) / `ready-to-merge` (green) — and **exactly one** is present on every open AI PR. The labels are set by **generalizing the existing CI-truth reconcile pass** (`reconcileGreenLabels`, `we:scripts/merge-ai-prs.mjs:702-718`, already run every drain pass + `--watch` interval) from green-only to *all* lifecycle labels — a self-healing sweep, **not** a per-check-tick write path in `pr-land`. The lighter **(a) terminal-only** (leave "checks-in-flight" bare) was the directive-author's available *relaxation* but was **declined**: it reads one state from absence (the directive's exact prohibition), and it fails its own "bare ⟺ in-flight" totality claim anyway — a check going red *after* `pr-land` exits strands a **bare terminal** PR, and the fix for that is the very reconcile-pass generalization (b) needs, so (a)'s only advantage (less label churn) collapses. **Fork 2 (names) — ratified `ci:failed` + bare `blocked`:** `ci:failed` names the *deterministic* red-check fact and opens a `ci:*` state family (`checking` may namespace as `ci:running`); `blocked` stays **bare** to match its true lifecycle sibling, the also-bare `ready-to-merge` landing-gate label (the lifecycle family's precedent is *no* namespace, not `review:*`'s). Rejected: `needs-fix` (reads as human judgment, not "`test` is red") and `blocked:deps` (YAGNI — the manifest `blockedBy` is the only block source that exists). **Composition (codified, not re-decided):** lifecycle labels are **mutually exclusive among themselves** and **orthogonal to `review:*`** (a PR can be `blocked` + `review:pending`) — already how the code composes `ready-to-merge` + `review:*` (`we:scripts/pr-land.mjs:625-630`). **Build arm (successor, agent-ready — #2421):** generalize the reconcile transition table to `lifecycleLabelFromCiTruth` + mint the new labels idempotently in the existing `gh label create` loop (`we:scripts/merge-ai-prs.mjs:870-881`) + extend the transition-table tests (`we:scripts/__tests__/pr-land.test.mjs`, `we:scripts/__tests__/merge-ai-prs.test.mjs`). Relates #2199 (the on-green `ready-to-merge` precedent this generalizes), #2216 (the reconcile pass that makes (b) cheap and (a) unsound), #2262 (the `review:*` mint step the new labels join), #2183 F1 / #2138 F4 (the landing-gate absence-semantics preserved).

---

### Agent fix/convergence: peer-agreement is not validation — independence rests on a distinct fresh validator, and the deterministic land-gate must be gaming-proofed {#agent-convergence-independent-validation}

**Ratified 2026-07-10 (#2398, graduated to epic #2410, successor to #2285).** When the drain converges an agent-authored fix
in-process (the editor↔reviewer negotiation loop shipped by #2311/#2310, wired live by #2326), the loop is one
**convergence bar**, not two paths: it lands only when *all* hold — **approach agreed · an independent validator
accepts · `check:standards` green · required `test` (CI) green · no test-tampering.** "CI green" is the
deterministic clause of that bar, not a separate feature; a red required `test` is just one open issue the loop
must fix before it may declare agreement (retiring the separate `lane-resume` `test-red` strand).

Two invariants govern *how* it converges (option **B** over "fresh reviewer every round"; both preserve the
core invariant — **a landed PR is accepted by an agent that did not author the fix**):

1. **Peer-agreement ≠ validation.** Two agents co-negotiating a fix share priors; their mutual agreement is
   consensus, not independent review. The non-author invariant therefore rests **entirely on a distinct fresh
   validator** — adversarial ("find the reason to reject") persona, rubric-anchored verdict, fresh context, given
   *diff + tests + rubric only* (never the peers' self-assessment — sycophancy → it ratifies). The stronger form
   is a small **diverse panel/jury** (different model/provider) to dilute self-preference/position/verbosity bias.
2. **A deterministic gate must be protected from the agents trying to pass it.** "CI green" is directly gameable
   (documented reward-hacking: agents weaken/delete tests or special-case outputs). The gate is only sound with
   **anti-test-gaming guards** — test files read-only to the author peers (or diff-gate any test change), fail the
   land if coverage drops or tests are removed/skipped, require a test that fails on pre-change behavior for logic
   fixes, and have the validator inspect for test tampering.

Applies to any AI-review/convergence surface in the constellation, not just the drain. Non-convergence (round cap)
or `needs-human` escalates to `review:human`, unchanged. Ship unattended auto-fix behind an off-by-default flag,
scoped to small/non-security diffs first, graduating per-repo on a clean track record (staged autonomy). Grounded
by `we:reports/2026-07-10-ai-code-review-best-practices.md`; the build lands under epic #2410 (successor to #2285).

---

### Blast-radius is advisory care-level, not a park-gate; the trust-chain gate fires on a *spec* change, not any path touch; the high-blast backstop is a diversity-selection AI panel + an active point-level human check {#blast-radius-advisory-care-not-a-gate}

**Ratified 2026-07-18 (#2563).** Composes with — does not alter — [`#agent-convergence-independent-validation`](#agent-convergence-independent-validation): a *care* signal routes **into** that convergence bar; this rule governs *which* signals gate a human vs run advisorily, and *how* the human check is delivered. Cite both together.

1. **Scored signals are advisory, not a gate.** Blast-radius, size, dismissed-findings, cross-repo, and 1-in-N sampling **annotate a care-level** that raises the convergence loop's scrutiny; they do **not** block the land on a review verdict. Gating a computed *risk score* is a documented anti-pattern (advisory dominates: CODEOWNERS/SonarQube gate *ownership*, not scores); the review still happens (via the loop), just not a human park. A repo may *tighten* a scored signal to a gate as config — where **`gate` means route-to-a-human, never hard-block-with-no-reviewer**.

2. **The trust-chain / statute gate fires on a *spec* change, not any path touch (Fork 1).** `gate-self`/`statute` stay human-gated, but narrowed from "any edit to a trust-chain path" to "a change to the trust-chain **spec**" — a **schema / executable contract, not prose** (only contract-as-spec makes "did the spec change?" a deterministic yes/no; prose forces interpretation, and no tool auto-detects prose drift). An implementation change under a *fixed* spec is agent-clearable on **conformance-green + independent review**; a diff touching the contract file itself is always human; ambiguous → human. Size is not the metric (a 1-char threshold flip is a spec change; a 200-line behaviour-preserving refactor is impl). First instance of the spec-based-programming direction (#2564).

3. **The high-blast backstop is a diversity-selection AI panel + an *active* point-level human check (Fork 2).** Humans review large changes *worse* (Cisco/SmartBear); a diverse AI panel does **not** decorrelate (LLMs share failure modes — the LLM analogue of Knight & Leveson 1986); a *passive* human monitor catches *fewer* defects than an unaided one (automation bias). So: high-blast auto-lands run a diverse panel **aggregated by diversity-selection, not majority vote**, plus a human check delivered **point-level** through the codified ruling console — a specific line/point, plain-language + example, **ratify / fork / challenge** — never a blanket "escalate the whole PR." An **always-review file blacklist** and **full-diff on demand** sit alongside. A **non-zero decorrelated human axis** must exist (the panel can't cover blind spots it shares): the operator's direct oversight satisfies it at current scale, and an automated **post-land audit sample** of AI-*cleared* content is a config option, enabled when throughput outgrows manual watch.

**Invariants preserved:** the conflict-of-interest / non-author rule (#2439); non-convergence hard-escalates to `review:human`; one shared review core (`we:scripts/lib/review-core.mjs`). Applies to any AI-review/convergence surface in the constellation. Grounded by `we:reports/2026-07-18-blast-radius-advisory-review-gating.md`, `we:reports/2026-07-18-spec-based-programming-deep-research.md`, `we:reports/2026-07-18-human-vs-ai-review-cognitive-science.md`. The point-level ruling surface is the **same** build as the decision-ruling console (#2494/#2555), not a duplicate.

---

### Behaviour/event attribute *names* are colon-namespaced — a collision-safe internal authoring spelling, not the platform-shaped standard proposal {#attribute-name-colon-namespacing}

Decided **per surface** (separators track what each namespace permits, not uniformity — [registry-name-guard](#registry-name-guard-namespace) `:672`). **(Fork 1)** Behaviour/event attribute **names** stay **colon-namespaced** *when they belong to a family* (`view:*`, `on:*`, `nav:*`, `droplist:*`, `route:*`, `grid:*`) — collision-safe by construction (a native HTML attribute name never contains a colon). **A *family-less* behaviour keeps the simplest possible name — a bare single hyphen (`type-ahead`, `focus-delegation`) — and takes no colon** (amended by #1991, 2026-07-01): native HTML separates multi-word attribute names by **smashing, not hyphenating** (`shadowrootmode`, `contenteditable`, `crossorigin`), and bare hyphenated native attrs are two legacy cases (`accept-charset`, `http-equiv`) plus the `data-*`/`aria-*` prefix families — so a bare single-hyphen author attr is not at meaningful native-collision risk, and a colon on a *singleton* buys neither sibling-disambiguation nor readability. The colon is reserved for where it pays off: a **family** = a surface/domain with ≥2 related members (or an established control-flow/event group). A family-less name that later gains a sibling colon-ifies then (a one-time mechanical rename). The load-bearing **framing**: colon is WE's *current collision-safe **internal authoring** spelling* for namespaced directives, **not** WE's claimed *platform-shaped standard proposal*. A colon on an HTML attribute spec-*connotes* an XML namespace (`xml:lang`); WE's `:` is the ownership-colon idiom (`:672` + #1913), **not** an XML-namespace declaration. The closest *proposed* author-attribute standard is **hyphen** (`enh-*`, WICG#1029/whatwg#2271); WE **declines to chase it while unshipped** (don't-chase-a-draft), and the separator is intended to be **app-configurable** (the reconciliation bridge to the eventual ratified spelling — mechanism deferred to #1992). If a hyphen form is ever adopted it is **`enh-*`**, **never `we-*`** (a pure vendor prefix contradicts proposing-in-platform-shape). **(Fork 2)** Third-party `<template type=…>` **values** are **`owner-kind` hyphen** (`type="acme-card"`; bare `type="if"` reserved for **core**) — native `type` values are never colon-namespaced, hyphen matches the custom-element idiom and keeps RFC 6648 ownership-not-status without reopening #1983's no-native-analog defect. **Settled by precedent (not forks):** native-aligned attrs → **bare** (`multiple`); author data → **`data-*`**; comment-directive names → colon `ns:name` (grammar-locked, no native-attribute collision risk). Detail codified in `conventions.md#attributes`.

**Lineage:** #1987 (ratified 2026-06-30 — Fork 2 then Fork 1; report `we:reports/2026-06-30-we-naming-convention.md`). Fork 1 skeptic **landed** a propose-in-platform-shape hit, **absorbed by amendment not overturn** (the framing above; `:672` cites `nav:list` not only `xml:lang`; the skeptic itself concluded defer-don't-migrate). Fork 2 skeptic **flipped** the default colon→hyphen. Rests on [registry-name-guard](#registry-name-guard-namespace) (`:672`) + [#1913 ownership-not-status](#custom-intents-namespace-by-ownership) (`:1516`, principle only — its colon is scoped to intent IDs); #1983 carved value-namespacing here (`block-standard.md:382-401`). Triggers conformance cleanup #1991. **#1991 (ratified 2026-07-01) amended Fork 1:** colon is **family-only**; family-less behaviours stay bare single-hyphen — grounded in native's smash-not-hyphenate word-joining, so the singleton colon (`list:type-ahead`) was DevX cost for no collision benefit (`type-ahead` stays `type-ahead`). Sibling marker-grammar question = #1989.

### Subscription-funded headless agent-spawning uses the CLI backend behind a backend-agnostic runner interface, composing with the write-time deny gates {#agent-runner-cli-backend}

The Plateau Loop's supervised builder (#2530) spawns Claude agents as supervised children. Two forced
invariants + three ratified fork calls (#2444, ratified 2026-07-16):

- **Auth/backend (settled by research) — spawn the `claude` CLI on the user's subscription; the Agent SDK is a
  later API-key backend, never the phase-1 path.** `claude setup-token` mints a CLI credential the CLI honors
  on Pro/Max; SDK subscription use is undocumented + terms-restricted, so SDK-on-subscription is *broken*, not
  merely worse.
- **The interface is backend-agnostic** — `spawn/steer/stop/resume/observe` are backend-neutral ops, so an
  SDK/API-key backend slots in later with no UI or orchestration change.
- **(Fork 1) `steer(text)` rules on the delivery GUARANTEE, not the channel: boundary-delivery, queued,
  non-dropping** (impl: a queued `{"type":"user",…}` message on the child's open `--input-format stream-json`
  stdin). Earliest-possible mid-turn delivery (a PreToolUse deny-with-reason) is a deferred enhancement *behind
  the same op*, never the guarantee — it silently misses pure-reasoning stretches and a repeat-deny aborts a
  headless session.
- **(Fork 2) The headless permission model = a static per-task-type `--allowedTools` baseline PLUS the
  constellation's existing non-blocking write-time deny hooks** (`we:scripts/guard-bash.mjs`, lane-guard,
  locus-prefix). A deny *is* a resolution (it reaches the model, which routes around it), so nothing goes
  unresolved and a headless `-p` session cannot abort on a permission — strictly more abort-resistant than a
  bare allowlist. **This COMPOSES WITH the write-time shared gate (#883) — the runner inherits those gates, it
  does not define a rival mid-run policy nor move all gating to launch.** A *human-blocking* per-tool UI
  approval is excluded (a slow/absent click aborts the session).
- **(Fork 3) Stop = graceful-boundary-first, escalate to `SIGTERM` on a timeout; `--resume` continues a clean
  pause, a redirect FRESH-SPAWNS.** Never `--resume` a turn killed for looping (it re-injects the poisoned
  context). Discarding a killed turn is cheap only because edit-work lands in a throwaway lane clone
  ([PR-flow rollout](#pr-flow-rollout-mechanism)), so nothing durable is lost.

**Lineage:** #2444 (ratified 2026-07-16; report `we:reports/2026-07-12-claude-cli-agent-runner-headless-contract.md`;
research `/research/claude-cli-agent-runner-headless-contract/`). Each fork survived an independent skeptic +
a fresh-context two-confusion screen: Fork 1 re-cast channel→guarantee (screen fix); Fork 2's default flipped
bare-allowlist→allowlist+inherited-write-time-gates (skeptic REFUTED the bare allowlist as
under-provision-aborts / over-provision-theater); Fork 3 amended to graceful→SIGTERM + fresh-spawn-on-redirect
+ the lane-clone citation (skeptic). Consumed by the runner interface built in #2530.

---

### Spec-based programming: the spec is a schema-skeleton + a prose layer; human-gates-spec / agent-implements, in a federated constitution→law→impl hierarchy {#spec-is-schema-human-gates-spec}

**Ratified 2026-07-19 (#2564).** The constellation adopts spec-based programming: the human's attention is
spent on the few **spec** artifacts, and an **implementation** under a fixed spec is agent-clearable on
conformance-green + independent review. Load-bearing rules:

- **A spec is a schema *skeleton* + a first-class, permanent *prose* layer, in one artifact.** An empirical
  audit (`we:reports/2026-07-19-schema-prose-expressibility-audit.md`) found pure-schema is ~0% of real specs:
  the machine-checkable part is the axis/enum/shape vocabulary; the contract's meaning (semantics, defaults,
  behavior, a11y, judgment) is prose, inside the same artifact (`we:src/_data/*.json` `summary`/`description`).
  So "schema, not prose" is **reframed** to *schema where faithfully expressible, disciplined prose for the
  rest*. **"Did the spec change?" stays deterministic** — any diff to a contract artifact (prose included)
  trips the path/artifact test → human (composes with [#blast-radius-advisory-care-not-a-gate](#blast-radius-advisory-care-not-a-gate)).
  Prose ambiguity is **mitigable** (controlled vocabulary, glossary-anchored terms, EARS phrasing,
  one-fact-per-statement, a per-statement `[@test]` binding) — a rigor spectrum, not a fatality.
- **Human-gates-spec / agent-implements, in a *federated* three-tier hierarchy: constitution → law/spec →
  implementation.** The **constitution** (core principles — non-author invariant, WE-holds-zero-impl,
  segregation of duties) is **never applied to a diff directly**; only the derived law is. Tiers exist at
  **platform scope (supreme)** and **per-project scope (subordinate — a project constitution derives from and
  may not contradict the platform one)**; the amendment gate and consistency check scale with scope.
- **WE holds the spec + the meta-schema + static conformance; the behavioral conformance suite is Plateau/FUI**
  (composes with [#intent-conformance-is-block-compliance](#intent-conformance-is-block-compliance) and
  [#surface-contract-not-computation](#surface-contract-not-computation)). The prose layer is governed by
  **per-statement check-binding** (attach a machine check to each statement that admits one; hold the rest to
  the rigor discipline) — not an executable-by-default ratchet.
- **The auto-clear path is measured, not trusted.** The independent AI reviewer's false-clear rate is obtained
  by a purpose-built instrument (stratified sample + a **shadow-harness** seeded-defect audit that never enters
  the merge path); a **permanent non-zero human sample** stays as the backstop (the human is the only
  decorrelated axis — [#agent-convergence-independent-validation](#agent-convergence-independent-validation)'s
  staged-autonomy clause governs graduation; not re-declared here).
- **Constitutional amendment is substantively entrenched** — exempt from the ordinary supersede-with-lineage of
  the statute layer (the *Platform Decisions = Statute Layer* rule, #911), plus a cooling period in days and a
  committed external record; a headcount quorum is adopted when the polity grows. **Constitutional-consistency
  of a new spec is human-decided, never machine-decided** (an advisory per-principle critique may assist).

**Lineage:** #2564 (ratified 2026-07-19; first concrete instance #2563 Fork 1). Reports
`we:reports/2026-07-18-spec-based-programming-deep-research.md` + `we:reports/2026-07-19-schema-prose-expressibility-audit.md`;
research `/research/spec-based-programming-constellation/` + `/research/schema-prose-expressibility-audit/`.
Every fork survived an independent skeptic + a fresh-context two-confusion screen; the reframe + Fork-4 flip
came from the expressibility audit during ratification discussion. Composes with (does not re-declare)
[#agent-convergence-independent-validation](#agent-convergence-independent-validation),
[#blast-radius-advisory-care-not-a-gate](#blast-radius-advisory-care-not-a-gate),
[#intent-conformance-is-block-compliance](#intent-conformance-is-block-compliance), and #911.

---

## Standing process & method rules (codified in the topical docs — pointers)

These are already enforced/written elsewhere; listed here so the platform's rules are findable from
one place:

- **Design-first / materialization** → [design-first.md](design-first.md): document in JSON/njk
  before implementing; plan → discrete homes (reports + JSON + research topics).
- **Native-first default; config extends a platform default** → [conventions.md](conventions.md),
  [architecture.md](architecture.md).
- **Minimize lock-in; the protocol is the only lock** — devtools = zero lock-in; protocols =
  impl-swappable + graceful degradation. Forward (generation) adapters reach polyglot/enterprise
  (#463); adapter-as-normalization-hub for ingest.
- **Baseline-2024 substrate floor; polyfills opt-in** → AGENTS.md hard rule 6 (#031).
- **Backlog & decision workflow** (fork-existence test, fork-is-not-prioritization, support-all,
  prepared=DoR, reversibility, no decision+epic conflation, resolve-by-parent-edges) →
  [backlog-workflow.md](backlog-workflow.md).
- **Backlog hold model** — two mechanisms for two jobs (#1620, amends #1392): `priority: low` *demotes*
  from auto-select but stays visible (settled-but-low-value-now); `maturityGated` (+ a typed, external
  `maturityTrigger`) *removes* until build-now-stops-being-worse. Parking is never a prioritisation escape →
  [backlog-workflow.md#hold-model](backlog-workflow.md#hold-model).
- **Program definition — the strict bar for a perpetual `ongoing` epic** (four-part Program Test:
  standing goal + conformance front + currency front + cadence; watch mode is a lifecycle state;
  L0→L2 maturity ladder; "evergreen" = the property a program maintains) →
  [backlog-workflow.md#program-definition](backlog-workflow.md#program-definition).
- **Prove claims by observation** → AGENTS.md hard rule 7 / [testing.md](testing.md).
- <a id="memory-optimization-strategy"></a>**Memory-optimization strategy — right-home / prune only; eviction closed** (#1868, under watch #1855): shrink the always-loaded memory surface via rule-1 right-homing of durable rules into this doc + the AGENTS.md router (agent-read on-demand). **Evict-to-recall-only is CLOSED** — a fresh-session recall test (2026-06-27) read NEGATIVE: the harness auto-loads only the `MEMORY.md` index, so an *unindexed* topic file is unreachable and eviction would lose the fact. The index is the sole recall surface; the gate's error on any unindexed topic file is correct. Realistic reclaim is modest (most memories carry nuance beyond canon, #1881). Gate tracks the documented ~24.4 KB limit (22 KB ceiling). Full strategy → [memory-management.md#strategy--direction-the-target-architecture](memory-management.md). **Amended by #1893 — see below.**
- <a id="memory-index-tree"></a>**Memory index is a router-tree** (#1893, amends [#memory-optimization-strategy](#memory-optimization-strategy)/#1868): `MEMORY.md` is a three-tier tree — an always-loaded **category map** + a ~12-rule **core-invariants** block; recall-gated `index-<category>.md` **sub-indexes**; numbered leaf files `N-slug.md` reached by the `we:scripts/memory-resolve.mjs` router (by number or slug). #1868's eviction-closed test covered only *fully-unindexed* files; every sub-index here is reachable from the always-loaded map via the **same explicit-read router pattern** this doc already endorses, so the index drops ~20 KB → ~3 KB while the core invariants stay always-loaded. `we:scripts/check-memory.mjs` enforces the shape: the map links **only** `index-*` sub-indexes (a leaf link there is denied — the anti-regression guard), and every leaf must be reachable. Residual to watch: reliability of opening the right sub-index for *subtle* relevance. Full spec → [memory-management.md#index-tree](memory-management.md).
