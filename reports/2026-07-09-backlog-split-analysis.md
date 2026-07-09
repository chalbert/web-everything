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

## Focused run: `/slice 2357` (appended)

**#2357 — Native PHP SSR renderer for directive regions** (`kind: epic`, no size, `parent: 2069`,
`blockedBy: [2354]`, unsliced — no children). One of #2069's six per-language sub-epics (slice **D**). The
design lineage is fully resolved (#2030 black-box ruling, #2063 wire format + golden vectors, #2064 Node
reference renderer/oracle, #2354 language-neutral vectors JSON + harness contract). A pure, fork-free build.

### Investigation pass — what actually exists vs. what this epic must build

- **The reference to conform to exists** — `fui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts:1-266`
  (the 266-line oracle), the seam `fui:plugs/webdirectives/ssr/ServerRenderer.ts`, and the byte-exact
  goldens `we:conformance-vectors/webdirectives-ssr.vectors.json` (7 vectors) + the grading spec
  `we:conformance-vectors/webdirectives-ssr-harness-contract.md`.
- **The PHP surface does NOT exist.** `find … -name '*.php'` over both repos → zero hits. There is **no PHP
  home**, no PHP build/test integration, and **no runnable cross-language harness *runner*** — #2354
  delivered the vectors-as-data + the grading *contract* (a spec `.md`), but nothing that invokes a non-JS
  renderer as a subprocess, feeds it `(input, data)`, and byte-compares against `expectedHtml`. The Node
  renderer is graded by a vitest that *imports* it directly
  (`fui:plugs/webdirectives/ssr/__tests__/nodeReferenceRenderer.conformance.test.ts`); a PHP renderer cannot
  be imported into vitest, so that runner is net-new work owned here.

### Verdict — could not split (yet)

| # | title | failing condition | unblocking action |
|---|-------|-------------------|-------------------|
| **2357** | Native PHP SSR renderer | **(3)** impl surface doesn't exist — no proposed slice's files are `file:line`-citable (zero PHP, no cross-language runner); the per-directive seams a decomposition would rely on can't be grounded until the PHP home + harness runner exist. Reinforced by **(4)/(5)**: the only available decomposition is a rigid *foundational→tail* chain — scaffold + harness runner + marker framing + `for-each` (the hardest directive: `count`/`key-hash` DJB2-over-UTF-16/`data-key`) carries ~80% of the effort, while `if`+`switch` and `resource:loader`+`defer` are ~size-2 trivial adds atop shared infra with weak independence; and the renderer is graded as **one conforming black box**, so partial-conformance intermediate states (passing 3/7 vectors) are weak demoable states. | **Build 2357 as a single foundational pass** — scaffold the PHP renderer home + the cross-language harness *runner* realizing the #2354 contract + marker framing + all 7 directives, graded byte-for-byte. Its landed artifact then *exposes* real per-directive seams; re-run `/slice` only if that surface proves heavy. This is the epic's own flagged state: *"a future /slice candidate once its PHP renderer contract is scoped"* — the contract (PHP home, runner interface, build integration) is not yet scoped, and scoping it **is** the foundational build. |

Consistent with how #2069 treated these sub-epics: *"the seams get drawn when each is itself sliced after
its language contract is scoped."* PHP's contract isn't scoped, so this is a **could-not-split-here**, not a
missed split. No `kind: decision` to register — the design is fully resolved (#2030); the action is simply
*build it*, and nothing is design-gated.

### Notes for the human

- **Stale block — 2357 is now unblocked.** `blockedBy: [2354]` but #2354 is `status: resolved`, so the
  precondition holds; 2357 is ready to build now. (Not mutated here — a could-not-split run doesn't touch the
  backlog. Worth clearing the edge on the next honest-DAG pass or when the build starts.)
- **Where the harness *runner* lives is a scoping call.** Its byte-compare/report **core** (load vectors
  JSON → invoke a pluggable renderer command → compare → per-vector report) is language-agnostic and reusable
  across all of #2069's B–G sub-epics; only the *invoke* glue (`php file.php`) is PHP-specific. That shared
  core arguably belongs one level up under #2069 (a sibling of #2354), not buried in the PHP epic. Deciding
  that is part of the foundational build — another reason the per-directive seams can't be cut cold today.
- **No epic `childlessReason` fits** (the vocabulary is `blocked`/`untriaged`/`program`), and none is needed:
  an unsliced epic with no `childlessReason` is the correct "not yet scoped into slices" state (it shows the
  *slice* badge). This report is the durable record of the could-not-split verdict.
