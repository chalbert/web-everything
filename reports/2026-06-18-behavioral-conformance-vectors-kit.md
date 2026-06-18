# Behavioral conformance vectors + in-browser implementer-validation tool — prep research (#899)

**Date**: 2026-06-18
**Point**: Prior-art survey (WPT, JSON Schema Test Suite, test262, ARIA-AT, Sinon/Playwright fake clocks, Testing Library) for #899's conformance-KIT model, run through the constellation rulings — collapses the item's two stated forks to two forced invariants (#817 layer split · #091 hosted→plateau) plus one genuine either/or: where the runnable *reference backend* lives (WE-repo proof vs FUI devtool).
**Plan file**: n/a (decision-prep, no `plans/` inbox file)
**Research page**: `/research/behavioral-conformance-vectors-kit/`
**Backlog item**: `/backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida/`

---

## Question

How does an implementer prove a component conforms to a WE standard when the contract is build-agnostic (only the final rendered component counts)? A static manifest check (`capability-manifest/check.ts:1-12`, the build-time `check:validation-adherence` #267) validates *declared-vs-used features* but cannot capture **behavioral/temporal** conformance — e.g. that `validator-resolution`'s `versioning` default drops a stale async generation (`validator-resolution/provider.ts:84-88`). The leaning direction: WE publishes a conformance **KIT** (declarative JSON vector corpus + vector schema + dependency-free reference verifier + binding interface); implementers supply a binding + their own browser driver and run in their own CI (the escapable floor); plateau hosts the zero-setup in-browser exerciser (controllable clock, dashboards) as the paid product. Two stated forks: (1) runner home plateau vs FUI; (2) reference-verifier thinness — pure assertion semantics vs also a small reference driver.

## Recommendation

Run through the prior art + the constellation rulings, the two forks largely **dissolve into forced invariants**, leaving one genuine call:

- **Forced invariant A — the layer split (per #817's file-seam test).** WE owns the vector corpus (JSON) + vector schema + **assertion-semantics** reference verifier (it *is* a WE conformance gate, like `check.ts`, so #817 keeps it WE) + the binding **interface** (including a clock *verb contract* `now/tick/tickAsync/next/runAll`). The binding **implementation** (mount/dispatch/read) and the clock **implementation** (Sinon-style embedded / Playwright `page.clock`-style) are runtime → FUI. The broken branch — a runtime clock/DOM driver *inside `@webeverything`* — is exactly what #817 excluded from WE. The verifier consumes **time as data** (a timestamped observed trace), never a live clock, so no WE gate consumes the clock impl → it ports out.
- **Forced invariant B — the hosted exerciser is a plateau product (per #091).** A zero-setup, in-browser, dashboards/pass-fail-over-time, results-collecting surface is the wpt.fyi / aria-at-app shape — a served product, plateau's constellation layer. FUI hosting a stateful results SaaS is the broken branch (FUI is the impl/devtool layer). This is the #091 *decompose, no home decision* pattern, so the item's Fork 1 dissolves: the hosted dashboard → plateau; a thin **stateless** local exerciser → FUI devtool (tracks invariant C).
- **The one genuine fork — reference-backend home.** After #817 settles the *verifier* (pure assertion semantics, no runtime driver), the surviving either/or is narrower than the item stated: does the **WE project** additionally publish a runnable **reference backend** (clock + DOM dispatch) as zero-lock-in proof-of-runnability, or stay pure-contract and let FUI/implementers own *all* runnable backends? **Default: pure-contract — the reference backend lives in FUI** (zero-lock-in devtool, open/free per open-core, so the floor stays escapable), keeping WE = contracts/conformance only (#817, #855, *impl-is-not-a-standard*). Confidence ~70-75%; the residual is the WPT precedent — testharness.js *does* ship alongside the corpus — and the JSON Schema Test Suite Node binding precedent for a separate, non-scoped reference package.

## Key Findings

| Prior art | Reusable paradigm for the kit |
|---|---|
| **WPT** (`testharness.js` + `testdriver.js` + wpt.fyi) | Three artifacts, two narrow contracts: corpus ⊥ runner ⊥ dashboard. The corpus/runner seam *is* the monetization line — wpt.fyi owns zero tests and runs none. **No virtual clock in the corpus** — real wall-clock + a runner-supplied multiplier; the time machinery lives in the runner tier. Detachable reporting hook (`wptreport.json`). |
| **JSON Schema Test Suite** (closest analog) | 100% JSON corpus, **no shared runner code**; each impl writes a ~30-line adapter loop. Outcome kept minimal/observable (`valid` boolean). Versioned per draft, one file per keyword, `optional/` tier for non-required capabilities. |
| **test262** | The `$262` host object is the single named **binding interface** every engine fills in; async tests signal via `$DONE()` — the *host* owns the event loop, the corpus just declares "async". |
| **ARIA-AT** | Invariant **assertions** authored once (priority `1/2/3` = MUST/SHOULD/MAY); per-impl **commands** vary (`commands.json`). aria-at-app = hosted iframe runner collecting interop results — the open-corpus + paid-hosted shape again. |
| **Testing Library / black-box** | "Resemble the way software is used" — assert on the ARIA/DOM/event surface, never impl internals. The accessibility tree is the only layer every implementation must agree on by definition. |
| **`@sinonjs/fake-timers`, Playwright `page.clock`** | The clean seam: the **clock verb contract** (`now/tick/tickAsync/next/runAll`) is standardizable; the install mechanism is a swappable backend (embedded Sinon for jsdom; `page.clock` over CDP for real render). Vitest/Jest fake timers are thin wrappers over Sinon. |

**In-repo prior art (not greenfield):** WE already ships a conformance-vector + reference-target + golden-output pattern at `blocks/renderers/module-service/conformance/` (`vectors.ts:17-29` `VectorInput`, `golden.json`, `runner.ts`, `referenceTarget.ts`, `dotnetTarget.ts`). #899 generalizes that *request→golden* shape to **behavioral/temporal** vectors with **DOM/ARIA observation** and a **controllable clock**.

**The constellation seam:** the binding interface + clock verb contract = a conformance **protocol** (many implementers run it, drivers swap) → WE. The vectors = conformance **data** → WE. The verifier = a conformance **gate** consumed WE-side → WE. The runnable backends (mount/dispatch/clock impl) = **runtime** → FUI (#817). The hosted dashboard = **served product** → plateau (#091). Only the genuine residual — a reference backend's home — needs a human call.

## Files Created/Modified

| File | Action |
|---|---|
| `reports/2026-06-18-behavioral-conformance-vectors-kit.md` | Created (this report) |
| `src/_data/researchTopics.json` | Added `behavioral-conformance-vectors-kit` topic |
| `src/_includes/research-descriptions/behavioral-conformance-vectors-kit.njk` | Created write-up |
| `backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida.md` | Rewritten to prepared-fork shape; `preparedDate` set; `relatedReport`/`relatedProject` linked |
