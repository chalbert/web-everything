---
kind: story
size: 5
parent: "1001"
status: resolved
blockedBy: ["1150"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:demos/webportals-conformance-demo.ts"
relatedProject: webportals
tags: [webportals, build]
---

# Web Portals — conformance demo (overlay/modal/tooltip escape + logical bubbling)

Final slice of #1001 (after the directive #1150): a real-browser conformance demo under we:demos/ (the webidentity/webmanifests pattern) exercising the full stack — a deeply nested component portals a modal/tooltip/toast to an outlet that escapes its stacking context, while CONTEXT preservation (getContext via logical ancestry) and LOGICAL event bubbling (a click/submit inside the portal firing a handler on the logical ancestor via composedLogical) both verifiably hold. Doubles as the platform-first forcing function for #1148/#1149/#1150. Wired into the demo registry + dev-server fallback + quality gates per the new-demo skill.

## Resolved (batch-2026-06-19) — real-browser demo, 5/5 invariants live

Built the conformance demo per the new-demo / webmanifests pattern, exercising the ACTUAL `we:plugs/webportals/` runtime in Chromium (not jsdom):
- **Files**: `we:demos/webportals-conformance-demo.html` / `.ts` / `.css`, registered at `we:src/_data/demos/webportals-conformance-demo.json` (status `draft`, project `webportals`). Served from `we:demos/webportals-conformance-demo.html` on the dev server (port 3000); no dev-server fallback needed (a static playground page, like webmanifests — fallback is only for the router demos).
- **Live scene**: a deeply nested `.card` inside a CSS-transformed, `overflow:hidden` `.wp-clip` declares a `portal-directive` targeting a top-level `portal-outlet` (sibling of the clip). The modal relocates into the outlet — escaping the clip — while staying logically under the card.
- **5 conformance checks, all green in a real browser** (verified via Playwright against the running dev server): (1) the modal relocates into the outlet + escapes the clip; (2) its `logicalParent` is the declaration site; (3) context resolves via LOGICAL ancestry (modal sees the card's `data-ctx-*`); (4) the same context is NOT reachable via the physical DOM ancestry (proves it threaded the logical tree); (5) a click inside the portal bubbles to a handler on the logical ancestor via `composedLogical`, retargeted to the button inside the portalled content. `setPlaygroundReady(5)` for the e2e smoke.

**Browser-vs-jsdom bug surfaced + filed (#1174):** `new PortalDirective({children})` projected nothing in a real browser — `CustomTemplateDirective` appends `{children}` from an instance-property `connectedCallback`, but the browser invokes the prototype callback cached at `define()` time, so the option is a no-op outside jsdom. The demo populates `.content` directly (the canonical template home) instead. (Exactly the browser-probe-first lesson — a jsdom-green path that's dead in a real browser.)

`tsc --noEmit` clean for the demo; `check:standards` green. The pre-existing `blocks/parsers/*` 500s in the dev server are a concurrent/global breakage (they hit the long-working webmanifests demo identically) — not from this demo's own imports.
