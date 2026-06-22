---
kind: story
size: 3
parent: "866"
status: open
dateOpened: "2026-06-22"
tags: []
---

# Migrate WE-docs badge surfaces to FUI blocks/badge (mode-C mount)

Migrate the ~25 badge surfaces across src/*.njk + _includes to FUI blocks/badge mounted via the mode-C inline SDK (docs analogue of #865's chrome mount). The smallest surface — proves the inline <surface>→FUI mount transform that #867/#868/#869 replay. Gate npm run verify + a :8080 render check.
