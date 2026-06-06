---
type: issue
status: open
dateOpened: "2026-06-06"
tags: [demos, playground, refactor, docs]
relatedReport: reports/2026-06-06-jsx-adapter-demo-testing-plan.md
relatedProject: webadapters
crossRef: { url: /demos/jsx-adapter-demo/, label: JSX Adapter Playground }
---

# Extract a shared playground harness (chrome + CSS) for conformance demos

The conformance playgrounds (`jsx-adapter-demo`, `component-adapter-demo`) copy-paste their card /
badge / summary / DOM-equality machinery and their `.play`/`.summary`/`.badge`/`.ex` CSS — the two
have already drifted ~80 CSS lines apart. Extract this into one shared source — a `playground-harness.ts`
plus `playground.css` — that every playground imports, never copy-pastes. Retrofit each existing
playground onto it when next touched.

Distinct from the shared **fixture** module in `jsx-adapter-demo-testing` (#A): that stops *example*
drift; this stops *chrome/CSS* drift. Flagged in [docs/agent/demo-workflow.md](../docs/agent/demo-workflow.md)
§3 ("Share the chrome, don't re-roll it"); the first playground work to touch it should create it.
