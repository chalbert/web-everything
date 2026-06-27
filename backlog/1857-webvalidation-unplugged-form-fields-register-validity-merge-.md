---
kind: story
size: 3
parent: "1836"
status: open
blockedBy: ["1856"]
dateOpened: "2026-06-27"
tags: []
---

# webvalidation unplugged form-fields — register validity-merge-field/async-validator-field + prove form-associated merge/async resolution unplugged

Re-audit #1840: <validity-merge-field> and <async-validator-field> are customElements.define'd ONLY in fui:plugs/bootstrap.ts:230-243; the form-association capability has no unplugged registration path or test (the unplugged test only resolves default strategies by key). Provide an unplugged registration path and an end-to-end form-associated validity-merge + async-resolution test. Blocked by #1856 (needs the unplugged per-scope injector seam). Locus: FUI. See we:reports/2026-06-27-unplugged-functional-re-audit.md.
