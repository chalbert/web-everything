---
kind: story
size: 2
parent: "125"
status: resolved
dateOpened: "2026-06-09"
blockedBy: ["125"]
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
tags: [jsx, adapters, packaging, docs]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Apply the automatic JSX runtime default to the adapter docs

#126 ruled that external projects should wire the JSX adapter with the **automatic** runtime
(`jsxImportSource: '@webeverything/jsx-runtime'`) as the documented default, keeping **classic**
`jsxInject` for our own in-repo wiring. This item applies that ruling to the docs once the runtime
package actually exists.

**Work:**

- Update the `/adapters/jsx-adapter/` page to lead with the `automatic` config (`jsxImportSource`),
  showing the real installable package name, and mention `classic` as the in-repo / no-package fallback.
- Update report §7 (`we:reports/2026-06-06-adapter-real-project-integration.md`) integration narrative to
  match — a real project's `tsconfig`/bundler snippet using `jsxImportSource`.

**Blocked on #125** (package extraction) — the `@webeverything/jsx-runtime` package must be published/
installable before the docs can show a real `jsxImportSource`. Until then this stays open; don't document a
package name that can't be installed.
