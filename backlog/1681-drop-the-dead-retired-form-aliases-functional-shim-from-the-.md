---
kind: task
status: open
dateOpened: "2026-06-23"
tags: []
---

# Drop the dead RETIRED_FORM_ALIASES.functional shim from the FUI wrapper catalog

Ratified #1619 Fork-1: the authoring functional form keeps WE id `functional`, and FUI's retired `functional`->react-wrapper wrapper alias has zero real callers (only its own deprecation tests), so the backward-compat shim is dead weight. Remove `RETIRED_FORM_ALIASES.functional` from `fui:tools/gen-wrapper/wrapperFormCatalog.mjs` plus its 2 deprecation tests (`fui:tools/maas/__tests__/wrapperServeHandler.test.mjs:82`, `fui:tools/gen-wrapper/__tests__/wrapperFormCatalog.test.mjs:50-62`). Drops the courtesy redirect only; #977's retirement (functional not a WRAPPER_FORMS member) stands.
