---
kind: decision
size: 2
parent: "125"
status: resolved
dateOpened: "2026-06-06"
blockedBy: ["125"]
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
codifiedIn: "one-off"
tags: [jsx, adapters, packaging, build-tooling, docs]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Decide the documented JSX runtime default — automatic vs classic

When we document how external projects wire the JSX adapter (report §7), we have to pick *one* default to
lead with, even though the runtime supports both:

- **Automatic** (`jsxImportSource: '@webeverything/jsx-runtime'`) — no per-file import, type-checked via
  the package's JSX namespace, the ergonomic path for a real project's `tsconfig`/bundler.
- **Classic** (`jsxFactory: 'jsx.createElement'` + `jsxFragment` / `jsxInject`) — what we use *in-repo*
  today.

**Recommendation:** document **automatic** as the external default (cleanest, no per-file import,
type-checked), and keep **classic** `jsxInject` for our own in-repo wiring. This is a Tier-B "ratify the
recommendation" decision — once nodded, it's a docs edit on the JSX adapter page and the integration
narratives. Depends on the package extraction (#125) for the `jsxImportSource` package to exist.

## Ruling (2026-06-09)

**Document `automatic` as the external default; keep `classic` `jsxInject` for in-repo wiring.** Automatic
(`jsxImportSource: '@webeverything/jsx-runtime'`) is the modern standard (React 17+, Preact, Solid all
default here), is per-project config instead of per-file import noise, and type-checks through the package's
JSX namespace. Classic stays in-repo because `jsxInject` injects the factory globally without needing a
published package, and our build already does it.

**Wrinkle:** the automatic default names `@webeverything/jsx-runtime`, which only exists once the package
extraction (#125, still open) lands. The ruling is settled now; the *application* of it — editing the JSX
adapter page and report §7 to show a real, installable `jsxImportSource` — waits on #125 and is tracked as
#233.
