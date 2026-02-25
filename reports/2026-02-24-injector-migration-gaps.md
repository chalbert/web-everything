# Research Report — Web Injectors: Plateau Migration Gaps

**Plan file**: User request (IDE review of web injectors vs plateau)
**Research page**: `/research/injector-migration-gaps/`
**Date**: 2026-02-24

---

## Question
What injector features from the plateau project are missing or incomplete in Web Everything's webinjectors?

## Recommendation
8 gaps identified. Migrate in order: Consumable class (unblocks reactive consumption), provider replacement (correctness), Node context methods (developer API), scoped createElement, cloneNode preservation, then the rest as dependencies allow.

## Key Findings

### 8 Gaps Cataloged

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 1 | Consumable class | High — blocks all reactive patterns | Low — 95 lines, self-contained |
| 2 | Node context methods (7 methods) | High — primary consumer API | Medium — depends on webcontexts |
| 3 | Scoped createElement | Medium — injector-scoped elements | Low |
| 4 | cloneNode preservation | Medium — template cloning | Medium — complex tree walk |
| 5 | CustomContext auto-attach | Medium — ergonomic | Low — blocked by webcontexts |
| 6 | Provider replacement | Medium — correctness | Low — claim/unclaim wiring |
| 7 | Window/ShadowRoot entry points | Low-Medium — multi-root | Low |
| 8 | ModuleInjector / InjectableModule | Low — deferred | Low — but needs build tooling |

### What's Already Well-Ported
Core injector hierarchy, HTMLInjector, InjectorRoot lifecycle, HTMLRegistry, getClosestInjector with CustomComment awareness, injectors() generator, creationInjector tracking, consumer WeakRef tracking, claim/unclaim mechanism, plugged/unplugged modes.

## Files Created/Modified
| File | Action |
|------|--------|
| `src/_data/researchTopics.json` | Added `injector-migration-gaps` entry |
| `src/_includes/research-descriptions/injector-migration-gaps.njk` | Created — detailed gap analysis |
| `reports/2026-02-24-injector-migration-gaps.md` | This report |
