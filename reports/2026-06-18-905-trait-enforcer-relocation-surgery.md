# #905 — Exactly what of WE's trait-enforcer moves to FUI vs stays (prep artifact)

**Date:** 2026-06-18 · **Decision:** [#905](../backlog/905-decide-exactly-what-of-we-s-trait-enforcer-moves-to-fui-vs-s.md) · **Blocks:** [#894](../backlog/894-relocate-the-whole-trait-enforcer-manifest-contract-5-plugins.md) (the relocation) · **Reconsiders:** [#779](../backlog/779-temporal-trait-impl-locus-we-blocks-vs-frontierui-blocks.md) (ratified whole-enforcer→FUI) · **Lineage:** #484/#715/#717/#744/#756/#787 (built the enforcer in WE)

This is a **placement-of-shipped-code** decision: the trait-enforcer already exists in `webeverything/`;
the call is which constellation layer (`@webeverything` standard vs `@frontierui` impl) owns each *piece*
before #894 executes the move. No greenfield design → **no web/prior-art survey** (per *backlog-workflow.md
→ a decision that only ratifies shipped code skips the web survey but still needs the concrete-refs check*),
same family as the #817/#809 placement prep. The grounding is the real import closure classified against
the load-bearing constellation axis: **code that *defines* a neutral contract → WE; code that
*implements/generates against* it → FUI** (#463 neutral-contract SoT→WE + generation adapters→FUI; #817's
placement test "a runtime symbol stays WE only if a WE-side consumer/gate consumes it"; #855/#507 "only the
contract crosses the seam, code never does"; #239 npm-scope-mirrors-layer — **WE may not import FUI**).

## Why this re-opens a ratified call

#779 ratified the **whole** `tools/trait-enforcer/` → FUI, including `we:traitManifestContract.ts`, on the
stated ground that the manifest format is "tied to the way FUI does things … an FUI-shaped intermediate
representation, not a neutral cross-seam contract." #894's pre-flight (batch-2026-06-17) found that premise
collides with the tree on two counts, which is what spawned this decision:

1. **The contract file is authored as the *opposite* of an FUI IR.** `we:tools/trait-enforcer/traitManifestContract.ts:1-30`
   self-describes as "**the neutral, bundler-agnostic** trait-manifest contract … the trait-side analogue of
   the MaaS serve-path IR (`we:servePathIR.ts`, #505)." It holds the *same* neutrality discipline as `servePathIR`
   (a WE-owned IR): **pure data + types, no imports** (not Node, not Vite, not DOM), and ships its scan grammar
   as **regex-source string templates** with a documented `{NAME}` substitution rule "so a code generator that
   has never seen TypeScript … can emit an equivalent scanner in **.NET / Java / Go**" (`:18-22`). That is
   exactly the #463 polyglot-reach neutral-contract SoT — the inverse of an impl-coupled IR.
2. **A WE-side consumer depends on it.** `we:blocks/renderers/module-service/traitServePath.ts:28-31` imports
   `TraitManifest` / `TraitManifestEntry` **types** from the contract; its doc-comment calls it the "#716
   **neutral** trait-manifest contract" and derives the MaaS served-trait plan "from the byte-identical
   manifest every bundler emits" (`we:traitServePath.ts:14-19`). The MaaS serve-path is a WE distribution concern
   (#461/#505, `we:servePathIR.ts` is WE). By #817's placement test the contract has a WE-side consumer → WE.
   And because **WE may not import FUI** (#239), moving the contract to FUI would force `traitServePath` (a WE
   file) into the forbidden WE→FUI import direction, *or* force re-homing the MaaS serve-path itself.

The distinction #779 elided: the manifest **contract** (`we:traitManifestContract.ts` — neutral types + scan
grammar, the *definition*) vs the manifest **module the plugin emits** (`generateManifestModule` in
`we:vite-plugin.ts` — runnable `() => import(spec)` codegen output, the FUI IR). The file even spells this out:
"this file is the **definition**; the Vite plugin is the **reference implementation**, not the definition"
(`we:traitManifestContract.ts:13-17`). The *definition* is the WE contract; the *emitter* is the FUI code.

## The import closure, classified

| Artifact | Kind | WE-side consumer? | Verdict |
|---|---|---|---|
| `we:vite/rollup/webpack/esbuild/parcel-plugin.ts` (5 plugins) | runnable scan-and-emit codegen | none (WE traitMap empty by design) | **→ FUI** (no fork — #779, premise holds) |
| `we:composedTraitSet.ts` | runnable authoring construct (`defineComposedComponent`/`composeTraitSets`) | only its own test | **→ FUI** (no fork; imports `TraitMap` *type* from contract = FUI→WE, allowed) |
| `we:traitManifestContract.ts` | **pure data + types**, no imports, polyglot regex-source | **yes** — `we:traitServePath.ts` (MaaS serve-path) | **Fork 1** — neutral contract w/ WE consumer ⇒ lean **stay WE** |
| `vite.config.mts:96` `traitEnforcer({traitMap:{}})` | build wiring | — | mechanical swap → `resolve.alias` (supported by default) |
| Protocol surface (`plugs/webbehaviors/`: `trait` attr · `registerTraits` · `CustomAttributeRegistry` · runtime `traitManifest`) | WE runtime platform plug | **foundational** | **Fork 2** (the #779 ~70% residual) — lean **stay WE** |

Verified consumers (grep, non-test):
- **`traitManifestContract`** outside the tool dir → only `we:blocks/renderers/module-service/traitServePath.ts`.
- **`composedTraitSet`** → only its own test (leaf; trivial to move).
- **`CustomAttributeRegistry`** → `we:blocks/navigation/registerNavigation.ts`, `we:blocks/router/registerRouter.ts`,
  `we:blocks/for-each/registerForEach.ts`, `we:blocks/attributes/on-event/OnEventAttribute.ts`,
  `plugs/{index,unplugged,bootstrap}.ts`, `we:plugs/webinjectors/InjectorRoot.ts` — i.e. the registry is
  **foundational WE platform**, consumed far beyond traits. It cannot wholesale move without gutting WE's
  binding layer.
- **`virtual:trait-manifest`** is consumed at runtime by `we:plugs/bootstrap.ts:62` and provided three ways:
  the Enforcer plugin under Vite (`vite.config.mts:96`), an ambient `.d.ts` stub under tsc, and the **empty
  static alias under vitest** (`we:vitest.config.ts:75` → `/plugs/webbehaviors/traitManifest`). Today every leg
  lands on an empty manifest (`we:bootstrap.ts:56-62`).

## The mechanical swap (supported by default, not a fork)

Dropping `traitEnforcer()` from `vite.config.mts` leaves `import 'virtual:trait-manifest'` in `we:bootstrap.ts:62`
unresolved under Vite. The fix already exists and is in-tree: the **vitest leg** aliases
`'virtual:trait-manifest' → '/plugs/webbehaviors/traitManifest'` (`we:vitest.config.ts:71-75`) — the empty static
manifest. #894 copies that same `resolve.alias` into `vite.config.mts` (the comment at `vite.config.mts:160`
notes the alias was removed only because it would shadow the plugin's `resolveId`; with the plugin gone the
alias is correct again). `bootstrap` resolves, manifest stays empty — byte-identical runtime behaviour, since
WE's traitMap is empty by design (docs-rendering boundary: WE iframe-embeds FUI demos, never renders traits).

## Per-fork classification (7-question pass)

- **Fork 1 (contract locus):** Which layer? → contract/definition layer (WE). Protocol or intent? → protocol
  contract. Expose whole axis? → n/a (placement). Fixed or dimension? → fixed locus. DI-injectable? → no.
  Most-permissive default? → keep the neutral contract available to all (incl. WE's own MaaS path) ⇒ WE.
  Seam between intents? → it *is* the seam (build-emit ↔ serve-path), both sides read one neutral definition.
- **Fork 2 (protocol-surface locus):** Which layer? → runtime-DI binding plug; `CustomAttributeRegistry` is a
  runtime-DI standard seam consulted by the running app (#052/#081) and foundational across nav/router/for-each
  ⇒ WE platform. Native-first: the shipped `trait` attribute + `registerTraits` semantics *are* the Web Traits
  standard's surface. Bias-to-separation does **not** argue for moving it — the registry is already separate
  from the enforcer (`plugs/webbehaviors/` ≠ `tools/trait-enforcer/`); moving it would *fold* a foundational
  plug into FUI, the opposite of decoupling.

## Recommended defaults (with confidence + the residual)

- **Fork 1 — keep `we:traitManifestContract.ts` in WE (option A): ~75%.** The file is authored to the same
  neutrality discipline as the WE-owned `servePathIR` and has a live WE consumer; moving it forces a forbidden
  WE→FUI import. **This reverses part of #779** — flagged for the deciding agent's skeptic pass. *The residual:*
  #779's user-affirmed read that the format is "tied to how FUI does things." Red-team it at decision time by
  asking whether `generateManifestModule`'s *output* (the emitted thunks) was conflated with the *contract*;
  if the user still reads the format itself as FUI-shaped, fall to B (move contract + re-home `traitServePath`).
- **Fork 2 — keep the protocol surface (incl. `CustomAttributeRegistry`) in WE (stay): ~75%.** Foundational
  platform plug, consumed far beyond traits; native-first makes the `trait` attribute the standard's surface.
  *The residual:* the #779-documented ~30% that WE's Web Traits "standard" is so thin (an empty manifest + a
  bootstrap helper) it should reduce to the generic `CustomAttributeRegistry` plug with no trait-specific
  standard. Even that branch keeps the registry in WE — so the move is at most `registerTraits` + the runtime
  `traitManifest` type, a marginal relocation.

**Net:** the prepared default is the item's option **A** (move 5 plugins + `composedTraitSet`; keep contract +
protocol surface; swap vite to `resolve.alias`), now grounded fork-by-fork rather than asserted. B and C are
the two independent "move further" branches, each with its named excluded-branch flaw.
