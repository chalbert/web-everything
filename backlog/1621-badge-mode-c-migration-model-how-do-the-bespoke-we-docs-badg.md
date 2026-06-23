---
kind: decision
parent: "866"
status: active
dateOpened: "2026-06-22"
dateStarted: "2026-06-23"
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-badge-mode-c-migration-model.md
tags: [dogfood, fui, badge, filter-chip, site-rework]
---

# Badge mode-C migration model: how do the bespoke WE-docs badge surfaces map to FUI's 5-tone badge, and what mount model fits many-small-components?

**Prepared 2026-06-22.** Both forks are grounded in the real tree (both repos) + a prior-art survey
published as the `/research/` topic
[badge-palette-governance-mount-model](/research/badge-palette-governance-mount-model/) (session report:
[we:reports/2026-06-22-badge-mode-c-migration-model.md](../reports/2026-06-22-badge-mode-c-migration-model.md)).
Grounding reshaped both forks — the item's original option lists were materially incomplete — and surfaced
that **both are forced invariants** (one branch each is provably broken), so ratification should be fast.
Each `## Fork N` carries a recommended default in **bold** that has already been attacked by a skeptic
sub-agent (`Skeptic:` line). Blocks #1598 (migrate WE-docs badge surfaces → FUI badge) and #1208 (dogfood
backlog badges/chips → FUI badge + filter-chip).

The concern decomposes into two orthogonal axes the research surfaced: **(1) palette governance** — where
the backlog's bespoke domain colours live relative to FUI's closed tone enum
(`fui:blocks/badge/Badge.ts:17,41` — `tone ∈ {neutral,info,success,warning,error}`), given that the badge
already ships a `className` extension hook (`fui:blocks/badge/Badge.ts:34,48`; `<we-badge class>`
passthrough at `fui:blocks/badge/BadgeElement.ts:30` + `fui:blocks/transient/TransientElement.ts:62-65`)
and exports `BASE_CLASS`/`BADGE_CSS` for host injection (`fui:blocks/badge/Badge.ts:38,82`); and
**(2) the mount model** — how a *server-rendered* 11ty board (`we:src/_includes/backlog-badges.njk`,
~10 macros) consumes the badge across many-small instances, given that mode-C is one-shadow-root +
one-import per point (`fui:embed/in-document.ts:63-93`) and §7.7 of `we:docs/agent/block-standard.md`
(#1381) names the **transient element** as the reference shape for a behavior-free pill.

## Recommended path at a glance

| Fork | Recommended default | Main (rejected) alternative | Confidence |
|------|--------------------|-----------------------------|------------|
| **Fork 1** — where the domain palette lives | **(1b)** consume FUI's badge contract + carry the domain palette via the `className` escape + WE-docs CSS; map to a tone only where one genuinely fits | (1a) extend FUI's tone enum with backlog vocabulary | **High** — forced invariant; (1a)/(1c) provably broken |
| **Fork 2** — mount model for the server-rendered board | **(2b)** register the `<we-badge>` / `<we-filter-chip>` transient element once; emit in njk; upgrade in place; `we-badge{}` CSS baseline for FOUC | (2a) per-badge mode-C shadow mounts | **High** — forced invariant; (2a) broken, (2c) collapses into (2b) |
| **Fork 2 sub-fork** — FUI-artifact delivery | **runtime cross-origin import** from the FUI origin now → typed import from published `@frontierui/blocks` at #700/#872 | vendoring FUI into the WE build | **Med-high** — interim vs end-state, both coherent |

## Supported by default (not decisions)

- **Link-pills stay native `<a>`.** `blockerChip` / `childCircle` (`we:src/_includes/backlog-badges.njk:82-100`)
  are interactive links, not non-interactive status pills — forcing a `role=status` badge onto an anchor is
  broken. They keep their native `<a>` form (a future FUI domain-tag / link-pill component is a separately
  -prioritized gap, not this migration). **Amendment:** they must consume the *same docs status tokens* the
  migrated status badges resolve to, so "resolved-green" isn't defined twice.
- **Badge and filter-chip render the same way** — both are the §7 transient family, emitted as `<we-*>`
  (badge → native `<span>`; the *interactive* `we-filter-chip` → `<button aria-pressed>`). The filter row is
  already interactive (`we:src/backlog.njk:90`), so the chip genuinely needs runtime; the badge does not but
  uses the same element model for a coherent board. Not a fork — a consistency rule.

## Fork 1 — Where does the backlog's domain palette live?

*Fork-existence (forced invariant):* branch (1a) — adding the backlog taxonomy (`--kind-story`,
`--tier-A`, …) to FUI's badge tone enum — is **broken**: it leaks a consumer-specific taxonomy into a
shared semantic-status component, violating minimize-lock-in and the closed-tone contract. The prior-art
survey is unanimous (GitHub Primer's own *Label* vs *IssueLabelToken* split; Atlassian Lozenge; Polaris
"reserve status colours"; SLDS theme hooks; the Ant Design merged-custom-colour cautionary case). So this
is a ratify, not a weigh.

**Crux:** FUI's badge tone enum is *operational status* (`neutral|info|success|warning|error`); the
backlog palette is *domain taxonomy* (story/epic/decision/tier). These are different axes — most backlog
surfaces don't map onto a status tone at all.

- **(a) Extend FUI `we-badge` with the backlog vocabulary.** *Rejected* — leaks docs-specific taxonomy
  into the shared component; defeats the closed-tone semantic system; lock-in. The industry-universal
  anti-pattern (no surveyed system widens its semantic enum for a consumer taxonomy).
- **(b) Consume FUI's badge contract for every presentational pill; map to a semantic tone where one
  *genuinely* fits (e.g. `statusBadge` resolved→success, active→info; size/meta/tags→neutral), and carry
  the backlog domain palette (kind, tier, unsliced-reason, decision/preparing) via the badge's exported
  `className` escape + WE-docs-local CSS (`fui-badge fui-badge--kind-story` defined in the docs
  stylesheet) — never widening FUI's tone enum.** This is config-extends-platform-default; it dogfoods the
  badge's geometry + `__icon`/`__label` structure + `role=status`/`aria-label` a11y wiring once instead of
  re-deriving it across ~10 njk macros.
  - *Skeptic amendment (folded in):* pure-taxonomy surfaces (`kindBadge`, `tierBadge`) where a tone would
    be a lie (story is not "info") consume the badge **geometry + a docs-owned modifier class with NO FUI
    tone class** — don't fake-map a taxonomy onto a status tone. Genuinely-status surfaces (`statusBadge`,
    `epicStatusBadge`, `reasonPill`) get real tones.
