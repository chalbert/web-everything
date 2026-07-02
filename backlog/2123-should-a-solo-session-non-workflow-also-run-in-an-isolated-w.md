---
kind: decision
status: open
dateOpened: "2026-07-02"
relatedTo: ["1143"]
tags: [worktree, lane, isolation, session-hygiene, decision]
---

# Should a solo session (non-/workflow) also run in an isolated worktree lane?

A single-item session (a lone /next, /prepare, one-item resolve) today mutates the MAIN checkout in place — claim edits, resolve splices, doc codification all land on the shared working tree. A concurrent session, or the user's own uncommitted work / running dev server on that same checkout, can collide and break the main checkout. The parallel /workflow orchestrator (#1143) already isolates each unit of work in its own git worktree; solo sessions get no such isolation. Decide whether solo sessions should also enter a worktree lane by default. Tradeoff: the dev server runs against the main checkout, so a worktree session's TypeScript/HTML/CSS edits would not surface for Playwright/visual verification without extra wiring — so this is a genuine go/no/how call, not a free default. relatedTo #1143.
