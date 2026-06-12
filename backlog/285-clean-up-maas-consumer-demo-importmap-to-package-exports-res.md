---
type: issue
workItem: task
parent: "081"
status: open
blockedBy: ["087"]
dateOpened: "2026-06-11"
tags: []
---

# Clean up maas-consumer-demo importmap to package-exports resolution

The WE demos/maas-consumer-demo.html importmap maps @frontierui/jsx-runtime to a raw WE source path (/blocks/renderers/jsx/index.ts), which the #274 module-resolution exports-lock flags as a cross-layer leak. The lint scopes to shipped config and skips sandbox demos, so it does not gate; but the demo should resolve the bare specifier to the package exports (the form #265 established for frontierui) — a URL override or node_modules path — not WE source. Small follow-on to #265/#274; part of the #081 MaaS orbit.

## What to do

Repoint the `<script type="importmap">` entry so `@frontierui/jsx-runtime` resolves to the package
exports rather than a raw WE path. The served functional-component modules import the bare specifier,
so the importmap is the seam (#081 phase 2c). Pick the exports-safe form that keeps the demo working
at `:3000`: a `node_modules/@frontierui/jsx-runtime/...` served path (if linked) or a URL override
(the build-less/CDN strategy #271/#264 elevate). Decide alongside #081's served-module resolution —
the specifier baked into the transpile output (`jsxImportSource`) and the importmap must agree.

**Acceptance:** the maas-consumer-demo renders with the importmap pointing at the package exports (not
WE source); if the lint is later widened to demos, this entry passes.

## Blocked — finding (2026-06-11, batch pre-flight + attempt)

Picked up in `batch-2026-06-11`; investigation shows it is **blocked, not a 2-point cleanup** — set
`blockedBy: ["087"]`. The importmap value the browser fetches for the served functional module
(`import jsx from '@frontierui/jsx-runtime'`) must be a real, browser-fetchable URL at `:3000`. The
#274 exports-lock's `isExportsSafeTarget` accepts exactly three shapes: an `http(s)` URL, a path
containing `node_modules/`, or a bare specifier (it rejects any `/`-, `./`-, `../`-leading path and any
`/src/` path). **None of the three resolves today:**

- **node_modules path** — `@frontierui/jsx-runtime` (v0.1.0, built `dist/` present in the sibling
  `frontierui/packages/jsx-runtime`) is **not in WE's node_modules** and **not an npm workspace**.
  Linking it (even as a `devDependency`) would make `@webeverything` declare a dependency on
  `@frontierui/*` — the exact constellation-arrow inversion **#239 (resolved) forbids** ("the standard
  layer must never import the implementation layer"). So linking is ruled out on principle, not just
  effort.
- **CDN / served URL** — not published (`esm.sh/@frontierui/jsx-runtime` → 404). A served URL is
  precisely what **#087** (MaaS distribution — the "production runtime delivery" follow-on of #081,
  itself blocked by #088 versioning) is built to provide. It does not exist yet.
- **bare specifier** — an importmap *value* must be a URL the browser can fetch; a bare specifier as the
  target does not resolve in a raw browser. Not viable.

So the only target that works at `:3000` today is the raw WE-source path the item wants gone — which is
why #274 already deferred this ("clean up when the published `@frontierui/jsx-runtime` resolution
lands"). The demo is a POC sandbox and is correctly **excluded from the gating lint** by design, so the
leak is non-gating in the meantime. Unblocks when #087 yields a served/published runtime URL (or the
package is published so a consumer-style `node_modules` link is legitimate outside WE's own scope).
Dropped from the batch; no code change made.