- **(c) A config-driven generic badge accepting arbitrary bg/fg.** *Rejected* — Ant-style merged custom
  colour accrues contrast / dark-mode debt; defeats the tone system; lock-in.

**Recommended default: (1b).**

`Skeptic: SURVIVES-WITH-AMENDMENT` — the attack ("consuming only the class vocabulary while overriding all
colours is a cosmetic dogfood") was beaten: the dogfood is the geometry + a11y wiring + real tones for the
status surfaces (the minority that override is pure taxonomy). Folded in: taxonomy surfaces = geometry +
docs modifier (no fake tone); native link-pills share the same docs status tokens so the palette doesn't
fork into two definitions of "resolved-green".

## Fork 2 — How does the *server-rendered* board consume the badge across many-small instances?

*Fork-existence (forced invariant):* branch (2a) — a per-badge mode-C shadow mount — is **broken**.
`fui:embed/in-document.ts:63-93` attaches *one shadow root per mount point* via a *per-point dynamic
`import()`* (the trusted heavy/interactive iframe-replacement path), and the badge's `mountInDocument`
(`fui:blocks/badge/Badge.ts:112`) is a five-tone *showcase demo*, not a per-instance path. ~6 badges/tile
× hundreds of tiles = N shadow roots + N imports/page (perf + a11y-tree cost). So this is a ratify.

**Crux:** the board is a behavior-free, server-rendered surface with hundreds of tiny pills; §7.7 of
`we:docs/agent/block-standard.md` (#1381) names the **transient element** as the reference shape for
exactly this (badge cited explicitly).

- **(a) Per-badge mode-C shadow mounts.** *Rejected* — wrong tool (trusted heavy/interactive embed path);
  N shadow roots + N dynamic imports per page.
- **(b) Register the `we-badge` / `we-filter-chip` transient custom element once; emit `<we-badge>` /
  `<we-filter-chip>` server-side in the njk macros; each upgrades in place to its native element
  (`fui:blocks/badge/registerBadge.ts` + `fui:blocks/badge/BadgeElement.ts`), zero wrapper, light-DOM, no
  shadow roots. Mitigate the upgrade flash with a `we-badge { … }` CSS baseline so the element is styled
  *before* upgrade — mirroring `we:src/_includes/layouts/base.njk`'s reveal-nav SSR baseline (#865).**
  This **re-frames #1598's "mode-C inline SDK" requirement → transient-CE dogfood** (repoint #1598's
  title/AC on resolve).
- **(c) A single batched registry-mount.** *Rejected as a distinct branch* — registering the custom
  element once *is* the single pass; the platform's upgrade walk handles every instance. Collapses into (b).

**Recommended default: (2b).**

### Fork 2 sub-fork — FUI-artifact delivery

How the 11ty board obtains `registerBadge` + `BADGE_CSS` (and the chip's element JS):

- **(i) Runtime cross-origin import from the FUI origin (interim default).** Per the
  `fui:embed/in-document.ts` precedent ("runtime FUI-hosted module, no `frontierui` alias, imports no FUI
  source") + the #1499 cross-origin pattern — keeps WE's build free of any FUI source dependency.
- **(ii) Vendor / bundle FUI's badge into the WE docs build.** *Rejected* — violates WE-holds-zero-impl
  and recreates the #170 duplication / drift hazard.
- **(iii) Typed import from the published `@frontierui/blocks` package (end-state).** The #700/#872
  destination; (i) is the bridge until that package ships.

**End-state enhancement (filed separately, gated on #700):** once `@frontierui/blocks` is published, FUI
could export a `renderBadge(config): string` the 11ty build calls — zero client JS, zero FOUC, FUI code
still renders (true dogfood), coupling to a function contract not classes. The genuinely-best *static-board*
path, but it needs a new FUI export + a build-time FUI dependency, so it's a separately-prioritized
enhancement, not the interim default.

`Skeptic: REFUTED → flipped.` A reframe attempted in prep — emit the badge's *lowered native form*
(`<span class="fui-badge…">`) directly in the njk macros (zero JS, zero FOUC) — was refuted on three
verified grounds: (1) it is §7.2's explicit *no-element / CSS-only* path, the **lowest-compliance** choice;
(2) reproducing `decorate()`'s class-mapping + `__icon`/`__label` + `role=status` logic in Nunjucks is **WE
holding badge implementation** (violates WE-zero-impl + the #865 "FUI renders, WE owns data" precedent,
`we:src/_data/chrome.js:1-10`); (3) it couples the docs build to FUI *internal* class names (a rename
breaks the board silently) rather than the stable `<we-badge>` / `createBadge` contract. Default flipped
back to the transient element (2b), with the FOUC concern handled the chrome-dogfood way (a CSS baseline).
The sub-fork default (cross-origin import) survives — it is the only delivery that keeps WE's build free of
FUI source.

## Code examples (grounded in the real tree)

Concrete before/after for the two recommended defaults, so the spin-off builds inherit the shape (not
just the verdict). All refs are real file:line.

### Fork 2 (2b) — transient element end-to-end

**Today** — every macro hand-rolls inline styles. `we:src/_includes/backlog-badges.njk:32-36`
(`statusBadge`):

```njk
<span style="padding:{{pad}}; border-radius:9999px; font-size:{{fs}}; font-weight:600;
  background:{% if status=='resolved' %}#dcfce7{% ... %};
  color:{% if status=='resolved' %}#166534{% ... %};">{{ status|title }}</span>
```

**After (2b)** — the macro emits `<we-badge>`; it upgrades in place to a native `<span>`
(`fui:blocks/badge/BadgeElement.ts:18,27-46`), zero wrapper, light-DOM, no shadow root:

```njk
{% macro statusBadge(status, scale='sm') %}
<we-badge tone="{{ 'success' if status=='resolved'
                   else 'info' if status=='active'
                   else 'warning' if status=='open'
                   else 'neutral' }}"
          {% if status != 'preparing' %}status{% endif %}
          {% if status=='preparing' %}class="be-status--preparing"{% endif %}>{{ 'Prepping' if status=='preparing' else status|title }}</we-badge>
{% endmacro %}
```

**Registered once** (mirrors the #865 chrome wiring at `we:src/_layouts/base.njk:417-426`) — this is the
delivery sub-fork (i), runtime cross-origin import from the FUI origin. It pulls **both** the element JS
(`registerBadge`) *and* the tone CSS (`BADGE_CSS`), because light-DOM transients can't carry scoped
styles (see wrinkle 2):

```njk
<script type="module">
  const base = "{{ links.frontierUrl }}";
  import(`${base}/blocks/badge/registerBadge.ts`).then(m => m.registerBadge()).catch(()=>{});
  import(`${base}/blocks/badge/Badge.ts`).then(({BADGE_CSS}) => {
    const s = document.createElement('style'); s.textContent = BADGE_CSS; document.head.append(s);
  }).catch(()=>{});
</script>
```

### Fork 1 (1b) — status tone vs. taxonomy modifier

The `statusBadge` above already shows the split: `resolved/active/open` map to real FUI tones
(`success/info/warning`), but **`preparing` (purple) has no FUI tone** → it takes a docs-owned modifier
class with *no* tone. Pure-taxonomy `kindBadge` (`we:src/_includes/backlog-badges.njk:25-29`) is
all-taxonomy:

```njk
{% macro kindBadge(kind, scale='sm') %}
<we-badge class="be-kind be-kind--{{ kind }}">{{ kind }}</we-badge>
{% endmacro %}
```

```css
/* WE-docs-local stylesheet — domain taxonomy palette, NEVER widens FUI's enum */
.fui-badge.be-kind--story    { background:#dbeafe; color:#1e40af; border-color:transparent; }
.fui-badge.be-kind--epic     { background:#ede9fe; color:#5b21b6; border-color:transparent; }
.fui-badge.be-kind--decision { background:#e0e7ff; color:#3730a3; border-color:transparent; }
.fui-badge.be-kind--task     { background:#f1f5f9; color:#475569; border-color:transparent; }
```

This dogfoods the badge's geometry + `__icon`/`__label` structure + `role=status` wiring once instead of
re-deriving it across ~10 macros, while the domain colours stay in WE-docs CSS, never in the shared FUI
component.

### Two wrinkles the code surfaces (acceptance-criteria for #1598/#1208, not blockers)

1. **Vestigial `fui-badge--neutral`.** `decorate()` *always* stamps a tone class
   (`fui:blocks/badge/BadgeElement.ts:28-30`) — a no-tone `<we-badge>` lands as
   `class="fui-badge fui-badge--neutral be-kind be-kind--story"`. The docs CSS wins via the
   `.fui-badge.be-kind--story` two-class specificity (beats single-class `.fui-badge--neutral`). So **no
   FUI change is needed** — the build item must use the compound selector, not a bare `.be-kind--story`.
2. **Light-DOM needs global `BADGE_CSS`.** Unlike mode-C's shadow encapsulation, transient elements are
   light-DOM, so tone styles can't be scoped — hence the `BADGE_CSS` injection above
   (`fui:blocks/badge/Badge.ts:82`). Pulling it from the FUI origin keeps WE's build free of FUI source
   (true to sub-fork default (i)).

Both confirm the defaults rather than challenging them.

## Context

- **Lineage.** Parent #866 (WE-docs FUI-chrome dogfood), sibling of #865 (chrome dogfood — established the
  "FUI renders, WE owns data, SSR baseline" model via mode-C for the *one big* chrome mount) and the
  #777/#778 backlog-badge dogfood (#1208). Surfaced in batch-2026-06-22-1615-1208 after #1603 shipped FUI
  `badge`/`filter-chip`.
- **On resolve, the spin-off builds** (each `blockedBy` this decision until ratified): #1598 (badges →
  `<we-badge>`, repoint its "mode-C inline SDK" title → transient-CE dogfood) and #1208 (chips →
  `we-filter-chip`). File the build-time `renderBadge()` SSR enhancement as a new FUI item gated on #700.
  No `fui:embed/badge-in-document.ts` / `fui:embed/filter-chip-in-document.ts` module is needed (those
  would only matter under the rejected mode-C branch).
- Pre-flight memory checks honoured: `feedback_prep_verify_mechanism_has_consumer` (read the real FUI tree
  before assuming a flat mount — found the `className` seam + the transient element already shipped) and
  `feedback_misflagged_batchable_fix_real_state`.
