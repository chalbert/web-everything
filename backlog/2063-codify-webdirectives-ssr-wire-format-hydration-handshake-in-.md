---
kind: story
size: 5
parent: "2005"
status: open
dateOpened: "2026-07-01"
tags: []
---

# Codify webdirectives SSR wire-format + hydration handshake in WE, and author language-agnostic conformance vectors

Load-bearing first slice of the SSR surface (per #2030, codified at we:platform-decisions.md#ssr-external-io-standard-renderers-conform). Pin the externally-observable wire format precisely enough that a renderer in ANY language produces conformant output the single JS client hydrates identically: the open-close marker grammar (space-padding normative), data-key keyed diffing, zero-JS baseline, and the state-token layout. Author the WE-owned conformance-vector fixture set — (input directive tree + data) to exact expected HTML bytes — the #817/#899 protocol-plus-vectors, data-not-impl pattern. Everything else in the chain conforms to this.
