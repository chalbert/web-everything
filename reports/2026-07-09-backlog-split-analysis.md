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

---

# Focused run: `/slice 2355` (JVM native SSR renderer sub-epic)

## Candidate

**#2355 — Native JVM SSR renderer for directive regions** (`kind: epic`, `parent: 2069`,
`blockedBy: [2354]`, unsliced — no children). A per-language sub-epic seeded by the #2069 roadmap split; its
foundational blocker **#2354 is resolved** (vectors exported as language-neutral JSON +
[we:conformance-vectors/webdirectives-ssr-harness-contract.md](conformance-vectors/webdirectives-ssr-harness-contract.md)).
Not a roadmap epic — its natural children are the pieces of *one* renderer build, so it slices into
**stories/tasks** (leaf level), not sub-epics.

### Work-investigation pass

No JVM code exists — pure greenfield build. But the seams are fully knowable: the Node reference oracle
`fui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts` is 266 well-factored lines the JVM port re-derives
*the same bytes* for, with a clean per-directive `DirectiveRenderer` plug (`renderInner` / `stateTokens`).
The 10 golden vectors group per-directive (`if/*`, `switch/*`, `state-tokens/*`, `for-each/*`,
`resource-loader/*`, `defer/*`), so each slice gets its own fixture-driven demo (byte-for-byte per the #2354
contract). The greenfield dimension is the *build/harness integration* (first non-JS toolchain in the
constellation — none of 2356–2360 has landed one) — bounded and industry-standard (Gradle + HTML parser + a
test reading the JSON resource and byte-comparing), so size-honest, not unknown-scope. #2030 ratified render
internals a conforming **black box — not a fork**, so the whole thing is a pure build with nothing gated.

### Could split — YES (foundational slice + per-directive fan-out)

Reference grounding cites `fui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts` (the Node oracle):

| Slice | kind | size | Scope | blockedBy | Ref lines |
|---|---|---|---|---|---|
| **A. JVM renderer foundation + if/switch** | story | 5 | Greenfield JVM build subtree (`frontierui:plugs/webdirectives/ssr/jvm/`) + source parse + top-level `<template is>` dispatch loop + normative space-padded marker wrapping + `renderMarkerOptions` + shared helpers (`resolvePath`, mustache `interpolate`) + **JVM-side conformance harness runner** (reads the JSON vectors, byte-compares, wired into CI) + the two branch-select directives `if`/`switch` to prove the pipeline end-to-end. Demo: passes `if/*`, `switch/*`, `state-tokens/*`. | — | dispatch 235-264, markers 103-112, helpers 67-84, if/switch 154-176 |
| **B. for-each** | story | 3 | Item expansion + `data-key` (only key channel) + empty-list markers-only + `count`/`key-hash` state tokens, incl. the **DJB2 port with the normative UTF-16-code-unit subtlety** so non-ASCII keys don't diverge. Demo: passes `for-each/*`. | A | for-each 116-150, djb2 95-101 |
| **C. resource:loader + defer** | task | 2 | Two passthrough directives (inner-branch emit; `defer` emits placeholder branch only). Demo: passes `resource-loader/*`, `defer/*`. | A | 180-196 |

**DAG (clean fan-out, acyclic):** `A → {B, C}`; B ∥ C proceed fully independently once A lands. Incremental
delivery (each slice extends conformance coverage) + real independence — both hold.

**Rubric check (leaf story/task form):**
- **(1)** No buried fork — #2030 ruled JVM language/HTML-parser/build-tool choices a conforming black box,
  not a decision. Nothing gated. ✓
- **(2)** ≥2 nameable slices (3), each a real home — A/B stories, C a task under the epic. ✓
- **(3)** Each re-estimates ≤5 with grounding in the reference oracle; A isolates the greenfield-build risk,
  B/C are thin per-directive deltas. ✓
- **(4)** Clean acyclic fan-out; B ∥ C independent after A; incremental delivery besides. ✓
- **(5)** Each slice passes a byte-for-byte vector subset = a valid demoable state (A proves the pipeline via
  `if`/`switch`; no half-algorithm intermediate). ✓

### Note / dial for the human

- **First-mover cost lives in JVM's slice A.** Standing up the first non-JS build + the cross-language harness
  *runner* (which #2354 left to the FUI impl side — it shipped the contract + data, not the runner) is a
  precedent all six language sub-epics (2356–2360) will re-need. Kept inside A per the #2069 decomposition's
  deliberate scoping (extract later if reusable), rather than lifting a shared foundation up to #2069.

### Reconciliation with the `/slice 2360` verdict above

The `/slice 2360` section above ruled all six language sub-epics — **#2355 included** — could-not-split, on
conditions (4) and (5). This run reaches the opposite verdict for JVM after reading two artifacts the 2360
pass did not cite:

- **(4) is a fan-out, not a "rigid linear chain."** The Node reference oracle
  `fui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts` implements the directives as **independent plugs on a
  dispatch map** (the `DirectiveRenderer` interface, `RENDERERS` table), sharing only parse + marker-wrapping +
  helpers. That shared part is slice A; each directive is an independent addition behind it — a genuine
  `A → {B, C}` fan-out, not the `parse → expand all 7 → emit` chain the 2360 pass assumed.
- **(5) grades per-vector, not all-or-nothing.** The #2354 harness contract
  ([we:conformance-vectors/webdirectives-ssr-harness-contract.md](conformance-vectors/webdirectives-ssr-harness-contract.md))
  grades **every vector independently** ("treat every vector independently… report all failing ids; conformant
  iff `failed` is empty") and the vectors group per-directive. So a renderer passing `if/*`+`switch/*`
  byte-for-byte is a **valid demoable state** (some-of-N complete, independent features) — not the "half an
  algorithm" a partial renderer would be if grading were all-or-nothing.

**Where 2360 is still right:** slices B/C are grounded in the *Node* reference, not their own *JVM* `file:line`
paths (which don't exist until slice A lands) — the normal leaf-slice grounding bar is met by the oracle, not
the target surface. Slice A **is** the contract-scoping-plus-foundation the 2360 pass recommends; this run just
draws B/C's seams from the oracle now rather than deferring them. The divergence is JVM-specific only in that
it was investigated against the oracle; **2356–2359 (Go/PHP/Rust/Python) warrant the same re-analysis** — the
2360 blanket "applies identically to all six" no longer holds for the sliced case. (#2360 itself was left
could-not-split by its own run and is not re-touched here.)
