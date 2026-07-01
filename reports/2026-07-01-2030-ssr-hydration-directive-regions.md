# #2030 — SSR + hydration surface for comment-anchor directive regions (prep pass)

**Date:** 2026-07-01 · **Item:** [backlog/2030](../backlog/2030-foundational-ssr-hydration-surface-for-comment-anchor-direct.md) · **Parent:** #1971 · **Blocks:** #2005
· **Research topic:** [/research/directive-ssr-hydration-surface](../src/_data/researchTopics/directive-ssr-hydration-surface.json)

This is the autonomous *prepare* pass — bringing #2030's forks to Definition-of-Ready for a fast human ratification. It makes **no call**.

## The gap is real (grounded, FUI)

FrontierUI's webdirectives plug is **parse + client-DOM lifecycle only** — there is genuinely no server renderer and no hydration hook:

- `fui:plugs/webdirectives/CustomCommentRegistry.ts:75-83` — `upgrade(root)` drives the whole lifecycle through `document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)`. Hard dependence on a live `document`; no off-DOM path.
- `fui:plugs/webdirectives/directiveLifecycle.ts:100-129` — `connectDirectiveTree` / `disconnectDirectiveTree` likewise call `surfaceDirectiveRegions(root)` (a TreeWalker) and invoke lifecycle hooks on live nodes.
- `grep -niE "renderToString|hydrat|server.?render|ssr" fui:plugs/webdirectives/*.ts` (excluding tests) → **zero matches.** Confirmed true gap.
- WE spec `we:src/_includes/project-webdirectives.njk:455-500` describes SSR as a **contract/expectation** (Server MUST evaluate data and emit templates; streaming loading-first; client uses comment boundaries as delimiters; `data-key` for keyed diffing; zero-JS progressive-enhancement baseline) and explicitly delegates impl to "the build system or server framework." Contract only, no code.

Two pieces already exist that make the server path *cheap*, and they anchor the defaults:

- `fui:plugs/webdirectives/CustomCommentParser.ts` — `DefaultCommentParser` is **pure string parsing, no DOM** (`namespace:name option="v"` opening, `/namespace:name` closing). It already runs off-DOM.
- `fui:plugs/webdirectives/directiveInspector.ts:97-138` — the marker grammar is fully specified and read purely from comment text: paired `<!-- name:start (expr) -->`…`<!-- name:end -->` (FUI runtime convention) and open/close `<!-- ns:name … -->`…`<!-- /ns:name -->` (spec/parser convention). Any HTML emitting this grammar reconstructs identically, whatever produced it.

## The #1971 DOM Parts constraint — and its actual scope

`fui:plugs/webdirectives/directiveLifecycle.ts:33-41` carries a **"## DOM Parts alignment (note, not adoption)"** block. It states the `name:start`…`name:end` convention "lines up directly with the DOM Parts proposal's `ChildNodePart`" and — verbatim — *"This is an **alignment note** to keep the convention forward-compatible; the module does not depend on or adopt the DOM Parts API."*

This is the load-bearing scope fact for Fork 2. #1971 commits to **keeping the marker convention forward-compatible with `ChildNodePart`**, not to *adopting* the DOM Parts API — so it cannot *settle* the grammar (citing a deliberate non-commitment to close a fork inverts its meaning; the "alignment note ≠ ratified shape" naming-fork discipline). The skeptic then surfaced the decisive second fact: the runtime emits **only** `:start`/`:end` (`fui:blocks/for-each/ForEachBehavior.ts:147`, `fui:blocks/view/ViewIfDirective.ts:85`, `fui:blocks/view/ViewSwitchDirective.ts:77`, all space-padded), while the inspector/parser **also accept** a spec-side `open-close` grammar (`fui:plugs/webdirectives/directiveInspector.ts:27-34`) that **no runtime code emits**. SSR must choose which grammar it *emits* vs. merely *accepts* — a genuine duality. So Fork 2 is a **live fork**, not a forced ratify; its default is "SSR emits the runtime `:start`/`:end` grammar (byte-identical, padding normative); `open-close` stays an accepted hydration-read alias." The `ChildNodePart` forward-compat rides along for free because the runtime grammar already has it.

## Fork classification (Pass 0 — standing test, then skeptic reversal)

