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

**REFRAMED 2026-06-23 (post-prep, during ratification review): Fork 1 changed.** Reviewing the **`tag`
intent** exposed that the prep grounded only in the FUI *impl* tree and skipped the *standard layer*: the
platform had already decomposed this vocabulary via **#1319** (Status Indicator vs Tag vs Notification
Marker). Fork 1 is no longer "where does the palette live" but "which intent owns each surface"; its old
(1b) default (a docs-modifier palette on the status badge) is **retired** — see Fork 1 below. This spun
off **#1669** (build the FUI `we-tag` block) and **#1668** (harden the grounding gate so a vocab→component
mapping must check the intent registry first). Fork 2 is unchanged.

**Further (2026-06-23, review cont'd): Fork 1's taxonomy half is now subsumed by #1670.** The review
generalised past the tag block: an app's categorical vocabularies (kind/tier/size/status) are closed lists
reused *cross-surface* (badge, tag, the numbered `childCircle`, link-pills, filter chips), so they belong
to a **single categorical-taxonomy provider** (#1670, open), not a `we-tag` feature. Under that, taxonomy
surfaces consume the provider by `(set, value)`; `we-tag`/`we-badge`/circles/links are all *consumers*.
This does **not** change #1621's ratifiable parts — the **status-surface** migration (→ `<we-badge>`),
Fork 2 (transient mount), and the delivery sub-fork stand on their own. Only the *taxonomy* half now waits
on #1670 (which waits on nothing — it's the upstream design call).

The concern decomposes into two orthogonal axes: **(1) intent ownership** — which intent owns each backlog
surface (Status Indicator vs Tag, per #1319), then consume that intent's FUI impl; the badge
(`fui:blocks/badge/Badge.ts:17,41` — `tone ∈ {neutral,info,success,warning,error}`) implements *Status
Indicator only*, so categorical surfaces need the Tag impl (#1669), not the badge's `className` escape; and
**(2) the mount model** — how a *server-rendered* 11ty board (`we:src/_includes/backlog-badges.njk`,
~10 macros) consumes the badge across many-small instances, given that mode-C is one-shadow-root +
one-import per point (`fui:embed/in-document.ts:63-93`) and §7.7 of `we:docs/agent/block-standard.md`
(#1381) names the **transient element** as the reference shape for a behavior-free pill.

## Recommended path at a glance

| Fork | Recommended default | Main (rejected) alternative | Confidence |
|------|--------------------|-----------------------------|------------|
| **Fork 1** *(REFRAMED)* — which intent owns each surface | **(1-by-intent)** map each macro to its owning intent (#1319): lifecycle→`badge` now; categorical→`we-tag` (#1669) | (1b) docs-modifier palette on the status badge — *re-conflates Status Indicator + Tag* | **High** — cites resolved statute #1319 + existing `tag` intent |
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

## Fork 1 — Which intent owns each backlog surface? (REFRAMED 2026-06-23)

**Reframe (supersedes the original "where does the *palette* live" framing).** The original fork asked
where the backlog's domain palette lives *relative to FUI's badge* — assuming the badge is the only
component in play. That skipped the **standard layer**. Grounding in the intent registry shows the
platform already decomposed this exact vocabulary: **#1319**
(`decompose-overloaded-vocabulary-by-semantic-source`, RESOLVED, codified statute) split one overloaded
"badge" into three intents by *semantic source*:

- **Status Indicator** (`we:src/_data/intents/status-indicator.json`) — lifecycle state; the *visual
  member of the Web Lifecycle protocol*. FUI's `badge` (`fui:blocks/badge/Badge.ts`) is its impl.
- **Tag** (`we:src/_data/intents/tag.json`, draft) — decorative/categorical label, with a purpose-built
  `categorical` tone for topic/keyword labels that map to no severity. **No FUI impl exists** (filed #1669).
- **Notification Marker** — count-bearing (not on the board).

So the real question is **which intent owns each surface**, then consume that intent's FUI impl — not
"how do we bend the badge to hold taxonomy." Putting `kindBadge`/`tierBadge` on the status badge via a
docs-modifier class (the original (1b)) **re-conflates exactly what #1319 split** — it contradicts
ratified statute, not just taste.

**The mapping** (the ~10 macros in `we:src/_includes/backlog-badges.njk`):

| Macro(s) | Intent | FUI impl | Migrate when |
|---|---|---|---|
| `statusBadge`, `epicStatusBadge`, `reasonPill` | Status Indicator (lifecycle) | `badge` ✓ exists | **now** (status half of #1598/#1208) |
| `kindBadge`, `tierBadge`, `tagsRow`, `sizeBadge`, `metaBadge` | **Tag** (categorical) | **`we-tag` — #1669, doesn't exist yet** | blocked on #1669 |
| `blockerChip`, `childCircle` | native `<a>` link-pills | — | stay native (see *Supported by default*) |

- **(1a) Extend FUI's badge tone enum with backlog taxonomy.** *Rejected* — leaks consumer taxonomy into
  the shared status component; defeats the closed-tone contract; industry-universal anti-pattern. Now also
  redundant: the Tag intent exists precisely so taxonomy doesn't ride the status enum.
- **(1b — original) Carry taxonomy via a docs-modifier class on the status badge.** *Rejected on reframe*
  — re-conflates Status Indicator and Tag, the two intents #1319 deliberately separated. A docs-owned
  `categorical` palette stamped on a *status* component is the same conflation in a thinner disguise.
- **(1-by-intent — NEW default) Map each surface to its owning intent; consume that intent's FUI impl.**
  Lifecycle surfaces → `badge` (now). Categorical surfaces → `we-tag` (the Tag intent's `categorical`
  tone, theme-resolved — the domain palette lives in the *intent's* tone vocabulary, not a docs hack),
  blocked on **#1669**. This is config-extends-platform-default done at the right layer.
- **(1c) Generic badge accepting arbitrary bg/fg.** *Rejected* — Ant-style merged-colour contrast /
  dark-mode debt; lock-in.

**Recommended default: (1-by-intent).** Confidence **high** — cites resolved statute (#1319) + the
existing `tag` intent. The only open sub-question is whether `sizeBadge`/`metaBadge` are Tag-categorical
or a neutral data pill (mechanical, settled in the build).

**Consequence:** #1621 splits its downstream — the *status* surfaces migrate to `<we-badge>` now; the
*taxonomy* surfaces are `blockedBy` **#1669** (build the `we-tag` block). The original (1b) docs-modifier
approach is retired.

`Skeptic note (original, now moot):` the prior "SURVIVES-WITH-AMENDMENT" pass defended (1b) as a
geometry+a11y dogfood. That defense is obsoleted by the reframe — the right dogfood for taxonomy is the
*Tag* component, not the status badge wearing a docs class. The skeptic never checked the intent registry,
exactly the gating gap **#1668** closes.

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

### Fork 1 (REFRAMED) — map each surface to its owning intent

> The original example here (taxonomy on the status badge via a `be-kind--*` docs-modifier class) is
> **retired** — it re-conflated Status Indicator and Tag (#1319). It's preserved below struck-through only
> to show what *not* to do; the live mapping splits by intent.

**Status surfaces → `<we-badge>` (Status Indicator, exists).** The `statusBadge` example above is correct
for the lifecycle states: `resolved/active/open` → real tones (`success/info/warning`). Note even here
**`preparing` has no FUI status tone** — that's a hint it's really *categorical*, so under the reframe it
moves to `<we-tag tone="categorical">` alongside kind/tier, not a status-badge modifier.

**Taxonomy surfaces → `<we-tag>` (Tag intent, blocked on #1669).** Once the `we-tag` block ships, the
domain palette lives in the *intent's* `categorical` tone (theme-resolved), not a docs hack:

```njk
{% macro kindBadge(kind, scale='sm') %}
<we-tag tone="categorical" shape="badge" data-kind="{{ kind }}">{{ kind }}</we-tag>
{% endmacro %}
```

~~Retired (re-conflates Status Indicator + Tag):~~

```njk
{# DO NOT — taxonomy stamped onto the *status* badge via a docs-modifier class #}
{# <we-badge class="be-kind be-kind--{{ kind }}">{{ kind }}</we-badge> #}
```

The kind/tier colour vocabulary belongs in the Tag intent's theme tokens (the `we-tag` block, #1669), not
a WE-docs `be-kind--*` stylesheet — so "story-blue" is defined once, in the standard's own form.

### Two wrinkles the code surfaces (acceptance-criteria for the #1598/#1208 *status* half, not blockers)

1. **`decorate()` always stamps a tone class** (`fui:blocks/badge/BadgeElement.ts:28-30`) — a no-tone
   element defaults to `--neutral`. Under the reframe this is a **design note for the `we-tag` block
   (#1669)**: its `categorical` tone must be a *first-class* tone in the element's own enum, not a docs
   override of a vestigial `--neutral`. (The retired docs-modifier approach would have needed a compound
   `.fui-badge.be-kind--story` selector to beat `--neutral`; mapping to the Tag intent removes the hack.)
2. **Light-DOM needs global CSS.** Unlike mode-C's shadow encapsulation, transient elements are
   light-DOM, so tone styles can't be scoped — hence the `BADGE_CSS` injection above
   (`fui:blocks/badge/Badge.ts:82`); the `we-tag` block needs an equivalent `TAG_CSS` export. Pulling it
   from the FUI origin keeps WE's build free of FUI source (true to sub-fork default (i)).

Both are acceptance-criteria for the spin-off builds, not blockers on the decision.

## Context

- **Lineage.** Parent #866 (WE-docs FUI-chrome dogfood), sibling of #865 (chrome dogfood — established the
  "FUI renders, WE owns data, SSR baseline" model via mode-C for the *one big* chrome mount) and the
  #777/#778 backlog-badge dogfood (#1208). Surfaced in batch-2026-06-22-1615-1208 after #1603 shipped FUI
  `badge`/`filter-chip`.
- **On resolve, the spin-off builds** (each `blockedBy` this decision until ratified), now split by the
  Fork-1 reframe:
  - **Status half — buildable now:** #1598 (lifecycle badges → `<we-badge>`, repoint its "mode-C inline
    SDK" title → transient-CE dogfood) and #1208 (filter chips → `we-filter-chip`).
  - **Taxonomy half — `blockedBy` #1669:** kind/tier/tags/size pills → `<we-tag>` (Tag intent), which
    needs the FUI `we-tag` block first (**#1669**). On resolve, add the #1669 edge to the taxonomy
    portion of #1598/#1208 (split those items if needed).
  - File the build-time `renderBadge()`/`renderTag()` SSR enhancement as a new FUI item gated on #700.
  - No `fui:embed/badge-in-document.ts` / `fui:embed/filter-chip-in-document.ts` module is needed (those
    would only matter under the rejected mode-C branch).
- **Spun off during ratification review (2026-06-23):** #1669 (build the FUI `we-tag` block) and #1668
  (harden the fork-readiness grounding gate — check the intent registry + statute before a vocab→component
  mapping). Both trace to the same gap: the prep grounded in the FUI impl tree and skipped the standard
  layer, so it missed the #1319 Status-Indicator-vs-Tag decomposition.
- Pre-flight memory checks honoured: `feedback_prep_verify_mechanism_has_consumer` (read the real FUI tree
  before assuming a flat mount — found the `className` seam + the transient element already shipped) and
  `feedback_misflagged_batchable_fix_real_state`.

## Progress

- **Status:** active — **awaiting ratification.** Both forks presented + code examples added; Fork 1
  reframed to map-by-intent after reviewing the `tag` intent.
- **Done:** prep committed; grounded code examples added; Fork 1 rewritten (map-by-intent, supersedes the
  retired docs-modifier (1b)); spun off #1669 (FUI `we-tag` block) + #1668 (grounding-gate hardening);
  added the `[[feedback_examples_go_in_the_story]]` + standard-layer-grounding memories.
- **Next:** on explicit ratify go → `resolve` #1621 (`graduatedTo` none — it's a ruling); confirm the
  status/taxonomy downstream split on #1598/#1208 and wire the #1669 edge onto their taxonomy half.
