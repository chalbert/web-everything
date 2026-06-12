---
title: "Module Resolution: The Native-Implied Axis"
description: How a Web Everything project resolves a bare module specifier — the four native manifests, the single invariant, and the moduleResolution config field.
---

# Module Resolution: The Native-Implied Axis

A project resolves a bare module specifier (e.g. `@frontierui/jsx-runtime`) in more than one
legitimate way, and the right one depends on its toolchain. Web Everything **owns no resolver and
introduces no project-facing resolution format** — a bare specifier is resolved by whatever *native*
manifest the project's toolchain already maintains. The "strategies" below are just those native
manifests, not a WE-dispatched set. (Ruling: [#271](/backlog/271-project-selectable-module-specifier-resolution-strategies/); generalises the jsx case from [#264](/backlog/264-decide-the-bare-specifier-browser-resolution-for-frontierui-/).)

## 1. The four native resolution manifests

| Strategy                              | Native manifest that resolves it                | When                              |
| ------------------------------------- | ----------------------------------------------- | --------------------------------- |
| **node_modules + `exports`** (default) | the installed package's `package.json#exports`  | bundler / dev-server / node       |
| **importmap → src or dist**           | the page's `<script type="importmap">`          | raw browser, no bundler           |
| **CDN / served URL** (override)       | an importmap entry pointing at a URL             | build-less / CDN delivery         |
| **dev-server alias**                  | the project's existing vite/bundler alias        | dev convenience                   |

The default — consume the package the normal way and let the project's build/delivery system resolve
it — covers the common case. The URL override makes the **build-less / CDN path a first-class
end-state** (a real dimension, both branches legitimate), not a workaround. "Local importmap" is not a
separate strategy: it is simply *no override* — you own the native manifest and WE stays out.

## 2. The single invariant (the only lock)

Whatever manifest a project uses, an `@frontierui/*` entry **must terminate at the package's
`exports`** — never at WE/foreign source or a raw in-repo path. This is the one lock, consistent with
*“protocol is the only lock”*: the contract (the specifier resolves to the published package) is fixed;
the mechanism and resolved location are project config.

It is enforced statically by a `check:standards` lint (`validateModuleResolutionLock`), not a runtime
guard: every `@frontierui/*` importmap/alias entry must resolve to a URL, a `node_modules` path, or a
bare specifier — a raw source path (`/plugs/…`, `../…/src/…`) fails the build.

## 3. The `moduleResolution` config field

WE contributes a `moduleResolution` field on the project flavor config
(config-extends-platform-default). It is a **generator hint** — when WE scaffolds a project's
importmap/alias it materialises the choice into the native manifest the environment then runs — **not a
resolver**. The value space is exactly **{ default | URL }** (per #264):

```json5
// project config (extends the platform-default flavor)
"moduleResolution": {
  // a specifier omitted (or set to "default") consumes the package the normal way
  // (node-resolution via exports); the project's build/delivery system handles it.
  "overrides": {
    "@frontierui/jsx-runtime": "https://esm.sh/@frontierui/jsx-runtime@1"  // build-less / CDN
  }
}
```

The model + materialiser live at [`module-resolution/provider.ts`](https://github.com/) —
`materializeModuleResolution(config)` emits only the URL overrides as importmap entries; `default`
specifiers are intentionally absent, left to the toolchain's own node-resolution. No resolve-time
runtime code exists or is needed.
