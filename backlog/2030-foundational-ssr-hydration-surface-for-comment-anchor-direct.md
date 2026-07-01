---
kind: decision
parent: "1971"
status: resolved
preparedDate: "2026-07-01"
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#ssr-external-io-standard-renderers-conform"
relatedReport: reports/2026-07-01-2030-ssr-hydration-directive-regions.md
tags: [webdirectives, ssr, hydration, comment-anchor, composition]
---

# Foundational SSR + hydration surface for comment-anchor directive regions

**Reframed — the *external I/O* is a language-agnostic WE standard; *each language's renderer* is a
conforming black box.** This designs the SSR + client-hydration surface for comment-anchor
(`CustomComment`) directive regions that the foundational call
[#2005](/backlog/2005-ssr-hydration-of-comment-anchor-directive-regions/) is blocked on. The original prep
surfaced **five forks**; reviewed against **WE #6** (*WE holds the standard; FUI implements it*) **and** the
cross-language delivery goal (Node now; adapters for most languages/frameworks later, native per-language
for perf), the split is clean: everything **observable across the SSR boundary** — the emitted marker
grammar, `data-key`, the zero-JS baseline, the state-token layout, the hydration handshake — is a **WE
standard concern that every language's renderer must conform to**; everything *internal* to producing that
output (each language's render strategy, adopt-vs-re-stamp, the token-emit mechanism) is **that impl's
call**. That collapses four forks to impl defaults and leaves **one Node-reference build choice**
(server-render strategy — recorded) and **one conformance correction** (the FUI runtime's marker grammar
diverges from the published standard — spun out).

## The external I/O is a language-agnostic WE standard

The WE webdirectives SSR contract is **already at** `we:src/_includes/project-webdirectives.njk:472-504`
and fixes the externally-observable surface:

- **Boundary grammar** = `<!-- control:… -->` … `<!-- /control:… -->` (the `open-close`/slash convention),
  the client's delimiter contract (`:474`).
- **`data-key`** attributes for `for-each` keyed reconciliation (`:475`).
- **Zero-JS progressive baseline** — all structural content fully rendered without JS (`:480-485`).
- **Per-directive server-emit rules** (each row's *"Server MUST evaluate … and emit …"*, `:445-467`).
- Explicit delegation: *"the build system or server framework is responsible … Web Directives does not
  ship an SSR runtime — it ships this specification."* (`:497-504`)

**Rule for this work:** the wire format + hydration handshake must be pinned **precisely enough that a
renderer in any language can produce conformant output the single JS client hydrates identically**. Any
externally-observable I/O this surface introduces that the contract does not yet pin down is **codified
into the WE standard** (`we:project-webdirectives.njk`), never settled per-impl. The SSR *output* is a
standard; every renderer only *conforms*.

## Cross-language delivery — the wire format is the seam

The goal is Node/JS on our sites **now**, with native renderers for most languages/frameworks later (good
perf ⇒ per-language, not a portable shim everywhere). That is what "swappable" really means here:

- **The wire format is the swap boundary.** The one JS **client** hydrates *any* server's output, because
  all servers emit the identical WE-standard grammar/state/`data-key`. A Go, Rust, PHP, or JS server is a
  drop-in replacement behind the same client — no per-language client.
- **Conformance vectors are WE-owned, language-agnostic data** (the `#817/#899` protocol-plus-vectors
  pattern, *not* impl): a fixture set of `(input directive tree + data) → exact expected HTML` (marker
  bytes incl. space-padding, `data-key`, state tokens). **Every** language renderer passes the same
  vectors; that is what makes them interchangeable rather than "reuse the JS code" (which doesn't port).
- **Node is the reference renderer + the vector oracle** — ships first, its output *defines* the vectors,
  and later languages are validated against them. Per-language native renderers are **future adapter
  items** (their own epic), each free to pick its internal strategy for that language's perf; only the
  emitted wire format is fixed.

## Not decisions — conforming black-box implementation (per-impl call, no external observer)

Recorded so each renderer inherits a sane default, but **not ratifiable forks** — nothing across the SSR
boundary can observe the difference, and each language may choose differently:

- **Per-language render strategy** — how a given server builds the region tree before emitting the fixed
  wire format (DOM shim, string concat, template engine…). Same bytes out by conformance. For Node, see
  the reference-renderer choice below.
- **Directive-state resume format** — the *bytes* are standard (bounded framework tokens in the start
  marker + per-item keys on `data-key`); only which internal structure produces them is free. The two
  **standard-fixed constraints** hold for every language: (1) `data-key` carries keys, (2) **never**
  serialize raw user data into comment text (HTML comments can't contain `-->`/`--` → parser
  breakout/injection). Blob side-channel (`<script type="application/json">`) is a later, measured move for
  large/shared state — and if adopted becomes a *standard* addition, not a per-impl one.
- **Client hydration hook** — `hydrate(root)` adopt path sharing `upgrade`'s `#upgraded` idempotency
  WeakSet (*"upgrade-without-stamp when content is present"*), *vs.* discard-and-re-stamp. Re-stamp is
  simply wrong for SSR (FOUC, doubled DOM); adopt is the point — not a real either/or. This is the **one JS
  client**, so it is singular (not per-language); re-stamp stays only as the degenerate fallback on
  absent/corrupt state (Lit's digest-mismatch behaviour).
- **Streaming / lazy** — for open regions (closing `:end` not yet in the byte stream), block-until-`:end`
  before reconstructing (matches the inspector's complete-pair assumption,
  `fui:plugs/webdirectives/directiveInspector.ts:185-239`), *vs.* progressive open-region adoption. The
  standard already permits streaming the loading template first (`:461`); block-until-`:end` is the
  conforming conservative default; progressive adoption is a larger mechanism deferred until a real
  large-region case demands it. The eager/deferred *dimension* (per-region hydrate-on-trigger) reuses the
  hydration hook + the **#1977 `defer` triggers** and is **gated on #1977 landing**. Sequencing, not a
  decision.

## The Node reference-renderer build choice (recorded — deps vs. perf, later-optimizable)

For the **Node** reference renderer only, a deps/perf choice with no external impact (output is
vector-identical either way):

- **(a) DOM-shim → serialize** *(chosen)* — supply a minimal server `document`/`Node` (linkedom-class) so
  the existing `upgrade`/stamp/inspector code — all written against DOM APIs
  (`fui:plugs/webdirectives/CustomCommentRegistry.ts:75`, `fui:directiveInspector.ts:141-171`) — runs
  unchanged, then serialize. Reuses the JS client logic so Node's server and client can't drift, and it is
  the fastest path to a working reference + vector oracle. Cost: a DOM-shim dependency + a full DOM tree
  per request. **This "reuse the client" win is JS-only** and does **not** carry to other languages.
- **(b) Bespoke off-DOM string renderer** — zero-dep, faster, but duplicates the stamp logic. Deferred as a
  later, **data-driven** per-hot-path optimization (measure stats + risk once it's running).

**Recorded: (a) for Node now, behind a swappable `ServerRenderer` seam** so (b) — or any alternative — drops
in without touching callers, and so non-JS renderers sit behind the same seam by construction. **Guarded by
the language-agnostic conformance vectors** (byte-identical markers incl. space-padding
`fui:ForEachBehavior.ts:148`): the seam is safe precisely because every impl behind it must pass the same
vectors. The deps/perf tradeoff between (a) and (b) is explicitly a *later* call with real numbers — not
blocking.

## Conformance correction (spun out, not decided here)

The published standard's grammar is `open-close` (`control:if`/`/control:if`), but the FUI **runtime**
emits a different convention — `:start`/`:end` with a directive-specific namespace
(`fui:blocks/for-each/ForEachBehavior.ts:147`, `fui:blocks/view/ViewIfDirective.ts:85`,
`fui:ViewSwitchDirective.ts:77`), which the inspector also accepts (`fui:directiveInspector.ts:27-34,97-138`).
SSR (every language) must emit the **standard** grammar (WE #6 — the runtime spelling can't override the
published spec). The runtime's divergence is a **pre-existing conformance gap**, independent of SSR — **spin
out as its own runtime-conformance item on resolve**, don't resolve it inside this SSR story.

---

## Context

Below the divider: sequencing and codification — not a call the decider originates.

### On resolve

There is little to *ratify* — the shape is: **(1)** the external wire format + hydration handshake is a
language-agnostic WE standard; **(2)** conformance vectors are WE-owned data; **(3)** Node ships the
reference renderer (shim → serialize, behind a swappable seam) as the vector oracle; **(4)** each language's
render internals are a conforming black box; **(5)** the runtime marker-grammar divergence is spun out.

A `go` cuts #2005 into an agent-ready `blockedBy` chain:

1. **Codify the language-agnostic wire-format + hydration handshake in WE** (`we:project-webdirectives.njk`)
   + **author the conformance-vector fixture set** (WE-owned data, `#817/#899` pattern). *Load-bearing —
   everything else conforms to it.*
2. **Node reference renderer** — DOM-shim → serialize behind a `ServerRenderer` seam; **passes the
   vectors** (byte-identical markers). Is the vector oracle.
3. **State serialization** — bounded in-marker + `data-key` (to spec).
4. **`hydrate(root)` adopt** — shared `#upgraded` idempotency set (single JS client).
5. **Streaming** — block-until-`:end`; the deferred-dimension slice itself `blockedBy` #1977.

Plus, outside the chain: **scaffold the runtime marker-grammar conformance item**, and open a **future
epic for per-language/framework renderers** (native, validated against the vectors) — not part of this
foundational cut. Codify externally-observable I/O into the **WE standard**, never per-impl; the render
internals stay with each impl. Assess the exact standard delta at resolve.

## Definition of ready

The decision surface reduces to a shape (external I/O = language-agnostic WE standard + WE-owned
conformance vectors; renderers conform; Node reference renderer = shim behind a swappable seam) plus a
spun-out conformance correction. The four collapsed forks are recorded as conforming black-box impl
defaults with no external observer. Grounded against the published WE SSR contract
(`we:src/_includes/project-webdirectives.njk:472-504`) and the real `fui:plugs/webdirectives/` +
`fui:blocks/` surface. The externally-observable I/O is a WE standard concern; each renderer is an impl.
