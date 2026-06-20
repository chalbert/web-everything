---
kind: decision
size: 5
status: resolved
blockedBy: ["141"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-14"
relatedReport: reports/2026-06-14-source-awareness-substrate.md
crossRef: { url: /backlog/141-dev-browser-vision/, label: "Dev-browser fix-loop (#141)" }
tags: [dev-browser, fix-loop, source-awareness, source-map, ide, deployed-app, foundational]
---

# Dev-browser source-awareness & IDE bridge — map deployed DOM back to source for the #141 fix-loop

## Digest

The [#141 fix-loop](/backlog/141-dev-browser-vision/) and [#410's deployed live-patch](/backlog/410-dev-browser-deployed-app-live-patch-gated-capability-safety-/)
both assume the browser can map a rendered DOM node — on a *deployed*, possibly minified, source-maps-stripped
URL — back to the **source construct** that produced it, then act on the repo (jump to `file:line`, open a PR,
drive the IDE). No item captured this implied dependency. **No design existed yet**; this prep surveyed the
established practice and published the [`source-awareness-substrate`](/research/source-awareness-substrate/)
research topic. The survey **reshapes** the item: the substrate is **two orthogonal provider chains** (a
node→source *resolver* + an IDE *bridge*), not one mechanism — so the registries themselves are
*support-all-coherent*, not a winner-pick. **2 genuine forks** remain, each with a **bold** default: the
**cold-deployed anchor representation** (the real call, a disclosure tradeoff) and the **IDE-interaction
depth / carve** (separation bias). Ratification, not research.

## Ratification (2026-06-14)

**Ratified — both forks resolved to their default (A); the two provider registries ratified as-shaped.**

- **Fork 1 — anchor representation → A (opaque-id `data-*` + sidecar manifest).** The least-leaky anchor; the
  WE-standard-owned self-description extension. **Fixed invariant upheld: emission is opt-in, off by default.**
  Rejected: B (raw `data-source-file` in DOM — leaks the tree), C as primary (source-map sidecar — wrong
  granularity; kept as the resolver's lowest tier).
- **Fork 2 — IDE-interaction depth → A (substrate now, deep extension carved).** Ship passive `file:line` jump
  + FS-Access patch-write as the must-have substrate; the deep two-way VS Code extension carves to its own
  story (separation bias). Rejected: B (one item incl. the extension — fails separation with no coupling cost).
- **Registries** (resolver + bridge) ratified as support-all-coherent provider sets with the stated precedence
  + degradation rules — not a winner-pick.

**Graduated to** (the spin-off `blockedBy` chain): **#575** anchor contract + resolver registry (standard) ·
**#576** bridge registry — passive + FS-Access (Plateau) · **#577** deep two-way VS Code extension (carved,
Fork 2A). **Surfaced follow-on fanned out:** **#578** fix-loop git-integration decision (Cluster A,
needs-prep) · **#579** platform-default VCS conventions into the compliance layer (Cluster B). Item resolved.

## Axis-framing

The original framing ("source-awareness is a provider set") was right but conflated **two independent axes**
the survey separates: a **resolver chain** (DOM node → `file:line`) and an **IDE-bridge chain** (act on the
repo). Any resolver composes with any bridge. Both are registry seams in the same provider-set shape the
standard already uses — the runtime analogue of the dev-server `/__dev-panel/selection` bridge that already
writes a browser selection back to disk ([we:tools/dev-panel/vite-plugin.ts:11](../tools/dev-panel/vite-plugin.ts#L11),
[:260-281](../tools/dev-panel/vite-plugin.ts#L260)) and the verify-gated autofix engine the PR step reuses
([we:scripts/autofix/engine.mjs:229-247](../scripts/autofix/engine.mjs#L229)). The hard constraint is the
**cold deployed/minified** case: nearly all convenient tooling (React `__source`, LocatorJS, dev-server
`launch-editor`) is dev-build-injected and **stripped in prod**, and the *only* resolver family that survives
a stripped build is a **build-emitted string-literal `data-*` anchor** — which makes the anchor the keystone,
and its representation the one genuine on-merit fork. The anchor is a no-leakage **extension of the app's
introspectable self-description** (the #141 gate reads registries/intents/contexts/traces +
[we:capabilityMatrix.json:1](../src/_data/capabilityMatrix.json#L1)) — so, per #475/#091, the WE standard owns
the *anchor contract* and the Plateau dev-browser owns the *resolver + bridge* that consume it.

### Recommended path at a glance

Ratify both rows, or override just the one you'd change. The **confidence** column says where judgment is
actually needed. (The two provider registries below the table are *not* forks — they're support-all-coherent;
see "Supported by default.")

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · cold-deployed anchor representation** | opaque-id `data-*` + sidecar manifest (least-leaky) | raw `data-source-file`/`-line` in DOM | **Med** — sweet-spot is clear but unoccupied/unproven |
| **2 · IDE-interaction depth / carve** | passive jump + FS-Access write is the substrate; deep two-way VS Code extension → carve to a child | one item incl. the rich extension | **Med-high** — separation bias; the extension is plausibly its own story |

## Supported by default (not decisions — support all coherent)

Per the fork-existence test, the **two registries** are *not* a decision — every provider present is used,
the only rules are precedence + degradation (ratify as the shape, don't pick a winner):

- **Resolver registry** (node → `file:line`), precedence: **build-emitted source anchor** (only cold-deployed
  option) → **framework debug metadata** (`__source`/LocatorJS — dev-only, React-19-fragile, *don't* build on
  framework internals) → **source maps** (ECMA-426; JS-position granularity, usually stripped).
  **Degradation:** with no anchor on a stripped prod build the resolver is *inert* — the gap Fork 1's anchor
  exists to close.
- **IDE-bridge registry** (act on repo), precedence: **VS Code extension** (true two-way, if installed) →
  **File System Access API** (zero-install deployed-tab patch-write, Chromium-only) → **`vscode://file` deep
  link** (jump-only, universal) → **dev-server `launch-editor`** (localhost dev only).
  **Degradation:** no extension + non-Chromium browser → fall to a `vscode://file` jump (open-at-location, no
  patching).

## Fork 1 — Cold-deployed anchor representation

**Crux.** The resolver registry degrades to inert on a cold deployed URL unless the build ships a stable
node→source anchor that survives minification. *How* that anchor is represented is a genuine either/or with a
security/disclosure tradeoff — minifiers don't rename markup strings, so a `data-*` attribute survives, but it
puts source location *somewhere* public. Precedent: `@sentry/babel-plugin-component-annotate` ships
`data-sentry-source-file` into prod today.

- **A — Opaque id `data-*` + sidecar manifest** *(recommended)*. Ship an opaque stable id per node
  (`data-we-src="a1b2"`); a separately-served manifest maps id → `file:line`. Survives minification, keeps raw
  paths out of public DOM, and the manifest can be access-gated to an authorized dev session. Cost: a lookup
  indirection and a build-emitted sidecar. The least-leaky design and the currently-unoccupied sweet spot.
- **B — Raw `data-source-file` / `data-source-line` in the DOM** (Sentry-annotate style). Simplest, no
  sidecar, works with zero coordination. Cost: leaks the full source tree layout into every deployed page —
  an information-disclosure surface on public apps.
- **C — Authorized source-map sidecar only** *(Rejected as the primary anchor)*. Serve source maps to an
  authorized session and resolve via them. *Rejected:* maps JS positions, not DOM nodes (wrong granularity),
  and is absent on most deployed builds — it's a *fallback resolver*, not a node-anchor. Keep it as the
  registry's lowest-precedence tier, not the cold-deployed keystone.

**Default: A — opaque-id `data-*` + sidecar manifest.** This is a disclosure-sensitive axis, so the usual
most-permissive default **inverts** toward least-leaky (as #410 inverted to most-restrictive-safe). The anchor
is authored as a **self-description extension contract** owned by the WE standard (reusing the
capability-manifest vocabulary), emitted by the conformant app and consumed by the dev-browser.

**Fixed invariant (holds under either representation): anchor emission is opt-in, off by default.** The build
ships *no* source anchors unless the author explicitly enables it via a build flag — the restriction is the
default, instrumenting is the opt-in (the most-permissive default applied to *exposure*: don't leak by
default). This is a *fixed mechanic*, not a third option of this fork: it's true whether the author picks A or
B. So the disclosure cost of B and the indirection cost of A are only ever paid by a build that deliberately
turned anchors on.

## Fork 2 — IDE-interaction depth, and whether the deep two-way extension carves to a child

**Crux.** The bridge registry spans a wide capability range, from a one-way `vscode://file` jump to a VS Code
extension that applies `WorkspaceEdit` patches and **emits which projects are active and coordinates work
two-way**. The question is how much of that depth is *this* item's substrate vs. a separable richer layer —
the standing **separation bias** applies (burden of proof is on combining).

- **A — Substrate = passive jump + FS-Access write; carve the deep two-way extension to its own child**
  *(recommended)*. #562 delivers the resolver + the bridge registry with two ship-now providers: open
  `file:line` (passive, universal) and File System Access API patch-write (active, zero-install, Chromium).
  The rich VS Code extension that "emits active projects and coordinates work" (active-project awareness,
  unsaved-edit conflict, two-way sync) is a plausibly-own-story layer → **carve to a new `type: story` child**
  that #562 `blocks`. Keeps the foundation shippable and the extension independently prioritized.
- **B — One item including the rich extension** *(Rejected)*. *Rejected:* fails the separation bias with no
  named coupling cost — the extension is a large, separately-valuable surface (its own install, lifecycle,
  and active-project model) that the fix-loop's PR step doesn't need in v1. Combining inflates #562 and
  couples the must-have substrate to an optional layer.

**Default: A — ship passive jump + FS-Access write as the substrate; carve the deep two-way VS Code extension
to its own prepared child story.** *Sub-decision at ratification:* scaffold the child item (active-project
emitter + two-way patch coordination) and add it to #562's `blocks` chain.

---

## Context

### Why this is captured here

It surfaced while ratifying #410 as an *implicit* premise of the whole #141 fix-loop: "propose a fix → verify
it → **open a PR against the source repo**" only works if the browser knows *which source produced the
rendered thing it is patching*. #141 names the introspectable self-description (registries, intents, contexts,
traces) but never the **DOM-node → source** link or any IDE interaction. It's a shared foundation — even v1's
local-session patch→PR needs it — so it lives under #141, not as a fork of #410. The hard, distinguishing case
is exactly #410's: a *deployed* surface, where the easy local-dev assumptions (dev server, unstripped source
maps, a checked-out workspace) may all be absent.

### Per-fork classification (recorded)

- **Resolver registry & bridge registry** — runtime-DI provider-set seams (the "registry of source-awareness
  providers" the item named). Support-all-coherent (fork-existence test): every present provider is used;
  precedence + degradation are the only rules → not a winner-pick (demoted to "Supported by default").
- **Cold-deployed anchor (Fork 1)** — the anchor *contract* is an Intent/self-description extension the
  conformant app emits; classified as a **standard-owned contract**, *not* a Protocol (no swappable-vendor
  interop story beyond app-emits/browser-consumes; reuse the capability-manifest vocabulary, don't coin a
  protocol). Default inverts from most-permissive to least-leaky (disclosure-sensitive, like #410).
- **IDE-interaction depth (Fork 2)** — separation bias resolves it: substrate now, rich extension carved.

### Relationships

- **Foundational to** the #141 fix-loop's PR step and #410's build follow-through (and thus #555/#557).
- **Not a blocker of #410's *decision*** — #410's forks (isolation/auth/lifetime/audit) are orthogonal to
  *how* source is located; this gates the *build*, not the ratification (#410 is resolved).
- **Constellation split** (#475/#091): the **anchor contract** → WE standard; the **resolver + bridge +
  dev-browser** → Plateau product.
- On ratification, the item **graduates to spin-off builds** via a `blockedBy`/`blocks` chain: the anchor
  contract + resolver registry, the bridge registry (passive + FS-Access), and the carved deep-extension child
  (Fork 2A).

### Surfaced follow-on work (document-only — NOT decided here)

Brainstormed while preparing #562, **not** part of this decision. The fix-loop's *"act on the repo → open a
PR"* step (and the bridge that applies patches) quietly assumes a whole **VCS-interaction surface** nobody has
captured. File these as their own items **on ratification** — listed here so they aren't lost. Each carries a
first-cut classification so the later filing isn't mis-scoped.

**Cluster A — bot-PR mechanics (real design surface; likely one decision cluster, `blockedBy` #562/#141):**
- **Generated code is NOT privileged — it runs the identical review + code-compliance gates as a human PR**
  *(near-invariant; the principle the rest of Cluster A hangs on)*. A generated fix passes the project's full
  pipeline — **lint, tests, type-check, static analysis / SonarQube (quality gate, coverage, no new code
  smells), branch protection, required human review/approval** — with **no bypass path**. The autofix
  **verify gate** ([we:scripts/autofix/engine.mjs:229-247](../scripts/autofix/engine.mjs#L229)) is *necessary but
  not sufficient*: it proves the fix cleared the failure locally; the org's CI + review still gate the merge.
  Which gates apply is **read from the compliance layer** (same source as Cluster B), not asserted by the bot.
  Couples to #410's autonomy ladder — *auto-merge is only ever reachable after every gate is green.*
- **Git flow / PR strategy** — draft vs ready, target branch, one-fix-per-PR vs batched, rebase/squash/merge,
  and **auto-merge policy** (couples to the #141/#410 autonomy ladder — the autonomy dial *is* the merge dial).
- **Forge auth & bot identity** — how the browser/extension authenticates to the forge to open a PR, and the
  bot's commit identity / signed commits (DCO/GPG). Couples to #410's authorization dial.
- **Forge-agnosticism** — GitHub / GitLab / Gitea as a **provider seam** (mirrors the bridge registry): is
  "open a PR" abstracted behind a forge provider, so the loop isn't GitHub-locked?
- **PR body / evidence payload** — what the PR carries (the conformance failure + the verify before/after the
  autofix gate already produces), labels, required-approval / reviewer-assignment policy.
- **Conflict & concurrency** — stale base, concurrent fixes racing, and the unsaved-edit conflict Fork 2
  already names for the local case.
- **Revert / rollback** — how a *merged-but-bad* AI fix is backed out (ties to #410's revertibility ruling).
- **Monorepo / multi-repo targeting** — which repo/package across the constellation a patch lands in when the
  rendered source spans repos.

**Cluster B — conventions (NOT prescriptions — the loop reads them *to know what to follow*; they live in the
compliance layer, platform-defined):**
- **Branch naming convention** and **commit message convention** (format, conventional-commits?, a trace/failure
  back-reference, the `Co-Authored-By` bot trailer). The fix-loop doesn't *prescribe* any of these — it needs
  to **know what to follow**, and that knowledge is **read from the compliance layer**, not invented by the bot.
- **Home & ownership:** the **compliance layer** (webcompliance, #436/#437), with **platform-defined defaults**.
  WE **never mandates** conventions; it ships a default vocabulary enforced via webcompliance, and because defaults live in a project config that extends the platform default,
  the **default vocabulary is defined by the platform config** which a project's config *extends/overrides* — so
  the convention set is platform-defined-by-default, project-customizable, compliance-enforced. The bot/loop is a
  pure **consumer**: it reads the project's resolved compliance convention and conforms to it.
- File as: an item that carries the **platform-default convention vocabulary** into the compliance layer (the
  branch/commit/PR shape the loop reads), *not* a decision that picks "the one true branch name."

**Framing:** Cluster A is genuine design (a "fix-loop git-integration" decision or small cluster); Cluster B is
already-ruled in shape (platform-defined defaults, project-customizable, compliance-enforced, bot-consumed) and
just needs an item to carry the default vocabulary into the compliance layer. Neither is decided here — this is
a capture so ratifying #562 can fan them out.

**Graduated to** `none` — umbrella — split into #575 / #576 / #577 (dev-browser source-awareness IDE bridge).
