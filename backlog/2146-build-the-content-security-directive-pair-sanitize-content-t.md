---
kind: story
size: 5
parent: "1975"
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Build the content-security directive pair (sanitize-content + trusted-html typed templates)

Implement the #1981-ratified pair: <template type="sanitize-content"> runs the native Sanitizer API (Element.setHTML(), DOMPurify only as fallback) over an inert-held region before stamping; <template type="trusted-html"> admits only TrustedHTML values into the zone (region-scoped approximation of page-level Trusted Types — the thinner of the pair, per the ruling's held red-team). Form per #1983 (typed template, fail-closed); type-value spellings per #1987. Binding fence: the directive invokes the native policy only — declarative configs/policy names fine, author-supplied transform functions barred. Also update the spec's Security Directives stub wording (DOMPurify → native-first).
