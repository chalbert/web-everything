---
type: decision
workItem: story
size: 2
parent: "125"
status: open
dateOpened: "2026-06-06"
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
