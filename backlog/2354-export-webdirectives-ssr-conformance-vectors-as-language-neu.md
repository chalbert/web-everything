---
kind: story
size: 3
parent: "2069"
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "conformance-vectors/webdirectives-ssr.vectors.json + conformance-vectors/webdirectives-ssr-harness-contract.md (#2354)"
tags: []
---

# Export webdirectives SSR conformance vectors as language-neutral data + a cross-language grading harness contract

Emit the WE-owned SSR golden vectors (today TS-only, we:conformance-vectors/webdirectives-ssr.vectors.ts) as language-neutral JSON — input + data + expectedHtml bytes — and pin the harness contract by which any non-JS renderer is graded byte-for-byte against them. WE data + validate-script work (WE #6, OK-in-WE), not renderer impl. The foundational slice every per-language renderer sub-epic (#2069) depends on.
