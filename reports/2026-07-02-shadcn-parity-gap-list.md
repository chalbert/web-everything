# shadcn/ui parity gap list (#2022)

**Program:** reproduction-conformance (#1226 / #1225) — *"the difference between any two top design systems
is theme tokens + intents and nothing else."*
**Discharges:** #1243's reconciliation (its "resolved" status covered only a declarative scaffold with zero
readings ingested; this is the measured, rendered-and-diffed flavor + the gap list it produces).
**Artifacts:** `we:design-systems/shadcn.designsystem.json` + `we:design-systems/shadcn.tokens.json` (WE
data); `frontierui:plugs/webtheme/__tests__/unit/shadcnFlavor.test.ts` (the executable, machine-checkable
half of this list — it loads the flavor through the #2017 manifest loader and asserts every claim below).

## What the flavor is

A **full DTCG override** of the webtheme platform default capturing shadcn/ui's default (zinc) theme in
oklch: a near-black `--primary`, a single `0.625rem` `--radius` seed with calc-derived md/lg, the neutral
`--border`/`--input`/`--muted`/`--muted-foreground` roles, and a 3px focus `--ring`. It loads through the
#2017 manifest → `ThemeSource` loader (`frontierui:plugs/webtheme/manifestLoader.ts` `loadManifestTheme`),
which resolves the override over the default and bridges it (`DTCG_TO_LEGACY`) into the legacy family slots
FUI components read via the `--<family>-<name>` alias tier (#2026/#2049).

This is **not** a token-name lookalike (the naming-fork precedent note: an alias merely *named* for shadcn is
not proof of parity). Parity is asserted by resolving the override to concrete values and checking they reach
the slot a rendered button/input/card actually reads.

## What reproduces cleanly (theme tokens + intents suffice)

These shadcn roles reach a rendered FUI button/input/card today — a bridge row lands them on a legacy slot
**and** a `LEGACY_ALIASES` row re-declares that slot so a scoped override is forwarded (DTCG paths written
`family → step` to avoid a false file-path match on a trailing `.md` step):

| shadcn role | DTCG path | bridges to | component reads | reskin |
| --- | --- | --- | --- | --- |
| `--primary` | color → accent | color → primary | `--color-primary` | button/link accent → near-black zinc (the signature shadcn look, vs the blue default) |
| `--border` | surface → border | color → border | `--color-border` | card/input hairline border |
| `--muted-foreground` | surface → muted-foreground | color → text-muted | `--color-text-muted` | secondary/muted text |
| `--radius` / `--radius-lg` | radius → lg | radius → lg | `--radius-lg` | card corner (0.625rem) |
| `--radius-md` | radius → md | radius → md | `--radius-md` | button corner (`calc(--radius - 2px)`) |
| density / motion / surface | `intentDefaults` | — | intent applier | compact density, solid surface — carried through untouched |

Conclusion for these: the #1225 claim **holds** — swapping only theme tokens + intent defaults re-themes the
components, no component code change.

## The gap — roles the tokens+intents model cannot express onto a component

Each below is a shadcn role for which **the model has no path to a rendered component today**, because it is
missing a bridge row, a legacy alias slot, or a platform-default token home altogether. These are the
concrete deliverable of the conformance program — what the evolving standard must grow.

### Tier A — has a token home, but the bridge/alias path is missing (cheapest to close)

1. **Focus ring (`--ring`, `--ring-offset`).** The platform default ships a `ring` role (#1316) and the
   flavor overrides ring color/width/offset, but there is **no `DTCG_TO_LEGACY` row and no `--ring` legacy
   alias**, so a shadcn focus ring cannot re-theme a focused control. shadcn's focus affordance (a 3px ring
   at `--ring` with a 2px offset) is a headline visual — this is the highest-value gap.
   *Proposed:* add ring color/width/offset bridge rows → a new `ring` legacy family (or a `color.ring` slot
   plus `dimension` ring-width/ring-offset slots) and `--ring`/`--ring-width`/`--ring-offset` aliases; wire
   the FUI `:focus-visible` outline to read them.

2. **Input outline (`--input`).** The `surface → input` role resolves in the DTCG doc (shadcn's `--input` =
   `--border` in the default theme) but there is **no bridge row and no `--color-input` alias**. An input's
   outline therefore tracks `--color-border`, not a distinct `--input` — fine for the default theme, but a
   shadcn variant that diverges `--input` from `--border` cannot be reproduced.
   *Proposed:* add a `surface → input` ⇒ `color → input` bridge row + a `--color-input` alias.

3. **Muted surface background (`--muted`).** The `surface → muted-foreground` role bridges (→ text-muted) but
   the muted **background** `surface → muted` does not, and there is no `--color-muted` alias. Muted panels
   (secondary buttons, disabled fields, subtle backgrounds) cannot take shadcn's muted surface.
   *Proposed:* add a `surface → muted` ⇒ `color → muted` bridge row + a `--color-muted` alias.

### Tier B — no token home at all; the standard must add a role family

shadcn ships these as first-class roles; the platform default has **no token** for them, so there is nothing
for a manifest to override. These are the roles the gap list proposes the standard *add* (not just wire).

4. **Explicit `*-foreground` pairings.** shadcn pairs every surface with a readable foreground
   (`--primary-foreground`, `--card-foreground`, `--popover-foreground`, `--accent-foreground`,
   `--secondary-foreground`, `--muted-foreground`, `--destructive-foreground`). Only `--muted-foreground` has
   a home. The platform default derives on-color contrast implicitly rather than as a themeable token, so a
   theme that wants a specific primary-foreground (e.g. off-white on the near-black primary) cannot set it.
   *Proposed:* a **paired-role token convention** — each themeable surface role carries an explicit
   `-foreground` sibling (a small standard addition; likely a new intent/trait: "on-color foreground pairing").

5. **The `secondary` role family (`--secondary`, `--secondary-foreground`).** shadcn's secondary button
   variant. No platform-default secondary color role. *Proposed:* add a `secondary` semantic role (mirrors
   the existing `primary`).

6. **The `destructive` role family (`--destructive`, `--destructive-foreground`).** shadcn's destructive
   button/alert. The platform ships a shared danger tone (#1427/#1458) but not a themeable button-level
   `--destructive` surface+foreground pair the way shadcn does. *Proposed:* map `--destructive` onto the
   existing danger tone and add the paired foreground, OR ratify that the danger tone **is** the destructive
   role (a reconciliation the program should decide — this is a candidate fork, not a mechanical add).

7. **The `accent`/`popover` surface families (`--accent`, `--accent-foreground`, `--popover`,
   `--popover-foreground`).** shadcn's hover-accent surface and popover surface. Note a naming collision: WE
   already uses its `accent` color for the *primary seed*, whereas shadcn's `--accent` is a **muted hover
   surface** — these are different roles with the same word. *Proposed:* the standard needs a distinct hover-
   surface role (do **not** reuse the primary-seed `accent`); `popover` maps onto the existing surface/card
   role or gets its own.

## Non-token divergences observed (not tokens+intents; flagged for the program)

- **Component anatomy.** shadcn's button ships size variants (`sm`/`default`/`lg`/`icon`) and a `ghost`/
  `outline`/`link` variant axis. These are *component-shape* choices, not theme tokens — they belong to the
  intent/trait vocabulary (a `variant` trait), and the flavor cannot express them via `themeTokens`. This is
  the boundary of the #1225 claim: it holds for *look* (color/radius/spacing/shadow), and the residual is
  **variant/anatomy**, which is intent+trait territory, not tokens.

## Net verdict for the program (#1226 / #1225)

The claim **"tokens + intents, nothing else"** reproduces shadcn's *palette, radius, density, and surface
look* cleanly. It does **not yet** reproduce: the focus ring, the input/muted surfaces (wiring gaps, Tier A —
cheap), and shadcn's `*-foreground` / `secondary` / `destructive` / hover-accent / popover role families
(missing token homes, Tier B — real standard additions). The residual beyond tokens is **component
variant/anatomy**, which is intent+trait vocabulary. Closing Tier A + B (7 items above) is the concrete next
increment the conformance program should file against #1226.
