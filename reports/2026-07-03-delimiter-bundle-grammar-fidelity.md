# Delimiter-bundle grammar-fidelity scores (#2113)

**Program:** framework-flavored delimiter bundles (#2094) — reproduce popular template languages as
ready-made authoring styles over the #2074 `CustomNode` recipe model, each scored on faithful
reproduction with the **gap list** as the real deliverable (the #2024 analogue for delimiter grammars).
**Scorer:** `frontierui:plugs/webnodes/grammarScorecard.ts` `scoreGrammar` — a single, framework-agnostic
scorer. All framework knowledge is the WE-owned checklists (`we:design-systems/grammars/*.grammar.json`);
there is **no per-framework code**. Each construct scores exactly one of **reproduced** (recipe
delimiter + nature match) / **partial** (delimiter claimed, nature diverges) / **out-of-scope** (a
concern the #2074 statute does not own — attribute-keyed → #1986 registry, attribute-value
interpolation → sibling surface) / **gap** (the recipe model cannot express it — the standard increment).
**Bundle zero (consumer-at-birth):** FUI’s own native grammar — the mustache `{{ }}` + polymer `[[ ]]`
interpolation recipes (`frontierui:plugs/webnodes/recipes/interpolationRecipes.ts`).
**Re-derivable:** `we:scripts/grammar-scorecard.mjs` re-emits this report; `--check` fails the gate on drift.

> Bundle zero scores **100%** against its own native checklist (self-consistency — nothing to gap), and
> exposes its real gaps only when scored against a *framework* checklist (Handlebars, Blade, Vue, etc. below):
> regions, raw/unescaped output, partials, comments — the concrete increments the per-flavor bundle
> stories (#2114–#2119) grow, and the mid-region-marker gap (`{{else}}`) whose decision card the first
> confirming gap list earns (not a guess). Vue is the firewall proof (#2119): its delimiter surface is
> only `{{ }}` text interpolation — every other construct is attribute-keyed, out-of-scope per #2074.

## Summary

| checklist | fidelity | reproduced / scorable | out-of-scope |
| --- | --- | --- | --- |
| FUI native | 100% | 2 / 2 | 0 |
| Handlebars | 17% | 1 / 6 | 2 |
| Blade | 17% | 1 / 6 | 1 |
| Liquid/Jinja | 14% | 1 / 7 | 3 |
| Vue | 100% | 1 / 1 | 7 |
| Angular | 10% | 1 / 10 | 3 |

> Checklist data: `we:design-systems/grammars/fui-native.grammar.json`.

## Grammar fidelity — FUI native

**Fidelity: 100%** (2/2 in-scope constructs reproduce through the #2074 recipe model; 0 out-of-scope-per-statute).

| construct | nature | verdict | recipe |
| --- | --- | --- | --- |
| `{{ expr }}` | value | ✓ reproduced | MustacheInterpolationNode |
| `[[ expr ]]` | value | ✓ reproduced | PolymerInterpolationNode |

### Gap list

None — every in-scope construct reproduces. (Expected only for a trivial grammar like bundle zero.)


---

> Checklist data: `we:design-systems/grammars/handlebars.grammar.json`.

## Grammar fidelity — Handlebars

**Fidelity: 17%** (1/6 in-scope constructs reproduce through the #2074 recipe model; 2 out-of-scope-per-statute).

| construct | nature | verdict | recipe |
| --- | --- | --- | --- |
| `{{ expr }}` | value | ✓ reproduced | MustacheInterpolationNode |
| `{{{ raw }}}` | value | ✗ gap | — |
| `{{#each}}…{{/each}}` | children | ✗ gap | — |
| `{{#if}}…{{/if}}` | children | ✗ gap | — |
| `{{> partial }}` | marker | ✗ gap | — |
| `{{! comment }}` | marker | ✗ gap | — |
| `helper as element attribute` | marker | — out-of-scope | — |
| `class="{{ x }}" attribute interpolation` | value | — out-of-scope | — |

### Gap list — constructs the recipe model cannot express (the standard increment)

| construct | nature | reason | note |
| --- | --- | --- | --- |
| `{{{ raw }}}` | value | unclaimed | no bundle recipe declares static open "{{{" |
| `{{#each}}…{{/each}}` | children | unclaimed | no bundle recipe declares static open "{{#each" |
| `{{#if}}…{{/if}}` | children | unclaimed | no bundle recipe declares static open "{{#if" |
| `{{> partial }}` | marker | unclaimed | no bundle recipe declares static open "{{>" |
| `{{! comment }}` | marker | unclaimed | no bundle recipe declares static open "{{!" |


---

> Checklist data: `we:design-systems/grammars/blade.grammar.json`.

## Grammar fidelity — Blade

**Fidelity: 17%** (1/6 in-scope constructs reproduce through the #2074 recipe model; 1 out-of-scope-per-statute).

| construct | nature | verdict | recipe |
| --- | --- | --- | --- |
| `{{ $x }}` | value | ✓ reproduced | MustacheInterpolationNode |
| `{!! $x !!}` | value | ✗ gap | — |
| `{{-- comment --}}` | value | ✗ gap | — |
| `@if (cond) … @endif` | children | ✗ gap | — |
| `@foreach ($x as $y) … @endforeach` | children | ✗ gap | — |
| `@verbatim … @endverbatim` | children | ✗ gap | — |
| `@include("view")` | marker | — out-of-scope | — |

### Gap list — constructs the recipe model cannot express (the standard increment)

| construct | nature | reason | note |
| --- | --- | --- | --- |
| `{!! $x !!}` | value | unclaimed | no bundle recipe declares static open "{!!" |
| `{{-- comment --}}` | value | unclaimed | no bundle recipe declares static open "{{--" |
| `@if (cond) … @endif` | children | unclaimed | no bundle recipe declares static open "@if" |
| `@foreach ($x as $y) … @endforeach` | children | unclaimed | no bundle recipe declares static open "@foreach" |
| `@verbatim … @endverbatim` | children | unclaimed | no bundle recipe declares static open "@verbatim" |


---

> Checklist data: `we:design-systems/grammars/liquid-jinja.grammar.json`.

## Grammar fidelity — Liquid/Jinja

**Fidelity: 14%** (1/7 in-scope constructs reproduce through the #2074 recipe model; 3 out-of-scope-per-statute).

| construct | nature | verdict | recipe |
| --- | --- | --- | --- |
| `{{ expr }}` | value | ✓ reproduced | MustacheInterpolationNode |
| `{% for … %}…{% endfor %}` | children | ✗ gap | — |
| `{% if … %}…{% endif %}` | children | ✗ gap | — |
| `{% block … %}…{% endblock %}` | children | ✗ gap | — |
| `{% raw %}…{% endraw %}` | children | ✗ gap | — |
| `{% comment %}…{% endcomment %}` | children | ✗ gap | — |
| `{# comment #}` | marker | ✗ gap | — |
| `{{ x | filter }} expression filter/pipe` | value | — out-of-scope | — |
| `{% include %} / {% extends %}` | marker | — out-of-scope | — |
| `class="{{ x }}" attribute interpolation` | value | — out-of-scope | — |

### Gap list — constructs the recipe model cannot express (the standard increment)

| construct | nature | reason | note |
| --- | --- | --- | --- |
| `{% for … %}…{% endfor %}` | children | unclaimed | no bundle recipe declares static open "{% for" |
| `{% if … %}…{% endif %}` | children | unclaimed | no bundle recipe declares static open "{% if" |
| `{% block … %}…{% endblock %}` | children | unclaimed | no bundle recipe declares static open "{% block" |
| `{% raw %}…{% endraw %}` | children | unclaimed | no bundle recipe declares static open "{% raw" |
| `{% comment %}…{% endcomment %}` | children | unclaimed | no bundle recipe declares static open "{% comment" |
| `{# comment #}` | marker | unclaimed | no bundle recipe declares static open "{#" |


---

> Checklist data: `we:design-systems/grammars/vue.grammar.json`.

## Grammar fidelity — Vue

**Fidelity: 100%** (1/1 in-scope constructs reproduce through the #2074 recipe model; 7 out-of-scope-per-statute).

| construct | nature | verdict | recipe |
| --- | --- | --- | --- |
| `{{ expr }}` | value | ✓ reproduced | MustacheInterpolationNode |
| `v-if / v-else-if / v-else structural directives` | children | — out-of-scope | — |
| `v-for iteration directive` | children | — out-of-scope | — |
| `:prop / v-bind data-binding` | value | — out-of-scope | — |
| `@event / v-on event-binding` | marker | — out-of-scope | — |
| `v-model two-way binding` | value | — out-of-scope | — |
| `v-html raw output directive` | value | — out-of-scope | — |
| `class="{{ x }}" attribute interpolation` | value | — out-of-scope | — |

### Gap list

None — every in-scope construct reproduces. (Expected only for a trivial grammar like bundle zero.)


---

> Checklist data: `we:design-systems/grammars/angular.grammar.json`.

## Grammar fidelity — Angular

**Fidelity: 10%** (1/10 in-scope constructs reproduce through the #2074 recipe model; 3 out-of-scope-per-statute).

| construct | nature | verdict | recipe |
| --- | --- | --- | --- |
| `{{ expr }}` | value | ✓ reproduced | MustacheInterpolationNode |
| `@if (cond) { … }` | children | ✗ gap | — |
| `@else { … }` | children | ✗ gap | — |
| `@else if (cond) { … }` | children | ✗ gap | — |
| `@for (item of items) track item { … }` | children | ✗ gap | — |
| `@empty { … }` | children | ✗ gap | — |
| `@switch (expr) { … }` | children | ✗ gap | — |
| `@case (val) { … }` | children | ✗ gap | — |
| `@default { … }` | children | ✗ gap | — |
| `@defer { … }` | children | ✗ gap | — |
| `[prop] property binding` | marker | — out-of-scope | — |
| `(event) event binding` | marker | — out-of-scope | — |
| `*ngIf structural directive` | children | — out-of-scope | — |

### Gap list — constructs the recipe model cannot express (the standard increment)

| construct | nature | reason | note |
| --- | --- | --- | --- |
| `@if (cond) { … }` | children | unclaimed | no bundle recipe declares static open "@if" |
| `@else { … }` | children | unclaimed | no bundle recipe declares static open "@else" |
| `@else if (cond) { … }` | children | unclaimed | no bundle recipe declares static open "@else if" |
| `@for (item of items) track item { … }` | children | unclaimed | no bundle recipe declares static open "@for" |
| `@empty { … }` | children | unclaimed | no bundle recipe declares static open "@empty" |
| `@switch (expr) { … }` | children | unclaimed | no bundle recipe declares static open "@switch" |
| `@case (val) { … }` | children | unclaimed | no bundle recipe declares static open "@case" |
| `@default { … }` | children | unclaimed | no bundle recipe declares static open "@default" |
| `@defer { … }` | children | unclaimed | no bundle recipe declares static open "@defer" |

