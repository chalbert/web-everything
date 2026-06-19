# Web Portals protocol shape — grounding the 4 open questions for ratification (#1000)

**Date**: 2026-06-19
**Point**: Prior-art survey that brings the four open questions in the Web Portals spec to Definition of Ready — each fork now has named options, prior-art grounding, and a bold default; one fork (focus scopes) is settled outright by a shipped intent the spec duplicates.
**Plan file**: (none — decision-prep for backlog #1000)
**Research page**: `/research/web-portals-protocol-shape/`

---

## Question

The Web Portals spec (`we:src/_includes/project-webportals.njk`, `status:concept`) is a mature 1322-line
draft for a declarative-HTML portal protocol (React-`createPortal` / Vue-`<Teleport>` equivalent), built
on Web Injectors as the logical-tree backbone. It carries four open questions (spec §status → Open
Questions) that gate implementation (#1001). #1000 ratifies the protocol shape; this report supplies the
prior art so the call is fast ratification, not cold research.

1. `logicalParent` — writable property vs set-via-method?
2. `bubblesLogical` × Shadow DOM event retargeting — pre- or post-retarget; what does `composed` mean across a logical hop?
3. Focus scopes — fold into the portal directive, or keep separate?
4. Deferred target resolution — error / queue-until-present / no-op when the target doesn't exist yet?

## Recommendation (per fork)

- **Q1 — declarative IDREF attribute (`logicalparent="id"`) as the front door + a `setLogicalParent()` method escape hatch + a read-only `logicalParent` getter. Reject the writable JS property** the spec currently shows. No DOM structural relationship is exposed as a writable property — `parentNode`/`assignedSlot` are read-only, and every "set a structural relationship" op (`appendChild`, `attachShadow`, `attachInternals`, `slot.assign`) is a **method**. The declarative attribute matches `slot`/`for`/`form`/`popovertarget`. Cycle detection reuses `HierarchyRequestError` `DOMException` on the logical graph. **Confidence ~85%.**
- **Q2 — compute `logicalPath` pre-retarget as a parallel pass over the logical chain, run a fresh retarget at each logical hop, and add a separate opt-in `composedLogical` flag + `composedLogicalPath()` accessor. Do not overload native `composed`/`composedPath()`.** Native retargeting is built up-front at dispatch and adjusts `target` to the *shadow* boundary — the wrong boundary for a portal hop. **Confidence ~80%** (residual: the exact retarget host at a hop — mount element vs declaration element — needs a worked nested example, flagged for the decider).
- **Q3 — keep focus containment a separate composable concern; the portal composes it, never owns it. SETTLED by shipped architecture:** the **Focus Containment Intent** (`we:src/_data/intents.json:290`) already owns trap + `inert` + initialFocus + restore-on-close, and the Modal (`we:intents.json:897`), Anchor (`we:intents.json:1323`), and Autofocus-on-Activation (`we:intents.json:1963`) intents all **compose** it rather than redefine it. The spec's primitive #4 (`focusscope` attribute + `createFocusScope()`) is a **duplication that should be struck** from the spec. **Confidence ~90%.**
- **Q4 — deferred-by-default: attach immediately if the target is present, else observe and attach when it appears; after a bounded window emit a console warning naming the unresolved target; offer a `required` attribute for fail-fast.** Pure hard-error (Vue's non-`defer`) is too brittle for HTML's streamed / author-ordered DOM; pure silent no-op hides typos. **Confidence ~75%** (residual: the diagnostic trigger — parser-complete vs per-portal timeout).

## Key Findings

**Q1 — the platform never exposes structure as a writable property.** `Node.parentNode` and
`Node.assignedSlot` are read-only; reparenting is done by **methods** (`appendChild`/`insertBefore`),
which throw `HierarchyRequestError` on a cycle (host-including-inclusive-ancestor test). Once-only
structural ops (`attachShadow`, `attachInternals`) are methods that throw on a second call.
`HTMLSlotElement.assign()` is the imperative manual-slotting method, paired with the read-only
`assignedSlot` getter. Framework logical parents (`createPortal`, `<Teleport to>`, CDK Portal) are all set
**declaratively by render position**, never an imperative property write. → A reflected IDREF *attribute*
is the platform-idiomatic front door; the spec's writable `logicalParent: Node` is the one branch with no
platform precedent and no validation hook.

**Q2 — retargeting is up-front and shadow-scoped.** Per WHATWG DOM, the event path is assembled in a
single upward walk **before any listener runs**; each path entry stores a shadow-adjusted target computed
at build time. A listener's `event.target` is that entry's adjusted target (the host outside the shadow,
the real node inside the same root); `composedPath()` truncates at closed boundaries. `composed: true`
means the event crosses the **target's shadow boundary** into light DOM. React synthetic events bubble
through the **React tree, not the DOM** — the closest prior art to `bubblesLogical`, but confined to
React's synthetic layer (native capture listeners still see the DOM path). → Logical bubbling is a second,
orthogonal propagation concern; conflating it with `composed` (which means *shadow*-boundary crossing)
breaks `composedPath()` semantics. Keep a separate flag + accessor; retarget per logical hop.

**Q3 — already a separate intent in this codebase.** The Focus Containment Intent
(`we:intents.json:290`, `status:draft`) is described as "Protocol for overlay focus — confining keyboard
focus to an active surface, making the rest of the page inert, where focus lands when it opens, and where
it returns when it closes." The Modal, Anchor, and Autofocus-on-Activation intents each explicitly
"compose … rather than redefine" it. The platform primitives it leans on — `inert`, `<dialog>.showModal()`
(auto-inerts the page + top layer + `:modal`), and the WAI-ARIA APG modal pattern — confirm focus
containment is orthogonal to portaling: you can trap without a portal (in-place wizard step) and portal
without a trap (toast, tooltip, non-modal popover). → Folding focus into the portal directive would
**contradict a shipped seam** and the bias-toward-separation principle. The spec's primitive #4 is struck.

**Q4 — no mainstream framework queues open-endedly.** Vue 3.5 added `<Teleport defer>`, which resolves the
target **after the current render cycle** (so a target rendered later *in the same tick* is found) — but
non-`defer` Teleport **errors** if the target is absent at mount, and even `defer` errors a tick later if
still missing. React's `createPortal` requires the container to exist (`null` throws). Angular CDK is
imperative (caller builds the host first). Solid defaults `mount` to `document.body` (always present). →
Native HTML has no single "mount tick" — the parser streams and source order is author-controlled — so the
forgiving behavior should be the **default** (not opt-in like Vue), with a bounded diagnostic so a typo'd
target doesn't fail silently, and a `required` opt-out for fail-fast.

## Classification (per-fork pass)

- **Q1, Q2, Q4** are **Protocol** contract-shape calls (the `@webeverything` artifact per the spec's
  boundary note — polyfill/runtime impl is FUI/#1001). Q4's default is the most-permissive value
  (forgiving queue), with the restriction (`required`) the author's opt-in — the most-flexible-default
  principle.
- **Q3** classifies as an **Intent** concern that **already exists** (Focus Containment Intent) — so the
  "decision" is really *delete the duplicate primitive and compose the existing intent*, a forced
  invariant rather than a weigh.

## Files Created/Modified

| File | Action |
| --- | --- |
| `we:reports/2026-06-19-web-portals-protocol-shape.md` | created (this report) |
| `we:src/_data/researchTopics.json` | added `web-portals-protocol-shape` entry |
| `we:src/_includes/research-descriptions/web-portals-protocol-shape.njk` | created (full write-up) |
| `we:backlog/1000-ratify-the-web-portals-protocol-resolve-the-4-spec-open-ques.md` | rewritten to prepared-fork shape; `preparedDate` set |
