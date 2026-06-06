---
type: idea
status: open
dateOpened: '2026-06-01'
tags:
  - dropdown
  - async
  - pagination
  - windowed-collection
  - loader
relatedReport: reports/2026-06-01-dropdown-ux-behaviors.md
relatedProject: webintents
---

# Specify async pagination beyond load-more for the dropdown family

The dropdown UX research materialized 13 cross-cutting paradigms into intents but flags one genuinely unspecified: async pagination beyond simple load-more — cursor vs offset, "load earlier", and windowing + async combined. The async-collection lifecycle (loader's filtering/loadingMore axes) currently covers only the load-more case; the deeper combined paradigm (windowed-collection composed with async) would need its own contract if the standard requires it. Noted but not specified.
