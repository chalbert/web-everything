# Transient element exposed API — the stable read/event surface across self-replacement

**Decision:** [#1961](../backlog/1961-transient-element-exposed-api-the-stable-read-event-surface-.md) · prep survey · 2026-06-29

A transient (A-family) custom element (`TransientElement`, [fui:blocks/transient/TransientElement.ts](../../frontierui/blocks/transient/TransientElement.ts))
replaces itself with a native element on upgrade. This survey grounds the decision over **what stable read/event
surface a transient element should guarantee** — in web-platform standards and in how real design systems expose
toggle state. It feeds #1961 and (downstream) the WE consumer-rule wording in #1960.

## 1. Standards — node liveness & detached-node semantics

A replaced host is a **detached node, not a dead one.** The DOM has no concept of an invalidated node; every
method runs against the orphaned subtree and **never throws**, which is exactly why the misuse is silent.

- **`Node.isConnected`** — true iff the node's shadow-including root is a document
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected) ·
  [WHATWG DOM §4.4](https://dom.spec.whatwg.org/#dom-node-isconnected)). A host removed via `replaceWith`
  reports `isConnected === false` — the standards-blessed liveness check.
- **Mutation methods don't throw on a detached node** — the DOM mutation algorithms operate on trees rooted
  anywhere; they throw only for hierarchy errors, never for "not in a document"
  ([WHATWG DOM mutation algorithms](https://dom.spec.whatwg.org/#mutation-algorithms)). A removed node becomes
  the root of its own orphan tree.
- **`getBoundingClientRect()` → all-zero rect** — not a special "disconnected" rule: a not-rendered element
  generates **no CSS boxes**, so the rect is empty ([CSSOM-View](https://drafts.csswg.org/cssom-view/#dom-element-getboundingclientrect)).
  The cause is "not rendered" (also covers `display:none`), so phrase the contract as *not rendered*, not
  *disconnected*.
- **`focus()` is a no-op** — focusing steps bail if the target is not a **focusable area**, which requires
  "being rendered"; a disconnected element isn't ([WHATWG HTML §focusing-steps](https://html.spec.whatwg.org/multipage/interaction.html#focusing-steps)).
- **Event propagation** — you *can* `dispatchEvent` on a detached node and listeners on the orphan subtree fire;
  what's lost is propagation to the **live document** (delegated ancestors never see it) and user-driven events
  never originate there ([WHATWG DOM dispatch](https://dom.spec.whatwg.org/#dispatching-events)).
- **Custom-element upgrade is spec'd; "replace yourself" is NOT sanctioned** — HTML warns authors to *avoid
  manipulating the node tree* in reactions, and notes `connectedCallback` can run with `isConnected === false`
  and **can fire more than once** ([WHATWG HTML §custom-elements](https://html.spec.whatwg.org/multipage/custom-elements.html)).
  Self-replacement is a tolerated community workaround, not a blessed pattern → any unwrap must be idempotent
  and `isConnected`-guarded.
- **No native `change` on `<button>`** — `change` is specified only for `<input>`/`<select>`/`<textarea>`; a
  toggle button fires only `click`, so any change semantics must be added.

## 2. Self-replacement in the wild — almost nobody does it at runtime

- **HTML web components** (Jeremy Keith) enhance light DOM *in place* — the wrapper **survives** as the stable
  surface; it does not self-erase ([adactio](https://adactio.medium.com/html-web-components-0c80a0fc58be)).
- **Customized built-ins (`is="button"`)** are the standards-blessed way to get a real `<button>` with inherited
  semantics — but **WebKit will never ship it** ([WebKit standards-positions #97](https://github.com/WebKit/standards-positions/issues/97)),
  which is *the* reason people hand-roll self-replacement instead.
- **Compile-away frameworks** (Enhance, WebC, Astro islands) unwrap at **build/server** time, not via runtime
  `connectedCallback` self-erasure; Astro is actively working to *remove* leftover `<astro-island>` wrappers
  because stray nodes break CSS.
- **htmx** swaps nodes wholesale and answers "your listeners die" with **event delegation on a stable ancestor**
  + lifecycle events — never a held reference.
- **Lit / Shoelace / Web Awesome** do the opposite: the host **persists** and owns the API; consumers read the
  element, not a native child.

**Net:** no mainstream library does runtime element-replaces-itself-and-vanishes. The entire stale-ref +
lost-listener + rename problem set exists *only because* the host erases itself.

## 3. How design systems expose toggle state / change

| Library / standard | Toggle-state read | Change signal | Reflects authored attrs? |
|---|---|---|---|
| **Native `<button>` + WAI-ARIA APG (toggle)** | read **`aria-pressed`** after `click` | **no custom event** — `click` then read `aria-pressed` | `aria-pressed` *is* the canonical state attr ([APG Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)) |
| **Shoelace / Web Awesome** | `.checked` (reflects to attr) | **custom `sl-change`** ("listen to `sl-change`, not `click`") | yes — props reflect; events are the API ([Shoelace](https://shoelace.style/getting-started/usage)) |
| **Adobe Spectrum `ToggleButton`** | `isSelected` prop | **`onChange`** | React-prop model |
| **GitHub Primer `ToggleSwitch`** | native button + **`aria-pressed`** | click-driven; events `bubbles+composed` | native button semantics |
| **GoogleChromeLabs HowTo toggle-button** | `aria-pressed` reflected to a `pressed` prop | custom event, **only on user action** | yes — keeps `pressed`↔`aria-pressed` in sync |

Cross-cutting lessons:
- **APG's blessed baseline is `click` + read `aria-pressed`** — it never invents a change event; `aria-pressed`
  is the single stable reflected key.
- **Design systems keep the authored name reflected** — they do **not** rename an authored input attr into a
  different computed ARIA attr. *The rename (`selected`→`aria-pressed`, `value`→`data-value`) is the real
  anti-pattern, orthogonal to self-replacement.*
- **Double-fire is real** — emitting a custom `change` while native `click` also bubbles delivers both;
  mitigate by emitting only the custom event (Shoelace) or only standardizing on `click` (APG).

## 4. Stale-reference guidance

MDN / web.dev / React converge: **do not cache a node reference across a transform/re-render** — delegate on a
stable ancestor, re-query on demand, or gate on `isConnected`. For listeners, the modern answer is
`addEventListener(…, { signal })` + an `AbortController` aborted in `disconnectedCallback` — which underscores
that host-bound listeners are tied to the host's lifetime, which a self-erasing host destroys.

## 5. How the FUI tree actually behaves (local grounding)

- The attribute-**rename** is **not** general: only the two **toggle controls** rename
  (`FilterChipElement`: `selected`→`aria-pressed`, `value`→`data-value`, [fui:FilterChipElement.ts:56-64](../../frontierui/blocks/filter-chip/FilterChipElement.ts#L56-L64);
  `ButtonTransientElement`: `pressed`→`aria-pressed`, `controls`→`aria-controls`/`aria-expanded`). The rest are
  pure-presentational (Badge/Tag/Card — no state) or fully rebuilt (TextField/Progress/Meter/NumberInput — state
  lives in nested native controls).
- **`data-value` is already a phase-agnostic convention** (FilterChip, droplist options), and **read-helpers
  already exist** — `isFilterChipSelected(el)` reads `aria-pressed === 'true'`
  ([fui:FilterChip.ts:82-83](../../frontierui/blocks/filter-chip/FilterChip.ts#L82-L83)); Button reads
  `aria-pressed` similarly.
- **No transient (A-family) element dispatches a CustomEvent.** Only persistent (B-family) behaviors do
  (`step-change`, `tab-change`; [fui:StepperBehavior.ts:20-21](../../frontierui/blocks/stepper/StepperBehavior.ts#L20-L21)).

## 6. Implications for the decision

- **Scope narrows to the two toggle controls.** The "renames across upgrade" problem is `we-filter-chip` /
  `we-button`-specific, not an A-family-wide issue.
- **The canonical toggle-state key on the survivor must be `aria-pressed`** — ARIA-mandated for a toggle button
  (APG). That part is not a fork.
- **Prior art most supports making the *mechanism* stable, not relying on docs alone** — but the lesson is "stop
  renaming the authored surface," reflected-and-stable, not "ship a custom event."
- **A custom `change` event is supported but complementary and carries the double-fire trap** — APG's
  `click` + `aria-pressed` is the lowest-risk baseline; keep coordinated with #1960 Fork 2.
- **Two alternatives the survey raises are out of scope here, by precedent:** *don't self-replace (host persists)*
  reopens the ratified transient-family pattern (block-standard family A) — a higher-altitude reconsideration, not
  this card; *customized built-in `is=`* is foreclosed by Safari. Record both with their reasons rather than
  re-litigate.
- **Robustness riders for the kept pattern:** self-replacement must be idempotent (`connectedCallback` can fire
  >1×) and `isConnected`-guarded — already partly handled by the `#replaced` guard
  ([fui:TransientElement.ts:54-55](../../frontierui/blocks/transient/TransientElement.ts#L54-L55)).
