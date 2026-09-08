---
kind: story
size: 3
parent: "2069"
status: open
scope: ["frontierui:plugs/webdirectives/ssr/jvm/", "frontierui:plugs/webdirectives/ssr/net/"]
dateOpened: "2026-09-08"
tags: []
---

# JVM/.NET SSR HtmlParse: fix comment-body and malformed-markup parser-robustness gaps

Port to we:plugs/webdirectives/ssr's landed JVM (#2368) and .NET (#2383) SSR renderer foundations: their HtmlParse.java/HtmlParse.cs share two gaps just found and fixed in the Go foundation's (#2755) own convergence review — a top-level comment is skipped past only one byte instead of its own close, so a directive commented out inside it gets re-scanned as live; and a malformed/unterminated tag-like '<' breaks the whole parse instead of being treated as literal text, silently leaving any later directive unexpanded. Neither is reachable by the WE-owned conformance vectors, so ship unconditional in-repo unit tests mirroring frontierui:plugs/webdirectives/ssr/go/tests/parse_test.go's TestCommentBodyNotParsedAsDirective / TestMalformedMarkupDoesNotAbortParsing, and the fix shape in frontierui:plugs/webdirectives/ssr/go/src/parse.go. Mutation-verify each fix.

## Done when

1. **Executable** — `bash plugs/webdirectives/ssr/jvm/build.sh` and `bash plugs/webdirectives/ssr/net/build.sh` both pass with two new unconditional (non-vector-dependent) tests each: one asserting a top-level `<!-- ... -->` comment whose body contains `<template is="…">`-shaped text is passed through byte-for-byte and never expanded, and one asserting a malformed/unterminated tag-like `<` in ordinary host text does not abort parsing — a directive appearing later in the same source must still be found and expanded. Both fail against the current `HtmlParse.java`/`HtmlParse.cs` and pass after the fix.
2. **Mutation-verified** — reverting each fix reddens its own named test.
3. **Conformance unchanged** — the existing `if`/`switch` vectors still pass byte-for-byte for both languages (neither fix touches graded output; the vectors carry no comments or malformed markup).
