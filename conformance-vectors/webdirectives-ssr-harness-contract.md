# Web Directives SSR conformance-vector harness contract

Pins how *any* renderer — in any language — is graded against
[`webdirectives-ssr.vectors.json`](./webdirectives-ssr.vectors.json), the language-neutral export of
[`webdirectives-ssr.vectors.ts`](./webdirectives-ssr.vectors.ts) (#2354, the foundational slice #2069's
per-language renderer sub-epics depend on). WE owns the vectors + this contract (rule #6, OK-in-WE data +
validate-script work); WE ships **no renderer** — the FUI Node renderer (#2064) is the reference oracle,
later per-language renderers (#2069) are graded the same way.

## The file

`webdirectives-ssr.vectors.json` is a generated, committed projection of the TS suite — regenerate it with
`npm run gen:webdirectives-ssr-vectors` (`scripts/gen-webdirectives-ssr-vectors.mjs`); a vitest drift test
(`__tests__/webdirectives-ssr-export.test.ts`) fails CI if the committed file and the TS source disagree, so
it can never go stale.

```json
{
  "standard": "webdirectives",
  "contract": "@webeverything/contracts/webdirectives",
  "vectors": [
    {
      "id": "webdirectives-ssr/<directive>/<case>",
      "description": "human-facing note on what the vector proves",
      "input": "the <template is=…> authoring source, as a string",
      "data": { "...": "the resolved render context — a plain JSON object" },
      "expectedHtml": "the exact HTML bytes a conformant renderer MUST emit"
    }
  ]
}
```

- `standard` / `contract` are corpus metadata (always `"webdirectives"` / `"@webeverything/contracts/webdirectives"`
  today — a harness reads them, it does not need to hard-code them).
- `input` is the authoring source (a `<template is="…">` directive region), never already-expanded output.
- `data` is a plain JSON value — every vector in this suite ships a JSON object (never `null`, an array, or a
  primitive) — the render context the renderer evaluates `input` against.
- `expectedHtml` is the oracle: the exact bytes a conformant renderer emits for that `(input, data)` pair.

## The grading protocol (byte-for-byte)

For every vector in the array, a conformance harness MUST:

1. Invoke the candidate renderer with `input` (the directive-region source) and `data` (the render context)
   and capture its emitted output as a string.
2. Compare that output to `expectedHtml` with **strict byte/codepoint equality** — not semantic HTML
   equivalence, not a DOM diff, not whitespace-insensitive comparison. A single differing byte (including
   marker space-padding, line endings, or attribute-quote style) is a **failure**, not a near-pass.
3. Decode/encode both sides as **UTF-8**. No trimming, no normalization (NFC/NFD, case-folding, attribute
   reordering) on either side before comparing.
4. Treat every vector independently — the suite has no ordering dependency and no shared renderer state
   across vectors (each is a fresh `(input, data) → output` call).
5. Report **all** failing vector `id`s, not just the first — a harness run's result is
   `{ passed: string[], failed: { id: string, got: string, want: string }[] }` or equivalent; a renderer is
   conformant iff `failed` is empty.

Nothing beyond producing `expectedHtml` bytes from `(input, data)` is graded here — the wire-format grammar
itself (marker space-padding, `data-key`, the `count`/`key-hash`/`condition`/`value` state-token layout) is
already baked into `expectedHtml`; a harness does not need to re-derive or separately validate it (that is
`assertSsrWireSuite`'s job on the WE/TS side, already run before this file is generated — see
`webdirectives-ssr.vectors.ts`).

## Reference: the `key-hash` algorithm

`expectedHtml` already carries the correct `key-hash` value for every non-empty keyed `for-each` vector, so
a harness never needs to compute it to grade a renderer — byte comparison against `expectedHtml` is
sufficient. It is documented here only so a renderer *implementation* (not the harness) can reproduce the
same value: `key-hash` is the lowercase, zero-padded 8-hex-digit DJB2 hash (32-bit, unsigned) of the
comma-joined projected key strings, in list order. **The hash input is UTF-16 code units, not UTF-8
bytes** — the canonical implementation is JavaScript's `String.charCodeAt`, so a non-ASCII key (any code
point above U+007F) hashes differently than a naive "hash the UTF-8 bytes" port would produce; a renderer
in another language MUST decode each key to UTF-16 code units (astral-plane characters as a surrogate
pair — two 16-bit units) before folding them into the hash, or it will silently diverge from
`expectedHtml` on any vector with a non-ASCII key. Pseudocode (language-neutral):

```
h = 5381
for each UTF-16 code unit u in utf16(comma_joined_keys):   # NOT UTF-8 bytes
    h = ((h << 5) + h) XOR u   # h * 33 XOR u
    h = h & 0xFFFFFFFF          # keep to 32 bits, unsigned
key_hash = lowercase_hex(h), left-padded with '0' to 8 digits
```

The canonical TS implementation is `djb2KeyHash` in `webdirectives-ssr.vectors.ts`, unit-tested in
`__tests__/webdirectives-ssr.vectors.test.ts`. All current golden vectors use ASCII-only keys, where UTF-16
code units and UTF-8 bytes coincide — the distinction is latent until a future vector introduces a
non-ASCII key.

## Non-goals

- This contract does not grade renderer *internals* (DOM shim vs. string concat vs. template engine) — per
  `docs/agent/platform-decisions.md#ssr-external-io-standard-renderers-conform`, only externally-observable
  output is standardized; how a renderer produces it is a conforming black box.
- This contract does not cover client hydration — only the server-emitted wire-format bytes. Hydration
  handshake vectors are a separate concern (#2063 lineage).
