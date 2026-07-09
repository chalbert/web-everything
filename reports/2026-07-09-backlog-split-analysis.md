# Backlog split analysis — 2026-07-09

Focused run: `/slice 2069`.

## Candidate

**#2069 — Per-language / per-framework SSR renderers for directive regions** (`kind: epic`, `size: 8`,
`parent: 1971`, `blockedBy: [2064]`, unsliced — no children). A **roadmap / "epic of epics"**: its natural
children are whole native SSR renderers (Go, Rust, PHP, Python, .NET, JVM…), each a multi-story subsystem
build, not a leaf story. So it slices into **sub-epics**, one level down (roadmap mode).

### Readiness — the blocker is satisfied, the design is fully resolved

The epic's body gates it: *"Slice per-language once vectors are stable."* That precondition now holds —
the entire foundational SSR chain under #2005 is **resolved**:

- **#2063** (resolved) — codified the normative wire format + WE-owned golden conformance vectors
  ([we:conformance-vectors/webdirectives-ssr.vectors.ts](conformance-vectors/webdirectives-ssr.vectors.ts),
  `assertSsrWireSuite` validator). The swap seam.
- **#2064** (resolved, the `blockedBy` edge) — Node reference renderer + **vector oracle**, 9/9 byte-exact,
  behind a swappable `ServerRenderer` seam (`frontierui:plugs/webdirectives/ssr/`).
- **#2065 / #2066 / #2067** (all resolved) — state serialization, hydrate-adopt, streaming.
- **#2030** (resolved decision) — ruled that everything *observable across the SSR boundary* is a
  language-agnostic WE standard, and every language's *internal render strategy* is a **conforming
  black box — a per-impl call, explicitly NOT a ratifiable fork**.

