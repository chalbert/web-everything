---
kind: story
size: 3
parent: "1783"
status: open
dateOpened: "2026-06-26"
tags: []
---

# WE clock-optional synchronous ConformanceBinding variant

Make the #899 ConformanceBinding usable by a facts→verdict (synchronous, no-DOM) standard without temporal machinery. we:conformance-vectors/schema.ts:21-27 already models synchronous vectors (clock offset omitted = synchronous); only we:conformance-vectors/binding.ts:24-39 forces a required clock field. Make clock optional (or ship a no-op SynchronousClock), confirm the schema/validator synchronous path, and add a synchronous-binding test alongside we:conformance-vectors/__tests__/. Generic foundation — no subsystem-specific code.
