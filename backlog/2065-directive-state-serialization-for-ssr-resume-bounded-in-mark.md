---
kind: story
size: 3
parent: "2005"
status: open
blockedBy: ["2064"]
dateOpened: "2026-07-01"
tags: []
---

# Directive-state serialization for SSR resume — bounded in-marker framework tokens + data-key keys

Third slice of the SSR surface (per #2030). Serialize per-region framework state so the client hydrates without re-deriving it: bounded framework-owned tokens in the start marker (chosen branch, item count, static key hashes) and per-item keys onto data-key attributes (the spec-mandated diffing surface). Two hard, standard-fixed constraints for every renderer: (1) data-key carries keys; (2) NEVER serialize raw user data into comment text — HTML comments cannot contain --> so raw values break out and desync the pure-string parser (injection). Encode/reject --/> in any token. The bytes are standard (extend #2063 vectors).
