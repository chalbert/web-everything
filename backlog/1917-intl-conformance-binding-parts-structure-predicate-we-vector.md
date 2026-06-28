---
kind: story
size: 3
parent: "1294"
status: resolved
blockedBy: ["1914"]
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: "fui:intl/intlConformance.ts"
tags: []
---

# intl conformance binding (parts-structure + predicate) + WE vector corpus

Slice 2 of the intl relocation cascade (#1294). Write the one-screen intl conformance binding that drives fui:intl and observes formatToParts for Number/DateTime/RelativeTime and Collator compare(), plus its WE vector corpus in we:conformance-vectors/. Per #1816: parts-structure matcher for the formatters, predicate (sign/order) for Collator — using the shared #1847 matcher mechanism. Mirrors webpolicy W2 (#1800).
