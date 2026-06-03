---
type: decision
status: open
dateOpened: '2026-06-02'
tags:
  - droplist
  - composition
  - architecture
  - traits
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
---

# Resolve remaining droplist composition contracts

Four open contracts from the composition doc's Open Questions, tracked together: (1) Anchor — split surface-binding (behavior) from positioning strategy (DI provider / Floating UI adapter); (2) inter-trait invariants — windowing must not unmount the active option, and async + live-status both write status (enforce via the option collection, not implicit handshakes); (3) trait activation order — selection must connect before focus (the assembler must guarantee order, observed in the split prototype); (4) convenience element granularity — one <drop-list> with dimension attributes vs distinct <auto-complete>/<multi-select> tags. See the report's Open Questions section for the full enumeration.
