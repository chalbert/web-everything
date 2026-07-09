# Material 3 parity gap list (#2023)

**Program:** reproduction-conformance (#1226 / #1225) — *"the difference between any two top design systems
is theme tokens + intents and nothing else."*
**Target:** Material 3 is the second named target in the #1226 sequence
(shadcn→Material→Ant→Carbon→Fluent). This is its measured, rendered-and-diffed **full** flavor + the gap
list it produces — mirroring the shadcn slice (#2022) and Fluent slice (#2140).
**Supersedes the seed:** the earlier `material-like` artifacts (a ~5-token workbench preset in
`fui:workbench/designSystems.ts` + a 2-color/1-radius stub in `we:design-systems/material-like.tokens.json`,
scored on a 2-role reference) were **not** a Material flavor. This item authors the full M3 baseline role set
and repoints the parity scorer (`we:scripts/parity-conformance.mjs`) + the workbench preset onto it.
**Artifacts:** `we:design-systems/material.designsystem.json` + `we:design-systems/material.tokens.json` +
`we:design-systems/material.reference.json` (WE data);
`frontierui:plugs/webtheme/__tests__/unit/materialFlavor.test.ts` (the executable, machine-checkable half of
this list — it loads the flavor through the #2017 manifest loader, asserts every claim below, AND scores it
through the target-agnostic #2024 `scoreFlavor` harness).

## What the flavor is

A **full DTCG override** of the webtheme platform default capturing Material 3's baseline light-scheme
system roles in oklch: the `md.sys.color.primary` #6750A4 (the signature M3 purple, seeded from the baseline
key color), the M3 shape scale (`md.sys.shape.corner.*` — extra-small 4px / small 8px / medium 12px / large
16px / full pill), the neutral roles (`md.sys.color.outline` #79747E for borders/text-field outlines,
`md.sys.color.surface-variant` #E7E0EC for muted/filled containers, `md.sys.color.on-surface-variant`
#49454F for supporting text and labels), and the `md.sys.color.surface` #FFFBFE canvas. It loads through the
#2017 manifest → `ThemeSource` loader (`frontierui:plugs/webtheme/manifestLoader.ts` `loadManifestTheme`),
which resolves the override over the default and bridges it (`DTCG_TO_LEGACY`) into the legacy family slots
FUI components read via the `--<family>-<name>` alias tier (#2026/#2049).

This is **not** a token-name lookalike (the naming-fork precedent note: an alias merely *named* for Material
is not proof of parity). Parity is asserted by resolving the override to concrete values and checking they
reach the slot a rendered button/input/card actually reads — and scored 0–1 by the same `scoreFlavor` that
grades shadcn, Ant, Carbon, and Fluent, with zero Material-specific harness code (#2024 acceptance 2).

## Compliance score

`scoreFlavor` over `we:design-systems/material.reference.json` (button/input/card, 17 reference roles): **8 /
17 reproduced** (overall 0.47). Per component: button 1/6, input 3/5, card 4/6. The 9 remaining are the gap
set below.

## What reproduces cleanly (theme tokens + intents suffice)

These Material 3 roles reach a rendered FUI button/input/card today — a bridge row lands them on a legacy
slot **and** a `LEGACY_ALIASES` row re-declares that slot so a scoped override is forwarded (DTCG paths
written `family → step` to avoid a false file-path match on a trailing step):

| Material 3 role | DTCG path | bridges to | component reads | reskin |
| --- | --- | --- | --- | --- |
| `md.sys.color.primary` | color → accent | color → primary | `--color-primary` | button/link accent → the #6750A4 baseline purple (the signature M3 look, vs a blue/near-black default) |
| `md.sys.color.outline` | surface → border | color → border | `--color-border` | card/input border (#79747E) |
| `md.sys.color.on-surface-variant` | surface → muted-foreground | color → text-muted | `--color-text-muted` | supporting/label/muted text (#49454F) |
| `md.sys.shape.corner.medium` | radius → md | radius → md | `--radius-md` | text-field / medium container corner (12px) |
| `md.sys.shape.corner.large` | radius → lg | radius → lg | `--radius-lg` | card corner (16px) |
| `md.sys.color.surface` | color → surface | color → surface | `--color-surface` | card/panel surface (#FFFBFE) |
| density / motion / surface | `intentDefaults` | — | intent applier | comfortable density, lift surface — carried through untouched |

Conclusion for these: the #1225 claim **holds** for M3's palette, border, supporting text, surface, and the
medium/large shape steps — swapping only theme tokens + intent defaults re-themes the components, no
component code change.

## The gap — roles the tokens+intents model cannot express onto a component

Each below is a Material 3 role for which **the model has no path to a rendered component today**, because it
is missing a bridge row, a legacy alias slot, or a platform-default token home altogether. Material's two
signatures — **state layers** and **tonal elevation** — fall in the deepest tier: they are not wiring gaps
but whole *models* M3 has that the token+intent vocabulary lacks.

### Tier A — has a token home, but the bridge/alias path is missing (cheapest to close)

1. **Focus indicator (`md.sys` focus → `ring`).** M3 draws a focus indicator as a 3px band in
   `md.sys.color.primary` around the focused control. The platform default ships a `ring` role (#1316) and
   the flavor overrides ring color/width/offset, but there is **no `DTCG_TO_LEGACY` row and no `--ring`
   legacy alias**, so an M3 focus indicator cannot re-theme a focused control. This is the **same missing
   link** the shadcn (#2022), Ant (#2031), and Fluent (#2140) lists all flagged — a four-flavor signal that
   closing it once lifts every flavor's score simultaneously.
   *Proposed:* add ring color/width/offset bridge rows → a new `ring` legacy family and
   `--ring`/`--ring-width`/`--ring-offset` aliases; wire the FUI `:focus-visible` outline to read them.

2. **Muted surface background (`md.sys.color.surface-variant`).** The `surface → muted-foreground` role
   bridges (→ text-muted), but the muted **background** `surface → muted` does not, and there is no
   `--color-muted` alias. M3's #E7E0EC filled/tonal container surface (filled text fields, muted panels)
   cannot reach a component. Same missing link as shadcn `--muted` and Fluent `colorNeutralBackground3`.
   *Proposed:* add a `surface → muted` ⇒ `color → muted` bridge row + a `--color-muted` alias.

3. **Text-field outline (`md.comp.outlined-text-field`).** `surface → input` resolves in the DTCG doc (M3
   shares `md.sys.color.outline` for both the card border and the field outline in the baseline scheme) but
   there is **no bridge row and no `--color-input` alias**. An M3 variant that diverges the field outline
   from the card border cannot be reproduced. Same missing link as shadcn `--input` and Fluent's input outline.
   *Proposed:* add a `surface → input` ⇒ `color → input` bridge row + a `--color-input` alias.

### Tier B — no token home at all; the standard must add a role family

Material 3 ships these as first-class parts of its system; the platform default has **no token** for them,
so there is nothing for a manifest to override. These are the roles the gap list proposes the standard *add*.

4. **On-color foreground (`md.sys.color.on-primary`).** M3's filled button shows white
   (`md.sys.color.on-primary`) text on the purple primary. The platform default has no explicit on-primary
   foreground role — it assumes implicit contrast. A theme that wants a specific on-primary (e.g. black on a
   very light brand color) cannot set it today. Same class of gap as shadcn's `--primary-foreground` and
   Fluent's `colorNeutralForegroundOnBrand`.
   *Proposed:* a **paired-role convention** — each themeable surface role carries an explicit on-color
   `-foreground` sibling (`color → on-primary`, `color → on-surface`, …).

5. **State layers (`md.sys.state.hover/focus/pressed`) — an M3 SIGNATURE.** M3's core interaction model
   overlays a translucent *state layer* (the role color at 8% hover / 10% focus / 10% pressed opacity) on
   every interactive surface. This is not a single color token — it is a **role + opacity + compositing**
   convention with no analog in the token+intent model at all. There is no DTCG path that resolves to a
   state layer, so it can never bridge onto a component. This is the deepest M3-vs-tokens residual: the
   difference between M3 and the model here is a *mechanism*, not a value.
   *Proposed:* a **state-layer intent** (an interaction/state axis in the intent vocabulary) that composites
   `color-mix(in oklab, var(--role) <pct>%, transparent)` at `:hover`/`:focus-visible`/`:active` — a new
   standard capability, not a token. This is the single highest-leverage M3 addition and likely a candidate
   fork for #1226.

6. **Tonal elevation (`md.sys.elevation.level1..5`) — an M3 SIGNATURE.** M3 expresses elevation NOT primarily
   as a box-shadow but as a **surface-tint overlay**: a higher surface tints toward the primary via a
   `md.sys.color.surface-tint` overlay whose opacity increases with the elevation level (0–5). The DTCG
   default resolves `elevation → *` onto the legacy `shadow` family (a drop-shadow model); M3's tonal-tint
   elevation has no home in that family. Same class of gap as Fluent `shadow4/16` — but M3's is worse,
   because even the *model* (tint vs shadow) differs.
   *Proposed:* a themeable elevation role family that carries both a shadow ramp AND a tonal-tint token +
   opacity ramp, selected by a `surface`-intent elevation mode (shadow vs tint).

7. **Full/pill button radius resolves to the platform default (a scoring nuance, not a wiring gap).** M3's
   button uses `md.sys.shape.corner.full` (a 9999px pill). This DTCG path both bridges AND is aliased, so it
   is *reachable* — but the platform default's own `radius.full` is already 9999px, so the scorer records it
   as `resolves-to-default` (a no-op override), not a proven reskin. The pill IS what M3 draws; it simply
   coincides with the default's full radius, so no override is *measurable*. Not a standard gap — noted so
   the button's 1/6 score is not mistaken for a missing capability.

8. **Variant/anatomy roles (button appearance, FAB/chip anatomy).** M3's components ship an `appearance` axis
   (elevated / filled / filled-tonal / outlined / text button) and distinct anatomies (FAB, chip, segmented
   button). These are *component-shape* choices, not theme tokens — they belong to the intent/trait
   vocabulary. This is the boundary of the #1225 claim: it holds for *look* (color/radius/spacing/shadow),
   and the residual is **variant/anatomy**, which is intent+trait territory, not tokens.

## Cross-flavor signal (what to close first)

Three Tier-A gaps recur across **four** flavors now (shadcn + Ant + Fluent + Material): the **focus
indicator/ring**, the **muted background surface**, and the **input/field outline**. Four independent
flavors hitting the same three wiring gaps is the strongest possible evidence for what the standard should
grow next: closing the ring + muted-background + input bridge/alias triple lifts every flavor's score at
once. **Material adds two gaps no prior flavor did: STATE LAYERS and TONAL ELEVATION** — both whole
mechanisms (opacity-composited overlays, tint-based elevation) absent from the token+intent model. These are
the concrete, M3-specific increments the reproduction-conformance program should file against #1226, and the
strongest argument that the residual beyond "tokens + intents" includes at least one new *capability*
(state-layer compositing), not just more tokens.

## Net verdict for the program (#1226 / #1225)

The claim **"tokens + intents, nothing else"** reproduces Material 3's *palette, border, supporting text,
surface, and medium/large shape* cleanly (8 of 17 reference roles). It does **not yet** reproduce: the focus
indicator, the muted-background and text-field-outline surfaces (Tier A — wiring gaps shared with three other
flavors, cheap to close); M3's on-color foregrounds (Tier B — a paired-role convention); and — uniquely —
M3's **state layers** and **tonal elevation**, which are not values but *mechanisms* the token+intent model
lacks entirely. The residual beyond tokens is **component variant/anatomy** (appearance axis, FAB/chip) plus,
for Material specifically, the **state-layer compositing capability**. Closing Tier A (shared) first, then
proposing a state-layer intent + a tonal-elevation role family, is the concrete next increment against #1226.
