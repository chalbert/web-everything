---
kind: decision
parent: "1971"
status: open
preparedDate: "2026-07-01"
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
relatedReport: reports/2026-07-01-2030-ssr-hydration-directive-regions.md
tags: [webdirectives, ssr, hydration, comment-anchor, composition]
---

# Foundational SSR + hydration surface for comment-anchor directive regions

**Prepared — five live forks (one collapsed to a config-dimension by the skeptic pass was *restored*).**
Design the SSR + client-hydration surface for comment-anchor (`CustomComment`) directive regions — the
foundational call [#2005](/backlog/2005-ssr-hydration-of-comment-anchor-directive-regions/) is blocked on.
This is a **true greenfield gap**: no SSR surface exists in FUI today (`fui:plugs/webdirectives/` is parse +
*client-DOM* lifecycle only — no server renderer, no hydration hook), so there is neither a design nor an
impl to inherit. The forks below are grounded in a prior-art survey published as the
[`/research/directive-ssr-hydration-surface`](/research/directive-ssr-hydration-surface/) topic (Lit SSR,
DOM Parts `ChildNodePart`, Qwik/Marko resumability, Astro islands / RSC) and attacked by a refute-only
skeptic sub-agent; the session report is linked via `relatedReport`. Each recommended default is in **bold**.

> **Prep note — the skeptic reversed two demotions.** An initial pass tried to (i) settle Fork 2 (marker
> grammar) on the #1971 precedent and (ii) demote Fork 5 (streaming/lazy) to a config-dimension of the
> prepared #1977 `defer` directive. The skeptic **REFUTED both** on grounded facts: #1971's DOM-Parts note is
> explicitly *"not adoption"* (`fui:plugs/webdirectives/directiveLifecycle.ts:39-40`) so it cannot *settle* a
> grammar, **and** the runtime emits only the `:start`/`:end` grammar while the inspector *also* accepts a
> second spec-side `open-close` grammar with **no** runtime emitter — a real duality SSR must resolve; and
> #1977 has **no implementation** (`grep` of `fui:plugs/webdirectives/*.ts` finds no defer directive), so a
> fork cannot be demoted to "config of" a mechanism that doesn't exist. Both are restored as `## Fork N`
> below. So: **five genuine forks**, each with a bold default.

## Grounding — the gap is real (FUI)

The webdirectives plug is parse + live-`document` lifecycle only:

- `fui:plugs/webdirectives/CustomCommentRegistry.ts:75-83` — `upgrade(root)` drives the entire lifecycle
  through `document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)`; hard dependence on a live `document`.
- `fui:plugs/webdirectives/directiveLifecycle.ts:100-129` — `connectDirectiveTree`/`disconnectDirectiveTree`
  call `surfaceDirectiveRegions(root)` (a TreeWalker) and invoke hooks on live nodes.
- `grep -niE "renderToString|hydrat|server.?render|ssr" fui:plugs/webdirectives/*.ts` (minus tests) →
  **zero matches.** Confirmed true gap.
- `we:src/_includes/project-webdirectives.njk:455-500` describes SSR only as a **contract** (Server MUST
  evaluate data & emit templates; streaming loading-first; client uses comment boundaries as delimiters;
  `data-key` keyed diffing; zero-JS baseline) and delegates impl to "the build system or server framework."

Two existing pieces make the server path cheap and anchor the defaults:

- `fui:plugs/webdirectives/CustomCommentParser.ts:50-77` — `DefaultCommentParser` is **pure string parsing,
  no DOM** (`namespace:name option="v"` open; `/namespace:name` close). Already off-DOM-capable.
- The **runtime marker grammar** is emitted with space-padding by the three directives:
  `fui:blocks/for-each/ForEachBehavior.ts:147-148` (`for-each:start (expr)` / `for-each:end`),
  `fui:blocks/view/ViewIfDirective.ts:85-86` (`view-if:start`/`view-if:end`),
  `fui:blocks/view/ViewSwitchDirective.ts:77-78`. The inspector reads these:
  `fui:plugs/webdirectives/directiveInspector.ts:97-138`.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1 — server-render architecture** | **Build the tree via a DOM shim, then serialize to string** (reuse the client stamp/lifecycle path) | Bespoke off-DOM string `renderToString` | med — shim fidelity/perf vs. one-codepath drift-avoidance |
| **Fork 2 — marker grammar** | **Emit the runtime's `:start`/`:end` padded grammar; SSR is the canonical emitter and the `open-close` grammar is a hydration-only accepted alias** | Emit the spec's `open-close` grammar | med — the `:start/:end`↔`open-close` duality is the real call |
| **Fork 3 — state serialization** | **In-marker for framework tokens (branch/len/hashes); per-item keys → `data-key` attributes; never raw user data in comment text** | Side-channel `<script type="application/json">` blob | med-high — escaping/size guards decide it |
| **Fork 4 — hydration hook** | **`hydrate(root)` adopt path sharing `upgrade`'s idempotency set** (adopt-without-stamp when content present) | discard-and-re-stamp | high — adopt is the whole point of SSR |
| **Fork 5 — streaming / lazy hydration** | **Reuse `hydrate()` + (future) #1977 triggers for the eager/deferred *dimension*, and separately decide open-region (no-`:end`-yet) streaming: block-until-`:end`** | progressive open-region adoption | low-med — streaming-partial is orthogonal to #1977 |

## Fork 1 — server-render architecture: DOM-shim reuse vs. bespoke `renderToString`

*Why it's a fork (case b, real either/or):* both branches are coherent and **cannot coexist** — you build one
server render path. Branch A builds the region tree via an off-DOM DOM implementation reusing the client stamp
logic, then serializes; branch B writes a separate string-concatenating renderer that re-derives the stamp
logic. Composability-probe (build B as a facade over A) *fails*: B by construction re-implements what A
reuses.

*Crux:* the whole directive lifecycle — `upgrade`/`connect`/`refresh`/the inspector — is written against DOM
`Node` APIs (`createTreeWalker`, `insertBefore`, `nextSibling`), `fui:plugs/webdirectives/CustomCommentRegistry.ts:75`,
`fui:plugs/webdirectives/directiveInspector.ts:141-171`. That code is the *value*; only the `document` global
stops it running server-side.

- **(a) Build the tree via a lightweight DOM shim, then serialize to string** *(default)* — supply a minimal
  server `document`/`Node` (linkedom-class) so `upgrade(root)` + the stamp logic run unchanged, then
  `outerHTML`/serialize the result. **The shim is an intermediate, not the output** — the fork is really
  "tree-via-shim → serialize" vs. "concatenate strings." **One code path** renders on both sides, so server
  and client can never drift on what a region *means*; nested composition (a `view-if` inside a `for-each`)
  works for free because the same recursion runs. Cost: shim dependency; perf (a full DOM tree per request is
  heavier than string concat under load — *inference*); and **fidelity risk** — the shim must reproduce
  `createTreeWalker(SHOW_COMMENT)` order and the exact comment **space-padding**
  (`fui:blocks/for-each/ForEachBehavior.ts:148` emits `` for-each:end `` with surrounding spaces).
- **(b) Bespoke off-DOM string `renderToString`** — a dedicated renderer that concatenates marker + content
  strings, no DOM. Faster, dependency-free, but **duplicates** the stamp logic the three directives already
  encode in DOM terms (two impls to keep in sync — the SSR/client-drift bug Lit's shared-path design avoids)
  and re-solves nesting/ownership.

**Default: (a) shim → serialize** — the one-code-path correctness win (no server↔client semantic drift;
nested composition inherited) outweighs the shim dependency; it's how the field's proven adopt-based renderer
(Lit SSR) is built. (b) stays viable as a later per-hot-path perf optimization.

**Placement guard (WE #6 boundary):** the render path must be a **plug-provided capability the host framework
invokes** — not FUI shipping a server — since the WE spec deliberately externalizes SSR to "the build system
or server framework." Ship it as a callable in the plug, not a server binary.

`Skeptic:` SURVIVES-WITH-AMENDMENT → the "one code path is free" framing was overstated; amended. (1) Reframed
the fork as **shim → serialize** (a shim is an intermediate; the perf objection was otherwise hidden).
(2) Added a **byte-identical marker conformance test** requirement (shim output incl. space-padding must match
`ForEachBehavior`/`ViewIfDirective` live output) — without it "reuse" is unproven. (3) Added the WE-#6
placement guard (plug capability, not a server). Default holds.

## Fork 2 — marker grammar: `:start`/`:end` vs. `open-close`, and the duality SSR must resolve

*Why it's a fork (case b, real either/or):* the runtime emits **exactly one** grammar
(`fui:blocks/for-each/ForEachBehavior.ts:147`, `fui:blocks/view/ViewIfDirective.ts:85`,
`fui:blocks/view/ViewSwitchDirective.ts:77` — all `:start`/`:end`), but the inspector/parser **accept two**:
that `:start`/`:end` runtime convention **and** the spec/parser `open-close` convention
(`<!-- control:if … -->`…`<!-- /control:if -->`, `fui:plugs/webdirectives/directiveInspector.ts:27-34`,
`fui:plugs/webdirectives/CustomCommentParser.ts:65-77`) — which **no runtime code emits**. SSR must emit *one*
wire grammar, and the two accepted dialects are coherent rivals for that role — a genuine either/or.

*Why it is NOT settled by #1971 (citation-scope correction):* `fui:plugs/webdirectives/directiveLifecycle.ts:39-40`
carries a *"DOM Parts alignment (**note, not adoption**)"* block — verbatim: *"an alignment note to keep the
convention forward-compatible; the module does not depend on or adopt the DOM Parts API."* An alignment note
is forward-compat insurance, **not** a ratification of the grammar as the SSR wire format — and #1971 slice E
(SSR) was itself *deferred*. Citing a deliberate non-commitment as the authority that *closes* this fork
inverts its meaning (the *"an alignment note ≠ a ratified shape"* naming-fork discipline). What #1971 *does*
bind is narrow: keep the convention `ChildNodePart`-forward-compatible.

- **(a) SSR emits the runtime `:start`/`:end` padded grammar; treat `open-close` as a hydration-only accepted
  alias** *(default)* — SSR output is byte-identical to what the live directives produce, so a server-rendered
  region and a client-rendered one are indistinguishable and the Fork-4 `hydrate()` path reconstructs both
  identically. The `open-close` grammar stays *accepted* on the hydration read path (spec-authored HTML still
  hydrates) but is **not** what SSR emits. Rationale: the runtime is the only existing *emitter*, and matching
  it keeps one wire truth; it's already `ChildNodePart`-forward-compatible.
- **(b) SSR emits the spec's `open-close` grammar** — SSR is contract-driven and the spec doc's examples use
  `control:if`…`/control:if`, so emitting the spec's native tongue is defensible. **Rejected** as the default:
  it diverges from every live emitter, so a hydrating client would meet a grammar no client behavior produces,
  forcing the adopt path to reconcile two dialects on the hot path for no gain.

**Default: (a)** — SSR is the canonical emitter of the *runtime* grammar; `open-close` remains an accepted
hydration-read alias, not an emit target. On ratification, codify which grammar SSR **emits** vs. **accepts**
(the emit/accept split is the actual thing settled here) and note the space-padding is normative.

`Skeptic:` REFUTED (initial "settled-by-#1971") → **restored to a live fork.** The skeptic verified the runtime
emits only `:start`/`:end` while the inspector also accepts `open-close` with no emitter — the real duality —
and that #1971's DOM-Parts note is explicitly non-adoption (so it cannot settle the grammar). Fork restored;
default kept (`:start/:end`), now framed as an **emit-vs-accept** decision with the padding made normative.

## Fork 3 — directive-state serialization: in-marker (bounded) vs. side-channel blob

*Why it's a fork (case b, real either/or):* two coherent, mutually-exclusive encodings of per-region state
(the `for-each` keys/length, the `view-if`/`view-switch` chosen branch) so hydration resumes without
re-deriving it. You pick one wire format; a facade of one over the other buys nothing (rival *formats*).

*Crux:* the marker grammar already carries an expression tail + option tokens the parser reads
(`fui:plugs/webdirectives/directiveInspector.ts:116-134`, `fui:plugs/webdirectives/CustomCommentParser.ts:50-57`),
**but** the WE spec mandates `data-key` **attributes** on `for-each` items for keyed reconciliation
(`we:src/_includes/project-webdirectives.njk:476`) — element attributes, not comment text. And the parser was
built to read *trusted authored* markers, not to carry *serialized user data* safely.

- **(a) In-marker for framework-controlled tokens; keys to `data-key` attributes** *(default)* — serialize
  only framework-owned tokens into the start marker (chosen branch, item count/length, static key *hashes*):
  e.g. `<!-- view-if:start (@show) branch="then" -->`, `<!-- for-each:start (@users) len=3 -->`. Route
  per-item **keys onto `data-key` attributes** of the stamped elements (exactly the spec's mandated diffing
  surface), **not** into the comment. Keeps state region-local (composes with nesting) and spec-aligned.
- **(b) Side-channel `<script type="application/json">` blob** — a Qwik-style reference-keyed state document
  read by region id. Compact for large/shared state, immune to comment-escaping, but adds a second parse
  surface + an id-correlation scheme the inspector/lifecycle lack, and decouples state from its region.

**Escaping guard (load-bearing):** HTML comments cannot contain `-->` and `--` is invalid inside a comment, so
serializing raw user keys (`@users` values) into the comment tail can **break out of the comment** →
parser desync/injection (the parser is pure-string and will mis-tokenize). So **never serialize raw user data
into comment text** — bound the tail to framework tokens + static hashes, encode/reject `--`/`>` in any token,
and let per-item keys ride `data-key` attributes (which have well-defined escaping). The blob (b) is the right
escalation *only* if a region proves to need state too large/shared for attributes — a later, measured move.

**Default: (a) bounded in-marker + `data-key` keys** — reuses the parser/inspector, stays region-local, and
aligns with the spec's own `data-key` diffing surface, while the escaping guard closes the injection hole.

`Skeptic:` SURVIVES-WITH-AMENDMENT → the naive "serialize keys into the comment tail" default was unsafe and
spec-contradicting; amended. (1) Route per-item **keys to `data-key` attributes** (spec-aligned, escaping-safe)
instead of the comment. (2) **Never** put raw user data in comment text; bound the tail to framework tokens +
static hashes with a `--`/`>` escaping guard. Default (in-marker) holds for framework-controlled state.

## Fork 4 — client hydration hook: recognize-and-adopt vs. re-stamp

*Why it's a fork (case b, real either/or):* two coherent boot behaviors that cannot both be default — a
booting directive either **adopts** the server-stamped nodes (bind lifecycle/refresh, skip re-render) or
**discards and re-stamps**. Re-stamp is the naive path and it's *wrong* for SSR (FOUC, lost server work,
doubled DOM), but a real alternative worth excluding on the record.

*Crux:* the current boot path is `upgrade(root)`
(`fui:plugs/webdirectives/CustomCommentRegistry.ts:75-116`), which re-prototypes a comment and calls
`connectedCallback` with **no notion** that content may already exist between the markers. The registry
*already* has the machinery adoption needs: a `#upgraded` `WeakSet` for idempotency
(`fui:plugs/webdirectives/CustomCommentRegistry.ts:54`), a `downgrade` inverse
(`fui:plugs/webdirectives/CustomCommentRegistry.ts:90`), and a skip-if-already-upgraded guard
(`fui:plugs/webdirectives/CustomCommentRegistry.ts:104`).

- **(a) `hydrate(root)` adopt path sharing `upgrade`'s idempotency set** *(default)* — a new registry method
  that walks the same `SHOW_COMMENT` markers, and for each region with content already present between
  `start`/`end` (+ serialized state per Fork 3), **binds** lifecycle/refresh to the existing nodes and marks
  the region hydrated (into the **same** `#upgraded` set), skipping re-stamp. Defined as
  *"upgrade-without-stamp when content is present."* Mirrors `upgrade`'s shape (one added method,
  non-invasive #606); matches Lit's `hydrate()`. Nested regions adopt via the existing `connectOrder` tree
  (`fui:plugs/webdirectives/directiveLifecycle.ts:79-89`).
- **(b) discard-and-re-stamp** — client ignores server content, re-runs `upgrade` fully. Trivial, but forfeits
  every SSR benefit. **Rejected** as default; kept as the degenerate fallback when serialized state is
  absent/corrupt (mismatch → re-stamp, like Lit's digest-mismatch fallback).

**Default: (a) `hydrate(root)` adopt path** — adopt is the entire purpose of the SSR surface.

`Skeptic:` SURVIVES — beat the double-connect attack: `hydrate()` and `upgrade()` must **share** the
`#upgraded` idempotency set (both key on the comment node) or a region connects twice / stamps over live SSR
content. Amended into the default: `hydrate` is *"upgrade-without-stamp when content present,"* using the same
WeakSet. Machinery already exists (`fui:plugs/webdirectives/CustomCommentRegistry.ts:54,90,104`).

## Fork 5 — streaming / lazy hydration: eager/deferred dimension + open-region streaming

*Why it's a fork (case b, real either/or):* an initial pass tried to demote this to a config-dimension of the
prepared #1977 `defer` directive. The skeptic **REFUTED** it: (i) #1977 has **no implementation** in the plug
(`grep` finds no defer directive), so a fork cannot be "config of" a mechanism that doesn't exist; and (ii)
**streaming** raises a question #1977 does not answer. #1977's triggers govern *when a client region
connects* (idle/visible/…). **Streaming hydration** governs *regions whose closing `:end` marker hasn't
arrived in the byte stream yet* — and the inspector reconstructs a region only from a **complete
`start`…`end` pair** (`fui:plugs/webdirectives/directiveInspector.ts:185-239`), so a streamed region with no
`:end` yet is un-reconstructable. That is a real either/or, orthogonal to #1977's trigger config.

*Two sub-axes:*
1. **Eager/deferred *dimension* (contract-derived).** Per-region eager-vs-deferred hydration reuses the
   Fork-4 `hydrate()` hook + the *future* #1977 triggers — `hydrate(root)` honours a region's `defer` trigger
   where present (adopt on trigger instead of on boot). This part is a configuration, not a rival — but it
   **depends on #1977 landing** and must not assume it exists today.
2. **Open-region streaming (the genuine either/or #1977 doesn't cover):**
   - **(a) block-until-`:end`** *(default)* — the client waits for a region's closing marker before
     reconstructing/adopting it. Simple, always-consistent, matches the inspector's complete-pair assumption;
     the server can still stream *earlier* regions first (streaming SSR: loading template first,
     `we:src/_includes/project-webdirectives.njk:461`). The cost is a region can't hydrate before its `:end`
     byte arrives.
   - **(b) progressive open-region adoption** — adopt a region incrementally as its body streams, before
     `:end`. Faster time-to-interactive for large regions, but requires the inspector/hydrate path to handle
     un-terminated regions (a new pending-region state) — a substantially larger mechanism.

**Default: sub-axis 1 = reuse `hydrate()` + future #1977 triggers (gated on #1977); sub-axis 2 =
(a) block-until-`:end`.** Streaming SSR (server emits earlier regions first) delivers most of the benefit
without the open-region complexity; progressive adoption (b) is a later escalation if a real large-region
case demands it.

`Skeptic:` REFUTED (initial config-dimension demotion) → **restored to a live fork.** The demotion's premise
was false (#1977 unbuilt) and streaming-partial-region hydration is orthogonal to #1977's connection triggers.
Restored with two sub-axes: the eager/deferred *dimension* (reuses `hydrate()` + #1977, gated on #1977) and
the genuine open-region either/or (default **block-until-`:end`**, alternative progressive adoption).

---

## Context

Below the divider: the sequencing and codification — not a call the decider originates.

### Sequencing on ratification

A `go` cuts #2005 into agent-ready children in a `blockedBy` chain: **Fork 2 grammar (emit/accept split)** →
**Fork 1 server render (DOM-shim → serialize)** → **Fork 3 state serialization (bounded in-marker +
`data-key`)** → **Fork 4 `hydrate()` adopt (shared idempotency set)** → **Fork 5 streaming (block-until-`:end`;
the deferred-dimension slice is itself `blockedBy` #1977)**. Codification is likely a short webdirectives SSR
note (the emit-vs-accept grammar rule + the padding-normative note + the `hydrate()` adopt contract), not broad
new statute — assess at resolve. Any Technical Configurator option (per-region hydration strategy) spins out at
graduation, not as a fork.

## Definition of ready

All five `## Fork N` carry options + tradeoffs + a **bold default** + a `Skeptic:` line (two of them
`REFUTED → restored`, one `SURVIVES`, two `SURVIVES-WITH-AMENDMENT`). Grounded against the real
`fui:plugs/webdirectives/` + `fui:blocks/` surface and the #1971 forward-compat scope. `preparedDate`
intentionally left unset by the prepare pass (human stamps it or ratifies directly).
