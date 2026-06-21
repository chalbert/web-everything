---
kind: task
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/windowed-collection.json"
tags: []
---

# Add the APG-cited load-more-default note to windowed-collection.dataSource (optional UX-policy anchor from #1398)

Optional-but-tracked follow-up ratified by #1398: land one additive designDecision-style note on we:src/_data/intents/windowed-collection.json dataSource — 'for dataSource: infinite, load-more is the a11y-safe default per the WAI-ARIA APG Feed pattern; pure auto-advance infinite scroll is discouraged. Advisory, not restrictive — dataSource: infinite with auto-advance stays fully supported (pagination.mode: append × advance: auto).' Makes the load-more UX policy citeable to authors + machine-visible to generators/conformance/design-ref. Wording/home is editorial (could sit on a pagination designDecision instead).
