---
kind: story
size: 2
parent: "731"
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
tags: []
---

# Document derivation-source as a Web-Docs standard dimension (authored default; impl-scan opt-in)

Document in the WE webdocs standard that catalog derivation-source is a supported dimension: authored manifest = default/reference (the #706 option-B ruling), impl-scan/CEM-from-source = opt-in. Independent doc-only slice; no code. Home: webdocs project page / docs.

## Progress (2026-06-16, batch-2026-06-16) — built

- Added a **"Dimension — Derivation source"** section to the Web Docs project page body ([we:src/_includes/project-webdocs.njk](../src/_includes/project-webdocs.njk)), right after the Custom Elements Manifest protocol section.
- Documents the #706 ruling: derivation-source is a **supported dimension**, not a mandated mechanism. Authored → CEM (#626) = **default/reference**; impl-scan/CEM-from-source = **opt-in**; hybrid = scan-structure + author-prose. All three emit the **same CEM contract**.
- Notes the source-independent **completeness gate** (#706 invariant): the manifest must cover every implemented block family regardless of source.
- Doc-only, no code. **Verified:** `check:standards` green; the section renders at `/projects/webdocs/` (`:8080`).
