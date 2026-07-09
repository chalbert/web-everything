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

## `/slice 2356` — Native Go SSR renderer for directive regions (focused, appended 2026-07-09)

**#2356** (`kind: epic`, `parent: 2069`, `blockedBy: [2354]`, unsliced — no children). One of the
per-language renderer sub-epics carved from the #2069 roadmap split above. Its foundational blocker **#2354
is resolved** — the language-neutral vector export
([we:conformance-vectors/webdirectives-ssr.vectors.json](../conformance-vectors/webdirectives-ssr.vectors.json))
and the grading contract
([we:conformance-vectors/webdirectives-ssr-harness-contract.md](../conformance-vectors/webdirectives-ssr-harness-contract.md))
both landed — so the blocker DAG is clear and the item is now a live `/slice` candidate per the roadmap
recursion.

### Work-investigation pass

- **The Go renderer contract is fully scoped, zero design ambiguity.** The harness contract pins grading
  (byte-for-byte UTF-8 equality against `expectedHtml`, all 7 vectors, per-vector pass/fail), the DJB2
  `key-hash` algorithm (UTF-16 code units — the one cross-language footgun), and the black-box ruling
  (#2030 — render internals are a per-impl call, **not** a fork). No open question gates the build.
- **The reference is one coherent module.** The Node oracle is a single ~266-line file
  ([frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts](../../frontierui/plugs/webdirectives/ssr/nodeReferenceRenderer.ts))
  behind a `(source, data) => string` seam
  ([frontierui:plugs/webdirectives/ssr/ServerRenderer.ts](../../frontierui/plugs/webdirectives/ssr/ServerRenderer.ts)):
  parser → 5 directive expanders (for-each keyed+empty, if, switch, resource:loader, defer) → byte-exact
  serializer → state tokens (`count`/`key-hash`/`condition`/`value`), all sharing one type surface.
- **The Go surface does not exist.** A `find` over the frontierui repo returns **zero Go source files and no
  Go module manifest** — this is a from-scratch build in a language the repo has no tooling for yet. Unlike
  Node it can't lean on a DOM shim (happy-dom) for parse+serialize; it must hand-roll HTML parsing and
  byte-exact serialization, so the whole renderer is one tightly-coupled package.

### Could not split — YES (foundational: the surface doesn't exist yet)

| # | Title | Failing condition | Unblocking action |
|---|---|---|---|
| **2356** | Native Go SSR renderer for directive regions | **Investigation pass** (greenfield — no Go code to draw seams in) + **(3)** no `file:line`-citable named paths + **(4)** only a rigid linear chain + **(5)** no intermediate state passes the full harness | **Build it single-pass** as the foundational Go artifact — this item *is* the foundational slice. Re-run `/slice` only once the Go package exists and proves large enough to expose real separable seams. |

**Why each condition fails:**

- **Investigation / (3):** every hypothetical slice names Go source files that don't exist yet — a slice you
  can't point at real code for is a hypothesis, not a slice. The `file:line` relaxation is for *sub-epic*
  pure-build slices; 2356's natural children are **leaf stories** (it's one standard's impl, not a roadmap of
  N standards), which must be grounded.
- **(4) rigid linear chain:** the only decomposition is by-directive-family, but every family slice depends
  on the shared parser + serializer + marker-emitter scaffolding of the first, all editing the same package.
  No two proceed independently.
- **(5) no valid demoable intermediate:** the demo for a conforming renderer **is** passing the byte-for-byte
  harness (`failed` empty). A for-each-only renderer fails the if/switch/resource/defer vectors — a
  half-an-algorithm intermediate, not a shippable state.
- **Conservative instinct:** this is one ~300–500-line coherent Go package. Carving it into "add directive N"
  stories that each edit the same file fragments one deliverable into pieces that only make sense together —
  multiplied review overhead, zero independence gain. The needless-split anti-pattern.

No decision/fork is buried (condition (1) holds — #2030 already ruled the internals a black box), so there
is **nothing to file as a `kind: decision` card** and no Tier-B decision to register. The reason is purely
*foundational*, not *undecided*.

### Recommendation for the human — reclassify epic → story

2356 reads as a single **size ~8 story**, not an epic: one coherent from-scratch renderer package, one
deliverable, no independently-ownable sub-scopes. The #2069 roadmap split carved every language as a
*sub-epic* uniformly, but the roadmap tell is "each child is *clearly* epic-sized" — a single-language port
of one 266-line module is a story band, not a subsystem-of-subsystems. The friction that exposes this: an
epic has no `childlessReason` for "atomic/foundational" (only `blocked`/`untriaged`/`program`), so 2356 will
keep showing the **slice badge** it can't satisfy.

**Cleanest fix (needs your call — this is a reclassification, not a `/slice` mutation):** splice 2356
`kind: epic` → `kind: story`, `size: 8`, and set `unsplittableReason: foundational` (the story-side
"atomic · surface doesn't exist yet" pill). It then drops the slice badge, sits in the batch/pick pool as an
agent-ready build, and a later `/slice` can revisit only if the built package proves large. **Not done** —
say the word and I will.
