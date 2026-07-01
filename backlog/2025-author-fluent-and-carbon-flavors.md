---
kind: epic
parent: "1226"
status: open
blockedBy: ["2017", "2024"]
dateOpened: "2026-07-01"
tags: [parity, flavor, fluent, carbon, dtcg, epic]
---

# Author full Fluent + Carbon flavors (next parity targets)

## Digest

After shadcn (#2022) and Material 3 (#2023), Fluent and Carbon are the remaining priority parity targets in the
program's sequence (#1226: shadcn → Material → Ant → Carbon → Fluent). Today they exist only as hardcoded ~5-token
workbench presets (`fui:workbench/designSystems.ts:47-90` — `fluent-like`, `carbon-like`), not real flavors. This
epic authors each as a **full** DTCG override, loaded via the #2017 manifest loader, and scored by the parity
harness (#2024).

Epic: one slice per system (Fluent, Carbon), each independently deliverable, reusing the harness + method from the
shadcn/Material slices.

## Scope (to be sliced)

- **Fluent slice**: `we:design-systems/fluent.designsystem.json` + tokens — full Fluent 2 DTCG override
  (solid surfaces, 4px radius scale, `#0f6cbd` accent family, Fluent motion/depth); supersede the `fluent-like` stub.
- **Carbon slice**: `we:design-systems/carbon.designsystem.json` + tokens — full Carbon DTCG override
  (no-radius, compact density, `#0f62fe` accent, IBM type scale); supersede the `carbon-like` stub.
- Each: loads via #2017, scored by #2024, gap list published under `we:reports/…`.

## Acceptance (epic)

- Both child slices resolved; each flavor re-themes the canonical FUI component set to its target look and yields a
  parity score + gap list via #2024.
- The `fluent-like` / `carbon-like` workbench stubs are reconciled (superseded or repointed).

## Notes

- Depends on #2017 (loader) and #2024 (harness). Ant is deferred to a later slice per the #1226 sequence.
