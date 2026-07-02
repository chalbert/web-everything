---
kind: story
size: 5
parent: "2005"
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: "we:conformance-vectors/webdirectives-ssr.vectors.ts"
tags: []
---

# Codify webdirectives SSR wire-format + hydration handshake in WE, and author language-agnostic conformance vectors

Load-bearing first slice of the SSR surface (per #2030, codified at we:platform-decisions.md#ssr-external-io-standard-renderers-conform). Pin the externally-observable wire format precisely enough that a renderer in ANY language produces conformant output the single JS client hydrates identically: the open-close marker grammar (space-padding normative), data-key keyed diffing, zero-JS baseline, and the state-token layout. Author the WE-owned conformance-vector fixture set — (input directive tree + data) to exact expected HTML bytes — the #817/#899 protocol-plus-vectors, data-not-impl pattern. Everything else in the chain conforms to this.

## Resolved (batch-2026-07-01-wf) — normative wire format codified in the WE standard + WE-owned golden vectors

Two WE-side deliverables, no renderer (WE #6 — the renderer is FUI's #2064):

- **Codified the normative wire format** in the WE standard at `we:src/_includes/project-webdirectives.njk#ssr-wire-format` (new "Wire Format (normative — byte-exact)" subsection). Pins the four externally-observable axes precisely: (1) the `open-close` marker grammar with **normative one-ASCII-space padding inside each delimiter** — open `<!-- ns:name options -->`, close `<!-- /ns:name -->`; (2) `data-key` as the **only** key channel for `for-each` keyed diffing; (3) the zero-JS progressive baseline (structural content fully expanded, live branch only); (4) the **state-token layout** — bounded resume tokens in the open marker's options, with the two normative constraints (keys ride `data-key`, never comment text; renderers MUST NOT serialize raw user data into comment text — `--`/`-->` breakout guard). The published grammar is `control:`/`/control:`; the FUI runtime's legacy `:start`/`:end` spelling is the pre-existing conformance gap reconciled separately in #2068.

- **Authored the WE-owned, language-agnostic conformance vectors** at `we:conformance-vectors/webdirectives-ssr.vectors.ts` — a `(input directive tree + data) → exact expected HTML bytes` golden suite (the webdocs-style pure-transform shape, exported on its own from `we:conformance-vectors/index.ts`, not in the behavioral `conformanceSuites`). 7 vectors cover for-each (keyed + empty), if (true + false→empty markers), switch (active case), resource:loader (resolved data inline), defer (placeholder branch). WE ships the vectors + a dependency-free structural + grammar **validator** (`assertSsrWireSuite` / `SsrWireSchemaError`) that enforces the byte-exact marker padding, the `--` breakout guard, and input-is-authoring-source; the renderer/oracle that emits the bytes is FUI's #2064. Schema-validity test: `we:conformance-vectors/__tests__/webdirectives-ssr.vectors.test.ts` (8 — well-formed suite, axis coverage, byte-exact padding on every marker, `data-key` key channel, zero-JS empty-markers, and the validator rejecting bad padding / breakout / output-as-input).

`check:standards` green (0 errors); the new vitest suite green (8/8).
