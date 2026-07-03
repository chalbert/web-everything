# Fluent 2 parity gap list (#2140)

**Program:** reproduction-conformance (#1226 / #1225) — *"the difference between any two top design systems
is theme tokens + intents and nothing else."*
**Completes the goal-set:** Fluent 2 is the final named target in the #1226 sequence
(shadcn→Material→Ant→Carbon→Fluent). This is its measured, rendered-and-diffed flavor + the gap list it
produces — mirroring the shadcn slice (#2022) and Ant slice (#2031).
**Artifacts:** `we:design-systems/fluent.designsystem.json` + `we:design-systems/fluent.tokens.json` +
`we:design-systems/fluent.reference.json` (WE data); `frontierui:plugs/webtheme/__tests__/unit/fluentFlavor.test.ts`
(the executable, machine-checkable half of this list — it loads the flavor through the #2017 manifest loader,
asserts every claim below, AND scores it through the target-agnostic #2024 `scoreFlavor` harness); supersedes
the `fluent-like` stub in `fui:workbench/designSystems.ts`.

## What the flavor is

A **full DTCG override** of the webtheme platform default capturing Fluent 2's default light-mode global
tokens in oklch: the cornflower-blue `colorBrandBackground` (#0f6cbd), a named 4px/6px/8px radius scale
(`borderRadiusSmall`/`Medium`/`Large`), neutral `colorNeutralStroke1` (#d1d1d1) for borders/inputs,
`colorNeutralBackground3` (#f5f5f5) for muted panels, and `colorNeutralForeground3` (#707070) for
secondary/muted text. It loads through the #2017 manifest → `ThemeSource` loader
(`frontierui:plugs/webtheme/manifestLoader.ts` `loadManifestTheme`), which resolves the override over the
default and bridges it (`DTCG_TO_LEGACY`) into the legacy family slots FUI components read via the
`--<family>-<name>` alias tier (#2026/#2049).

This is **not** a token-name lookalike (the naming-fork precedent note: an alias merely *named* for Fluent
is not proof of parity). Parity is asserted by resolving the override to concrete values and checking they
reach the slot a rendered button/input/card actually reads — and scored 0–1 by the same `scoreFlavor` that
grades shadcn, Material, and Ant, with zero Fluent-specific harness code (#2024 acceptance 2).

The `fluent-like` stub in `fui:workbench/designSystems.ts` is superseded by this flavor: it shared the same
`#0f6cbd` accent and 4px radius (correctly) but was FUI-resident inline token data, not a WE-catalog DTCG
override loaded through the #2017 manifest path.

## Compliance score

`scoreFlavor` over `we:design-systems/fluent.reference.json` (button/input/card, 17 reference roles): **8 /
17 reproduced** (overall 0.47). Per component: button 1/6, input 3/5, card 4/6. The 9 remaining are the gap
set below.

## What reproduces cleanly (theme tokens + intents suffice)

These Fluent 2 roles reach a rendered FUI button/input/card today — a bridge row lands them on a legacy slot
**and** a `LEGACY_ALIASES` row re-declares that slot so a scoped override is forwarded (DTCG paths written
`family → step` to avoid a false file-path match on a trailing step):

| Fluent 2 role | DTCG path | bridges to | component reads | reskin |
| --- | --- | --- | --- | --- |
| `colorBrandBackground` | color → accent | color → primary | `--color-primary` | button/link accent → cornflower blue #0f6cbd (the signature Fluent look, vs the default) |
| `colorNeutralStroke1` (border) | surface → border | color → border | `--color-border` | card/input border (#d1d1d1) |
| `colorNeutralForeground3` (muted-fg) | surface → muted-foreground | color → text-muted | `--color-text-muted` | secondary/muted/placeholder text (#707070) |
| `borderRadiusMedium` | radius → md | radius → md | `--radius-md` | input corner (6px) |
| `borderRadiusLarge` | radius → lg | radius → lg | `--radius-lg` | card corner (8px) |
| `colorNeutralBackground1` | color → surface | color → surface | `--color-surface` | card/panel surface |
| density / motion / surface | `intentDefaults` | — | intent applier | comfortable density, solid surface — carried through untouched |

Note: `borderRadiusSmall` (4px — Fluent's primary button radius) maps onto `radius → sm`, which bridges to
`radius → sm` and reaches `--radius-sm` when authored; however most components default to `radius → md`, so
the button radius gap is partial (the value reaches the slot but a component must explicitly read `--radius-sm`).

Conclusion for these: the #1225 claim **holds** for Fluent's palette, border, muted text, and radius roles —
swapping only theme tokens + intent defaults re-themes the components, no component code change.

## The gap — roles the tokens+intents model cannot express onto a component

Each below is a Fluent 2 role for which **the model has no path to a rendered component today**, because it
is missing a bridge row, a legacy alias slot, or a platform-default token home altogether.

### Tier A — has a token home, but the bridge/alias path is missing (cheapest to close)

1. **Focus ring (`colorStrokeFocus2`, `colorStrokeFocus1`).** Fluent 2 draws a 2px outer focus ring
   (`colorStrokeFocus2` = #000000) with a 1px inner offset (`colorStrokeFocus1` = #ffffff). The platform
   default ships a `ring` role (#1316) and the flavor overrides ring color/width/offset, but there is **no
   `DTCG_TO_LEGACY` row and no `--ring` legacy alias**, so Fluent's focus ring cannot re-theme a focused
   control. This is the **same missing link** the shadcn (#2022) and Ant (#2031) lists both flagged —
   a cross-flavor signal that closing it once lifts every flavor's score simultaneously.
   *Proposed:* add ring color/width/offset bridge rows → a new `ring` legacy family and `--ring`/`--ring-width`/
   `--ring-offset` aliases; wire the FUI `:focus-visible` outline to read them.

2. **Muted surface background (`colorNeutralBackground3`).** The `surface → muted-foreground` role bridges
   (→ text-muted), but the muted **background** `surface → muted` does not, and there is no `--color-muted`
   alias. Fluent's #f5f5f5 subtle/secondary surface (disabled fields, muted panels, ghost button hover)
   cannot reach a component. Same missing link as shadcn `--muted` and Ant `colorBgLayout`. Three flavors
   independently hitting this is the strongest cross-flavor signal for a muted-background bridge/alias.
   *Proposed:* add a `surface → muted` ⇒ `color → muted` bridge row + a `--color-muted` alias.

3. **Input outline (`colorNeutralStroke1` on the field).** `surface → input` resolves in the DTCG doc
   (Fluent shares `colorNeutralStroke1` for both border and input in the default theme) but there is **no
   bridge row and no `--color-input` alias**. A Fluent variant that diverges the field border from the card
   border cannot be reproduced. Same missing link as shadcn `--input` and Ant `colorBorder (input)`.
   *Proposed:* add a `surface → input` ⇒ `color → input` bridge row + a `--color-input` alias.

4. **Accent hover (`colorBrandBackgroundHovered`).** `color → accent-hover` resolves in the DTCG doc
   (Fluent's #115ea3, one step darker on the brand ramp) but there is **no `DTCG_TO_LEGACY` bridge row**
   from `color → accent-hover` onto a legacy slot. Fluent's distinct hover state for the primary button
   cannot reach the component. Same class of gap as Ant's `colorPrimaryHover`.
   *Proposed:* add a `color → accent-hover` ⇒ `color → primary-hover` bridge row (mirrors the Ant proposal).

### Tier B — no token home at all; the standard must add a role family

Fluent 2 ships these as first-class roles; the platform default has **no token** for them, so there is
nothing for a manifest to override. These are the roles the gap list proposes the standard *add*.

5. **On-brand foreground (`colorNeutralForegroundOnBrand`).** Fluent's primary button shows white text on the
   cornflower-blue surface. The platform default has no explicit on-primary foreground role — it assumes
   implicit contrast. A theme that wants a specific brand-foreground (e.g. an off-white or black on a very
   light brand color) cannot set it today. Same class of gap as shadcn's `--primary-foreground`.
   *Proposed:* a **paired-role convention** — each themeable surface role carries an explicit on-color
   `-foreground` sibling (`color → brand-foreground`).

6. **Subtle / ghost hover surface (`colorNeutralBackground1Hover`).** Fluent's ghost/subtle button variant
   uses `colorNeutralBackground1Hover` (#f5f5f5) as a hover fill. The platform default has no explicit hover
   surface role — muted and hover are different semantics that share the same DTCG value in the default, but
   diverge in non-default themes. There is no `--color-hover-bg` alias or token role.
   *Proposed:* a `color → hover-surface` role (the Fluent `colorNeutralBackground1Hover` home).

7. **Compound / pressed states (`colorBrandBackgroundPressed`, `colorNeutralBackground1Pressed`).** Fluent 2
   ships explicit pressed-state tokens for both brand and neutral surfaces. No pressed-state role exists in
   the platform default at all.
   *Proposed:* `color → pressed` / `color → brand-pressed` role family (same pattern as hover but for press).

8. **Elevation as a themeable role (`shadow4`, `shadow16`).** Fluent 2's card uses `boxShadow: shadow4`
   (0 2px 4px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.12)); dialog uses shadow16. The DTCG default resolves
   `elevation → *` onto the legacy `shadow` family but the specific Fluent depth values have no bridged home.
   Same class of gap as Material `md.sys.elevation` and Ant `boxShadowTertiary`.
   *Proposed:* a themeable elevation role family bridged onto the legacy `shadow` slots a card reads.

9. **Variant/anatomy roles (size, appearance, shape props).** Fluent 2's components ship `size` (small/
   medium/large), `appearance` (primary/outline/subtle/transparent), and `shape` (rounded/circular/square)
   axes. These are *component-shape* choices, not theme tokens — they belong to the intent/trait vocabulary.
   This is the boundary of the #1225 claim: it holds for *look* (color/radius/spacing/shadow), and the
   residual is **variant/anatomy**, which is intent+trait territory, not tokens.

## Cross-flavor signal (what to close first)

Four gaps recur across **three or more** flavors (shadcn + Ant + Fluent): the **focus ring**, the **muted
background surface**, the **input outline**, and the **accent hover state**. This triple-repetition is the
strongest evidence for what the standard should grow next: closing the ring + muted-background + input
bridge/alias triple lifts every flavor's score at once. On-color foreground pairings (gap 5) and themeable
elevation (gap 8) are the next tranche, echoing the shadcn and Ant proposals.

## Net verdict for the program (#1226 / #1225)

The claim **"tokens + intents, nothing else"** reproduces Fluent 2's *palette, border, muted text, and
radius* cleanly (8 of 17 reference roles). It does **not yet** reproduce: the focus ring, the
muted-background and input-outline surfaces, and the hover state (Tier A — wiring gaps, cheap to close); and
Fluent's on-brand foreground, hover/pressed surfaces, and elevation roles (Tier B — real standard additions).
The residual beyond tokens is **component variant/anatomy** (size/appearance/shape), which is intent+trait
vocabulary. Closing Tier A + B (9 items) is the concrete next increment the conformance program should file
against #1226. The entire Tier A trio (ring + muted + input) is shared with shadcn and Ant — filing a single
cross-flavor child against #1226 is the highest-leverage next step.
