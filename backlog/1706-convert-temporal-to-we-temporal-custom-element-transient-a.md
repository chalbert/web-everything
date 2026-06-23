---
kind: task
parent: "1442"
status: open
dateOpened: "2026-06-23"
locus: frontierui
relatedProject: webcomponents
tags: [packaging, custom-elements, block-model, conversion, transient-element, temporal, frontierui]
---

# Convert temporal to we-temporal custom element (transient/A)

Package the temporal block as a transient custom element per the #1675 ruling (mechanism A, codified §7). Each preset registers a tag (we-date-picker / we-time-picker / we-datetime-picker, or we-temporal) that self-replaces with the single native input it pins (<input type="date|time|datetime-local">) via the TransientElement pattern; the CalendarGrid/Clock/RangeCoordination CustomAttribute behaviors keep riding the surviving native input unchanged. Native form participation, validity, locale value, and the zero-JS fallback are kept free. No persistent wrapper or imperative property surface (B is excluded). Mirror the badge/button/card convert tasks.
