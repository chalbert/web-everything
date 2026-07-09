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

## Focused run: `/slice 2360`

**#2360 — Native .NET SSR renderer for directive regions** (`kind: epic`, no `size`, `parent: 2069`,
`blockedBy: [2354]`, unsliced — no children). One of the six per-language renderer sub-epics carved from
#2069 above (slice **F**). Foundational slice A (**#2354**) is now **resolved** —
[we:conformance-vectors/webdirectives-ssr.vectors.json](../conformance-vectors/webdirectives-ssr.vectors.json)
+ [we:conformance-vectors/webdirectives-ssr-harness-contract.md](../conformance-vectors/webdirectives-ssr-harness-contract.md)
exist — so the epic is unblocked to *start*, but not yet decomposable.

### Could not split — pending the .NET renderer contract scoping

| # | Title | Failing condition | Unblocking action |
|---|---|---|---|
| **2360** | Native .NET SSR renderer for directive regions | **Investigation pass (§work-investigation 3) + (4)/(5)** — impl surface doesn't exist in-repo and the renderer contract isn't scoped; the only decomposition is a rigid chain with no demoable intermediate | **Land a ".NET renderer contract-scoping" story first** (pins the .NET project layout, parser strategy, the `ServerRenderer` seam shape in .NET, harness invocation). Its artifact exposes the per-directive-family build seams — then re-run `/slice 2360`. |

**Why not sliceable now (rubric):**

- **(work-investigation 3) The surface doesn't exist to investigate.** The renderer is a from-scratch .NET
  build in FUI (`frontierui:plugs/webdirectives/ssr/`); WE ships zero renderer (rule #6). There is **no .NET
  code in this repo** — no `.cs`/`.csproj`, no `ssr/` dir — so no proposed slice can carry `file:line`-citable
  named paths. Grounding is impossible until the contract is scoped. The body already anticipates this:
  *"A future /slice candidate once its .NET renderer contract is scoped."*
- **(1) is NOT the blocker — no buried fork.** #2030 ruled every language's internal render strategy a
  **conforming black box, explicitly not a ratifiable decision**. So the unblocker is a **scoping story**, not
  a `kind: decision` — this is the "land the foundational/scoping slice first" pattern, not "resolve fork X".
- **(4) Rigid linear chain.** The natural decomposition (parse authoring source → expand all 7 directives →
  emit byte-exact wire format w/ padding + state tokens → run the conformance harness) is a single chain where
  each stage blocks the next; no ≥2 independent slices, no useful incremental delivery.
- **(5) No valid demoable intermediate.** Conformance is graded **byte-for-byte against the full vector set** —
  a partial renderer (e.g. `if`/`switch` but not keyed `for-each`, or markers without state tokens) fails the
  vectors outright. No slice leaves the renderer in a conformant, demoable state until the whole thing passes.

**Applies identically to the five sibling sub-epics** (#2355 JVM, #2356 Go, #2357 PHP, #2358 Rust, #2359
Python). Each is the same pure-build-with-unscoped-contract shape; each is could-not-split until its own
language-renderer contract is scoped. The deferral is already recorded on every sub-epic's body, so no new
tracking item is filed — the contract-scoping is the natural first move when the sub-epic is picked up.

**No on-disk mutation.** #2360 stays a valid unsliced epic (no `size`, no `childlessReason` → shows the
*slice* badge = decomposition-pending), which is correct: it's a real home for future work, awaiting its
contract-scoping artifact.
