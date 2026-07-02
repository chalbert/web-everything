# Ant Design 5 parity gap list (#2031)

**Program:** reproduction-conformance (#1226 / #1225) — *"the difference between any two top design systems
is theme tokens + intents and nothing else."*
**Completes the goal-set:** Ant was the only target in the #1226 sequence (shadcn→Material→Ant→Carbon→Fluent)
with no child, no manifest, and no workbench preset (surfaced in the 2026-07-01 parity-loop watch). This is
its measured, rendered-and-diffed flavor + the gap list it produces — mirroring the shadcn slice (#2022).
**Artifacts:** `we:design-systems/ant.designsystem.json` + `we:design-systems/ant.tokens.json` +
`we:design-systems/ant.reference.json` (WE data); `frontierui:plugs/webtheme/__tests__/unit/antFlavor.test.ts`
(the executable, machine-checkable half of this list — it loads the flavor through the #2017 manifest loader,
asserts every claim below, AND scores it through the target-agnostic #2024 `scoreFlavor` harness).

## What the flavor is

A **full DTCG override** of the webtheme platform default capturing Ant Design 5's default seed tokens in
oklch: the daybreak-blue `colorPrimary` (#1677ff), a `6px` `borderRadius` seed with an `8px` `borderRadiusLG`
for cards, the neutral `colorBorder` (#d9d9d9), the `colorBgLayout` (#f5f5f5) muted app background, and the
alpha-on-black text roles (`colorText` rgba(0,0,0,0.88), `colorTextSecondary` 0.65) pre-composited over white.
It loads through the #2017 manifest → `ThemeSource` loader (`frontierui:plugs/webtheme/manifestLoader.ts`
`loadManifestTheme`), which resolves the override over the default and bridges it (`DTCG_TO_LEGACY`) into the
legacy family slots FUI components read via the `--<family>-<name>` alias tier (#2026/#2049).

This is **not** a token-name lookalike (the naming-fork precedent note: an alias merely *named* for Ant is not
proof of parity). Parity is asserted by resolving the override to concrete values and checking they reach the
slot a rendered button/input/card actually reads — and scored 0–1 by the same `scoreFlavor` that grades
shadcn and Material, with zero Ant-specific harness code (#2024 acceptance 2).

## Compliance score

`scoreFlavor` over `we:design-systems/ant.reference.json` (button/input/card, 15 reference roles): **8 / 15
reproduced** (overall 0.53). Per component: button 2/5, input 2/4, card 4/6. The 7 remaining are the gap set
below.

## What reproduces cleanly (theme tokens + intents suffice)

These Ant roles reach a rendered FUI button/input/card today — a bridge row lands them on a legacy slot **and**
a `LEGACY_ALIASES` row re-declares that slot so a scoped override is forwarded (DTCG paths written
`family → step` to avoid a false file-path match on a trailing step):

| Ant role | DTCG path | bridges to | component reads | reskin |
| --- | --- | --- | --- | --- |
| `colorPrimary` | color → accent | color → primary | `--color-primary` | button/link accent → daybreak blue #1677ff (the signature Ant look, vs the default) |
| `colorBorder` / `colorBorderSecondary` | surface → border | color → border | `--color-border` | card/input hairline border (#d9d9d9) |
| `colorTextTertiary` / `colorTextSecondary` | surface → muted-foreground | color → text-muted | `--color-text-muted` | secondary/placeholder text |
| `colorBgContainer` | color → surface | color → surface | `--color-surface` | card/panel surface |
| `borderRadius` | radius → md | radius → md | `--radius-md` | button corner (6px) |
| `borderRadiusLG` | radius → lg | radius → lg | `--radius-lg` | card corner (8px) |
| density / motion / surface | `intentDefaults` | — | intent applier | comfortable density, solid surface — carried through untouched |

Conclusion for these: the #1225 claim **holds** — swapping only theme tokens + intent defaults re-themes the
components, no component code change.

## The gap — roles the tokens+intents model cannot express onto a component

Each below is an Ant role for which **the model has no path to a rendered component today**, because it is
missing a bridge row, a legacy alias slot, or a platform-default token home altogether. These are the concrete
deliverable of the conformance program — what the evolving standard must grow.

### Tier A — has a token home, but the bridge/alias path is missing (cheapest to close)

1. **Focus/active outline (`controlOutline`, `controlOutlineWidth`).** The platform default ships a `ring`
   role (#1316) and the flavor overrides ring color/width/offset, but there is **no `DTCG_TO_LEGACY` row and
   no `--ring` legacy alias**, so an Ant control-outline cannot re-theme a focused control. Ant's focus
   affordance (a `rgba(5,145,255,0.1)` outline box-shadow plus a `colorPrimaryBorder` #91caff edge) is a
   headline interaction visual — this is the highest-value gap, and it is the SAME missing link the shadcn
   list flagged (`--ring`). Closing it discharges the ring gap for every flavor at once.
   *Proposed:* add ring color/width/offset bridge rows → a new `ring` legacy family (or a `color.ring` slot
   plus `dimension` ring-width/ring-offset slots) and `--ring`/`--ring-width`/`--ring-offset` aliases; wire
   the FUI `:focus-visible` outline to read them.

2. **Primary hover (`colorPrimaryHover`).** `color.primary-hover` resolves in the DTCG doc (Ant's #4096ff,
   palette step 5) and the legacy model even has a `--color-primary-hover` alias slot — but there is **no
   `DTCG_TO_LEGACY` bridge row** from `color.primary-hover` onto it, so the resolved hover value never lands.
   An Ant button's hover state therefore cannot take Ant's distinct hover blue.
   *Proposed:* add a `color → primary-hover` ⇒ `color → primary-hover` bridge row (the alias slot already
   exists; this is a one-row bridge addition).

3. **Muted surface background (`colorBgLayout`).** The `surface → muted-foreground` role bridges (→ text-muted)
   but the muted **background** `surface → muted` does not, and there is no `--color-muted` alias. Ant's
   #f5f5f5 layout/panel background (secondary buttons, subtle fills, disabled fields) cannot take Ant's muted
   surface. Same missing link as the shadcn `--muted` gap.
   *Proposed:* add a `surface → muted` ⇒ `color → muted` bridge row + a `--color-muted` alias.

4. **Input outline (`colorBorder` on the field).** `surface.input` resolves (Ant's input border = colorBorder
   in the default theme) but there is **no bridge row and no `--color-input` alias**. An input's outline tracks
   `--color-border`, not a distinct `--input` — fine for the default theme, but an Ant variant that diverges
   the field border from the generic border cannot be reproduced. Same missing link as the shadcn `--input`
   gap.
   *Proposed:* add a `surface → input` ⇒ `color → input` bridge row + a `--color-input` alias.

### Tier B — no token home at all; the standard must add a role family

Ant ships these as first-class roles; the platform default has **no token** for them, so there is nothing for
a manifest to override. These are the roles the gap list proposes the standard *add* (not just wire).

5. **Semantic status palette (`colorError`, `colorWarning`, `colorSuccess`, `colorInfo`).** Ant ships a full
   four-status semantic palette that button/alert/tag/badge read directly (a danger button, a success tag).
   The platform default has no status role at all, so a themed danger/success cannot be expressed. This is a
   larger addition than shadcn's single `--destructive` — Ant proves the status family is four roles, not one.
   *Proposed:* a **semantic status role family** (`color.error`/`warning`/`success`/`info`) with legacy
   aliases and a paired on-color foreground each — a small standard addition shared across every flavor.

6. **Container / on-color pairings (`colorPrimaryBg`, `colorErrorBg`, `colorSuccessBg`, …).** Ant pairs each
   semantic hue with a light container background (`colorPrimaryBg`, `colorPrimaryBgHover`) and a text-on-color.
   Only the base hue has any home; the container tints and the on-color foregrounds have none. Same class of
   gap as shadcn's `*-foreground` pairings, generalized to Ant's per-hue container tints.
   *Proposed:* a **paired container/foreground convention** — each themeable hue role carries a `-bg` (light
   container) and an on-color `-foreground` sibling.

7. **Elevation as a themeable role (`boxShadowTertiary` / tonal elevation).** Ant's card/dropdown elevation is
   a themeable `boxShadow*` token; the DTCG default resolves `elevation.*` onto the legacy `shadow` family but
   the reference role Ant names (`color.tonal-elevation`) has no bridged home, so an Ant-specific elevation
   cannot be authored per-flavor. (Shared with the Material `md.sys.elevation` gap — a cross-flavor signal
   that themeable elevation is an owed standard addition.)
   *Proposed:* a themeable elevation role family bridged onto the legacy `shadow` slots a card reads.

## Cross-flavor signal (what to close first)

Three of the four Tier-A gaps — **`--ring`, `--muted` background, `--input`** — are the *same* missing links
the shadcn list (#2022) already flagged. Two flavors independently hitting them is the strongest evidence for
what the standard should grow next: closing the ring + muted + input bridge/alias trio lifts the compliance
score of *every* flavor at once, not just Ant. The Tier-B status palette (#5) and on-color pairings (#6) are
the next tranche, and echo shadcn's `*-foreground` + `--destructive` gaps at larger family size.
