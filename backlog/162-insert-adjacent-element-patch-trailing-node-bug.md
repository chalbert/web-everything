---
type: issue
workItem: task
parent: "137"
status: resolved
graduatedTo: "plateau/src/plugs/custom-elements/pathInsertionMethods.ts (leadingArgs slice fix + extracted pure splitInsertionArgs); proven by pathInsertionMethods.test.ts (8) + real-patch e2e plugs/custom-elements/__demos__/insert-adjacent-element.* driven by e2e/insert-adjacent-element.spec.ts (3)"
dateOpened: "2026-06-07"
dateResolved: "2026-06-07"
tags: [plateau, plugs, dom-patch, custom-elements, bug]
relatedProject: webblocks
crossRef: { url: /backlog/145-windowed-scroll-height-driven-path/, label: "#145 windowed scroll path (surfaced this)" }
---

# Fix the `insertAdjacentElement` DOM patch — it forwards the node as the position arg

`plateau:plateau/src/plugs/custom-elements/pathInsertionMethods.ts` patches insertion methods to upgrade
undetermined nodes on the way in. `insertAdjacentElement` is registered as a **trailing**-node method
(`we:Element.patch.ts` → `trailingMethods`), i.e. the node is the LAST argument: `insertAdjacentElement(position, node)`.

The wrapper computes the slices wrong for the trailing case. For a connected element it does:

```js
const leadingArgs  = trailingMethods.includes(methodName) ? args.slice(-1) : []; // grabs the NODE
const trailingArgs = leadinMethods.includes(methodName)   ? args.slice(1)  : []; // []
const nodes        = args.slice(leadingArgs.length, args.length - trailingArgs.length); // also the NODE
// → originalDescriptor.value.call(this, ...leadingArgs, ...determinedNodes, ...trailingArgs)
//   === insertAdjacentElement(node, node)   ← position string is gone
```

So `el.insertAdjacentElement('afterbegin', someDiv)` throws **"The value provided ('[object HTMLDivElement]')
is not one of 'beforeBegin', 'afterBegin', 'beforeEnd', or 'afterEnd'."** under the real DOM patches.
`leadingArgs` should be the **leading position string** (`args.slice(0, -1)`), and `nodes` the trailing
arg — the trailing branch has the two swapped.

Surfaced by **#145**: it's the first code to run `Windowed`'s render in a real patched browser (happy-dom
unit tests don't apply the patches, and the trait stack isn't wired into a live `<auto-complete>` yet — that's
#138). `Windowed` was changed to reconcile with `insertBefore` (correctly patched) as a workaround, but the
patch itself is still broken for any other caller.

- Fix the leading/trailing slice computation for `trailingMethods` in `pathInsertionMethods`.
- Add a unit test that applies the patch and asserts `insertAdjacentElement(position, node)` both upgrades
  an undetermined node AND honors the position keyword.
- Audit the other branches (`leadinMethods` = `insertBefore`/`replaceChild`, `spreadMethods`) against the
  same off-by-slice class of bug while here.

Acceptance: `el.insertAdjacentElement('afterbegin'|'afterend', node)` works on a connected, patched element
(no throw, node upgraded, correct position), proven by a test that applies the real patch.

## Progress

- **Status:** resolved
- **Branch:** plateau repo (`we:src/plugs/custom-elements/pathInsertionMethods.ts`).
- **Root cause:** the reassembled call is `[...leadingArgs, ...determinedNodes, ...trailingArgs]`. For a
  trailing-node method (`insertAdjacentElement(position, node)`) `leadingArgs` must be the fixed args
  BEFORE the node (the position). The wrapper used `args.slice(-1)` — the node — so it called native
  `insertAdjacentElement(node, node)`, dropping the position string → the DOMException I hit in #145.
- **Fix:** one slice — `args.slice(-1)` → `args.slice(0, -1)` for the `trailingMethods` branch. Extracted
  the whole leading/node/trailing split into a pure exported `splitInsertionArgs(args, methodName,
  leadinMethods, trailingMethods)` so it's unit-testable without the global patch.
- **Audit (other shapes):** `leadin` (`insertBefore`/`replaceChild`, node first + trailing ref) and
  `spread` (`append`/`appendChild`/…, all-nodes) were already correct — pinned by unit tests and a
  real-patch e2e "audit guard". No further off-by-slice bugs.
- **Tests:** `we:pathInsertionMethods.test.ts` (8) covers all three shapes + the exact regression (position
  stays first). Real-patch e2e `we:e2e/insert-adjacent-element.spec.ts` (3) bootstraps `plugs/patch` and
  proves all four position keywords on a connected element, the returned-node contract, and the sibling
  methods. Full plateau suite **196/196**, e2e **8/8**.
- **Leftovers → new backlog items:** Playwright `evaluate` returns `undefined` for objects/arrays on
  `plugs/patch` pages (only primitives serialize) → **#165**.
- **Notes:** #145's `Windowed` used `insertBefore` to dodge this bug; that reconcile is clean and stays
  (no need to revert to `insertAdjacentElement`). The pre-existing broken plateau `.eslintrc` is unrelated.
