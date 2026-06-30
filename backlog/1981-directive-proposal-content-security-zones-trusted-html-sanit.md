---
kind: decision
parent: "1975"
status: open
dateOpened: "2026-06-29"
tags: []
---

# Directive proposal — content-security zones (trusted-html / sanitize-content)

Net-new directive candidate (#1975 catalog). A region-level content policy: trusted-html enforces Trusted Types on a content zone; sanitize-content runs the Sanitizer API (or DOMPurify) over a user-content zone. Novel and genuinely directive-shaped (policy over a region, not a connected-element behavior). Both proposed in the webdirectives spec; substrate is the native Sanitizer API. Decide at the #1963 bar.

## Example (proposed authoring)

```html
<!-- run untrusted content through the Sanitizer before it lands -->
<!-- security:sanitize policy="strict" -->
  ${commentBody}
<!-- /security:sanitize -->

<!-- enforce Trusted Types on a content zone -->
<!-- security:trusted-html -->
  ${policyApprovedMarkup}
<!-- /security:trusted-html -->
```

- **Substrate:** the native **Sanitizer API** (`Element.setHTML()` / `setHTMLUnsafe()`) and **Trusted Types** — the directive is a declarative wrapper that applies the policy to the bounded region.
- **Why a directive (not a behavior):** it governs *how a region's content is admitted* (a pre-insertion content policy), not a connected element's behaviour — and it must act before the content materializes.
- **Form: Ⓣ template** — hold the raw content **inert**, run the policy (Sanitizer / Trusted Types), *then* stamp; admit-after-policy is exactly the inert-hold `<template>` gives. A comment form would admit live content before sanitizing.
