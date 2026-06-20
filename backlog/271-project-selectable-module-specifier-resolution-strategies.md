---
kind: decision
size: 5
status: resolved
dateOpened: "2026-06-10"
dateStarted: "2026-06-10"
dateResolved: "2026-06-11"
graduatedTo: none
codifiedIn: "one-off"
tags: []
---

# Project-selectable module-specifier resolution strategies

A project resolves a bare module specifier (e.g. `@frontierui/jsx-runtime`) in more than
one legitimate way, and the right one depends on its toolchain — so resolution is an
**array of strategies the project selects from**, not a single baked answer:
`node_modules` + the package `exports` field (bundler/dev-server), an importmap → the
package's src or built dist (raw browser), a CDN/served URL, or a dev-server alias. The
**only lock is the contract** — the specifier resolves to the package's `exports`, never
to a foreign source/path; the mechanism and resolved location are project config
(config-extends-platform-default; default = node-resolution via `exports`). Generalises
the jsx case settled in #264 (runtime location configurable: package default, URL
override). Does **not** block jsx (#265).

## Ruling (settled 2026-06-10)

**Native-implied resolution — WE owns no resolver and no new project-facing format.** A bare
specifier is resolved by whatever native manifest the project's toolchain already maintains; the
four "strategies" are just those native manifests, not a WE-dispatched set:

| Strategy | Native manifest that does the resolving | When |
|---|---|---|
| `node_modules` + `exports` (**default**) | the installed package's `we:package.json#exports` | bundler / dev-server / node |
| importmap → src or dist | the page's `<script type="importmap">` | raw browser, no bundler |
| CDN / served URL (**override**) | importmap entry pointing at a URL | build-less / CDN delivery |
| dev-server alias | the project's existing `vite`/bundler alias | dev convenience |

WE contributes exactly two thin things, **no resolve-time code**:

1. **The invariant (the only lock).** Whatever manifest a project uses, an `@frontierui/*` entry
   must terminate at the package's `exports` — never at WE/foreign source or a raw in-repo path.
   Enforced as a `check:standards` lint over importmaps/aliases, not a runtime guard. Consistent
   with "protocol is the only lock".
2. **A `moduleResolution` field on the project flavor config** (config-extends-platform-default):
   a default + per-specifier overrides, value space **{default | URL}** matching #264 exactly.
   It is a *generator hint*, not a resolver — when WE scaffolds a project's importmap/alias it
   materialises the choice into the **native** manifest the environment then runs.

```jsonc
// project config (extends platform-default flavor)
"moduleResolution": {
  // default omitted = consume the package the normal way (node-resolution via exports);
  // the project's build/delivery system handles it
  "overrides": { "@frontierui/jsx-runtime": "https://esm.sh/@frontierui/jsx-runtime@1" }
}
```

**Decision (confirmed in discussion):** the common case consumes `@frontierui/jsx-runtime` as a
normal package and lets the project build/delivery system resolve it; the override lets a project
point the *same* specifier at a CDN URL for a **build-less setup** — making the CDN/build-less path
a first-class end-state (a real dimension, both branches legitimate), not a workaround. Local-importmap
is **not** a third named value: it's just "no override — you own the native manifest, WE stays out".

Rejected: a standalone WE resolution manifest (A — invents a project-facing format, violates
minimize-lock-in) and a runtime strategy registry/provider (C — over-built; the mechanisms are
static toolchain facts, not request-time strategies).

## Materialization (agent-ready follow-on)

The substance is fully settled; the residual build is small and decision-free — spun out as its own
Tier-A item (see close-out): a reference page documenting the four native manifests + the invariant,
the `moduleResolution` field added to the project-config schema with {default|URL} override semantics,
and the `check:standards` lint asserting `@frontierui/*` entries resolve to `exports`. This ruling
makes the shared substrate **#088** (runtime-dependency version coupling) and **#170** (consume-package
vs vendor-copy) agent-ready.
