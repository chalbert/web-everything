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
