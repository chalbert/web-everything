# #930 — the Plateau-creator manifest → FUI workbench-stage token bridge (prep survey)

**Date:** 2026-06-18 · **For:** decision #930 (carved from #751, surfaced by the batch-2026-06-18 claim) ·
**Status:** prepared, awaiting ratification (`/next decision`)

#887 ratified the *transport* (origin-validated `postMessage`, the resolved/inline #747 manifest crosses
the wire) but explicitly left "the `apply-design-system` message's exact field list / fidelity" a build
detail. That detail is a genuine **semantic-alignment fork**: the creator authors an open **DTCG** token
set while the FUI workbench stage renders through **5 fixed `--wb-*` custom properties**. How does the
receiver bridge the two? This survey grounds the fork against the real trees and the design-token prior
art, and lands a recommended default.

## The two vocabularies (verified against the trees, 2026-06-18)

**Producer — the Plateau creator (open DTCG).** The creator authors a #747 manifest of the #871 shape
`{ extends, themeTokens, intentDefaults?, traitDefaults? }`:

- `themeTokens` — an **open, flat DTCG map** (`plateau:plateau-app/src/design-system-creator/manifest.ts:18`
  *"the theme token set (name → value)… In WE this is a DTCG ref; the creator authors the values inline"*).
  The starter (`plateau:provider.ts:9-43`) ships `color.primary/surface/text`, `space.sm/md/lg`,
  `type.body/heading`; the **import adapter** (`plateau:importAdapter.ts`, #889) ingests **arbitrary** DTCG trees
  (`parseDtcg`) and Figma variable exports — so `themeTokens` is unbounded, hundreds of keys possible.
- `intentDefaults` — UX intent choices keyed by `KNOWN_INTENTS = surface/density/motion/typography/theme-color`
  (`plateau:manifest.ts:26`), option vocabulary `density: comfortable|compact|spacious`, `motion: full|reduced|none`,
  `surface: flat|raised|sunken` (`plateau:manifest.ts:29-33`).
- `traitDefaults` — a free-form presentational slot (#747 Fork-4), options `radius: sharp|soft|round`,
  `feel: flat|elevated` (`plateau:manifest.ts:36-39`).

**Consumer — the FUI workbench stage (5 fixed `--wb-*` props).** The stage block styling reads exactly
**five** custom properties (`fui:frontierui/workbench/designSystems.ts` `DesignSystemTokens`):
`--wb-accent` (accent/selection colour), `--wb-radius` (corner radius), `--wb-pad` (control padding =
density), `--wb-font` (font stack), `--wb-shadow` (surface elevation). Presets are authored **inline in
`--wb-*` shape** and applied by `applyDesignSystem(preset)` at `fui:frontierui/workbench/mount.ts:277`,
which sets the `themeTokens` map as custom properties, sets `data-intent-*`/`data-trait-*` from
`intentDefaults`/`traitDefaults` (`:289-290`), and re-renders. The preset enum values **differ from the
creator's**: FUI uses `surface: lift|solid`, `motion: natural|immediate`, `radius: lg|sm|none` — so even
the intent/trait vocabularies are mis-aligned, not just the token names.

**The gap, precisely.** It is not a 1:1 rename. The producer side is an *open* token set + intent/trait
enums that **don't match** the consumer's; the consumer is a *finite, curated* 5-slot render contract with
its own enum values. A pure pass-through is impossible (open → finite); a pure rename is impossible (enum
drift). **Some mapping/selection layer is structurally required** — the only open questions are *where* it
lives and *which vocabulary the demo block's CSS ultimately reads*.

## Prior art — how mature token systems bridge open sets onto finite render targets

The design-token ecosystem converged on a **tiered model** and an explicit **transform/filter** step at
every render boundary. This is the directly-applicable prior art (not a cross-frame-transport question —
that was #887's; this is a token-*shape* question):

| Family | What it is | Prior art | Bearing on #930 |
| --- | --- | --- | --- |
| **Tiered tokens** (primitive → semantic → component) | Open primitive/semantic tiers feed a small, curated **component-token** tier that components actually read. | Material 3 token tiers (reference→system→component); the near-universal DTCG 3-tier convention. | The 5 `--wb-*` props **are the demo's component-token tier**; DTCG `themeTokens` are its primitive/semantic tiers. A cross-tier **alias** step is the norm, not a defect. |
| **Transform + filter pipeline** | A build step transforms token values and **filters to the subset** a given output consumes; lossiness (dropping unused tokens) is expected per-platform. | Style Dictionary `transforms`/`filters` (re-use one format with a filtered token subset), SD-Transforms, Theo. | Selecting the handful of DTCG tokens the finite stage can express **is** the standard filter step — the receiver is a per-target transform. |
| **Semantic remap for theming** | Components read stable semantic/component slots; theming swaps what those slots resolve to, never the component code. | Material 3 semantic token remapping (light/dark/dynamic without touching component logic). | Keeping a stable `--wb-*` slot set and remapping its *sources* is exactly how a curated demo stays legible across swapped systems. |

**Takeaway:** every mature system places a **semantic→component mapping/transform** between an open token
source and the finite slots a render target consumes, and accepts lossiness there as routine. That is the
shape of option **A**. None of them push the component-token vocabulary *up* into the authoring tool
(that's option C — collapsing the tiered model), and none make a curated demo read the raw open set
without a selecting transform (option B still needs the filter; "consume DTCG directly" mostly *renames*
the slots, it doesn't remove the mapping).

## Per-fork classification (the 7-question pass)

- **Which layer?** The bridge maps the **#747 manifest contract** (a WE standard, already ratified by
  #871/#887) into FUI's **private `--wb-*` render props** — pure **FUI implementation**. The contract is
  fixed; only FUI's consumption of it is in question. Per *impl-is-not-a-standard* + *generator-is-a-tool-not-a-WE-standard*, the mapping table is FUI-owned, never `@webeverything`.
- **Protocol or intent dimension?** Neither — it's an internal transform, not a new protocol entry or an
  intent. The intent vocabulary (`density`/`surface`/…) is already #747's; the bridge only *reconciles
  enum values* between the two impls.
- **Expose the whole axis / fixed mechanic vs dimension?** The mapping is a **fixed mechanic** of the demo
  stage (a curated 5-slot contract), not a configurable axis. A data-driven/declared binding layer was
  considered and **rejected as YAGNI** for 5 props on a fixed demo surface.
- **DI-injectable?** No runtime registry — it's a static transform function in the receiver. (The creator
  side already has a provider seam, `CreatorProvider`; the bridge is downstream of it.)
- **Most-permissive default?** The producer stays **maximally permissive** (open DTCG + the #889 import) —
  the *receiver* absorbs the narrowing, not the author. That is option A; option C inverts it (narrows the
  author).
- **Seam between intents?** No new seam — the bridge sits inside FUI's existing receiver, consuming the
  #887 wire payload.

Classification verdict: a single FUI-internal impl decision (the bridge shape), with the contract and the
transport already settled upstream.

## The fork and the recommendation

**One genuine fork — the bridge shape — options A/B/C.** Fork-existence: the demo block's CSS reads exactly
**one** custom-property vocabulary, so it cannot canonically read both `--wb-*` (A) and DTCG-canonical
names (B) — a real either/or; and C (constrain the *producer* to `--wb-*`) is the structurally **excluded**
branch (it breaks the #889 open-DTCG/Figma import and leaks a FUI render-detail up into the Plateau
authoring tool, collapsing the tiered model the whole ecosystem keeps).

- **A (recommended) — a DTCG→`--wb-*` mapping/transform in the FUI receiver.** The receiver reads the
  *whole* resolved #747 manifest (themeTokens **+** intentDefaults **+** traitDefaults), selects/aliases
  the well-known sources into the 5 `--wb-*` slots with declared fallbacks, builds a `DesignSystemPreset`,
  and calls the existing `applyDesignSystem()`. Lossy **by design** (unmapped tokens drop — the standard
  filter step). This is the semantic→component alias layer every mature system has; keeps the producer
  maximally permissive; keeps the curated demo legible; the `--wb-*` names never cross the WE boundary so
  there is no standard lock-in. **Merit win, not a cost win:** a mapping is unavoidable regardless (open →
  finite), and the 5 curated slots are the *point* of the demo, so B's "faithfulness" is largely illusory
  (the block has finite hooks either way) for materially more work.
- **B — the stage consumes DTCG directly.** Rewire the demo block's CSS + every preset to read
  DTCG-canonical custom-property names. "Faithful," but (i) the block still only reflects the finite hooks
  it's coded for, so a selecting transform is *still* required (B mostly renames the slots), and (ii) it
  discards the curated component-token abstraction that makes "watch these 5 things change" legible.
  Materially larger (touches all presets + block styling) for illusory fidelity gain. The right move *if*
  the stage ever grows into a full production theming engine — revisit then.
- **C — constrain the creator to the `--wb-*` shape.** Excluded on merit: forces the Plateau author to
  emit FUI's private render props, **breaks the #889 DTCG/Figma import** (which ingests open token trees),
  and inverts the dependency (impl dictating the producer's vocabulary). No mature system pushes the
  component-token tier up into the authoring tool.

**Recommendation: A, confidence ~80%.** The residual ~20% is the mapping table's exact entries — chiefly
the `--wb-font`/`--wb-shadow` sources and the enum-value reconciliation. Note these are **less lossy than
#751's claim assumed**: reading intent/trait defaults gives every slot a source (`--wb-pad` ← `density`,
`--wb-shadow` ← `surface`, `--wb-radius` ← `radius` trait, `--wb-font` ← a `type.*` family token), with the
`extends` base default as the fallback when absent. That table is a build detail of A, not a separate fork.

**Red-team note for the deciding turn.** The attack on A is "lossy mapping silently drops the author's
tokens — B is the faithful path." Rebuttal grounded in the tree + survey: the stage block has a *finite*
hook count regardless, so B needs the same selecting filter (Style Dictionary's model) — its "faithfulness"
is renaming, not coverage; meanwhile A keeps the producer open and the demo legible. B is the correct
*end-state only if* the stage becomes a production theming runtime (it's a curated showcase today), so file
B as a separately-prioritized "stage matures" revisit, not the now-call.

## Net effect on the decision

The survey **reshaped the framing**: #930 is not a transport or contract call (those are #887/#871), it is
a **FUI-internal token-*shape* decision** — the classic semantic→component alias step. It hardened the
fork-existence lines (C excluded; A vs B genuine on "which vocabulary the block reads"), surfaced an enum
drift the original framing missed (so the mapping is non-trivial, confirming it's a decision not a batch
improvisation), and *reduced* the lossiness worry by noting intent/trait defaults supply the "no source"
slots. Handed to #930: **Fork 1 → A**, ~80%; B is the deferred mature-stage end-state; C is excluded.
