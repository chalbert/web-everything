# Unplugged functional re-audit — per-plug public-surface state vs the running runtime — 2026-06-27

Backlog: [#1840](/backlog/1840-re-audit-the-actual-unplugged-functional-state-of-every-publ/) (W1 of epic [#1836](/backlog/1836-make-every-plug-public-api-functional-unplugged-parity-matri/)). The epic's premise is that unplugged mode is largely non-functional, yet [#726](/backlog/726-backfill-the-unplugged-mode-dual-mode-test-for-the-remaining/) is resolved as having backfilled unplugged tests and flipped `PLUG_UNPLUGGED_TEST_ENFORCED` to error. **Resolved is not proof.** This re-audits each public plug API against the running runtime (`fui:plugs/unplugged.ts` vs `fui:plugs/bootstrap.ts`) and records, per capability, whether the *full* surface actually works unplugged — refreshing the [#635](/backlog/635-audit-the-current-plugs-runtime-per-plug-unplugged-plugged-t/) matrix (`we:reports/2026-06-14-plugs-runtime-audit.md`) with today's reality. Discovery only; the per-gap fixes are the spawned slices listed at the end.

## Method

For every plug domain in `fui:plugs/web*`: read the domain's public capability surface, then read its `*.unplugged.test.ts` (the #726 backfill) and the shared `fui:plugs/__tests__/unplugged.*.test.ts`. Classify each *capability* (not each domain) as **works** / **caveat** / **untested-or-broken** unplugged, grounding the verdict in what `fui:plugs/bootstrap.ts` wires that `fui:plugs/unplugged.ts` does not. Verified against the actual files on `fui` HEAD (2026-06-22..).

## The headline correction to #635

#635 (2026-06-14) said *"only `webbehaviors` has dual-mode automated coverage; the other nine test the Plug interface in isolation."* **That is now stale.** The #726/#636/#637/#649 backfill landed a `*.unplugged.test.ts` for **every** domain except `webbehaviors` (whose unplugged coverage lives in the shared `fui:plugs/__tests__/unplugged.integration.test.ts` + `fui:plugs/webbehaviors/__tests__/unit/CustomAttributeRegistry.*`). So the *file-presence* gate is satisfied and is correctly `error` now (`we:scripts/check-standards-rules.mjs:1371` `PLUG_UNPLUGGED_TEST_ENFORCED = true`).

**But file-presence ≠ surface-proof.** Two structural gaps make "tests exist" a false proxy for "the public API works unplugged":

### Gap A — the gate's subject tree isn't even checked in WE (zero enforcement here)

The dual-mode rule walks `ROOT/plugs` (`we:scripts/check-standards.mjs:977`). Per #606/#449 **WE has no `plugs/` directory** — so `existsSync(plugsRoot)` is false and the entire dual-mode block is **skipped silently** in every WE gate run, including this item's. Enforcement exists *only* in FUI's own gate. The WE-side `PLUG_UNPLUGGED_TEST_ENFORCED = true` is dead code against an absent tree. (Not a regression to fix in WE — it's the #606 boundary — but it means the WE gate gives no signal on unplugged parity. Recorded for #1844's drift gate, which must run against the FUI tree or a published manifest, not `ROOT/plugs`.)

### Gap B — the backfill tests prove registry-mechanics, not end-to-end capability

The detection (`we:scripts/check-standards.mjs:993-996`) only asks: does a test file mention `unplugged` and touch the domain. Reading the actual tests, the backfill consistently proves the **same four registry-mechanics** per domain — *define / resolve / run-as-plain-library / two-scoped-registries-independent* — and stops there. It does **not** exercise the capabilities that bootstrap wires through machinery `fui:plugs/unplugged.ts` never builds. `fui:plugs/unplugged.ts:36-142` is purely `register`→`plug.upgrade(root)`; it never instantiates an `InjectorRoot`, never builds the expression/text-node/validation/guard registries onto a document injector, and never `customElements.define`s the form-associated controls. Everything `fui:plugs/bootstrap.ts:181-285` does is the un-proven (and for some capabilities, structurally absent) unplugged path.

## Per-capability matrix (today's reality)

Legend: **works** = proven unplugged by an automated test exercising the real capability · **caveat** = mechanically reachable unplugged but the test only covers registry plumbing, full capability unproven · **untested/broken** = the capability depends on bootstrap-only wiring with no unplugged equivalent and no test.

| Domain | Capability | Unplugged state | Grounding |
|---|---|---|---|
| webbehaviors | CustomAttributeRegistry define/upgrade/downgrade on real DOM | **works** | `fui:plugs/__tests__/unplugged.integration.test.ts:32-141` exercises attribute activation/deactivation, nested + shadow roots |
| webbehaviors | defineLazy / trait manifest / viewport / inert / gesture | **caveat** | unit tests exist (`fui:plugs/webbehaviors/__tests__/unit/CustomAttributeRegistry.defineLazy.test.ts` etc.) but none drives them via the `unplugged` `register/upgrade` API; lazy-trait wiring is bootstrap-only (`fui:plugs/bootstrap.ts:287-290`, `registerTraits` + `virtual:trait-manifest`, "Unplugged never imports this file") |
| webregistries | scoped CustomElementRegistry define/get/whenDefined/independence | **works** | `fui:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts:18-62` |
| webregistries | root customElements swap / multi-registry document upgrade | **caveat** | only the plugged global-patch path is exercised; the live root-swap is itself disabled (see `we:backlog/1483`, `we:backlog/1545`) |
| webcomponents | CustomElement construction, insertion patch, cloneHandlers | **caveat** | `fui:plugs/webcomponents/__tests__/unit/webcomponents.unplugged.test.ts` proves construction non-invasively; the `Element.insertion` and select/datalist clone fix (#454) are prototype patches with no unplugged equivalent — structurally plugged-only candidates |
| webcontexts | CustomContext define/resolve, value get/set/has as a plain lib | **works** | `fui:plugs/webcontexts/__tests__/unit/webcontexts.unplugged.test.ts:31-56` (incl. `isPatched` stays false) |
| webcontexts | `Node.contexts` DOM-walking resolution | **untested/broken** | the ergonomic surface is `Node.prototype` patched (`fui:plugs/webcontexts/Node.contexts.patch.ts`); unplugged has no out-of-band equivalent — a #1842 WeakMap-attachment target |
| webinjectors | provide/consume through an injector, #400 edge tracking | **works** | `fui:plugs/webinjectors/__tests__/unit/webinjectors.unplugged.test.ts:42-68` |
| webinjectors | `Document/Node.createElement` auto-injector-attach | **untested/broken** | prototype patch (`fui:plugs/webinjectors/Node.injectors.patch.ts:101`); declarative `injector` attribute resolution unproven unplugged |
| webstates | change-strategy + storage-strategy protocols (observe/CRUD/degrade/extends-chain) | **works** | deepest coverage — `fui:plugs/webstates/__tests__/unit/webstates-protocols.unplugged.test.ts:64-188` (10 cases incl. degrade + nearest-scope) |
| webexpressions | scoped CustomTextNodeRegistry define/resolve/construct | **caveat** | `fui:plugs/webexpressions/__tests__/unit/webexpressions.unplugged.test.ts:25-46` — proves registry + Text construction only |
| webexpressions | `{{ }}`/`[[ ]]` interpolation binding end-to-end | **untested/broken** | binding needs `customExpressionParsers`+`customTextNodeParsers`+`customTextNodes` set on a **document injector** (`fui:plugs/bootstrap.ts:195-221`); `fui:plugs/unplugged.ts` builds no injector, so the *headline* webexpressions capability has no unplugged path or test |
| webguards | provider define/resolve, `evaluateRegion` honours a named provider | **works** | `fui:plugs/webguards/__tests__/unit/webguards.unplugged.test.ts:31-56` |
| webguards | exit-guard (#273) + access-control (#178) per-scope delegation | **caveat** | resolution is injector-chain-based in bootstrap (`fui:plugs/bootstrap.ts:248-251`); unplugged proves the registry, not the per-scope delegation members |
| webvalidation | validity-merge (#215) + validator-resolution (#224) default strategy resolution | **caveat** | `fui:plugs/webvalidation/__tests__/unit/webvalidation.unplugged.test.ts:22-61` — resolves defaults by key only |
| webvalidation | `<validity-merge-field>` / `<async-validator-field>` form-associated behavior | **untested/broken** | both are `customElements.define`d **only** in bootstrap (`fui:plugs/bootstrap.ts:230-243`); the form-association capability has no unplugged registration path or test |
| webdirectives | CustomTemplateDirective define/resolve | **caveat** | `fui:plugs/webdirectives/__tests__/unit/webdirectives.unplugged.test.ts` — registry mechanics only (3 cases) |

## Findings summary

- **#635's "only webbehaviors" claim is obsolete** — every domain now ships an unplugged test, and the gate is `error`. Refresh #635's matrix: the *file-presence* column is green across the board.
- **#726's resolution is real but narrow.** It backfilled the *registry-mechanics* proof for every domain — genuine and worth keeping — but it did **not** prove the full public surface. "Resolved" is true at the granularity it was scoped to; the epic's "non-functional" premise is **half-right**: registry mechanics work unplugged everywhere; **capability surfaces that depend on bootstrap-only injector wiring or prototype patches are unproven and, for the injector-dependent ones, structurally absent unplugged.**
- **The real gaps are injector-wiring + prototype-patch capabilities**, not "the registries don't work." Three are structurally absent unplugged today (no injector built): webexpressions interpolation, webvalidation form-fields, webcontexts/webinjectors prototype-walk ergonomics. Three more are *caveat* (registry proven, members unproven): webguards delegation, webbehaviors lazy/trait, webregistries root-swap.
- **The WE-side gate enforces nothing** (Gap A): the subject tree is FUI-only. #1844's drift gate must target FUI/a manifest.

## Spawned fix cards (one per real gap)

Per #1840's mandate ("scaffold a fix card for every real gap found"). The two *caveat-only* registry-plumbing rows (webdirectives, webexpressions-registry) are **not** spawned — they are proven adequately for their surface. The structurally-absent + member-delegation gaps are:

- **[#1856]** webexpressions — build the unplugged interpolation path (`{{ }}`/`[[ ]]`): an unplugged way to wire `customExpressionParsers`/`customTextNodeParsers`/`customTextNodes` (an injector-less or unplugged-injector seam) + an end-to-end binding test. *Locus: FUI.* The largest gap (the headline capability).
- **[#1857]** webvalidation — register `<validity-merge-field>` + `<async-validator-field>` and prove form-associated validity merge/async resolution unplugged. *Locus: FUI.* Blocked-by #1856 (needs the unplugged injector seam for per-scope policy resolution).
- **[#1858]** webcontexts + webinjectors — provide the out-of-band (WeakMap-keyed) equivalent of the `Node.contexts` / `Node.createElement` prototype-walk ergonomics, with an unplugged test; or mark them plugged-only residue per #1839. *Locus: FUI.* Blocked-by #1842 (the shared WeakMap attachment pattern).
- **[#1859]** webguards — prove exit-guard (#273) + access-control (#178) per-scope delegation through the unplugged path (depends on the same per-scope injector seam). *Locus: FUI.* Blocked-by #1856.
- **[#1860]** webbehaviors + webregistries — drive defineLazy/trait-manifest (webbehaviors) and root-registry swap (webregistries) via the unplugged `register/upgrade` API, or record them plugged-only. *Locus: FUI.* Relates #1483/#1545 (root-swap is separately disabled).

The genuinely-plugged-only residue candidates surfaced here (the `Element.insertion`/cloneHandlers prototype patches in webcomponents; possibly the prototype-walk ergonomics in #1858 if WeakMap can't reproduce them) feed the **#1839** residue-bar decision rather than a fix card — they may be *correctly* plugged-only.

## Refreshes / relates

Refreshes `we:reports/2026-06-14-plugs-runtime-audit.md` (#635) — the file-presence matrix is now green; the gap moved from "tests missing" to "tests prove plumbing not surface". Relates #726 (resolution is narrow, not wrong), #649 (the reconcile/backfill residual it tracked), #1842 (WeakMap pattern, gates #1858), #1844 (parity-table drift gate must target FUI), #1839 (residue bar).
