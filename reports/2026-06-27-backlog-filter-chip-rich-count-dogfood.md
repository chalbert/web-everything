# Backlog summary-pill → we-filter-chip: the rich structured-count tradeoff

> Grounding for decision [#1866](/backlog/1866-backlog-prioritisation-summary-pill-conversion-to-we-filter-/)
> (child of dogfood epic [#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/);
> blocks [#1825](/backlog/1825-migrate-the-backlog-filter-pills-to-fui-we-filter-chip-inter/)). Prepared
> 2026-06-27. In-constellation survey only — no human judgment.

## The two chip families on /backlog/

The Prioritisation row has two structurally different controls:

1. **Plain filter chips** — status / kind / size / tier / readiness / split (`we:src/backlog.njk:451-452`,
   `data-pready`/`data-pkind`/`data-psplit`). Flat label + (optionally) a single scalar count. Selected by
   `data-*` attributes that survive the custom-element upgrade. **A clean, faithful swap** to `we-filter-chip`.
2. **Summary pills** — `batchable / agent-ready / epics / program / decision / not-ready`
   (`we:src/backlog.njk:394-401`, `data-pfilter`). Each carries **(a)** a distinct semantic **background
   colour** (six hard-coded inline colours) and **(b)** a **rich structured count**: nested colour-coded
   sub-spans. The `decision` pill alone has three (`we:src/backlog.njk:399`): green `✓ prepared`, blue
   `in flight`, purple `preparing`. `batchable` has a light-blue `N in flight` (`we:src/backlog.njk:395`).

These sub-counts are **actionable at-a-glance signals** for a solo dev running a batch, not decoration —
"how many decisions are prepared vs still preparing" drives what to pick next.

## What we-filter-chip can represent

`fui:blocks/filter-chip/FilterChipElement.ts`:

- `decorate()` moves `textContent` into a label span as a **flattened plain string**
  (`fui:blocks/filter-chip/FilterChipElement.ts:39-41`), then **overwrites `el.innerHTML`**
  (`fui:blocks/filter-chip/FilterChipElement.ts:40`) — so any authored child sub-spans are **erased**, even
  though `TransientElement` moves child nodes in first (`fui:blocks/transient/TransientElement.ts:68`).
- A single scalar `count` attribute becomes one count span (`fui:blocks/filter-chip/FilterChipElement.ts:43-49`).
- No slots, no Shadow DOM, no rich-content projection, no per-instance colour-variant API.

So the component **provably cannot** today represent the nested colour-coded sub-counts or the per-pill
background colour. Converting the summary pills as-is is lossy by construction.

## The three options (card) + a probed fourth

1. **Scope #1825 to the plain chips now; carve the summary-pill conversion to a follow-up.** Delivers
   #1825's *"exactly as before"* faithfully for the clean-swap family; defers the lossy family.
2. **Extend `we-filter-chip` to carry rich/structured counts** (a `rich-count` slot or structured sub-count
   API). The true dogfood end-state for #777, but a FUI component-design investment.
3. **Accept the lossy flatten.** Violates #1825's *"exactly as before"* and drops actionable signal.
4. *(probed, rejected)* **Compose multiple `we-filter-chip`s per summary pill.** Each pill is **one semantic
   unit** — one `data-pfilter` button, one `aria-pressed` toggle wired in `we:src/assets/js/backlog-table-sort.js`.
   Splitting it into sibling chips breaks the toggle semantics and the `data-pfilter` handler. Not viable.

## #777's stake

#777's goal is that WE-docs chrome renders the constellation's **own** FUI components — the ultimate dogfood
(#1208 already moved backlog badges onto `we-tag`/`we-badge`). Leaving six hand-rolled pills is a real,
visible dogfood gap. So option (1)'s carve is only honest if the follow-up is **filed and tracked**, not a
vague "later."

## Skeptic pass (folded in)

**SURVIVES-WITH-AMENDMENT.** The `decorate()`-clobbers-`innerHTML` finding is confirmed
(`fui:blocks/filter-chip/FilterChipElement.ts:40`); option (3) is genuinely the flawed branch (the sub-counts are actionable, not
cosmetic); option (4) doesn't survive (one semantic toggle unit). The carve (option 1) is *the only faithful
move given today's API* — **but** "scope it later" is structurally indistinguishable from permanent omission
unless the option-2 capability is **filed as a concrete child of #777 and named as the carved follow-up's
blocker** before #1825 closes. That hard-link is the required amendment to the default.
