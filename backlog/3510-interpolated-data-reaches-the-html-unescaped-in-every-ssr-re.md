---
bornAs: xvw53dm
kind: story
size: 5
status: open
dateOpened: "2026-09-06"
tags: []
---

# Interpolated data reaches the HTML unescaped in every SSR renderer, including the reference oracle

The mustache substitution in `fui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts` writes resolved values
into the HTML with no entity escaping, and every port reproduces it byte-for-byte — verified by execution
that the Python renderer emits `<script>x</script>` verbatim. Wherever an interpolated field carries
user-controlled data, that is SSR XSS. It cannot be fixed per-port: escaping in one renderer alone breaks
byte-exact conformance. The wire format has to rule it, either way, and say so.

## Done when

1. The fork is **ruled and written down**: either the wire format requires entity-escaped interpolation, or it
   explicitly assigns escaping to the caller. Silence is the current state and is what let four independent
   implementations ship the same gap.
2. **If escaping is required** — a vector whose `data` carries `<`, `&` and `"` and whose `expectedHtml` is
   entity-escaped, plus the fix in the reference oracle and all four ports, each graded byte-for-byte.
3. **If it is the caller's responsibility** — that is stated where an implementer reads it (the harness
   contract and each port's README), so the next port does not re-discover it as a finding.

## Why it cannot be fixed per-port

Escaping in one renderer alone changes its bytes and fails the shared vectors. The conformance contract is
what binds the ports together, so it is also the only place this can be decided. Filed from two independent
security jurors on chalbert/frontierui#43 who reached the same remedy without conferring.