An initial classification demoted Fork 2 to a forced ratify (settled by #1971) and Fork 5 to a config-dimension (of #1977). **The skeptic pass REFUTED both** on grounded facts, so both were **restored as live forks**. Final state:

| # | Fork | Verdict | Why |
|---|---|---|---|
| 1 | Server-render architecture | **Genuine fork** | Two coherent branches that cannot coexist: build the tree via a DOM shim then serialize, *or* a bespoke off-DOM string renderer. You build one. |
| 2 | Marker grammar | **Genuine fork (restored)** | The runtime emits **only** `:start`/`:end` (`fui:blocks/for-each/ForEachBehavior.ts:147`, `fui:blocks/view/ViewIfDirective.ts:85`, `fui:blocks/view/ViewSwitchDirective.ts:77`), but the inspector *also* accepts a spec-side `open-close` grammar with **no runtime emitter** (`fui:plugs/webdirectives/directiveInspector.ts:27-34`). SSR must pick which it *emits* vs. *accepts* — a real duality. #1971's DOM-Parts note is *"not adoption"* (`fui:plugs/webdirectives/directiveLifecycle.ts:39-40`), so it cannot settle it. |
| 3 | Directive-state serialization | **Genuine fork** | In-marker encoding vs. a side-channel `<script type="application/json">` blob — coherent, mutually-exclusive formats. |
| 4 | Client hydration hook | **Genuine fork** | Recognize-and-adopt (`hydrate(root)` beside `upgrade(root)`) vs. discard-and-re-stamp — the naive re-stamp path is a real, wrong alternative worth excluding. |
| 5 | Streaming / lazy hydration | **Genuine fork (restored)** | Demotion premise was false: #1977 has **no impl** (`grep` of the plug finds no defer directive), so a fork can't be "config of" it. And streaming (regions whose `:end` hasn't streamed yet — inspector needs a complete pair, `fui:plugs/webdirectives/directiveInspector.ts:185-239`) is orthogonal to #1977's connection triggers. |

Surviving genuine `## Fork N`: **all five (1, 2, 3, 4, 5)**. The initial demotions of 2 and 5 were the skeptic's two REFUTED verdicts.

## Prior-art digest (see research topic for the full survey)

- **Lit SSR** — one comment grammar (`<!--lit-part digest-->`/`<!--/lit-part-->`) shared server↔client; `hydrate()` re-associates expressions to existing nodes without re-rendering; `defer-hydration` attribute holds a subtree back. **The proof that a shared marker grammar + adopt-walk works.**
- **DOM Parts / `ChildNodePart`** (WICG) — standards-track successor to comment markers; the shape FUI's paired markers already match.
- **Qwik / Marko 6 resumability** — state in a `qwik/json` reference-keyed blob; no adopt-walk at all (resume, don't replay). The *stronger* alternative to hydration; out of scope for v1 (WE isn't resumable), but it's why Fork 3's side-channel blob is a real branch.
- **Astro islands / RSC** — per-component hydration gates (`client:*`, `server:defer`) and hydration boundaries — the model Fork 5 collapses into #1977.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1 — server-render architecture** | **Build the tree via a DOM shim, then serialize to string** (reuse the client path) | Bespoke off-DOM string `renderToString` | med — shim fidelity/perf vs. one-codepath drift-avoidance |
| **Fork 2 — marker grammar** | **SSR emits `:start`/`:end`; `open-close` is a hydration-only accepted alias (emit-vs-accept split)** | Emit the spec's `open-close` grammar | med — the two-dialect duality is the real call |
| **Fork 3 — state serialization** | **Bounded in-marker (framework tokens); per-item keys → `data-key` attributes; no raw user data in comments** | Side-channel `<script type="application/json">` blob | med-high — escaping/size guards decide it |
| **Fork 4 — hydration hook** | **`hydrate(root)` adopt path sharing `upgrade`'s idempotency set** | discard-and-re-stamp | high — adopt is the whole point of SSR |
| **Fork 5 — streaming/lazy** | **Reuse `hydrate()`+#1977 for the eager/deferred dimension (gated on #1977); open-region = block-until-`:end`** | progressive open-region adoption | low-med — streaming-partial is orthogonal to #1977 |

## Skeptic pass

A refute-only skeptic sub-agent attacked each default on 4 axes (classification / merit / statute-overlap / citation-scope), hardest on Forks 1 and 2. It grounded new facts against the FUI tree (runtime emitters, the second un-emitted grammar, #1977 being unbuilt) and changed the item materially:

- **Fork 1 — SURVIVES-WITH-AMENDMENT.** Reframed as *shim → serialize* (a shim is an intermediate, not the output — otherwise the perf objection is hidden); added a byte-identical marker conformance test (incl. comment space-padding) and a WE-#6 placement guard (plug capability, not a server).
- **Fork 2 — REFUTED (settled) → restored to a live fork.** The runtime emits only `:start`/`:end` while the inspector also accepts an un-emitted `open-close` grammar — a real duality; #1971's DOM-Parts note is explicitly non-adoption, so it cannot settle it. Default kept, reframed as an emit-vs-accept decision with padding made normative.
- **Fork 3 — SURVIVES-WITH-AMENDMENT.** Naive "keys in the comment tail" was unsafe (comment-escaping/injection of raw user data) and contradicts the spec's `data-key` diffing surface. Amended: keys → `data-key` attributes; comment tail bounded to framework tokens + a `--`/`>` escaping guard.
- **Fork 4 — SURVIVES.** Must share `upgrade`'s `#upgraded` idempotency set (defined as *upgrade-without-stamp when content present*) or a region double-connects; machinery already exists.
- **Fork 5 — REFUTED (config-dimension) → restored to a live fork.** #1977 is unbuilt (can't be "config of" a non-existent mechanism) and open-region streaming is orthogonal to its triggers. Restored with two sub-axes; default block-until-`:end`.

## Residual

None blocking DoR: all five `## Fork N` carry options + bold default + skeptic line. `preparedDate` deliberately **not** set by this pass (per the prepare brief — human sets it or ratifies directly). No `check:standards` run per brief. One dependency to record at ratification: Fork 5's deferred-dimension slice is `blockedBy` #1977.
