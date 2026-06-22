---
kind: story
status: open
locus: webeverything
blockedBy: ["1504"]
dateOpened: "2026-06-20"
size: 5
dateStarted: "2026-06-22"
tags: [webexpressions, interpolation, text-node, injector, binding, demo]
---

## Progress (batch-2026-06-21-1501-1356) — fix APPLIED, render verification BLOCKED by a newly-found bootstrap break (#1504)

Applied the item's own proven fix: flipped `we:plugs/bootstrap.ts:43` to import the webexpressions registries from `@frontierui/plugs/webexpressions` (was WE-local `./webexpressions`), so the registry's `CustomTextNode` class identity matches the block-layer parser-produced node and `#upgradeTextNode`'s `instanceof` guard fires (completes #449 for the bootstrap). Scope-checked: no other `we:demos/*` imports the WE-local webexpressions class. The fix is committed.

**Could NOT re-confirm the live render this session** — a 2nd-port cold start (the documented verification path) shows the interpolation demo's RESULT slots **empty**, not because of this fix but because `we:blocks/navigation/NavSectionBehavior.ts` 500s on a dangling `../view/ViewEngine` import (migrated to FUI), and bootstrap imports the navigation chain — so the whole bootstrap graph aborts before `customTextNodes.upgrade()` runs (RESULT renders nothing). Filed as **#1504**; this item is now `blockedBy: 1504` (its verified-render + the Playwright regression-test acceptance can only complete once cold-start bootstrap loads). The #449 instanceof analysis + fix above are unchanged and correct by construction.

# `{{ }}` interpolation renders the expression's *path* ("name"), not its evaluated value ("World")

## Symptom

On a freshly cold-started dev server (after #1202 fixed config-load), the
`we:demos/text-interpolation-demo.html` plug modules now load (no more 500s) and
`customTextNodes.upgrade()` runs — but every binding renders the **raw expression path**
instead of the looked-up value:

| Source | Renders | Should render |
| --- | --- | --- |
| `{{name}}` | `Hello, name!` | `Hello, World!` |
| `{{user.profile.name}}` | `User: user.profile.name (…)` | `User: Jane Doe (Platform Engineer)` |
| `{{name \| uppercase}}` | `Shouting: name \| uppercase` | `Shouting: WORLD` |

So it's neither static `{{ }}` syntax nor a live value — the delimiters are stripped and
the expression *source* is emitted. This is **separate from #1202** (which was config-load /
cold-start only; this reproduces on a clean fresh server).

## Root cause — PROVEN (a #449 duplicate-module `instanceof` split)

My first hypothesis (Text-node injector resolution) was **disproved** — every primitive works:
parse → `{context:state, path:name}` ✓; context resolves ✓; `expression.evaluate(...)` → `"World"` ✓;
a hand-built `InterpolationTextNode`, inserted + `connectedCallback()` → `"World"` ✓ (all verified
in a real browser via Playwright on the running server).

