---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
tags: []
---

# Failure and network injector over declared reliability paths (dev browser)

Build the dev-browser fault injector (#1644, ratified go; webreliability registry shipped #1051/#1052/#1032): enumerate the app's declared reliability paths from the webreliability recovery-handler registry, inject the matching failure (timeout/5xx/offline/partial) live, and assert the declared recovery path actually fired. Home plateau:dev-browser.
