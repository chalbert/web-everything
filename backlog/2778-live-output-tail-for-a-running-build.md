---
bornAs: xxw8hy0
kind: story
size: 5
parent: "2551"
status: open
scope: ["plateau:src/build-runner/", "plateau:vite.config.mts", "plateau:src/backlog-view/"]
dateOpened: "2026-07-28"
tags: []
---

# Live output tail for a running build

Stream the agent reasoning, tool-calls and validation output live and render the plan-todo checklist (done/running/pending glyphs) updating as it runs. runner.observe() already emits the typed event stream (plateau:src/build-runner/events.ts) but it is not exposed over HTTP and nothing renders it: add an SSE or chunked endpoint off observe() on the backlog-api plugin and a tail view under plateau:src/backlog-view/, making the fixtured plan-todo glyphs in plateau:src/backlog-view/lane-board.ts live.