The break is in the **upgrade wiring**. `we:plugs/bootstrap.ts` (which the demo imports by relative path) wires the **WE-local** `CustomTextNodeRegistry`
(`we:plugs/webexpressions/CustomTextNodeRegistry.ts`, which imports `CustomTextNode` from the
WE-local `./CustomTextNode`). But the block layer — `we:blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser.ts`
and `we:blocks/text-nodes/interpolation/InterpolationTextNode.ts` — imports the plug layer via
`@frontierui/plugs/webexpressions/*` (the **FUI sibling** copy, per #449). So two different
`CustomTextNode` classes coexist in one runtime. Proven in-browser:

```
weClass_eq_fuiClass : false      // WE-local CustomTextNode !== FUI CustomTextNode
node_instanceof_WE  : false      // parser-produced node is NOT the registry's class…
node_instanceof_FUI : true       // …it's FUI's
node_determined     : false, parserName: 'mustache'   // otherwise perfectly upgradeable
```

`CustomTextNodeRegistry.#upgradeTextNode` (registry line ~105) guards with
`textNode instanceof CustomTextNode` (the **WE-local** class). The FUI-produced node fails that
guard → the node is returned un-upgraded → the raw expression text (`"name"`) renders. Confirmed the
fix: pointing the registry at the **FUI** copy upgrades `Hello, {{name}}!` → `"Hello, World!"`.

## Fix direction (proven, but a #449-completion call)

Align the demo's plug bootstrap onto the **same** plug copy the blocks use — import the
webexpressions registries in `we:plugs/bootstrap.ts` from `@frontierui/plugs/webexpressions`
instead of WE-local `./webexpressions`. This completes #449 (block runtime consumes `@frontierui/plugs`)
for the bootstrap, which it half-missed. (Injector/context resolution is **not** class-identity
sensitive — those resolved fine across the split — so only the text-node registry's `instanceof`
guard is affected.) Scope check before landing: confirm no other demo relies on WE-local-class
custom text nodes, and decide whether WE-local `plugs/webexpressions` runtime should remain at all.

## Testing gap this exposed (the "improve testing" ask)

The existing tests are **green yet missed this**: `we:blocks/__tests__/integration/text-node-pipeline.test.ts`
is mislabeled "integration" — it runs a **hand-rolled `runPipeline`** (parse + evaluate by hand,
lines ~58–81), NOT the real `CustomTextNodeRegistry.upgrade()` DOM path the demo uses. And the unit
tests run under happy-dom, which doesn't model real-browser custom-`Text`-subclass insertion. So the
actual upgrade→DOM→evaluate path was untested. Add a **real-browser (Playwright) regression test** that
calls `customTextNodes.upgrade()` on a connected node and asserts the rendered value.

## How to run (second-port cold-start — no :3000 restart)

The blocker was always observability, not the fix. A registered `customTextNodes` singleton
survives an HMR full-reload, so the bootstrap flip's effect can't be seen on the warm :3000.
**A second Vite instance on a fresh port is a genuine cold start** (separate process → fresh
module graph + fresh `window.customTextNodes`) and leaves the user's :3000 untouched, so the
standing don't-restart-the-dev-server rule is honoured. Steps:

1. **Pre-check the port isn't pinned.** Grep the demo + test harness for a hardcoded
   `localhost:3000` / `:3000` (`we:demos/text-interpolation-demo.html`, any Playwright config).
   If the plug imports / probe URL hardcode :3000, point them at the chosen port for the run.
   Vite auto-increments if :3000 is taken, but pick an explicit port (`--port 3001`) for clarity.
2. **Start the throwaway instance:** run the Vite demo server with `--port 3001` (own process).
3. **Apply the fix:** flip `we:plugs/bootstrap.ts:43` to import the webexpressions registries
   from `@frontierui/plugs/webexpressions` (instead of WE-local `./webexpressions`) — the #449
   single-plug-copy completion so the registry's `instanceof` guard and the parser produce the
   **same** `CustomTextNode` class.
4. **Verify live on :3001 via Playwright:** confirm `weClass===fuiClass` (registry's
   `CustomTextNode` === parser's), then that the RESULT boxes render evaluated values
   ("Hello, World!", "Jane Doe", "WORLD", "#6366f1").
5. **Land acceptance #2:** add the real-browser regression test that drives
   `customTextNodes.upgrade()` on a connected node and asserts the rendered value.
6. **Scope check before landing:** confirm no other demo relies on the WE-local `CustomTextNode`
   class (round-1 scope check found `we:plugs/webexpressions` is otherwise only cross-imported by
   the dormant WE-local plug tree) and decide whether WE-local `plugs/webexpressions` runtime
   should remain at all.
7. **Tear down :3001** (the user's :3000 was never touched).

If step 4 still shows the raw path on a true cold start, the round-1 "necessary but not
sufficient" finding stands and the break is downstream in the upgrade/determine walk — re-open
the live `#upgradeTextNode` instrumentation from the round-2 notes. But the static trace (round 3)
says a real cold start should close the guard; the warm-singleton artifact was the most likely
reason round 1 saw no change.

## Acceptance

- [ ] `we:demos/text-interpolation-demo.html` RESULT boxes show evaluated values
      ("Hello, World!", "Jane Doe", "WORLD", "#6366f1") on a fresh server — verified in a real browser.
- [ ] A **real-browser** test drives `customTextNodes.upgrade()` end-to-end and asserts the rendered
      value (not a hand-rolled pipeline, not happy-dom-only).
- [ ] No second duplicate-`CustomTextNode` split remains (one plug copy at runtime).

## Investigation 2026-06-20 (batch-2026-06-20) — the stated fix is necessary but NOT sufficient

Applied the "## Fix direction" change — flipped `we:plugs/bootstrap.ts` line 43 to import the
webexpressions registries from `@frontierui/plugs/webexpressions` (instead of WE-local
`./webexpressions`). Verified live on the running Vite server (:3000) that the change is served and
that the class-identity split it targeted is now **closed**:

- `window.customTextNodes instanceof` the FUI barrel `CustomTextNodeRegistry` → **true** (registry is
  now FUI's class).
- Curl of the three relevant modules as Vite serves them shows **one** `CustomTextNode` module instance:
  `we:blocks/text-nodes/interpolation/InterpolationTextNode.ts`, `fui:plugs/webexpressions/UndeterminedTextNode.ts`,
  and the `fui:plugs/webexpressions/index.ts` barrel **all** import
  `/@fs/.../frontierui/plugs/webexpressions/CustomTextNode.ts` (same URL → same class). No duplicate split remains.

**Yet the demo still renders `Hello, name!`** (the `{{name}}` UndeterminedTextNode is left un-upgraded)
— Playwright on `we:demos/text-interpolation-demo.html` after the fix, `window.demoReady===true`, zero
console errors. So the `instanceof CustomTextNode` guard at
`fui:plugs/webexpressions/CustomTextNodeRegistry.ts:105` is **no longer** the (sole) cause; the break is
**downstream in the upgrade/determine walk**, not class identity. The import flip is correct per #449
(bootstrap should consume `@frontierui/plugs`, and the scope check found WE-local
`we:plugs/webexpressions` is otherwise only cross-imported by the dormant WE-local plug tree, not the
demo runtime) — but it does not fix the symptom, so it was **reverted** to keep the tree clean.

**Next session (focused):** re-instrument `CustomTextNodeRegistry.upgrade()` / `#upgradeTextNode` on the
live page — confirm the parser actually returns the UndeterminedTextNode array, whether the node reaches
the `instanceof` guard at all, and whether `determine()`/the parserName→nodeClass match (`'mustache'` →
`InterpolationTextNode`) fires. The earlier "duplicate-module `instanceof` split" diagnosis is now
disproven for the runtime as configured; start from the upgrade walk. (Carried forward from
batch-2026-06-20 — outgrew the stated 3-pt one-line fix.)

## Investigation 2026-06-20 (batch-2026-06-20, round 2) — registry resolution RULED OUT; pinned to the `instanceof` guard

Two live Playwright probes on the running :3000 demo narrowed it materially (size bumped 3 → 5 — a debug
spike, not batch fodder):

1. **The demo's "upgrade detached then insert" is NOT the (sole) cause.** The demo does
   `window.customTextNodes.upgrade(clone)` while `clone` is a detached fragment (before `appendChild`),
   so `fui:plugs/webexpressions/CustomTextNodeRegistry.ts:100`'s `if (element.isConnected)` takes the
   `else` branch (line 130-135 "Not connected - just replace" → inserts the **undetermined** parsed
   nodes = raw path). BUT replicating insert-**then**-upgrade on a *connected* host subtree **still
   renders `Hello, name!`** — so connection ordering is not the fix.
2. **Registry resolution + `mustache` lookup are FINE** (eliminated). On a connected host:
   `InjectorRoot.getProviderOf(host, 'customTextNodes')` → resolves ✓, **is** `window.customTextNodes` ✓,
   and that registry **has** `mustache` → `InterpolationTextNode` ✓ (`providerHasMustache: true`). So the
   determine lookup at registry line 109 would return the class — the break is **upstream of it**.
3. **Pinned to the `instanceof CustomTextNode` guard (registry line 105)** or the parser's node output:
   determine only runs if the parsed node is `textNode instanceof CustomTextNode && !determined &&
   parserName`. Registry/lookup being healthy means the parsed node is failing this guard — i.e. the
   parser-produced node's **class identity** (the #449 duplicate-`CustomTextNode` split, which the import
   flip *reverted*, so it is live again) or `determined`/`parserName` state.

**Next session (focused):** instrument the actual `#upgradeTextNode` call on the live connected node —
log the parsed node's constructor vs the registry's `CustomTextNode` (`weClass===fuiClass?`), `determined`,
`parserName`, and whether the line-105 guard passes. The fix is almost certainly the #449 single-plug-copy
completion (one `CustomTextNode` class at runtime) — verify by forcing both the parser and the registry
onto the same `fui:plugs/webexpressions/CustomTextNode` import, then add the real-browser regression test
(acceptance #2). Carried forward — still outgrew the batch slot.

## Investigation 2026-06-20 (batch-2026-06-20b, round 3) — static trace pins the class split; `outgrew` again (3rd carry-forward)

Static import trace (no live probe needed) confirms the class-identity split is **live and exact** in
the current (reverted) tree:

- **Demo registry = WE-local.** `we:plugs/bootstrap.ts:43` imports `CustomTextNodeRegistry` from
  `./webexpressions` (the WE-local plug), and `we:plugs/webexpressions/CustomTextNodeRegistry.ts:8`'s
  `instanceof` guard uses the WE-local `./CustomTextNode`. So `window.customTextNodes` guards on
  **WE-local** `CustomTextNode`.
- **Parser + node = FUI.** `we:blocks/parsers/text-node/double-curly/DoubleCurlyBracketParser.ts:17`
  extends `@frontierui/plugs/webexpressions/CustomTextNodeParser` (its `UndeterminedTextNode` is FUI's),
  and `we:blocks/text-nodes/interpolation/InterpolationTextNode.ts:23` extends FUI's `CustomTextNode`.
- ⇒ parser-produced node is `instanceof` **FUI** `CustomTextNode`, guard checks **WE-local** →
  `false` → node never upgraded → raw path renders. This is precisely the round-0 diagnosis.

**The real blocker is the round-1 contradiction, not the diagnosis.** Round 1 applied the canonical fix
(flip `we:plugs/bootstrap.ts:43` → `@frontierui/plugs/webexpressions`, completing #449 so the registry
guards on the SAME FUI `CustomTextNode` the parser produces) and reported the symptom **still remained**,
then reverted. A static trace says that flip *should* close the guard. So the residual is almost
certainly a **warm-server / singleton artifact**: `window.customTextNodes` is a registered singleton on
the injector chain, and a prior WE-local registry instance (or a cached provider) can survive an HMR
full-reload, so the flip's effect isn't observed without a **cold start** — which the don't-restart-the-
dev-server rule forbids mid-batch. Resolving this needs a focused session that can cold-start :3000,
apply the bootstrap flip, verify `weClass===fuiClass` live, then land acceptance #2's real-browser test.
Not batch fodder (3rd `outgrew`). Released, untouched.

## Update (batch-2026-06-21-1429-1487) — NEW blocker found (#1503); still needs a focused session

Re-grounded with a **2nd-port cold start** (a throwaway `vite --port 3001`, fresh process → fresh
`window.customTextNodes`, leaving the user's :3000 untouched — confirming the prior "needs :3000 restart"
was too pessimistic; a 2nd origin honours the don't-restart rule). Re-confirmed the round-3 diagnosis is
correct on the parts that *can* be read statically: the webexpressions split is real (the FUI copy exports
all three registries; the blocks import the FUI copy; flipping `we:plugs/bootstrap.ts:43` to
`@frontierui/plugs/webexpressions` typechecks clean and the FUI modules import fine in a real browser; no
`we:demos`/`we:test-pages` imports the WE-local webexpressions copy directly).

**But a clean cold-start read is blocked by a SEPARATE, pre-existing crash — the new finding this pass.**
On a fresh cold start the bootstrap throws *before* text-node upgrade: `Failed to execute 'define' on
'CustomAttributeRegistry': "anchor" is not a valid custom attribute name` — a trait/behavior registering
`anchor` without a hyphen. **Proven pre-existing and unrelated** by a control run (with the bootstrap flip
reverted, the `anchor` crash and the empty render *both persist*). It halts the whole bootstrap, so the
demo renders empty — masking *both* the original bug and whether the flip is sufficient — and the report's
**real-browser regression test** can't run either (it needs a working bootstrap). Filed as **#1503**.

This compounds the prior sessions' "necessary but **not** sufficient" finding (2026-06-20): the flip's
end-to-end sufficiency was never cleanly observable (warm-singleton on :3000), and now a cold start is
blocked by #1503. So the speculative one-line flip was **reverted** (kept un-committed, matching the prior
sessions' clean-tree disposition — landing an unverified, possibly-insufficient fix would be wrong). The
durable progress this pass is the **new `#1503` edge**: `blockedBy: 1503`. Carry-forward reason
**blocked-in-fact** — the verification substrate (a non-crashing cold-start bootstrap) is verified-absent.
A focused session should fix #1503 first, then cold-start-verify the flip (sufficient or not) and land the
real-browser regression test. Released to `open`.
