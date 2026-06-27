# Backlog split analysis — #1836 (unplugged-functionality epic)

**Date:** 2026-06-27 · **Target:** [#1836](/backlog/1836-make-every-plug-public-api-functional-unplugged-parity-matri/) (unsliced epic, was `size: 13`).

Slicing the epic's seven workstreams (W1–W7) into agent-ready, independently-deliverable children. Condition (1) of the split-safety rubric (size is volume, not a fork) is settled at the parent. The embedded forks are **extracted as `decision` children** so no build slice buries its own fork.

## Context that reshaped the slicing

The related prior items are all **resolved**, so they are cited (not re-parented):

- `#726` (resolved) claims it backfilled unplugged tests and flipped `PLUG_UNPLUGGED_TEST_ENFORCED` to error — yet the epic premise is that unplugged is largely non-functional, and the `#635` audit (2026-06-14) found only `webbehaviors` had dual-mode coverage. **Resolved ≠ proof**, so W1 becomes a *re-audit* (S1), not a fresh backfill.
- `#1045` (resolved) ships the **single `@frontierui/plugs` monolith** with locked scope for dedup. Per-plug packaging (W6) reverses it → genuine decision (D1).

## Could split — proposed slices

**Decisions (forks lifted out of the build slices):**

- **D1** — Per-plug npm packages vs the resolved `@frontierui/plugs` monolith (`#1045`). Granularity vs version-skew/dedup. Gates S7.
- **D2** — Ratify "default MaaS-served IR is unplugged." New MaaS-level default. Gates S4.
- **D3** — The bar to declare a capability plugged-only (vs not-yet-ported) and how the parity table marks the three states. Gates S5.

**Build slices (each `size` ≤ 3, real home, demoable):**

| # | Slice | Locus | size | blockedBy |
|---|---|---|---|---|
| S1 | Re-audit actual unplugged functional state per public plug API | FUI | 2 | — |
| S2 | Shared WeakMap element→state/methods attachment pattern + reference port | FUI | 3 | S1 |
| S3 | MaaS mode adapter: serve `plugged｜unplugged` as a serve dimension | WE | 3 | — |
| S4 | Default served IR = unplugged in `we:blocks/renderers/module-service/servePathIR.ts` | WE | 2 | D2, S3 |
| S5 | Published doc-site plugged/unplugged parity table (auto-rendered + drift gate) | WE | 3 | S1, D3 |
| S6 | Workbench plugged/unplugged toggle (block-explorer `#746`) | FUI | 3 | S2 |
| S7 | Per-plug npm packages | FUI | 3 | D1 |

**DAG:** roots S1, S3, D1, D2, D3 (5 start immediately); S2←S1; S4←{D2,S3}; S5←{S1,D3}; S6←S2; S7←D1. Acyclic; each slice leaves a valid demoable state.

## Could not split / deliberately deferred

- **Per-plug *fix* cards** are not scaffolded now: which plugs are actually broken unplugged is unknown until S1 runs. S1 is discovery and **spawns** one fix card per real gap (the standard plan→discrete-homes pattern). Scaffolding them blind would bury guesses as work.
- No slice failed a rubric condition; nothing is left un-carvable.

---

# Backlog split analysis — #1813 (JS-first token migration, WE locus)

**Target:** [#1813](/backlog/1813-js-first-token-runtime-slice-3-migrate-we-src-css-style-css-/) — the WE-locus token-migration slice of epic #1683. `kind: story`, `size: 8`. The item's own body re-sized it `3 → 8` and *invited* the slice ("consider `/slice 1813` into the three below if batching"), listing three pieces. This focused run did the work-investigation pass against the real tree (WE + FUI) and applied the split-safety rubric.

## Could split

*(none)*

## Could not split

| #NNN | Title | Failing condition | Unblocking action |
|------|-------|-------------------|-------------------|
| #1813 | JS-first token runtime — slice 3: migrate `we:src/css/style.css` `:root` vars onto the emitted set | **(4) no clean DAG with real independence** (rigid linear chain, no valuable incremental delivery), compounded by **(1) a within-slice build-time residual** and **(5) no-op / broken intermediate states** | None needed now — it is `size: 8` (the batchable **ceiling**, not the `>8` should-split band), so it is already batch-eligible as **one coherent migration pass**. *If* a split is ever wanted, first resolve the FUI-side transport shape (below) as a small spike — that resolution is what would expose whether P1/P2 are separable seams. |

### Why the three body-listed pieces don't slice

The body proposes: **P1** engine-agnostic transport · **P2** WE-site project theme (`ThemeSource.with()` over the FUI default) · **P3** alias bridge (`--color-*: var(--token-*)` + drop the hand-authored `:root`).

**The emit/resolve primitives all live in FUI and WE can't build-import them.** `ThemeSource.with()`, `emitTokenCss()`, and `defaultTheme` are all in `fui:plugs/webtheme/` (`fui:plugs/webtheme/ThemeSource.ts:73`, `fui:plugs/webtheme/emitCss.ts:57`, `fui:plugs/webtheme/defaultTheme.ts:16`). WE cannot `import '@frontierui'` at build (`we:src/_layouts/base.njk:434`, #700), and FUI carries no `@webeverything` dep ([we-data-crosses-via-fui-served-route](../docs/agent/platform-decisions.md#we-data-crosses-via-fui-served-route), #1731). So both **P2's `.with()` resolution** and **P1's emit** must run **FUI-side**; only the resolved `:root{}` string crosses. This is the *reverse* of the #1731 pattern (WE-owns-generator → FUI-consumes), and here the emit must additionally fold in **WE-authored override values**.

1. **Rubric (1) — a build-time residual sits inside P1.** #1824 ratified the two *top-level* forks (transport direction; values home) but explicitly left the concrete transport shape *"specifiable now, ruled at the build"*: how WE's override values reach the FUI-side resolution without either repo importing the other (a new FUI served route emitting the resolved theme? the override passed as route input? the override homed in WE `_data` vs a TS module). That residual lives **inside P1** and determines whether P1 and P2 are even separate artifacts — so a boundary drawn between them is a guess, not a clean seam.
2. **Rubric (4) — the only decomposition is a rigid linear chain with no incremental value.** The valid ordering is **P2 → P1 → P3** (define override → emit it across the boundary → alias the 629 legacy `var(--color-*)` sites and drop the hand-authored `:root`). Every edge is `blockedBy` the prior; **≥2 cannot proceed independently**. And it unlocks **no** incremental delivery: until P3 lands, `var(--token*)` = 0 in `we:src/` (verified at #1824 ratification), so the emit is dead weight nothing reads — nothing visible ships before the final piece.
3. **Rubric (5) — the intermediate states are no-op or broken.** P2-alone = an unread module. P1-alone emitting the FUI **dark** default (`fui:plugs/webtheme/defaultTheme.ts:16-53`) would invert the light site; emitting an unread set is inert dead weight. Removing the `we:src/css/style.css` `:root` block before P3 leaves the site unstyled. Only the all-together end-state satisfies the item's own "renders identically / no visual diff" + "renaming a token at source updates the site's var" acceptance.

**Verdict: keep #1813 whole.** The conservative instinct's textbook case — slicing fragments one coherent migration into co-dependent shards that only make sense together (review overhead, no gain), not into independently-deliverable slices. It sits at the `size: 8` batchable ceiling and can be worked in a single pass; the builder resolves the transport-shape residual in flight (per #1824's "ruled at the build").

### `unsplittableReason` does **not** apply

That atomic-pill flag sits **only on an open *oversized* story** (`size` > 8); `check:standards` errors otherwise. #1813 is `size: 8`, carries no deterministic split badge, and is not in the `splittable` set — there is no flag to clear. Verdict recorded here and (on approval) as a one-line body note on the item; no frontmatter mutation warranted.

---

# Sub-split — #1844 (parity-table, S5 grown to size 13)

**Date:** 2026-06-27 · **Mode:** `/split 1844` (focused) · **Target:** [#1844](/backlog/1844-publish-a-doc-site-plugged-vs-unplugged-parity-table/) `kind: story · size: 13 · parent: 1836`.

S5 of the epic above was scoped `size: 3`, but the resolution of decision [#1839](/backlog/1839-decide-the-plugged-only-residue-bar-and-how-the-parity-table/) reshaped it: the parity verdict is a *measured FUI-runtime fact* stored **FUI-side**, surfaced to the doc-site over the cross-origin data path, with WE exposing **at most a type-only schema** (#1282 zero-impl). That makes #1844 a 5-part cross-locus pipeline (FUI×3, WE×2), none of which exists yet — hence the size-13 re-split.

## Verdict: **COULD SPLIT** (5 slices, all rubric conditions hold)

Volume, not an unresolved decision: the gating fork #1839 is **resolved** (bar + 3-state vocab + FUI locus), and the data source [#1840](/backlog/1840-re-audit-the-actual-unplugged-functional-state-of-every-publ/) re-audit (`we:reports/2026-06-27-unplugged-functional-re-audit.md`, 16 verdict rows) is **resolved**.

### Edge case — #1844 already has a `parent` (#1836)

Not converted to a nested epic. #1844 stays a re-sized `story` for its **core slice (the WE doc-site page)**; the other four slices scaffold as **siblings under #1836** (`--parent=1836`).

### Proposed slices (all verified `file:line` against the real tree)

| Slice | Locus | workItem / size | Home (verified) | blockedBy |
|---|---|---|---|---|
| **S5a** seed per-plug parity manifest with the 16 re-audited verdicts (3-state vocab) | FUI | story / 3 | `fui:plugs/` per-domain dirs exist, no manifest yet ← `we:reports/2026-06-27-unplugged-functional-re-audit.md:27-45` | — |
| **S5b** type-only parity-entry schema (only WE-resident artifact #1839 permits) | WE | task / 1 | WE `*.contract.ts` (#1839/#1282; cf. `we:src/_data/plugs/customattribute.json` shape) | — |
| **S5c** serve parity data over the cross-origin MaaS data route | FUI | story / 2 | `fui:tools/maas/vite-plugin.mjs:80-88` (mirror `/_maas/data/<tag>.json`) | S5a |
| **S5d** drift gate — manifest tracks the FUI runtime (target FUI tree, **not** a WE plugs dir) | FUI | story / 3 | new FUI gate; **Gap A**: `we:scripts/check-standards.mjs:977-979` `existsSync(join(ROOT,'plugs'))` no-ops in WE. Mirror #1309. | S5a |
| **#1844** plugs-parity doc-site page — fetch FUI-served data at runtime, render the 3-state table | WE | story / 3 | `we:src/plugs.njk` exists (catalog); add parity table page (catalog-auto-render over cross-origin runtime data) | S5c |

### DAG

```
S5a (FUI manifest) ──┬──► S5c (FUI serve) ──► #1844 (WE doc page)
                     └──► S5d (FUI drift gate)
S5b (WE type schema)  [foundational, parallel; consumed by S5a & #1844]
```

Acyclic. S5a + S5b foundational (parallel). S5c/S5d fan out from S5a. #1844 at the tail. Incremental: S5a inspectable/testable manifest · S5c curl-able `/_maas/data/<parity>.json` · S5d gate runs green/red · S5b type compiles · #1844 page renders the live table.

### Rubric check (all five hold)

1. **Volume not decision** ✓ — #1839 resolved; still-untested verdict *values* are updated over time by in-flight fix slices (#1856–#1860) against a live manifest — incremental delivery, not a blocking fork.
2. **≥2 nameable slices, real homes** ✓ — 5, every home cited.
3. **Each ≤3 / task** ✓ — 3/1/2/3/3.
4. **Clean DAG, real independence / incremental** ✓ — see DAG.
5. **Every slice demoable** ✓ — see above.

## Could not split

None — the whole item splits.

## Net effect on approval

`#1844` story·13 → re-sized story·3 (the doc page, stays under #1836) **+ 4 new sibling slices under #1836** (S5a, S5b, S5c, S5d). Net **+4** cards. Batchable: S5a & S5b immediately; S5c/S5d once S5a lands; #1844 once S5c lands. Chain with `/batch`.

---

# Backlog split analysis — #1831 (custom-states plug runtime, FUI)

**Date:** 2026-06-27 · **Mode:** `/split 1831` (focused) · **Target:** [#1831](/backlog/1831-implement-the-custom-states-plug-in-fui-plugged-validation-p/) `kind: story · size: 13 · blockedBy: [1830]`. #1830 (contract mint), #1807 (DC-14 ruling) both **resolved** → #1831 unblocked. Its body carries a pre-flight proposing an A/B/C slicing; this run verifies it against the real FUI tree rather than trusting the framing.

## Work-investigation pass (what the code actually shows)

- **Lowering site** — `fui:blocks/renderers/component/declarativeComponent.ts`: `default-aria-*` parses at L101 → `ComponentDef.defaultAria` (L43); `generateClassSource` emits it at L155 (`hasInternals`) + L176-177. `states=` is a clean mirror of this surface.
- **Twin-lag is real** — L217 `const wantsInternals = formAssociated || !!defaultRole;` — the runtime twin `defineFromDefinition` drops `defaultAria` **and** would drop `states`. Self-contained fix.
- **Plug pattern exists** — `fui:plugs/` has the established plugged/unplugged seam: per-plug dir + `*Unplugged.ts` passthrough (`fui:plugs/validationUnplugged.ts`, `fui:plugs/guardsUnplugged.ts`) + bootstrap block + injector-scoped registries. `declareStates` would mirror this — the *pattern* is not greenfield.
- **`fui:plugs/webstates/` already exists but is unrelated** — it holds CustomStore / CustomChangeStrategy / CustomStorageStrategy (#1089: change-tracking + durable storage), **not** the CustomStateSet / `:state()` custom-states layer. The custom-states runtime itself is greenfield (don't reuse that dir's framing).
- **Slice (C) of the body is redundant** — [#1794](/backlog/1794-adopt-customstateset-for-native-state-alignment-in-stateful-/) *Adopt CustomStateSet…* already exists as a separate `story` (`size 3`, `blockedBy: [1831]`). Nothing to scaffold for C; it only needs repointing.

## Could split — proposed slices

Original #1831 → **storied epic** (drop `size`, umbrella digest). Two real slices (not three):

| Slice | workItem / size | Scope | DAG | Batchable now? |
|---|---|---|---|---|
| **A** — `states=` lowering + twin-lag fix + unplugged floor | `story` / **3** | `states="…"` parse + `ComponentDef.states` mirroring `defaultAria` (`fui:blocks/renderers/component/declarativeComponent.ts` L101); emit in `generateClassSource` (L155/L176-177); twin-lag fix at L217 (also repairs the `defaultAria` drop); unplugged setter/getter floor over native `CustomStateSet` (no enforcement). | `parent=1831`; no blocker (contract #1830 resolved) | **Yes** — pure mirror of `default-aria`, demoable as an open-set `:state()` component |
| **B** — plugged validation + polyfill + `declareStates` plug-hook | `story` / **5** | Plugged validating `CustomStateSet` wrapper rejecting/warning un-declared toggles; polyfill of the nowhere-native declaration+validation layer; `declareStates(internals, vocab)` resolved from plug context, mirroring the `fui:plugs/validationUnplugged.ts` + bootstrap-block + injector-registry pattern. | `parent=1831`; `blockedBy=A` | **No — needs `/prepare` first** (see below) |

**Repoint (not a new slice):** #1794 `blockedBy: [1831]` → **`blockedBy: [A]`** (adoption consumes the unplugged floor from A, not B's enforcement).

**Resulting DAG:** `A → B`; `A → #1794`. A is the only immediately-batchable leaf.

## Could not split (further) — what's gated and why

| Item | Rubric condition that fails | Unblocking action |
|---|---|---|
| **Slice B** (plugged validation + polyfill) | **(1) size is volume, not an unresolved decision** — the runtime architecture of the polyfilled declaration+validation layer (validating-wrapper vs proxy of native `CustomStateSet`; reject-vs-warn semantics; how `declareStates` resolves from plug context) is design work, not just LOC. The contract (#1830) states the *what*; the *how* is unspecified, and the body itself flagged "needs its own design pass." | Run **`/prepare`** on B once carved: survey the `validationUnplugged`/injector pattern as prior art, state the wrapper-architecture options + bold default, set `preparedDate`. **If prep surfaces a genuine binary fork**, file it as a `type:decision` card and make B `blockedBy` it. B is carved now (so the epic is honest about remaining scope) but parked from batching until prepared. |

No `type:decision` card is filed pre-emptively: no nameable binary fork is yet visible (the plug pattern already exists to mirror), so this is a **prep** gap, not a buried decision. The card is filed *if and when* `/prepare` surfaces a real fork — recorded here so it isn't lost.

## Net effect if approved

- #1831 `story·13` → **storied epic** (no size).
- **+2 slices**: A (`story·3`, batchable) + B (`story·5`, blocked by A, needs `/prepare`).
- **#1794 repointed** `blockedBy [1831]` → `[A's NNN]`.
- Net flow: **+2**, original → epic. A is immediately `/batch`-able.
