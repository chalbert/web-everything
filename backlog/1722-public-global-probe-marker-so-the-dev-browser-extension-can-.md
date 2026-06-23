---
kind: task
status: open
locus: webeverything
parent: "1656"
dateOpened: "2026-06-23"
tags: [dev-browser, conformance, chrome-extension, webregistries]
---

# Public global probe-marker so the dev-browser extension can detect WE on non-declarative pages

Today an extension content-script (isolated world) can only probe the declarative `script[type="registry"]` DOM marker; the richer runtime signals (`SCOPED_REGISTRY_KEY` is a module-private `Symbol()`, `getActiveRegistryResult()` is closure state) are unreadable cross-boundary, so imperatively-scoped-registry / injector-chain / webexpressions-only apps are probe-invisible. Expose a public, cross-world-readable global marker (the move React/Vue made with `__REACT_DEVTOOLS_GLOBAL_HOOK__`) that mirrors WE runtime presence, so probe-first (#1673) widens from the declarative minority to any live WE page. Load-bearing follow-up promoted by #1673's ratification red-team.