So each language renderer is a **pure, fork-free build** against a frozen contract. Home is **FUI impl**
(WE #6 — WE ships no renderer; it owns the wire format + vectors, which #2064 already delivered).

### Could split — YES (roadmap mode: 1 foundational WE story + 6 language sub-epics)

| Slice | kind | size | Home | Scope | blockedBy |
|---|---|---|---|---|---|
| **A. Language-neutral vector export + cross-language conformance-harness contract** | story | 3 | WE | Emit the WE-owned SSR golden vectors (currently TS-only, [we:conformance-vectors/webdirectives-ssr.vectors.ts](conformance-vectors/webdirectives-ssr.vectors.ts)) as language-neutral **JSON** (`input` + `data` + `expectedHtml` bytes), and pin the harness contract by which *any* non-JS renderer is graded byte-for-byte. WE data/validate-script work (rule #6 OK-in-WE), not renderer impl. Unblocks every language. | — |
| **B. Go native SSR renderer** | epic | — | FUI | From-scratch native renderer, all 7 directives, byte-exact wire format, passes the vectors. | A |
| **C. Rust native SSR renderer** | epic | — | FUI | " | A |
| **D. PHP native SSR renderer** | epic | — | FUI | " | A |
| **E. Python native SSR renderer** | epic | — | FUI | " | A |
| **F. .NET native SSR renderer** | epic | — | FUI | " | A |
| **G. JVM native SSR renderer** | epic | — | FUI | " | A |

**DAG (clean fan-out, acyclic):** `A` unblocked now (its deps #2063/#2064 are resolved). `B…G` each
`blockedBy: [A]`; once A lands they proceed **fully independently** (Go never blocks Rust). ≥2 independent
holds maximally.

**Rubric check (sub-epic form (3′)/(5′), roadmap):**
- **(1)** No buried fork — #2030 already ruled per-language render strategy (and the Node deps/perf choice)
  a conforming black box, not a decision. Nothing gated. ✓
- **(2)** ≥2 nameable slices, each a real home. ✓
- **(3′)** Each sub-epic carries **resolved design lineage** as seed (wire format #2063, golden vectors,
  `ServerRenderer` seam #2064, the #2030 black-box ruling) — a real future `/slice` candidate, not a shell.
  The `file:line` bar relaxes for the pure-build sub-epics (their Go/Rust/… surface doesn't exist yet — the
  seams get drawn when each is itself sliced after its language contract is scoped). ✓
- **(4)** Clean acyclic fan-out with genuine independence. ✓
- **(5′)** Each sub-epic leaves the *backlog* in a valid state (a real home for future work); demoable-state
  re-applies one level down. Slice A itself leaves a complete, schema-validated WE artifact. ✓

### Could not split — none

Nothing is design-gated or hides a true GAP: the whole SSR design chain (#2030/#2063–67) is resolved, so
every row is a fork-free build. This is a **full** sub-epic split, not the partial one a still-gated roadmap
would yield.

### Notes / dials for the human

- **Language set is a dial.** The body names Go, Rust, PHP, Python, .NET, JVM. All are fork-free, so all can
  be carved — but you may prefer to seed only a **priority subset now** (e.g. Go + Python + PHP as the
  highest-demand backends) and add the rest as demand appears. Say the word and I'll trim.
- **"Framework" axis stays inside a language sub-epic.** A Next.js / Rails / Spring integration is wiring
  *atop* a language renderer, not a separate renderer — it becomes a story within the relevant sub-epic, not
  a top-level slice here.
- Slice A is the one seam I'm *adding* beyond the body: the vectors are TS-only today, so the first non-JS
  renderer needs them as consumable data + a grading contract. It's the "land foundational slice A first, its
  artifact exposes the seams for the rest" move — and it collapses 6× reinvention into one shared prerequisite.

---

# Appendix — focused run `/slice 2359` (recursion into a language sub-epic)

Slice A above (**#2354** — language-neutral vector export + cross-language harness contract) landed and is
**resolved**, so each language sub-epic is now unblocked and its contract is *scoped*. #2359 is the first to
recurse into. The question here is one level down: does the **Python renderer sub-epic** slice into
stories, or is it atomic?

## Candidate

**#2359 — Native Python SSR renderer for directive regions** (`kind: epic`, no `size`, `parent: 2069`,
`blockedBy: [2354]` — now resolved, unsliced — no children). *Not* a roadmap epic: its natural children
are the layers of **one** renderer, not multiple subsystems — so its slices would be **stories/tasks**,
graded against the story-form rubric (2)–(5).

## Work-investigation pass — the frozen oracle is the whole spec

The Python surface does not exist yet (no `.py` in `frontierui:plugs/webdirectives/`), but — unlike an
un-investigable item — the scope is **fully knowable** by reading the frozen contract it re-derives:

- **The oracle:** `frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts` (266 lines) — the reference
  renderer, built as **one story** (#2064). Its internal shape is the Python port's spec: a driver
  (parse `<template is="…">` source → iterate top-level directives → wrap in space-padded markers → join),
  shared path/mustache resolution (`resolvePath`, `interpolate`), the 7 directive expanders (for-each
  keyed+empty, if, switch/case, resource:loader, defer — ~10–35 lines each), and the state-token layer
  (`djb2KeyHash`, for-each `count`/`key-hash`, if `condition`, switch `value`).
- **The seam:** `frontierui:plugs/webdirectives/ssr/ServerRenderer.ts:33` — a pure `(source, data) → bytes`
  function.
- **The graders:** the 7 WE golden vectors + `assertSsrWireSuite`, exported as language-neutral JSON by
  #2354. Conformance is byte-exact.
- **Key portability fact (from the oracle's own header, lines 6–15):** the Node renderer gets byte-exact
  serialization *for free* by reusing `happy-dom`'s serializer — and that win is **JS-only, does NOT port**.
  A Python native must **hand-roll the parse + a byte-exact serializer** (attribute insertion order,
  double-quoting, `data-key` injection, marker padding) to match the goldens. That hand-rolled
  serializer is the bulk of the effort and risk.

## Verdict — could NOT split (atomic; build as one unit)

| Attempted seam | Rubric result |
|---|---|
| **By layer** (parse/serialize → expanders → state tokens) | **Fails (5).** No intermediate layer passes *any* vector — every one of the 7 goldens exercises a directive, so a driver-without-expanders emits markers with empty bodies and grades red across the board. A half-renderer is the "half an algorithm" broken-intermediate state the DoD forbids. |
| **By directive** (A: parser+serializer+for-each; then if / switch / loader+defer as tails) | **Mechanically legal, but a fat-head/thin-tail chain — fails the spirit of (4).** Slice A carries ~85% of the effort/risk (the entire hand-rolled byte-exact parser+serializer) and passes the for-each vectors; B/C/D are ~`size·1` additions of ~10-line expanders, each `blockedBy: A`. Splitting one coherent `size·8` port into one dominant slice + three trivial tails fragments a deliverable the reference built whole, for marginal parallelism — the exact "needless split" the conservative instinct refuses. |
| **Renderer vs conformance-harness** | **Fails (4)/(5) — mutually dependent.** The renderer can't be demoed without the harness that grades it; the harness has nothing to grade without the renderer. Registry-with-no-consumer → ships together. |

All three decompositions fail. **#2359 is one atomic, coherent deliverable:** a pure port re-deriving frozen
bytes, provable only when the renderer + its conformance harness ship together, with no intermediate slice
leaving a passing-vector state. Estimated **`size · 8`** (large, batchable ceiling — the hand-rolled
serializer is the weight; could be `5` if a Python HTML lib reproduces byte-exact output). At `8` it is *at*
the batchable ceiling, **not over it** — not even a size-driven split candidate.

## Resolution — reclassified epic → `story · 8`

There is nothing to unblock: the design is a resolved black box (#2030), the contract is frozen, #2354 is
resolved. #2359 is simply **ready to build as a single item**, so it stops being an empty roadmap-placeholder
`epic` (a state from before its contract was scoped) and becomes a **`story · 8` under #2069** — directly
batchable/buildable. The five sibling language sub-epics (#2355–2358, #2360) will each collapse the same way
when sliced: same frozen oracle, same atomic shape.
