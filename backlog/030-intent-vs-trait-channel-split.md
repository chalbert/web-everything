---
kind: decision
size: 3
parent: "023"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#intents-ux-only
dateOpened: '2026-06-02'
dateResolved: '2026-06-07'
tags:
  - intents
  - traits
  - droplist
  - di
  - naming
relatedReport: reports/2026-06-02-intent-vs-trait-change-plan.md
relatedProject: webintents
---

# Split intent (ambient preference) from trait selection (local construction)

"Intent" is overloaded across two channels: an ambient, design-owned behavioral preference propagated via DI, vs. a local, developer-owned structural construction of a component. Leaning: keep 'intent' for the ambient/behavioral channel; rename the per-instance bundle to 'trait selection'. Structural dimensions (model, editable, which traits compose) are always local and never travel on the intent channel — so customContexts:droplistIntent="single" is removed, while the app-level droplistIntent survives, narrowed to behavioral preference. Per-dimension resolution: explicit then ambient-intent (behavioral only) then default. Open word choice: 'trait selection' vs 'DroplistConfig'.

## Resolution (2026-06-07)

**Ratified the split as written; the standard term is "trait selection" ("DroplistConfig" dropped — it would re-introduce the overload this item exists to kill).** The `DroplistTraits` vs `DroplistConfig` TS-interface variant is moot: no `composeDroplist` TS code exists yet (report item C13 was "not built yet").

The decision was already fully realized as the canonical standard before this close-out — nothing to build, purely a ratification:

- Sibling [#027](/backlog/027-droplist-trait-language/) graduated the trait-language into [block:droplist]. The live Droplist block page already carries the **"Two channels: ambient intent vs. trait selection"** table, the resolution rule `explicit (local) ⊕ ambient intent (behavioral only) ⊕ trait default` (structural dims stop at `explicit ⊕ default`), and the narrowed behavioral-only `customContexts:droplistIntent`. Report items A1–A7, B8, B10 are reflected there.
- Change-plan item **B9 — glossary entries** was also already present: `we:src/_data/semantics.json` defines **Trait Selection** and **Ambient Intent**, cross-linked.

No code change required (report C11–C13 are future/already-aligned).
